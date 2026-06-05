/**
 * @file epub-reader.js
 * @description Advanced EPUB Parsing and Rendering Engine for Alchemist App.
 * Provides a robust, standalone foundation for a Kindle-like reading experience,
 * handling EPUB unzipping, metadata extraction, manifest resolution, spine navigation,
 * and DOM-based rendering of chapter contents.
 * 
 * @dependencies JSZip (expected to be available globally or passed to the constructor)
 * @environment Browser (relies on DOMParser, Blob, URL, and DOM manipulation)
 */

/**
 * Standard XML namespaces used in EPUB documents.
 * @constant {Object}
 */
const EPUB_NAMESPACES = {
    container: "urn:oasis:names:tc:opendocument:xmlns:container",
    opf: "http://www.idpf.org/2007/opf",
    dc: "http://purl.org/dc/elements/1.1/",
    ncx: "http://www.daisy.org/z3986/2005/ncx/",
    xhtml: "http://www.w3.org/1999/xhtml",
    epub: "http://www.idpf.org/2007/ops"
};

/**
 * Custom Error class for EPUB processing exceptions.
 */
export class EpubError extends Error {
    /**
     * @param {string} message - Error description
     * @param {string} [code] - Internal error code
     */
    constructor(message, code = 'EPUB_GENERAL_ERROR') {
        super(message);
        this.name = 'EpubError';
        this.code = code;
    }
}

/**
 * Utility functions for EPUB processing.
 */
export class EpubUtils {
    /**
     * Resolves a relative path against a base path.
     * @param {string} basePath - The absolute path of the base file (e.g., OEBPS/content.opf)
     * @param {string} relativePath - The relative path to resolve (e.g., ../images/cover.jpg)
     * @returns {string} The resolved absolute path within the EPUB archive.
     */
    static resolvePath(basePath, relativePath) {
        if (!basePath) return relativePath;
        if (relativePath.startsWith('/')) return relativePath.substring(1);
        
        const baseParts = basePath.split('/');
        baseParts.pop(); // Remove the filename
        
        const relativeParts = relativePath.split('/');
        
        for (const part of relativeParts) {
            if (part === '.') continue;
            if (part === '..') {
                if (baseParts.length > 0) {
                    baseParts.pop();
                }
            } else {
                baseParts.push(part);
            }
        }
        
        return baseParts.join('/');
    }

    /**
     * Parses an XML string into a DOM Document.
     * @param {string} xmlString - The raw XML string.
     * @param {string} mimeType - The mime type, defaults to "application/xml"
     * @returns {Document} The parsed XML document.
     * @throws {EpubError} If parsing fails.
     */
    static parseXML(xmlString, mimeType = "application/xml") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, mimeType);
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            throw new EpubError(`XML Parsing Error: ${parserError.textContent}`, 'XML_PARSE_ERROR');
        }
        return doc;
    }

    /**
     * Gets the text content of a namespaced XML node.
     * @param {Document|Element} doc - The XML document or element.
     * @param {string} namespaceURI - The namespace URI.
     * @param {string} localName - The local tag name.
     * @returns {string|null} The text content, or null if not found.
     */
    static getNsText(doc, namespaceURI, localName) {
        const elements = doc.getElementsByTagNameNS(namespaceURI, localName);
        return elements.length > 0 ? elements[0].textContent.trim() : null;
    }
}

/**
 * Represents the unzipped EPUB archive.
 * Abstracts the underlying zip library (e.g., JSZip).
 */
export class EpubArchive {
    /**
     * @param {Object} zipInstance - An instantiated JSZip object containing the loaded EPUB.
     */
    constructor(zipInstance) {
        if (!zipInstance) {
            throw new EpubError("A valid zip instance (e.g., JSZip) must be provided.", "ZIP_MISSING");
        }
        this.zip = zipInstance;
    }

    /**
     * Checks if a file exists in the archive.
     * @param {string} path - Path to the file in the archive.
     * @returns {boolean} True if the file exists.
     */
    fileExists(path) {
        return this.zip.file(path) !== null;
    }

