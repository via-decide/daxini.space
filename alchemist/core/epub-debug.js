/**
 * @fileoverview EPUB Debug and Inspection Mode (Antigravity Apex Engine)
 * @module core/epub-debug
 * 
 * Provides full visibility into EPUB generation to quickly identify and fix
 * structural, linking, or rendering issues without trial-and-error.
 * 
 * Features:
 * - Structure Visualization (Tree view of Spine & Manifest)
 * - Internal Link Validation (Checks hrefs, anchor tags, and image sources)
 * - KDP-Specific Warnings (Detects oversized images, unsupported CSS, missing metadata)
 * - Output Comparison (Diffs two EPUBs to find regressions in content or structure)
 * - Zero-Dependency (Uses native Node.js libraries and Unix 'unzip' for maximum compatibility)
 * 
 * @usage
 *   node core/epub-debug.js --validate build/epub/book.epub
 *   node core/epub-debug.js --tree build/epub/book.epub
 *   node core/epub-debug.js --diff build/epub/book_old.epub build/epub/book_new.epub
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const crypto = require('crypto');

// ============================================================================
// ANSI Color Constants for Terminal Output
// ============================================================================
const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Logs a formatted message to the console.
 * @param {string} color - ANSI color code.
 * @param {string} prefix - Message prefix.
 * @param {string} message - The actual message.
 */
function log(color, prefix, message) {
    console.log(`${color}${COLORS.bright}[${prefix}]${COLORS.reset} ${message}`);
}

/**
 * Safely executes a shell command and returns the output.
 * @param {string} cmd - The command to execute.
 * @returns {string} Standard output of the command.
 */
function execShell(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
    } catch (error) {
        throw new Error(`Command failed: ${cmd}\n${error.stderr || error.message}`);
    }
}

/**
 * Generates a SHA-256 hash of a file.
 * @param {string} filePath - Path to the file.
 * @returns {string} Hex representation of the file hash.
 */
