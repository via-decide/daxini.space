/**
 * @file core/epub-checkpoint.js
 * @description Enterprise-grade checkpointing and resumable export system for EPUB generation.
 * Ensures crash-safe operations, atomic state transitions, and deterministic recovery
 * from interruptions during the EPUB build pipeline.
 * 
 * Features:
 * - Atomic state persistence (prevents corruption during power loss/crash)
 * - File-based locking mechanism to prevent concurrent mutation of job states
 * - Strict state machine for EPUB generation stages
 * - Stale job detection and garbage collection
 * - Detailed artifact tracking per stage
 * 
 * @module core/epub-checkpoint
 * @author Antigravity Synthesis Orchestrator
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const os = require('os');

// ============================================================================
// CONSTANTS & ENUMS
// ============================================================================

/**
 * Enum for EPUB generation stages.
 * Order is strictly enforced by the state machine.
 * @readonly
 * @enum {string}
 */
const EPUB_STAGES = {
    INIT: 'INIT',
    ASSET_PROCESSING: 'ASSET_PROCESSING',
    XHTML_GENERATION: 'XHTML_GENERATION',
    OPF_CREATION: 'OPF_CREATION',
    PACKAGING: 'PACKAGING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
};

/**
 * Ordered array of execution stages to determine progress and next steps.
 * @type {string[]}
 */
const STAGE_ORDER = [
    EPUB_STAGES.INIT,
    EPUB_STAGES.ASSET_PROCESSING,
    EPUB_STAGES.XHTML_GENERATION,
    EPUB_STAGES.OPF_CREATION,
    EPUB_STAGES.PACKAGING,
    EPUB_STAGES.COMPLETED
];

/**
 * Default configuration for the checkpoint manager.
 */
const DEFAULT_CONFIG = {
    checkpointDir: path.join(process.cwd(), '.checkpoints', 'epub'),
    lockTimeoutMs: 1000 * 60 * 15, // 15 minutes before a lock is considered stale
    keepCompletedJobsMs: 1000 * 60 * 60 * 24 * 7, // 7 days
    maxRetries: 3
};

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

class CheckpointError extends Error {
    constructor(message, code, jobId = null) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.jobId = jobId;
        Error.captureStackTrace(this, this.constructor);
    }
}

class JobLockedError extends CheckpointError {
    constructor(jobId, lockInfo) {
        super(`Job ${jobId} is currently locked by process ${lockInfo.pid}`, 'ERR_JOB_LOCKED', jobId);
        this.lockInfo = lockInfo;
    }
}

class InvalidStageTransitionError extends CheckpointError {
    constructor(jobId, currentStage, targetStage) {
        super(`Invalid transition for job ${jobId}: ${currentStage} -> ${targetStage}`, 'ERR_INVALID_TRANSITION', jobId);
        this.currentStage = currentStage;
        this.targetStage = targetStage;
    }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} StageArtifacts
 * @property {string[]} files - List of file paths generated in this stage
 * @property {Object} metadata - Stage-specific metadata (e.g., word count, image count)
 * @property {number} durationMs - How long the stage took to complete
 */

/**
 * @typedef {Object} JobState
 * @property {string} jobId - Unique identifier for the EPUB generation job
 * @property {string} status - Current stage or status (from EPUB_STAGES)
 * @property {Object.<string, StageArtifacts>} completedStages - Artifacts mapped by stage name
 * @property {number} createdAt - Epoch timestamp of job creation
 * @property {number} updatedAt - Epoch timestamp of last state change
 * @property {Object} configuration - Initial configuration passed to the job
 * @property {string|null} error - Error message if status is FAILED
 * @property {number} retryCount - Number of times the job has been retried
 */

/**
 * @typedef {Object} ResumePlan
 * @property {string} jobId - The job ID
 * @property {string} nextStage - The stage that needs to be executed next
 * @property {Object.<string, StageArtifacts>} existingArtifacts - Artifacts from previously completed stages
 * @property {Object} configuration - The original job configuration
 * @property {boolean} canResume - Whether the job can be resumed
 * @property {string} [reason] - Reason if canResume is false
 */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates a cryptographically secure random ID for jobs.
 * @returns {string}
 */
