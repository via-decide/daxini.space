/**
 * @file core/search.js
 * @description Advanced Full-Text Search Engine for EPUB content.
 * Provides indexing, tokenization, stemming, inverted index generation,
 * fast phrase matching, snippet generation, and DOM-safe highlighting.
 * Designed to be framework-agnostic and highly performant for large books.
 * 
 * Features:
 * - Asynchronous non-blocking indexing
 * - Embedded Porter Stemmer for robust English word matching
 * - DOM Text Mapping: Maps continuous text back to fragmented HTML text nodes
 * - Exact phrase matching and prefix matching
 * - Safe DOM highlighting using Range API
 */

'use strict';

// ============================================================================
// 1. CONSTANTS & CONFIGURATION
// ============================================================================

const SEARCH_CONFIG = {
    SNIPPET_PADDING: 60, // Characters to show before and after match
    MAX_RESULTS_PER_CHAPTER: 100,
    MIN_WORD_LENGTH: 2,
    ENABLE_STEMMING: true,
    CHUNK_PROCESSING_TIME: 15, // ms to process before yielding to main thread
};

const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", 
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", 
    "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", 
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", 
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", 
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", 
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", 
    "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", 
    "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", 
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", 
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", 
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", 
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves", 
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", 
    "they've", "this", "those", "through", "to", "too", "under", "until", "up", 
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", 
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which", 
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", 
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", 
    "yourself", "yourselves"
]);

// ============================================================================
// 2. UTILITIES & ALGORITHMS
// ============================================================================

/**
 * Yields control back to the main thread to prevent UI freezing during heavy tasks.
 * @returns {Promise<void>}
 */
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Normalizes text: removes diacritics, converts to lowercase.
 * @param {string} text 
 * @returns {string}
 */
const normalizeText = (text) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

/**
 * Embedded Porter Stemmer Algorithm
 * Reduces words to their root form to improve search recall.
 */
const PorterStemmer = {
    step1a: function(word) {
        if (word.endsWith('sses')) return word.slice(0, -2);
        if (word.endsWith('ies')) return word.slice(0, -2);
        if (word.endsWith('ss')) return word;
        if (word.endsWith('s')) return word.slice(0, -1);
        return word;
    },
    step1b: function(word) {
        const mgr0 = /^[a-z]*[aeiouy][a-z]+/.test(word);
        if (word.endsWith('eed')) {
            if (/^[a-z]*[aeiouy][a-z]+eed$/.test(word)) return word.slice(0, -1);
            return word;
        }
        if (word.endsWith('ed')) {
            if (/.*[aeiouy].*ed$/.test(word)) {
                word = word.slice(0, -2);
                return this.step1bHelper(word);
            }
            return word;
        }
        if (word.endsWith('ing')) {
            if (/.*[aeiouy].*ing$/.test(word)) {
                word = word.slice(0, -3);
                return this.step1bHelper(word);
            }
            return word;
        }
        return word;
    },
    step1bHelper: function(word) {
        if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) return word + 'e';
        if (/([^aeiouylsz])\1$/.test(word)) return word.slice(0, -1);
        if (/^[^aeiouy]+[aeiouy][^aeiouywxY]$/.test(word)) return word + 'e';
        return word;
    },
    step1c: function(word) {
        if (word.endsWith('y') && /.*[aeiouy].*y$/.test(word)) return word.slice(0, -1) + 'i';
        return word;
    },
    stem: function(word) {
        if (word.length < 3) return word;
        let w = this.step1a(word);
        w = this.step1b(w);
        w = this.step1c(w);
        // Truncated stemmer for performance and size constraints. 
        // Steps 2-5 omitted as Step 1 handles the vast majority of English plural/gerund cases.
        return w;
    }
};

/**
 * Tokenizes a string into words, keeping track of their original positions.
 * @param {string} text 
 * @returns {Array<{token: string, start: number, end: number}>}
 */
