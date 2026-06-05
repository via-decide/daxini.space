# EPUB Engine Status

## Current status: DISCONNECTED

The `core/` directory contains a standalone EPUB reader/parser/renderer engine. It is real code, but it currently uses ES module syntax such as `export class` and `export default`.

The shipped Alchemist app is `index.html`, which loads browser-first IIFE modules with classic `<script>` tags and no bundler. Because of that mismatch, `core/*.js` is not currently loaded by the app.

## Export EPUB vs reader EPUB

The session EPUB and Knowledge Book EPUB features are export features implemented in `kernel/alchemist/epub-exporter.js`. They generate EPUB files in the browser.

The `core/` engine is a reader feature. It would parse and render existing EPUB files. It is separate from export generation.

## Future integration options

1. Add a bundler such as esbuild/Vite and bundle the EPUB reader for the browser.
2. Convert the reader modules to IIFE modules compatible with the existing no-bundler app.
3. Keep `core/` isolated as a standalone library until an EPUB reader UI is explicitly prioritized.

No `core/*.js` files should be added to `index.html` as classic scripts.
