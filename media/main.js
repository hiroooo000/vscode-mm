// @ts-check

// Script run within the webview
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    // @ts-ignore
    const MindElixir = window.MindElixir;

    /** @type {any} */
    let state = vscode.getState() || {};

    /** @type {Object<string, string>} */
    let originalImageCache = {};

    /** @type {HTMLElement | null} */
    let lastSelectedNode = null;

    // Create popup modal element
    const modal = document.createElement('div');
    modal.id = 'image-popup';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.zIndex = '1000';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.cursor = 'zoom-out';
    modal.innerHTML = '<img id="popup-img" style="max-width:90%; max-height:90%; box-shadow: 0 0 20px rgba(0,0,0,0.5);">';
    document.body.appendChild(modal);

    modal.addEventListener('click', () => {
        modal.style.display = 'none';
        if (lastSelectedNode) {
            mind.selectNode(lastSelectedNode);
            if (mind.container) {
                mind.container.focus();
            }
        }
    });

    // Initialize Mind Elixir
    // @ts-ignore
    const mind = new MindElixir({
        el: '#mindmap',
        direction: MindElixir.RIGHTT,
        draggable: true,
        contextMenu: true,
        toolBar: true,
        nodeMenu: true,
        keypress: true, // This enables built-in shortcuts
    });

    // Keep track of the last content to avoid unnecessary re-renders
    /** @type {string | null} */
    let lastContent = null;

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'update':
                const text = message.text;
                if (message.images) {
                    originalImageCache = message.images;
                }
                if (text === lastContent) {
                    return;
                }
                let json;
                try {
                    json = JSON.parse(text);
                } catch {
                    return;
                }
                lastContent = text;
                try {
                    // Re-initialize with new data
                    mind.init(json);

                    // Initial refresh for base structure
                    mind.refresh();

                    // If images might be present, refresh again after a short delay
                    // to ensure node sizes are correctly calculated after Base64 rendering.
                    if (message.images && Object.keys(message.images).length > 0) {
                        setTimeout(() => {
                            mind.refresh();
                        }, 10);
                    }
                } catch (e) {
                    console.error("Failed to init mind map", e);
                }
                break;
        }
    });

    // ▼ 保存処理を関数として切り出し
    function saveChanges() {
        const data = mind.getData();
        const text = JSON.stringify(data, null, 2);
        lastContent = text;
        vscode.postMessage({
            type: 'change',
            text: text,
            images: originalImageCache
        });
    }

    /**
     * @param {string} base64
     * @param {number} maxWidth
     * @param {number} maxHeight
     * @returns {Promise<string>}
     */
    function resizeImage(base64, maxWidth, maxHeight) {
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
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } else {
                    resolve(base64);
                }
            };
            img.src = base64;
        });
    }

    /**
     * @param {string} base64
     * @param {number} maxWidth
     * @param {number} maxHeight
     * @returns {Promise<string>}
     */
    function resizeImage(base64, maxWidth, maxHeight) {
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
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } else {
                    resolve(base64);
                }
            };
            img.src = base64;
        });
    }

    // クリップボードからの画像貼り付け処理
    window.addEventListener('paste', (e) => {
        if (!mind.currentNode) return;
        const items = (e.clipboardData || window.clipboardData).items;
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

                // Resize image to thumbnail
                const thumbnailBase64 = await resizeImage(base64, 200, 200);

                const nodeId = mind.currentNode.nodeObj ? mind.currentNode.nodeObj.id : null;
                if (!nodeId) return;

                originalImageCache[nodeId] = base64;

                mind.reshapeNode(mind.currentNode, {
                    image: {
                        url: thumbnailBase64,
                        height: 'auto',
                        width: 'auto'
                    }
                });

                mind.refresh();
                saveChanges();
            };
            reader.readAsDataURL(blob);
        }
    });

    // Handle image click for popup
    const mindmapEl = document.getElementById('mindmap');
    if (mindmapEl) {
        mindmapEl.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);

            // Look for IMG tag directly or within the clicked node
            const img = target.tagName === 'IMG' ? target : target.closest('me-tpc')?.querySelector('img');

            if (img) {
                // Find parent node to get ID
                let parent = img.parentElement;
                while (parent && !parent.hasAttribute('data-nodeid')) {
                    parent = parent.parentElement;
                }
                if (parent) {
                    lastSelectedNode = /** @type {HTMLElement} */ (parent);
                    let nodeId = parent.getAttribute('data-nodeid');
                    if (nodeId) {
                        // Strip 'me' prefix if present
                        const cleanId = nodeId.startsWith('me') ? nodeId.substring(2) : nodeId;
                        const originalBase64 = originalImageCache[cleanId];

                        if (originalBase64) {
                            const popupImg = /** @type {HTMLImageElement} */ (document.getElementById('popup-img'));
                            if (popupImg) {
                                popupImg.src = originalBase64;
                                modal.style.display = 'flex';
                            }
                        }
                    }
                }
            }
        });
    }

    // Handle data changes from MindElixir to sync back to VS Code
    /* operation.name の一覧:
        addChild
        removeNodes
        insertSibling
        insertParent
        moveNodeIn / moveNodeBefore / moveNodeAfter
        moveUpNode / moveDownNode
        beginEdit / finishEdit
        reshapeNode (スタイル変更など)
        createSummary / removeSummary / finishEditSummary
        createArrow / removeArrow / finishEditArrowLabel
        copyNode / copyNodes
        copyNodes
     */
    mind.bus.addListener('operation', operation => {
        console.log('[MindElixir Operation]', operation);

        // Handle cache cleanup on node removal
        if (operation.name === 'removeNodes') {
            /** @type {any[]} */ (operation.objs).forEach(obj => {
            delete originalImageCache[obj.id];
        });
        }

        saveChanges();
    });

    // Also listen for select/unselect for debugging or future features
    mind.bus.addListener('selectNode', (/** @type {any} */ node) => {
        console.log('[SelectNode]', node);
    });
    //}


}());
