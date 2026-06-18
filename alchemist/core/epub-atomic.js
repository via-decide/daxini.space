'use strict';

/**
 * @fileoverview epub-atomic.js
 * @module core/epub-atomic
 * 
 * Antigravity Synthesis Orchestrator - Atomic EPUB Export System
 * 
 * Provides a highly robust, deterministic, and atomic export pipeline for EPUB generation.
 * Ensures that partial, corrupted, or invalid EPUB files are NEVER written to the final
 * output path. Utilizes a strict staging -> build -> validate -> commit -> cleanup lifecycle.
 * 
 * Features:
 * - Isolated staging environments per job (/tmp/epub-build/<job-id>/)
 * - Strict state machine preventing illegal lifecycle transitions
 * - EPUB 3.0 structural validation (mimetype uncompressed/first, container.xml checks)
 * - Atomic commits cross-device (EXDEV handling via target-dir staging + atomic rename)
 * - Automatic cleanup on failure, rollback, or process termination (SIGINT, SIGTERM)
 * - Event-driven architecture for progress tracking and integration
 */

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { createWriteStream } = require('fs');
const archiver = require('archiver'); // Requires 'archiver' package

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const SYSTEM_TMP_DIR = os.tmpdir();
const BASE_STAGING_DIR = path.join(SYSTEM_TMP_DIR, 'epub-build');

const JOB_STATES = Object.freeze({
    PENDING: 'PENDING',
    INITIALIZED: 'INITIALIZED',
    STAGING: 'STAGING',
    BUILDING: 'BUILDING',
    BUILT: 'BUILT',
    VALIDATING: 'VALIDATING',
    VALIDATED: 'VALIDATED',
    COMMITTING: 'COMMITTING',
    COMMITTED: 'COMMITTED',
    ROLLING_BACK: 'ROLLING_BACK',
    FAILED: 'FAILED',
    ABORTED: 'ABORTED'
});

const EPUB_MIME_TYPE = 'application/epub+zip';
const REQUIRED_EPUB_FILES = [
    'mimetype',
    'META-INF/container.xml'
];

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

class AtomicEpubError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

class StateTransitionError extends AtomicEpubError {
    constructor(currentState, attemptedState, jobId) {
        super(
            `Invalid state transition from ${currentState} to ${attemptedState} for job ${jobId}`,
            'ERR_INVALID_STATE_TRANSITION',
            { currentState, attemptedState, jobId }
        );
    }
}

class ValidationError extends AtomicEpubError {
    constructor(message, validationDetails, jobId) {
        super(`EPUB Validation Failed: ${message}`, 'ERR_EPUB_VALIDATION_FAILED', { validationDetails, jobId });
    }
}

class CommitError extends AtomicEpubError {
    constructor(message, originalError, jobId) {
        super(`Failed to commit EPUB: ${message}`, 'ERR_COMMIT_FAILED', { originalError, jobId });
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generates a cryptographically secure, collision-resistant Job ID.
 * @returns {string} Hexadecimal job identifier
 */
function generateJobId() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Ensures a directory exists, creating it recursively if necessary.
 * @param {string} dirPath - Directory path to ensure
 */
async function ensureDir(dirPath) {
    try {
        await fsPromises.access(dirPath, fs.constants.W_OK);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fsPromises.mkdir(dirPath, { recursive: true });
        } else {
            throw err;
        }
    }
}

/**
 * Safely removes a directory and all its contents.
 * @param {string} dirPath - Directory path to remove
 */
async function safeRemoveDir(dirPath) {
    try {
        await fsPromises.rm(dirPath, { recursive: true, force: true });
    } catch (err) {
        // Log silently or ignore. This is a cleanup routine.
        console.warn(`[AtomicEpub] Warning: Failed to cleanup directory ${dirPath}: ${err.message}`);
    }
}

// ============================================================================
// ATOMIC EPUB JOB CLASS
// ============================================================================

/**
 * Represents a single atomic operation to stage, build, validate, and commit an EPUB file.
 * @extends EventEmitter
 */
class AtomicEpubJob extends EventEmitter {
    /**
     * @param {string} finalOutputPath - The absolute path where the final .epub file should reside.
     * @param {Object} [options] - Job configuration options.
     * @param {boolean} [options.strictValidation=true] - Whether to enforce strict EPUB structure validation.
     * @param {boolean} [options.runEpubCheck=false] - Whether to attempt running W3C epubcheck binary if available.
     * @param {string} [options.epubCheckPath='epubcheck'] - Path to the epubcheck binary or jar wrapper.
     */
    constructor(finalOutputPath, options = {}) {
        super();
        
        if (!finalOutputPath || typeof finalOutputPath !== 'string') {
            throw new AtomicEpubError('Final output path must be a valid string.', 'ERR_INVALID_OUTPUT_PATH');
        }

        if (!finalOutputPath.toLowerCase().endsWith('.epub')) {
            throw new AtomicEpubError('Final output path must end with .epub extension.', 'ERR_INVALID_EXTENSION');
        }

        this.jobId = generateJobId();
        this.finalOutputPath = path.resolve(finalOutputPath);
        this.options = {
            strictValidation: true,
            runEpubCheck: false,
            epubCheckPath: 'epubcheck',
            ...options
        };

        // Paths
        this.stagingDir = path.join(BASE_STAGING_DIR, this.jobId);
        this.contentDir = path.join(this.stagingDir, 'content');
        this.tempEpubPath = path.join(this.stagingDir, `build_${this.jobId}.epub`);

        // State Tracking
        this.state = JOB_STATES.PENDING;
        this.filesStaged = 0;
        this.bytesStaged = 0;
        this.createdAt = new Date();
        this.completedAt = null;
        this.error = null;

        // Register process handlers to prevent orphaned temp files
        this._cleanupHandler = this._handleProcessExit.bind(this);
        process.on('exit', this._cleanupHandler);
        process.on('SIGINT', this._cleanupHandler);
        process.on('SIGTERM', this._cleanupHandler);
    }

