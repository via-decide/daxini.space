/**
 * @fileoverview Core Bookmark Management System for Alchemist App
 * @module core/bookmarks
 * 
 * This module provides a robust, production-ready bookmarking engine for the reader.
 * It supports creating, updating, deleting, and querying bookmarks across multiple books.
 * Features include:
 * - Pluggable storage adapters (LocalStorage, Memory, IndexedDB ready).
 * - Event-driven architecture for UI synchronization.
 * - EPUB CFI (Canonical Fragment Identifier) support for precise positioning.
 * - Metadata tagging, color-coding, and user annotations.
 * - Import/Export capabilities for backup and syncing.
 * - Schema validation and automatic data migration.
 */

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

/**
 * Base error class for all Bookmark related errors.
 * @extends Error
 */
export class BookmarkError extends Error {
    /**
     * @param {string} message - Error description
     * @param {Object} [details] - Additional error context
     */
    constructor(message, details = {}) {
        super(message);
        this.name = 'BookmarkError';
        this.details = details;
        this.timestamp = new Date().toISOString();
        
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, BookmarkError);
        }
    }
}

/** Thrown when a bookmark fails schema validation. */
export class BookmarkValidationError extends BookmarkError {
    constructor(message, details) {
        super(message, details);
        this.name = 'BookmarkValidationError';
    }
}

/** Thrown when a requested bookmark cannot be found. */
export class BookmarkNotFoundError extends BookmarkError {
    constructor(id) {
        super(`Bookmark with ID '${id}' not found.`, { id });
        this.name = 'BookmarkNotFoundError';
    }
}

/** Thrown when storage operations fail. */
export class BookmarkStorageError extends BookmarkError {
    constructor(message, details) {
        super(message, details);
        this.name = 'BookmarkStorageError';
    }
}

// ============================================================================
// EVENT DISPATCHER
// ============================================================================

/**
 * Lightweight Event Pub/Sub system to decouple the BookmarkManager from the UI.
 */
class BookmarkEventDispatcher {
    constructor() {
        this._listeners = new Map();
    }

    /**
     * Subscribe to an event.
     * @param {string} event - The event name (e.g., 'bookmarkAdded', 'bookmarkRemoved').
     * @param {Function} callback - The function to execute when the event is emitted.
     * @returns {Function} Unsubscribe function.
     */
    on(event, callback) {
        if (typeof callback !== 'function') {
            throw new BookmarkError('Callback must be a function');
        }
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event.
     * @param {string} event - The event name.
     * @param {Function} callback - The callback to remove.
     */
    off(event, callback) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).delete(callback);
            if (this._listeners.get(event).size === 0) {
                this._listeners.delete(event);
            }
        }
    }

    /**
     * Emit an event to all subscribers.
     * @param {string} event - The event name.
     * @param {Object} payload - The data to pass to callbacks.
     */
    emit(event, payload) {
        if (this._listeners.has(event)) {
            const callbacks = this._listeners.get(event);
            for (const callback of callbacks) {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`Error in bookmark event listener for '${event}':`, error);
                }
            }
        }
    }

    /**
     * Clear all listeners for all events.
     */
    clearAllListeners() {
        this._listeners.clear();
    }
}

// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Represents a single Bookmark entity.
 * Enforces schema and provides serialization.
 */
export class Bookmark {
    /**
     * @param {Object} params - Bookmark parameters.
     * @param {string} params.bookId - Unique identifier for the book.
     * @param {string} params.position - EPUB CFI, page number, or DOM selector.
     * @param {string} [params.id] - Unique ID (generated if not provided).
     * @param {string} [params.title] - User-defined title or auto-generated chapter name.
     * @param {string} [params.textSnippet] - Excerpt of text at the bookmark location.
     * @param {string} [params.annotation] - User's personal notes for this bookmark.
     * @param {string} [params.color] - Hex color code or CSS class for UI representation.
     * @param {Array<string>} [params.tags] - Array of categorization tags.
     * @param {number} [params.createdAt] - Epoch timestamp of creation.
     * @param {number} [params.updatedAt] - Epoch timestamp of last update.
     */
    constructor({
        bookId,
        position,
        id = null,
        title = 'Untitled Bookmark',
        textSnippet = '',
        annotation = '',
        color = '#FFD700', // Default gold/yellow
        tags = [],
        createdAt = Date.now(),
        updatedAt = Date.now()
    }) {
        this.id = id || Bookmark.generateId();
        this.bookId = bookId;
        this.position = position;
        this.title = title;
        this.textSnippet = textSnippet;
        this.annotation = annotation;
        this.color = color;
        this.tags = Array.isArray(tags) ? [...new Set(tags)] : [];
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;

        this.validate();
    }

