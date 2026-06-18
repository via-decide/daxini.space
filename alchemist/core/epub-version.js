/**
 * @fileoverview Deterministic EPUB Build and Versioning Engine
 * @module core/epub-version
 * 
 * @description
 * This module guarantees that identical inputs always produce identical EPUB outputs.
 * It eliminates inconsistencies caused by varying timestamps, non-deterministic file
 * ordering, and randomly generated UUIDs, enabling reliable debugging, hashing,
 * and publishing (e.g., for KDP, Apple Books, Google Play).
 * 
 * Core Features:
 * - Deterministic UUIDv5 generation based on content SHA-256 hashes.
 * - Deep directory normalization (fixed mtime/atime for all assets).
 * - Strict alphabetical file ordering for archive inclusion.
 * - Content.opf metadata injection (deterministic dcterms:modified).
 * - Cross-platform deterministic ZIP packaging orchestrator.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const util = require('util');

// Promisified filesystem methods for modern async/await usage
const readdirAsync = util.promisify(fs.readdir);
const statAsync = util.promisify(fs.stat);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const utimesAsync = util.promisify(fs.utimes);

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Standard Epoch used for deterministic builds.
 * 1980-01-01T00:00:00.000Z is commonly used in ZIP specifications.
 */
const DETERMINISTIC_EPOCH = new Date('1980-01-01T00:00:00.000Z');

/**
 * Namespace UUID for EPUB generation (RFC 4122).
 * Used as the base for generating UUIDv5 identifiers from content hashes.
 */
const EPUB_NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Standard EPUB Mimetype string.
 */
const EPUB_MIMETYPE = 'application/epub+zip';

// ============================================================================
// UTILITY CLASSES
// ============================================================================

/**
 * Lightweight Logger for the build process.
 */
class Logger {
    static levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    static currentLevel = Logger.levels.INFO;

    static setLevel(levelName) {
        if (this.levels[levelName] !== undefined) {
            this.currentLevel = this.levels[levelName];
        }
    }

    static debug(msg, ...args) {
        if (this.currentLevel <= this.levels.DEBUG) console.debug(`[DEBUG] ${msg}`, ...args);
    }

    static info(msg, ...args) {
        if (this.currentLevel <= this.levels.INFO) console.info(`[INFO]  ${msg}`, ...args);
    }

    static warn(msg, ...args) {
        if (this.currentLevel <= this.levels.WARN) console.warn(`[WARN]  ${msg}`, ...args);
    }

    static error(msg, ...args) {
        if (this.currentLevel <= this.levels.ERROR) console.error(`[ERROR] ${msg}`, ...args);
    }
}

/**
 * Cryptographic and Hashing Utilities.
 */
class HashUtils {
    /**
     * Generates a deterministic UUID (v5) based on a namespace and a name (hash).
     * @param {string} name - The string to hash (e.g., content signature).
     * @param {string} namespace - The namespace UUID.
     * @returns {string} A valid RFC 4122 UUIDv5 string.
     */
    static generateUUIDv5(name, namespace = EPUB_NAMESPACE_UUID) {
        const nsBuffer = Buffer.from(namespace.replace(/-/g, ''), 'hex');
        const nameBuffer = Buffer.from(name, 'utf8');
        
        const hash = crypto.createHash('sha1')
            .update(nsBuffer)
            .update(nameBuffer)
            .digest();
        
        // Set version to 5
        hash[6] = (hash[6] & 0x0f) | 0x50;
        // Set variant to RFC4122
        hash[8] = (hash[8] & 0x3f) | 0x80;
        
        return [
            hash.toString('hex', 0, 4),
            hash.toString('hex', 4, 6),
            hash.toString('hex', 6, 8),
            hash.toString('hex', 8, 10),
            hash.toString('hex', 10, 16)
        ].join('-');
    }

    /**
     * Recursively computes a deterministic SHA-256 hash of a directory's contents.
     * Files are sorted alphabetically to ensure consistent hashing regardless of OS traversal order.
     * 
     * @param {string} dirPath - The directory to hash.
     * @param {string} basePath - Internal use for relative path calculation.
     * @returns {Promise<string>} The hex-encoded SHA-256 hash.
     */
    static async hashDirectory(dirPath, basePath = dirPath) {
        const entries = await readdirAsync(dirPath);
        // Deterministic ordering is critical here
        entries.sort();

        const hash = crypto.createHash('sha256');

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/'); // Normalize slashes for cross-platform consistency
            const stats = await statAsync(fullPath);

            if (stats.isDirectory()) {
                const subHash = await this.hashDirectory(fullPath, basePath);
                hash.update(`DIR:${relativePath}:${subHash}`);
            } else if (stats.isFile()) {
                const fileBuffer = await readFileAsync(fullPath);
                const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                hash.update(`FILE:${relativePath}:${fileHash}`);
            }
        }