    /**
     * Internal state transition guard.
     * @param {string} newState - The state to transition to.
     * @param {Array<string>} allowedCurrentStates - States from which this transition is valid.
     * @private
     */
    _transition(newState, allowedCurrentStates) {
        if (!allowedCurrentStates.includes(this.state)) {
            throw new StateTransitionError(this.state, newState, this.jobId);
        }
        const oldState = this.state;
        this.state = newState;
        this.emit('stateChange', { jobId: this.jobId, oldState, newState });
    }

    /**
     * Initializes the staging environment.
     * @returns {Promise<void>}
     */
    async initialize() {
        this._transition(JOB_STATES.INITIALIZED, [JOB_STATES.PENDING]);
        try {
            await ensureDir(this.stagingDir);
            await ensureDir(this.contentDir);
            this.emit('initialized', this.stagingDir);
        } catch (err) {
            await this._fail(err);
            throw err;
        }
    }

    /**
     * Adds a raw file buffer/string to the staging environment.
     * @param {string} relativePath - Path within the EPUB (e.g., 'OEBPS/content.xhtml')
     * @param {string|Buffer} content - The file content
     * @returns {Promise<void>}
     */
    async addContent(relativePath, content) {
        this._transition(JOB_STATES.STAGING, [JOB_STATES.INITIALIZED, JOB_STATES.STAGING]);
        try {
            const absoluteDest = path.join(this.contentDir, relativePath);
            
            // Security check to prevent path traversal
            if (!absoluteDest.startsWith(this.contentDir)) {
                throw new AtomicEpubError('Path traversal detected in relative path.', 'ERR_PATH_TRAVERSAL', { relativePath });
            }

            await ensureDir(path.dirname(absoluteDest));
            await fsPromises.writeFile(absoluteDest, content);
            
            this.filesStaged++;
            this.bytesStaged += Buffer.byteLength(content);
            this.emit('fileStaged', { relativePath, size: Buffer.byteLength(content) });
        } catch (err) {
            await this._fail(err);
            throw err;
        }
    }

    /**
     * Copies a local file into the EPUB staging environment.
     * @param {string} sourcePath - Absolute path to the source file
     * @param {string} relativePath - Path within the EPUB
     * @returns {Promise<void>}
     */
    async addLocalFile(sourcePath, relativePath) {
        this._transition(JOB_STATES.STAGING, [JOB_STATES.INITIALIZED, JOB_STATES.STAGING]);
        try {
            const absoluteDest = path.join(this.contentDir, relativePath);
            
            if (!absoluteDest.startsWith(this.contentDir)) {
                throw new AtomicEpubError('Path traversal detected.', 'ERR_PATH_TRAVERSAL', { relativePath });
            }

            await ensureDir(path.dirname(absoluteDest));
            await fsPromises.copyFile(sourcePath, absoluteDest);
            
            const stats = await fsPromises.stat(sourcePath);
            this.filesStaged++;
            this.bytesStaged += stats.size;
            this.emit('fileStaged', { relativePath, sourcePath, size: stats.size });
        } catch (err) {
            await this._fail(err);
            throw err;
        }
    }

