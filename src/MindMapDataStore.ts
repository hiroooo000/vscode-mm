
export interface ImageMap {
    [id: string]: string;
}

export interface ImageJson {
    image: { [id: string]: string }[];
}

export class MindMapDataStore {
    /**
     * Gets the path for the images JSON file based on the mind map document fsPath.
     */
    public static getImagesPath(fsPath: string): string {
        return fsPath.replace(/\.(mm|mindmap)$/, '_img.json');
    }

    /**
     * Transforms the nested image format from JSON to a flat map for the webview.
     */
    public static transformToWebviewImages(json: any): ImageMap {
        const images: ImageMap = {};
        if (json && json.image && Array.isArray(json.image)) {
            json.image.forEach((item: any) => {
                const id = Object.keys(item)[0];
                if (id && id !== "") {
                    Object.assign(images, item);
                }
            });
        }
        return images;
    }

    /**
     * Transforms the flat map from the webview to the nested JSON format.
     */
    public static transformToJsonImages(images: ImageMap): ImageJson {
        const imageList = Object.entries(images).map(([id, data]) => ({ [id]: data }));
        return {
            image: imageList
        };
    }
}