    /**
     * Generates a universally unique identifier (UUID v4 compliant fallback).
     * @returns {string}
     */
    static generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for environments without crypto.randomUUID
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Validates the bookmark instance to ensure data integrity.
     * @throws {BookmarkValidationError}
     */
    validate() {
        if (!this.id || typeof this.id !== 'string') {
            throw new BookmarkValidationError('Invalid or missing Bookmark ID');
        }
        if (!this.bookId || typeof this.bookId !== 'string') {
            throw new BookmarkValidationError('Bookmark requires a valid bookId string');
        }
        if (!this.position || typeof this.position !== 'string') {
            throw new BookmarkValidationError('Bookmark requires a valid position string (e.g., EPUB CFI)');
        }
        if (typeof this.createdAt !== 'number' || typeof this.updatedAt !== 'number') {
            throw new BookmarkValidationError('Timestamps must be numeric epoch values');
        }
    }

    /**
     * Serializes the bookmark to a plain JSON object.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            bookId: this.bookId,
            position: this.position,
            title: this.title,
            textSnippet: this.textSnippet,
            annotation: this.annotation,
            color: this.color,
            tags: this.tags,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Deserializes a raw object into a Bookmark instance.
     * @param {Object} raw - Raw bookmark data
     * @returns {Bookmark}
     */
    static fromJSON(raw) {
        return new Bookmark(raw);
    }
}

// ============================================================================
// STORAGE ADAPTERS
// ============================================================================

/**
 * Interface for Storage Adapters.
 * All custom adapters (e.g., IndexedDB, Cloud, LocalStorage) must implement these methods.
 */
class StorageAdapter {
    async loadAll() { throw new Error('Not implemented'); }
    async saveAll(bookmarks) { throw new Error('Not implemented'); }
    async clear() { throw new Error('Not implemented'); }
}

/**
 * In-memory storage adapter for testing or private browsing modes.
 */
export class MemoryStorageAdapter extends StorageAdapter {
    constructor() {
        super();
        this._store = [];
    }

    async loadAll() {
        return Promise.resolve([...this._store]);
    }

    async saveAll(bookmarks) {
        this._store = [...bookmarks];
        return Promise.resolve();
    }

    async clear() {
        this._store = [];
        return Promise.resolve();
    }
}

/**
 * LocalStorage adapter for persistent local bookmark saving.
 */
export class LocalStorageAdapter extends StorageAdapter {
    /**
     * @param {string} storageKey - The key under which bookmarks are stored in LocalStorage.
     */
    constructor(storageKey = 'alchemist_app_bookmarks') {
        super();
        this.storageKey = storageKey;
    }

    /**
     * @returns {Promise<Array<Object>>}
     */
    async loadAll() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return [];
            
            const parsed = JSON.parse(data);
            if (!Array.isArray(parsed)) {
                console.warn(`Corrupted storage at key ${this.storageKey}, resetting.`);
                return [];
            }
            return parsed;
        } catch (error) {
            throw new BookmarkStorageError(`Failed to load bookmarks from LocalStorage: ${error.message}`);
        }
    }

    /**
     * @param {Array<Object>} bookmarks - Array of serialized bookmark objects.
     * @returns {Promise<void>}
     */
    async saveAll(bookmarks) {
        try {
            const serialized = JSON.stringify(bookmarks);
            localStorage.setItem(this.storageKey, serialized);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                throw new BookmarkStorageError('LocalStorage quota exceeded. Cannot save bookmark.');
            }
            throw new BookmarkStorageError(`Failed to save bookmarks to LocalStorage: ${error.message}`);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            throw new BookmarkStorageError(`Failed to clear LocalStorage: ${error.message}`);
        }
    }
}

