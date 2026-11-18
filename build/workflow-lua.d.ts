export declare const WORKFLOW_DIR: string;
export type LuaWorkflowResult = Record<string, unknown>;
export declare function runLuaWorkflow(luaFile: string, profile: Record<string, unknown>): Promise<LuaWorkflowResult>;
