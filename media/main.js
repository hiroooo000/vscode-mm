// @ts-check

// Script run within the webview
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    // @ts-ignore
    const MindElixir = window.MindElixir;

    /** @type {any} */
    let state = vscode.getState() || {};

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
                    // Note: init() might reset view state, but it is the safe way to load new data
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
            text: text
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
        console.log('paste1');
        if (!mind.currentNode) return;
        console.log('paste2');
        const items = (e.clipboardData || window.clipboardData).items;
        let blob = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image/') !== -1) {
                blob = items[i].getAsFile();
                break;
            }
        }
        console.log('paste3');
        if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = /** @type {string} */ (event.target.result);
                console.log('original base64 length:', base64.length);

                // Resize image to thumbnail
                const thumbnailBase64 = await resizeImage(base64, 200, 200);
                console.log('thumbnail base64 length:', thumbnailBase64.length);

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
     */
    mind.bus.addListener('operation', operation => {
        console.log('[MindElixir Operation]', operation);
        saveChanges();
    });

    // Also listen for select/unselect for debugging or future features
    mind.bus.addListener('selectNode', node => {
        console.log('[SelectNode]', node);
    });
    //}


}());
