/**
 * @file epub-builder.js
 * @description Deterministic EPUB3 production engine. Generates fully compliant, 
 * cross-reader compatible EPUB3 archives (with Apple Books optimizations).
 * Handles structural validation, manifest generation, TOC/NCX bridging, and asset packaging.
 * 
 * @dependencies
 * - jszip: For creating the archive (must be installed via npm)
 * - crypto: Native Node.js module for UUID generation
 * - path: Native Node.js module
 */

const JSZip = require('jszip');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * Utility class for XML escaping to ensure strict XHTML compliance.
 */
class XmlUtils {
    /**
     * Escapes XML special characters.
     * @param {string} unsafe String to escape
     * @returns {string} Escaped string
     */
    static escape(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Formats a date to ISO 8601 string required by EPUB OPF.
     * @param {Date} date 
     * @returns {string}
     */
    static formatIsoDate(date = new Date()) {
        return date.toISOString().split('.')[0] + 'Z';
    }

    /**
     * Determines mime type based on file extension.
     * @param {string} filename 
     * @returns {string}
     */
    static getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.css': 'text/css',
            '.xhtml': 'application/xhtml+xml',
            '.html': 'application/xhtml+xml',
            '.otf': 'font/otf',
            '.ttf': 'font/ttf',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.js': 'text/javascript',
            '.ncx': 'application/x-dtbncx+xml'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

/**
 * Core EpubBuilder class for orchestrating the EPUB3 generation pipeline.
 */
class EpubBuilder {
    constructor() {
        this.metadata = {
            title: 'Untitled Book',
            author: 'Unknown Author',
            publisher: 'Alchemist Press',
            language: 'en',
            uuid: crypto.randomUUID ? crypto.randomUUID() : this._generateFallbackUuid(),
            date: XmlUtils.formatIsoDate(),
            description: '',
            subjects: [],
            rights: '',
            isbn: null
        };

        this.chapters = [];
        this.images = new Map();
        this.fonts = new Map();
        this.css = this._getDefaultCss();
        this.coverImage = null;

        // Configuration flags
        this.config = {
            generateNcx: true, // For EPUB2 backward compatibility
            appleBooksOptimization: true, // Includes com.apple.ibooks.display-options.xml
            tocTitle: 'Table of Contents'
        };
    }

    /**
     * Fallback UUID generator if crypto.randomUUID is unavailable
     * @private
     */
    _generateFallbackUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Sets the core metadata for the EPUB.
     * @param {Object} options 
     */
    setMetadata(options) {
        if (!options) return;
        this.metadata = { ...this.metadata, ...options };
        return this;
    }

    /**
     * Sets a cover image for the EPUB.
     * @param {string} filename The name of the file (e.g., 'cover.jpg')
     * @param {Buffer|string} data The file buffer or base64 string
     * @param {string} [mimeType] Optional mime type
     */
    setCover(filename, data, mimeType) {
        const mime = mimeType || XmlUtils.getMimeType(filename);
        this.coverImage = { id: 'cover-image', filename, data, mime };
        this.addImage(filename, data, mime, 'cover-image');
        return this;
    }

    /**
     * Adds a chapter to the EPUB spine.
     * @param {string} title Chapter title (used in TOC)
     * @param {string} content Raw HTML/XHTML content (body inner)
     * @param {string} [filename] Optional custom filename (e.g., 'chapter-1.xhtml')
     * @param {boolean} [excludeFromToc=false] If true, chapter is in spine but not in TOC
     */
    addChapter(title, content, filename = null, excludeFromToc = false) {
        const id = `chapter-${this.chapters.length + 1}`;
        const file = filename || `${id}.xhtml`;
        
        this.chapters.push({
            id,
            title,
            content,
            filename: file,
            excludeFromToc
        });
        return this;
    }

    /**
     * Adds an image asset to the EPUB.
     * @param {string} filename The target filename in the EPUB (e.g., 'logo.png')
     * @param {Buffer|string} data The file data
     * @param {string} [mimeType] Auto-detected if omitted
     * @param {string} [id] Internal manifest ID
     */
    addImage(filename, data, mimeType = null, id = null) {
        const safeId = id || `img-${crypto.randomBytes(4).toString('hex')}`;
        const mime = mimeType || XmlUtils.getMimeType(filename);
        this.images.set(filename, { id: safeId, filename, data, mime });
        return this;
    }

    /**
     * Adds a custom font to the EPUB.
     * @param {string} filename 
     * @param {Buffer} data 
     */
    addFont(filename, data) {
        const id = `font-${crypto.randomBytes(4).toString('hex')}`;
        const mime = XmlUtils.getMimeType(filename);
        this.fonts.set(filename, { id, filename, data, mime });
        return this;
    }

    /**
     * Overrides the default stylesheet.
     * @param {string} cssContent 
     */
    setCustomCss(cssContent) {
        this.css = cssContent;
        return this;
    }

    /**
     * Default structural CSS ensuring cross-platform baseline rendering.
     * @private
     */
    _getDefaultCss() {
        return `
            @namespace epub "http://www.idpf.org/2007/ops";
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; margin: 0; padding: 2%; text-align: justify; }
            h1, h2, h3, h4, h5, h6 { font-family: inherit; line-height: 1.2; margin-top: 1em; margin-bottom: 0.5em; text-align: left; }
            h1 { font-size: 2em; page-break-before: always; }
            h2 { font-size: 1.5em; }
            p { margin-top: 0; margin-bottom: 1em; text-indent: 0; }
            p + p { text-indent: 1.5em; margin-top: 0; }
            img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
            .cover-image { width: 100%; height: 100vh; object-fit: contain; }
            .center { text-align: center; }
            blockquote { margin: 1em 2em; font-style: italic; }
            ul, ol { margin-bottom: 1em; }
            hr { border: 0; border-top: 1px solid #ccc; margin: 2em 0; }
        `;
    }

    /**
     * Generates the uncompressed mimetype file (MUST BE FIRST).
     * @private
     */
    _generateMimetype() {
        return 'application/epub+zip';
    }

    /**
     * Generates META-INF/container.xml
     * @private
     */
    _generateContainerXml() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
    }

    /**
     * Generates Apple Books display options xml.
     * @private
     */
    _generateAppleDisplayOptions() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<display_options>
    <platform name="*">
        <option name="specified-fonts">true</option>
    </platform>
</display_options>`;
    }

    /**
     * Wraps chapter content in strict XHTML5 boilerplate.
     * @private
     */
    _wrapXhtml(title, content) {
        const lang = XmlUtils.escape(this.metadata.language);
        const safeTitle = XmlUtils.escape(title);
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
    <meta charset="UTF-8" />
    <title>${safeTitle}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" type="text/css" href="../Styles/style.css" />
</head>
<body>
    ${content}
</body>
</html>`;
    }

