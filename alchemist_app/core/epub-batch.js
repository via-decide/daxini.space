/**
 * @fileoverview EPUB Batch Processing System
 * @module core/epub-batch
 * 
 * Provides a robust, production-ready job queue and isolation manager for batch 
 * exporting EPUB files. This system is designed to handle multiple concurrent book 
 * exports without filesystem conflicts by leveraging isolated temporary workspaces.
 * 
 * Features:
 * - Configurable concurrency limits
 * - Workspace isolation (prevents race conditions during parallel `make publish` calls)
 * - Automatic retry with exponential backoff
 * - Detailed job state management and event emission
 * - Sub-process orchestration for Python/Make build pipelines
 * - Comprehensive error handling and cleanup
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// --- Constants & Enums ---

/**
 * Enum for Job States.
 * @readonly
 * @enum {string}
 */
const JobState = {
    PENDING: 'PENDING',
    QUEUED: 'QUEUED',
    INITIALIZING_WORKSPACE: 'INITIALIZING_WORKSPACE',
    PROCESSING: 'PROCESSING',
    FINALIZING: 'FINALIZING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
};

/**
 * Default configuration for the Batch Processor.
 */
const DEFAULT_CONFIG = {
    concurrency: Math.max(1, os.cpus().length - 1), // Leave one CPU free by default
    maxRetries: 3,
    retryDelayMs: 2000,
    jobTimeoutMs: 1000 * 60 * 15, // 15 minutes max per job
    tempDirPrefix: 'alchemist_epub_build_',
    buildCommand: 'make',
    buildArgs: ['publish'],
    outputEpubPath: 'build/epub/book.epub', // Relative to workspace
    outputPdfPath: 'build/pdf/book_print.pdf' // Relative to workspace
};

// --- Utility Classes ---

/**
 * Generates unique identifiers for jobs.
 */
class IdGenerator {
    /**
     * @returns {string} A secure random ID.
     */
    static generate() {
        return crypto.randomBytes(16).toString('hex');
    }
}

/**
 * Custom Error class for Job-related failures.
 */