// ============================================================================
// MAIN MANAGER CLASS
// ============================================================================

/**
 * BookmarkManager orchestrates the creation, retrieval, updating, and deletion
 * of bookmarks. It coordinates between the StorageAdapter and the UI via events.
 */
export class BookmarkManager {
    /**
     * @param {Object} options - Configuration options.
     * @param {StorageAdapter} [options.adapter] - Storage adapter instance. Defaults to LocalStorageAdapter.
     * @param {boolean} [options.autoLoad] - Whether to load bookmarks from storage on instantiation.
     */
    constructor(options = {}) {
        this.adapter = options.adapter || new LocalStorageAdapter();
        
        /** @type {Map<string, Bookmark>} Internal cache of bookmarks mapped by ID */
        this._bookmarks = new Map();
        
        this.events = new BookmarkEventDispatcher();
        this._isLoaded = false;
        this._initializationPromise = null;

        if (options.autoLoad !== false) {
            this.initialize();
        }
    }

    /**
     * Initializes the manager by loading data from the storage adapter.
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initializationPromise) {
            return this._initializationPromise;
        }

        this._initializationPromise = (async () => {
            try {
                const rawBookmarks = await this.adapter.loadAll();
                this._bookmarks.clear();
                
                for (const raw of rawBookmarks) {
                    try {
                        const bookmark = Bookmark.fromJSON(raw);
                        this._bookmarks.set(bookmark.id, bookmark);
                    } catch (e) {
                        console.error('Failed to parse a bookmark during initialization, skipping:', e, raw);
                    }
                }
                
                this._isLoaded = true;
                this.events.emit('initialized', { count: this._bookmarks.size });
            } catch (error) {
                this.events.emit('error', { action: 'initialize', error });
                throw error;
            }
        })();

        return this._initializationPromise;
    }

    /**
     * Ensures the manager is loaded before performing operations.
     * @private
     */
    async _ensureLoaded() {
        if (!this._isLoaded) {
            await this.initialize();
        }
    }

    /**
     * Synchronizes the internal cache with the storage adapter.
     * @private
     */
    async _persist() {
        const serialized = Array.from(this._bookmarks.values()).map(b => b.toJSON());
        await this.adapter.saveAll(serialized);
    }

    // --- CRUD OPERATIONS ---

    /**
     * Creates a new bookmark and saves it.
     * 
     * @param {Object} bookmarkData - Data for the new bookmark.
     * @param {string} bookmarkData.bookId - ID of the book.
     * @param {string} bookmarkData.position - Reader position (e.g. CFI).
     * @param {string} [bookmarkData.title] - Optional title.
     * @param {string} [bookmarkData.textSnippet] - Optional text snippet.
     * @param {string} [bookmarkData.annotation] - Optional user annotation.
     * @param {string} [bookmarkData.color] - Optional color.
     * @param {Array<string>} [bookmarkData.tags] - Optional tags.
     * @returns {Promise<Bookmark>} The created bookmark instance.
     */
    async addBookmark(bookmarkData) {
        await this._ensureLoaded();

        try {
            // Check for duplicates (same book and exact same position)
            const exists = Array.from(this._bookmarks.values()).find(
                b => b.bookId === bookmarkData.bookId && b.position === bookmarkData.position
            );

            if (exists) {
                // If it exists, update it instead of creating a new one
                return this.updateBookmark(exists.id, bookmarkData);
            }

            const newBookmark = new Bookmark(bookmarkData);
            this._bookmarks.set(newBookmark.id, newBookmark);
            
            await this._persist();
            
            this.events.emit('bookmarkAdded', { bookmark: newBookmark.toJSON() });
            return newBookmark;
        } catch (error) {
            this.events.emit('error', { action: 'addBookmark', error });
            throw error;
        }
    }

