import type { OcrProvider, OcrProviderName } from "./types";
import { MockOcrProvider } from "./providers/mock";

export function getOcrProvider(): OcrProvider {
  const name = (process.env.OCR_PROVIDER ?? "mock") as OcrProviderName;

  switch (name) {
    case "mock":
      return new MockOcrProvider();
    case "openai_vision":
    case "google_document_ai":
    case "azure_form_recognizer":
    case "aws_textract":
      throw new Error(`'${name}' OCR sağlayıcısı henüz bağlı değil. Şimdilik OCR_PROVIDER=mock kullanın.`);
    default:
      throw new Error(`Bilinmeyen OCR sağlayıcısı: ${name}`);
  }
}
