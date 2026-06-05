/**
 * @file core/bookmarks.js
 * @description Foundation bookmark system for saving, managing, and navigating reading positions.
 * Part of the Alchemist App core reasoning and reading experience.
 * 
 * @module BookmarkSystem
 */

'use strict';

/**
 * BookmarkManager
 * Handles all bookmark operations including CRUD and persistence via LocalStorage.
 */
class BookmarkManager {
    static STORAGE_PREFIX = 'alchemist_bookmarks_';
    static MAX_BOOKMARKS_PER_BOOK = 50;

    /**
     * Creates a new bookmark for a specific book.
     * 
     * @param {string} bookId - Unique identifier for the book.
     * @param {string} [label] - User-friendly name for the bookmark.
     * @param {Object} metadata - Position and location data.
     * @param {number} metadata.chapterIndex - Chapter position.
     * @param {number} metadata.pageIndex - Page position within chapter.
     * @param {string} [metadata.location] - Human-readable location (e.g. "p.142").
     * @param {string} [metadata.color] - Visual indicator ("yellow", "blue", "red" or hex).
     * @returns {Object} The created bookmark object.
     * @throws {Error} If validation fails.
     */
    static addBookmark(bookId, label = '', metadata = {}) {
        if (!bookId) throw new Error("BOOKMARK_MISSING_BOOK_ID");
        
        const { chapterIndex, pageIndex } = metadata;
        if (chapterIndex === undefined || pageIndex === undefined) {
            throw new Error("BOOKMARK_MISSING_LOCATION");
        }

        if (typeof chapterIndex !== 'number' || chapterIndex < 0 || 
            typeof pageIndex !== 'number' || pageIndex < 0) {
            throw new Error("BOOKMARK_INVALID_LOCATION");
        }

        if (label && typeof label === 'string' && label.length > 100) {
            label = label.substring(0, 100);
        }

        const bookmarks = this._load(bookId);
        
        if (bookmarks.length >= this.MAX_BOOKMARKS_PER_BOOK) {
            // In a real app we might want to alert the user, but per spec we enforce limit.
            // We'll throw an error that the UI can catch.
            throw new Error("BOOKMARK_STORAGE_FULL");
        }

        const timestamp = Date.now();
        const bookmark = {
            id: this._generateId(),
            bookId,
            label: label || `Bookmark ${bookmarks.length + 1}`,
            metadata: {
                chapterIndex,
                pageIndex,
                location: metadata.location || `Ch. ${chapterIndex + 1}, Pg. ${pageIndex + 1}`,
                timestamp,
                color: metadata.color || "yellow"
            },
            createdAt: timestamp
        };

        bookmarks.push(bookmark);
        this._save(bookId, bookmarks);

        return bookmark;
    }

    /**
     * Retrieves all bookmarks for a book, sorted by creation date (newest first).
     * 
     * @param {string} bookId 
     * @param {number} [limit] - Optional limit for pagination.
     * @returns {Array<Object>}
     */
    static getBookmarks(bookId, limit = null) {
        let bookmarks = this._load(bookId);
        
        // Sort by creation date descending
        bookmarks.sort((a, b) => b.createdAt - a.createdAt);

        if (limit && typeof limit === 'number') {
            bookmarks = bookmarks.slice(0, limit);
        }

        // Add relative time helper (simple implementation)
        return bookmarks.map(bm => ({
            ...bm,
            relativeTime: this._getRelativeTime(bm.createdAt)
        }));
    }

    /**
     * Navigates to a specific bookmark.
     * 
     * @param {string} bookId 
     * @param {string} bookmarkId 
     * @param {Object} locationManager - Instance of LocationManager from reader-location.js
     * @returns {Object} Navigation result.
     */
    static navigateToBookmark(bookId, bookmarkId, locationManager) {
        const bookmarks = this._load(bookId);
        const bookmark = bookmarks.find(bm => bm.id === bookmarkId);

        if (!bookmark) {
            throw new Error("BOOKMARK_NOT_FOUND");
        }

        const { chapterIndex, pageIndex } = bookmark.metadata;

        // Integration with reader-location.js
        if (locationManager && typeof locationManager.updateLocation === 'function') {
            try {
                locationManager.updateLocation(chapterIndex, pageIndex, null, true);
                return {
                    success: true,
                    message: `Navigated to '${bookmark.label}'`,
                    location: { chapterIndex, pageIndex }
                };
            } catch (e) {
                throw new Error("NAVIGATION_FAIL");
            }
        } else {
            throw new Error("READER_LOCATION_SYSTEM_UNAVAILABLE");
        }
    }

