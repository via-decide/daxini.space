/**
 * @file core/epub-toc.js
 * @description Advanced Table of Contents (TOC) and Navigation System for EPUB3 with EPUB2 (NCX) fallback.
 * This module parses chapter structures, generates hierarchical TOCs, and outputs cross-reader
 * compatible navigation documents (nav.xhtml and toc.ncx) to ensure seamless navigation on all
 * devices, including stringent parsers like Apple Books.
 * 
 * @module core/epub-toc
 * @version 3.0.0
 */

'use strict';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escapes special characters for XML to prevent parsing errors.
 * 
 * @param {string} str - The string to escape.
 * @returns {string} The escaped XML-safe string.
 */
function escapeXml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generates a standard RFC4122 version 4 UUID.
 * Used for NCX unique identifiers when one is not provided.
 * 
 * @returns {string} A valid UUID string.
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ============================================================================
// CORE CLASSES
// ============================================================================

/**
 * Represents a single node (entry) within the Table of Contents tree.
 * 
 * @class TocNode
 */
class TocNode {
    /**
     * @param {Object} params - Node parameters.
     * @param {string} params.title - The display title of the TOC entry.
     * @param {string} params.target - The href/src target (e.g., 'chapter1.xhtml#sec-1').
     * @param {number} [params.level=1] - The hierarchical level (1 is top level).
     * @param {string} [params.id] - Optional unique identifier for the node.
     */
    constructor({ title, target, level = 1, id = null }) {
        if (!title || !target) {
            throw new Error('TocNode requires both a title and a target.');
        }
        
        this.title = title;
        this.target = target;
        this.level = parseInt(level, 10) || 1;
        this.id = id || `toc-node-${generateUUID().substring(0, 8)}`;
        this.children = [];
        this.playOrder = 0; // Assigned during NCX generation
    }

    /**
     * Adds a child node to this node.
     * 
     * @param {TocNode} node - The child node to add.
     */
    addChild(node) {
        if (!(node instanceof TocNode)) {
            throw new TypeError('Child must be an instance of TocNode');
        }
        this.children.push(node);
    }

    /**
     * Checks if the node has children.
     * 
     * @returns {boolean} True if the node has children.
     */
    hasChildren() {
        return this.children.length > 0;
    }
}

/**
 * Represents a Landmark entry for the EPUB3 landmarks nav.
 * 
 * @class LandmarkNode
 */
class LandmarkNode {
    /**
     * @param {Object} params - Landmark parameters.
     * @param {string} params.type - The epub:type (e.g., 'cover', 'toc', 'bodymatter').
     * @param {string} params.title - Display title for the landmark.
     * @param {string} params.target - The href/src target.
     */
    constructor({ type, title, target }) {
        if (!type || !title || !target) {
            throw new Error('LandmarkNode requires type, title, and target.');
        }
        this.type = type;
        this.title = title;
        this.target = target;
    }
}

/**
 * Main Orchestrator for EPUB Navigation generation.
 * Handles parsing flat chapter structures into trees, generating EPUB3 nav.xhtml,
 * and generating EPUB2 toc.ncx fallbacks.
 * 
 * @class EpubNavigationSystem
 */
class EpubNavigationSystem {
    /**
     * @param {Object} metadata - Book metadata required for navigation docs.
     * @param {string} metadata.title - The title of the book.
     * @param {string} [metadata.language='en'] - The language of the book.
     * @param {string} [metadata.uid] - The unique identifier of the book (ISBN, UUID, etc.).
     * @param {string} [metadata.creator] - The author or creator of the book.
     */
    constructor(metadata = {}) {
        this.title = metadata.title || 'Untitled Book';
        this.language = metadata.language || 'en';
        this.uid = metadata.uid || `urn:uuid:${generateUUID()}`;
        this.creator = metadata.creator || 'Unknown Author';
        
        this.headings = [];     // Flat list of headings before tree compilation
        this.landmarks = [];    // List of LandmarkNodes
        this.pageList = [];     // Array of { name, target } for page-list nav
        
        this.tocTree = [];      // Compiled hierarchical tree
        this._playOrderCounter = 1; // Internal counter for NCX playOrder
    }

    // ------------------------------------------------------------------------
    // DATA INGESTION METHODS
    // ------------------------------------------------------------------------