    /**
     * Retrieves a specific bookmark by its ID.
     * 
     * @param {string} id - The bookmark ID.
     * @returns {Promise<Bookmark>}
     * @throws {BookmarkNotFoundError}
     */
    async getBookmark(id) {
        await this._ensureLoaded();
        
        const bookmark = this._bookmarks.get(id);
        if (!bookmark) {
            throw new BookmarkNotFoundError(id);
        }
        return bookmark;
    }

    /**
     * Updates an existing bookmark.
     * 
     * @param {string} id - The bookmark ID.
     * @param {Object} updates - Fields to update.
     * @returns {Promise<Bookmark>} The updated bookmark instance.
     * @throws {BookmarkNotFoundError}
     */
    async updateBookmark(id, updates) {
        await this._ensureLoaded();

        const bookmark = this._bookmarks.get(id);
        if (!bookmark) {
            throw new BookmarkNotFoundError(id);
        }

        try {
            // Prevent mutating immutable fields
            delete updates.id;
            delete updates.bookId;
            
            // Apply updates
            Object.assign(bookmark, updates);
            bookmark.updatedAt = Date.now();
            
            // Re-validate after update
            bookmark.validate();
            
            await this._persist();
            
            this.events.emit('bookmarkUpdated', { bookmark: bookmark.toJSON() });
            return bookmark;
        } catch (error) {
            this.events.emit('error', { action: 'updateBookmark', error });
            throw error;
        }
    }

    /**
     * Removes a bookmark by its ID.
     * 
     * @param {string} id - The bookmark ID.
     * @returns {Promise<boolean>} True if removed, false if it didn't exist.
     */
    async removeBookmark(id) {
        await this._ensureLoaded();

        if (!this._bookmarks.has(id)) {
            return false;
        }

        try {
            const removedBookmark = this._bookmarks.get(id);
            this._bookmarks.delete(id);
            
            await this._persist();
            
            this.events.emit('bookmarkRemoved', { id, bookId: removedBookmark.bookId });
            return true;
        } catch (error) {
            this.events.emit('error', { action: 'removeBookmark', error });
            throw error;
        }
    }

    // --- QUERY & UTILITY OPERATIONS ---

    /**
     * Retrieves all bookmarks, optionally filtered by bookId.
     * 
     * @param {string} [bookId] - Optional book ID to filter by.
     * @returns {Promise<Array<Bookmark>>} Array of bookmarks.
     */
    async getBookmarks(bookId = null) {
        await this._ensureLoaded();
        
        let results = Array.from(this._bookmarks.values());
        
        if (bookId) {
            results = results.filter(b => b.bookId === bookId);
        }
        
        // Default sort by creation date, newest first
        return results.sort((a, b) => b.createdAt - a.createdAt);
    }

    /**
     * Complex query function for bookmarks.
     * 
     * @param {Object} query - Query parameters.
     * @param {string} [query.bookId] - Filter by book.
     * @param {string} [query.tag] - Filter by a specific tag.
     * @param {string} [query.search] - Full-text search on title, snippet, and annotation.
     * @param {string} [query.sortBy='createdAt'] - Field to sort by ('createdAt', 'updatedAt', 'title').
     * @param {'asc'|'desc'} [query.sortOrder='desc'] - Sort direction.
     * @returns {Promise<Array<Bookmark>>}
     */
    async queryBookmarks({ bookId, tag, search, sortBy = 'createdAt', sortOrder = 'desc' }) {
        await this._ensureLoaded();
        
        let results = Array.from(this._bookmarks.values());

        // Filters
        if (bookId) {
            results = results.filter(b => b.bookId === bookId);
        }
        
        if (tag) {
            results = results.filter(b => b.tags.includes(tag));
        }
        
        if (search) {
            const s = search.toLowerCase();
            results = results.filter(b => 
                (b.title && b.title.toLowerCase().includes(s)) ||
                (b.textSnippet && b.textSnippet.toLowerCase().includes(s)) ||
                (b.annotation && b.annotation.toLowerCase().includes(s))
            );
        }

        // Sorting
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return results;
    }

