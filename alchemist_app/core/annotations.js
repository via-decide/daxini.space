/**
 * @file annotations.js
 * @description Core Annotation Engine for Alchemist App. 
 * Provides Kindle-like text selection, highlighting, and note-taking capabilities.
 * Supports cross-node selections, robust DOM serialization/deserialization via XPath,
 * local persistence, and a decoupled UI overlay system.
 * 
 * @version 3.0.0-beast
 * @author Antigravity Synthesis Orchestrator
 */

/**
 * @typedef {Object} SerializedRange
 * @property {string} startXPath - XPath to the starting text node's parent.
 * @property {number} startOffset - Character offset within the starting node.
 * @property {string} endXPath - XPath to the ending text node's parent.
 * @property {number} endOffset - Character offset within the ending node.
 */

/**
 * @typedef {Object} Annotation
 * @property {string} id - Unique identifier for the annotation (UUID).
 * @property {string} text - The actual text content that was highlighted.
 * @property {SerializedRange} range - The serialized DOM range for restoration.
 * @property {string} color - The hex or string color of the highlight.
 * @property {string|null} note - Optional user-provided note attached to the highlight.
 * @property {number} createdAt - Epoch timestamp of creation.
 * @property {number} updatedAt - Epoch timestamp of last update.
 */

/**
 * @typedef {Object} HighlightColor
 * @property {string} id - Color identifier.
 * @property {string} hex - Background color hex.
 * @property {string} text - Text color hex.
 */

const ANNOTATION_CONFIG = {
    STORAGE_KEY: 'alchemist_annotations',
    HIGHLIGHT_CLASS: 'alchemist-highlight',
    ACTIVE_HIGHLIGHT_CLASS: 'alchemist-highlight-active',
    TOOLTIP_ID: 'alchemist-annotation-tooltip',
    MODAL_ID: 'alchemist-note-modal',
    SIDEBAR_ID: 'alchemist-annotation-sidebar',
    COLORS: [
        { id: 'yellow', hex: '#ffeb3b', text: '#000000' },
        { id: 'green', hex: '#c8e6c9', text: '#000000' },
        { id: 'blue', hex: '#bbdefb', text: '#000000' },
        { id: 'pink', hex: '#f8bbd0', text: '#000000' },
        { id: 'purple', hex: '#e1bee7', text: '#000000' }
    ],
    DEFAULT_COLOR: 'yellow',
    DEBOUNCE_DELAY: 200,
    Z_INDEX: 9999
};

/* ==========================================================================
 * UTILITY FUNCTIONS
 * ========================================================================== */

/**
 * Generates a standard UUID v4.
 * @returns {string} UUID string.
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Debounces a function call.
 * @param {Function} func - Function to debounce.
 * @param {number} wait - Milliseconds to wait.
 * @returns {Function} Debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generates an XPath for a given DOM element to ensure precise re-selection.
 * @param {Node} element - The DOM node to evaluate.
 * @returns {string} The computed XPath.
 */
function getXPath(element) {
    if (element.id !== '') {
        return 'id("' + element.id + '")';
    }
    if (element === document.body) {
        return element.tagName.toLowerCase();
    }

    let ix = 0;
    const siblings = element.parentNode ? element.parentNode.childNodes : [];
    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element) {
            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
    return '';
}

/**
 * Resolves a DOM node from a given XPath.
 * @param {string} path - The XPath string.
 * @returns {Node|null} The resolved DOM node or null.
 */
function getNodeFromXPath(path) {
    try {
        const evaluator = new XPathEvaluator();
        const result = evaluator.evaluate(path, document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
    } catch (error) {
        console.error(`[Alchemist Annotations] Failed to resolve XPath: ${path}`, error);
        return null;
    }
}

/**
 * Retrieves the text node at a specific index within a parent element.
 * Useful for deserializing offsets when DOM structure has changed due to highlights.
 * @param {Node} parent - The parent DOM node.
 * @param {number} offset - The character offset.
 * @returns {{node: Node, offset: number}} The specific text node and local offset.
 */
function getTextNodeAndOffset(parent, offset) {
    const treeWalker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null, false);
    let currentNode = treeWalker.nextNode();
    let currentOffset = 0;

    while (currentNode) {
        const nodeLength = currentNode.nodeValue.length;
        if (currentOffset + nodeLength >= offset) {
            return { node: currentNode, offset: offset - currentOffset };
        }
        currentOffset += nodeLength;
        currentNode = treeWalker.nextNode();
    }

    // Fallback to the last text node if offset exceeds
    return { node: parent.lastChild || parent, offset: parent.lastChild ? parent.lastChild.nodeValue?.length || 0 : 0 };
}

