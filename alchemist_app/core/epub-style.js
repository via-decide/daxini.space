/**
 * @fileoverview EPUB Styling System and CSS Generator
 * @module core/epub-style
 * 
 * This module generates the core stylesheet (stylesheet.css) for EPUB generation.
 * It provides a comprehensive, production-ready CSS normalization and styling
 * framework designed to ensure consistent typography, spacing, and image rendering
 * across all major e-readers, with specific optimizations for Apple Books (iBooks),
 * Kindle (via Kindle Previewer/KDP), and Adobe Digital Editions.
 */

'use strict';

/**
 * Core CSS normalization and typography rules for EPUB 3.
 * Includes extensive fallback and vendor-prefixed properties to handle
 * the quirks of various rendering engines (WebKit, Blink, RMK).
 * 
 * @constant {string}
 */
const BASE_EPUB_CSS = `
@namespace epub "http://www.idpf.org/2007/ops";

/* ==========================================================================
   1. Reset & Normalization
   ========================================================================== */

html, body, div, span, applet, object, iframe,
h1, h2, h3, h4, h5, h6, p, blockquote, pre,
a, abbr, acronym, address, big, cite, code,
del, dfn, em, img, ins, kbd, q, s, samp,
small, strike, strong, sub, sup, tt, var,
b, u, i, center,
dl, dt, dd, ol, ul, li,
fieldset, form, label, legend,
table, caption, tbody, tfoot, thead, tr, th, td,
article, aside, canvas, details, embed, 
figure, figcaption, footer, header, hgroup, 
menu, nav, output, ruby, section, summary,
time, mark, audio, video {
    margin: 0;
    padding: 0;
    border: 0;
    font-size: 100%;
    vertical-align: baseline;
}

/* HTML5 display-role reset for older e-readers */
article, aside, details, figcaption, figure, 
footer, header, hgroup, menu, nav, section {
    display: block;
}

/* Base Body Styles - Respecting Reader Defaults */
body {
    line-height: 1.5;
    text-align: justify;
    /* Apple Books specific optimizations */
    -webkit-text-size-adjust: none;
    -webkit-font-smoothing: antialiased;
    /* Hyphenation support */
    -webkit-hyphens: auto;
    -moz-hyphens: auto;
    -epub-hyphens: auto;
    hyphens: auto;
    /* Word breaks */
    word-wrap: break-word;
    /* Prevent widow/orphan lines at the bottom/top of pages */
    widows: 2;
    orphans: 2;
    padding: 0;
    margin: 0;
}

/* ==========================================================================
   2. Typography & Spacing
   ========================================================================== */

/* Headings */
h1, h2, h3, h4, h5, h6 {
    font-weight: bold;
    line-height: 1.2;
    text-align: left;
    /* Prevent page breaks immediately after headings */
    page-break-after: avoid;
    -webkit-column-break-after: avoid;
    break-after: avoid;
    /* Apple Books: ensure headings don't get justified */
    -webkit-text-align: left;
}

h1 {
    font-size: 2em;
    margin-top: 1.5em;
    margin-bottom: 1em;
    text-align: center;
    page-break-before: always;
}

h2 {
    font-size: 1.5em;
    margin-top: 1.5em;
    margin-bottom: 0.75em;
}

h3 {
    font-size: 1.25em;
    margin-top: 1.2em;
    margin-bottom: 0.6em;
}

h4 {
    font-size: 1.1em;
    margin-top: 1em;
    margin-bottom: 0.5em;
}

/* Paragraphs */
p {
    margin: 0;
    text-indent: 1.5em; /* Standard book indent */
    line-height: 1.5;
}

/* Remove indent for first paragraph in a chapter/section */
h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p,
.no-indent,
.chapter-title + p,
.section-break + p {
    text-indent: 0;
    margin-top: 0.5em;
}

/* Blockquotes */
blockquote {
    margin: 1.5em 1.5em;
    padding: 0;
    font-style: italic;
    text-align: left;
}

blockquote p {
    text-indent: 0;
    margin-bottom: 0.5em;
}

/* Lists */
ul, ol {
    margin: 1em 0 1em 2em;
    padding: 0;
    text-align: left;
}

li {
    margin-bottom: 0.5em;
    line-height: 1.4;
}

li p {
    text-indent: 0;
}

/* Links */
a {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid currentColor;
}

a[href] {
    color: #005599; /* Safe default for color readers */
}

/* Inline Elements */
em, i { font-style: italic; }
strong, b { font-weight: bold; }
sup, sub {
    font-size: 0.75em;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
}
sup { top: -0.5em; }
sub { bottom: -0.25em; }

small { font-size: 0.8em; }

code, kbd, pre, samp {
    font-family: monospace, serif;
    font-size: 0.9em;
}

pre {
    white-space: pre-wrap;
    margin: 1em 0;
    padding: 1em;
    background-color: #f5f5f5;
    border: 1px solid #e0e0e0;
    text-align: left;
    page-break-inside: avoid;
}

/* ==========================================================================
   3. Images & Figures (Crucial for Apple Books / Kindle)
   ========================================================================== */

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
    page-break-inside: avoid;
    -webkit-column-break-inside: avoid;
    break-inside: avoid;
}

figure {
    margin: 1.5em 0;
    padding: 0;
    text-align: center;
    page-break-inside: avoid;
    -webkit-column-break-inside: avoid;
    break-inside: avoid;
}

figcaption {
    font-size: 0.85em;
    font-style: italic;
    margin-top: 0.5em;
    text-align: center;
    opacity: 0.8;
}

/* ==========================================================================
   4. Tables
   ========================================================================== */

table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    margin: 1.5em 0;
    page-break-inside: avoid;
    -webkit-column-break-inside: avoid;
    break-inside: avoid;
}

th, td {
    padding: 0.5em;
    border: 1px solid #cccccc;
    text-align: left;
    vertical-align: top;
}

th {
    font-weight: bold;
    background-color: #f9f9f9;
}

/* ==========================================================================
   5. Structural Layout & Helper Classes
   ========================================================================== */

/* Page Breaks */
.page-break-before {
    page-break-before: always;
    -webkit-column-break-before: always;
    break-before: page;
}

.page-break-after {
    page-break-after: always;
    -webkit-column-break-after: always;
    break-after: page;
}

.keep-together {
    page-break-inside: avoid;
    -webkit-column-break-inside: avoid;
    break-inside: avoid;
}

/* Alignment */
.text-center { text-align: center; text-indent: 0; }
.text-right { text-align: right; text-indent: 0; }
.text-left { text-align: left; text-indent: 0; }
.text-justify { text-align: justify; }

/* Section Breaks (Asterisms, Dingbats) */
.section-break {
    margin: 2em 0;
    text-align: center;
    text-indent: 0;
    font-size: 1.2em;
    page-break-inside: avoid;
}

/* Drop Caps */
.drop-cap {
    float: left;
    font-size: 3em;
    line-height: 0.8;
    padding-top: 0.1em;
    padding-right: 0.1em;
    padding-bottom: 0;
    margin-bottom: -0.1em;
    font-weight: bold;
}

/* Small Caps */
.small-caps {
    font-variant: small-caps;
    letter-spacing: 0.05em;
}

/* ==========================================================================
   6. Specific Frontmatter / Backmatter Styling
   ========================================================================== */

/* Title Page */
.title-page {
    text-align: center;
    margin-top: 20%;
}

.title-page h1 {
    font-size: 2.5em;
    margin-bottom: 0.2em;
    page-break-before: avoid;
}

.title-page .subtitle {
    font-size: 1.5em;
    font-style: italic;
    margin-bottom: 2em;
}

.title-page .author {
    font-size: 1.2em;
    font-weight: bold;
}

/* Copyright Page */
.copyright-page {
    font-size: 0.85em;
    text-align: left;
    margin-top: 10%;
}

.copyright-page p {
    text-indent: 0;
    margin-bottom: 1em;
}

/* Table of Contents */
.toc-list {
    list-style-type: none;
    margin: 0;
    padding: 0;
}

.toc-list li {
    margin-bottom: 0.5em;
}

.toc-list a {
    text-decoration: none;
    border-bottom: none;
}

/* Dedication */
.dedication {
    text-align: center;
    font-style: italic;
    margin-top: 25%;
    page-break-before: always;
}

/* Epigraph */
.epigraph {
    margin: 20% 15% 0 15%;
    text-align: left;
    font-style: italic;
}

.epigraph-source {
    text-align: right;
    font-style: normal;
    margin-top: 1em;
}

/* ==========================================================================
   7. Apple Books (iBooks) Specific Overrides
   ========================================================================== */
   
/* Force specific font families if defined by reader, prevent overrides breaking layout */
:root {
    -webkit-text-size-adjust: 100%;
}

/* Fix for Apple Books full-screen image rendering */
.ibooks-fullscreen-image {
    width: 100vw;
    height: 100vh;
    object-fit: contain;
    margin: 0;
    padding: 0;
}
`;

