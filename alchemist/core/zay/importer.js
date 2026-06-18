(function(global) {
    'use strict';

    /**
     * Parse uncompressed ZIP binary using DataView.
     * Expects ZIP entries generated with compression method 0.
     */
    function extractUncompressedZip(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        const decoder = new TextDecoder("utf-8");
        const files = {};
        let offset = 0;

        while (offset < view.byteLength - 4) {
            // Check for Local File Header Signature: 0x04034b50 (little endian: 0x504b0304)
            const signature = view.getUint32(offset, true);
            if (signature !== 0x04034b50) {
                // If it's a Central Directory Header (0x02014b50), we reached the end of local files
                if (signature === 0x02014b50 || signature === 0x06054b50) {
                    break;
                }
                // Try scanning forward byte by byte in case of unexpected padding
                offset++;
                continue;
            }

            const compression = view.getUint16(offset + 8, true);
            if (compression !== 0) {
                throw new Error("Cannot extract compressed ZIP natively. Expected compression method 0.");
            }

            const compressedSize = view.getUint32(offset + 18, true);
            const fileNameLen = view.getUint16(offset + 26, true);
            const extraFieldLen = view.getUint16(offset + 28, true);

            const nameOffset = offset + 30;
            const fileNameBytes = new Uint8Array(arrayBuffer, nameOffset, fileNameLen);
            const fileName = decoder.decode(fileNameBytes);

            const dataOffset = nameOffset + fileNameLen + extraFieldLen;
            const dataBytes = new Uint8Array(arrayBuffer, dataOffset, compressedSize);
            const fileData = decoder.decode(dataBytes);

            files[fileName] = fileData;
            
            // Move to next file header
            offset = dataOffset + compressedSize;
        }

        return files;
    }

    function hydrateSession(files) {
        if (!global.ZayValidator) {
            throw new Error("ZayValidator not found.");
        }

        const validation = global.ZayValidator.validateZayBundle(files);
        if (!validation.valid) {
            throw new Error("Invalid .zay package: " + validation.errors.join(", "));
        }

        const manifest = JSON.parse(files['manifest.json']);
        const cards = JSON.parse(files['cards.json']);
        const metadata = JSON.parse(files['metadata.json'] || "{}");

        // Overwrite active session state in Alchemist
        global.CURRENT_SES_ID = metadata.sessionId || manifest.sessionId;
        global.USER_MOBILE = metadata.user || global.USER_MOBILE;
        global.XP = metadata.score || 0;
        
        // Reconstruct SESSION_ALL from cards.json
        const hydratedSession = cards.items.map(c => ({
            id: c.id,
            q: c.front,
            u: c.back,
            logic: c.logic,
            dom: c.domain
        }));

        global.SESSION_ALL = hydratedSession;
        
        // Return success info
        return {
            sessionId: global.CURRENT_SES_ID,
            cardCount: hydratedSession.length
        };
    }

    function loadZayBundle(fileBlob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const arrayBuffer = e.target.result;
                    const extractedFiles = extractUncompressedZip(arrayBuffer);
                    const result = hydrateSession(extractedFiles);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = function(e) {
                reject(new Error("File read failed."));
            };
            reader.readAsArrayBuffer(fileBlob);
        });
    }

    global.ZayImporter = {
        loadZayBundle: loadZayBundle
    };

})(typeof window !== 'undefined' ? window : globalThis);