/* ==========================================================================
 * EVENT EMITTER
 * ========================================================================== */

/**
 * Simple Event Bus for decoupled architecture.
 * Allows UI, Engine, and external systems to communicate safely.
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event.
     * @param {string} event - Event name.
     * @param {Function} listener - Callback function.
     */
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    /**
     * Unsubscribe from an event.
     * @param {string} event - Event name.
     * @param {Function} listener - Callback function.
     */
    off(event, listener) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(l => l !== listener);
    }

    /**
     * Emit an event.
     * @param {string} event - Event name.
     * @param {any} payload - Data to pass to listeners.
     */
    emit(event, payload) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => {
            try {
                listener(payload);
            } catch (error) {
                console.error(`[EventEmitter] Error executing listener for event: ${event}`, error);
            }
        });
    }
}

/* ==========================================================================
 * ANNOTATION ENGINE (CORE DOM LOGIC)
 * ========================================================================== */

/**
 * Handles all direct DOM manipulations: wrapping text, unwrapping,
 * serializing ranges, and restoring ranges.
 */
class AnnotationEngine {
    /**
     * @param {HTMLElement} rootElement - The container where annotations are allowed.
     * @param {EventEmitter} eventBus - System event bus.
     */
    constructor(rootElement, eventBus) {
        this.root = rootElement || document.body;
        this.eventBus = eventBus;
    }

