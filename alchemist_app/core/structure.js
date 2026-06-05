/**
 * @file structure.js
 * @description Refactored Document Structure Engine for EPUB-compliant navigation (TOC + nav.xhtml)
 */

const { parse } = require('htmlparser2');
const fs = require('fs');
const path = require('path');

class StructureEngine {
  /**
   * @constructor
   */
  constructor() {}

  /**
   * Parse HTML document and extract headings, build hierarchy, and generate EPUB-compliant navigation (TOC + nav.xhtml)
   *
   * @param {string} htmlContent - HTML content to parse
   * @returns {{ toc: string[], navXhtml: string }}
   */
  async parseStructure(htmlContent) {
    const parser = new parse.Parser({
      onopentag: (name, attribs) => {
        if (name === 'h1' || name === 'h2' || name === 'h3' || name === 'h4' || name === 'h5' || name === 'h6') {
          this.headings.push({ level: name, text: attribs.title });
        }
      },
    });

    const headings = [];
    let currentLevel = 0;
    let toc = [];

    parser.write(htmlContent);
    parser.end();

    // Build hierarchy
    for (const heading of this.headings) {
      while (currentLevel < heading.level.match(/^h(\d+)$/) ? parseInt($1) : 0) {
        toc.push({ text: '', level: currentLevel });
        currentLevel++;
      }
      toc.push({ text: heading.text, level: heading.level });
    }

    // Generate EPUB-compliant navigation (TOC + nav.xhtml)
    const navXhtml = `
      <nav id="toc">
        <h2>Table of Contents</h2>
        ${toc.map((item) => `<a href="#${item.text.replace(/\s+/g, '-').toLowerCase()}">${item.text}</a>`).join('')}
      </nav>
    `;

    return { toc, navXhtml };
  }

  /**
   * @returns {string[]}
   */
  get headings() {
    return this._headings;
  }

  set headings(value) {
    this._headings = value;
  }
}

module.exports = StructureEngine;