    /**
     * Adds a heading to the navigation structure. Headings are added in document order.
     * 
     * @param {string} title - The display text for the TOC.
     * @param {string} target - The file path and fragment (e.g., 'ch01.html#sec1').
     * @param {number} [level=1] - The nesting level (e.g., 1 for H1, 2 for H2).
     * @param {string} [id] - Optional custom ID for the navigation point.
     * @returns {EpubNavigationSystem} Returns self for chaining.
     */
    addHeading(title, target, level = 1, id = null) {
        const node = new TocNode({ title, target, level, id });
        this.headings.push(node);
        return this;
    }

    /**
     * Parses a structured array of chapters/headings and ingests them.
     * 
     * @param {Array<Object>} structure - Array of heading objects { title, target, level, id }.
     * @returns {EpubNavigationSystem} Returns self for chaining.
     */
    parseStructure(structure) {
        if (!Array.isArray(structure)) {
            throw new TypeError('Structure must be an array of heading objects.');
        }

        structure.forEach(item => {
            this.addHeading(item.title, item.target, item.level, item.id);
        });

        return this;
    }

    /**
     * Adds a structural landmark (epub:type="landmarks").
     * Recommended types: 'cover', 'frontmatter', 'bodymatter', 'backmatter', 'toc'.
     * 
     * @param {string} type - The epub:type identifier.
     * @param {string} title - Human readable title.
     * @param {string} target - Target file/fragment.
     * @returns {EpubNavigationSystem} Returns self for chaining.
     */
    addLandmark(type, title, target) {
        this.landmarks.push(new LandmarkNode({ type, title, target }));
        return this;
    }

    /**
     * Adds a page break marker for the page-list navigation.
     * Useful for fixed-layout mapping or academic referencing.
     * 
     * @param {string|number} pageNumber - The page number/identifier.
     * @param {string} target - The target file/fragment.
     * @returns {EpubNavigationSystem} Returns self for chaining.
     */
    addPageBreak(pageNumber, target) {
        this.pageList.push({ name: String(pageNumber), target });
        return this;
    }

    // ------------------------------------------------------------------------
    // PROCESSING METHODS
    // ------------------------------------------------------------------------

    /**
     * Compiles the flat list of headings into a hierarchical tree based on levels.
     * Handles missing intermediate levels gracefully.
     * 
     * @returns {Array<TocNode>} The compiled tree structure.
     */
    buildTree() {
        if (this.headings.length === 0) return [];

        const tree = [];
        const stack = [];

        this.headings.forEach(node => {
            // If stack is empty, it's a root node
            if (stack.length === 0) {
                tree.push(node);
                stack.push(node);
                return;
            }

            let parent = stack[stack.length - 1];

            // If current node level is greater than parent, it's a child
            if (node.level > parent.level) {
                parent.addChild(node);
                stack.push(node);
            } else {
                // Pop the stack until we find a parent with a lower level
                while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
                    stack.pop();
                }

                if (stack.length === 0) {
                    // It's a new root node
                    tree.push(node);
                    stack.push(node);
                } else {
                    // Add to the found parent
                    parent = stack[stack.length - 1];
                    parent.addChild(node);
                    stack.push(node);
                }
            }
        });

