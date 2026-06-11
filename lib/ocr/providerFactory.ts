import type { OcrProvider, OcrProviderName } from "./types";
import { DEMO_MODE } from "@/lib/demo-mode";
import { MockOcrProvider } from "./providers/mock";
import { OpenAiVisionOcrProvider } from "./providers/openaiVision";

export function getOcrProvider(): OcrProvider {
  const defaultProvider = process.env.OPENAI_API_KEY ? "openai_vision" : DEMO_MODE ? "mock" : "openai_vision";
  const name = (process.env.OCR_PROVIDER ?? defaultProvider) as OcrProviderName;

  switch (name) {
    case "mock":
      if (!DEMO_MODE) {
        throw new Error("Mock OCR yalnız DEMO_MODE=true iken kullanılabilir.");
      }
      return new MockOcrProvider();
    case "openai_vision":
      return new OpenAiVisionOcrProvider();
    case "google_document_ai":
    case "azure_form_recognizer":
    case "aws_textract":
      throw new Error(`'${name}' OCR sağlayıcısı henüz bağlı değil. Şimdilik OCR_PROVIDER=mock kullanın.`);
    default:
      throw new Error(`Bilinmeyen OCR sağlayıcısı: ${name}`);
  }
}