const tokenizeWithPositions = (text) => {
    const tokens = [];
    const regex = /[a-zA-Z0-9\u00C0-\u024F]+/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        let word = normalizeText(match[0]);
        if (word.length >= SEARCH_CONFIG.MIN_WORD_LENGTH) {
            tokens.push({
                token: SEARCH_CONFIG.ENABLE_STEMMING ? PorterStemmer.stem(word) : word,
                original: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
    }
    return tokens;
};

// ============================================================================
// 3. DOM TEXT MAPPING
// ============================================================================

/**
 * Maps a continuous string back to the fragmented Text Nodes in an HTML Document.
 * This is crucial for highlighting text that spans across HTML tags (e.g., "hel<b>l</b>o").
 */
class DOMTextMapper {
    constructor() {
        this.textNodes = [];
        this.fullText = "";
        this.nodePositions = []; // Maps character offsets to specific text nodes
    }

    /**
     * Parses an HTML string or Document, extracting text and building the map.
     * @param {Document|string} content 
     */
    parse(content) {
        let doc;
        if (typeof content === 'string') {
            const parser = new DOMParser();
            doc = parser.parseFromString(content, 'text/html');
        } else {
            doc = content;
        }

        this.textNodes = [];
        this.fullText = "";
        this.nodePositions = [];

        this._walkDOM(doc.body || doc);
        return {
            fullText: this.fullText,
            mapper: this
        };
    }

    /**
     * Recursively walks the DOM tree to extract text nodes.
     * @param {Node} node 
     */
    _walkDOM(node) {
        // Skip scripts, styles, and hidden elements
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text.length > 0) {
                const start = this.fullText.length;
                this.fullText += text;
                const end = this.fullText.length;
                
                // Store mapping
                this.textNodes.push(node);
                this.nodePositions.push({ node, start, end });
            }
        } else {
            for (let child of node.childNodes) {
                this._walkDOM(child);
            }
            // Add space for block elements to prevent words from merging
            if (node.nodeType === Node.ELEMENT_NODE) {
                const display = window.getComputedStyle ? window.getComputedStyle(node).display : 'block';
                if (display === 'block' || display === 'p' || display === 'div') {
                    this.fullText += " ";
                }
            }
        }
    }

    /**
     * Finds the specific DOM Text Nodes and local offsets for a given absolute text range.
     * @param {number} start Absolute start character index
     * @param {number} end Absolute end character index
     * @returns {Array<{node: Text, startOffset: number, endOffset: number}>}
     */
    getNodesForRange(start, end) {
        const result = [];
        for (const pos of this.nodePositions) {
            if (pos.end <= start) continue; // Node is before range
            if (pos.start >= end) break;    // Node is after range

            // Overlap found
            const localStart = Math.max(0, start - pos.start);
            const localEnd = Math.min(pos.node.textContent.length, end - pos.start);
            
            result.push({
                node: pos.node,
                startOffset: localStart,
                endOffset: localEnd
            });
        }
        return result;
    }
}

// ============================================================================
// 4. INVERTED INDEX CORE
// ============================================================================

/**
 * High-performance inverted index for full-text search.
 */
class InvertedIndex {
    constructor() {
        // Map<token, Map<chapterId, Array<positions>>>
        this.index = new Map();
        // Map<chapterId, { title, fullText, mapper }>
        this.documents = new Map();
    }

    /**
     * Adds a document to the index.
     * @param {string} chapterId Unique identifier for the chapter
     * @param {string} title Chapter title for display
     * @param {string} fullText Extracted plain text of the chapter
     * @param {DOMTextMapper} mapper Associated text mapper
     */
    async addDocument(chapterId, title, fullText, mapper) {
        this.documents.set(chapterId, { title, fullText, mapper });
        
        const tokens = tokenizeWithPositions(fullText);
        let startTime = performance.now();

        for (let i = 0; i < tokens.length; i++) {
            const { token, start, end } = tokens[i];
            
            if (STOP_WORDS.has(token)) continue;

            if (!this.index.has(token)) {
                this.index.set(token, new Map());
            }

            const tokenMap = this.index.get(token);
            if (!tokenMap.has(chapterId)) {
                tokenMap.set(chapterId, []);
            }

            tokenMap.get(chapterId).push({ start, end, index: i });

            // Yield to main thread periodically to prevent blocking UI
            if (performance.now() - startTime > SEARCH_CONFIG.CHUNK_PROCESSING_TIME) {
                await yieldToMain();
                startTime = performance.now();
            }
        }
    }

    /**
     * Searches the index for a given query string.
     * @param {string} query 
     * @returns {Array<Object>} Unsorted, unformatted match objects
     */
    search(query) {
        const queryTokens = tokenizeWithPositions(query)
            .filter(t => !STOP_WORDS.has(t.token))
            .map(t => t.token);

        if (queryTokens.length === 0) return [];

        // Single word search
        if (queryTokens.length === 1) {
            const token = queryTokens[0];
            return this._findTokenMatches(token);
        }

        // Multi-word phrase search (intersection of documents)
        return this._findPhraseMatches(queryTokens);
    }

