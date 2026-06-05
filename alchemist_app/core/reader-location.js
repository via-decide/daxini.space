/**
 * @file core/reader-location.js
 * @description Core system for tracking, persisting, and restoring reading locations.
 * Provides Kindle-like progress tracking, location resumption, and progress calculation
 * based on chapters, pages, and content offsets.
 * 
 * @module ReaderLocationSystem
 */

'use strict';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
    STORAGE_PREFIX: 'alchemist_reader_loc_',
    SAVE_DEBOUNCE_MS: 500,
    EVENTS: {
        LOCATION_CHANGED: 'reader:location-changed',
        PROGRESS_UPDATED: 'reader:progress-updated',
        RESUMED: 'reader:resumed',
        ERROR: 'reader:error'
    }
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Debounces a function execution.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Lightweight Event Emitter for internal module communication and UI syncing.
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return () => this.off(event, listener);
    }

    off(event, listenerToRemove) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(
            listener => listener !== listenerToRemove
        );
    }

    emit(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }
}

// ============================================================================
// MODELS
// ============================================================================

/**
 * Represents a specific reading location within a book.
 */
class ReaderLocation {
    /**
     * @param {Object} params - Location parameters.
     * @param {number} params.chapterIndex - The 0-based index of the current chapter.
     * @param {number} params.pageIndex - The 0-based index of the page within the chapter (or absolute, depending on renderer).
     * @param {string|number|null} [params.offsetFallback=null] - Optional fallback (e.g., DOM element ID, character offset, XPath, or CFI) for reflowable layouts.
     * @param {number} [params.timestamp] - Epoch timestamp of when this location was recorded.
     */
    constructor({ chapterIndex = 0, pageIndex = 0, offsetFallback = null, timestamp = Date.now() }) {
        this.chapterIndex = Math.max(0, parseInt(chapterIndex, 10) || 0);
        this.pageIndex = Math.max(0, parseInt(pageIndex, 10) || 0);
        this.offsetFallback = offsetFallback;
        this.timestamp = timestamp;
    }

    /**
     * Validates if the location object has safe, expected values.
     * @returns {boolean}
     */
    isValid() {
        return (
            typeof this.chapterIndex === 'number' && !isNaN(this.chapterIndex) && this.chapterIndex >= 0 &&
            typeof this.pageIndex === 'number' && !isNaN(this.pageIndex) && this.pageIndex >= 0
        );
    }

    /**
     * Serializes the location for storage.
     * @returns {string} JSON string
     */
    serialize() {
        return JSON.stringify({
            c: this.chapterIndex,
            p: this.pageIndex,
            o: this.offsetFallback,
            t: this.timestamp
        });
    }

    /**
     * Deserializes a location from storage.
     * @param {string} data - JSON string
     * @returns {ReaderLocation|null}
     */
    static deserialize(data) {
        try {
            const parsed = JSON.parse(data);
            if (!parsed) return null;
            return new ReaderLocation({
                chapterIndex: parsed.c,
                pageIndex: parsed.p,
                offsetFallback: parsed.o,
                timestamp: parsed.t
            });
        } catch (e) {
            console.error('Failed to deserialize ReaderLocation:', e);
            return null;
        }
    }

    /**
     * Compares this location to another to determine if they represent the same position.
     * @param {ReaderLocation} other 
     * @returns {boolean}
     */
    equals(other) {
        if (!other) return false;
        return this.chapterIndex === other.chapterIndex &&
               this.pageIndex === other.pageIndex &&
               this.offsetFallback === other.offsetFallback;
    }
}

/**
 * Represents the structural metadata of the book required for progress calculation.
 */
class BookMetadata {
    /**
     * @param {Object} params
     * @param {string} params.bookId - Unique identifier for the book.
     * @param {number} params.totalChapters - Total number of chapters in the book.
     * @param {number} params.totalPages - Total number of pages across the entire book.
     * @param {number[]} [params.chapterPageMap=[]] - Array where index is chapterIndex and value is the number of pages in that chapter.
     */
    constructor({ bookId, totalChapters = 1, totalPages = 1, chapterPageMap = [] }) {
        if (!bookId) throw new Error("BookMetadata requires a valid bookId");
        
        this.bookId = bookId;
        this.totalChapters = Math.max(1, totalChapters);
        this.totalPages = Math.max(1, totalPages);
        this.chapterPageMap = Array.isArray(chapterPageMap) ? chapterPageMap : [];
    }