    /**
     * Retrieves a file from the archive as a string.
     * @param {string} path - Path to the file.
     * @returns {Promise<string>} The file contents as a string.
     */
    async getText(path) {
        const file = this.zip.file(path);
        if (!file) throw new EpubError(`File not found in archive: ${path}`, 'FILE_NOT_FOUND');
        return await file.async("string");
    }

    /**
     * Retrieves a file from the archive as a Blob.
     * @param {string} path - Path to the file.
     * @param {string} mimeType - The mime type for the blob.
     * @returns {Promise<Blob>} The file contents as a Blob.
     */
    async getBlob(path, mimeType = "application/octet-stream") {
        const file = this.zip.file(path);
        if (!file) throw new EpubError(`File not found in archive: ${path}`, 'FILE_NOT_FOUND');
        const arrayBuffer = await file.async("arraybuffer");
        return new Blob([arrayBuffer], { type: mimeType });
    }

    /**
     * Generates a temporary object URL for a file in the archive.
     * Useful for rendering images or stylesheets directly in the DOM.
     * @param {string} path - Path to the file.
     * @param {string} mimeType - The mime type of the file.
     * @returns {Promise<string>} The Object URL (blob://...)
     */
    async getObjectUrl(path, mimeType) {
        const blob = await this.getBlob(path, mimeType);
        return URL.createObjectURL(blob);
    }
}

/**
 * Core EPUB Parser Engine.
 * Responsible for reading the EPUB structure, metadata, manifest, and spine.
 */
export class EpubParser {
    /**
     * @param {EpubArchive} archive - The initialized EPUB archive wrapper.
     */
    constructor(archive) {
        this.archive = archive;
        this.containerPath = "META-INF/container.xml";
        this.opfPath = null;
        this.opfDoc = null;
        
        // Parsed Data Structures
        this.metadata = {};
        this.manifest = {}; // id -> { href, mediaType, properties }
        this.spine = [];    // Array of idrefs
        this.toc = [];      // Table of contents structure
        this.coverPath = null;
    }

    /**
     * Initiates the parsing pipeline.
     * @returns {Promise<EpubParser>} Returns self for chaining.
     */
    async parse() {
        console.log("[EpubParser] Starting EPUB parsing pipeline...");
        await this.parseContainer();
        await this.parseOpf();
        await this.parseNcxOrNav();
        console.log("[EpubParser] EPUB parsing complete.");
        return this;
    }

    /**
     * Step 1: Read META-INF/container.xml to find the rootfile (content.opf).
     * @private
     */
    async parseContainer() {
        console.log(`[EpubParser] Reading ${this.containerPath}...`);
        try {
            const containerXml = await this.archive.getText(this.containerPath);
            const doc = EpubUtils.parseXML(containerXml);
            
            const rootfiles = doc.getElementsByTagNameNS(EPUB_NAMESPACES.container, "rootfile");
            if (rootfiles.length === 0) {
                throw new EpubError("No rootfile element found in container.xml", "INVALID_CONTAINER");
            }

            // Find the OPF file (media-type="application/oebps-package+xml")
            for (let i = 0; i < rootfiles.length; i++) {
                const mediaType = rootfiles[i].getAttribute("media-type");
                if (mediaType === "application/oebps-package+xml") {
                    this.opfPath = rootfiles[i].getAttribute("full-path");
                    break;
                }
            }

            if (!this.opfPath) {
                throw new EpubError("No OPF rootfile found in container.xml", "OPF_NOT_FOUND");
            }
            
            console.log(`[EpubParser] Found OPF path: ${this.opfPath}`);
        } catch (err) {
            throw new EpubError(`Failed to parse container.xml: ${err.message}`, "CONTAINER_PARSE_FAILED");
        }
    }

    /**
     * Step 2: Read and parse the OPF file (metadata, manifest, spine).
     * @private
     */
    async parseOpf() {
        console.log(`[EpubParser] Reading OPF file: ${this.opfPath}...`);
        const opfXml = await this.archive.getText(this.opfPath);
        this.opfDoc = EpubUtils.parseXML(opfXml);

        this.extractMetadata();
        this.extractManifest();
        this.extractSpine();
    }