class JobError extends Error {
    constructor(message, jobId, code = 'JOB_ERROR') {
        super(message);
        this.name = 'JobError';
        this.jobId = jobId;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

// --- Core Models ---

/**
 * Represents a single EPUB generation job.
 */
class EpubJob {
    /**
     * @param {Object} options - Job configuration options.
     * @param {string} options.sourceDir - The directory containing the book's source files.
     * @param {string} options.outputDir - The directory where the final EPUB/PDF should be saved.
     * @param {string} [options.bookId] - Optional identifier for the book.
     * @param {Object} [options.metadata] - Additional metadata for the job.
     */
    constructor(options) {
        this.id = IdGenerator.generate();
        this.sourceDir = path.resolve(options.sourceDir);
        this.outputDir = path.resolve(options.outputDir);
        this.bookId = options.bookId || path.basename(this.sourceDir);
        this.metadata = options.metadata || {};
        
        this.state = JobState.PENDING;
        this.createdAt = new Date();
        this.startedAt = null;
        this.completedAt = null;
        this.error = null;
        
        this.attempts = 0;
        this.logs = [];
        this.workspacePath = null;
    }

    /**
     * Appends a log message to the job's history.
     * @param {string} level - Log level (INFO, WARN, ERROR)
     * @param {string} message - The log message.
     */
    log(level, message) {
        const entry = { timestamp: new Date().toISOString(), level, message };
        this.logs.push(entry);
    }

    /**
     * Computes the duration of the job if it has started.
     * @returns {number|null} Duration in milliseconds, or null if not started.
     */
    getDuration() {
        if (!this.startedAt) return null;
        const end = this.completedAt || new Date();
        return end.getTime() - this.startedAt.getTime();
    }

    /**
     * Serializes the job for safe logging or API transmission.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            bookId: this.bookId,
            state: this.state,
            sourceDir: this.sourceDir,
            outputDir: this.outputDir,
            attempts: this.attempts,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            duration: this.getDuration(),
            error: this.error ? this.error.message : null
        };
    }
}

// --- Workspace Management ---

/**
 * Manages isolated file system workspaces to prevent race conditions
 * when processing multiple books concurrently.
 */
class WorkspaceIsolator {
    /**
     * @param {Object} config - Configuration object.
     */
    constructor(config) {
        this.config = config;
        this.baseTempDir = os.tmpdir();
    }

    /**
     * Creates an isolated workspace and copies the source files into it.
     * @param {EpubJob} job - The job requiring a workspace.
     * @returns {Promise<string>} The path to the isolated workspace.
     */
    async setupWorkspace(job) {
        job.state = JobState.INITIALIZING_WORKSPACE;
        job.log('INFO', 'Initializing isolated workspace...');

        const workspaceName = `${this.config.tempDirPrefix}${job.id}`;
        const workspacePath = path.join(this.baseTempDir, workspaceName);

        try {
            // Create the temporary directory
            await fs.mkdir(workspacePath, { recursive: true });
            
            // Perform a deep copy of the source directory to the workspace
            // Note: In a heavily optimized environment, we might use rsync or hardlinks,
            // but for cross-platform Node.js compatibility, we use fs.cp.
            await fs.cp(job.sourceDir, workspacePath, { 
                recursive: true,
                // Exclude existing build directories to save time and space
                filter: (src) => !src.includes(`${path.sep}build${path.sep}`) && !src.includes(`${path.sep}.venv${path.sep}`)
            });

            // If the project uses a python venv, we might need to recreate it or link it.
            // For this implementation, we assume the global or inherited environment has the tools,
            // or the Makefile handles venv creation/activation.

            job.workspacePath = workspacePath;
            job.log('INFO', `Workspace initialized at ${workspacePath}`);
            return workspacePath;

        } catch (error) {
            job.log('ERROR', `Failed to setup workspace: ${error.message}`);
            throw new JobError(`Workspace setup failed: ${error.message}`, job.id, 'WORKSPACE_SETUP_FAILED');
        }
    }

    /**
     * Cleans up the isolated workspace to free disk space.
     * @param {EpubJob} job - The job whose workspace should be removed.
     * @returns {Promise<void>}
     */
    async teardownWorkspace(job) {
        if (!job.workspacePath) return;

        job.log('INFO', `Tearing down workspace: ${job.workspacePath}`);
        try {
            await fs.rm(job.workspacePath, { recursive: true, force: true });
            job.log('INFO', 'Workspace teardown complete.');
        } catch (error) {
            // We don't fail the job if teardown fails, but we log it.
            job.log('WARN', `Failed to teardown workspace: ${error.message}`);
            console.error(`[EpubBatch] Leaked workspace for job ${job.id}: ${job.workspacePath}`);
        } finally {
            job.workspacePath = null;
        }
    }

    /**
     * Extracts the built artifacts from the workspace to the final output directory.
     * @param {EpubJob} job - The completed job.
     * @returns {Promise<void>}
     */
    async extractArtifacts(job) {
        job.state = JobState.FINALIZING;
        job.log('INFO', 'Extracting build artifacts to output directory...');

        try {
            await fs.mkdir(job.outputDir, { recursive: true });

            const sourceEpubPath = path.join(job.workspacePath, this.config.outputEpubPath);
            const targetEpubPath = path.join(job.outputDir, `${job.bookId}.epub`);

            const sourcePdfPath = path.join(job.workspacePath, this.config.outputPdfPath);
            const targetPdfPath = path.join(job.outputDir, `${job.bookId}_print.pdf`);

            // Check and copy EPUB
            try {
                await fs.access(sourceEpubPath);
                await fs.copyFile(sourceEpubPath, targetEpubPath);
                job.log('INFO', `Successfully extracted EPUB to ${targetEpubPath}`);
            } catch (err) {
                job.log('WARN', `EPUB artifact not found at ${sourceEpubPath}`);
                throw new JobError('EPUB build artifact missing.', job.id, 'MISSING_ARTIFACT');
            }

            // Check and copy PDF (Optional, don't fail if missing unless strictly required)
            try {
                await fs.access(sourcePdfPath);
                await fs.copyFile(sourcePdfPath, targetPdfPath);
                job.log('INFO', `Successfully extracted PDF to ${targetPdfPath}`);
            } catch (err) {
                job.log('WARN', `PDF artifact not found at ${sourcePdfPath}. Skipping PDF extraction.`);
            }

        } catch (error) {
            job.log('ERROR', `Artifact extraction failed: ${error.message}`);
            throw new JobError(`Artifact extraction failed: ${error.message}`, job.id, 'EXTRACTION_FAILED');
        }
    }
}

// --- Execution Engine ---

/**
 * Handles the actual execution of the build commands.
 */
class JobExecutor {
    /**
     * @param {Object} config - Configuration object.
     */
    constructor(config) {
        this.config = config;
    }

    /**
     * Executes the build process for a given job in its isolated workspace.
     * @param {EpubJob} job - The job to execute.
     * @returns {Promise<void>}
     */
    async execute(job) {
        job.state = JobState.PROCESSING;
        job.log('INFO', `Starting build execution. Command: ${this.config.buildCommand} ${this.config.buildArgs.join(' ')}`);

        return new Promise((resolve, reject) => {
            let isTimeout = false;
            
            // Setup timeout
            const timeoutTimer = setTimeout(() => {
                isTimeout = true;
                child.kill('SIGKILL');
                reject(new JobError(`Job exceeded maximum execution time of ${this.config.jobTimeoutMs}ms`, job.id, 'TIMEOUT'));
            }, this.config.jobTimeoutMs);

            // Spawn the build process
            const child = spawn(this.config.buildCommand, this.config.buildArgs, {
                cwd: job.workspacePath,
                env: { ...process.env, ALCHEMIST_JOB_ID: job.id },
                shell: true // Required for some complex makefiles or python venv activations
            });

            // Capture stdout
            child.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    job.log('INFO', `[STDOUT] ${output}`);
                }
            });

            // Capture stderr
            child.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    job.log('WARN', `[STDERR] ${output}`);
                }
            });