    /**
     * Checks if the metadata has a reliable map of pages per chapter.
     * @returns {boolean}
     */
    hasPrecisePageMapping() {
        return this.chapterPageMap.length === this.totalChapters && 
               this.chapterPageMap.reduce((a, b) => a + b, 0) === this.totalPages;
    }
}

// ============================================================================
// CORE SYSTEMS
// ============================================================================

/**
 * Handles the mathematical computation of reading progress.
 */
class ProgressCalculator {
    /**
     * Calculates the reading progress percentage.
     * @param {ReaderLocation} location - The current reading location.
     * @param {BookMetadata} metadata - The structural metadata of the book.
     * @returns {number} Float representing percentage (0.00 to 100.00)
     */
    static calculatePercentage(location, metadata) {
        if (!location || !metadata) return 0.0;

        // Ensure we don't exceed bounds
        const safeChapterIndex = Math.min(location.chapterIndex, metadata.totalChapters - 1);
        
        let absoluteCurrentPage = 0;

        if (metadata.hasPrecisePageMapping()) {
            // Precise Calculation: Sum pages of all prior chapters + current page index
            let previousPages = 0;
            for (let i = 0; i < safeChapterIndex; i++) {
                previousPages += metadata.chapterPageMap[i];
            }
            
            // Ensure page index doesn't exceed the chapter's actual page count
            const safePageIndex = Math.min(location.pageIndex, metadata.chapterPageMap[safeChapterIndex] - 1);
            absoluteCurrentPage = previousPages + safePageIndex + 1; // +1 because pageIndex is 0-based
            
        } else {
            // Approximation Fallback: Assume pages are evenly distributed across chapters
            const avgPagesPerChapter = metadata.totalPages / metadata.totalChapters;
            const previousPagesApprox = safeChapterIndex * avgPagesPerChapter;
            
            absoluteCurrentPage = previousPagesApprox + location.pageIndex + 1;
        }

        // Clamp values to ensure percentage is strictly between 0 and 100
        absoluteCurrentPage = Math.max(1, Math.min(absoluteCurrentPage, metadata.totalPages));
        
        const percentage = (absoluteCurrentPage / metadata.totalPages) * 100;
        
        // Return rounded to 2 decimal places
        return Math.round(percentage * 100) / 100;
    }

    /**
     * Calculates the progress within the current chapter.
     * @param {ReaderLocation} location 
     * @param {BookMetadata} metadata 
     * @returns {number} Percentage within the chapter (0 to 100)
     */
    static calculateChapterProgress(location, metadata) {
        if (metadata.hasPrecisePageMapping()) {
            const chapterTotalPages = metadata.chapterPageMap[location.chapterIndex];
            if (!chapterTotalPages) return 0;
            return Math.min(100, ((location.pageIndex + 1) / chapterTotalPages) * 100);
        }
        
        // If no precise mapping, use an arbitrary fallback or offset if available
        if (location.offsetFallback && typeof location.offsetFallback === 'number') {
            // Assuming offsetFallback is a percentage 0-1 if it's a float
            if (location.offsetFallback <= 1.0) {
                return location.offsetFallback * 100;
            }
        }
        
        return 0; // Cannot accurately determine without map or valid offset
    }
}

/**
 * Storage adapter wrapper to safely handle persistence environments (e.g., localStorage, sessionStorage)
 * Falls back to in-memory storage if APIs are unavailable (e.g., incognito mode, non-browser env).
 */
class StorageAdapter {
    constructor() {
        this.memoryStore = new Map();
        this.isStorageAvailable = this._checkStorageAvailability();
    }