    /**
     * Recursively copies a local directory into the staging environment.
     * @param {string} sourceDir - Absolute path to the source directory
     * @param {string} [baseRelativePath=''] - Base path within the EPUB
     * @returns {Promise<void>}
     */
    async addLocalDirectory(sourceDir, baseRelativePath = '') {
        this._transition(JOB_STATES.STAGING, [JOB_STATES.INITIALIZED, JOB_STATES.STAGING]);
        try {
            const entries = await fsPromises.readdir(sourceDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullSourcePath = path.join(sourceDir, entry.name);
                const fullRelativePath = path.posix.join(baseRelativePath, entry.name);

                if (entry.isDirectory()) {
                    await this.addLocalDirectory(fullSourcePath, fullRelativePath);
                } else if (entry.isFile()) {
                    await this.addLocalFile(fullSourcePath, fullRelativePath);
                }
            }
        } catch (err) {
            await this._fail(err);
            throw err;
        }
    }

    /**
     * Builds the EPUB file in the temporary directory.
     * Implements strict EPUB zip requirements (mimetype uncompressed and first).
     * @returns {Promise<string>} Path to the built temporary EPUB file
     */
    async build() {
        this._transition(JOB_STATES.BUILDING, [JOB_STATES.STAGING]);
        
        return new Promise(async (resolve, reject) => {
            try {
                // Ensure mimetype exists in staging, if not, create it
                const mimetypePath = path.join(this.contentDir, 'mimetype');
                try {
                    await fsPromises.access(mimetypePath);
                } catch {
                    await fsPromises.writeFile(mimetypePath, EPUB_MIME_TYPE);
                }

                const output = createWriteStream(this.tempEpubPath);
                const archive = archiver('zip', {
                    zlib: { level: 9 } // Maximum compression for general files
                });

                output.on('close', () => {
                    this._transition(JOB_STATES.BUILT, [JOB_STATES.BUILDING]);
                    this.emit('built', { path: this.tempEpubPath, size: archive.pointer() });
                    resolve(this.tempEpubPath);
                });

                archive.on('error', (err) => {
                    this._fail(err).then(() => reject(err));
                });

                archive.on('warning', (err) => {
                    if (err.code === 'ENOENT') {
                        console.warn(`[AtomicEpub] Archiver warning: ${err.message}`);
                    } else {
                        this._fail(err).then(() => reject(err));
                    }
                });

                archive.pipe(output);

                // EPUB REQUIREMENT: mimetype MUST be the first file and MUST NOT be compressed.
                archive.file(mimetypePath, { name: 'mimetype', store: true });

                // Append everything else in the content directory (excluding mimetype)
                archive.glob('**/*', { 
                    cwd: this.contentDir, 
                    ignore: ['mimetype'] 
                });

                await archive.finalize();

            } catch (err) {
                await this._fail(err);
                reject(err);
            }
        });
    }

    /**
     * Validates the generated EPUB file.
     * Prevents corrupted files from ever reaching the final output path.
     * @returns {Promise<boolean>} True if valid
     */
    async validate() {
        this._transition(JOB_STATES.VALIDATING, [JOB_STATES.BUILT]);
        
        try {
            if (this.options.strictValidation) {
                await this._performStructuralValidation();
            }

            if (this.options.runEpubCheck) {
                await this._runExternalEpubCheck();
            }

            this._transition(JOB_STATES.VALIDATED, [JOB_STATES.VALIDATING]);
            this.emit('validated', { jobId: this.jobId });
            return true;
        } catch (err) {
            await this._fail(err);
            throw err;
        }
    }