    /**
     * Serializes a standard DOM Range object into an XPath-based object for storage.
     * @param {Range} range - The DOM range to serialize.
     * @returns {SerializedRange|null}
     */
    serializeRange(range) {
        try {
            const startNode = range.startContainer;
            const endNode = range.endContainer;

            // Ensure we are working with text nodes or their parents
            const startElement = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode;
            const endElement = endNode.nodeType === Node.TEXT_NODE ? endNode.parentElement : endNode;

            // Calculate absolute offsets relative to the parent element
            const getAbsoluteOffset = (node, offset, parent) => {
                const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null, false);
                let absOffset = 0;
                let current = walker.nextNode();
                while (current && current !== node) {
                    absOffset += current.nodeValue.length;
                    current = walker.nextNode();
                }
                return absOffset + offset;
            };

            const startOffset = getAbsoluteOffset(startNode, range.startOffset, startElement);
            const endOffset = getAbsoluteOffset(endNode, range.endOffset, endElement);

            return {
                startXPath: getXPath(startElement),
                startOffset: startOffset,
                endXPath: getXPath(endElement),
                endOffset: endOffset
            };
        } catch (error) {
            console.error('[AnnotationEngine] Failed to serialize range:', error);
            return null;
        }
    }

    /**
     * Deserializes a stored range object back into a DOM Range.
     * @param {SerializedRange} serialized - The stored range data.
     * @returns {Range|null}
     */
    deserializeRange(serialized) {
        try {
            const startElement = getNodeFromXPath(serialized.startXPath);
            const endElement = getNodeFromXPath(serialized.endXPath);

            if (!startElement || !endElement) {
                console.warn('[AnnotationEngine] Could not locate elements for deserialization.');
                return null;
            }

            const startData = getTextNodeAndOffset(startElement, serialized.startOffset);
            const endData = getTextNodeAndOffset(endElement, serialized.endOffset);

            const range = document.createRange();
            range.setStart(startData.node, startData.offset);
            range.setEnd(endData.node, endData.offset);

            return range;
        } catch (error) {
            console.error('[AnnotationEngine] Failed to deserialize range:', error);
            return null;
        }
    }

    /**
     * Highlights a given DOM Range by wrapping text nodes in <mark> tags.
     * Handles complex selections spanning multiple elements.
     * @param {Range} range - The range to highlight.
     * @param {Annotation} annotation - The annotation metadata.
     */
    highlightRange(range, annotation) {
        const nodesToWrap = [];
        
        // Use a TreeWalker to find all text nodes within the range
        const treeWalker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (range.intersectsNode(node)) {
                        // Ignore whitespace-only nodes
                        if (node.nodeValue.trim() === '') return NodeFilter.FILTER_REJECT;
                        // Ignore already highlighted nodes for THIS specific annotation
                        if (node.parentNode && node.parentNode.dataset.annotationId === annotation.id) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            },
            false
        );

        let currentNode = treeWalker.nextNode();
        while (currentNode) {
            nodesToWrap.push(currentNode);
            currentNode = treeWalker.nextNode();
        }

        if (nodesToWrap.length === 0) return;

        // Process nodes and wrap them
        nodesToWrap.forEach(node => {
            const isStart = node === range.startContainer;
            const isEnd = node === range.endContainer;
            
            let text = node.nodeValue;
            let startIdx = isStart ? range.startOffset : 0;
            let endIdx = isEnd ? range.endOffset : text.length;

            if (startIdx >= endIdx) return; // Skip empty spans

            // Split the text node
            const beforeNode = document.createTextNode(text.substring(0, startIdx));
            const highlightNode = document.createTextNode(text.substring(startIdx, endIdx));
            const afterNode = document.createTextNode(text.substring(endIdx));

            const markElement = document.createElement('mark');
            markElement.className = ANNOTATION_CONFIG.HIGHLIGHT_CLASS;
            markElement.dataset.annotationId = annotation.id;
            markElement.dataset.colorId = annotation.color;
            
            // Apply styling
            const colorConfig = ANNOTATION_CONFIG.COLORS.find(c => c.id === annotation.color) || ANNOTATION_CONFIG.COLORS[0];
            markElement.style.backgroundColor = colorConfig.hex;
            markElement.style.color = colorConfig.text;
            markElement.style.cursor = 'pointer';
            if (annotation.note) {
                markElement.style.borderBottom = `2px solid ${colorConfig.text}`;
            }

            markElement.appendChild(highlightNode);

            const parent = node.parentNode;
            parent.insertBefore(beforeNode, node);
            parent.insertBefore(markElement, node);
            parent.insertBefore(afterNode, node);
            parent.removeChild(node);
        });

        // Clear native selection
        window.getSelection().removeAllRanges();
    }

    /**
     * Removes highlight wrappers for a given annotation ID, restoring original text nodes.
     * @param {string} annotationId - The UUID of the annotation to remove.
     */
    removeHighlight(annotationId) {
        const marks = document.querySelectorAll(`mark[data-annotation-id="${annotationId}"]`);
        marks.forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            // Normalize parent to merge adjacent text nodes
            parent.normalize();
        });
    }

    /**
     * Updates the visual styling of an existing highlight (e.g., color change or note added).
     * @param {Annotation} annotation - The updated annotation object.
     */
    updateHighlightStyle(annotation) {
        const marks = document.querySelectorAll(`mark[data-annotation-id="${annotation.id}"]`);
        const colorConfig = ANNOTATION_CONFIG.COLORS.find(c => c.id === annotation.color) || ANNOTATION_CONFIG.COLORS[0];
        
        marks.forEach(mark => {
            mark.style.backgroundColor = colorConfig.hex;
            mark.style.color = colorConfig.text;
            mark.dataset.colorId = annotation.color;
            if (annotation.note) {
                mark.style.borderBottom = `2px solid ${colorConfig.text}`;
            } else {
                mark.style.borderBottom = 'none';
            }
        });
    }
}

/* ==========================================================================
 * USER INTERFACE (TOOLTIP, MODALS, SIDEBAR)
 * ========================================================================== */

/**
 * Handles all UI elements injected into the document for annotation interaction.
 */
