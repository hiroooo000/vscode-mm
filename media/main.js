// @ts-check

/**
 * Handles image processing tasks like resizing.
 */
class ImageProcessor {
    /**
     * Resizes a base64 image to fit within maxWidth and maxHeight.
     * @param {string} base64 
     * @param {number} maxWidth 
     * @param {number} maxHeight 
     * @returns {Promise<string>}
     */
    static async resizeImage(base64, maxWidth, maxHeight) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }

                width = Math.floor(width);
                height = Math.floor(height);

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve({
                        base64: canvas.toDataURL('image/jpeg', 0.8),
                        width,
                        height
                    });
                } else {
                    resolve({ base64, width, height });
                }
            };
            img.onerror = () => resolve({ base64, width: 0, height: 0 });
            img.src = base64;
        });
    }
}

/**
 * Handles the image preview modal.
 */
class ImageModal {
    /**
     * @param {HTMLElement | null} lastSelectedNode
     * @param {any} mind
     */
    constructor(lastSelectedNode, mind) {
        this.lastSelectedNode = lastSelectedNode;
        this.mind = mind;
        this.modal = document.createElement('div');
        this.init();
    }

    init() {
        this.modal.id = 'image-popup';
        this.modal.style.display = 'none';
        this.modal.style.position = 'fixed';
        this.modal.style.zIndex = '1000';
        this.modal.style.left = '0';
        this.modal.style.top = '0';
        this.modal.style.width = '100%';
        this.modal.style.height = '100%';
        this.modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
        this.modal.style.justifyContent = 'center';
        this.modal.style.alignItems = 'center';
        this.modal.style.cursor = 'zoom-out';
        this.modal.innerHTML = '<img id="popup-img" style="max-width:90%; max-height:90%; box-shadow: 0 0 20px rgba(0,0,0,0.5);">';
        document.body.appendChild(this.modal);

        this.modal.addEventListener('click', () => {
            this.hide();
        });
    }

    /**
     * @param {string} src
     * @param {HTMLElement} selectedNode
     */
    show(src, selectedNode) {
        this.lastSelectedNode = selectedNode;
        const popupImg = /** @type {HTMLImageElement} */ (this.modal.querySelector('#popup-img'));
        if (popupImg) {
            popupImg.src = src;
            this.modal.style.display = 'flex';
        }
    }

    hide() {
        this.modal.style.display = 'none';
        if (this.lastSelectedNode && this.mind) {
            this.mind.selectNode(this.lastSelectedNode);
            if (this.mind.container) {
                this.mind.container.focus();
            }
        }
    }
}

/**
 * Handles the style inspector panel.
 */
class StyleInspector {
    /**
     * @param {any} mind 
     */
    constructor(mind) {
        this.mind = mind;
        this.panel = document.getElementById('inspector');
        this.sizeInput = /** @type {HTMLSelectElement} */ (document.getElementById('inspector-size'));
        this.colorInput = /** @type {HTMLInputElement} */ (document.getElementById('inspector-color'));
        this.boldBtn = document.getElementById('inspector-bold');
        this.italicBtn = document.getElementById('inspector-italic');

        this.initListeners();
    }

    initListeners() {
        if (!this.panel) return;

        this.sizeInput.addEventListener('change', () => this.updateStyle('fontSize', this.sizeInput.value));
        this.colorInput.addEventListener('input', () => this.updateStyle('color', this.colorInput.value));
        this.boldBtn?.addEventListener('click', () => {
            const isBold = this.boldBtn?.classList.contains('active');
            this.updateStyle('fontWeight', isBold ? 'normal' : 'bold');
            this.boldBtn?.classList.toggle('active');
        });
        this.italicBtn?.addEventListener('click', () => {
            const isItalic = this.italicBtn?.classList.contains('active');
            this.updateStyle('fontStyle', isItalic ? 'normal' : 'italic');
            this.italicBtn?.classList.toggle('active');
        });

        const swatches = this.panel.querySelectorAll('.color-swatch');
        swatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = swatch.getAttribute('data-color');
                if (color) {
                    this.colorInput.value = color;
                    this.updateStyle('color', color);
                }
            });
        });
    }

    /**
     * @param {string} prop 
     * @param {string} value 
     */
    /**
     * @param {string} prop 
     * @param {string} value 
     */
    updateStyle(prop, value) {
        const node = this.mind.currentNode;
        if (!node) return;

        const currentStyle = node.style || {};

        // Define allowlist of style properties we care about to avoid polluting data
        // with unrelated CSS properties if currentStyle is dirty.
        const allowList = ['fontSize', 'color', 'fontWeight', 'fontStyle', 'background'];

        const newStyle = {};

        // Copy only allowlisted properties from current style
        for (const key of allowList) {
            if (currentStyle[key]) {
                newStyle[key] = currentStyle[key];
            }
        }

        // Apply the new change
        newStyle[prop] = value;

        // Clean up empty values if specifically setting to empty
        if (value === '') {
            delete newStyle[prop];
        }

        this.mind.reshapeNode(node, { style: newStyle });

        if (this.mind.container) {
            this.mind.container.focus();
        }
    }

    /**
     * @param {any} node 
     */
    show(node) {
        if (!this.panel) return;

        const style = node.style || {};

        this.sizeInput.value = style.fontSize || '';
        this.colorInput.value = style.color || '#000000';

        if (style.fontWeight === 'bold') {
            this.boldBtn?.classList.add('active');
        } else {
            this.boldBtn?.classList.remove('active');
        }

        if (style.fontStyle === 'italic') {
            this.italicBtn?.classList.add('active');
        } else {
            this.italicBtn?.classList.remove('active');
        }

        this.panel.classList.add('visible');
    }

    hide() {
        if (!this.panel) return;
        this.panel.classList.remove('visible');
    }
}

