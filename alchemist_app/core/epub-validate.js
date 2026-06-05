/**
 * @file epub-validate.js
 * @description Advanced EPUB Validation and Auto-Fix Engine.
 * Ensures EPUB directory structures are fully compliant with EPUB 3.3 specifications
 * before final packaging. Detects and automatically fixes structural anomalies, 
 * missing assets, orphaned files, and malformed manifests.
 * 
 * Capabilities:
 * - Structural integrity checks (mimetype, META-INF/container.xml, OPF, nav.xhtml)
 * - Deep manifest validation (cross-referencing disk files vs. OPF declarations)
 * - Spine validation and auto-correction
 * - Automatic asset registration/deregistration in content.opf
 * - XHTML structure baseline validation and auto-patching
 * 
 * @author Antigravity Synthesis Orchestrator
 * @version 3.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Configuration & Constants ---

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SUCCESS: 4
};

const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

const MIME_TYPES = {
    '.xhtml': 'application/xhtml+xml',
    '.html': 'application/xhtml+xml',
    '.htm': 'application/xhtml+xml',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.ncx': 'application/x-dtbncx+xml',
    '.opf': 'application/oebps-package+xml',
    '.smil': 'application/smil+xml',
    '.pls': 'application/pls+xml'
};

const STANDARD_MIMETYPE_CONTENT = 'application/epub+zip';

// --- Utility Functions ---

/**
 * Enhanced logging utility with color coding for terminal output.
 */
const Logger = {
    log: (level, message, ...args) => {
        if (level < CURRENT_LOG_LEVEL) return;
        const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
        
        let prefix = '';
        switch (level) {
            case LOG_LEVELS.DEBUG: prefix = '\x1b[36m[DEBUG]\x1b[0m'; break;
            case LOG_LEVELS.INFO: prefix = '\x1b[34m[INFO]\x1b[0m'; break;
            case LOG_LEVELS.WARN: prefix = '\x1b[33m[WARN]\x1b[0m'; break;
            case LOG_LEVELS.ERROR: prefix = '\x1b[31m[ERROR]\x1b[0m'; break;
            case LOG_LEVELS.SUCCESS: prefix = '\x1b[32m[SUCCESS]\x1b[0m'; break;
        }
        console.log(`${prefix} [${timestamp}] ${message}`, ...args);
    },
    debug: (msg, ...args) => Logger.log(LOG_LEVELS.DEBUG, msg, ...args),
    info: (msg, ...args) => Logger.log(LOG_LEVELS.INFO, msg, ...args),
    warn: (msg, ...args) => Logger.log(LOG_LEVELS.WARN, msg, ...args),
    error: (msg, ...args) => Logger.log(LOG_LEVELS.ERROR, msg, ...args),
    success: (msg, ...args) => Logger.log(LOG_LEVELS.SUCCESS, msg, ...args)
};

/**
 * Recursively walks a directory and returns all file paths.
 * @param {string} dir - Directory to walk.
 * @param {string[]} [fileList=[]] - Accumulated list of files.
 * @returns {string[]} Array of absolute file paths.
 */
function walkDirSync(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walkDirSync(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }
    return fileList;
}

/**
 * Parses XML attributes from a given tag string.
 * @param {string} tag - The XML tag string (e.g., '<item id="x" href="y"/>')
 * @returns {Object} Dictionary of attributes.
 */