            // Handle process completion
            child.on('close', (code) => {
                clearTimeout(timeoutTimer);
                if (isTimeout) return; // Handled by timeout callback

                if (code === 0) {
                    job.log('INFO', 'Build command completed successfully.');
                    resolve();
                } else {
                    job.log('ERROR', `Build command exited with code ${code}`);
                    reject(new JobError(`Build process failed with exit code ${code}`, job.id, 'PROCESS_FAILED'));
                }
            });

            // Handle process spawn errors
            child.on('error', (err) => {
                clearTimeout(timeoutTimer);
                job.log('ERROR', `Failed to spawn build process: ${err.message}`);
                reject(new JobError(`Failed to spawn process: ${err.message}`, job.id, 'SPAWN_ERROR'));
            });
        });
    }
}

// --- Main Batch Processor ---

/**
 * Main orchestrator for batch EPUB processing.
 * Manages the queue, concurrency, retries, and lifecycle events.
 * 
 * @fires EpubBatchProcessor#jobEnqueued
 * @fires EpubBatchProcessor#jobStarted
 * @fires EpubBatchProcessor#jobCompleted
 * @fires EpubBatchProcessor#jobFailed
 * @fires EpubBatchProcessor#jobRetrying
 * @fires EpubBatchProcessor#queueEmpty
 */
class EpubBatchProcessor extends EventEmitter {
    /**
     * @param {Partial<typeof DEFAULT_CONFIG>} [options] - Custom configuration overrides.
     */
    constructor(options = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...options };
        
        this.queue = [];
        this.activeJobs = new Map();
        this.completedJobs = new Map();
        this.failedJobs = new Map();
        