    /**
     * Extracts Dublin Core metadata from the OPF document.
     * @private
     */
    extractMetadata() {
        const metadataNode = this.opfDoc.getElementsByTagNameNS(EPUB_NAMESPACES.opf, "metadata")[0];
        if (!metadataNode) return;

        this.metadata = {
            title: EpubUtils.getNsText(metadataNode, EPUB_NAMESPACES.dc, "title") || "Unknown Title",
            creator: EpubUtils.getNsText(metadataNode, EPUB_NAMESPACES.dc, "creator") || "Unknown Author",
            language: EpubUtils.getNsText(metadataNode, EPUB_NAMESPACES.dc, "language") || "en",
            identifier: EpubUtils.getNsText(metadataNode, EPUB_NAMESPACES.dc, "identifier") || "",
            publisher: EpubUtils.getNsText(metadataNode, EPUB_NAMESPACES.dc, "publisher") || "",
            description: EpubUtils.getNsText(metadataNode, EPUB_NAMESPACES.dc, "description") || "",
        };

        // Extract Cover Image Path from meta tags (EPUB 2) or properties (EPUB 3)
        const metaTags = metadataNode.getElementsByTagNameNS(EPUB_NAMESPACES.opf, "meta");
        let coverId = null;
        for (let i = 0; i < metaTags.length; i++) {
            if (metaTags[i].getAttribute("name") === "cover") {
                coverId = metaTags[i].getAttribute("content");
                break;
            }
        }
        this.metadata.coverId = coverId;
    }

    /**
     * Extracts the manifest items (list of all files in the EPUB).
     * @private
     */
    extractManifest() {
        const manifestNode = this.opfDoc.getElementsByTagNameNS(EPUB_NAMESPACES.opf, "manifest")[0];
        if (!manifestNode) throw new EpubError("No manifest found in OPF", "INVALID_OPF");

        const items = manifestNode.getElementsByTagNameNS(EPUB_NAMESPACES.opf, "item");
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            const mediaType = item.getAttribute("media-type");
            const properties = item.getAttribute("properties") || "";

            this.manifest[id] = {
                id,
                href: EpubUtils.resolvePath(this.opfPath, href),
                mediaType,
                properties
            };

            // EPUB 3 cover image detection
            if (properties.includes("cover-image")) {
                this.coverPath = this.manifest[id].href;
            }
        }

