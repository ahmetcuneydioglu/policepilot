import { getOcrProvider } from "./providerFactory";
import type { OcrFile, PolicyOcrResult } from "./types";

export * from "./types";
export { getOcrProvider } from "./providerFactory";

export async function extractPolicyData(file: OcrFile): Promise<PolicyOcrResult> {
  return getOcrProvider().extractPolicyData(file);
}