    /**
     * Finds matches for a single token, including prefix matches.
     * @param {string} token 
     * @private
     */
    _findTokenMatches(token) {
        const results = [];
        
        // Exact and prefix matching
        for (const [indexedToken, docMap] of this.index.entries()) {
            if (indexedToken === token || indexedToken.startsWith(token)) {
                for (const [chapterId, positions] of docMap.entries()) {
                    positions.forEach(pos => {
                        results.push({
                            chapterId,
                            start: pos.start,
                            end: pos.end,
                            score: indexedToken === token ? 1.0 : 0.5 // Exact matches score higher
                        });
                    });
                }
            }
        }
        return results;
    }

    /**
     * Finds exact phrase matches by ensuring tokens appear sequentially.
     * @param {Array<string>} tokens 
     * @private
     */
    _findPhraseMatches(tokens) {
        const results = [];
        
        // Get doc maps for all tokens
        const tokenDocMaps = tokens.map(t => this.index.get(t));
        
        // If any token is completely missing, the phrase cannot exist
        if (tokenDocMaps.some(map => !map)) return [];

        // Find documents that contain ALL tokens
        const firstTokenMap = tokenDocMaps[0];
        const commonChapterIds = Array.from(firstTokenMap.keys()).filter(chapterId => {
            return tokenDocMaps.every(map => map.has(chapterId));
        });

        // Check sequence in common documents
        for (const chapterId of commonChapterIds) {
            const firstTokenPositions = firstTokenMap.get(chapterId);
            
            for (const pos of firstTokenPositions) {
                let isMatch = true;
                let currentEnd = pos.end;
                
                // Verify subsequent tokens follow immediately
                for (let i = 1; i < tokens.length; i++) {
                    const nextTokenPositions = tokenDocMaps[i].get(chapterId);
                    // Look for a position where the token index is exactly previous + 1
                    const expectedIndex = pos.index + i;
                    const nextPos = nextTokenPositions.find(p => p.index === expectedIndex);
                    
                    if (!nextPos) {
                        isMatch = false;
                        break;
                    }
                    currentEnd = nextPos.end;
                }

                if (isMatch) {
                    results.push({
                        chapterId,
                        start: pos.start,
                        end: currentEnd,
                        score: 2.0 // Phrase matches score highest
                    });
                }
            }
        }
        
        return results;
    }

    /**
     * Retrieves the document metadata by ID.
     * @param {string} chapterId 
     */
    getDocument(chapterId) {
        return this.documents.get(chapterId);
    }
}

// ============================================================================
// 5. MAIN SEARCH ENGINE FACADE
// ============================================================================

/**
 * The primary interface for EPUB Full-Text Search.
 * Handles indexing pipelines, search execution, snippet generation, and highlighting.
 */
export class EpubSearchEngine {
    constructor() {
        this.index = new InvertedIndex();
        this.isIndexing = false;
        this.progressCallback = null;
    }

    /**
     * Sets a callback to be notified of indexing progress.
     * @param {Function} callback Function receiving (current, total, chapterTitle)
     */
    onProgress(callback) {
        this.progressCallback = callback;
    }

    /**
     * Builds the search index from an array of chapter objects.
     * @param {Array<{id: string, title: string, content: string|Document}>} chapters 
     * @returns {Promise<void>}
     */
    async indexBook(chapters) {
        if (this.isIndexing) throw new Error("Indexing already in progress.");
        this.isIndexing = true;

        try {
            const total = chapters.length;
            for (let i = 0; i < total; i++) {
                const chapter = chapters[i];
                
                if (this.progressCallback) {
                    this.progressCallback(i + 1, total, chapter.title);
                }

                const mapper = new DOMTextMapper();
                const { fullText } = mapper.parse(chapter.content);
                
                await this.index.addDocument(chapter.id, chapter.title, fullText, mapper);
            }
        } finally {
            this.isIndexing = false;
        }
    }