        // Fallback to EPUB 2 cover image detection
        if (!this.coverPath && this.metadata.coverId && this.manifest[this.metadata.coverId]) {
            this.coverPath = this.manifest[this.metadata.coverId].href;
        }
    }

    /**
     * Extracts the spine (linear reading order).
     * @private
     */
    extractSpine() {
        const spineNode = this.opfDoc.getElementsByTagNameNS(EPUB_NAMESPACES.opf, "spine")[0];
        if (!spineNode) throw new EpubError("No spine found in OPF", "INVALID_OPF");

        this.spineTocId = spineNode.getAttribute("toc"); // For EPUB 2 NCX

        const itemrefs = spineNode.getElementsByTagNameNS(EPUB_NAMESPACES.opf, "itemref");
        for (let i = 0; i < itemrefs.length; i++) {
            const idref = itemrefs[i].getAttribute("idref");
            const linear = itemrefs[i].getAttribute("linear") !== "no";
            
            if (this.manifest[idref]) {
                this.spine.push({
                    idref,
                    linear,
                    manifestItem: this.manifest[idref]
                });
            }
        }
    }

    /**
     * Step 3: Parse the Table of Contents (NCX for EPUB 2, NAV for EPUB 3).
     * @private
     */
    async parseNcxOrNav() {
        // Try EPUB 3 NAV first
        const navItem = Object.values(this.manifest).find(item => item.properties.includes("nav"));
        if (navItem) {
            console.log("[EpubParser] Found EPUB 3 NAV document.");
            await this.parseEpub3Nav(navItem.href);
            return;
        }

        // Fallback to EPUB 2 NCX
        if (this.spineTocId && this.manifest[this.spineTocId]) {
            console.log("[EpubParser] Found EPUB 2 NCX document.");
            await this.parseEpub2Ncx(this.manifest[this.spineTocId].href);
            return;
        }

        console.warn("[EpubParser] No TOC (NAV or NCX) found.");
    }

    /**
     * Parses an EPUB 2 NCX file.
     * @param {string} ncxPath - Path to the NCX file.
     * @private
     */
    async parseEpub2Ncx(ncxPath) {
        const ncxXml = await this.archive.getText(ncxPath);
        const doc = EpubUtils.parseXML(ncxXml);
        const navMap = doc.getElementsByTagNameNS(EPUB_NAMESPACES.ncx, "navMap")[0];
        
        if (!navMap) return;

        const parseNavPoints = (parentNode) => {
            const points = [];
            const childNodes = Array.from(parentNode.childNodes).filter(n => n.localName === "navPoint");
            
            for (const node of childNodes) {
                const textNode = node.getElementsByTagNameNS(EPUB_NAMESPACES.ncx, "text")[0];
                const contentNode = node.getElementsByTagNameNS(EPUB_NAMESPACES.ncx, "content")[0];
                
                if (textNode && contentNode) {
                    points.push({
                        label: textNode.textContent.trim(),
                        href: EpubUtils.resolvePath(ncxPath, contentNode.getAttribute("src")),
                        subitems: parseNavPoints(node)
                    });
                }
            }
            return points;
        };

        this.toc = parseNavPoints(navMap);
    }

    /**
     * Parses an EPUB 3 NAV document.
     * @param {string} navPath - Path to the NAV file.
     * @private
     */
    async parseEpub3Nav(navPath) {
        const navHtml = await this.archive.getText(navPath);
        const doc = EpubUtils.parseXML(navHtml, "application/xhtml+xml");
        
        // Find the <nav epub:type="toc"> element
        const navs = doc.getElementsByTagNameNS(EPUB_NAMESPACES.xhtml, "nav");
        let tocNav = null;
        for (let i = 0; i < navs.length; i++) {
            if (navs[i].getAttributeNS(EPUB_NAMESPACES.epub, "type") === "toc" || 
                navs[i].getAttribute("epub:type") === "toc") {
                tocNav = navs[i];
                break;
            }
        }

        if (!tocNav) return;

        const parseOl = (olNode) => {
            const points = [];
            const lis = Array.from(olNode.childNodes).filter(n => n.localName === "li");
            
            for (const li of lis) {
                const a = Array.from(li.childNodes).find(n => n.localName === "a");
                const nestedOl = Array.from(li.childNodes).find(n => n.localName === "ol");
                
                if (a) {
                    points.push({
                        label: a.textContent.trim(),
                        href: EpubUtils.resolvePath(navPath, a.getAttribute("href")),
                        subitems: nestedOl ? parseOl(nestedOl) : []
                    });
                }
            }
            return points;
        };

        const rootOl = Array.from(tocNav.childNodes).find(n => n.localName === "ol");
        if (rootOl) {
            this.toc = parseOl(rootOl);
        }
    }
}

/**
 * EPUB Rendering Engine.
 * Manages the DOM injection, asset resolution, and navigation for reading.
 */
export class EpubRenderer {
    /**
     * @param {EpubParser} parser - The parsed EPUB data.
     * @param {HTMLElement} containerElement - The DOM element where the book will be rendered.
     */
    constructor(parser, containerElement) {
        if (!parser || !containerElement) {
            throw new EpubError("Parser and container element are required for renderer.", "RENDERER_INIT_FAILED");
        }
        
        this.parser = parser;
        this.container = containerElement;
        this.currentSpineIndex = 0;
        
        // Caching Object URLs to prevent memory leaks
        this.objectUrlCache = new Set();
        
        // Setup container styling for continuous or paginated reading
        this.setupContainer();
    }

    /**
     * Configures the base styles for the rendering container.
     * @private
     */
    setupContainer() {
        this.container.style.overflowX = 'hidden';
        this.container.style.overflowY = 'auto';
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        
        // Create an iframe to sandbox the EPUB content and prevent CSS bleed
        this.iframe = document.createElement('iframe');
        this.iframe.style.width = '100%';
        this.iframe.style.height = '100%';
        this.iframe.style.border = 'none';
        this.iframe.sandbox = "allow-same-origin allow-scripts"; // Restrict capabilities
        this.container.appendChild(this.iframe);
    }

