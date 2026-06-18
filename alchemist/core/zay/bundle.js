(function(global) {
    'use strict';

    // -------------------------------------------------------------
    // ZERO-DEPENDENCY NATIVE ZIP COMPRESSION (Copied from epub-exporter.js)
    // -------------------------------------------------------------
    function crc32(bytes) {
        var table = crc32.table || (crc32.table = (function () {
            var out = [];
            for (var n = 0; n < 256; n += 1) {
                var c = n;
                for (var k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
                out[n] = c >>> 0;
            }
            return out;
        })());
        var crc = 0 ^ -1;
        for (var i = 0; i < bytes.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
        return (crc ^ -1) >>> 0;
    }

    function utf8(value) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value);
        return Buffer.from(value, 'utf8'); // Fallback for Node environments
    }

    function writeUint16(out, value) { out.push(value & 0xff, (value >>> 8) & 0xff); }
    function writeUint32(out, value) { out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); }
    function dosTime() { return { time: 0, date: 33 }; }

    function createZip(entries) {
        var out = [];
        var central = [];
        var offset = 0;
        var stamp = dosTime();
        
        entries.forEach(function (entry) {
            var name = utf8(entry.path);
            var data = entry.bytes || utf8(entry.content || '');
            var crc = crc32(data);
            
            // Local file header
            writeUint32(out, 0x04034b50); 
            writeUint16(out, 20); 
            writeUint16(out, 0); 
            writeUint16(out, 0); 
            writeUint16(out, stamp.time); 
            writeUint16(out, stamp.date); 
            writeUint32(out, crc); 
            writeUint32(out, data.length); 
            writeUint32(out, data.length); 
            writeUint16(out, name.length); 
            writeUint16(out, 0);
            
            Array.prototype.push.apply(out, Array.from(name)); 
            Array.prototype.push.apply(out, Array.from(data));
            
            // Central directory header
            writeUint32(central, 0x02014b50); 
            writeUint16(central, 20); 
            writeUint16(central, 20); 
            writeUint16(central, 0); 
            writeUint16(central, 0); 
            writeUint16(central, stamp.time); 
            writeUint16(central, stamp.date); 
            writeUint32(central, crc); 
            writeUint32(central, data.length); 
            writeUint32(central, data.length); 
            writeUint16(central, name.length); 
            writeUint16(central, 0); 
            writeUint16(central, 0); 
            writeUint16(central, 0); 
            writeUint16(central, 0); 
            writeUint32(central, 0); 
            writeUint32(central, offset);
            
            Array.prototype.push.apply(central, Array.from(name));
            offset = out.length;
        });
        
        var centralOffset = out.length;
        Array.prototype.push.apply(out, central);
        
        // End of central directory record
        writeUint32(out, 0x06054b50); 
        writeUint16(out, 0); 
        writeUint16(out, 0); 
        writeUint16(out, entries.length); 
        writeUint16(out, entries.length); 
        writeUint32(out, central.length); 
        writeUint32(out, centralOffset); 
        writeUint16(out, 0);
        
        return new Uint8Array(out);
    }
    // -------------------------------------------------------------

    function createZayBundle(payload) {
        const entries = [
            { path: 'manifest.json', content: payload.manifest },
            { path: 'cards.json', content: payload.cards },
            { path: 'entities.json', content: payload.entities },
            { path: 'graph.json', content: payload.graph },
            { path: 'metadata.json', content: payload.metadata }
        ];

        const zipBytes = createZip(entries);
        return new Blob([zipBytes], { type: 'application/zip' });
    }

    function downloadZayBundle() {
        if (!global.ZayExportAdapter) {
            console.error("ZayExportAdapter not found. Cannot generate bundle.");
            return;
        }

        const sessionId = global.CURRENT_SES_ID || "UNKNOWN";
        const payload = global.ZayExportAdapter.buildZayPayload();
        const blob = createZayBundle(payload);
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `ALCHEMIST_${sessionId}.zay`;
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    global.ZayBundler = {
        createZayBundle: createZayBundle,
        downloadZayBundle: downloadZayBundle
    };

})(typeof window !== 'undefined' ? window : globalThis);
