/**
 * Security Center — alan hatası.
 * API katmanı `status` + `code`'u doğrudan HTTP yanıtına çevirir.
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "security_error",
    public readonly meta?: Record<string, unknown>
  ) {
    super(message);
    this.name = "SecurityError";
  }
}
