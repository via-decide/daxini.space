/**
 * @fileoverview EPUB Metadata and Packaging Engine.
 * 
 * This module provides a robust, production-ready system for generating EPUB 3.0 metadata,
 * ensuring full compatibility with Apple Books (iBooks), Amazon KDP, Google Play Books,
 * and standard EPUB readers. It handles the generation of the OPF (Open Packaging Format),
 * NCX (Navigation Center eXtended for EPUB 2 backward compatibility), EPUB 3 Navigation 
 * Documents (nav.xhtml), and complete Cover Image processing and registration.
 * 
 * Features:
 * - Deterministic UUID generation or ISBN integration.
 * - Dublin Core metadata mapping.
 * - Apple Books specific meta tags (specified-fonts, versioning).
 * - KDP specific guide and cover handling.
 * - Auto-detection of MIME types for manifest items.
 * - EPUB 3 and EPUB 2 hybrid structural generation.
 * 
 * @module core/epub-metadata
 * @requires fs
 * @requires path
 * @requires crypto
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * @typedef {Object} EpubAuthor
 * @property {string} name - The author's full name.
 * @property {string} [role='aut'] - The MARC relator code for the role (e.g., 'aut' for author, 'ill' for illustrator).
 * @property {string} [fileAs] - The name formatted for sorting (e.g., "Doe, John").
 */

/**
 * @typedef {Object} EpubMetadataConfig
 * @property {string} title - The title of the book.
 * @property {string} [subtitle] - The subtitle of the book.
 * @property {string} language - ISO 639-1 language code (e.g., 'en', 'fr').
 * @property {EpubAuthor[]} authors - List of authors and contributors.
 * @property {string} [publisher] - The publisher's name.
 * @property {string} [description] - A synopsis or description of the book.
 * @property {string} [isbn] - The ISBN of the book (if available).
 * @property {string} [uuid] - A specific UUID (will be auto-generated if omitted).
 * @property {string} [pubDate] - Publication date in ISO 8601 format (YYYY-MM-DD).
 * @property {string} [rights] - Copyright information.
 * @property {string[]} [subjects] - List of keywords or BISAC subjects.
 * @property {boolean} [specifiedFonts=true] - Apple Books specific: whether custom fonts are used.
 * @property {string} [bookVersion='1.0.0'] - The semantic version of the EPUB file.
 */

/**
 * @typedef {Object} ManifestItem
 * @property {string} id - Unique identifier for the manifest item.
 * @property {string} href - Relative path to the file inside the OEBPS folder.
 * @property {string} mediaType - MIME type of the file.
 * @property {string} [properties] - EPUB 3 properties (e.g., 'cover-image', 'nav').
 */

/**
 * @typedef {Object} SpineItem
 * @property {string} idref - The ID of the manifest item.
 * @property {boolean} [linear=true] - Whether the item is part of the linear reading order.
 */

/**
 * @typedef {Object} TocItem
 * @property {string} id - Unique ID for the TOC entry.
 * @property {string} label - The text displayed in the Table of Contents.
 * @property {string} href - The relative link to the content (can include anchor # tags).
 * @property {number} order - The playOrder for the NCX file.
 * @property {TocItem[]} [children] - Nested sub-chapters.
 */

/**
 * Core Engine for generating EPUB 3.0 packaging files.
 */
class EpubMetadataManager {
    /**
     * Initializes the EPUB Metadata Manager.
     * 
     * @param {EpubMetadataConfig} config - The metadata configuration for the book.
     */
    constructor(config) {
        this.validateConfig(config);
        
        this.config = {
            ...config,
            uuid: config.uuid || config.isbn || this.generateDeterministicUUID(config.title, config.authors[0]?.name),
            pubDate: config.pubDate || new Date().toISOString().split('T')[0],
            specifiedFonts: config.specifiedFonts !== false,
            bookVersion: config.bookVersion || '1.0.0',
            subjects: config.subjects || [],
            publisher: config.publisher || 'ChemBook Auto Publisher'
        };

        this.manifest = [];
        this.spine = [];
        this.toc = [];
        this.guide = [];
        
        this.coverId = null;
        this.navId = null;
        this.ncxId = null;
    }