function hashFile(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Parses XML attributes from a given XML tag string.
 * @param {string} tagString - The raw XML tag (e.g., <item id="1" href="a.html">)
 * @returns {Object} Key-value pairs of attributes.
 */
function parseAttributes(tagString) {
    const attributes = {};
    const regex = /([a-zA-Z0-9_:-]+)\s*=\s*(["'])(.*?)\2/g;
    let match;
    while ((match = regex.exec(tagString)) !== null) {
        attributes[match[1]] = match[3];
    }
    return attributes;
}

/**
 * Formats bytes into a human-readable string.
 * @param {number} bytes - Number of bytes.
 * @returns {string} Formatted string (e.g., "1.5 MB").
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// Core EPUB Debugger Class
// ============================================================================

/**
 * Handles the extraction, parsing, and validation of EPUB files.
 */
class EpubDebugger {
    /**
     * @param {string} epubPath - Path to the EPUB file to inspect.
     */
    constructor(epubPath) {
        if (!fs.existsSync(epubPath)) {
            throw new Error(`EPUB file not found: ${epubPath}`);
        }
        this.epubPath = path.resolve(epubPath);
        this.workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-debug-'));
        this.opfPath = null;
        this.opfDir = null;
        this.metadata = {};
        this.manifest = {}; // id -> { href, mediaType, absolutePath }
        this.spine = [];    // Array of idrefs
        this.warnings = [];
        this.errors = [];
    }

    /**
     * Extracts the EPUB and parses its core structure (Container & OPF).
     */
    async initialize() {
        log(COLORS.cyan, 'INIT', `Extracting EPUB: ${path.basename(this.epubPath)}`);
        
        // Unzip the EPUB
        try {
            execShell(`unzip -q "${this.epubPath}" -d "${this.workDir}"`);
        } catch (e) {
            throw new Error(`Failed to unzip EPUB. Ensure 'unzip' is installed. Details: ${e.message}`);
        }

        this._parseContainer();
        this._parseOPF();
    }

    /**
     * Reads META-INF/container.xml to locate the OPF file.
     * @private
     */
    _parseContainer() {
        const containerPath = path.join(this.workDir, 'META-INF', 'container.xml');
        if (!fs.existsSync(containerPath)) {
            throw new Error('Invalid EPUB: META-INF/container.xml is missing.');
        }

        const containerXml = fs.readFileSync(containerPath, 'utf-8');
        const rootfileMatch = containerXml.match(/<rootfile[^>]+full-path=["']([^"']+)["']/i);
        
        if (!rootfileMatch) {
            throw new Error('Invalid EPUB: Could not find <rootfile> in container.xml.');
        }

        this.opfPath = path.join(this.workDir, rootfileMatch[1]);
        this.opfDir = path.dirname(this.opfPath);
        
        if (!fs.existsSync(this.opfPath)) {
            throw new Error(`Invalid EPUB: OPF file declared at ${rootfileMatch[1]} does not exist.`);
        }
        log(COLORS.cyan, 'PARSE', `Found OPF at: ${rootfileMatch[1]}`);
    }

    /**
     * Parses the OPF file to extract metadata, manifest, and spine.
     * @private
     */
    _parseOPF() {
        const opfXml = fs.readFileSync(this.opfPath, 'utf-8');

        // Extract Metadata (Basic)
        const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
        const identifierMatch = opfXml.match(/<dc:identifier[^>]*>([^<]+)<\/dc:identifier>/i);
        const languageMatch = opfXml.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);

        this.metadata = {
            title: titleMatch ? titleMatch[1] : 'Unknown Title',
            author: authorMatch ? authorMatch[1] : 'Unknown Author',
            identifier: identifierMatch ? identifierMatch[1] : 'Unknown Identifier',
            language: languageMatch ? languageMatch[1] : 'Unknown Language'
        };

        // Extract Manifest
        const manifestRegex = /<item\s+([^>]+)>/gi;
        let match;
        while ((match = manifestRegex.exec(opfXml)) !== null) {
            const attrs = parseAttributes(match[1]);
            if (attrs.id && attrs.href) {
                this.manifest[attrs.id] = {
                    href: attrs.href,
                    mediaType: attrs['media-type'],
                    absolutePath: path.resolve(this.opfDir, attrs.href)
                };
            }
        }

        // Extract Spine
        const spineSectionMatch = opfXml.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i);
        if (spineSectionMatch) {
            const itemrefRegex = /<itemref\s+([^>]+)>/gi;
            let refMatch;
            while ((refMatch = itemrefRegex.exec(spineSectionMatch[1])) !== null) {
                const attrs = parseAttributes(refMatch[1]);
                if (attrs.idref) {
                    this.spine.push(attrs.idref);
                }
            }
        } else {
            this.errors.push('OPF is missing a <spine> element.');
        }

        log(COLORS.cyan, 'PARSE', `Parsed OPF: ${Object.keys(this.manifest).length} items in manifest, ${this.spine.length} items in spine.`);
    }

    /**
     * Validates all internal links (hrefs and image srcs) across all HTML/XHTML files in the manifest.
     */
    validateCrossReferences() {
        log(COLORS.yellow, 'VALIDATE', 'Validating internal links and assets...');
        let checkedFiles = 0;
        let brokenLinks = 0;

        // Collect all valid anchor IDs across all files to validate deep links (e.g., file.xhtml#chapter1)
        const globalAnchors = {}; // { 'absolutePath': ['id1', 'id2'] }

        // First pass: Collect IDs
        for (const itemId in this.manifest) {
            const item = this.manifest[itemId];
            if (item.mediaType === 'application/xhtml+xml' || item.mediaType === 'text/html') {
                if (fs.existsSync(item.absolutePath)) {
                    const content = fs.readFileSync(item.absolutePath, 'utf-8');
                    const idRegex = /id=["']([^"']+)["']/gi;
                    globalAnchors[item.absolutePath] = [];
                    let idMatch;
                    while ((idMatch = idRegex.exec(content)) !== null) {
                        globalAnchors[item.absolutePath].push(idMatch[1]);
                    }
                }
            }
        }

        // Second pass: Check links
        for (const itemId in this.manifest) {
            const item = this.manifest[itemId];
            if (item.mediaType === 'application/xhtml+xml' || item.mediaType === 'text/html') {
                if (!fs.existsSync(item.absolutePath)) {
                    this.errors.push(`Manifest item missing from filesystem: ${item.href}`);
                    continue;
                }

                checkedFiles++;
                const content = fs.readFileSync(item.absolutePath, 'utf-8');
                const dir = path.dirname(item.absolutePath);

                // Check <a href="...">
                const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi;
                let hrefMatch;
                while ((hrefMatch = hrefRegex.exec(content)) !== null) {
                    let target = hrefMatch[1];
                    if (target.startsWith('http') || target.startsWith('mailto:') || target.startsWith('tel:')) continue;

                    let targetFile = target;
                    let targetHash = null;

                    if (target.includes('#')) {
                        const parts = target.split('#');
                        targetFile = parts[0];
                        targetHash = parts[1];
                    }

                    const targetAbsPath = targetFile ? path.resolve(dir, targetFile) : item.absolutePath;

                    // 1. Check if file exists
                    if (!fs.existsSync(targetAbsPath)) {
                        this.errors.push(`Broken Link in ${item.href}: Target file '${targetFile}' does not exist.`);
                        brokenLinks++;
                        continue;
                    }

                    // 2. Check if file is in manifest
                    const isManifested = Object.values(this.manifest).some(m => m.absolutePath === targetAbsPath);
                    if (!isManifested) {
                        this.warnings.push(`Unmanifested Link in ${item.href}: Target file '${targetFile}' is not in OPF manifest.`);
                    }

                    // 3. Check if anchor exists
                    if (targetHash) {
                        const anchors = globalAnchors[targetAbsPath] || [];
                        if (!anchors.includes(targetHash)) {
                            this.errors.push(`Broken Anchor in ${item.href}: ID '#${targetHash}' not found in '${targetFile || 'self'}'.`);
                            brokenLinks++;
                        }
                    }
                }

                // Check <img src="...">
                const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
                let imgMatch;
                while ((imgMatch = imgRegex.exec(content)) !== null) {
                    const src = imgMatch[1];
                    if (src.startsWith('http') || src.startsWith('data:')) continue;

                    const srcAbsPath = path.resolve(dir, src);
                    if (!fs.existsSync(srcAbsPath)) {
                        this.errors.push(`Broken Image in ${item.href}: Source '${src}' does not exist.`);
                        brokenLinks++;
                    } else {
                        // Check image size (KDP warning for > 5MB)
                        const stats = fs.statSync(srcAbsPath);
                        if (stats.size > 5 * 1024 * 1024) {
                            this.warnings.push(`Oversized Image in ${item.href}: '${src}' is ${formatBytes(stats.size)} (KDP recommends < 5MB).`);
                        }
                    }
                }
            }
        }

        log(COLORS.green, 'VALIDATE', `Checked ${checkedFiles} HTML/XHTML files. Found ${brokenLinks} broken links.`);
    }

    /**
     * Checks for common KDP publisher warnings (CSS, structural, sizes).
     */
    detectKdpWarnings() {
        log(COLORS.yellow, 'INSPECT', 'Running KDP compliance checks...');
        
        // 1. Check for unmanifested files in the zip
        const allFiles = this._walkDir(this.workDir);
        const manifestPaths = Object.values(this.manifest).map(m => m.absolutePath);
        
        allFiles.forEach(file => {
            const relativeToRoot = path.relative(this.workDir, file);
            if (relativeToRoot === 'mimetype' || relativeToRoot.startsWith('META-INF') || file === this.opfPath) return;
            
            if (!manifestPaths.includes(file)) {
                this.warnings.push(`Unmanifested File: ${relativeToRoot} is in the EPUB but not declared in the OPF.`);
            }
        });

        // 2. Check for unused files (in manifest, but not in spine and not referenced)
        // (Simplified check: just looking at spine vs manifest for HTML files)
        for (const itemId in this.manifest) {
            const item = this.manifest[itemId];
            if ((item.mediaType === 'application/xhtml+xml' || item.mediaType === 'text/html') && !this.spine.includes(itemId)) {
                // It might be a nav file, check properties
                if (!item.href.includes('nav') && !item.href.includes('toc')) {
                    this.warnings.push(`Orphaned Content: ${item.href} is in manifest but not in spine.`);
                }
            }
        }

        // 3. Scan CSS for KDP hostile properties
        for (const itemId in this.manifest) {
            const item = this.manifest[itemId];
            if (item.mediaType === 'text/css') {
                if (fs.existsSync(item.absolutePath)) {
                    const css = fs.readFileSync(item.absolutePath, 'utf-8');
                    if (css.includes('position: absolute') || css.includes('position: fixed')) {
                        this.warnings.push(`CSS Warning in ${item.href}: 'position: absolute/fixed' is poorly supported in Kindle reflowable EPUBs.`);
                    }
                    if (css.includes('float:')) {
                        this.warnings.push(`CSS Warning in ${item.href}: 'float' can cause layout breaks on older e-readers.`);
                    }
                }
            }
        }
    }

    /**
     * Visualizes the structure of the EPUB in a tree format.
     */
    visualizeStructure() {
        console.log(`\n${COLORS.magenta}=== EPUB Structure Visualization ===${COLORS.reset}`);
        console.log(`${COLORS.bright}Title:${COLORS.reset} ${this.metadata.title}`);
        console.log(`${COLORS.bright}Author:${COLORS.reset} ${this.metadata.author}`);
        console.log(`${COLORS.bright}Identifier:${COLORS.reset} ${this.metadata.identifier}`);
        console.log(`${COLORS.bright}Language:${COLORS.reset} ${this.metadata.language}`);
        console.log(`\n${COLORS.cyan}Spine (Reading Order):${COLORS.reset}`);

        this.spine.forEach((idref, index) => {
            const item = this.manifest[idref];
            const isLast = index === this.spine.length - 1;
            const branch = isLast ? '└── ' : '├── ';
            
            if (item) {
                let sizeStr = 'Missing';
                if (fs.existsSync(item.absolutePath)) {
                    const stats = fs.statSync(item.absolutePath);
                    sizeStr = formatBytes(stats.size);
                }
                console.log(`${branch}${COLORS.green}${item.href}${COLORS.reset} ${COLORS.dim}(${sizeStr})${COLORS.reset}`);
            } else {
                console.log(`${branch}${COLORS.red}[Missing Manifest Item: ${idref}]${COLORS.reset}`);
            }
        });

        console.log(`\n${COLORS.cyan}Assets (Images, CSS, Fonts):${COLORS.reset}`);
        const assets = Object.values(this.manifest).filter(m => 
            m.mediaType !== 'application/xhtml+xml' && 
            m.mediaType !== 'text/html' &&
            m.mediaType !== 'application/x-dtbncx+xml'
        );

        assets.forEach((item, index) => {
            const isLast = index === assets.length - 1;
            const branch = isLast ? '└── ' : '├── ';
            let sizeStr = 'Missing';
            if (fs.existsSync(item.absolutePath)) {
                const stats = fs.statSync(item.absolutePath);
                sizeStr = formatBytes(stats.size);
            }
            console.log(`${branch}${COLORS.yellow}${item.href}${COLORS.reset} ${COLORS.dim}(${item.mediaType} - ${sizeStr})${COLORS.reset}`);
        });
        console.log();
    }

    /**
     * Outputs all collected errors and warnings.
     */
    report() {
        if (this.warnings.length > 0) {
            console.log(`\n${COLORS.yellow}=== Warnings (${this.warnings.length}) ===${COLORS.reset}`);
            this.warnings.forEach(w => console.log(`${COLORS.yellow}⚠${COLORS.reset} ${w}`));
        } else {
            log(COLORS.green, 'PASS', 'No structural warnings detected.');
        }

        if (this.errors.length > 0) {
            console.log(`\n${COLORS.red}=== Errors (${this.errors.length}) ===${COLORS.reset}`);
            this.errors.forEach(e => console.log(`${COLORS.red}✖${COLORS.reset} ${e}`));
            process.exitCode = 1;
        } else {
            log(COLORS.green, 'PASS', 'No errors detected. EPUB is structurally sound.');
        }
    }

    /**
     * Cleans up temporary extraction directories.
     */
    cleanup() {
        try {
            fs.rmSync(this.workDir, { recursive: true, force: true });
            log(COLORS.dim, 'CLEANUP', `Removed temporary directory: ${this.workDir}`);
        } catch (e) {
            log(COLORS.red, 'ERROR', `Failed to cleanup ${this.workDir}: ${e.message}`);
        }
    }

    /**
     * Recursively walks a directory and returns all file paths.
     * @private
     */
    _walkDir(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(this._walkDir(file));
            } else {
                results.push(file);
            }
        });
        return results;
    }
}