const generateJobId = () => crypto.randomBytes(16).toString('hex');

/**
 * Performs an atomic write to a file to prevent corruption during power loss or crashes.
 * Writes to a temporary file first, then renames it to the target file path.
 * 
 * @param {string} targetPath - The final path where the file should be saved
 * @param {string|Buffer} data - The data to write
 * @returns {Promise<void>}
 */
async function atomicWrite(targetPath, data) {
    const tempPath = `${targetPath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
        await fs.writeFile(tempPath, data, { encoding: 'utf8', mode: 0o644 });
        await fs.rename(tempPath, targetPath);
    } catch (error) {
        // Attempt to clean up temp file if something went wrong
        try {
            await fs.unlink(tempPath);
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
        throw new CheckpointError(`Atomic write failed: ${error.message}`, 'ERR_ATOMIC_WRITE_FAILED');
    }
}

// ============================================================================
// MAIN CHECKPOINT MANAGER CLASS
// ============================================================================

/**
 * EpubCheckpointManager
 * 
 * Manages the persistence, locking, and state transitions of EPUB generation jobs.
 * Emits events on state changes, allowing decoupling of the orchestrator from the worker.
 * 
 * @fires EpubCheckpointManager#jobCreated
 * @fires EpubCheckpointManager#stageCompleted
 * @fires EpubCheckpointManager#jobCompleted
 * @fires EpubCheckpointManager#jobFailed
 */
class EpubCheckpointManager extends EventEmitter {
    /**
     * @param {Partial<typeof DEFAULT_CONFIG>} config - Configuration overrides
     */
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initialized = false;
    }

    /**
     * Initializes the checkpoint directory structure.
     * Must be called before any other operations.
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;

        try {
            await fs.mkdir(this.config.checkpointDir, { recursive: true });
            // Create subdirectories for active, completed, and failed jobs to keep things organized
            await fs.mkdir(path.join(this.config.checkpointDir, 'active'), { recursive: true });
            await fs.mkdir(path.join(this.config.checkpointDir, 'archive'), { recursive: true });
            this.initialized = true;
        } catch (error) {
            throw new CheckpointError(`Failed to initialize checkpoint directory: ${error.message}`, 'ERR_INIT_FAILED');
        }
    }

    /**
     * Helper to ensure initialization before performing operations.
     * @private
     */
    _ensureInitialized() {
        if (!this.initialized) {
            throw new CheckpointError('EpubCheckpointManager is not initialized. Call initialize() first.', 'ERR_NOT_INITIALIZED');
        }
    }

    /**
     * Generates the file path for a specific job's state file.
     * @param {string} jobId 
     * @param {boolean} [archived=false] 
     * @returns {string}
     * @private
     */
    _getJobFilePath(jobId, archived = false) {
        const subDir = archived ? 'archive' : 'active';
        return path.join(this.config.checkpointDir, subDir, `${jobId}.json`);
    }

    /**
     * Generates the file path for a specific job's lock file.
     * @param {string} jobId 
     * @returns {string}
     * @private
     */
    _getLockFilePath(jobId) {
        return path.join(this.config.checkpointDir, 'active', `${jobId}.lock`);
    }

    /**
     * Attempts to acquire a lock for a job to prevent concurrent modifications.
     * Handles stale locks automatically based on config.lockTimeoutMs.
     * 
     * @param {string} jobId 
     * @returns {Promise<boolean>} True if lock was acquired successfully
     * @throws {JobLockedError} If the job is currently locked by another active process
     */
    async acquireLock(jobId) {
        this._ensureInitialized();
        const lockPath = this._getLockFilePath(jobId);
        const lockData = JSON.stringify({
            pid: process.pid,
            hostname: os.hostname(),
            timestamp: Date.now()
        });

        try {
            // wx flag ensures we only write if the file does NOT exist
            await fs.writeFile(lockPath, lockData, { flag: 'wx', encoding: 'utf8' });
            return true;
        } catch (error) {
            if (error.code === 'EEXIST') {
                // Lock exists, check if it's stale
                try {
                    const existingLockRaw = await fs.readFile(lockPath, 'utf8');
                    const existingLock = JSON.parse(existingLockRaw);
                    
                    if (Date.now() - existingLock.timestamp > this.config.lockTimeoutMs) {
                        // Lock is stale. Break it and acquire.
                        await fs.unlink(lockPath);
                        return this.acquireLock(jobId); // Retry recursively
                    } else {
                        throw new JobLockedError(jobId, existingLock);
                    }
                } catch (readError) {
                    if (readError instanceof JobLockedError) throw readError;
                    // If we can't read the lock file or parse it, assume it's corrupted and break it
                    await fs.unlink(lockPath).catch(() => {});
                    return this.acquireLock(jobId);
                }
            }
            throw new CheckpointError(`Failed to acquire lock: ${error.message}`, 'ERR_LOCK_FAILED', jobId);
        }
    }

    /**
     * Releases the lock for a given job.
     * @param {string} jobId 
     * @returns {Promise<void>}
     */
    async releaseLock(jobId) {
        const lockPath = this._getLockFilePath(jobId);
        try {
            await fs.unlink(lockPath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn(`[EpubCheckpointManager] Failed to release lock for ${jobId}: ${error.message}`);
            }
        }
    }

    /**
     * Reads and parses a job state from disk.
     * @param {string} jobId 
     * @param {boolean} [archived=false]
     * @returns {Promise<JobState>}
     * @private
     */
    async _readJobState(jobId, archived = false) {
        const filePath = this._getJobFilePath(jobId, archived);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                if (!archived) {
                    // Fallback: check archive if not found in active
                    return this._readJobState(jobId, true).catch(() => {
                        throw new CheckpointError(`Job ${jobId} not found`, 'ERR_JOB_NOT_FOUND', jobId);
                    });
                }
                throw new CheckpointError(`Job ${jobId} not found`, 'ERR_JOB_NOT_FOUND', jobId);
            }
            throw new CheckpointError(`Corrupted job state for ${jobId}: ${error.message}`, 'ERR_STATE_CORRUPTED', jobId);
        }
    }

    /**
     * Writes the job state to disk atomically.
     * @param {JobState} state 
     * @returns {Promise<void>}
     * @private
     */
    async _writeJobState(state) {
        state.updatedAt = Date.now();
        const isArchived = state.status === EPUB_STAGES.COMPLETED || state.status === EPUB_STAGES.FAILED;
        const filePath = this._getJobFilePath(state.jobId, isArchived);
        
        await atomicWrite(filePath, JSON.stringify(state, null, 2));

        // If the state transitioned to an archived state, remove it from active directory
        if (isArchived) {
            const activeFilePath = this._getJobFilePath(state.jobId, false);
            try {
                await fs.unlink(activeFilePath);
            } catch (err) {
                if (err.code !== 'ENOENT') console.warn(`Failed to cleanup active state file for archived job ${state.jobId}`);
            }
        }
    }

    /**
     * Creates a new EPUB generation job and initializes its checkpoint.
     * 
     * @param {Object} configuration - Job specific configuration (e.g., input files, metadata)
     * @param {string} [customJobId] - Optional custom ID, otherwise generated
     * @returns {Promise<JobState>} The initialized job state
     */
    async createJob(configuration, customJobId = null) {
        this._ensureInitialized();
        const jobId = customJobId || generateJobId();
        
        const initialState = {
            jobId,
            status: EPUB_STAGES.INIT,
            completedStages: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
            configuration,
            error: null,
            retryCount: 0
        };

        await this.acquireLock(jobId);
        try {
            await this._writeJobState(initialState);
            this.emit('jobCreated', initialState);
            return initialState;
        } finally {
            await this.releaseLock(jobId);
        }
    }

    /**
     * Validates if a transition from currentStage to targetStage is allowed.
     * @param {string} currentStage 
     * @param {string} targetStage 
     * @returns {boolean}
     * @private
     */
    _isValidTransition(currentStage, targetStage) {
        // Allow transition to FAILED from anywhere
        if (targetStage === EPUB_STAGES.FAILED) return true;
        
        // Allow retrying the current stage
        if (currentStage === targetStage) return true;

        const currentIndex = STAGE_ORDER.indexOf(currentStage);
        const targetIndex = STAGE_ORDER.indexOf(targetStage);

        // Target stage must exist in STAGE_ORDER
        if (targetIndex === -1) return false;

        // Strict linear progression or skipping forward (if a stage is intentionally skipped)
        // We ensure target is strictly after current, or we are recovering from a failed state
        return targetIndex > currentIndex || currentStage === EPUB_STAGES.FAILED;
    }

    /**
     * Marks a specific stage as completed and updates the checkpoint.
     * 
     * @param {string} jobId - The ID of the job
     * @param {string} stageName - The name of the stage (from EPUB_STAGES)
     * @param {StageArtifacts} artifacts - Artifacts generated during this stage
     * @returns {Promise<JobState>} The updated job state
     * @throws {InvalidStageTransitionError} If the transition is invalid
     */
    async advanceStage(jobId, stageName, artifacts) {
        this._ensureInitialized();
        await this.acquireLock(jobId);

        try {
            const state = await this._readJobState(jobId);

            if (!this._isValidTransition(state.status, stageName)) {
                throw new InvalidStageTransitionError(jobId, state.status, stageName);
            }

            // Record the completion of the current stage
            state.completedStages[stageName] = {
                ...artifacts,
                timestamp: Date.now()
            };
            
            state.status = stageName;
            state.error = null; // Clear any previous errors if we are advancing successfully

            await this._writeJobState(state);
            this.emit('stageCompleted', { jobId, stage: stageName, artifacts });

            return state;
        } finally {
            await this.releaseLock(jobId);
        }
    }

    /**
     * Marks the entire job as successfully completed.
     * 
     * @param {string} jobId 
     * @param {string} finalEpubPath - Path to the final generated EPUB file
     * @returns {Promise<JobState>}
     */
    async markJobCompleted(jobId, finalEpubPath) {
        this._ensureInitialized();
        await this.acquireLock(jobId);

        try {
            const state = await this._readJobState(jobId);
            
            state.completedStages[EPUB_STAGES.COMPLETED] = {
                files: [finalEpubPath],
                metadata: { finalSize: await this._getFileSize(finalEpubPath) },
                timestamp: Date.now()
            };
            
            state.status = EPUB_STAGES.COMPLETED;
            
            await this._writeJobState(state);
            this.emit('jobCompleted', state);
            
            return state;
        } finally {
            await this.releaseLock(jobId);
        }
    }

    /**
     * Records a failure in the job processing, allowing for later resumption.
     * 
     * @param {string} jobId 
     * @param {Error|string} error - The error that caused the failure
     * @returns {Promise<JobState>}
     */
    async markJobFailed(jobId, error) {
        this._ensureInitialized();
        // We try to acquire lock, but if we can't, we might force it since we are failing
        try {
            await this.acquireLock(jobId);
        } catch (lockErr) {
            console.warn(`[EpubCheckpointManager] Could not acquire lock to mark failure for ${jobId}. Forcing update.`);
        }

        try {
            const state = await this._readJobState(jobId);
            
            state.status = EPUB_STAGES.FAILED;
            state.error = error instanceof Error ? 
                { message: error.message, stack: error.stack, code: error.code } : 
                { message: String(error) };
            
            await this._writeJobState(state);
            this.emit('jobFailed', state);
            
            return state;
        } finally {
            await this.releaseLock(jobId);
        }
    }

    /**
     * Analyzes a job's state and generates a ResumePlan.
     * This determines exactly where the worker should pick up execution.
     * 
     * @param {string} jobId 
     * @returns {Promise<ResumePlan>}
     */
    async getResumePlan(jobId) {
        this._ensureInitialized();
        const state = await this._readJobState(jobId);

        const plan = {
            jobId: state.jobId,
            configuration: state.configuration,
            existingArtifacts: state.completedStages,
            canResume: true,
            nextStage: null
        };

        if (state.status === EPUB_STAGES.COMPLETED) {
            plan.canResume = false;
            plan.reason = 'Job is already completed.';
            return plan;
        }

        if (state.retryCount >= this.config.maxRetries) {
            plan.canResume = false;
            plan.reason = `Max retries (${this.config.maxRetries}) exceeded.`;
            return plan;
        }

        // Determine the next stage
        // Find the highest stage index that has been completed
        let highestCompletedIndex = -1;
        for (const stage of Object.keys(state.completedStages)) {
            const idx = STAGE_ORDER.indexOf(stage);
            if (idx > highestCompletedIndex) {
                highestCompletedIndex = idx;
            }
        }

        // Next stage is the one immediately following the highest completed stage
        if (highestCompletedIndex === -1) {
            plan.nextStage = EPUB_STAGES.ASSET_PROCESSING; // Start from beginning
        } else if (highestCompletedIndex < STAGE_ORDER.length - 1) {
            plan.nextStage = STAGE_ORDER[highestCompletedIndex + 1];
        } else {
            // Edge case: all stages completed but status not updated
            plan.nextStage = EPUB_STAGES.COMPLETED;
        }

        // If the job failed previously, increment retry count
        if (state.status === EPUB_STAGES.FAILED) {
            await this.acquireLock(jobId);
            try {
                state.retryCount += 1;
                await this._writeJobState(state);
            } finally {
                await this.releaseLock(jobId);
            }
        }

        return plan;
    }

    /**
     * Retrieves the current state of a job without locking.
     * Useful for status polling.
     * 
     * @param {string} jobId 
     * @returns {Promise<JobState>}
     */
    async getJobStatus(jobId) {
        this._ensureInitialized();
        return this._readJobState(jobId);
    }

    /**
     * Utility to get file size for metadata.
     * @param {string} filePath 
     * @returns {Promise<number>} Size in bytes
     * @private
     */
    async _getFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Cleans up stale locks and archives old completed jobs.
     * Intended to be run periodically via cron or interval.
     * @returns {Promise<Object>} Statistics of the cleanup operation
     */
    async garbageCollect() {
        this._ensureInitialized();
        const stats = {
            staleLocksRemoved: 0,
            oldJobsArchived: 0,
            errors: 0
        };

        try {
            const activeDir = path.join(this.config.checkpointDir, 'active');
            const files = await fs.readdir(activeDir);

            const now = Date.now();

            for (const file of files) {
                const fullPath = path.join(activeDir, file);
                
                try {
                    if (file.endsWith('.lock')) {
                        const lockDataRaw = await fs.readFile(fullPath, 'utf8');
                        const lockData = JSON.parse(lockDataRaw);
                        if (now - lockData.timestamp > this.config.lockTimeoutMs) {
                            await fs.unlink(fullPath);
                            stats.staleLocksRemoved++;
                        }
                    } else if (file.endsWith('.json')) {
                        const stateRaw = await fs.readFile(fullPath, 'utf8');
                        const state = JSON.parse(stateRaw);
                        
                        // If job has been inactive for a very long time, move to archive
                        if (now - state.updatedAt > this.config.keepCompletedJobsMs) {
                            const archivePath = path.join(this.config.checkpointDir, 'archive', file);
                            await fs.rename(fullPath, archivePath);
                            stats.oldJobsArchived++;
                        }
                    }
                } catch (fileErr) {
                    stats.errors++;
                    console.warn(`[EpubCheckpointManager] GC Error processing file ${file}: ${fileErr.message}`);
                }
            }
        } catch (error) {
            console.error(`[EpubCheckpointManager] Garbage collection failed: ${error.message}`);
        }

        return stats;
    }
}

module.exports = {
    EpubCheckpointManager,
    EPUB_STAGES,
    CheckpointError,
    JobLockedError,
    InvalidStageTransitionError
};