        return hash.digest('hex');
    }
}

/**
 * Git Utilities for extracting deterministic metadata from the repository environment.
 */
class GitUtils {
    /**
     * Attempts to retrieve the timestamp of the last commit affecting a specific directory.
     * @param {string} targetDir - Directory to check.
     * @returns {Date|null} The commit date, or null if git is unavailable.
     */
    static getLastCommitDate(targetDir) {
        try {
            const output = execSync(`git log -1 --format=%cI "${targetDir}"`, { 
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'] 
            });
            const dateStr = output.trim();
            if (dateStr) {
                const date = new Date(dateStr);
                Logger.debug(`Found Git commit date for ${targetDir}: ${date.toISOString()}`);
                return date;
            }
        } catch (err) {
            Logger.debug(`Git commit date extraction failed or not in a git repo: ${err.message}`);
        }
        return null;
    }
}

// ============================================================================
// CORE DOMAIN LOGIC
// ============================================================================

/**
 * Normalizes EPUB source files to guarantee deterministic outputs.
 */
class EpubNormalizer {
    /**
     * Recursively sets the modified and access times of all files and directories
     * to a fixed deterministic epoch.
     * 
     * @param {string} dirPath - The directory to normalize.
     * @param {Date} fixedDate - The date to apply (defaults to DETERMINISTIC_EPOCH).
     */
    static async normalizeTimestamps(dirPath, fixedDate = DETERMINISTIC_EPOCH) {
        const entries = await readdirAsync(dirPath);
        
        // Normalize the current directory first
        await utimesAsync(dirPath, fixedDate, fixedDate);

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const stats = await statAsync(fullPath);

            if (stats.isDirectory()) {
                await this.normalizeTimestamps(fullPath, fixedDate);
            } else {
                await utimesAsync(fullPath, fixedDate, fixedDate);
            }
        }
        Logger.debug(`Normalized timestamps for directory: ${dirPath}`);
    }

    /**
     * Locates the content.opf file within an unpacked EPUB directory.
     * It reads META-INF/container.xml to find the exact path.
     * 
     * @param {string} rootDir - The root of the unpacked EPUB.
     * @returns {Promise<string>} The absolute path to the .opf file.
     * @throws {Error} If container.xml or the OPF file cannot be found.
     */
    static async locateOpfFile(rootDir) {
        const containerPath = path.join(rootDir, 'META-INF', 'container.xml');
        if (!fs.existsSync(containerPath)) {
            throw new Error(`META-INF/container.xml not found in ${rootDir}`);
        }

        const containerContent = await readFileAsync(containerPath, 'utf8');
        const rootfileMatch = containerContent.match(/<rootfile[^>]+full-path="([^"]+)"/i);
        
        if (!rootfileMatch || !rootfileMatch[1]) {
            throw new Error('Could not parse full-path from container.xml');
        }

        const opfRelativePath = rootfileMatch[1];
        const opfFullPath = path.join(rootDir, opfRelativePath);

        if (!fs.existsSync(opfFullPath)) {
            throw new Error(`OPF file specified in container.xml not found at ${opfFullPath}`);
        }

        return opfFullPath;
    }

    /**
     * Injects deterministic metadata into the content.opf file.
     * Updates <dc:identifier> and <meta property="dcterms:modified">.
     * 
     * @param {string} opfPath - Path to the content.opf file.
     * @param {string} deterministicUuid - The UUID to inject.
     * @param {Date} modifiedDate - The modification date to inject.
     */
    static async injectDeterministicMetadata(opfPath, deterministicUuid, modifiedDate) {
        let opfContent = await readFileAsync(opfPath, 'utf8');
        const dateString = modifiedDate.toISOString().replace(/\.\d{3}Z$/, 'Z'); // Format: YYYY-MM-DDThh:mm:ssZ

        // 1. Update Identifier
        const identifierRegex = /(<dc:identifier[^>]*id="([^"]+)"[^>]*>)(.*?)(<\/dc:identifier>)/is;
        if (identifierRegex.test(opfContent)) {
            opfContent = opfContent.replace(identifierRegex, `$1urn:uuid:${deterministicUuid}$4`);
            Logger.info(`Updated existing <dc:identifier> to urn:uuid:${deterministicUuid}`);
        } else {
            // Inject if missing (fallback, though invalid EPUBs shouldn't reach here)
            const metadataEndRegex = /<\/metadata>/i;
            const newIdentifier = `\n    <dc:identifier id="uuid_id">urn:uuid:${deterministicUuid}</dc:identifier>\n  `;
            opfContent = opfContent.replace(metadataEndRegex, `${newIdentifier}</metadata>`);
            Logger.warn(`Injected missing <dc:identifier> into OPF.`);
        }

        // 2. Update Modified Date
        const modifiedRegex = /(<meta[^>]*property="dcterms:modified"[^>]*>)(.*?)(<\/meta>)/is;
        if (modifiedRegex.test(opfContent)) {
            opfContent = opfContent.replace(modifiedRegex, `$1${dateString}$3`);
            Logger.info(`Updated existing <meta property="dcterms:modified"> to ${dateString}`);
        } else {
            const metadataEndRegex = /<\/metadata>/i;
            const newModified = `\n    <meta property="dcterms:modified">${dateString}</meta>\n  `;
            opfContent = opfContent.replace(metadataEndRegex, `${newModified}</metadata>`);
            Logger.warn(`Injected missing dcterms:modified into OPF.`);
        }

        await writeFileAsync(opfPath, opfContent, 'utf8');
        Logger.debug(`Successfully wrote deterministic metadata to ${opfPath}`);
    }
}

