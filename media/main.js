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
            console.log('[main.js] modal closed, restoring selection and focus');
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
                console.log('[main.js] received update message');
                const text = message.text;
                if (message.images) {
                    originalImageCache = message.images;
                    console.log('[main.js] originalImageCache updated, count:', Object.keys(originalImageCache).length);
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
                } catch (e) {
                    console.error("Failed to init mind map", e);
                }
                mind.refresh();
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

                // Get the actual Node ID from MindElixir node object or data attribute
                let nodeId = mind.currentNode.nodeObj ? mind.currentNode.nodeObj.id : null;
                if (!nodeId) {
                    const attrId = mind.currentNode.getAttribute('data-nodeid');
                    if (attrId) {
                        nodeId = attrId.startsWith('me') ? attrId.substring(2) : attrId;
                    }
                }

                console.log('[main.js] pasting image into node:', nodeId);
                if (!nodeId) {
                    console.error('[main.js] Could not determine Node ID for pasting!');
                    return;
                }
                originalImageCache[nodeId] = base64;
                console.log('[main.js] updated originalImageCache for ID:', nodeId, 'Cache size:', Object.keys(originalImageCache).length);

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
        console.log('[main.js] attaching click listener to #mindmap');
        mindmapEl.addEventListener('click', (e) => {
            console.log('[main.js] mindmap clicked', e.target);
            const target = /** @type {HTMLElement} */ (e.target);

            // Look for IMG tag directly or within the clicked node
            const img = target.tagName === 'IMG' ? target : target.closest('me-tpc')?.querySelector('img');

            if (img) {
                console.log('[main.js] Image detected for popup:', img);
                // Find parent node to get ID
                let parent = img.parentElement;
                while (parent && !parent.hasAttribute('data-nodeid')) {
                    parent = parent.parentElement;
                }
                if (parent) {
                    lastSelectedNode = /** @type {HTMLElement} */ (parent);
                    let nodeId = parent.getAttribute('data-nodeid');
                    console.log('[main.js] found parent with nodeId:', nodeId);
                    if (nodeId) {
                        // Strip 'me' prefix if present
                        const cleanId = nodeId.startsWith('me') ? nodeId.substring(2) : nodeId;
                        const originalBase64 = originalImageCache[cleanId];
                        console.log('[main.js] cache lookup for cleanId:', cleanId, 'Found:', !!originalBase64);
                        if (!originalBase64) {
                            console.log('[main.js] Cache dump:', JSON.stringify(Object.keys(originalImageCache)));
                        }

                        if (originalBase64) {
                            const popupImg = /** @type {HTMLImageElement} */ (document.getElementById('popup-img'));
                            if (popupImg) {
                                console.log('[main.js] display modal');
                                popupImg.src = originalBase64;
                                modal.style.display = 'flex';
                            }
                        } else {
                            console.warn('[main.js] image not in cache. available IDs:', Object.keys(originalImageCache));
                        }
                    }
                } else {
                    console.warn('[main.js] could not find parent with data-nodeid');
                }
            } else {
                console.log('[main.js] element clicked does not contain an IMG');
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
