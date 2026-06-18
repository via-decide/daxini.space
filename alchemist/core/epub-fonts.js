/**
 * @fileoverview EPUB Font Embedding and Typography Management System
 * @module core/epub-fonts
 * @description
 * Deterministic font embedding orchestrator for the ChemBook Auto Publisher.
 * Ensures cross-platform typographic consistency, specifically targeting strict
 * environments like Apple Books, KDP, and Adobe Digital Editions.
 * 
 * Features:
 * - Automatic TTF/OTF discovery and ingestion
 * - Intelligent font metadata inference (weight, style, family) from filenames
 * - Cryptographic deduplication of font assets
 * - Automatic generation of OPF manifest items
 * - Generation of Apple Books specific XML (com.apple.ibooks.display-options.xml)
 * - Strict CSS @font-face generation with EPUB best practices
 * 
 * @author Antigravity Synthesis Orchestrator (v3.0.0-beast)
 * @version 1.0.0
 */

"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// Custom Error Definitions
// ============================================================================

/**
 * Base error class for Font Embedding operations.
 * @extends Error
 */
class FontEmbeddingError extends Error {
    /**
     * @param {string} message - Error description
     * @param {string} [code] - Internal error code
     */
    constructor(message, code = 'EFONT_BASE') {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error thrown when a font file cannot be found or read.
 * @extends FontEmbeddingError
 */
class FontNotFoundError extends FontEmbeddingError {
    constructor(filePath) {
        super(`Font file not found or unreadable: ${filePath}`, 'EFONT_NOT_FOUND');
        this.filePath = filePath;
    }
}

/**
 * Error thrown when an unsupported font format is provided.
 * @extends FontEmbeddingError
 */
class UnsupportedFontFormatError extends FontEmbeddingError {
    constructor(extension) {
        super(`Unsupported font format: ${extension}. Only .ttf and .otf are supported.`, 'EFONT_UNSUPPORTED_FORMAT');
        this.extension = extension;
    }
}

// ============================================================================
// Constants and Mappings
// ============================================================================

/**
 * Valid MIME types for EPUB 3.2+ font files.
 * @type {Object.<string, string>}
 */
const FONT_MIME_TYPES = {
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',   // Included for future-proofing, though TTF/OTF requested
    '.woff2': 'font/woff2'
};

/**
 * Mapping of font filename keywords to CSS font-weight integer values.
 * @type {Object.<string, number>}
 */
const FONT_WEIGHT_MAP = {
    'thin': 100, 'hairline': 100,
    'extralight': 200, 'ultralight': 200,
    'light': 300,
    'regular': 400, 'normal': 400, 'book': 400,
    'medium': 500,
    'semibold': 600, 'demibold': 600,
    'bold': 700,
    'extrabold': 800, 'ultrabold': 800,
    'black': 900, 'heavy': 900
};

/**
 * Apple Books specific display options XML to force custom font rendering.
 * Required for iBooks to respect embedded @font-face rules.
 * @type {string}
 */
const APPLE_BOOKS_DISPLAY_OPTIONS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<display_options>
    <platform name="*">
        <option name="specified-fonts">true</option>
    </platform>
</display_options>`;

// ============================================================================
// Core Manager Class
// ============================================================================

/**
 * Manages font embedding, CSS generation, and OPF manifest integration for EPUBs.
 */
class EpubFontManager {
    /**
     * @typedef {Object} FontManagerOptions
     * @property {string} [fontsDir='fonts'] - The internal EPUB directory for fonts (e.g., 'OEBPS/fonts')
     * @property {boolean} [obfuscate=false] - Whether to apply IDPF font obfuscation (placeholder for future implementation)
     * @property {boolean} [strict=true] - If true, throws errors on missing fonts. If false, logs warnings.
     */

    /**
     * Initialize the EpubFontManager.
     * @param {FontManagerOptions} options - Configuration options
     */
    constructor(options = {}) {
        this.fontsDir = options.fontsDir || 'fonts';
        this.obfuscate = options.obfuscate || false;
        this.strict = options.strict !== undefined ? options.strict : true;
        
        /**
         * Internal registry of fonts.
         * Keyed by a unique hash of the font file to automatically deduplicate.
         * @type {Map<string, Object>}
         */
        this.registry = new Map();

        /**
         * Counter to ensure unique IDs for OPF manifest items if names collide.
         * @type {number}
         */
        this.manifestIdCounter = 0;
    }

    /**
     * Calculates a SHA-256 hash of a file's contents for deduplication.
     * @param {Buffer} buffer - The file buffer
     * @returns {string} The hex representation of the hash
     * @private
     */
    _calculateHash(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Infers CSS font properties (family, weight, style) from a standard font filename.
     * Assumes naming conventions like "Roboto-BoldItalic.ttf" or "OpenSans_SemiBold.otf".
     * 
     * @param {string} filename - The base name of the font file
     * @returns {{family: string, weight: number, style: string}} Inferred metadata
     * @private
     */
    _inferMetadataFromFilename(filename) {
        const basename = path.basename(filename, path.extname(filename));
        
        // Split by common delimiters (hyphen, underscore)
        const parts = basename.split(/[-_]/);
        
        let family = parts[0];
        let weight = 400; // Default to Regular
        let style = 'normal'; // Default to Normal

        // If no delimiters, try to split by CamelCase (e.g., RobotoBoldItalic)
        if (parts.length === 1) {
            const camelParts = basename.replace(/([A-Z])/g, ' $1').trim().split(' ');
            if (camelParts.length > 1) {
                family = camelParts[0];
                // Process the rest as modifiers
                parts.push(...camelParts.slice(1));
            }
        }

        // Analyze parts for weight and style keywords
        const modifiers = parts.slice(1).join('').toLowerCase();

        // Detect Style
        if (modifiers.includes('italic')) {
            style = 'italic';
        } else if (modifiers.includes('oblique')) {
            style = 'oblique';
        }

        // Detect Weight
        let weightFound = false;
        for (const [key, val] of Object.entries(FONT_WEIGHT_MAP)) {
            if (modifiers.includes(key)) {
                weight = val;
                weightFound = true;
                break;
            }
        }

        // Heuristic: If "Italic" is present but no weight, and it's not the base, assume 400
        if (!weightFound && modifiers.includes('italic') && modifiers.replace('italic', '').length === 0) {
            weight = 400;
        }

        // Clean up family name (add spaces before CamelCase if needed, though usually standard is to keep it verbatim or quote it in CSS)
        // For CSS font-family, we will quote it later.
        
        return {
            family: family.replace(/([A-Z])/g, ' $1').trim(), // Basic CamelCase un-mashing for family
            weight: weight,
            style: style,
            originalName: basename
        };
    }

    /**
     * Ingests a font file, reads its contents, infers metadata, and adds it to the registry.
     * Deduplicates identical font files automatically.
     * 
     * @param {string} sourcePath - Absolute or relative path to the font file
     * @param {Object} [overrides] - Manual overrides for font metadata
     * @param {string} [overrides.family] - Force specific font-family name
     * @param {number} [overrides.weight] - Force specific font-weight
     * @param {string} [overrides.style] - Force specific font-style (normal, italic, oblique)
     * @returns {string} The unique hash ID of the registered font
     * @throws {FontNotFoundError} If the file does not exist
     * @throws {UnsupportedFontFormatError} If the extension is not .ttf or .otf
     */
    addFont(sourcePath, overrides = {}) {
        if (!fs.existsSync(sourcePath)) {
            if (this.strict) {
                throw new FontNotFoundError(sourcePath);
            } else {
                console.warn(`[EpubFontManager] WARNING: Font not found at ${sourcePath}. Skipping.`);
                return null;
            }
        }

        const ext = path.extname(sourcePath).toLowerCase();
        if (!FONT_MIME_TYPES[ext]) {
            throw new UnsupportedFontFormatError(ext);
        }

        let buffer;
        try {
            buffer = fs.readFileSync(sourcePath);
        } catch (err) {
            throw new FontEmbeddingError(`Failed to read font file ${sourcePath}: ${err.message}`, 'EFONT_READ_FAIL');
        }

        const hash = this._calculateHash(buffer);

        // Deduplication check
        if (this.registry.has(hash)) {
            console.info(`[EpubFontManager] INFO: Font ${path.basename(sourcePath)} already registered (deduplicated).`);
            return hash;
        }

        const filename = path.basename(sourcePath);
        const inferred = this._inferMetadataFromFilename(filename);

        const fontEntry = {
            id: `font_${this.manifestIdCounter++}`,
            hash: hash,
            sourcePath: sourcePath,
            filename: filename,
            ext: ext,
            mimeType: FONT_MIME_TYPES[ext],
            buffer: buffer,
            family: overrides.family || inferred.family,
            weight: overrides.weight || inferred.weight,
            style: overrides.style || inferred.style,
            epubPath: `${this.fontsDir}/${filename}`
        };

        this.registry.set(hash, fontEntry);
        console.debug(`[EpubFontManager] Registered font: ${fontEntry.family} (${fontEntry.weight} ${fontEntry.style}) -> ${fontEntry.epubPath}`);
        
        return hash;
    }

    /**
     * Recursively scans a directory for supported font files (.ttf, .otf) and adds them.
     * 
     * @param {string} directoryPath - Directory to scan
     * @returns {number} Number of fonts successfully added
     */
    scanAndAddDirectory(directoryPath) {
        let addedCount = 0;

        if (!fs.existsSync(directoryPath)) {
            console.warn(`[EpubFontManager] WARNING: Directory not found: ${directoryPath}`);
            return addedCount;
        }

        const files = fs.readdirSync(directoryPath);

        for (const file of files) {
            const fullPath = path.join(directoryPath, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                addedCount += this.scanAndAddDirectory(fullPath);
            } else {
                const ext = path.extname(fullPath).toLowerCase();
                if (FONT_MIME_TYPES[ext]) {
                    try {
                        this.addFont(fullPath);
                        addedCount++;
                    } catch (err) {
                        console.error(`[EpubFontManager] ERROR adding font from directory: ${err.message}`);
                    }
                }
            }
        }

        return addedCount;
    }

    /**
     * Generates the CSS @font-face declarations for all registered fonts.
     * Formats output cleanly for inclusion in the EPUB's main stylesheet.
     * 
     * @param {string} [cssRelativePathPrefix='../'] - Prefix to adjust paths if CSS is in a subfolder (e.g., '../fonts/font.ttf')
     * @returns {string} The compiled CSS string containing all @font-face rules
     */
    generateCss(cssRelativePathPrefix = '../') {
        if (this.registry.size === 0) {
            return '/* No embedded fonts registered */\n';
        }

        let css = '/* ==========================================================================\n';
        css += '   Embedded Fonts (@font-face declarations)\n';
        css += '   Auto-generated by ChemBook EpubFontManager\n';
        css += '   ========================================================================== */\n\n';

        for (const font of this.registry.values()) {
            // Ensure path separators are forward slashes for EPUB web compatibility
            const normalizedPath = path.join(cssRelativePathPrefix, font.epubPath).replace(/\\/g, '/');
            
            // Format string based on extension for the 'format' hint
            let formatHint = '';
            if (font.ext === '.ttf') formatHint = ' format("truetype")';
            if (font.ext === '.otf') formatHint = ' format("opentype")';
            if (font.ext === '.woff') formatHint = ' format("woff")';
            if (font.ext === '.woff2') formatHint = ' format("woff2")';

            css += `@font-face {\n`;
            css += `    font-family: "${font.family}";\n`;
            css += `    src: url("${normalizedPath}")${formatHint};\n`;
            css += `    font-weight: ${font.weight};\n`;
            css += `    font-style: ${font.style};\n`;
            css += `    font-display: swap;\n`;
            css += `}\n\n`;
        }

        return css;
    }

    /**
     * Generates the `<item>` tags required for the OPF `<manifest>` section.
     * 
     * @returns {string} XML string of manifest items
     */
    generateOpfManifestItems() {
        if (this.registry.size === 0) return '';

        let xml = '    <!-- Embedded Fonts -->\n';
        for (const font of this.registry.values()) {
            // EPUB paths must use forward slashes
            const href = font.epubPath.replace(/\\/g, '/');
            xml += `    <item id="${font.id}" href="${href}" media-type="${font.mimeType}" />\n`;
        }
        return xml;
    }

    /**
     * Returns the exact XML string required by Apple Books to enable specified fonts.
     * This file should be placed at `META-INF/com.apple.ibooks.display-options.xml` in the EPUB.
     * 
     * @returns {string} The Apple Books XML content
     */
    getAppleBooksDisplayOptionsXml() {
        return APPLE_BOOKS_DISPLAY_OPTIONS_XML;
    }

    /**
     * Writes all registered font files to the specified output directory.
     * Creates the directory structure if it does not exist.
     * 
     * @param {string} outputBaseDir - The root directory of the unzipped EPUB (e.g., 'build/epub/OEBPS')
     * @returns {Promise<void>}
     */
    async exportFontsAsync(outputBaseDir) {
        if (this.registry.size === 0) return;

        for (const font of this.registry.values()) {
            const targetPath = path.join(outputBaseDir, font.epubPath);
            const targetDir = path.dirname(targetPath);

            // Ensure directory exists
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Write file buffer directly
            try {
                await fs.promises.writeFile(targetPath, font.buffer);
                console.debug(`[EpubFontManager] Exported font to: ${targetPath}`);
            } catch (err) {
                throw new FontEmbeddingError(`Failed to write font to ${targetPath}: ${err.message}`, 'EFONT_WRITE_FAIL');
            }
        }
    }

    /**
     * Synchronous version of exportFontsAsync.
     * Writes all registered font files to the specified output directory.
     * 
     * @param {string} outputBaseDir - The root directory of the unzipped EPUB (e.g., 'build/epub/OEBPS')
     */
    exportFontsSync(outputBaseDir) {
        if (this.registry.size === 0) return;

        for (const font of this.registry.values()) {
            const targetPath = path.join(outputBaseDir, font.epubPath);
            const targetDir = path.dirname(targetPath);

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            try {
                fs.writeFileSync(targetPath, font.buffer);
            } catch (err) {
                throw new FontEmbeddingError(`Failed to write font to ${targetPath}: ${err.message}`, 'EFONT_WRITE_FAIL');
            }
        }
    }

    /**
     * Injects the Apple Books display options XML into the META-INF directory of the EPUB staging area.
     * 
     * @param {string} epubRootDir - The absolute root directory of the EPUB staging area (where META-INF lives)
     */
    injectAppleBooksConfigSync(epubRootDir) {
        const metaInfDir = path.join(epubRootDir, 'META-INF');
        if (!fs.existsSync(metaInfDir)) {
            fs.mkdirSync(metaInfDir, { recursive: true });
        }

        const targetPath = path.join(metaInfDir, 'com.apple.ibooks.display-options.xml');
        try {
            fs.writeFileSync(targetPath, this.getAppleBooksDisplayOptionsXml(), 'utf8');
            console.info(`[EpubFontManager] Injected Apple Books display options at: ${targetPath}`);
        } catch (err) {
            throw new FontEmbeddingError(`Failed to write Apple Books XML: ${err.message}`, 'EFONT_APPLE_XML_FAIL');
        }
    }

    /**
     * Retrieves a summary of all loaded fonts.
     * Useful for debugging or generating a colophon.
     * 
     * @returns {Array<{family: string, weight: number, style: string, file: string}>} Array of font metadata
     */
    getFontSummary() {
        return Array.from(this.registry.values()).map(f => ({
            family: f.family,
            weight: f.weight,
            style: f.style,
            file: f.filename
        }));
    }

    /**
     * Clears the font registry.
     */
    clear() {
        this.registry.clear();
        this.manifestIdCounter = 0;
    }
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
    EpubFontManager,
    FontEmbeddingError,
    FontNotFoundError,
    UnsupportedFontFormatError,
    FONT_MIME_TYPES,
    FONT_WEIGHT_MAP
};