/**
 * Class representing the EPUB Styling System.
 * Generates and manages CSS structures for EPUB OEBPS stylesheets.
 */
class EpubStyleGenerator {
    
    /**
     * Creates an instance of EpubStyleGenerator.
     * 
     * @param {Object} [options] - Configuration options for the stylesheet.
     * @param {boolean} [options.includeReset=true] - Whether to include the CSS reset.
     * @param {string} [options.baseFontSize='100%'] - The base font size for the document.
     * @param {string} [options.baseLineHeight='1.5'] - The base line height.
     * @param {string} [options.paragraphIndent='1.5em'] - The default paragraph indentation.
     * @param {string} [options.customCss=''] - Additional custom CSS to append.
     * @param {Array<Object>} [options.fonts=[]] - Array of font objects to embed as @font-face.
     */
    constructor(options = {}) {
        this.options = {
            includeReset: true,
            baseFontSize: '100%',
            baseLineHeight: '1.5',
            paragraphIndent: '1.5em',
            customCss: '',
            fonts: [],
            ...options
        };
        
        this.css = '';
    }

    /**
     * Generates @font-face declarations based on configured fonts.
     * 
     * @returns {string} The formatted @font-face CSS rules.
     * @private
     */
    _generateFontFaceRules() {
        if (!this.options.fonts || this.options.fonts.length === 0) {
            return '';
        }

        let fontFaceCss = '/* Embedded Fonts */\n';
        
        this.options.fonts.forEach(font => {
            if (!font.family || !font.src) return;
            
            fontFaceCss += `@font-face {\n`;
            fontFaceCss += `    font-family: "${font.family}";\n`;
            fontFaceCss += `    src: url("${font.src}");\n`;
            
            if (font.weight) fontFaceCss += `    font-weight: ${font.weight};\n`;
            if (font.style) fontFaceCss += `    font-style: ${font.style};\n`;
            
            fontFaceCss += `}\n\n`;
        });

        return fontFaceCss;
    }

