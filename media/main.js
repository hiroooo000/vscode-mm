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
            reader.onload = (event) => {
                const base64 = event.target.result;
                console.log('base64', base64);
                console.log('mind.currentNode', mind.currentNode);
                mind.reshapeNode(mind.currentNode, {
                    image: {
                        url: base64,
                        height: '100%',
                        width: '100%'
                    }
                });
                //mind.currentNode.imageTitle = 'pasted-image';
                console.log('mind.currentNode', mind.currentNode);
                mind.refresh();
                console.log('mind.currentNode', mind.currentNode);
                // ▼ ここで直接保存関数を呼び出す（イベント発火はしない）
                saveChanges();
                mind.refresh();
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
