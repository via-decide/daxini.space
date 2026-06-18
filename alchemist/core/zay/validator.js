(function(global) {
    'use strict';

    function validateZayBundle(bundlePayload) {
        // bundlePayload should be an object with the JSON strings or parsed objects
        const errors = [];
        
        try {
            const manifest = typeof bundlePayload.manifest === 'string' ? JSON.parse(bundlePayload.manifest) : bundlePayload.manifest;
            if (!manifest || manifest.format !== '.zay') {
                errors.push("Invalid or missing manifest.format");
            }
            if (!manifest.sessionId) {
                errors.push("Missing sessionId in manifest");
            }
            
            const cards = typeof bundlePayload.cards === 'string' ? JSON.parse(bundlePayload.cards) : bundlePayload.cards;
            if (!cards || !Array.isArray(cards.items)) {
                errors.push("Invalid cards.json structure");
            }
        } catch (e) {
            errors.push("Parse error in bundle contents: " + e.message);
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    global.ZayValidator = {
        validateZayBundle: validateZayBundle
    };

})(typeof window !== 'undefined' ? window : globalThis);
