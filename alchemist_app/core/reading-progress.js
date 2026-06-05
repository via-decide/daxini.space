/**
 * @file reading-progress.js
 * @description Refactored Reading Progress Engine for stateless, scalable, and performant progress tracking.
 */

const { Tracker } = require('./tracker');
const { Book } = require('../book');

class ReadingProgress {
  /**
   * Initializes the reading progress tracker with a given book.
   *
   * @param {Book} book The book to track progress for.
   */
  constructor(book) {
    this.book = book;
    this.tracker = new Tracker();
  }

  /**
   * Updates the reading progress tracker with a given chapter and page number.
   *
   * @param {string} chapter The chapter title.
   * @param {number} pageNumber The current page number.
   */
  updateProgress(chapter, pageNumber) {
    this.tracker.update({
      book: this.book.title,
      chapter,
      pageNumber,
    });
  }

  /**
   * Retrieves the reading progress tracker's current state.
   *
   * @returns {{ book: string, chapter: string, pageNumber: number }}
   */
  getProgress() {
    return this.tracker.getState();
  }
}

module.exports = ReadingProgress;