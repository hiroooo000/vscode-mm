import * as vscode from 'vscode';
import { MindMapService } from '../../usecases/MindMapService';
import { VSCodeImageRepository } from './VSCodeImageRepository';

export class MindMapEditorProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const imageRepository = new VSCodeImageRepository();
        const service = new MindMapService(imageRepository);
        const provider = new MindMapEditorProvider(context, service);
        const providerRegistration = vscode.window.registerCustomEditorProvider(MindMapEditorProvider.viewType, provider);
        return providerRegistration;
    }

    private static readonly viewType = 'vscode-mm.mindmap';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly service: MindMapService
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

        const updateWebview = async () => {
            const result = await this.service.getWebviewContent(document.getText(), document.uri.fsPath);

            // If the document was empty and default content was generated, we might need to update the document itself?
            // The original code did: "if text empty -> edit.insert(defaultContent)"
            // My service.getWebviewContent returns the default content string if input is empty, BUT it doesn't modify the document.
            // The webview will receive the default content.
            // If we want to persist the default content to the file immediately, we should check `document.getText()` here.

            if (document.getText().trim().length === 0) {
                const edit = new vscode.WorkspaceEdit();
                edit.insert(document.uri, new vscode.Position(0, 0), result.text);
                await vscode.workspace.applyEdit(edit);
            }

            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText().trim().length === 0 ? result.text : document.getText(), // Use result.text if we just inserted, or document.getText() which should be same
                images: result.images
            });
        }

        // Hook up event handlers so that we can synchronize the webview with the text document.
        // The text document acts as our model, so we have to update the webview whenever it changes.

        // Use a flag to prevent infinite loops (webview update -> document update -> webview update)
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
        webviewPanel.webview.onDidReceiveMessage(async e => {
            switch (e.type) {
                case 'change':
                    isInternalUpdate = true;
                    await this.updateTextDocument(document, e.text);
                    isInternalUpdate = false;

                    if (e.images) {
                        await this.service.saveImages(document.uri.fsPath, e.images);
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
     * Get the static html used for the editor webviews.
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        // Local path to script and css for the webview
        // We will continue to use 'media/main.js' as the target for the bundled webview script
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
