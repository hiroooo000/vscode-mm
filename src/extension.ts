import * as vscode from 'vscode';
import { MindMapEditorProvider } from './MindMapEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Mind Map extension is active');
    vscode.window.showInformationMessage('Mind Map extension is active');

    context.subscriptions.push(MindMapEditorProvider.register(context));
}