    _checkStorageAvailability() {
        try {
            const testKey = '__storage_test__';
            window.localStorage.setItem(testKey, testKey);
            window.localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    setItem(key, value) {
        if (this.isStorageAvailable) {
            try {
                window.localStorage.setItem(key, value);
            } catch (e) {
                console.warn('LocalStorage quota exceeded or unavailable. Falling back to memory.', e);
                this.memoryStore.set(key, value);
            }
        } else {
            this.memoryStore.set(key, value);
        }
    }

    getItem(key) {
        if (this.isStorageAvailable) {
            try {
                const val = window.localStorage.getItem(key);
                if (val !== null) return val;
            } catch (e) {
                console.warn('Failed to read from LocalStorage.', e);
            }
        }
        return this.memoryStore.get(key) || null;
    }

    removeItem(key) {
        if (this.isStorageAvailable) {
            try {
                window.localStorage.removeItem(key);
            } catch (e) {
                // Ignore
            }
        }
        this.memoryStore.delete(key);
    }
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * LocationManager
 * The primary interface for the reader application to interact with reading locations.
 * Handles initialization, tracking, saving, resuming, and progress broadcasting.
 */
export class LocationManager {
    /**
     * @param {Object} config
     * @param {BookMetadata} config.metadata - Metadata of the book being read.
     * @param {Function} [config.onProgress] - Optional callback for progress updates.
     */
    constructor({ metadata, onProgress = null }) {
        if (!metadata || !(metadata instanceof BookMetadata)) {
            throw new Error('LocationManager requires a valid BookMetadata instance.');
        }

        this.metadata = metadata;
        this.storage = new StorageAdapter();
        this.events = new EventEmitter();
        this.currentLocation = null;
        this.currentProgress = 0.0;
        
        this.storageKey = `${CONFIG.STORAGE_PREFIX}${this.metadata.bookId}`;

        if (onProgress) {
            this.events.on(CONFIG.EVENTS.PROGRESS_UPDATED, onProgress);
        }

        // Bind and debounce the save mechanism to prevent disk thrashing
        this._debouncedSave = debounce(this._executeSave.bind(this), CONFIG.SAVE_DEBOUNCE_MS);
    }

    /**
     * Initializes the manager and attempts to resume the previous reading location.
     * @returns {ReaderLocation|null} The resumed location, or null if starting fresh.
     */
    init() {
        const resumedLoc = this.resume();
        if (resumedLoc) {
            this.updateLocation(resumedLoc.chapterIndex, resumedLoc.pageIndex, resumedLoc.offsetFallback, true);
            this.events.emit(CONFIG.EVENTS.RESUMED, resumedLoc);
            return resumedLoc;
        }
        
        // Start fresh at 0,0
        this.updateLocation(0, 0, null, true);
        return this.currentLocation;
    }

    /**
     * Updates the current reading location. Should be called by the UI/Renderer on page turn or scroll.
     * 
     * @param {number} chapterIndex 
     * @param {number} pageIndex 
     * @param {string|number|null} [offsetFallback=null] 
     * @param {boolean} [forceSave=false] - If true, bypasses debounce and saves immediately.
     */
    updateLocation(chapterIndex, pageIndex, offsetFallback = null, forceSave = false) {
        const newLocation = new ReaderLocation({
            chapterIndex,
            pageIndex,
            offsetFallback,
            timestamp: Date.now()
        });

        if (!newLocation.isValid()) {
            this.events.emit(CONFIG.EVENTS.ERROR, new Error('Invalid location parameters provided.'));
            return;
        }

        // Don't process if the location hasn't actually changed
        if (this.currentLocation && this.currentLocation.equals(newLocation)) {
            return;
        }

        this.currentLocation = newLocation;
        
        // Calculate new progress
        this.currentProgress = ProgressCalculator.calculatePercentage(this.currentLocation, this.metadata);
        
        // Broadcast updates
        this.events.emit(CONFIG.EVENTS.LOCATION_CHANGED, this.currentLocation);
        this.events.emit(CONFIG.EVENTS.PROGRESS_UPDATED, {
            location: this.currentLocation,
            percentage: this.currentProgress,
            chapterProgress: ProgressCalculator.calculateChapterProgress(this.currentLocation, this.metadata)
        });

        // Persist
        if (forceSave) {
            this._executeSave();
        } else {
            this._debouncedSave();
        }
    }

    /**
     * Internal method to execute the storage save.
     * @private
     */
    _executeSave() {
        if (!this.currentLocation) return;
        
        try {
            const serialized = this.currentLocation.serialize();
            this.storage.setItem(this.storageKey, serialized);
        } catch (error) {
            this.events.emit(CONFIG.EVENTS.ERROR, new Error(`Failed to save location: ${error.message}`));
        }
    }

    /**
     * Retrieves the last saved location from storage.
     * @returns {ReaderLocation|null}
     */
    resume() {
        try {
            const data = this.storage.getItem(this.storageKey);
            if (data) {
                const loc = ReaderLocation.deserialize(data);
                if (loc && loc.isValid()) {
                    return loc;
                }
            }
        } catch (error) {
            this.events.emit(CONFIG.EVENTS.ERROR, new Error(`Failed to resume location: ${error.message}`));
        }
        return null;
    }

    /**
     * Clears the saved reading progress for this book.
     */
    clearProgress() {
        this.storage.removeItem(this.storageKey);
        this.currentLocation = new ReaderLocation({ chapterIndex: 0, pageIndex: 0 });
        this.currentProgress = 0.0;
        this.events.emit(CONFIG.EVENTS.LOCATION_CHANGED, this.currentLocation);
        this.events.emit(CONFIG.EVENTS.PROGRESS_UPDATED, {
            location: this.currentLocation,
            percentage: 0.0,
            chapterProgress: 0.0
        });
    }

    /**
     * Gets current progress metrics.
     * @returns {Object}
     */
    getProgressMetrics() {
        return {
            percentage: this.currentProgress,
            chapterIndex: this.currentLocation ? this.currentLocation.chapterIndex : 0,
            pageIndex: this.currentLocation ? this.currentLocation.pageIndex : 0,
            isFinished: this.currentProgress >= 99.9
        };
    }

    /**
     * Retrieves the current reading location details.
     * @returns {Object}
     */
    getCurrentLocation() {
        if (!this.currentLocation) {
            return { chapterIndex: 0, pageIndex: 0, location: 'Ch. 1, Pg. 1' };
        }
        return {
            chapterIndex: this.currentLocation.chapterIndex,
            pageIndex: this.currentLocation.pageIndex,
            location: `Ch. ${this.currentLocation.chapterIndex + 1}, Pg. ${this.currentLocation.pageIndex + 1}`
        };
    }

    /**
     * Validates if a specific chapter and page index exist within the book.
     * @param {number} chapterIndex 
     * @param {number} pageIndex 
     * @returns {boolean}
     */
    validateLocation(chapterIndex, pageIndex) {
        if (chapterIndex < 0 || chapterIndex >= this.metadata.totalChapters) {
            return false;
        }
        if (this.metadata.hasPrecisePageMapping()) {
            const chapterPages = this.metadata.chapterPageMap[chapterIndex];
            return pageIndex >= 0 && pageIndex < chapterPages;
        }
        // Fallback validation if no precise mapping
        return pageIndex >= 0;
    }

    /**
     * Heuristic for recalculating location after a reflow (zoom/resize).
     * @param {Object} oldLocation - { chapterIndex, pageIndex }
     * @returns {Object} Updated location
     */
    getLocationAfterReflow(oldLocation) {
        // Basic implementation: maintain chapter, clamp page to new chapter boundaries
        const chapterIndex = oldLocation.chapterIndex;
        let pageIndex = oldLocation.pageIndex;

        if (this.metadata.hasPrecisePageMapping()) {
            const maxPage = this.metadata.chapterPageMap[chapterIndex] - 1;
            pageIndex = Math.min(pageIndex, Math.max(0, maxPage));
        }

        return { chapterIndex, pageIndex };
    }

    /**
     * Subscribe to location or progress events.
     * @param {string} eventName - 'reader:location-changed', 'reader:progress-updated', etc.
     * @param {Function} callback 
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventName, callback) {
        return this.events.on(eventName, callback);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    ReaderLocation,
    BookMetadata,
    ProgressCalculator
};