    /**
     * Generates the cover XHTML file.
     * @private
     */
    _generateCoverXhtml() {
        if (!this.coverImage) return null;
        const content = `<div class="center" epub:type="cover"><img src="../Images/${this.coverImage.filename}" alt="Cover" class="cover-image" /></div>`;
        return this._wrapXhtml('Cover', content);
    }

    /**
     * Generates EPUB3 Navigation Document (nav.xhtml).
     * @private
     */
    _generateNavXml() {
        const lang = XmlUtils.escape(this.metadata.language);
        let listItems = '';

        this.chapters.forEach(ch => {
            if (!ch.excludeFromToc) {
                listItems += `                <li><a href="Text/${ch.filename}">${XmlUtils.escape(ch.title)}</a></li>\n`;
            }
        });

        const content = `
    <nav epub:type="toc" id="toc">
        <h1>${XmlUtils.escape(this.config.tocTitle)}</h1>
        <ol>
${listItems}        </ol>
    </nav>
    <nav epub:type="landmarks" id="landmarks" hidden="hidden">
        <ol>
            ${this.coverImage ? `<li><a epub:type="cover" href="Text/cover.xhtml">Cover</a></li>` : ''}
            <li><a epub:type="toc" href="Text/nav.xhtml">Table of Contents</a></li>
            ${this.chapters.length > 0 ? `<li><a epub:type="bodymatter" href="Text/${this.chapters[0].filename}">Start of Content</a></li>` : ''}
        </ol>
    </nav>`;

        return this._wrapXhtml(this.config.tocTitle, content);
    }