class AnnotationUI {
    /**
     * @param {EventEmitter} eventBus - System event bus.
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.tooltip = null;
        this.modal = null;
        this.sidebar = null;
        this.activeRange = null;
        this.activeAnnotationId = null;

        this.injectStyles();
        this.createTooltip();
        this.createModal();
        this.createSidebar();
        this.setupEventListeners();
    }

    /**
     * Injects necessary CSS for the annotation UI into the document head.
     */
    injectStyles() {
        if (document.getElementById('alchemist-annotation-styles')) return;

        const style = document.createElement('style');
        style.id = 'alchemist-annotation-styles';
        style.textContent = `
            .alchemist-highlight {
                transition: opacity 0.2s ease;
            }
            .alchemist-highlight:hover {
                opacity: 0.8;
            }
            .alchemist-highlight-active {
                outline: 2px dashed #000;
                outline-offset: 2px;
            }
            
            /* Tooltip Styles */
            #${ANNOTATION_CONFIG.TOOLTIP_ID} {
                position: absolute;
                background: #333;
                color: #fff;
                border-radius: 6px;
                padding: 6px 12px;
                display: flex;
                gap: 10px;
                align-items: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: ${ANNOTATION_CONFIG.Z_INDEX};
                transform: translateX(-50%);
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s, visibility 0.2s;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
            }
            #${ANNOTATION_CONFIG.TOOLTIP_ID}.visible {
                opacity: 1;
                visibility: visible;
            }
            #${ANNOTATION_CONFIG.TOOLTIP_ID}::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                margin-left: -6px;
                border-width: 6px;
                border-style: solid;
                border-color: #333 transparent transparent transparent;
            }
            .alchemist-color-btn {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid transparent;
                cursor: pointer;
                transition: transform 0.1s;
            }
            .alchemist-color-btn:hover {
                transform: scale(1.2);
            }
            .alchemist-action-btn {
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .alchemist-action-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            .alchemist-divider {
                width: 1px;
                height: 20px;
                background: rgba(255,255,255,0.2);
            }

            /* Modal Styles */
            #${ANNOTATION_CONFIG.MODAL_ID} {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: ${ANNOTATION_CONFIG.Z_INDEX + 1};
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s;
            }
            #${ANNOTATION_CONFIG.MODAL_ID}.visible {
                opacity: 1;
                visibility: visible;
            }
            .alchemist-modal-content {
                background: #fff;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                padding: 24px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                font-family: system-ui, -apple-system, sans-serif;
            }
            .alchemist-modal-header {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                color: #333;
            }
            .alchemist-modal-quote {
                border-left: 4px solid #e0e0e0;
                padding-left: 12px;
                color: #666;
                font-style: italic;
                margin-bottom: 16px;
                max-height: 100px;
                overflow-y: auto;
            }
            .alchemist-modal-textarea {
                width: 100%;
                height: 120px;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 12px;
                font-size: 14px;
                resize: vertical;
                box-sizing: border-box;
                margin-bottom: 16px;
            }
            .alchemist-modal-textarea:focus {
                outline: none;
                border-color: #2196f3;
            }
            .alchemist-modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            .alchemist-btn {
                padding: 8px 16px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-weight: 500;
            }
            .alchemist-btn-cancel {
                background: #f5f5f5;
                color: #333;
            }
            .alchemist-btn-save {
                background: #2196f3;
                color: #fff;
            }

            /* Sidebar Styles */
            #${ANNOTATION_CONFIG.SIDEBAR_ID} {
                position: fixed;
                top: 0;
                right: -350px;
                width: 350px;
                height: 100vh;
                background: #fafafa;
                box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                z-index: ${ANNOTATION_CONFIG.Z_INDEX};
                transition: right 0.3s ease;
                display: flex;
                flex-direction: column;
                font-family: system-ui, -apple-system, sans-serif;
            }
            #${ANNOTATION_CONFIG.SIDEBAR_ID}.open {
                right: 0;
            }
            .alchemist-sidebar-header {
                padding: 20px;
                background: #fff;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .alchemist-sidebar-header h2 {
                margin: 0;
                font-size: 18px;
                color: #333;
            }
            .alchemist-sidebar-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
            }
            .alchemist-sidebar-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            .alchemist-sidebar-item {
                background: #fff;
                border-radius: 6px;
                padding: 16px;
                margin-bottom: 16px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                border-left: 4px solid transparent;
                cursor: pointer;
            }
            .alchemist-sidebar-item:hover {
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            .alchemist-sidebar-item-text {
                font-size: 13px;
                color: #555;
                margin-bottom: 8px;
                line-height: 1.4;
            }
            .alchemist-sidebar-item-note {
                font-size: 14px;
                color: #111;
                background: #f9f9f9;
                padding: 8px;
                border-radius: 4px;
            }
            .alchemist-sidebar-item-meta {
                font-size: 11px;
                color: #999;
                margin-top: 8px;
                display: flex;
                justify-content: space-between;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Creates the floating tooltip for highlighting and actions.
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = ANNOTATION_CONFIG.TOOLTIP_ID;

        // Color Buttons
        ANNOTATION_CONFIG.COLORS.forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'alchemist-color-btn';
            btn.style.backgroundColor = color.hex;
            btn.title = `Highlight ${color.id}`;
            btn.onclick = (e) => {
                e.stopPropagation();
                if (this.activeAnnotationId) {
                    this.eventBus.emit('UI:CHANGE_COLOR', { id: this.activeAnnotationId, color: color.id });
                } else if (this.activeRange) {
                    this.eventBus.emit('UI:CREATE_HIGHLIGHT', { range: this.activeRange, color: color.id });
                }
                this.hideTooltip();
            };
            this.tooltip.appendChild(btn);
        });

        const divider = document.createElement('div');
        divider.className = 'alchemist-divider';
        this.tooltip.appendChild(divider);

        // Add/Edit Note Button
        this.noteBtn = document.createElement('button');
        this.noteBtn.className = 'alchemist-action-btn';
        this.noteBtn.innerHTML = '📝 Note';
        this.noteBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.activeAnnotationId) {
                this.eventBus.emit('UI:REQUEST_NOTE_EDIT', this.activeAnnotationId);
            } else if (this.activeRange) {
                // Create highlight first, then open note modal
                this.eventBus.emit('UI:CREATE_HIGHLIGHT_WITH_NOTE', { range: this.activeRange, color: ANNOTATION_CONFIG.DEFAULT_COLOR });
            }
            this.hideTooltip();
        };
        this.tooltip.appendChild(this.noteBtn);

        // Delete Button
        this.deleteBtn = document.createElement('button');
        this.deleteBtn.className = 'alchemist-action-btn';
        this.deleteBtn.innerHTML = '🗑️';
        this.deleteBtn.style.display = 'none'; // Hidden by default, shown when editing
        this.deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.activeAnnotationId) {
                this.eventBus.emit('UI:DELETE_ANNOTATION', this.activeAnnotationId);
            }
            this.hideTooltip();
        };
        this.tooltip.appendChild(this.deleteBtn);

        document.body.appendChild(this.tooltip);
    }

    /**
     * Creates the modal for writing notes.
     */
    createModal() {
        this.modal = document.createElement('div');
        this.modal.id = ANNOTATION_CONFIG.MODAL_ID;
        
        this.modal.innerHTML = `
            <div class="alchemist-modal-content" onclick="event.stopPropagation()">
                <div class="alchemist-modal-header">Add Note</div>
                <div class="alchemist-modal-quote" id="alchemist-modal-quote-text"></div>
                <textarea class="alchemist-modal-textarea" id="alchemist-modal-input" placeholder="Type your notes here..."></textarea>
                <div class="alchemist-modal-actions">
                    <button class="alchemist-btn alchemist-btn-cancel" id="alchemist-modal-cancel">Cancel</button>
                    <button class="alchemist-btn alchemist-btn-save" id="alchemist-modal-save">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Modal Event Listeners
        this.modal.addEventListener('click', () => this.hideModal());
        document.getElementById('alchemist-modal-cancel').addEventListener('click', () => this.hideModal());
        document.getElementById('alchemist-modal-save').addEventListener('click', () => {
            const noteText = document.getElementById('alchemist-modal-input').value.trim();
            this.eventBus.emit('UI:SAVE_NOTE', {
                id: this.modal.dataset.annotationId,
                note: noteText
            });
            this.hideModal();
        });
    }

