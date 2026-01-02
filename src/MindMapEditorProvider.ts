import * as vscode from 'vscode';
import { MindMapDataStore, ImageMap } from './MindMapDataStore';

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
    ): Promise<void> {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        async function updateWebview() {
            const text = document.getText();
            if (text.trim().length === 0) {
                const defaultContent = {
                    "nodeData": {
                        "id": "root",
                        "topic": "Central Topic",
                        "root": true,
                        "children": []
                    },
                    "linkData": {}
                };
                const edit = new vscode.WorkspaceEdit();
                edit.insert(document.uri, new vscode.Position(0, 0), JSON.stringify(defaultContent, null, 2));
                await vscode.workspace.applyEdit(edit);
            }

            const imagesPath = MindMapDataStore.getImagesPath(document.uri.fsPath);
            const imagesUri = vscode.Uri.file(imagesPath);
            let images: ImageMap = {};
            try {
                const bytes = await vscode.workspace.fs.readFile(imagesUri);
                const json = JSON.parse(Buffer.from(bytes).toString('utf8'));
                images = MindMapDataStore.transformToWebviewImages(json);
            } catch {
                // Ignore missing file
            }

            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
                images: images
            });
        }

        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to update the webview whenever it changes.
        // 
        // Since `retainContextWhenHidden` is not set, we also need to keep the webview alive 
        // or re-hydrate it, but CustomTextEditorProvider simplifies this by keeping the document open.
        // However, the panel itself might be destroyed and recreated if moved to background? 
        // Actually CustomTextEditor keeps the document model but the view might reload.

        let isInternalUpdate = false;

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                if (!isInternalUpdate) {
                    updateWebview();
                }
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
                    isInternalUpdate = true;
                    this.updateTextDocument(document, e.text).then(() => {
                        isInternalUpdate = false;
                    });
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
    private updateTextDocument(document: vscode.TextDocument, jsonStr: string): Thenable<boolean> {
        const edit = new vscode.WorkspaceEdit();

        // Just replace the entire document.
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            jsonStr
        );

        return vscode.workspace.applyEdit(edit);
    }

    /**
     * Write out the images to the separate _img.json file.
     */
    private async updateImagesFile(document: vscode.TextDocument, images: ImageMap) {
        const imagesPath = MindMapDataStore.getImagesPath(document.uri.fsPath);
        const imagesUri = vscode.Uri.file(imagesPath);
        const json = MindMapDataStore.transformToJsonImages(images);
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
                <div id="inspector">
                    <div class="inspector-row">
                        <label>Size</label>
                        <select id="inspector-size">
                            <option value="">Default</option>
                            <option value="12px">12</option>
                            <option value="14px">14</option>
                            <option value="16px">16</option>
                            <option value="20px">20</option>
                            <option value="24px">24</option>
                            <option value="32px">32</option>
                        </select>
                    </div>
                    <div class="inspector-row">
                        <label>Color</label>
                        <div class="color-picker-wrapper">
                            <input type="color" id="inspector-color" value="#000000" />
                            <div class="color-palette">
                                <span class="color-swatch" data-color="#000000" style="background-color: #000000;"></span>
                                <span class="color-swatch" data-color="#e74c3c" style="background-color: #e74c3c;"></span>
                                <span class="color-swatch" data-color="#e67e22" style="background-color: #e67e22;"></span>
                                <span class="color-swatch" data-color="#f1c40f" style="background-color: #f1c40f;"></span>
                                <span class="color-swatch" data-color="#2ecc71" style="background-color: #2ecc71;"></span>
                                <span class="color-swatch" data-color="#3498db" style="background-color: #3498db;"></span>
                                <span class="color-swatch" data-color="#9b59b6" style="background-color: #9b59b6;"></span>
                            </div>
                        </div>
                    </div>
                    <div class="inspector-row">
                        <button id="inspector-bold" title="Bold">B</button>
                        <button id="inspector-italic" title="Italic">I</button>
                    </div>
                </div>
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
