export interface HttpxResult {
    responses: Array<{
        url: string;
        statusCode?: number;
        contentLength?: number;
        title?: string;
        webserver?: string;
        tech?: string[];
    }>;
    count: number;
    error?: string;
}
export declare function executeHttpx(urls: string[], followRedirects?: boolean, techDetect?: boolean): Promise<HttpxResult>;