    /**
     * Updates an existing bookmark's metadata or label.
     * 
     * @param {string} bookId 
     * @param {string} bookmarkId 
     * @param {Object} updates 
     * @returns {Object}
     */
    static updateBookmark(bookId, bookmarkId, updates) {
        const bookmarks = this._load(bookId);
        const index = bookmarks.findIndex(bm => bm.id === bookmarkId);

        if (index === -1) {
            throw new Error("BOOKMARK_NOT_FOUND");
        }

        const bookmark = bookmarks[index];
        
        if (updates.label !== undefined) bookmark.label = updates.label;
        if (updates.color !== undefined) bookmark.metadata.color = updates.color;
        if (updates.metadata) {
            bookmark.metadata = { ...bookmark.metadata, ...updates.metadata };
        }

        this._save(bookId, bookmarks);

        return {
            success: true,
            bookmark
        };
    }

    /**
     * Deletes a specific bookmark.
     * 
     * @param {string} bookId 
     * @param {string} bookmarkId 
     * @returns {Object}
     */
    static deleteBookmark(bookId, bookmarkId) {
        let bookmarks = this._load(bookId);
        const initialCount = bookmarks.length;
        bookmarks = bookmarks.filter(bm => bm.id !== bookmarkId);

        if (bookmarks.length === initialCount) {
            throw new Error("BOOKMARK_NOT_FOUND");
        }

        this._save(bookId, bookmarks);

        return {
            success: true,
            message: "Bookmark deleted",
            remainingCount: bookmarks.length
        };
    }

    /**
     * Deletes all bookmarks for a book.
     * 
     * @param {string} bookId 
     */
    static deleteAll(bookId) {
        localStorage.removeItem(`${this.STORAGE_PREFIX}${bookId}`);
        return { success: true };
    }

    /**
     * Deletes multiple bookmarks.
     * 
     * @param {string} bookId 
     * @param {Array<string>} bookmarkIds 
     */
    static bulkDelete(bookId, bookmarkIds) {
        let bookmarks = this._load(bookId);
        bookmarks = bookmarks.filter(bm => !bookmarkIds.includes(bm.id));
        this._save(bookId, bookmarks);
        return { success: true, remainingCount: bookmarks.length };
    }

    /**
     * Checks if a specific location is already bookmarked.
     * 
     * @param {string} bookId 
     * @param {number} chapterIndex 
     * @param {number} pageIndex 
     * @returns {boolean}
     */
    static isBookmarked(bookId, chapterIndex, pageIndex) {
        const bookmarks = this._load(bookId);
        return bookmarks.some(bm => 
            bm.metadata.chapterIndex === chapterIndex && 
            bm.metadata.pageIndex === pageIndex
        );
    }

    /**
     * Searches bookmarks by label.
     * 
     * @param {string} bookId 
     * @param {string} query 
     * @returns {Array<Object>}
     */
    static search(bookId, query) {
        const bookmarks = this._load(bookId);
        const q = query.toLowerCase();
        return bookmarks.filter(bm => bm.label.toLowerCase().includes(q));
    }

    // --- PRIVATE HELPERS ---

    static _generateId() {
        return `bm_${Math.random().toString(36).substr(2, 9)}`;
    }

    static _save(bookId, bookmarks) {
        const data = {
            bookId,
            bookmarks,
            lastModified: Date.now(),
            version: 1
        };
        try {
            localStorage.setItem(`${this.STORAGE_PREFIX}${bookId}`, JSON.stringify(data));
        } catch (e) {
            throw new Error("BOOKMARK_STORAGE_ERROR");
        }
    }

    static _load(bookId) {
        const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${bookId}`);
        if (!raw) return [];
        try {
            const data = JSON.parse(raw);
            return data.bookmarks || [];
        } catch (e) {
            console.error("Corrupted bookmark data for book:", bookId);
            return [];
        }
    }

    static _getRelativeTime(timestamp) {
        const diff = Date.now() - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return "Just now";
    }
}

export default BookmarkManager;
export { BookmarkManager };