/**
 * Handles the actual creation of the EPUB archive using deterministic ZIP parameters.
 */
class EpubPackager {
    /**
     * Packages the normalized directory into an EPUB file.
     * Ensures `mimetype` is uncompressed and the first file in the archive.
     * Sorts all other files alphabetically.
     * 
     * @param {string} sourceDir - The normalized source directory.
     * @param {string} outputPath - The path where the .epub file will be saved.
     */
    static async createArchive(sourceDir, outputPath) {
        // Ensure output directory exists
        const outDir = path.dirname(outputPath);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        // Remove existing output file to prevent appending
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        const absoluteOutputPath = path.resolve(outputPath);
        const cwd = path.resolve(sourceDir);

        try {
            // Step 1: Add mimetype without compression and without extra fields
            // -X: exclude extra file attributes
            // -0: store only (no compression)
            Logger.info('Packaging mimetype...');
            execSync(`zip -q0X "${absoluteOutputPath}" mimetype`, { cwd });

            // Step 2: Gather all other files, sort them, and add them
            // We use standard shell find and sort to guarantee ordering
            // -r9: recurse, max compression
            // -X: exclude extra file attributes
            Logger.info('Packaging and compressing content files deterministically...');
            
            // Build a sorted list of files excluding mimetype
            const filesListCmd = `find . -type f -not -name "mimetype" | LC_ALL=C sort`;
            const files = execSync(filesListCmd, { cwd, encoding: 'utf8' })
                .split('\n')
                .filter(f => f.trim().length > 0)
                .map(f => `"${f.replace(/^\.\//, '')}"`)
                .join(' ');

            if (files.length > 0) {
                // We use xargs or direct execution depending on length. Direct is usually fine for EPUBs.
                execSync(`zip -q9X "${absoluteOutputPath}" ${files}`, { cwd });
            }

            Logger.info(`Successfully created deterministic EPUB at: ${outputPath}`);

        } catch (error) {
            Logger.error(`Failed to package EPUB: ${error.message}`);
            if (error.stdout) Logger.error(`STDOUT: ${error.stdout.toString()}`);
            if (error.stderr) Logger.error(`STDERR: ${error.stderr.toString()}`);
            throw new Error('EPUB packaging failed. Ensure "zip" is installed on the system.');
        }
    }
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Main orchestrator for the Deterministic Build and Versioning System.
 */
class DeterministicEpubBuilder {
    /**
     * @param {Object} options
     * @param {string} options.sourceDir - Path to the unpacked EPUB source directory.
     * @param {string} options.outputEpub - Path for the final .epub output.
     * @param {boolean} [options.useGitTimestamp=true] - Whether to use the latest git commit for the modified date.
     * @param {string} [options.logLevel='INFO'] - Logging level.
     */
    constructor(options) {
        this.sourceDir = path.resolve(options.sourceDir);
        this.outputEpub = path.resolve(options.outputEpub);
        this.useGitTimestamp = options.useGitTimestamp !== false;
        
        if (options.logLevel) {
            Logger.setLevel(options.logLevel.toUpperCase());
        }
    }

