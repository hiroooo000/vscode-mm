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

    // let initial_text = ""
    // if (!editor) {
    //     initial_text = "initial_text";
    // } else {
    //     initial_text = editor.document.uri.toString();
    // }
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
                    //json = JSON.parse(initial_text);
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
                break;
        }
    });
    //vscode.window.showInformationMessage('mind.bus:' + mind.bus);
    // Handle data changes from MindElixir to sync back to VS Code
    //if (mind.bus) {
    // Mind Elixir fires 'operation' for data changes
    mind.bus.addListener('operation', operation => {
        console.log('[MindElixir Operation]', operation);

        if (operation.name === 'finishEdit') {
            // Get the full data object
            const data = mind.getData();
            console.log('data', data);
            const text = JSON.stringify(data, null, 2);
            // Send back to VS Code
            vscode.postMessage({
                type: 'change',
                text: text
            });
            return;
        }
    });

    // Also listen for select/unselect for debugging or future features
    mind.bus.addListener('selectNode', node => {
        console.log('[SelectNode]', node);
    });
    //}


}());