    /**
     * Builds the dynamic configuration overrides for the base CSS.
     * 
     * @returns {string} The CSS overrides block.
     * @private
     */
    _generateConfigOverrides() {
        let overrides = `/* Configuration Overrides */\nbody {\n`;
        
        if (this.options.baseFontSize !== '100%') {
            overrides += `    font-size: ${this.options.baseFontSize};\n`;
        }
        
        if (this.options.baseLineHeight !== '1.5') {
            overrides += `    line-height: ${this.options.baseLineHeight};\n`;
        }
        
        overrides += `}\n\n`;
        
        if (this.options.paragraphIndent !== '1.5em') {
            overrides += `p {\n    text-indent: ${this.options.paragraphIndent};\n}\n\n`;
        }

        return overrides;
    }

    /**
     * Generates the complete, production-ready stylesheet.
     * Merges base CSS, dynamic configuration, font faces, and custom CSS.
     * 
     * @returns {string} The fully compiled CSS string.
     */
    generateStylesheet() {
        let finalCss = '';

        // 1. Font Faces
        const fontFaces = this._generateFontFaceRules();
        if (fontFaces) {
            finalCss += fontFaces;
        }

        // 2. Base CSS (Includes Reset if configured)
        if (this.options.includeReset) {
            finalCss += BASE_EPUB_CSS + '\n';
        } else {
            // If reset is excluded, we still need the namespace and basic structures
            finalCss += `@namespace epub "http://www.idpf.org/2007/ops";\n\n`;
        }

        // 3. Configuration Overrides
        finalCss += this._generateConfigOverrides();

        // 4. Custom CSS appended at the end to ensure highest specificity
        if (this.options.customCss && this.options.customCss.trim() !== '') {
            finalCss += `/* Custom Injected CSS */\n${this.options.customCss}\n`;
        }

        this.css = finalCss;
        return this.css;
    }

    /**
     * Returns the raw base CSS string for direct usage or inspection.
     * 
     * @returns {string} The base EPUB CSS.
     * @static
     */
    static getBaseCss() {
        return BASE_EPUB_CSS;
    }

    /**
     * Utility method to create a stylesheet file structure object.
     * Useful for integration with archivers (like JSZip) or file system writers.
     * 
     * @param {Object} [options] - Configuration options.
     * @returns {Object} An object containing the path and content for the stylesheet.
     */
    static createOEBPSStylesheet(options = {}) {
        const generator = new EpubStyleGenerator(options);
        const content = generator.generateStylesheet();
        
        return {
            path: 'OEBPS/stylesheet.css',
            content: content,
            encoding: 'utf-8'
        };
    }
}

// Export the class for use in Node.js environments (CommonJS module format)
module.exports = EpubStyleGenerator;