    /**
     * Executes the deterministic build pipeline.
     * 
     * Pipeline Steps:
     * 1. Validate source directory structure.
     * 2. Compute a deterministic content hash of the raw inputs.
     * 3. Generate a UUIDv5 based on the content hash.
     * 4. Determine the canonical modification date (Git or Epoch).
     * 5. Inject UUID and Date into content.opf.
     * 6. Normalize all file timestamps to the Epoch.
     * 7. Package the archive using deterministic zip routines.
     * 
     * @returns {Promise<Object>} Build metadata including hash and uuid.
     */
    async build() {
        Logger.info(`Starting deterministic build for: ${this.sourceDir}`);

        // 1. Validation
        const mimetypePath = path.join(this.sourceDir, 'mimetype');
        if (!fs.existsSync(mimetypePath)) {
            throw new Error(`Invalid EPUB source: 'mimetype' file not found at ${mimetypePath}`);
        }

        // 2. Compute Content Hash (Pre-modification)
        Logger.info('Computing deterministic content hash...');
        const contentHash = await HashUtils.hashDirectory(this.sourceDir);
        Logger.info(`Content SHA-256: ${contentHash}`);

        // 3. Generate Versioned UUID
        const deterministicUuid = HashUtils.generateUUIDv5(contentHash);
        Logger.info(`Generated Deterministic UUID: ${deterministicUuid}`);

        // 4. Determine canonical date
        let canonicalDate = DETERMINISTIC_EPOCH;
        if (this.useGitTimestamp) {
            const gitDate = GitUtils.getLastCommitDate(this.sourceDir);
            if (gitDate) {
                canonicalDate = gitDate;
                Logger.info(`Using Git commit date for OPF metadata: ${canonicalDate.toISOString()}`);
            } else {
                Logger.info(`Git date unavailable. Falling back to Epoch: ${canonicalDate.toISOString()}`);
            }
        }

        // 5. Inject Metadata into OPF
        Logger.info('Locating and updating content.opf...');
        const opfPath = await EpubNormalizer.locateOpfFile(this.sourceDir);
        await EpubNormalizer.injectDeterministicMetadata(opfPath, deterministicUuid, canonicalDate);

        // 6. Normalize Timestamps
        // Note: We do this AFTER modifying the OPF, so the OPF file itself gets the normalized timestamp.
        Logger.info('Normalizing file system timestamps...');
        await EpubNormalizer.normalizeTimestamps(this.sourceDir, DETERMINISTIC_EPOCH);

        // 7. Package Archive
        Logger.info('Packaging deterministic archive...');
        await EpubPackager.createArchive(this.sourceDir, this.outputEpub);

        Logger.info('===================================================');
        Logger.info('✅ Deterministic EPUB Build Complete');
        Logger.info(`Output: ${this.outputEpub}`);
        Logger.info(`UUID:   ${deterministicUuid}`);
        Logger.info(`Hash:   ${contentHash}`);
        Logger.info('===================================================');

        return {
            output: this.outputEpub,
            uuid: deterministicUuid,
            hash: contentHash,
            timestamp: canonicalDate
        };
    }
}

// ============================================================================
// EXPORTS & CLI EXECUTION
// ============================================================================

module.exports = {
    DeterministicEpubBuilder,
    HashUtils,
    EpubNormalizer,
    EpubPackager,
    Logger
};

// If executed directly via Node.js
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: node epub-version.js <source_directory> <output_epub_path> [--debug]');
        console.error('Example: node core/epub-version.js ./build/epub_unpacked ./build/epub/book.epub');
        process.exit(1);
    }

    const sourceDir = args[0];
    const outputEpub = args[1];
    const isDebug = args.includes('--debug');

    const builder = new DeterministicEpubBuilder({
        sourceDir,
        outputEpub,
        logLevel: isDebug ? 'DEBUG' : 'INFO',
        useGitTimestamp: true
    });

    builder.build()
        .then(() => process.exit(0))
        .catch(err => {
            Logger.error(`Build failed: ${err.message}`);
            if (isDebug) Logger.error(err.stack);
            process.exit(1);
        });
}