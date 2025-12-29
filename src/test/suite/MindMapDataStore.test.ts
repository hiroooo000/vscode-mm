import * as assert from 'assert';
import * as vscode from 'vscode';
import { MindMapDataStore, ImageMap } from '../../MindMapDataStore';

suite('MindMapDataStore Test Suite', () => {
    vscode.window.showInformationMessage('Start MindMapDataStore tests.');

    test('getImagesPath should return correct path', () => {
        const docPath = '/path/to/my.mindmap';
        const expected = '/path/to/my_img.json';
        assert.strictEqual(MindMapDataStore.getImagesPath(docPath), expected);
    });

    test('transformToWebviewImages should convert JSON to flat map', () => {
        const json = {
            image: [
                { "node1": "data1" },
                { "node2": "data2" }
            ]
        };
        const expected: ImageMap = {
            "node1": "data1",
            "node2": "data2"
        };
        assert.deepStrictEqual(MindMapDataStore.transformToWebviewImages(json), expected);
    });

    test('transformToWebviewImages should handle empty/malformed JSON', () => {
        assert.deepStrictEqual(MindMapDataStore.transformToWebviewImages({}), {});
        assert.deepStrictEqual(MindMapDataStore.transformToWebviewImages(null), {});
        assert.deepStrictEqual(MindMapDataStore.transformToWebviewImages({ image: "not an array" }), {});
    });

    test('transformToJsonImages should convert flat map to JSON', () => {
        const images: ImageMap = {
            "node1": "data1",
            "node2": "data2"
        };
        const result = MindMapDataStore.transformToJsonImages(images);
        assert.strictEqual(Array.isArray(result.image), true);
        assert.strictEqual(result.image.length, 2);

        // Order might vary, but content should match
        const node1Entry = result.image.find(item => item["node1"] === "data1");
        const node2Entry = result.image.find(item => item["node2"] === "data2");
        assert.ok(node1Entry);
        assert.ok(node2Entry);
    });
});