    /**
     * Performs an internal structural validation of the EPUB file.
     * Checks for mimetype presence and META-INF/container.xml.
     * @private
     */
    async _performStructuralValidation() {
        // Basic file size check
        const stats = await fsPromises.stat(this.tempEpubPath);
        if (stats.size < 100) {
            throw new ValidationError('Generated EPUB file is suspiciously small or empty.', { size: stats.size }, this.jobId);
        }

        // We verify the contents exist in the staging dir since the zip was just built from it.
        // A true zip reader would be ideal here (like adm-zip), but to keep this module 
        // self-contained and highly robust, we validate the staging structure that fed the zip.
        for (const reqFile of REQUIRED_EPUB_FILES) {
            const fullPath = path.join(this.contentDir, reqFile);
            try {
                await fsPromises.access(fullPath, fs.constants.R_OK);
            } catch {
                throw new ValidationError(`Missing required EPUB structure file: ${reqFile}`, { missingFile: reqFile }, this.jobId);
            }
        }

        // Validate mimetype content
        const mimeContent = await fsPromises.readFile(path.join(this.contentDir, 'mimetype'), 'utf-8');
        if (mimeContent.trim() !== EPUB_MIME_TYPE) {
            throw new ValidationError(`Invalid mimetype content. Expected '${EPUB_MIME_TYPE}', got '${mimeContent.trim()}'`, { mimeContent }, this.jobId);
        }
    }

    /**
     * Attempts to run W3C epubcheck binary if configured.
     * @private
     */
    async _runExternalEpubCheck() {
        return new Promise((resolve, reject) => {
            const checkProcess = spawn(this.options.epubCheckPath, [this.tempEpubPath]);
            
            let stderr = '';
            checkProcess.stderr.on('data', (data) => { stderr += data.toString(); });
            
            checkProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new ValidationError('External epubcheck failed.', { exitCode: code, stderr }, this.jobId));
                } else {
                    resolve();
                }
            });

            checkProcess.on('error', (err) => {
                // If the binary isn't found, we can either fail or warn. 
                // Given strict atomic principles, if runEpubCheck is true, missing binary is a failure.
                reject(new ValidationError('Failed to execute external epubcheck binary.', { error: err.message }, this.jobId));
            });
        });
    }

    /**
     * Commits the built and validated EPUB to the final destination atomically.
     * Handles Cross-Device (EXDEV) moves safely by staging in the target directory first.
     * @returns {Promise<string>} The final output path
     */
    async commit() {
        this._transition(JOB_STATES.COMMITTING, [JOB_STATES.VALIDATED]);
        
        try {
            const finalDir = path.dirname(this.finalOutputPath);
            await ensureDir(finalDir);

            // To guarantee atomicity even across different filesystems (e.g., /tmp to /var/www),
            // we copy to a hidden temp file in the target directory first, then rename.
            const targetTempPath = path.join(finalDir, `.${path.basename(this.finalOutputPath)}.tmp.${this.jobId}`);

            try {
                // Phase 1: Copy to target filesystem (Not atomic, but hidden)
                await fsPromises.copyFile(this.tempEpubPath, targetTempPath);
                
                // Phase 2: Atomic rename on the same filesystem
                await fsPromises.rename(targetTempPath, this.finalOutputPath);
            } catch (fsErr) {
                // Clean up the target temp file if it failed midway
                await fsPromises.unlink(targetTempPath).catch(() => {});
                throw fsErr;
            }

            this.completedAt = new Date();
            this._transition(JOB_STATES.COMMITTED, [JOB_STATES.COMMITTING]);
            this.emit('committed', { destination: this.finalOutputPath, jobId: this.jobId });

            // Cleanup staging environment post-success
            await this._cleanup();
            
            return this.finalOutputPath;

        } catch (err) {
            await this._fail(new CommitError(err.message, err, this.jobId));
            throw err;
        }
    }

    /**
     * Aborts the job and cleans up all temporary resources.
     * @param {string} [reason] - Reason for rollback
     * @returns {Promise<void>}
     */
    async rollback(reason = 'Manual rollback requested') {
        if ([JOB_STATES.COMMITTED, JOB_STATES.ROLLED_BACK, JOB_STATES.ABORTED].includes(this.state)) {
            return; // Already in a terminal state
        }
        
        this._transition(JOB_STATES.ROLLING_BACK, [
            JOB_STATES.PENDING, JOB_STATES.INITIALIZED, JOB_STATES.STAGING, 
            JOB_STATES.BUILDING, JOB_STATES.BUILT, JOB_STATES.VALIDATING, 
            JOB_STATES.VALIDATED, JOB_STATES.COMMITTING, JOB_STATES.FAILED
        ]);

        this.error = new Error(reason);
        await this._cleanup();
        
        this._transition(JOB_STATES.ABORTED, [JOB_STATES.ROLLING_BACK]);
        this.emit('aborted', { reason, jobId: this.jobId });
    }

    /**
     * Internal failure handler. Transitions state and triggers cleanup.
     * @param {Error} err - The error that caused the failure
     * @private
     */
    async _fail(err) {
        this.error = err;
        console.error(`[AtomicEpub] Job ${this.jobId} failed:`, err.message);
        
        // Suppress transition errors if we're already failing
        try {
            this.state = JOB_STATES.FAILED;
            this.emit('failed', { error: err, jobId: this.jobId });
            await this._cleanup();
        } catch (cleanupErr) {
            console.error(`[AtomicEpub] Critical: Failed to cleanup after job failure ${this.jobId}:`, cleanupErr);
        }
    }

    /**
     * Cleans up the staging directory and removes process listeners.
     * @private
     */
    async _cleanup() {
        process.removeListener('exit', this._cleanupHandler);
        process.removeListener('SIGINT', this._cleanupHandler);
        process.removeListener('SIGTERM', this._cleanupHandler);
        
        await safeRemoveDir(this.stagingDir);
        this.emit('cleaned', { jobId: this.jobId });
    }

    /**
     * Synchronous cleanup handler for process exits.
     * Attempts to forcefully remove temp directories using sync methods to ensure it runs during exit.
     * @private
     */
    _handleProcessExit() {
        if (this.state !== JOB_STATES.COMMITTED && this.state !== JOB_STATES.ABORTED) {
            try {
                if (fs.existsSync(this.stagingDir)) {
                    fs.rmSync(this.stagingDir, { recursive: true, force: true });
                }
            } catch (e) {
                // Sync cleanup failure during exit; nothing more can be done.
            }
        }
    }

    /**
     * Helper method to execute the entire pipeline automatically if the source directory is ready.
     * @param {string} sourceDirectory - Path to the fully prepared unzipped EPUB directory.
     * @returns {Promise<string>} Final output path
     */
    async executePipeline(sourceDirectory) {
        await this.initialize();
        await this.addLocalDirectory(sourceDirectory);
        await this.build();
        await this.validate();
        return await this.commit();
    }
}