    /**
     * Validates the incoming configuration to ensure EPUB compliance.
     * @param {EpubMetadataConfig} config 
     * @throws {Error} If required metadata is missing.
     */
    validateConfig(config) {
        if (!config.title) throw new Error('EPUB Metadata Error: "title" is required.');
        if (!config.language) throw new Error('EPUB Metadata Error: "language" is required (e.g., "en").');
        if (!config.authors || !Array.isArray(config.authors) || config.authors.length === 0) {
            throw new Error('EPUB Metadata Error: At least one author is required in the "authors" array.');
        }
    }

    /**
     * Generates a deterministic UUID based on title and author if no ISBN/UUID is provided.
     * This ensures reproducible builds for the same book, preventing duplicate library entries
     * on platforms like Apple Books when updating.
     * 
     * @param {string} title 
     * @param {string} author 
     * @returns {string} UUID v4 format string generated deterministically.
     */
    generateDeterministicUUID(title, author) {
        const hash = crypto.createHash('sha1').update(`${title}-${author}-chembook`).digest('hex');
        return `urn:uuid:${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-8${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
    }

    /**
     * Guesses the MIME type based on file extension.
     * Crucial for EPUB manifest validation.
     * 
     * @param {string} filepath 
     * @returns {string} MIME type
     */
    getMimeType(filepath) {
        const ext = path.extname(filepath).toLowerCase();
        const mimeTypes = {
            '.html': 'application/xhtml+xml',
            '.xhtml': 'application/xhtml+xml',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ttf': 'application/font-sfnt',
            '.otf': 'application/font-sfnt',
            '.woff': 'application/font-woff',
            '.woff2': 'font/woff2',
            '.ncx': 'application/x-dtbncx+xml',
            '.xml': 'application/xml',
            '.smil': 'application/smil+xml',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Registers a file in the EPUB manifest.
     * 
     * @param {string} id - Unique ID.
     * @param {string} href - Relative path.
     * @param {string} [properties] - Space separated properties (e.g., 'nav', 'cover-image').
     * @returns {string} The assigned ID.
     */
    addManifestItem(id, href, properties = null) {
        const mediaType = this.getMimeType(href);
        const item = { id, href, mediaType };
        if (properties) {
            item.properties = properties;
        }
        
        // Prevent duplicates
        const existingIndex = this.manifest.findIndex(i => i.id === id || i.href === href);
        if (existingIndex >= 0) {
            this.manifest[existingIndex] = item;
        } else {
            this.manifest.push(item);
        }
        return id;
    }

    /**
     * Adds an item to the reading spine.
     * 
     * @param {string} idref - ID of the manifest item.
     * @param {boolean} [linear=true] - If false, it's supplementary (like an answer key).
     */
    addSpineItem(idref, linear = true) {
        if (!this.spine.some(i => i.idref === idref)) {
            this.spine.push({ idref, linear });
        }
    }

    /**
     * Adds an entry to the structural Guide (EPUB 2 / KDP fallback).
     * 
     * @param {string} type - Guide type (e.g., 'cover', 'toc', 'text').
     * @param {string} title - Human readable title.
     * @param {string} href - Relative path to the file.
     */
    addGuideItem(type, title, href) {
        this.guide.push({ type, title, href });
    }

    /**
     * Adds a Table of Contents entry.
     * 
     * @param {string} id - Entry ID.
     * @param {string} label - Display label.
     * @param {string} href - Link to content.
     * @param {number} order - Sequential order.
     * @param {string} [parentId] - If this is a child, the ID of the parent TOC item.
     */
    addTocEntry(id, label, href, order, parentId = null) {
        const entry = { id, label, href, order, children: [] };
        
        if (parentId) {
            const parent = this.findTocNode(this.toc, parentId);
            if (parent) {
                parent.children.push(entry);
                return;
            }
        }
        this.toc.push(entry);
    }

    /**
     * Recursively searches for a TOC node.
     * @private
     */
    findTocNode(nodes, id) {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children.length > 0) {
                const found = this.findTocNode(node.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Processes the cover image, injecting it into the manifest and setting up Apple/KDP metadata.
     * 
     * @param {string} sourcePath - Absolute path to the source cover image.
     * @param {string} targetDir - The OEBPS directory where the cover should be copied.
     * @param {string} [targetFilename='cover.jpg'] - The name of the cover file in the EPUB.
     */
    async processCover(sourcePath, targetDir, targetFilename = 'cover.jpg') {
        try {
            // Ensure source exists
            await fs.access(sourcePath);
            
            const targetPath = path.join(targetDir, 'images', targetFilename);
            
            // Ensure images directory exists
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            
            // Copy file
            await fs.copyFile(sourcePath, targetPath);
            
            const href = `images/${targetFilename}`;
            this.coverId = 'cover-image';
            
            // Register in manifest with EPUB 3 property
            this.addManifestItem(this.coverId, href, 'cover-image');
            
            // Register an HTML wrapper for the cover (required by some older readers)
            const coverHtmlHref = 'cover.xhtml';
            const coverHtmlId = 'cover-xhtml';
            
            const coverHtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${this.config.language}" xml:lang="${this.config.language}">
<head>
    <title>${this.escapeXml(this.config.title)} - Cover</title>
    <meta charset="utf-8"/>
    <style type="text/css">
        body { margin: 0; padding: 0; text-align: center; background-color: #ffffff; }
        img { max-width: 100%; height: auto; }
        div.cover-wrapper { width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div class="cover-wrapper">
        <img src="${href}" alt="Cover image for ${this.escapeXml(this.config.title)}" />
    </div>
</body>
</html>`;
            
            await fs.writeFile(path.join(targetDir, coverHtmlHref), coverHtmlContent, 'utf8');
            
            this.addManifestItem(coverHtmlId, coverHtmlHref);
            // Cover should be first in spine, but non-linear usually to avoid showing it twice
            // However, KDP prefers it linear. We will set linear=true.
            this.spine.unshift({ idref: coverHtmlId, linear: true });
            this.addGuideItem('cover', 'Cover', coverHtmlHref);
            
            return true;
        } catch (error) {
            console.error(`[EPUB Metadata] Failed to process cover image: ${error.message}`);
            throw error;
        }
    }

    /**
     * Escapes XML special characters to prevent OPF/NCX corruption.
     * 
     * @param {string} str 
     * @returns {string} Escaped string.
     */
    escapeXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Generates the complete content.opf XML string.
     * This is the brain of the EPUB file.
     * 
     * @returns {string} The OPF XML content.
     */
    generateOPF() {
        const c = this.config;
        
        // 1. Package Header
        let opf = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        opf += `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${c.language}">\n`;
        
        // 2. Metadata Section (Dublin Core & Meta tags)
        opf += `  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">\n`;
        
        // Identifiers
        const isUrn = c.uuid.startsWith('urn:');
        opf += `    <dc:identifier id="pub-id">${isUrn ? c.uuid : 'urn:uuid:' + c.uuid}</dc:identifier>\n`;
        if (c.isbn) {
            opf += `    <dc:identifier id="isbn">urn:isbn:${c.isbn}</dc:identifier>\n`;
            opf += `    <meta refines="#isbn" property="identifier-type" scheme="onix:codelist5">15</meta>\n`;
        }

        // Title
        opf += `    <dc:title id="title">${this.escapeXml(c.title)}</dc:title>\n`;
        if (c.subtitle) {
            opf += `    <dc:title id="subtitle">${this.escapeXml(c.subtitle)}</dc:title>\n`;
            opf += `    <meta refines="#subtitle" property="title-type">subtitle</meta>\n`;
        }

        // Authors & Contributors
        c.authors.forEach((author, index) => {
            const authorId = `author-${index}`;
            const role = author.role || 'aut';
            opf += `    <dc:creator id="${authorId}">${this.escapeXml(author.name)}</dc:creator>\n`;
            opf += `    <meta refines="#${authorId}" property="role" scheme="marc:relators">${role}</meta>\n`;
            if (author.fileAs) {
                opf += `    <meta refines="#${authorId}" property="file-as">${this.escapeXml(author.fileAs)}</meta>\n`;
            }
        });

        // Language
        opf += `    <dc:language>${c.language}</dc:language>\n`;
        
        // Dates
        opf += `    <dc:date>${c.pubDate}</dc:date>\n`;
        // EPUB 3 Modified Date (Required)
        const modifiedDate = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        opf += `    <meta property="dcterms:modified">${modifiedDate}</meta>\n`;

        // Publisher & Rights
        if (c.publisher) opf += `    <dc:publisher>${this.escapeXml(c.publisher)}</dc:publisher>\n`;
        if (c.rights) opf += `    <dc:rights>${this.escapeXml(c.rights)}</dc:rights>\n`;
        if (c.description) opf += `    <dc:description>${this.escapeXml(c.description)}</dc:description>\n`;

        // Subjects / Tags
        if (c.subjects && c.subjects.length > 0) {
            c.subjects.forEach(subject => {
                opf += `    <dc:subject>${this.escapeXml(subject)}</dc:subject>\n`;
            });
        }

        // --- Platform Specific Meta Tags ---
        
        // Cover (EPUB 2 compatibility for KDP/Apple)
        if (this.coverId) {
            opf += `    <meta name="cover" content="${this.coverId}" />\n`;
        }

        // Apple Books specifics
        if (c.specifiedFonts) {
            opf += `    <meta property="ibooks:specified-fonts">true</meta>\n`;
        }
        opf += `    <meta property="ibooks:version">${c.bookVersion}</meta>\n`;

        // ChemBook Auto Publisher signature
        opf += `    <meta name="generator" content="ChemBook Auto Publisher / Antigravity Engine" />\n`;

        opf += `  </metadata>\n`;

        // 3. Manifest Section
        opf += `  <manifest>\n`;
        this.manifest.forEach(item => {
            let props = item.properties ? ` properties="${item.properties}"` : '';
            opf += `    <item id="${item.id}" href="${this.escapeXml(item.href)}" media-type="${item.mediaType}"${props} />\n`;
        });
        opf += `  </manifest>\n`;

        // 4. Spine Section (Reading Order)
        // EPUB 3 fallback to NCX
        const tocAttr = this.ncxId ? ` toc="${this.ncxId}"` : '';
        opf += `  <spine${tocAttr}>\n`;
        this.spine.forEach(item => {
            const linearAttr = item.linear === false ? ` linear="no"` : '';
            opf += `    <itemref idref="${item.idref}"${linearAttr} />\n`;
        });
        opf += `  </spine>\n`;

        // 5. Guide Section (EPUB 2 / KDP requirement for cover/toc mapping)
        if (this.guide.length > 0) {
            opf += `  <guide>\n`;
            this.guide.forEach(item => {
                opf += `    <reference type="${item.type}" title="${this.escapeXml(item.title)}" href="${this.escapeXml(item.href)}" />\n`;
            });
            opf += `  </guide>\n`;
        }

        opf += `</package>\n`;
        return opf;
    }

    /**
     * Generates the toc.ncx file for EPUB 2 backward compatibility.
     * Extremely important for Amazon KDP parsing.
     * 
     * @returns {string} NCX XML content.
     */
    generateNCX() {
        const c = this.config;
        const isUrn = c.uuid.startsWith('urn:');
        const uid = isUrn ? c.uuid : 'urn:uuid:' + c.uuid;

        let ncx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        ncx += `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${c.language}">\n`;
        
        ncx += `  <head>\n`;
        ncx += `    <meta name="dtb:uid" content="${uid}" />\n`;
        // Depth calculation
        const depth = this.calculateTocDepth(this.toc);
        ncx += `    <meta name="dtb:depth" content="${depth}" />\n`;
        ncx += `    <meta name="dtb:totalPageCount" content="0" />\n`;
        ncx += `    <meta name="dtb:maxPageNumber" content="0" />\n`;
        ncx += `  </head>\n`;

        ncx += `  <docTitle>\n    <text>${this.escapeXml(c.title)}</text>\n  </docTitle>\n`;
        
        if (c.authors.length > 0) {
            ncx += `  <docAuthor>\n    <text>${this.escapeXml(c.authors[0].name)}</text>\n  </docAuthor>\n`;
        }

        ncx += `  <navMap>\n`;
        
        // Recursive function to build navPoints
        const buildNavPoints = (items) => {
            let xml = '';
            for (const item of items) {
                xml += `    <navPoint id="${item.id}" playOrder="${item.order}">\n`;
                xml += `      <navLabel>\n        <text>${this.escapeXml(item.label)}</text>\n      </navLabel>\n`;
                xml += `      <content src="${this.escapeXml(item.href)}" />\n`;
                if (item.children && item.children.length > 0) {
                    xml += buildNavPoints(item.children);
                }
                xml += `    </navPoint>\n`;
            }
            return xml;
        };

        ncx += buildNavPoints(this.toc);
        ncx += `  </navMap>\n`;
        ncx += `</ncx>\n`;

        return ncx;
    }

    /**
     * Calculates the maximum depth of the TOC tree.
     * @private
     */
    calculateTocDepth(items, currentDepth = 1) {
        let maxDepth = currentDepth;
        for (const item of items) {
            if (item.children && item.children.length > 0) {
                const depth = this.calculateTocDepth(item.children, currentDepth + 1);
                if (depth > maxDepth) maxDepth = depth;
            }
        }
        return maxDepth;
    }

    /**
     * Generates the EPUB 3 Navigation Document (nav.xhtml).
     * This replaces the NCX in modern readers but both should be included.
     * 
     * @returns {string} XHTML content for the Navigation Document.
     */
    generateNavXHTML() {
        const c = this.config;
        
        let nav = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        nav += `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${c.language}" xml:lang="${c.language}">\n`;
        nav += `<head>\n`;
        nav += `  <title>Table of Contents</title>\n`;
        nav += `  <meta charset="utf-8" />\n`;
        nav += `  <style type="text/css">\n`;
        nav += `    nav#toc { font-family: sans-serif; }\n`;
        nav += `    nav#toc ol { list-style-type: none; padding-left: 1.5em; }\n`;
        nav += `    nav#toc ol li { margin-bottom: 0.5em; }\n`;
        nav += `    nav#toc a { text-decoration: none; color: #000; }\n`;
        nav += `    nav#toc a:hover { text-decoration: underline; }\n`;
        nav += `  </style>\n`;
        nav += `</head>\n`;
        nav += `<body>\n`;
        
        nav += `  <nav epub:type="toc" id="toc" role="doc-toc">\n`;
        nav += `    <h1>Table of Contents</h1>\n`;
        
        const buildNavList = (items) => {
            if (!items || items.length === 0) return '';
            let xml = `    <ol>\n`;
            for (const item of items) {
                xml += `      <li>\n`;
                xml += `        <a href="${this.escapeXml(item.href)}">${this.escapeXml(item.label)}</a>\n`;
                if (item.children && item.children.length > 0) {
                    xml += buildNavList(item.children);
                }
                xml += `      </li>\n`;
            }
            xml += `    </ol>\n`;
            return xml;
        };

        nav += buildNavList(this.toc);
        nav += `  </nav>\n`;

        // Generate Landmarks (EPUB 3 Guide equivalent)
        if (this.guide.length > 0) {
            nav += `  <nav epub:type="landmarks" id="landmarks" hidden="hidden">\n`;
            nav += `    <h2>Landmarks</h2>\n`;
            nav += `    <ol>\n`;
            this.guide.forEach(item => {
                // Map EPUB 2 guide types to EPUB 3 epub:type
                let epubType = item.type;
                if (item.type === 'text') epubType = 'bodymatter';
                
                nav += `      <li><a epub:type="${epubType}" href="${this.escapeXml(item.href)}">${this.escapeXml(item.title)}</a></li>\n`;
            });
            nav += `    </ol>\n`;
            nav += `  </nav>\n`;
        }

        nav += `</body>\n`;
        nav += `</html>\n`;

        return nav;
    }

    /**
     * Generates the META-INF/container.xml file.
     * Required for ALL EPUBs to point to the OPF file.
     * 
     * @param {string} [opfPath='OEBPS/content.opf'] - Path to OPF relative to EPUB root.
     * @returns {string} XML content for container.xml.
     */
    generateContainerXML(opfPath = 'OEBPS/content.opf') {
        return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    }

    /**
     * Generates the mimetype file content.
     * Must be uncompressed and the very first file in the ZIP archive.
     * 
     * @returns {string} 
     */
    generateMimetype() {
        return 'application/epub+zip';
    }

    /**
     * Orchestrates the writing of all metadata files to the target directory.
     * 
     * @param {string} rootDir - The root directory of the unzipped EPUB structure.
     * @param {string} [oebpsDirName='OEBPS'] - The name of the content directory.
     */
    async writeAllMetadata(rootDir, oebpsDirName = 'OEBPS') {
        try {
            const oebpsPath = path.join(rootDir, oebpsDirName);
            const metaInfPath = path.join(rootDir, 'META-INF');

            // Ensure directories exist
            await fs.mkdir(oebpsPath, { recursive: true });
            await fs.mkdir(metaInfPath, { recursive: true });

            // 1. Write mimetype (Root)
            await fs.writeFile(path.join(rootDir, 'mimetype'), this.generateMimetype(), 'utf8');

            // 2. Write container.xml (META-INF)
            await fs.writeFile(
                path.join(metaInfPath, 'container.xml'), 
                this.generateContainerXML(`${oebpsDirName}/content.opf`), 
                'utf8'
            );

            // 3. Write NCX (OEBPS)
            this.ncxId = 'ncx';
            const ncxFilename = 'toc.ncx';
            await fs.writeFile(path.join(oebpsPath, ncxFilename), this.generateNCX(), 'utf8');
            this.addManifestItem(this.ncxId, ncxFilename);

            // 4. Write Nav XHTML (OEBPS)
            this.navId = 'nav';
            const navFilename = 'nav.xhtml';
            await fs.writeFile(path.join(oebpsPath, navFilename), this.generateNavXHTML(), 'utf8');
            this.addManifestItem(this.navId, navFilename, 'nav');
            
            // Add Nav to Guide and Spine (usually non-linear or at the front)
            this.addGuideItem('toc', 'Table of Contents', navFilename);
            
            // Ensure nav is in spine (Apple Books prefers it in spine, usually linear=false)
            // We check if it's already there to prevent duplicates
            if (!this.spine.some(s => s.idref === this.navId)) {
                // Insert after cover if cover exists, else at start
                const insertIndex = this.spine.length > 0 && this.spine[0].idref.includes('cover') ? 1 : 0;
                this.spine.splice(insertIndex, 0, { idref: this.navId, linear: false });
            }

            // 5. Write OPF (OEBPS)
            // OPF must be written last so manifest is complete
            await fs.writeFile(path.join(oebpsPath, 'content.opf'), this.generateOPF(), 'utf8');

            return true;
        } catch (error) {
            console.error(`[EPUB Metadata] Failed to write metadata files: ${error.message}`);
            throw error;
        }
    }
}

module.exports = {
    EpubMetadataManager
};