    /**
     * Executes a search query and returns formatted, sorted results with snippets.
     * @param {string} query The search string
     * @returns {Array<Object>} Formatted search results
     */
    search(query) {
        if (!query || query.trim().length === 0) return [];

        const rawMatches = this.index.search(query);
        
        // Group by chapter, generate snippets, and sort
        const formattedResults = rawMatches.map(match => {
            const doc = this.index.getDocument(match.chapterId);
            const snippet = this._generateSnippet(doc.fullText, match.start, match.end);
            
            return {
                chapterId: match.chapterId,
                chapterTitle: doc.title,
                start: match.start,
                end: match.end,
                snippet: snippet.html,
                matchText: snippet.matchText,
                score: match.score
            };
        });

        // Sort by score (descending), then chapterId, then start position
        formattedResults.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.chapterId !== b.chapterId) return a.chapterId.localeCompare(b.chapterId);
            return a.start - b.start;
        });

        // Deduplicate overlapping matches
        return this._deduplicateResults(formattedResults);
    }

    /**
     * Generates a context snippet around the matched text.
     * @param {string} text Full chapter text
     * @param {number} start Match start index
     * @param {number} end Match end index
     * @private
     */
    _generateSnippet(text, start, end) {
        const pad = SEARCH_CONFIG.SNIPPET_PADDING;
        
        let snipStart = Math.max(0, start - pad);
        let snipEnd = Math.min(text.length, end + pad);

        // Adjust to word boundaries
        if (snipStart > 0) {
            const spaceIdx = text.indexOf(' ', snipStart);
            if (spaceIdx !== -1 && spaceIdx < start) {
                snipStart = spaceIdx + 1;
            }
        }
        if (snipEnd < text.length) {
            const spaceIdx = text.lastIndexOf(' ', snipEnd);
            if (spaceIdx !== -1 && spaceIdx > end) {
                snipEnd = spaceIdx;
            }
        }

        const prefix = text.substring(snipStart, start);
        const matchText = text.substring(start, end);
        const suffix = text.substring(end, snipEnd);

        // Escape HTML to prevent XSS in UI
        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        return {
            matchText,
            html: `${escapeHtml(prefix)}<mark class="search-highlight">${escapeHtml(matchText)}</mark>${escapeHtml(suffix)}`
        };
    }

    /**
     * Removes overlapping results (e.g., if searching for "the the", don't return double overlapping matches).
     * @param {Array<Object>} results 
     * @private
     */
    _deduplicateResults(results) {
        const deduplicated = [];
        let lastResult = null;

        for (const res of results) {
            if (!lastResult || lastResult.chapterId !== res.chapterId) {
                deduplicated.push(res);
                lastResult = res;
            } else {
                // If this result overlaps with the last one, skip it
                if (res.start < lastResult.end) continue;
                deduplicated.push(res);
                lastResult = res;
            }
        }
        return deduplicated;
    }

    /**
     * Highlights a specific search result within the actual DOM Document.
     * @param {Document} targetDocument The DOM Document where the chapter is rendered
     * @param {Object} searchResult A single result object returned from `search()`
     * @returns {boolean} True if highlighting was successful
     */
    highlightResult(targetDocument, searchResult) {
        if (!targetDocument || !searchResult) return false;

        this.clearHighlights(targetDocument);

        const docMeta = this.index.getDocument(searchResult.chapterId);
        if (!docMeta) return false;

        const nodesToHighlight = docMeta.mapper.getNodesForRange(searchResult.start, searchResult.end);
        if (nodesToHighlight.length === 0) return false;

        try {
            // Using standard DOM Range and Selection to apply highlights safely
            const range = targetDocument.createRange();
            
            // Handle multi-node highlighting by wrapping text nodes
            nodesToHighlight.forEach(({ node, startOffset, endOffset }) => {
                // If the node is already processed or detached, skip
                if (!node.parentNode) return;

                const nodeRange = targetDocument.createRange();
                nodeRange.setStart(node, startOffset);
                nodeRange.setEnd(node, endOffset);

                const mark = targetDocument.createElement('mark');
                mark.className = 'epub-search-active-highlight';
                mark.style.backgroundColor = '#ffeb3b';
                mark.style.color = '#000';
                
                nodeRange.surroundContents(mark);
            });

            // Scroll the first highlighted element into view
            const firstMark = targetDocument.querySelector('.epub-search-active-highlight');
            if (firstMark) {
                firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            return true;
        } catch (error) {
            console.error("SearchEngine: Failed to highlight result.", error);
            return false;
        }
    }

    /**
     * Clears all active search highlights from the given document.
     * @param {Document} targetDocument 
     */
    clearHighlights(targetDocument) {
        if (!targetDocument) return;
        const marks = targetDocument.querySelectorAll('mark.epub-search-active-highlight');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            // Normalize merges adjacent text nodes back together
            parent.normalize(); 
        });
    }

    /**
     * Gets statistics about the current search index.
     * @returns {Object}
     */
    getStats() {
        return {
            totalChapters: this.index.documents.size,
            uniqueTokens: this.index.index.size,
            isIndexing: this.isIndexing
        };
    }
}