    /**
     * Clears all generated Object URLs to free memory.
     * @private
     */
    cleanupCache() {
        for (const url of this.objectUrlCache) {
            URL.revokeObjectURL(url);
        }
        this.objectUrlCache.clear();
    }

    /**
     * Injects custom CSS into the iframe for reader customization (e.g., dark mode, font size).
     * @param {string} css - The CSS string to inject.
     */
    injectCustomStyles(css) {
        if (!this.iframe.contentDocument) return;
        let styleEl = this.iframe.contentDocument.getElementById('alchemist-reader-styles');
        if (!styleEl) {
            styleEl = this.iframe.contentDocument.createElement('style');
            styleEl.id = 'alchemist-reader-styles';
            this.iframe.contentDocument.head.appendChild(styleEl);
        }
        styleEl.textContent = css;
    }

    /**
     * Renders a specific spine item by index.
     * @param {number} index - The index of the spine array.
     * @returns {Promise<void>}
     */
    async displayChapter(index) {
        if (index < 0 || index >= this.parser.spine.length) {
            console.warn("[EpubRenderer] Spine index out of bounds.");
            return;
        }

        this.currentSpineIndex = index;
        const spineItem = this.parser.spine[index];
        const manifestItem = spineItem.manifestItem;

        console.log(`[EpubRenderer] Displaying chapter: ${manifestItem.href}`);

        try {
            // 1. Get raw HTML/XHTML content
            let htmlContent = await this.parser.archive.getText(manifestItem.href);
            
            // 2. Parse into a DOM to manipulate assets
            const doc = EpubUtils.parseXML(htmlContent, "text/html");

            // 3. Resolve internal links, images, and stylesheets
            await this.resolveAssets(doc, manifestItem.href);

            // 4. Inject into iframe
            this.iframe.srcdoc = doc.documentElement.outerHTML;
            
            // Wait for iframe to load before applying custom styles
            this.iframe.onload = () => {
                this.injectCustomStyles(`
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        line-height: 1.6;
                        padding: 5%;
                        max-width: 800px;
                        margin: 0 auto;
                        word-wrap: break-word;
                    }
                    img { max-width: 100%; height: auto; }
                `);
                
                // Dispatch event for UI updates (e.g., progress bar)
                const event = new CustomEvent('chapterRendered', { 
                    detail: { index: this.currentSpineIndex, total: this.parser.spine.length }
                });
                this.container.dispatchEvent(event);
            };

        } catch (err) {
            console.error(`[EpubRenderer] Error rendering chapter:`, err);
            this.iframe.srcdoc = `<html><body><h2>Error loading chapter</h2><p>${err.message}</p></body></html>`;
        }
    }

    /**
     * Resolves relative paths for images, stylesheets, and links within the chapter DOM.
     * Replaces them with Blob URLs generated from the EPUB archive.
     * @param {Document} doc - The chapter DOM document.
     * @param {string} chapterPath - The absolute path of the chapter file in the archive.
     * @private
     */
    async resolveAssets(doc, chapterPath) {
        this.cleanupCache(); // Clear previous chapter's blobs

        // Resolve Images
        const images = doc.querySelectorAll('img, image');
        for (const img of images) {
            const srcAttr = img.tagName.toLowerCase() === 'image' ? 'xlink:href' : 'src';
            const src = img.getAttribute(srcAttr);
            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                const absolutePath = EpubUtils.resolvePath(chapterPath, src);
                try {
                    // Find mime type from manifest
                    const manifestEntry = Object.values(this.parser.manifest).find(m => m.href === absolutePath);
                    const mimeType = manifestEntry ? manifestEntry.mediaType : "image/jpeg";
                    
                    const blobUrl = await this.parser.archive.getObjectUrl(absolutePath, mimeType);
                    img.setAttribute(srcAttr, blobUrl);
                    this.objectUrlCache.add(blobUrl);
                } catch (e) {
                    console.warn(`[EpubRenderer] Could not resolve image: ${absolutePath}`);
                }
            }
        }