    /**
     * Removes all bookmarks for a specific book.
     * 
     * @param {string} bookId - The book ID.
     * @returns {Promise<number>} Number of bookmarks deleted.
     */
    async clearBookmarksForBook(bookId) {
        await this._ensureLoaded();
        
        if (!bookId) throw new BookmarkError('bookId is required to clear bookmarks');

        try {
            let deletedCount = 0;
            for (const [id, bookmark] of this._bookmarks.entries()) {
                if (bookmark.bookId === bookId) {
                    this._bookmarks.delete(id);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                await this._persist();
                this.events.emit('bookmarksCleared', { bookId, count: deletedCount });
            }

            return deletedCount;
        } catch (error) {
            this.events.emit('error', { action: 'clearBookmarksForBook', error });
            throw error;
        }
    }

    /**
     * Danger Zone: Clears ALL bookmarks across ALL books.
     * 
     * @returns {Promise<void>}
     */
    async wipeAllData() {
        try {
            this._bookmarks.clear();
            await this.adapter.clear();
            this.events.emit('allDataWiped');
        } catch (error) {
            this.events.emit('error', { action: 'wipeAllData', error });
            throw error;
        }
    }

    // --- IMPORT / EXPORT ---

    /**
     * Exports all bookmarks as a serialized JSON string.
     * Useful for user backups.
     * 
     * @param {boolean} [pretty=true] - Whether to format the JSON output.
     * @returns {Promise<string>}
     */
    async exportData(pretty = true) {
        await this._ensureLoaded();
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            bookmarks: Array.from(this._bookmarks.values()).map(b => b.toJSON())
        };
        return JSON.stringify(data, null, pretty ? 2 : 0);
    }

    /**
     * Imports bookmarks from a JSON string.
     * 
     * @param {string} jsonString - The JSON string containing exported bookmarks.
     * @param {Object} options - Import options.
     * @param {boolean} [options.overwrite=false] - If true, clears existing data before import.
     * @returns {Promise<number>} Number of bookmarks successfully imported.
     */
    async importData(jsonString, options = { overwrite: false }) {
        await this._ensureLoaded();

        try {
            const parsed = JSON.parse(jsonString);
            const importedBookmarks = Array.isArray(parsed) ? parsed : parsed.bookmarks;

            if (!Array.isArray(importedBookmarks)) {
                throw new BookmarkError('Invalid import format: expected an array of bookmarks.');
            }

            if (options.overwrite) {
                this._bookmarks.clear();
            }

            let successCount = 0;

            for (const raw of importedBookmarks) {
                try {
                    const bookmark = Bookmark.fromJSON(raw);
                    // If not overwriting, we might want to generate a new ID to avoid collisions
                    if (!options.overwrite && this._bookmarks.has(bookmark.id)) {
                        bookmark.id = Bookmark.generateId();
                    }
                    this._bookmarks.set(bookmark.id, bookmark);
                    successCount++;
                } catch (e) {
                    console.warn('Skipping invalid bookmark during import:', e.message, raw);
                }
            }

            if (successCount > 0 || options.overwrite) {
                await this._persist();
                this.events.emit('dataImported', { count: successCount, overwrite: options.overwrite });
            }

            return successCount;
        } catch (error) {
            this.events.emit('error', { action: 'importData', error });
            throw new BookmarkError(`Failed to import data: ${error.message}`);
        }
    }

    // --- NAVIGATION HELPERS ---

    /**
     * Helper logic to trigger a navigation event in the host application.
     * The host application should listen to the 'navigateRequested' event.
     * 
     * @param {string} id - Bookmark ID to navigate to.
     * @returns {Promise<void>}
     */
    async goToBookmark(id) {
        const bookmark = await this.getBookmark(id);
        this.events.emit('navigateRequested', {
            bookId: bookmark.bookId,
            position: bookmark.position,
            bookmarkId: bookmark.id
        });
    }
}

// Export a default singleton instance for convenience in simple applications,
// while allowing the class to be instantiated manually for complex/multi-tenant setups.
export const globalBookmarkManager = new BookmarkManager();
export default BookmarkManager;