    /**
     * Creates the sidebar for viewing all annotations.
     */
    createSidebar() {
        this.sidebar = document.createElement('div');
        this.sidebar.id = ANNOTATION_CONFIG.SIDEBAR_ID;
        this.sidebar.innerHTML = `
            <div class="alchemist-sidebar-header">
                <h2>Notes & Highlights</h2>
                <button class="alchemist-sidebar-close" id="alchemist-sidebar-close">&times;</button>
            </div>
            <div class="alchemist-sidebar-content" id="alchemist-sidebar-content">
                <!-- Content injected dynamically -->
            </div>
        `;
        document.body.appendChild(this.sidebar);

        document.getElementById('alchemist-sidebar-close').addEventListener('click', () => {
            this.toggleSidebar(false);
        });
    }

    /**
     * Sets up global event listeners for UI interactions.
     */
    setupEventListeners() {
        // Listen for internal system events
        this.eventBus.on('ENGINE:SHOW_TOOLTIP', (data) => this.showTooltip(data.rect, data.isExisting, data.annotationId));
        this.eventBus.on('ENGINE:HIDE_TOOLTIP', () => this.hideTooltip());
        this.eventBus.on('ENGINE:OPEN_MODAL', (data) => this.showModal(data.annotation));
        this.eventBus.on('STATE:UPDATED', (annotations) => this.renderSidebar(annotations));

        // Global click to hide tooltip
        document.addEventListener('mousedown', (e) => {
            if (!this.tooltip.contains(e.target) && !e.target.closest('mark')) {
                this.hideTooltip();
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideTooltip();
                this.hideModal();
                this.toggleSidebar(false);
            }
        });
    }

