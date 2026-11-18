export type DenTool = {
    den: string;
    bin: string;
    job: string;
    gated?: boolean;
};
export declare const DEN: DenTool[];
export declare function resolveDen(name: string): DenTool | undefined;
