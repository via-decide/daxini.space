/**
 * @file epub-images.js
 * @description Advanced Image Normalization and Embedding Pipeline for EPUB Generation.
 * 
 * This module standardizes image formats, paths, and embedding logic to ensure
 * flawless rendering across all EPUB readers (e-ink devices, Apple Books, Kindle via KDP, etc.).
 * 
 * Key Capabilities:
 * - Deterministic processing via SHA-256 content hashing (prevents duplicates).
 * - Automatic conversion of unsupported formats (WebP, TIFF, BMP, etc.) to EPUB-safe JPEG/PNG.
 * - Intelligent resizing and compression for large images to meet KDP/EPUB size limits.
 * - Color space normalization (e.g., CMYK to sRGB) to prevent rendering errors.
 * - Automatic EXIF data stripping for privacy and file size reduction.
 * - Concurrency-controlled batch processing to manage memory efficiently.
 * 
 * @module core/epub-images
 * @requires fs/promises
 * @requires path
 * @requires crypto
 * @requires sharp
 */

'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// -----------------------------------------------------------------------------
// Dependency Validation
// -----------------------------------------------------------------------------
let sharp;
try {
    sharp = require('sharp');
} catch (error) {
    console.error(`
[FATAL ERROR] Missing required dependency: 'sharp'
The Antigravity EPUB image pipeline requires the 'sharp' library for high-performance image processing.
Please install it by running:
    npm install sharp
`);
    process.exit(1);
}

// -----------------------------------------------------------------------------
// Constants & Configuration
// -----------------------------------------------------------------------------

const EPUB_SAFE_MIME_TYPES = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml'
};

const DEFAULT_CONFIG = {
    // Dimensions
    maxWidth: 1600,         // Max width in pixels (standard for high-res e-readers)
    maxHeight: 2560,        // Max height in pixels
    fit: 'inside',          // Sharp resize fit mode
    withoutEnlargement: true, // Don't upscale smaller images

    // Formatting & Compression
    targetFormat: 'auto',   // 'auto' (keep safe, convert unsafe), 'jpeg', 'png'
    jpegQuality: 85,        // 0-100
    pngCompressionLevel: 8, // 0-9
    pngPalette: true,       // Quantize PNG colors for smaller file size if applicable
    rasterizeSvg: false,    // Convert SVGs to PNGs for maximum EPUB2 compatibility
    eInkGrayscale: false,   // Convert all images to grayscale for e-ink optimization

    // Security & Metadata
    stripMetadata: true,    // Remove EXIF/XMP data
    hashLength: 12,         // Length of the SHA-256 hash used in filenames
    filenamePrefix: 'img_', // Prefix for deterministic filenames

    // Processing
    concurrency: 4          // Max concurrent image processing tasks
};

// -----------------------------------------------------------------------------
// Custom Error Classes
// -----------------------------------------------------------------------------

class EpubImageError extends Error {
    constructor(message, code, originalError = null) {
        super(message);
        this.name = 'EpubImageError';
        this.code = code;
        this.originalError = originalError;
        Error.captureStackTrace(this, this.constructor);
    }
}

// -----------------------------------------------------------------------------
// Core Pipeline Class
// -----------------------------------------------------------------------------

/**
 * EpubImagePipeline
 * Orchestrates the normalization, optimization, and caching of images for EPUBs.
 */
class EpubImagePipeline extends EventEmitter {
    /**
     * @param {Object} config - Partial or complete configuration object overriding defaults.
     */
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        // Cache to prevent processing the exact same image content multiple times
        // Maps SHA-256 hash -> Processed Image Metadata
        this.processedCache = new Map();
        