    /**
     * Displays the tooltip above a specific rect.
     * @param {DOMRect} rect - The bounding rectangle.
     * @param {boolean} isExisting - True if clicking an existing highlight.
     * @param {string|null} annotationId - The ID of the existing annotation.
     */
    showTooltip(rect, isExisting = false, annotationId = null) {
        this.activeAnnotationId = annotationId;
        
        // Adjust UI based on context
        if (isExisting) {
            this.deleteBtn.style.display = 'block';
            this.noteBtn.innerHTML = '📝 Edit Note';
        } else {
            this.deleteBtn.style.display = 'none';
            this.noteBtn.innerHTML = '📝 Add Note';
            
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                this.activeRange = selection.getRangeAt(0).cloneRange();
            }
        }

        // Calculate position
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;
        
        this.tooltip.style.top = `${rect.top + scrollY - 45}px`;
        this.tooltip.style.left = `${rect.left + scrollX + (rect.width / 2)}px`;
        this.tooltip.classList.add('visible');
    }

    hideTooltip() {
        this.tooltip.classList.remove('visible');
        this.activeRange = null;
        this.activeAnnotationId = null;
    }

    /**
     * Displays the note editing modal.
     * @param {Annotation} annotation - The annotation to edit.
     */
    showModal(annotation) {
        this.modal.dataset.annotationId = annotation.id;
        document.getElementById('alchemist-modal-quote-text').textContent = `"${annotation.text}"`;
        document.getElementById('alchemist-modal-input').value = annotation.note || '';
        this.modal.classList.add('visible');
        setTimeout(() => document.getElementById('alchemist-modal-input').focus(), 100);
    }

    hideModal() {
        this.modal.classList.remove('visible');
        this.modal.dataset.annotationId = '';
    }

    toggleSidebar(forceState) {
        if (typeof forceState === 'boolean') {
            this.sidebar.classList.toggle('open', forceState);
        } else {
            this.sidebar.classList.toggle('open');
        }
    }

    /**
     * Renders the list of annotations in the sidebar.
     * @param {Array<Annotation>} annotations - Array of all annotations.
     */
    renderSidebar(annotations) {
        const container = document.getElementById('alchemist-sidebar-content');
        container.innerHTML = '';

        if (annotations.length === 0) {
            container.innerHTML = '<div style="color: #999; text-align: center; margin-top: 50px;">No highlights yet.</div>';
            return;
        }

        // Sort by creation time
        const sorted = [...annotations].sort((a, b) => a.createdAt - b.createdAt);

        sorted.forEach(ann => {
            const item = document.createElement('div');
            item.className = 'alchemist-sidebar-item';
            
            const colorConfig = ANNOTATION_CONFIG.COLORS.find(c => c.id === ann.color) || ANNOTATION_CONFIG.COLORS[0];
            item.style.borderLeftColor = colorConfig.hex;

            let html = `<div class="alchemist-sidebar-item-text">"${ann.text}"</div>`;
            if (ann.note) {
                html += `<div class="alchemist-sidebar-item-note">${ann.note}</div>`;
            }
            
            const date = new Date(ann.createdAt).toLocaleDateString();
            html += `
                <div class="alchemist-sidebar-item-meta">
                    <span>${date}</span>
                    <span>${ann.color}</span>
                </div>
            `;

            item.innerHTML = html;
            
            // Click to scroll to annotation
            item.addEventListener('click', () => {
                const mark = document.querySelector(`mark[data-annotation-id="${ann.id}"]`);
                if (mark) {
                    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Flash effect
                    mark.classList.add(ANNOTATION_CONFIG.ACTIVE_HIGHLIGHT_CLASS);
                    setTimeout(() => mark.classList.remove(ANNOTATION_CONFIG.ACTIVE_HIGHLIGHT_CLASS), 1500);
                }
            });

            container.appendChild(item);
        });
    }
}

/* ==========================================================================
 * ANNOTATION MANAGER (MAIN CONTROLLER)
 * ========================================================================== */

