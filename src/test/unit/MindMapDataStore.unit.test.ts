import * as assert from 'assert';
import { MindMapDataStore, ImageMap } from '../../MindMapDataStore';

describe('MindMapDataStore Unit Test Suite (Direct)', () => {

    it('getImagesPath should return correct path', () => {
        const docPath = '/path/to/my.mindmap';
        const expected = '/path/to/my_img.json';
        assert.strictEqual(MindMapDataStore.getImagesPath(docPath), expected);
    });

    it('getImagesPath should handle .mm extension', () => {
        const docPath = '/path/to/my.mm';
        const expected = '/path/to/my_img.json';
        assert.strictEqual(MindMapDataStore.getImagesPath(docPath), expected);
    });

    it('transformToWebviewImages should convert JSON to flat map', () => {
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

    it('transformToWebviewImages should handle empty/malformed JSON', () => {
        assert.deepStrictEqual(MindMapDataStore.transformToWebviewImages({}), {});
        assert.deepStrictEqual(MindMapDataStore.transformToWebviewImages(null), {});
        assert.deepStrictEqual(MindMapDataStore.transformToWebviewImages({ image: "not an array" }), {});
    });

    it('transformToJsonImages should convert flat map to JSON', () => {
        const images: ImageMap = {
            "node1": "data1",
            "node2": "data2"
        };
        const result = MindMapDataStore.transformToJsonImages(images);
        assert.strictEqual(Array.isArray(result.image), true);
        assert.strictEqual(result.image.length, 2);

        const node1Entry = result.image.find((item: any) => item["node1"] === "data1");
        const node2Entry = result.image.find((item: any) => item["node2"] === "data2");
        assert.ok(node1Entry);
        assert.ok(node2Entry);
    });
});
