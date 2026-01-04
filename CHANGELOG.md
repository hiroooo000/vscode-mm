# Change Log

All notable changes to the "vscode-mm" extension will be documented in this file.

## [0.1.4] - 2026-01-04
### Technical & Chore
- Version bump for verification.

## [0.1.3] - 2026-01-04
### Technical & Chore
- Fixed packaging workflow to properly append version number to the VSIX filename.

## [0.1.2] - 2026-01-04
### Technical & Chore
- Fixed packaging workflow to exclude dependencies (`--no-dependencies`).

## [0.1.0] - 2026-01-03
### Features
- Initial release of VS Code Mind Map.
- Basic mind map editing features (add, delete, edit nodes).
- Image paste support.
- MindElixir integration.
- Automatically initialize empty `.mm` or `.mindmap` files with a root node.

### Technical & Chore
- **CI/CD**: Added GitHub Actions workflows for packaging and testing.
- **Dev Container**: Configured environment with xvfb for UI testing.
- **Maintenance**: Resolved npm deprecation warnings and fixed lint issues.
