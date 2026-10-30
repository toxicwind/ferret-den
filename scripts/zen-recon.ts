import { runOpenCodeZenRecon } from "../src/workflows/opencode-zen.js";

const result = await runOpenCodeZenRecon({
  baseUrl: "https://opencode.ai",
  chatProbeModel: "z-ai/glm-5.3-flash",
  timeoutMs: 15000,
});
console.log(JSON.stringify(result, null, 2));
