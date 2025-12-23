import * as vscode from 'vscode';

export class MindMapEditorProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new MindMapEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(MindMapEditorProvider.viewType, provider);
        return providerRegistration;
    }

    private static readonly viewType = 'vscode-mm.mindmap';

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    /**
     * Called when our custom editor is opened.
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        async function updateWebview() {
            const imagesPath = document.uri.fsPath.replace(/\.(mm|mindmap)$/, '_img.json');
            let images = {};
            try {
                const imagesUri = vscode.Uri.file(imagesPath);
                const bytes = await vscode.workspace.fs.readFile(imagesUri);
                const json = JSON.parse(Buffer.from(bytes).toString('utf8'));
                if (json && json.image && Array.isArray(json.image)) {
                    // Convert array of objects back to a flat map for the webview
                    json.image.forEach((item: any) => {
                        const id = Object.keys(item)[0];
                        if (id && id !== "") {
                            Object.assign(images, item);
                        }
                    });
                }
                console.log(`[Extension] Loaded ${Object.keys(images).length} images from _img.json`);
            } catch (e) {
                console.log('[Extension] No _img.json found or failed to read');
            }

            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
                images: images
            });
            console.log(`[Extension] Sent update message with ${Object.keys(images).length} images to webview`);
        }

        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to update the webview whenever it changes.
        // 
        // Since `retainContextWhenHidden` is not set, we also need to keep the webview alive 
        // or re-hydrate it, but CustomTextEditorProvider simplifies this by keeping the document open.
        // However, the panel itself might be destroyed and recreated if moved to background? 
        // Actually CustomTextEditor keeps the document model but the view might reload.

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Update the webview when it becomes visible again (e.g. switching tabs)
        webviewPanel.onDidChangeViewState(e => {
            if (e.webviewPanel.visible) {
                updateWebview();
            }
        });

        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'change':
                    this.updateTextDocument(document, e.text);
                    if (e.images) {
                        this.updateImagesFile(document, e.images);
                    }
                    return;
            }
        });

        updateWebview();
    }

    /**
     * Write out the json to a given document.
     */
    private updateTextDocument(document: vscode.TextDocument, jsonStr: string) {
        const edit = new vscode.WorkspaceEdit();

        // Just replace the entire document.
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            jsonStr
        );

        vscode.workspace.applyEdit(edit).then(() => {
            vscode.workspace.saveAll()
        });
    }

    /**
     * Write out the images to the separate _img.json file.
     */
    private async updateImagesFile(document: vscode.TextDocument, images: { [key: string]: string }) {
        const imagesPath = document.uri.fsPath.replace(/\.(mm|mindmap)$/, '_img.json');
        const imagesUri = vscode.Uri.file(imagesPath);

        // requested format: {"image" : [{"node_id" : "BASE64"}]}
        const imageList = Object.entries(images).map(([id, data]) => ({ [id]: data }));
        console.log(`[Extension] Saving _img.json with ${imageList.length} images`);
        const json = {
            image: imageList
        };

        const content = Buffer.from(JSON.stringify(json, null, 2), 'utf8');
        await vscode.workspace.fs.writeFile(imagesUri, content);
    }

    /**
     * Get the static html used for the editor webviews.
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
        const mindElixirScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'MindElixir.js'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));

        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} 'self' data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">

				<link href="${styleMainUri}" rel="stylesheet" />
				<title>Mind Map</title>
			</head>
			<body>
				<div id="mindmap"></div>
				<script nonce="${nonce}" src="${mindElixirScriptUri}"></script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