function parseXmlAttributes(tag) {
    const attrs = {};
    const regex = /([a-zA-Z0-9_:-]+)\s*=\s*(["'])(.*?)\2/g;
    let match;
    while ((match = regex.exec(tag))) {
        attrs[match[1]] = match[3];
    }
    return attrs;
}

/**
 * Generates a safe XML ID based on a file path.
 * @param {string} filePath - The relative file path.
 * @returns {string} A valid XML ID.
 */
function generateSafeId(filePath) {
    const base = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath).replace('.', '');
    const safeBase = base.replace(/[^a-zA-Z0-9]/g, '_');
    return `id_${safeBase}_${ext}_${crypto.randomBytes(2).toString('hex')}`;
}

// --- Main Validator Class ---

/**
 * Core engine for validating and fixing EPUB structures.
 */
class EpubValidator {
    /**
     * @param {string} epubDir - Path to the unzipped EPUB directory.
     * @param {Object} options - Configuration options.
     * @param {boolean} options.autoFix - Whether to automatically fix detected issues.
     */
    constructor(epubDir, options = { autoFix: true }) {
        this.epubDir = path.resolve(epubDir);
        this.autoFix = options.autoFix;
        
        this.state = {
            isValid: true,
            opfPath: null,
            opfContent: null,
            manifestItems: new Map(), // id -> { href, media-type, properties, rawTag }
            spineItems: [], // array of idrefs
            diskFiles: new Set(), // Set of relative paths from OPF dir
            issues: {
                structural: [],
                manifestMissing: [], // Declared but not on disk
                manifestUndeclared: [], // On disk but not declared
                spineOrphans: [], // In spine but not in manifest
                xhtmlMalformed: []
            }
        };
    }

    /**
     * Executes the full validation and auto-fix pipeline.
     * @returns {boolean} True if the EPUB is valid (or was successfully fixed).
     */
    async process() {
        Logger.info(`Starting EPUB validation for directory: ${this.epubDir}`);
        
        if (!fs.existsSync(this.epubDir)) {
            Logger.error(`Directory does not exist: ${this.epubDir}`);
            return false;
        }

        try {
            await this.validateStructure();
            if (this.state.opfPath) {
                await this.validateManifest();
                await this.validateSpine();
                await this.validateXhtml();
            }

            this.reportIssues();

            if (this.autoFix && !this.state.isValid) {
                Logger.info('Auto-fix is enabled. Attempting to repair issues...');
                await this.applyFixes();
                
                // Re-validate after fixes
                Logger.info('Re-validating after applying fixes...');
                this.resetState();
                await this.validateStructure();
                if (this.state.opfPath) {
                    await this.validateManifest();
                    await this.validateSpine();
                }
                this.reportIssues();
            }

            if (this.state.isValid) {
                Logger.success('EPUB validation passed successfully. Ready for packaging.');
            } else {
                Logger.error('EPUB validation failed. Manual intervention required.');
            }

            return this.state.isValid;

        } catch (error) {
            Logger.error(`Critical failure during EPUB validation: ${error.message}`);
            Logger.debug(error.stack);
            return false;
        }
    }

    /**
     * Resets the internal state for re-validation.
     */
    resetState() {
        this.state.isValid = true;
        this.state.opfPath = null;
        this.state.opfContent = null;
        this.state.manifestItems.clear();
        this.state.spineItems = [];
        this.state.diskFiles.clear();
        this.state.issues = {
            structural: [],
            manifestMissing: [],
            manifestUndeclared: [],
            spineOrphans: [],
            xhtmlMalformed: []
        };
    }

    /**
     * Validates core structural files: mimetype, META-INF/container.xml, and finds OPF.
     */
    async validateStructure() {
        Logger.debug('Validating structural integrity...');

        // 1. Check mimetype
        const mimePath = path.join(this.epubDir, 'mimetype');
        if (!fs.existsSync(mimePath)) {
            this.addIssue('structural', 'Missing mimetype file.');
        } else {
            const mimeContent = fs.readFileSync(mimePath, 'utf8');
            if (mimeContent !== STANDARD_MIMETYPE_CONTENT) {
                this.addIssue('structural', `Malformed mimetype. Expected '${STANDARD_MIMETYPE_CONTENT}', got '${mimeContent}'.`);
            }
        }

        // 2. Check META-INF/container.xml
        const containerPath = path.join(this.epubDir, 'META-INF', 'container.xml');
        if (!fs.existsSync(containerPath)) {
            this.addIssue('structural', 'Missing META-INF/container.xml file.');
        } else {
            const containerContent = fs.readFileSync(containerPath, 'utf8');
            const rootfileMatch = containerContent.match(/<rootfile[^>]+full-path=["']([^"']+)["']/i);
            
            if (!rootfileMatch) {
                this.addIssue('structural', 'META-INF/container.xml does not define a valid rootfile (OPF).');
            } else {
                const opfRelPath = rootfileMatch[1];
                this.state.opfPath = path.join(this.epubDir, opfRelPath);
                
                if (!fs.existsSync(this.state.opfPath)) {
                    this.addIssue('structural', `Declared OPF file not found at: ${opfRelPath}`);
                    this.state.opfPath = null;
                } else {
                    Logger.debug(`Found valid OPF at: ${opfRelPath}`);
                    this.state.opfContent = fs.readFileSync(this.state.opfPath, 'utf8');
                }
            }
        }
    }

    /**
     * Parses the OPF file and cross-references declared items with actual files on disk.
     */
    async validateManifest() {
        Logger.debug('Validating manifest (content.opf)...');
        
        const opfDir = path.dirname(this.state.opfPath);
        
        // Parse <manifest> block
        const manifestMatch = this.state.opfContent.match(/<manifest>([\s\S]*?)<\/manifest>/i);
        if (!manifestMatch) {
            this.addIssue('structural', 'OPF file is missing a <manifest> block.');
            return;
        }

        const manifestBlock = manifestMatch[1];
        const itemRegex = /<item\s+([^>]+)\/?>/gi;
        let itemMatch;
        let navFound = false;

        // Extract all declared items
        while ((itemMatch = itemRegex.exec(manifestBlock))) {
            const rawTag = itemMatch[0];
            const attrs = parseXmlAttributes(rawTag);
            
            if (!attrs.id || !attrs.href) {
                this.addIssue('structural', `Malformed <item> in manifest: ${rawTag}`);
                continue;
            }

            this.state.manifestItems.set(attrs.id, {
                href: attrs.href,
                mediaType: attrs['media-type'],
                properties: attrs.properties || '',
                rawTag: rawTag
            });

            if (attrs.properties && attrs.properties.includes('nav')) {
                navFound = true;
            }
        }

        if (!navFound) {
            this.addIssue('structural', 'No navigation document (nav.xhtml) declared in manifest (properties="nav").');
        }

        // Scan disk for actual files
        const allFiles = walkDirSync(this.epubDir);
        for (const file of allFiles) {
            // Ignore structural root files and META-INF
            const relToRoot = path.relative(this.epubDir, file).replace(/\\/g, '/');
            if (relToRoot === 'mimetype' || relToRoot.startsWith('META-INF/') || file === this.state.opfPath) {
                continue;
            }
            
            // Store relative to OPF directory (how hrefs are resolved)
            const relToOpf = path.relative(opfDir, file).replace(/\\/g, '/');
            this.state.diskFiles.add(relToOpf);
        }

        // Cross-reference: Declared vs Actual
        for (const [id, item] of this.state.manifestItems.entries()) {
            // Decode URI components in href (e.g., %20 to space)
            const decodedHref = decodeURIComponent(item.href);
            if (!this.state.diskFiles.has(decodedHref)) {
                this.addIssue('manifestMissing', { id, href: item.href });
            }
        }

        // Cross-reference: Actual vs Declared
        const declaredHrefs = new Set(
            Array.from(this.state.manifestItems.values()).map(item => decodeURIComponent(item.href))
        );

        for (const diskFile of this.state.diskFiles) {
            if (!declaredHrefs.has(diskFile)) {
                // Ignore macOS/OSX hidden files
                if (diskFile.includes('.DS_Store')) continue;
                this.addIssue('manifestUndeclared', diskFile);
            }
        }
    }

    /**
     * Validates the spine to ensure all itemrefs point to valid manifest items.
     */
    async validateSpine() {
        Logger.debug('Validating spine...');
        
        const spineMatch = this.state.opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i);
        if (!spineMatch) {
            this.addIssue('structural', 'OPF file is missing a <spine> block.');
            return;
        }

        const spineBlock = spineMatch[1];
        const itemrefRegex = /<itemref\s+([^>]+)\/?>/gi;
        let itemrefMatch;

        while ((itemrefMatch = itemrefRegex.exec(spineBlock))) {
            const rawTag = itemrefMatch[0];
            const attrs = parseXmlAttributes(rawTag);
            
            if (!attrs.idref) {
                this.addIssue('structural', `Malformed <itemref> in spine: ${rawTag}`);
                continue;
            }

            this.state.spineItems.push({ idref: attrs.idref, rawTag });

            if (!this.state.manifestItems.has(attrs.idref)) {
                this.addIssue('spineOrphans', attrs.idref);
            }
        }
    }

    /**
     * Performs a baseline validation of XHTML files to ensure they are well-formed.
     */
    async validateXhtml() {
        Logger.debug('Validating XHTML structures...');
        const opfDir = path.dirname(this.state.opfPath);

        for (const [id, item] of this.state.manifestItems.entries()) {
            if (item.mediaType === 'application/xhtml+xml') {
                const filePath = path.join(opfDir, decodeURIComponent(item.href));
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    // Basic checks for EPUB3 XHTML compliance
                    const hasXmlDecl = /<\?xml\s+version=["']1\.0["']\s+encoding=["']UTF-8["']\?>/i.test(content);
                    const hasHtmlTag = /<html[^>]*xmlns=["']http:\/\/www\.w3\.org\/1999\/xhtml["'][^>]*>/i.test(content);
                    const hasHead = /<head>[\s\S]*<\/head>/i.test(content);
                    const hasBody = /<body[^>]*>[\s\S]*<\/body>/i.test(content);

                    if (!hasXmlDecl || !hasHtmlTag || !hasHead || !hasBody) {
                        this.addIssue('xhtmlMalformed', {
                            file: item.href,
                            missing: {
                                xmlDecl: !hasXmlDecl,
                                htmlTag: !hasHtmlTag,
                                head: !hasHead,
                                body: !hasBody
                            }
                        });
                    }
                }
            }
        }
    }

    /**
     * Records an issue and marks the state as invalid.
     * @param {string} category - Issue category.
     * @param {any} details - Issue details.
     */
    addIssue(category, details) {
        this.state.isValid = false;
        if (this.state.issues[category]) {
            this.state.issues[category].push(details);
        }
    }

    /**
     * Reports all detected issues to the console.
     */
    reportIssues() {
        if (this.state.isValid) return;

        Logger.warn('--- EPUB Validation Issues Detected ---');
        
        if (this.state.issues.structural.length > 0) {
            Logger.warn('[Structural Issues]');
            this.state.issues.structural.forEach(i => Logger.warn(`  - ${i}`));
        }

        if (this.state.issues.manifestMissing.length > 0) {
            Logger.warn('[Missing Files (Declared but not found)]');
            this.state.issues.manifestMissing.forEach(i => Logger.warn(`  - ID: ${i.id} -> ${i.href}`));
        }

        if (this.state.issues.manifestUndeclared.length > 0) {
            Logger.warn('[Undeclared Files (Found but not in manifest)]');
            this.state.issues.manifestUndeclared.forEach(i => Logger.warn(`  - ${i}`));
        }

        if (this.state.issues.spineOrphans.length > 0) {
            Logger.warn('[Spine Orphans (idref points to non-existent manifest item)]');
            this.state.issues.spineOrphans.forEach(i => Logger.warn(`  - idref: ${i}`));
        }

        if (this.state.issues.xhtmlMalformed.length > 0) {
            Logger.warn('[Malformed XHTML Files]');
            this.state.issues.xhtmlMalformed.forEach(i => {
                const missing = Object.keys(i.missing).filter(k => i.missing[k]).join(', ');
                Logger.warn(`  - ${i.file} (Missing: ${missing})`);
            });
        }
        Logger.warn('---------------------------------------');
    }

    /**
     * Applies automatic fixes based on the detected issues.
     */
    async applyFixes() {
        Logger.info('Applying auto-fixes...');

        // 1. Fix Structural Issues
        await this.fixStructure();

        // If we still don't have an OPF, we can't fix manifest/spine
        if (!this.state.opfPath || !fs.existsSync(this.state.opfPath)) {
            Logger.error('Cannot proceed with manifest fixes: OPF file is missing and could not be generated.');
            return;
        }

        // 2. Fix Manifest and Spine
        let opfUpdated = false;
        let newOpfContent = this.state.opfContent;

        // Fix missing files (remove from manifest and spine)
        if (this.state.issues.manifestMissing.length > 0) {
            Logger.info(`Removing ${this.state.issues.manifestMissing.length} missing items from manifest...`);
            for (const missing of this.state.issues.manifestMissing) {
                const item = this.state.manifestItems.get(missing.id);
                if (item) {
                    // Escape regex special chars in rawTag
                    const escapedTag = item.rawTag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const tagRegex = new RegExp(`\\s*${escapedTag}`, 'g');
                    newOpfContent = newOpfContent.replace(tagRegex, '');
                    opfUpdated = true;
                    
                    // Also remove from spine if present
                    const spineItemRegex = new RegExp(`\\s*<itemref\\s+idref=["']${missing.id}["'][^>]*\\/?>`, 'g');
                    if (spineItemRegex.test(newOpfContent)) {
                        Logger.info(`Removing missing item '${missing.id}' from spine...`);
                        newOpfContent = newOpfContent.replace(spineItemRegex, '');
                    }
                }
            }
        }

        // Fix undeclared files (add to manifest)
        if (this.state.issues.manifestUndeclared.length > 0) {
            Logger.info(`Adding ${this.state.issues.manifestUndeclared.length} undeclared items to manifest...`);
            
            let newItemsXml = '';
            for (const undeclared of this.state.issues.manifestUndeclared) {
                const id = generateSafeId(undeclared);
                const mediaType = this.guessMediaType(undeclared);
                const href = encodeURI(undeclared); // Ensure spaces are %20
                
                // If it's a nav.xhtml, add properties="nav"
                const isNav = path.basename(undeclared).toLowerCase() === 'nav.xhtml';
                const props = isNav ? ' properties="nav"' : '';

                newItemsXml += `\n    <item id="${id}" href="${href}" media-type="${mediaType}"${props}/>`;
                Logger.debug(`Appended to manifest: ${undeclared} as ${mediaType}`);
            }

            // Inject into manifest block
            newOpfContent = newOpfContent.replace(/(<\/manifest>)/i, `${newItemsXml}\n  $1`);
            opfUpdated = true;
        }

        // Fix spine orphans
        if (this.state.issues.spineOrphans.length > 0) {
            Logger.info(`Cleaning up ${this.state.issues.spineOrphans.length} spine orphans...`);
            for (const orphanId of this.state.issues.spineOrphans) {
                const spineItemRegex = new RegExp(`\\s*<itemref\\s+idref=["']${orphanId}["'][^>]*\\/?>`, 'g');
                newOpfContent = newOpfContent.replace(spineItemRegex, '');
                opfUpdated = true;
            }
        }

        // Save OPF if updated
        if (opfUpdated) {
            fs.writeFileSync(this.state.opfPath, newOpfContent, 'utf8');
            Logger.success('Updated content.opf with manifest/spine fixes.');
        }

        // 3. Fix XHTML malformations
        if (this.state.issues.xhtmlMalformed.length > 0) {
            await this.fixXhtml();
        }
    }

    /**
     * Fixes core structural files (mimetype, container.xml).
     */
    async fixStructure() {
        // Fix mimetype
        const mimePath = path.join(this.epubDir, 'mimetype');
        if (!fs.existsSync(mimePath) || fs.readFileSync(mimePath, 'utf8') !== STANDARD_MIMETYPE_CONTENT) {
            fs.writeFileSync(mimePath, STANDARD_MIMETYPE_CONTENT, 'utf8');
            Logger.success('Fixed mimetype file.');
        }

        // Fix META-INF/container.xml
        const metaInfDir = path.join(this.epubDir, 'META-INF');
        const containerPath = path.join(metaInfDir, 'container.xml');
        
        if (!fs.existsSync(containerPath)) {
            if (!fs.existsSync(metaInfDir)) fs.mkdirSync(metaInfDir, { recursive: true });
            
            // Try to find an OPF file to point to
            const allFiles = walkDirSync(this.epubDir);
            let opfFile = allFiles.find(f => f.endsWith('.opf'));
            
            if (!opfFile) {
                // Critical error, can't fix without OPF
                Logger.error('Cannot generate container.xml: No .opf file found in the EPUB directory.');
                return;
            }

            const opfRelPath = path.relative(this.epubDir, opfFile).replace(/\\/g, '/');
            const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfRelPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
            
            fs.writeFileSync(containerPath, containerXml, 'utf8');
            this.state.opfPath = opfFile;
            this.state.opfContent = fs.readFileSync(opfFile, 'utf8');
            Logger.success(`Generated META-INF/container.xml pointing to ${opfRelPath}`);
        }
    }

    /**
     * Injects missing required HTML boilerplates into malformed XHTML files.
     */
    async fixXhtml() {
        Logger.info(`Patching ${this.state.issues.xhtmlMalformed.length} malformed XHTML files...`);
        const opfDir = path.dirname(this.state.opfPath);

        for (const issue of this.state.issues.xhtmlMalformed) {
            const filePath = path.join(opfDir, decodeURIComponent(issue.file));
            if (!fs.existsSync(filePath)) continue;

            let content = fs.readFileSync(filePath, 'utf8');
            let patched = false;

            if (issue.missing.xmlDecl) {
                content = `<?xml version="1.0" encoding="UTF-8"?>\n` + content;
                patched = true;
            }

            if (issue.missing.htmlTag) {
                // Wrap content in html if missing entirely
                if (!/<html/i.test(content)) {
                    content = content.replace(/(<\?xml[^>]*\?>)/i, '$1\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">');
                    content += '\n</html>';
                    patched = true;
                } else {
                    // Just inject xmlns attributes if tag exists but lacks them
                    content = content.replace(/<html/i, '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"');
                    patched = true;
                }
            }

            if (issue.missing.head) {
                const title = path.basename(filePath, path.extname(filePath));
                const headTag = `\n<head>\n  <title>${title}</title>\n  <meta charset="utf-8"/>\n</head>\n`;
                content = content.replace(/(<html[^>]*>)/i, `$1${headTag}`);
                patched = true;
            }

            if (issue.missing.body) {
                // If body is missing, wrap everything between </head> and </html> in <body>
                content = content.replace(/(<\/head>)([\s\S]*?)(<\/html>)/i, '$1\n<body>$2</body>\n$3');
                patched = true;
            }

            if (patched) {
                fs.writeFileSync(filePath, content, 'utf8');
                Logger.success(`Patched XHTML structure for ${issue.file}`);
            }
        }
    }

    /**
     * Guesses the EPUB media type based on file extension.
     * @param {string} filePath - The file path.
     * @returns {string} The MIME type.
     */
    guessMediaType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return MIME_TYPES[ext] || 'application/octet-stream';
    }
}

// --- CLI Execution ---

if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
EPUB Validator and Auto-Fixer
=============================
Usage: node epub-validate.js <path-to-unzipped-epub> [--no-autofix]

Options:
  --no-autofix   Run validation only, do not attempt to fix issues.
        `);
        process.exit(0);
    }

    const targetDir = args[0];
    const autoFix = !args.includes('--no-autofix');

    const validator = new EpubValidator(targetDir, { autoFix });
    
    validator.process().then(isValid => {
        if (isValid) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    });
}

module.exports = EpubValidator;