        // Statistics tracking
        this.stats = {
            processed: 0,
            converted: 0,
            resized: 0,
            duplicatesSkipped: 0,
            errors: 0,
            bytesSaved: 0
        };
    }

    /**
     * Generates a deterministic hash for a given buffer.
     * @param {Buffer} buffer - The image data buffer.
     * @returns {string} The truncated hex hash.
     * @private
     */
    _generateHash(buffer) {
        return crypto
            .createHash('sha256')
            .update(buffer)
            .digest('hex')
            .substring(0, this.config.hashLength);
    }

    /**
     * Determines the optimal EPUB-safe output format based on input metadata and config.
     * @param {Object} metadata - Sharp image metadata.
     * @returns {string} The output format ('jpeg', 'png', 'gif', 'svg').
     * @private
     */
    _determineOutputFormat(metadata) {
        if (this.config.targetFormat !== 'auto') {
            return this.config.targetFormat;
        }

        const inputFormat = metadata.format;

        // SVGs are kept as SVG unless rasterization is forced
        if (inputFormat === 'svg' && !this.config.rasterizeSvg) {
            return 'svg';
        }

        // If format is already EPUB safe (and not SVG if rasterize is true), keep it
        if (['jpeg', 'jpg', 'png', 'gif'].includes(inputFormat)) {
            // Exceptions: If we have alpha channel in a JPEG (rare/corrupt) or want to force PNG
            if (inputFormat === 'jpeg' && metadata.hasAlpha) {
                return 'png';
            }
            return inputFormat === 'jpg' ? 'jpeg' : inputFormat;
        }

        // Normalize unsupported formats (WebP, TIFF, BMP, HEIF, etc.)
        // Rule of thumb: If it has transparency, use PNG. Otherwise, JPEG.
        return metadata.hasAlpha ? 'png' : 'jpeg';
    }

    /**
     * Processes an image from a raw Buffer.
     * This is the core transformation engine.
     * 
     * @param {Buffer} inputBuffer - The raw image data.
     * @param {string} [originalFilename='unknown'] - Used for logging.
     * @returns {Promise<Object>} Processed image metadata and output buffer.
     */
    async processBuffer(inputBuffer, originalFilename = 'unknown') {
        try {
            const originalSize = inputBuffer.length;
            const contentHash = this._generateHash(inputBuffer);

            // 1. Check Cache for Deterministic Deduplication
            if (this.processedCache.has(contentHash)) {
                this.stats.duplicatesSkipped++;
                this.emit('duplicate', { filename: originalFilename, hash: contentHash });
                return this.processedCache.get(contentHash);
            }

            // 2. Initialize Sharp Pipeline
            let pipeline = sharp(inputBuffer, { failOn: 'truncated' });
            const metadata = await pipeline.metadata().catch(err => {
                throw new EpubImageError(`Invalid or corrupt image: ${originalFilename}`, 'INVALID_IMAGE', err);
            });

            let wasConverted = false;
            let wasResized = false;

            // 3. Determine Format & Handle Conversions
            const outFormat = this._determineOutputFormat(metadata);
            if (outFormat !== metadata.format) {
                wasConverted = true;
            }

            // 4. Color Space Normalization (Fix CMYK for EPUB)
            if (metadata.space === 'cmyk') {
                pipeline = pipeline.toColorspace('srgb');
                wasConverted = true;
            }

            // 5. Apply Resizing if necessary
            if (
                (metadata.width && metadata.width > this.config.maxWidth) ||
                (metadata.height && metadata.height > this.config.maxHeight)
            ) {
                pipeline = pipeline.resize({
                    width: this.config.maxWidth,
                    height: this.config.maxHeight,
                    fit: this.config.fit,
                    withoutEnlargement: this.config.withoutEnlargement
                });
                wasResized = true;
            }

            // 6. Apply Grayscale if E-Ink mode is enabled
            if (this.config.eInkGrayscale) {
                pipeline = pipeline.grayscale();
            }

            // 7. Strip EXIF/Metadata
            if (this.config.stripMetadata) {
                // In sharp v0.33+, pipeline.withMetadata() is required to KEEP metadata.
                // Omitting it strips metadata. If using older sharp, .keepMetadata() might be needed.
                // We ensure it's stripped by not chaining .withMetadata().
            }

            // 8. Configure Output Format & Compression
            if (outFormat === 'jpeg') {
                pipeline = pipeline.jpeg({
                    quality: this.config.jpegQuality,
                    progressive: true,
                    mozjpeg: true
                });
            } else if (outFormat === 'png') {
                pipeline = pipeline.png({
                    compressionLevel: this.config.pngCompressionLevel,
                    palette: this.config.pngPalette,
                    progressive: true
                });
            } else if (outFormat === 'gif') {
                // GIF optimization is limited in sharp, but we ensure format consistency
                pipeline = pipeline.gif();
            }

            // 9. Execute Pipeline
            const { data: outputBuffer, info: outputInfo } = await pipeline.toBuffer({ resolveWithObject: true });

            // 10. Construct Deterministic Filename
            const ext = outFormat === 'jpeg' ? 'jpg' : outFormat;
            const deterministicFilename = `${this.config.filenamePrefix}${contentHash}.${ext}`;

            // 11. Calculate Stats
            const finalSize = outputBuffer.length;
            if (finalSize < originalSize) {
                this.stats.bytesSaved += (originalSize - finalSize);
            }
            if (wasConverted) this.stats.converted++;
            if (wasResized) this.stats.resized++;
            this.stats.processed++;

            // 12. Build Result Object
            const result = {
                hash: contentHash,
                filename: deterministicFilename,
                mimeType: EPUB_SAFE_MIME_TYPES[outFormat] || `image/${outFormat}`,
                width: outputInfo.width,
                height: outputInfo.height,
                sizeBytes: finalSize,
                originalSize: originalSize,
                format: outFormat,
                buffer: outputBuffer,
                wasConverted,
                wasResized
            };

            // 13. Cache and Return
            this.processedCache.set(contentHash, result);
            this.emit('processed', { originalFilename, result });
            
            return result;

        } catch (error) {
            this.stats.errors++;
            this.emit('error', { filename: originalFilename, error });
            if (error instanceof EpubImageError) throw error;
            throw new EpubImageError(`Failed to process image buffer: ${error.message}`, 'PROCESS_FAILED', error);
        }
    }

    /**
     * Reads an image from disk, processes it, and writes it to the output directory.
     * 
     * @param {string} inputPath - Path to the source image.
     * @param {string} outputDir - Directory to save the processed image.
     * @returns {Promise<Object>} Metadata of the processed image.
     */
    async processFile(inputPath, outputDir) {
        try {
            const filename = path.basename(inputPath);
            const inputBuffer = await fs.readFile(inputPath);
            
            const result = await this.processBuffer(inputBuffer, filename);
            
            // Ensure output directory exists
            await fs.mkdir(outputDir, { recursive: true });
            
            const outputPath = path.join(outputDir, result.filename);
            
            // Write to disk only if it doesn't already exist (cache hit across different runs)
            try {
                await fs.access(outputPath);
                // File exists, no need to write
            } catch {
                // File does not exist, write it
                await fs.writeFile(outputPath, result.buffer);
            }

            // Return result without the raw buffer to save memory in large batches
            const { buffer, ...metadataOnly } = result;
            return metadataOnly;

        } catch (error) {
            throw new EpubImageError(`Failed to process file ${inputPath}: ${error.message}`, 'FILE_PROCESS_FAILED', error);
        }
    }

    /**
     * Batch processes an array of image file paths with concurrency control.
     * 
     * @param {string[]} filePaths - Array of absolute or relative file paths.
     * @param {string} outputDir - Directory to save all processed images.
     * @returns {Promise<Object[]>} Array of processed image metadata.
     */
    async batchProcess(filePaths, outputDir) {
        const results = [];
        const queue = [...filePaths];
        const activeWorkers = new Set();
        
        this.emit('batchStart', { total: filePaths.length, outputDir });

        const worker = async () => {
            while (queue.length > 0) {
                const filePath = queue.shift();
                try {
                    const result = await this.processFile(filePath, outputDir);
                    results.push({ originalPath: filePath, ...result, success: true });
                } catch (error) {
                    results.push({ originalPath: filePath, error: error.message, success: false });
                }
            }
        };

        const workers = [];
        const concurrencyLimit = Math.min(this.config.concurrency, filePaths.length);
        
        for (let i = 0; i < concurrencyLimit; i++) {
            const p = worker();
            activeWorkers.add(p);
            workers.push(p);
            p.finally(() => activeWorkers.delete(p));
        }

        await Promise.all(workers);
        
        this.emit('batchComplete', { stats: this.stats, totalProcessed: results.length });
        return results;
    }

    /**
     * Generates an EPUB OPF Manifest XML fragment for the processed images.
     * 
     * @param {Object[]} processedImages - Array of metadata objects returned by batchProcess.
     * @param {string} [hrefPrefix='images/'] - Prefix for the href attribute in the OPF.
     * @returns {string} XML string containing <item> tags.
     */
    generateOpfManifest(processedImages, hrefPrefix = 'images/') {
        // Deduplicate by filename to ensure valid XML ID uniqueness
        const uniqueItems = new Map();
        
        for (const img of processedImages) {
            if (img.success && !uniqueItems.has(img.filename)) {
                uniqueItems.set(img.filename, img);
            }
        }

        let xml = '<!-- Antigravity Image Manifest -->\n';
        for (const [filename, img] of uniqueItems.entries()) {
            // Generate a safe XML ID
            const id = `img_${img.hash}`;
            xml += `<item id="${id}" href="${hrefPrefix}${filename}" media-type="${img.mimeType}" />\n`;
        }

        return xml;
    }

    /**
     * Retrieves the current processing statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        return { ...this.stats };
    }
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Recursively scans a directory for image files.
 * @param {string} dir - Directory to scan.
 * @returns {Promise<string[]>} Array of absolute file paths.
 */