/**
 * Main application class for the Mind Map Webview.
 */
class MindMapApp {
    /**
     * @param {any} vscode 
     * @param {any} MindElixir 
     */
    constructor(vscode, MindElixir) {
        this.vscode = vscode;
        this.MindElixir = MindElixir;
        this.state = vscode.getState() || {};
        this.originalImageCache = {};
        this.lastContent = null;
        this.lastSelectedNode = null;

        this.mind = new MindElixir({
            el: '#mindmap',
            direction: MindElixir.RIGHTT,
            draggable: true,
            contextMenu: true,
            toolBar: true,
            nodeMenu: true,
            keypress: true,
        });

        this.imageModal = new ImageModal(this.lastSelectedNode, this.mind);
        this.inspector = new StyleInspector(this.mind);

        this.initListeners();
    }

    initListeners() {
        window.addEventListener('message', event => this.handleVscodeMessage(event.data));
        window.addEventListener('paste', e => this.handlePaste(e));

        const mindmapEl = document.getElementById('mindmap');
        if (mindmapEl) {
            mindmapEl.addEventListener('click', e => this.handleMindMapClick(e));
        }

        this.mind.bus.addListener('operation', operation => this.handleOperation(operation));

        // Use selectNodes as per documentation V5+
        this.mind.bus.addListener('selectNodes', nodes => {
            console.log('[SelectNodes]', nodes);
            if (nodes && nodes.length > 0) {
                // Determine which node to show. For now, just the first one.
                // In multiple selection, maybe we shouldn't show inspector or show common styles?
                // Let's stick to showing the first one or the last selected one if accessible.
                // The library passes 'nodes' which is likely an array.
                this.inspector.show(nodes[0]);
            } else {
                this.inspector.hide();
            }
        });
    }

    /**
     * @param {any} message 
     */
    handleVscodeMessage(message) {
        switch (message.type) {
            case 'update':
                const text = message.text;
                if (message.images) {
                    this.originalImageCache = message.images;
                }
                if (text === this.lastContent) {
                    return;
                }
                let json;
                try {
                    json = JSON.parse(text);
                } catch {
                    return;
                }
                this.lastContent = text;
                try {
                    this.mind.init(json);
                    this.mind.refresh();
                    if (message.images && Object.keys(message.images).length > 0) {
                        setTimeout(() => {
                            this.mind.refresh();
                        }, 10);
                    }
                } catch (e) {
                    console.error("Failed to init mind map", e);
                }
                break;
        }
    }

    /**
     * @param {ClipboardEvent} e 
     */
    async handlePaste(e) {
        if (!this.mind.currentNode) return;
        const items = (e.clipboardData || window['clipboardData']).items;
        let blob = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image/') !== -1) {
                blob = items[i].getAsFile();
                break;
            }
        }
        if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                if (!event.target) return;
                const base64 = /** @type {string} */ (event.target.result);
                const result = await ImageProcessor.resizeImage(base64, 200, 200);

                const nodeId = this.mind.currentNode.nodeObj ? this.mind.currentNode.nodeObj.id : null;
                if (!nodeId) return;

                this.originalImageCache[nodeId] = base64;

                this.mind.reshapeNode(this.mind.currentNode, {
                    image: {
                        url: result.base64,
                        height: result.height,
                        width: result.width
                    }
                });

                this.mind.refresh();

                // Restore selection
                if (nodeId) {
                    const newNode = MindElixir.E(nodeId);
                    if (newNode) {
                        this.mind.selectNode(newNode);
                        if (this.mind.container) {
                            this.mind.container.focus();
                        }
                    }
                }

                this.saveChanges();
            };
            reader.readAsDataURL(blob);
        }
    }

    /**
     * @param {MouseEvent} e 
     */
    handleMindMapClick(e) {
        const target = /** @type {HTMLElement} */ (e.target);

        // Hide inspector if clicking outside node and inspector
        const isNode = target.closest('me-tpc');
        const isInspector = target.closest('#inspector');
        if (!isNode && !isInspector) {
            this.inspector.hide();
        }

        const img = target.tagName === 'IMG' ? target : target.closest('me-tpc')?.querySelector('img');

        if (img) {
            let parent = img.parentElement;
            while (parent && !parent.hasAttribute('data-nodeid')) {
                parent = parent.parentElement;
            }
            if (parent) {
                const nodeId = parent.getAttribute('data-nodeid');
                if (nodeId) {
                    const cleanId = nodeId.startsWith('me') ? nodeId.substring(2) : nodeId;
                    const originalBase64 = this.originalImageCache[cleanId];
                    if (originalBase64) {
                        this.imageModal.show(originalBase64, /** @type {HTMLElement} */(parent));
                    }
                }
            }
        }
    }

    /**
     * @param {any} operation 
     */
    handleOperation(operation) {
        console.log('[MindElixir Operation]', operation);
        if (operation.name === 'removeNodes') {
            /** @type {any[]} */ (operation.objs).forEach(obj => {
            delete this.originalImageCache[obj.id];
        });
        }
        this.saveChanges();
    }

    saveChanges() {
        const data = this.mind.getData();
        const text = JSON.stringify(data, null, 2);
        this.lastContent = text;
        this.vscode.postMessage({
            type: 'change',
            text: text,
            images: this.originalImageCache
        });
    }
}

// Script run within the webview
(function () {
    if (typeof acquireVsCodeApi !== 'undefined') {
        const vscode = acquireVsCodeApi();
        // @ts-ignore
        const MindElixir = window.MindElixir;
        new MindMapApp(vscode, MindElixir);
    }
})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ImageProcessor, ImageModal, MindMapApp };
}