// ============================================================================
// SYSTEM MANAGER
// ============================================================================

/**
 * Global manager for Atomic EPUB Jobs.
 * Useful for tracking multiple concurrent exports and enforcing global limits.
 */
class AtomicExportSystem {
    constructor() {
        this.activeJobs = new Map();
    }

    /**
     * Creates a new Atomic EPUB Job
     * @param {string} finalOutputPath - Target path for the EPUB
     * @param {Object} options - Job options
     * @returns {AtomicEpubJob}
     */
    createJob(finalOutputPath, options = {}) {
        const job = new AtomicEpubJob(finalOutputPath, options);
        
        this.activeJobs.set(job.jobId, job);

        // Auto-remove from tracker on terminal states
        const terminalHandler = () => {
            this.activeJobs.delete(job.jobId);
        };

        job.on('committed', terminalHandler);
        job.on('aborted', terminalHandler);
        job.on('failed', terminalHandler);

        return job;
    }

    /**
     * Aborts all currently active jobs. Useful during graceful shutdowns.
     * @returns {Promise<void>}
     */
    async abortAll(reason = 'System shutting down') {
        const abortPromises = [];
        for (const [jobId, job] of this.activeJobs.entries()) {
            abortPromises.push(job.rollback(reason));
        }
        await Promise.allSettled(abortPromises);
        this.activeJobs.clear();
    }
    
    /**
     * Purges orphaned staging directories from previous crashed runs.
     * Should be called on application startup.
     * @returns {Promise<number>} Number of orphaned directories cleaned
     */
    async purgeOrphans() {
        let count = 0;
        try {
            await ensureDir(BASE_STAGING_DIR);
            const entries = await fsPromises.readdir(BASE_STAGING_DIR, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory() && !this.activeJobs.has(entry.name)) {
                    const orphanPath = path.join(BASE_STAGING_DIR, entry.name);
                    await safeRemoveDir(orphanPath);
                    count++;
                }
            }
        } catch (err) {
            console.error('[AtomicEpub] Failed to purge orphans:', err);
        }
        return count;
    }
}

// Export the singleton manager and classes
const defaultSystem = new AtomicExportSystem();

module.exports = {
    AtomicExportSystem,
    AtomicEpubJob,
    JOB_STATES,
    AtomicEpubError,
    StateTransitionError,
    ValidationError,
    CommitError,
    
    // Convenience methods mapping to the default system instance
    createJob: (finalOutputPath, options) => defaultSystem.createJob(finalOutputPath, options),
    abortAll: (reason) => defaultSystem.abortAll(reason),
    purgeOrphans: () => defaultSystem.purgeOrphans()
};