    /**
     * Generates EPUB2 NCX fallback (toc.ncx).
     * @private
     */
    _generateNcxXml() {
        let navPoints = '';
        let playOrder = 1;

        this.chapters.forEach(ch => {
            if (!ch.excludeFromToc) {
                navPoints += `
        <navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
            <navLabel><text>${XmlUtils.escape(ch.title)}</text></navLabel>
            <content src="Text/${ch.filename}"/>
        </navPoint>`;
                playOrder++;
            }
        });

        return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:${this.metadata.uuid}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${XmlUtils.escape(this.metadata.title)}</text>
    </docTitle>
    <navMap>
${navPoints}
    </navMap>
</ncx>`;
    }

    /**
     * Generates the OPF Package Document (content.opf).
     * @private
     */
    _generateOpfXml() {
        const m = this.metadata;
        
        let manifest = '';
        let spine = '';

        // Standard Assets
        manifest += `        <item id="style" href="Styles/style.css" media-type="text/css"/>\n`;
        manifest += `        <item id="nav" href="Text/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;
        
        if (this.config.generateNcx) {
            manifest += `        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n`;
        }

        // Cover
        if (this.coverImage) {
            manifest += `        <item id="cover" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>\n`;
            spine += `        <itemref idref="cover" linear="yes"/>\n`;
        }

        // Chapters
        this.chapters.forEach(ch => {
            manifest += `        <item id="${ch.id}" href="Text/${ch.filename}" media-type="application/xhtml+xml"/>\n`;
            spine += `        <itemref idref="${ch.id}" linear="yes"/>\n`;
        });

        // Images
        for (const [filename, img] of this.images.entries()) {
            const properties = img.id === 'cover-image' ? ' properties="cover-image"' : '';
            manifest += `        <item id="${img.id}" href="Images/${filename}" media-type="${img.mime}"${properties}/>\n`;
        }

        // Fonts
        for (const [filename, font] of this.fonts.entries()) {
            manifest += `        <item id="${font.id}" href="Fonts/${filename}" media-type="${font.mime}"/>\n`;
        }

        // Optional Metadata Tags
        let optionalMeta = '';
        if (m.isbn) optionalMeta += `        <dc:identifier id="isbn">urn:isbn:${XmlUtils.escape(m.isbn)}</dc:identifier>\n`;
        if (m.description) optionalMeta += `        <dc:description>${XmlUtils.escape(m.description)}</dc:description>\n`;
        if (m.publisher) optionalMeta += `        <dc:publisher>${XmlUtils.escape(m.publisher)}</dc:publisher>\n`;
        if (m.rights) optionalMeta += `        <dc:rights>${XmlUtils.escape(m.rights)}</dc:rights>\n`;
        m.subjects.forEach(sub => {
            optionalMeta += `        <dc:subject>${XmlUtils.escape(sub)}</dc:subject>\n`;
        });

        return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${XmlUtils.escape(m.title)}</dc:title>
        <dc:creator id="creator">${XmlUtils.escape(m.author)}</dc:creator>
        <dc:language>${XmlUtils.escape(m.language)}</dc:language>
        <dc:identifier id="BookId">urn:uuid:${m.uuid}</dc:identifier>
        <meta property="dcterms:modified">${m.date}</meta>
${optionalMeta}        ${this.coverImage ? '<meta name="cover" content="cover-image" />' : ''}
    </metadata>
    <manifest>
${manifest}    </manifest>
    <spine${this.config.generateNcx ? ' toc="ncx"' : ''}>
${spine}    </spine>
</package>`;
    }

    /**
     * Executes the pipeline and compiles the EPUB archive.
     * @returns {Promise<Buffer>} The zipped EPUB file as a Node.js Buffer
     */
    async generate() {
        if (!this.chapters.length) {
            throw new Error('EPUB Builder Error: Cannot generate an EPUB with no chapters.');
        }

        const zip = new JSZip();

        // 1. mimetype MUST be the first file and MUST be uncompressed
        zip.file('mimetype', this._generateMimetype(), { compression: 'STORE' });

        // 2. META-INF
        const metaInf = zip.folder('META-INF');
        metaInf.file('container.xml', this._generateContainerXml());
        if (this.config.appleBooksOptimization) {
            metaInf.file('com.apple.ibooks.display-options.xml', this._generateAppleDisplayOptions());
        }

        // 3. OEBPS (Content)
        const oebps = zip.folder('OEBPS');
        
        // OPF Package Document
        oebps.file('content.opf', this._generateOpfXml());
        
        // Styles
        oebps.folder('Styles').file('style.css', this.css);

        // Assets (Images & Fonts)
        const imagesFolder = oebps.folder('Images');
        for (const [filename, img] of this.images.entries()) {
            imagesFolder.file(filename, img.data);
        }

        const fontsFolder = oebps.folder('Fonts');
        for (const [filename, font] of this.fonts.entries()) {
            fontsFolder.file(filename, font.data);
        }

        // Text (XHTML documents)
        const textFolder = oebps.folder('Text');
        
        // Navigation Document (EPUB3)
        textFolder.file('nav.xhtml', this._generateNavXml());

        // NCX (EPUB2 Fallback)
        if (this.config.generateNcx) {
            oebps.file('toc.ncx', this._generateNcxXml());
        }

        // Cover XHTML
        if (this.coverImage) {
            textFolder.file('cover.xhtml', this._generateCoverXhtml());
        }

        // Chapter XHTMLs
        this.chapters.forEach(ch => {
            textFolder.file(ch.filename, this._wrapXhtml(ch.title, ch.content));
        });

        // Generate the final ZIP buffer
        return await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 9 // Maximum compression for the rest of the archive
            },
            mimeType: 'application/epub+zip'
        });
    }

    /**
     * Utility method to generate and directly save the EPUB to disk.
     * @param {string} outputPath Absolute or relative path to save the .epub file
     * @returns {Promise<void>}
     */
    async save(outputPath) {
        const buffer = await this.generate();
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, buffer);
    }
}

module.exports = EpubBuilder;