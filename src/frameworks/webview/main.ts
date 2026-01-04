/**
 * Interfaces for VS Code API and MindElixir
 */
interface VSCodeApi {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

interface MindElixirOptions {
    el: string | HTMLElement;
    direction?: number;
    draggable?: boolean;
    contextMenu?: boolean;
    toolBar?: boolean;
    nodeMenu?: boolean;
    keypress?: boolean;
    locale?: string;
    overflowHidden?: boolean;
    mainLinkStyle?: number; // 1: curve, 2: straight
    subLinkStyle?: number; // 1: curve, 2: straight
}

interface NodeObj {
    id: string;
    topic: string;
    root?: boolean;
    style?: {
        fontSize?: string;
        color?: string;
        fontWeight?: string;
        fontStyle?: string;
        background?: string;
    };
    image?: {
        url: string;
        height: number;
        width: number;
    };
    children?: NodeObj[];
}

interface MindElixirInstance {
    init(data: any): void;
    refresh(): void;
    getData(): any;
    bus: {
        addListener(event: string, callback: (payload: any) => void): void;
    };
    currentNode: {
        nodeObj?: NodeObj;
        style?: any;
    } | null;
    container: HTMLElement;
    selectNode(node: HTMLElement | NodeObj): void;
    reshapeNode(node: any, style: any): void;
}

declare const MindElixir: {
    new(options: MindElixirOptions): MindElixirInstance;
    RIGHTT: number;
    E(id: string): HTMLElement | undefined;
};

// Add to window object
declare global {
    interface Window {
        MindElixir: typeof MindElixir;
        clipboardData: DataTransfer | null;
    }
}

/**
 * Handles image processing tasks like resizing.
 */
export class ImageProcessor {
    /**
     * Resizes a base64 image to fit within maxWidth and maxHeight.
     */
    static async resizeImage(base64: string, maxWidth: number, maxHeight: number): Promise<{ base64: string, width: number, height: number }> {
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
export class ImageModal {
    private modal: HTMLDivElement;
    private lastSelectedNode: HTMLElement | null = null;

    constructor(
        lastSelectedNode: HTMLElement | null,
        private readonly mind: MindElixirInstance
    ) {
        this.lastSelectedNode = lastSelectedNode;
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

    show(src: string, selectedNode: HTMLElement) {
        this.lastSelectedNode = selectedNode;
        const popupImg = this.modal.querySelector('#popup-img') as HTMLImageElement;
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
export class StyleInspector {
    private panel: HTMLElement | null;
    private sizeInput: HTMLSelectElement;
    private colorInput: HTMLInputElement;
    private boldBtn: HTMLElement | null;
    private italicBtn: HTMLElement | null;

    constructor(private readonly mind: MindElixirInstance) {
        this.panel = document.getElementById('inspector');
        this.sizeInput = document.getElementById('inspector-size') as HTMLSelectElement;
        this.colorInput = document.getElementById('inspector-color') as HTMLInputElement;
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

    updateStyle(prop: string, value: string) {
        const node = this.mind.currentNode;
        if (!node) return;

        const currentStyle = node.style || {};

        // Define allowlist
        const allowList = ['fontSize', 'color', 'fontWeight', 'fontStyle', 'background'];

        const newStyle: any = {};

        // Copy only allowlisted properties
        for (const key of allowList) {
            if (currentStyle[key]) {
                newStyle[key] = currentStyle[key];
            }
        }

        // Apply the new change
        newStyle[prop] = value;

        // Clean up empty values
        if (value === '') {
            delete newStyle[prop];
        }

        this.mind.reshapeNode(node, { style: newStyle });

        if (this.mind.container) {
            this.mind.container.focus();
        }
    }

    show(node: any) {
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
 * Main application class
 */
export class MindMapApp {
    private state: any;
    private originalImageCache: { [id: string]: string } = {};
    private lastContent: string | null = null;
    private lastSelectedNode: HTMLElement | null = null;
    public mind: MindElixirInstance;
    private imageModal: ImageModal;
    private inspector: StyleInspector;

    constructor(
        private readonly vscode: VSCodeApi,
        MindElixirCtor: typeof MindElixir
    ) {
        this.state = vscode.getState() || {};

        this.mind = new MindElixirCtor({
            el: '#mindmap',
            direction: MindElixirCtor.RIGHTT,
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
        window.addEventListener('paste', e => this.handlePaste(e as ClipboardEvent));

        const mindmapEl = document.getElementById('mindmap');
        if (mindmapEl) {
            mindmapEl.addEventListener('click', e => this.handleMindMapClick(e));
        }

        this.mind.bus.addListener('operation', (operation: any) => this.handleOperation(operation));

        this.mind.bus.addListener('selectNodes', (nodes: any) => {
            console.log('[SelectNodes]', nodes);
            if (nodes && nodes.length > 0) {
                this.inspector.show(nodes[0]);
            } else {
                this.inspector.hide();
            }
        });
    }

    handleVscodeMessage(message: any) {
        switch (message.type) {
            case 'update': {
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
    }

    async handlePaste(e: ClipboardEvent) {
        if (!this.mind.currentNode) return;
        const items = e.clipboardData?.items;
        if (!items) return;

        let blob: File | null = null;
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
                const base64 = event.target.result as string;
                const result = await ImageProcessor.resizeImage(base64, 200, 200);

                const nodeId = this.mind.currentNode?.nodeObj ? this.mind.currentNode.nodeObj.id : null;
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

    handleMindMapClick(e: MouseEvent) {
        const target = e.target as HTMLElement;

        const isNode = target.closest('me-tpc');
        const isInspector = target.closest('#inspector');
        if (!isNode && !isInspector) {
            this.inspector.hide();
        }

        const img = target.tagName === 'IMG' ? target : target.closest('me-tpc')?.querySelector('img');

        if (img) {
            let parent: HTMLElement | null = img.parentElement;
            while (parent && !parent.hasAttribute('data-nodeid')) {
                parent = parent.parentElement;
            }
            if (parent) {
                const nodeId = parent.getAttribute('data-nodeid');
                if (nodeId) {
                    const cleanId = nodeId.startsWith('me') ? nodeId.substring(2) : nodeId;
                    const originalBase64 = this.originalImageCache[cleanId];
                    if (originalBase64) {
                        this.imageModal.show(originalBase64, parent);
                    }
                }
            }
        }
    }

    handleOperation(operation: any) {
        console.log('[MindElixir Operation]', operation);
        if (operation.name === 'removeNodes') {
            (operation.objs as any[]).forEach((obj: any) => {
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
if (typeof acquireVsCodeApi !== 'undefined') {
    const vscode = acquireVsCodeApi();
    // Use window.MindElixir which is loaded via script tag
    // Ensure MindElixir is available
    if (window.MindElixir) {
        new MindMapApp(vscode, window.MindElixir);
    }
}