        // Resolve Stylesheets
        const links = doc.querySelectorAll('link[rel="stylesheet"]');
        for (const link of links) {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http')) {
                const absolutePath = EpubUtils.resolvePath(chapterPath, href);
                try {
                    const blobUrl = await this.parser.archive.getObjectUrl(absolutePath, "text/css");
                    link.setAttribute('href', blobUrl);
                    this.objectUrlCache.add(blobUrl);
                } catch (e) {
                    console.warn(`[EpubRenderer] Could not resolve stylesheet: ${absolutePath}`);
                }
            }
        }

        // Resolve Internal Links (Anchor tags)
        const anchors = doc.querySelectorAll('a[href]');
        for (const a of anchors) {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                // Intercept internal clicks to use JS navigation instead of default browser behavior
                a.onclick = (e) => {
                    e.preventDefault();
                    this.handleInternalLink(chapterPath, href);
                };
            }
        }
    }

    /**
     * Handles clicks on internal cross-references.
     * @param {string} currentChapterPath - Path of the currently viewed chapter.
     * @param {string} targetHref - The href attribute of the clicked link.
     * @private
     */
    handleInternalLink(currentChapterPath, targetHref) {
        const [targetPath, fragment] = targetHref.split('#');
        const absoluteTargetPath = EpubUtils.resolvePath(currentChapterPath, targetPath);

        // Find which spine item contains this path
        const targetSpineIndex = this.parser.spine.findIndex(item => item.manifestItem.href === absoluteTargetPath);
        
        if (targetSpineIndex !== -1) {
            this.displayChapter(targetSpineIndex).then(() => {
                // If there's a fragment identifier, scroll to it after rendering
                if (fragment && this.iframe.contentDocument) {
                    const targetElement = this.iframe.contentDocument.getElementById(fragment) 
                                       || this.iframe.contentDocument.querySelector(`[name="${fragment}"]`);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        } else {
            console.warn(`[EpubRenderer] Target link not found in spine: ${absoluteTargetPath}`);
        }
    }

    /**
     * Navigates to the next chapter in the spine.
     */
    next() {
        if (this.currentSpineIndex < this.parser.spine.length - 1) {
            this.displayChapter(this.currentSpineIndex + 1);
        }
    }

    /**
     * Navigates to the previous chapter in the spine.
     */
    prev() {
        if (this.currentSpineIndex > 0) {
            this.displayChapter(this.currentSpineIndex - 1);
        }
    }

    /**
     * Retrieves the Table of Contents for UI rendering.
     * @returns {Array} Array of TOC objects { label, href, subitems }
     */
    getToc() {
        return this.parser.toc;
    }

    /**
     * Retrieves book metadata.
     * @returns {Object} Title, author, etc.
     */
    getMetadata() {
        return this.parser.metadata;
    }
}

/**
 * Main Facade Class for initializing the Reader.
 * Usage:
 *   const reader = new EpubReader(jsZipInstance, containerDiv);
 *   await reader.load();
 */
export default class EpubReader {
    /**
     * @param {Object} zipLibraryInstance - Instance of JSZip containing the epub file data.
     * @param {HTMLElement} containerElement - The DOM element to render the book into.
     */
    constructor(zipLibraryInstance, containerElement) {
        this.archive = new EpubArchive(zipLibraryInstance);
        this.parser = new EpubParser(this.archive);
        this.renderer = null;
        this.containerElement = containerElement;
    }

    /**
     * Loads the EPUB, parses metadata, and initializes the renderer.
     * @returns {Promise<void>}
     */
    async load() {
        await this.parser.parse();
        this.renderer = new EpubRenderer(this.parser, this.containerElement);
        
        // Automatically display the first linear chapter
        const firstLinearIndex = this.parser.spine.findIndex(item => item.linear);
        if (firstLinearIndex !== -1) {
            await this.renderer.displayChapter(firstLinearIndex);
        } else if (this.parser.spine.length > 0) {
            await this.renderer.displayChapter(0);
        }
    }
}