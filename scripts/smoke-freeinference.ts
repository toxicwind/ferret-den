import { runFreeInferenceRecon } from "../src/workflows/freeinference.js";

const key = process.env.FREEINFERENCE_KEY!;
const result = await runFreeInferenceRecon({ apiKey: key });
console.log(JSON.stringify(result, null, 2));