        this.tocTree = tree;
        return this.tocTree;
    }

    // ------------------------------------------------------------------------
    // EPUB3 NAV.XHTML GENERATION
    // ------------------------------------------------------------------------

    /**
     * Generates the EPUB3 nav.xhtml document string.
     * Includes TOC, Landmarks, and PageList (if defined).
     * 
     * @returns {string} The complete, valid XHTML string for nav.xhtml.
     */
    generateNavDocument() {
        // Ensure tree is built
        if (this.tocTree.length === 0 && this.headings.length > 0) {
            this.buildTree();
        }

        const titleEscaped = escapeXml(this.title);
        
        let xhtml = `<?xml version="1.0" encoding="utf-8"?>\n`;
        xhtml += `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(this.language)}" xml:lang="${escapeXml(this.language)}">\n`;
        xhtml += `<head>\n`;
        xhtml += `    <title>${titleEscaped} - Table of Contents</title>\n`;
        xhtml += `    <meta charset="utf-8" />\n`;
        // Include a standard styling hook
        xhtml += `    <style type="text/css">\n`;
        xhtml += `        nav#toc { font-family: sans-serif; }\n`;
        xhtml += `        nav#toc ol { list-style-type: none; padding-left: 1.5em; }\n`;
        xhtml += `        nav#toc > ol { padding-left: 0; }\n`;
        xhtml += `        nav#toc a { text-decoration: none; color: inherit; }\n`;
        xhtml += `        nav#landmarks { display: none; } /* Hidden by default in reading view */\n`;
        xhtml += `    </style>\n`;
        xhtml += `</head>\n`;
        xhtml += `<body>\n\n`;

        // 1. Primary TOC Navigation
        xhtml += `    <nav epub:type="toc" id="toc" role="doc-toc">\n`;
        xhtml += `        <h1>Table of Contents</h1>\n`;
        if (this.tocTree.length > 0) {
            xhtml += this._buildNavOl(this.tocTree, 2);
        } else {
            xhtml += `        <ol>\n            <li><a href="text/content.xhtml">Start Reading</a></li>\n        </ol>\n`;
        }
        xhtml += `    </nav>\n\n`;

        // 2. Landmarks Navigation (Crucial for Apple Books)
        if (this.landmarks.length > 0) {
            xhtml += `    <nav epub:type="landmarks" id="landmarks" role="doc-pagelist">\n`;
            xhtml += `        <h2>Landmarks</h2>\n`;
            xhtml += `        <ol>\n`;
            this.landmarks.forEach(lm => {
                xhtml += `            <li><a epub:type="${escapeXml(lm.type)}" href="${escapeXml(lm.target)}">${escapeXml(lm.title)}</a></li>\n`;
            });
            xhtml += `        </ol>\n`;
            xhtml += `    </nav>\n\n`;
        }

        // 3. Page List Navigation (Accessibility/Academic)
        if (this.pageList.length > 0) {
            xhtml += `    <nav epub:type="page-list" id="page-list" role="doc-pagelist">\n`;
            xhtml += `        <h2>Page List</h2>\n`;
            xhtml += `        <ol>\n`;
            this.pageList.forEach(page => {
                xhtml += `            <li><a href="${escapeXml(page.target)}">${escapeXml(page.name)}</a></li>\n`;
            });
            xhtml += `        </ol>\n`;
            xhtml += `    </nav>\n\n`;
        }

        xhtml += `</body>\n`;
        xhtml += `</html>`;

        return xhtml;
    }

    /**
     * Recursive helper to build nested <ol> structures for EPUB3 nav.
     * 
     * @private
     * @param {Array<TocNode>} nodes - Array of TocNode objects.
     * @param {number} depth - Current indentation depth for formatting.
     * @returns {string} The HTML <ol> string.
     */
    _buildNavOl(nodes, depth) {
        const indent = '    '.repeat(depth);
        const innerIndent = '    '.repeat(depth + 1);
        
        let html = `${indent}<ol>\n`;
        
        nodes.forEach(node => {
            html += `${innerIndent}<li>\n`;
            html += `${innerIndent}    <a href="${escapeXml(node.target)}">${escapeXml(node.title)}</a>\n`;
            
            if (node.hasChildren()) {
                html += this._buildNavOl(node.children, depth + 2);
            }
            
            html += `${innerIndent}</li>\n`;
        });
        
        html += `${indent}</ol>\n`;
        return html;
    }

    // ------------------------------------------------------------------------
    // EPUB2 TOC.NCX GENERATION (FALLBACK)
    // ------------------------------------------------------------------------

    /**
     * Generates the EPUB2 toc.ncx document string.
     * Required for backward compatibility with older e-readers and certain e-ink devices.
     * 
     * @returns {string} The complete, valid XML string for toc.ncx.
     */
    generateNcxDocument() {
        // Ensure tree is built
        if (this.tocTree.length === 0 && this.headings.length > 0) {
            this.buildTree();
        }

        this._playOrderCounter = 1; // Reset play order before generation
        const titleEscaped = escapeXml(this.title);
        const uidEscaped = escapeXml(this.uid);
        const authorEscaped = escapeXml(this.creator);
        
        // Calculate max depth for NCX metadata
        const maxDepth = this._calculateMaxDepth(this.tocTree);

        let ncx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        ncx += `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${escapeXml(this.language)}">\n`;
        ncx += `    <head>\n`;
        ncx += `        <meta name="dtb:uid" content="${uidEscaped}"/>\n`;
        ncx += `        <meta name="dtb:depth" content="${maxDepth}"/>\n`;
        ncx += `        <meta name="dtb:generator" content="Antigravity Alchemist Engine v3.0"/>\n`;
        ncx += `        <meta name="dtb:totalPageCount" content="${this.pageList.length}"/>\n`;
        ncx += `        <meta name="dtb:maxPageNumber" content="${this.pageList.length > 0 ? this.pageList.length : 0}"/>\n`;
        ncx += `    </head>\n\n`;

        ncx += `    <docTitle>\n`;
        ncx += `        <text>${titleEscaped}</text>\n`;
        ncx += `    </docTitle>\n\n`;

        ncx += `    <docAuthor>\n`;
        ncx += `        <text>${authorEscaped}</text>\n`;
        ncx += `    </docAuthor>\n\n`;

        // 1. Navigation Map (navMap)
        ncx += `    <navMap>\n`;
        if (this.tocTree.length > 0) {
            ncx += this._buildNcxNavPoints(this.tocTree, 2);
        } else {
            // Fallback empty navpoint if no structure exists to prevent parsing crash
            ncx += `        <navPoint id="navPoint-1" playOrder="1">\n`;
            ncx += `            <navLabel><text>Start</text></navLabel>\n`;
            ncx += `            <content src="text/content.xhtml"/>\n`;
            ncx += `        </navPoint>\n`;
        }
        ncx += `    </navMap>\n`;

        // 2. Page List (pageList) - Optional but good for completeness
        if (this.pageList.length > 0) {
            ncx += `\n    <pageList>\n`;
            ncx += `        <navLabel><text>Pages</text></navLabel>\n`;
            this.pageList.forEach((page, index) => {
                const playOrder = this._playOrderCounter++;
                ncx += `        <pageTarget id="page-${index + 1}" type="normal" value="${escapeXml(page.name)}" playOrder="${playOrder}">\n`;
                ncx += `            <navLabel><text>${escapeXml(page.name)}</text></navLabel>\n`;
                ncx += `            <content src="${escapeXml(page.target)}"/>\n`;
                ncx += `        </pageTarget>\n`;
            });
            ncx += `    </pageList>\n`;
        }

        ncx += `</ncx>`;

        return ncx;
    }

    /**
     * Recursive helper to build nested <navPoint> structures for NCX.
     * Note: playOrder must be strictly sequential across the ENTIRE document,
     * including deeply nested items.
     * 
     * @private
     * @param {Array<TocNode>} nodes - Array of TocNode objects.
     * @param {number} depth - Current indentation depth for formatting.
     * @returns {string} The XML <navPoint> string.
     */
    _buildNcxNavPoints(nodes, depth) {
        const indent = '    '.repeat(depth);
        const innerIndent = '    '.repeat(depth + 1);
        let xml = '';

        nodes.forEach(node => {
            const playOrder = this._playOrderCounter++;
            node.playOrder = playOrder; // Store it just in case

            xml += `${indent}<navPoint id="${escapeXml(node.id)}" playOrder="${playOrder}">\n`;
            xml += `${innerIndent}<navLabel>\n`;
            xml += `${innerIndent}    <text>${escapeXml(node.title)}</text>\n`;
            xml += `${innerIndent}</navLabel>\n`;
            xml += `${innerIndent}<content src="${escapeXml(node.target)}"/>\n`;
            
            if (node.hasChildren()) {
                xml += this._buildNcxNavPoints(node.children, depth + 1);
            }
            
            xml += `${indent}</navPoint>\n`;
        });

        return xml;
    }

    /**
     * Calculates the maximum nesting depth of the TOC tree.
     * Required for the dtb:depth meta tag in toc.ncx.
     * 
     * @private
     * @param {Array<TocNode>} nodes - The nodes to evaluate.
     * @returns {number} The maximum depth.
     */
    _calculateMaxDepth(nodes) {
        if (!nodes || nodes.length === 0) return 1;
        
        let max = 1;
        nodes.forEach(node => {
            if (node.hasChildren()) {
                const childDepth = 1 + this._calculateMaxDepth(node.children);
                if (childDepth > max) max = childDepth;
            }
        });
        
        return max;
    }
}

// Export modules for Node.js environments
module.exports = {
    EpubNavigationSystem,
    TocNode,
    LandmarkNode
};