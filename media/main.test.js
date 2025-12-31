const assert = require('assert');
const sinon = require('sinon');

// --- DOM Mocks ---
if (typeof global.document === 'undefined') {
    global.document = {
        createElement: sinon.stub(),
        body: {
            appendChild: sinon.spy()
        },
        getElementById: sinon.stub()
    };
}
if (typeof global.window === 'undefined') {
    global.window = {
        addEventListener: sinon.spy()
    };
}
if (typeof global.Image === 'undefined') {
    global.Image = class {
        constructor() {
            setTimeout(() => {
                if (this.onload) this.onload();
            }, 0);
        }
        set src(val) { this._src = val; }
        get width() { return 1000; }
        get height() { return 1000; }
    };
}
if (typeof global.FileReader === 'undefined') {
    global.FileReader = class {
        readAsDataURL(blob) {
            setTimeout(() => {
                if (this.onload) this.onload({ target: { result: 'data:image/png;base64,mock' } });
            }, 0);
        }
    };
}

// Mock MindElixir on window
global.window.MindElixir = sinon.stub();

// Setup document.createElement mock before require
if (typeof global.document === 'undefined') {
    global.document = {
        createElement: sinon.stub().returns({ style: {}, addEventListener: sinon.spy(), appendChild: sinon.spy() }),
        body: {
            appendChild: sinon.spy()
        },
        getElementById: sinon.stub().returns({ addEventListener: sinon.spy(), style: {}, appendChild: sinon.spy() })
    };
}

const { ImageProcessor, ImageModal, MindMapApp } = require('./main');

describe('Webview Refactoring Tests (Mocha)', () => {

    describe('ImageProcessor', () => {
        it('should resize image using mock canvas', async () => {
            const mockCanvas = {
                getContext: sinon.stub().returns({
                    drawImage: sinon.spy(),
                }),
                toDataURL: sinon.stub().returns('data:image/jpeg;base64,resized'),
                width: 0,
                height: 0
            };
            document.createElement.withArgs('canvas').returns(mockCanvas);

            const result = await ImageProcessor.resizeImage('data:image/jpeg;base64,original', 200, 200);
            assert.deepStrictEqual(result, {
                base64: 'data:image/jpeg;base64,resized',
                width: 200,
                height: 200
            });
            assert.strictEqual(mockCanvas.width, 200);
            assert.strictEqual(mockCanvas.height, 200);
        });
    });

    describe('ImageModal', () => {
        let modal;
        let mindMock;

        beforeEach(() => {
            mindMock = {
                selectNode: sinon.spy(),
                container: { focus: sinon.spy() }
            };
            const mockDiv = {
                style: {},
                appendChild: sinon.spy(),
                querySelector: sinon.stub().returns({}),
                addEventListener: sinon.spy()
            };
            document.createElement.withArgs('div').returns(mockDiv);
            modal = new ImageModal(null, mindMock);
        });

        it('should initialize modal element', () => {
            assert.ok(modal.modal);
            assert.strictEqual(modal.modal.id, 'image-popup');
        });
    });

    describe('MindMapApp', () => {
        let vscodeMock;
        let mindElixirMock;
        let app;

        beforeEach(() => {
            vscodeMock = {
                getState: sinon.stub().returns({}),
                postMessage: sinon.spy()
            };
            mindElixirMock = sinon.stub().returns({
                bus: { addListener: sinon.spy() },
                init: sinon.spy(),
                refresh: sinon.spy(),
                getData: sinon.stub().returns({ data: 'test' }),
                currentNode: null
            });
            mindElixirMock.RIGHTT = 1;

            const mockDiv = {
                addEventListener: sinon.spy(),
                appendChild: sinon.spy(),
                style: {}
            };
            document.getElementById.withArgs('mindmap').returns(mockDiv);
            document.createElement.withArgs('div').returns(mockDiv);

            app = new MindMapApp(vscodeMock, mindElixirMock);
        });

        it('should initialize MindElixir', () => {
            assert.ok(mindElixirMock.called);
            assert.ok(app.mind.bus.addListener.calledWith('operation', sinon.match.func));
        });

        it('should handle vscode update message', () => {
            const message = { type: 'update', text: '{"data":"new"}', images: { "1": "base64" } };
            app.handleVscodeMessage(message);
            assert.deepStrictEqual(app.originalImageCache, { "1": "base64" });
            assert.ok(app.mind.init.calledWith({ data: "new" }));
            assert.ok(app.mind.refresh.called);
        });
    });
});