/**
 * The main orchestrator class. Manages state, coordinates Engine and UI,
 * and handles persistence.
 */
class AnnotationManager {
    /**
     * @param {Object} options - Configuration options.
     * @param {HTMLElement} [options.container] - Root element to observe.
     * @param {boolean} [options.readOnly=false] - Disable creation of new annotations.
     */
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.readOnly = options.readOnly || false;
        this.annotations = [];
        
        // Initialize subsystems
        this.eventBus = new EventEmitter();
        this.engine = new AnnotationEngine(this.container, this.eventBus);
        this.ui = new AnnotationUI(this.eventBus);

        this.init();
    }

    /**
     * Bootstraps the manager: loads state, renders, and binds DOM events.
     */
    init() {
        this.loadAnnotations();
        this.renderAllHighlights();
        this.bindEvents();
        this.bindSystemEvents();
        
        // Notify UI of initial state
        this.eventBus.emit('STATE:UPDATED', this.annotations);
        console.log(`[Alchemist Annotations] Initialized. Loaded ${this.annotations.length} annotations.`);
    }

    /**
     * Binds native DOM events for selection and interaction.
     */
    bindEvents() {
        if (this.readOnly) return;

        // Handle new text selection
        const handleSelection = debounce(() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                return;
            }

            const range = selection.getRangeAt(0);
            const text = selection.toString().trim();

            if (text.length === 0) return;

            // Ensure selection is within allowed container
            if (!this.container.contains(range.commonAncestorContainer)) return;

            const rect = range.getBoundingClientRect();
            this.eventBus.emit('ENGINE:SHOW_TOOLTIP', { rect, isExisting: false });
        }, ANNOTATION_CONFIG.DEBOUNCE_DELAY);

        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('touchend', handleSelection);

        // Handle clicking on existing highlights (Event Delegation)
        this.container.addEventListener('click', (e) => {
            const mark = e.target.closest(`mark.${ANNOTATION_CONFIG.HIGHLIGHT_CLASS}`);
            if (mark) {
                e.preventDefault();
                e.stopPropagation();
                
                const annotationId = mark.dataset.annotationId;
                const rect = mark.getBoundingClientRect();
                
                // Clear native selection so tooltip doesn't get confused
                window.getSelection().removeAllRanges();
                
                this.eventBus.emit('ENGINE:SHOW_TOOLTIP', { rect, isExisting: true, annotationId });
            }
        });
    }

    /**
     * Binds internal EventBus events from UI to Controller actions.
     */
    bindSystemEvents() {
        this.eventBus.on('UI:CREATE_HIGHLIGHT', (data) => this.createAnnotation(data.range, data.color));
        
        this.eventBus.on('UI:CREATE_HIGHLIGHT_WITH_NOTE', (data) => {
            const annotation = this.createAnnotation(data.range, data.color);
            if (annotation) {
                this.eventBus.emit('ENGINE:OPEN_MODAL', { annotation });
            }
        });

        this.eventBus.on('UI:CHANGE_COLOR', (data) => {
            const ann = this.getAnnotation(data.id);
            if (ann) {
                ann.color = data.color;
                ann.updatedAt = Date.now();
                this.engine.updateHighlightStyle(ann);
                this.saveAnnotations();
            }
        });

        this.eventBus.on('UI:REQUEST_NOTE_EDIT', (id) => {
            const ann = this.getAnnotation(id);
            if (ann) {
                this.eventBus.emit('ENGINE:OPEN_MODAL', { annotation: ann });
            }
        });

        this.eventBus.on('UI:SAVE_NOTE', (data) => {
            const ann = this.getAnnotation(data.id);
            if (ann) {
                ann.note = data.note;
                ann.updatedAt = Date.now();
                this.engine.updateHighlightStyle(ann);
                this.saveAnnotations();
            }
        });

        this.eventBus.on('UI:DELETE_ANNOTATION', (id) => this.deleteAnnotation(id));
    }

    /**
     * Core logic to create a new annotation, update DOM, and save state.
     * @param {Range} range - DOM Range.
     * @param {string} colorId - Color identifier.
     * @returns {Annotation|null} The created annotation object.
     */
    createAnnotation(range, colorId = ANNOTATION_CONFIG.DEFAULT_COLOR) {
        const serializedRange = this.engine.serializeRange(range);
        if (!serializedRange) {
            console.error('[AnnotationManager] Failed to serialize range. Aborting.');
            return null;
        }

        const text = range.toString().trim();
        
        const annotation = {
            id: generateUUID(),
            text: text,
            range: serializedRange,
            color: colorId,
            note: null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.annotations.push(annotation);
        
        // Apply to DOM
        this.engine.highlightRange(range, annotation);
        
        this.saveAnnotations();
        return annotation;
    }

    /**
     * Deletes an annotation from state and removes its DOM wrappers.
     * @param {string} id - Annotation UUID.
     */
    deleteAnnotation(id) {
        this.engine.removeHighlight(id);
        this.annotations = this.annotations.filter(a => a.id !== id);
        this.saveAnnotations();
    }

    /**
     * Retrieves an annotation object by ID.
     * @param {string} id 
     * @returns {Annotation|undefined}
     */
    getAnnotation(id) {
        return this.annotations.find(a => a.id === id);
    }

    /**
     * Persists current annotations to localStorage.
     */
    saveAnnotations() {
        try {
            localStorage.setItem(ANNOTATION_CONFIG.STORAGE_KEY, JSON.stringify(this.annotations));
            this.eventBus.emit('STATE:UPDATED', this.annotations);
        } catch (error) {
            console.error('[AnnotationManager] Error saving to localStorage', error);
        }
    }

    /**
     * Loads annotations from localStorage into memory.
     */
    loadAnnotations() {
        try {
            const stored = localStorage.getItem(ANNOTATION_CONFIG.STORAGE_KEY);
            if (stored) {
                this.annotations = JSON.parse(stored);
            }
        } catch (error) {
            console.error('[AnnotationManager] Error loading from localStorage', error);
            this.annotations = [];
        }
    }

    /**
     * Re-applies all stored annotations to the current DOM.
     * Should be called after document load or pagination in an e-reader.
     */
    renderAllHighlights() {
        // Sort annotations by DOM position (simplistic approach: by length/offset to prevent nested conflicts)
        // A more robust approach requires checking range containment.
        
        let failedCount = 0;
        this.annotations.forEach(ann => {
            const range = this.engine.deserializeRange(ann.range);
            if (range) {
                this.engine.highlightRange(range, ann);
                // Ensure style is fully applied (notes, specific colors)
                this.engine.updateHighlightStyle(ann);
            } else {
                failedCount++;
                console.warn(`[AnnotationManager] Failed to render annotation ${ann.id}. DOM may have changed.`);
            }
        });

        if (failedCount > 0) {
            console.warn(`[AnnotationManager] ${failedCount} annotations failed to render. They are kept in storage but not visible.`);
        }
    }

    /**
     * Public API: Programmatically toggle the sidebar.
     */
    toggleSidebar() {
        this.ui.toggleSidebar();
    }

    /**
     * Public API: Export annotations as JSON.
     * @returns {string} JSON string of all annotations.
     */
    exportAnnotations() {
        return JSON.stringify(this.annotations, null, 2);
    }

    /**
     * Public API: Import annotations from JSON.
     * @param {string} jsonString - JSON array of annotations.
     */
    importAnnotations(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (Array.isArray(imported)) {
                this.annotations = imported;
                this.saveAnnotations();
                // Clear existing highlights from DOM
                document.querySelectorAll(`mark.${ANNOTATION_CONFIG.HIGHLIGHT_CLASS}`).forEach(mark => {
                     const id = mark.dataset.annotationId;
                     if(id) this.engine.removeHighlight(id);
                });
                this.renderAllHighlights();
            }
        } catch (e) {
            console.error('[AnnotationManager] Failed to import annotations', e);
        }
    }
}

/* ==========================================================================
 * EXPORT / INITIALIZATION
 * ========================================================================== */

// If running in a browser environment with modules, export the class.
// Otherwise, attach to window for global access.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnnotationManager, ANNOTATION_CONFIG };
} else {
    window.AlchemistAnnotations = AnnotationManager;
    
    // Auto-initialize if data-auto-init attribute is present on the script tag
    const currentScript = document.currentScript;
    if (currentScript && currentScript.hasAttribute('data-auto-init')) {
        window.addEventListener('DOMContentLoaded', () => {
            window.alchemistAnnotationsInstance = new AnnotationManager({
                container: document.querySelector(currentScript.getAttribute('data-container') || 'body')
            });
        });
    }
}