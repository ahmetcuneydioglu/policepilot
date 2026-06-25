import type { SmsProvider, SmsMessage, SmsSendResult } from "../types";

/**
 * Netgsm SMS sağlayıcısı — ŞABLON/STUB.
 *
 * Yeni bir gerçek sağlayıcı eklemenin örneğidir: bu sınıfı doldurun (HTTP isteği),
 * env'e NETGSM_USER / NETGSM_PASSWORD / NETGSM_HEADER girin, providerFactory zaten
 * bu sınıfı döndürüyor. Twilio/Vonage/AWS SNS için de aynı kalıbı kopyalayın.
 */
export class NetgsmSmsProvider implements SmsProvider {
  readonly name = "netgsm" as const;

  constructor(
    private readonly user: string,
    private readonly password: string,
    private readonly header: string
  ) {}

  async sendSms(_msg: SmsMessage): Promise<SmsSendResult> {
    // TODO: Netgsm REST/XML API entegrasyonu burada yapılır.
    //   POST https://api.netgsm.com.tr/sms/rest/v2/send  { usercode, password, msgheader, ... }
    throw new Error(
      "Netgsm SMS sağlayıcısı henüz implemente edilmedi. " +
      "services/security/sms/providers/netgsm.ts içini doldurun ve NETGSM_USER/NETGSM_PASSWORD/NETGSM_HEADER tanımlayın."
    );
  }
}
