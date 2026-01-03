# VS Code Mind Map

[日本語 (Japanese)](./README.ja.md)

Visualize and organize your thoughts intuitively within VS Code.

This extension provides a powerful and intuitive mind map editor directly integrated into VS Code, allowing you to create, edit, and manage your ideas in a graphical format.

## ✨ Features

- **Intuitive Editing**: Add, delete, and modify nodes with simple keyboard shortcuts or via the UI.
- **Image Paste**: Directly paste images from your clipboard into nodes.
- **Powered by MindElixir**: Uses [MindElixir](https://github.com/ssshooter/mind-elixir) as the core engine for smooth rendering and interaction.
- **Bi-directional Sync**: Real-time synchronization between the visual map and the underlying document model (JSON).
- **Native Integration**: Supports VS Code Undo/Redo, file persistence, and integrates seamlessly with the workbench theme.

## 🎨 About MindElixir

This extension leverages **[MindElixir](https://github.com/ssshooter/mind-elixir)** as its core library for mind map rendering and manipulation.

MindElixir is a flexible and fast mind map engine that handles:
- Graphical rendering of the mind map.
- Interactions such as node expansion/collapse and drag-and-drop.
- Providing a standard mind map data format.

## 🚀 Getting Started

> [!IMPORTANT]
> This extension is currently under development and is **not yet available on the VS Code Marketplace.**
> To use it, you must clone the project and build it locally.

1. **Create a File**: Create a new file with the `.mm` or `.mindmap` extension.
2. **Open with Mind Map Editor**: Right-click the file and select "Open With..." and choose "Mind Map".
3. **Start Mapping**: Use the UI or shortcuts to build your mind map.

### How to Paste Images
1. Copy an image to your clipboard.
2. Select a node in the mind map.
3. Press `Ctrl + V` (or `Cmd + V`) to paste the image into the node.

## ⌨️ Shortcuts

General shortcuts (based on MindElixir defaults):
- `Tab`: Add a child node
- `Enter`: Add a sibling node
- `Delete`: Remove a node
- `Space`: Edit node text

## 🛠️ Technical Overview

- **Core**: Built as a `CustomTextEditorProvider` using the VS Code Extension API.
- **Frontend**: Utilizes a Webview with **MindElixir** (JavaScript/TypeScript).
- **Data Format**: Uses a JSON-based structure compatible with MindElixir.

## 🧪 Development

If you want to contribute or build the project from source:

### Dev Container

This project is configured with a Dev Container.
1. Reopen the project in a Dev Container.
2. The environment is automatically set up with all dependencies.


```bash
# Install dependencies
npm install

# Compile the project
npm run compile

# Run tests
npm run test:all:devcontainer
```

## 📜 License

[MIT License](./LICENSE)