// ============================================================================
// Comparison Engine (Diff Mode)
// ============================================================================

/**
 * Compares two EPUB files to identify structural and content differences.
 * @param {string} epubPath1 - Base EPUB
 * @param {string} epubPath2 - Target EPUB
 */
async function compareEpubs(epubPath1, epubPath2) {
    log(COLORS.magenta, 'DIFF', `Comparing:\n  A: ${epubPath1}\n  B: ${epubPath2}`);

    const epubA = new EpubDebugger(epubPath1);
    const epubB = new EpubDebugger(epubPath2);

    try {
        await epubA.initialize();
        await epubB.initialize();

        console.log(`\n${COLORS.cyan}=== Metadata Differences ===${COLORS.reset}`);
        for (const key in epubA.metadata) {
            if (epubA.metadata[key] !== epubB.metadata[key]) {
                console.log(`[${key}]`);
                console.log(`  ${COLORS.red}- ${epubA.metadata[key]}${COLORS.reset}`);
                console.log(`  ${COLORS.green}+ ${epubB.metadata[key]}${COLORS.reset}`);
            }
        }

        console.log(`\n${COLORS.cyan}=== Spine Differences ===${COLORS.reset}`);
        const spineA = epubA.spine.map(id => epubA.manifest[id]?.href || id);
        const spineB = epubB.spine.map(id => epubB.manifest[id]?.href || id);

        const removedSpine = spineA.filter(href => !spineB.includes(href));
        const addedSpine = spineB.filter(href => !spineA.includes(href));

        removedSpine.forEach(href => console.log(`  ${COLORS.red}- ${href}${COLORS.reset}`));
        addedSpine.forEach(href => console.log(`  ${COLORS.green}+ ${href}${COLORS.reset}`));
        if (removedSpine.length === 0 && addedSpine.length === 0) {
            console.log(`  ${COLORS.dim}No changes in reading order.${COLORS.reset}`);
        }

        console.log(`\n${COLORS.cyan}=== Content Differences (Hash Comparison) ===${COLORS.reset}`);
        const manifestA = Object.values(epubA.manifest).reduce((acc, m) => { acc[m.href] = m; return acc; }, {});
        const manifestB = Object.values(epubB.manifest).reduce((acc, m) => { acc[m.href] = m; return acc; }, {});

        const allHrefs = new Set([...Object.keys(manifestA), ...Object.keys(manifestB)]);
        let contentChanged = false;

        for (const href of allHrefs) {
            const itemA = manifestA[href];
            const itemB = manifestB[href];

            if (itemA && !itemB) {
                console.log(`  ${COLORS.red}- ${href} (Removed)${COLORS.reset}`);
                contentChanged = true;
            } else if (!itemA && itemB) {
                console.log(`  ${COLORS.green}+ ${href} (Added)${COLORS.reset}`);
                contentChanged = true;
            } else {
                // Both exist, compare hashes
                if (fs.existsSync(itemA.absolutePath) && fs.existsSync(itemB.absolutePath)) {
                    const hashA = hashFile(itemA.absolutePath);
                    const hashB = hashFile(itemB.absolutePath);
                    if (hashA !== hashB) {
                        console.log(`  ${COLORS.yellow}~ ${href} (Modified)${COLORS.reset}`);
                        contentChanged = true;
                    }
                }
            }
        }

        if (!contentChanged) {
            console.log(`  ${COLORS.dim}No content modifications detected.${COLORS.reset}`);
        }
        console.log();

    } finally {
        epubA.cleanup();
        epubB.cleanup();
    }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
${COLORS.bright}Antigravity EPUB Debugger & Inspector${COLORS.reset}

${COLORS.bright}Usage:${COLORS.reset}
  node core/epub-debug.js [options] <path_to_epub>

${COLORS.bright}Options:${COLORS.reset}
  --validate <file>      Extracts EPUB, validates OPF, spine, and internal links/assets.
  --tree <file>          Visualizes the internal structure of the EPUB.
  --diff <file1> <file2> Compares two EPUB files for structural and content changes.
  --all <file>           Runs validation and tree visualization.

${COLORS.bright}Examples:${COLORS.reset}
  node core/epub-debug.js --validate build/epub/book.epub
  node core/epub-debug.js --diff build/epub/v1.epub build/epub/v2.epub
        `);
        process.exit(0);
    }

    const command = args[0];

    try {
        if (command === '--diff') {
            if (args.length < 3) throw new Error('Diff requires two EPUB paths.');
            await compareEpubs(args[1], args[2]);
        } 
        else if (command === '--validate' || command === '--tree' || command === '--all') {
            const epubPath = args[1];
            if (!epubPath) throw new Error('Missing EPUB file path.');

            const debuggerInstance = new EpubDebugger(epubPath);
            try {
                await debuggerInstance.initialize();
                
                if (command === '--tree' || command === '--all') {
                    debuggerInstance.visualizeStructure();
                }
                
                if (command === '--validate' || command === '--all') {
                    debuggerInstance.validateCrossReferences();
                    debuggerInstance.detectKdpWarnings();
                    debuggerInstance.report();
                }
            } finally {
                debuggerInstance.cleanup();
            }
        } 
        else {
            throw new Error(`Unknown command: ${command}`);
        }
    } catch (error) {
        log(COLORS.red, 'FATAL', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { EpubDebugger, compareEpubs };