async function scanForImages(dir) {
    const validExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp', '.svg']);
    let results = [];
    
    try {
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of list) {
            const res = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                results = results.concat(await scanForImages(res));
            } else {
                const ext = path.extname(res).toLowerCase();
                if (validExtensions.has(ext)) {
                    results.push(res);
                }
            }
        }
    } catch (err) {
        console.error(`[Warning] Failed to scan directory ${dir}: ${err.message}`);
    }
    
    return results;
}

// -----------------------------------------------------------------------------
// CLI Execution Wrapper
// -----------------------------------------------------------------------------

/**
 * If the script is run directly from the command line, execute the CLI interface.
 * Usage: node core/epub-images.js <input_dir> <output_dir>
 */
if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        if (args.length < 2) {
            console.log(`
Antigravity EPUB Image Pipeline (v3.0.0-beast)
----------------------------------------------
Usage: node epub-images.js <input_dir> <output_dir>

Normalizes, optimizes, and hashes images for deterministic EPUB generation.
Converts unsupported formats to JPEG/PNG, resizes large images, and strips EXIF.
            `);
            process.exit(0);
        }

        const inputDir = path.resolve(args[0]);
        const outputDir = path.resolve(args[1]);

        console.log(`[INFO] Initializing pipeline...`);
        console.log(`[INFO] Input Directory:  ${inputDir}`);
        console.log(`[INFO] Output Directory: ${outputDir}`);

        const pipeline = new EpubImagePipeline();

        // Event Listeners for Real-time Logging
        pipeline.on('duplicate', ({ filename, hash }) => {
            console.log(`[SKIP] ${filename} (Duplicate content, hash: ${hash})`);
        });

        pipeline.on('processed', ({ originalFilename, result }) => {
            const actions = [];
            if (result.wasConverted) actions.push('Converted');
            if (result.wasResized) actions.push('Resized');
            const actionStr = actions.length > 0 ? ` [${actions.join(', ')}]` : '';
            
            const kbSaved = ((result.originalSize - result.sizeBytes) / 1024).toFixed(1);
            const savedStr = result.originalSize > result.sizeBytes ? ` (-${kbSaved}KB)` : '';

            console.log(`[ OK ] ${originalFilename} -> ${result.filename}${actionStr}${savedStr}`);
        });

        pipeline.on('error', ({ filename, error }) => {
            console.error(`[ERR ] Failed to process ${filename}: ${error.message}`);
        });

        try {
            console.log(`[INFO] Scanning for images...`);
            const images = await scanForImages(inputDir);
            
            if (images.length === 0) {
                console.log(`[INFO] No images found in ${inputDir}. Exiting.`);
                process.exit(0);
            }

            console.log(`[INFO] Found ${images.length} images. Starting batch processing...`);
            
            const startTime = Date.now();
            const results = await pipeline.batchProcess(images, outputDir);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            const stats = pipeline.getStats();
            const mbSaved = (stats.bytesSaved / (1024 * 1024)).toFixed(2);

            console.log(`\n==============================================`);
            console.log(` PIPELINE COMPLETE IN ${duration}s`);
            console.log(`==============================================`);
            console.log(` Total Scanned:       ${images.length}`);
            console.log(` Successfully Output: ${stats.processed}`);
            console.log(` Format Conversions:  ${stats.converted}`);
            console.log(` Resized Images:      ${stats.resized}`);
            console.log(` Duplicates Skipped:  ${stats.duplicatesSkipped}`);
            console.log(` Errors Encountered:  ${stats.errors}`);
            console.log(` Storage Saved:       ${mbSaved} MB`);
            console.log(`==============================================\n`);

            // Generate and save OPF manifest fragment for convenience
            const manifestXml = pipeline.generateOpfManifest(results);
            const manifestPath = path.join(outputDir, 'image_manifest.xml');
            await fs.writeFile(manifestPath, manifestXml);
            console.log(`[INFO] Generated OPF manifest fragment at: ${manifestPath}`);

        } catch (error) {
            console.error(`[FATAL] Pipeline execution failed:`, error);
            process.exit(1);
        }
    })();
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    EpubImagePipeline,
    EpubImageError,
    DEFAULT_CONFIG,
    scanForImages
};