        this.isProcessing = false;
        this.isPaused = false;

        this.isolator = new WorkspaceIsolator(this.config);
        this.executor = new JobExecutor(this.config);
    }

    /**
     * Adds a new job to the queue.
     * @param {Object} jobOptions - Options for the EpubJob.
     * @returns {string} The generated Job ID.
     */
    enqueue(jobOptions) {
        const job = new EpubJob(jobOptions);
        job.state = JobState.QUEUED;
        this.queue.push(job);
        
        this.emit('jobEnqueued', job.toJSON());
        
        // Auto-start processing if not paused and not at capacity
        if (!this.isPaused && !this.isProcessing) {
            this._processQueue();
        }

        return job.id;
    }

    /**
     * Adds multiple jobs to the queue.
     * @param {Array<Object>} jobsOptions - Array of job options.
     * @returns {Array<string>} Array of generated Job IDs.
     */
    enqueueBatch(jobsOptions) {
        if (!Array.isArray(jobsOptions)) {
            throw new TypeError('enqueueBatch expects an array of job options.');
        }
        return jobsOptions.map(opts => this.enqueue(opts));
    }

    /**
     * Pauses the queue. Active jobs will finish, but no new ones will start.
     */
    pause() {
        this.isPaused = true;
        this.emit('paused');
    }

    /**
     * Resumes the queue.
     */
    resume() {
        this.isPaused = false;
        this.emit('resumed');
        this._processQueue();
    }

    /**
     * Retrieves the status of a specific job.
     * @param {string} jobId - The ID of the job.
     * @returns {Object|null} Job details or null if not found.
     */
    getJobStatus(jobId) {
        // Search active
        if (this.activeJobs.has(jobId)) return this.activeJobs.get(jobId).toJSON();
        // Search completed
        if (this.completedJobs.has(jobId)) return this.completedJobs.get(jobId).toJSON();
        // Search failed
        if (this.failedJobs.has(jobId)) return this.failedJobs.get(jobId).toJSON();
        // Search queue
        const queuedJob = this.queue.find(j => j.id === jobId);
        if (queuedJob) return queuedJob.toJSON();

        return null;
    }

    /**
     * Retrieves the full logs for a specific job.
     * @param {string} jobId - The ID of the job.
     * @returns {Array<Object>|null} Array of log entries or null if not found.
     */
    getJobLogs(jobId) {
        const allJobs = [
            ...Array.from(this.activeJobs.values()),
            ...Array.from(this.completedJobs.values()),
            ...Array.from(this.failedJobs.values()),
            ...this.queue
        ];
        const job = allJobs.find(j => j.id === jobId);
        return job ? job.logs : null;
    }

    /**
     * Gets current queue metrics.
     * @returns {Object} Metrics object.
     */
    getMetrics() {
        return {
            queued: this.queue.length,
            active: this.activeJobs.size,
            completed: this.completedJobs.size,
            failed: this.failedJobs.size,
            concurrencyLimit: this.config.concurrency
        };
    }

    /**
     * Internal method to process the queue based on concurrency limits.
     * @private
     */
    async _processQueue() {
        if (this.isPaused) return;

        this.isProcessing = true;

        while (this.queue.length > 0 && this.activeJobs.size < this.config.concurrency) {
            const job = this.queue.shift();
            this.activeJobs.set(job.id, job);
            
            // Fire and forget, but catch unhandled rejections
            this._runJob(job).catch(err => {
                console.error(`[EpubBatch] Critical unhandled error in job ${job.id}:`, err);
            });
        }

        if (this.queue.length === 0 && this.activeJobs.size === 0) {
            this.isProcessing = false;
            this.emit('queueEmpty');
        }
    }

    /**
     * Internal method representing the full lifecycle of a single job.
     * @param {EpubJob} job - The job to run.
     * @private
     */
    async _runJob(job) {
        job.startedAt = job.startedAt || new Date();
        job.attempts += 1;
        
        this.emit('jobStarted', job.toJSON());

        try {
            // 1. Setup Isolated Workspace
            await this.isolator.setupWorkspace(job);

            // 2. Execute Build Process
            await this.executor.execute(job);

            // 3. Extract Artifacts
            await this.isolator.extractArtifacts(job);

            // 4. Mark as Success
            this._handleJobSuccess(job);

        } catch (error) {
            await this._handleJobFailure(job, error);
        } finally {
            // Always attempt to teardown the workspace
            await this.isolator.teardownWorkspace(job);
            
            // Check queue for next items
            this._processQueue();
        }
    }

    /**
     * Handles successful job completion.
     * @param {EpubJob} job - The successful job.
     * @private
     */
    _handleJobSuccess(job) {
        job.state = JobState.COMPLETED;
        job.completedAt = new Date();
        job.log('INFO', 'Job completed successfully.');

        this.activeJobs.delete(job.id);
        this.completedJobs.set(job.id, job);

        this.emit('jobCompleted', job.toJSON());
    }

    /**
     * Handles job failures and manages retries.
     * @param {EpubJob} job - The failed job.
     * @param {Error} error - The error that caused the failure.
     * @private
     */
    async _handleJobFailure(job, error) {
        job.log('ERROR', `Job failed: ${error.message}`);
        job.error = error;

        if (job.attempts < this.config.maxRetries) {
            job.state = JobState.QUEUED;
            job.log('INFO', `Scheduling retry ${job.attempts + 1}/${this.config.maxRetries} in ${this.config.retryDelayMs}ms`);
            
            this.activeJobs.delete(job.id);
            this.emit('jobRetrying', { job: job.toJSON(), error: error.message, attempt: job.attempts });

            // Exponential backoff for retries
            const backoffDelay = this.config.retryDelayMs * Math.pow(2, job.attempts - 1);
            
            setTimeout(() => {
                // Re-insert at the front of the queue to prioritize retries
                this.queue.unshift(job);
                this._processQueue();
            }, backoffDelay);

        } else {
            job.state = JobState.FAILED;
            job.completedAt = new Date();
            job.log('ERROR', 'Maximum retry attempts reached. Job permanently failed.');

            this.activeJobs.delete(job.id);
            this.failedJobs.set(job.id, job);

            this.emit('jobFailed', { job: job.toJSON(), error: error.message });
        }
    }

    /**
     * Forcefully cancels a pending or queued job.
     * Cannot easily cancel a currently processing job due to sub-process detachment complexities,
     * but will mark it to prevent retries or post-processing.
     * @param {string} jobId 
     * @returns {boolean} True if cancelled, false if not found or already completed.
     */
    cancelJob(jobId) {
        // Check queue
        const queueIndex = this.queue.findIndex(j => j.id === jobId);
        if (queueIndex !== -1) {
            const [job] = this.queue.splice(queueIndex, 1);
            job.state = JobState.CANCELLED;
            job.completedAt = new Date();
            this.failedJobs.set(job.id, job);
            this.emit('jobCancelled', job.toJSON());
            return true;
        }

        // Check active (Will only prevent retries/extraction, process might still run in background)
        if (this.activeJobs.has(jobId)) {
            const job = this.activeJobs.get(jobId);
            job.state = JobState.CANCELLED;
            job.log('WARN', 'Job cancelled by user while active. Background process may still be running.');
            // Move to failed immediately
            this.activeJobs.delete(jobId);
            this.failedJobs.set(jobId, job);
            this.emit('jobCancelled', job.toJSON());
            return true;
        }

        return false;
    }

    /**
     * Cleans up all memory stores. Useful for testing or shutting down.
     */
    clearHistory() {
        this.completedJobs.clear();
        this.failedJobs.clear();
    }
}

// Export the module components
module.exports = {
    EpubBatchProcessor,
    JobState,
    JobError,
    DEFAULT_CONFIG
};