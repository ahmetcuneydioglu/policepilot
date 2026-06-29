import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — SigortaOS",
  description:
    "SigortaOS gizlilik politikası: kişisel verilerin toplanması, işlenmesi, üçüncü taraflarla paylaşımı ve KVKK kapsamındaki haklarınız.",
};

const THIRD_PARTIES: [string, string, string][] = [
  ["Supabase", "Barındırma, veritabanı, kimlik doğrulama ve dosya depolama", "Tüm hesap ve içerik verileri"],
  ["OpenAI", "Poliçe/evrak görsellerinin OCR ile metne dönüştürülmesi", "Yüklenen belge görselleri"],
  ["Meta Platforms (WhatsApp Business Cloud API)", "Müşterilere WhatsApp mesajı/özet gönderimi", "Müşteri telefon numarası ve mesaj içeriği"],
  ["Expo", "Anlık (push) bildirim iletimi", "Cihaz push jetonu"],
  ["SMS sağlayıcısı", "Telefon doğrulama (OTP) kodu gönderimi", "Telefon numarası"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-24">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed">{children}</p>;
}

export default function GizlilikPage() {
  return (
    <main className="min-h-full bg-slate-50 text-slate-700">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
            Sigorta<span className="text-indigo-600">OS</span>
          </Link>
          <Link href="/" className="text-sm text-slate-500 transition hover:text-slate-800">
            {`← Ana sayfa`}
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Gizlilik Politikası</h1>
        <p className="mt-2 text-sm text-slate-500">{`Yürürlük tarihi: 29 Haziran 2026`}</p>

        <div className="mt-10 space-y-10">
          <Section title="1. Giriş">
            <P>{`SigortaOS ("Uygulama", "biz"), sigorta acenteleri için geliştirilmiş bir operasyon ve müşteri yönetim (CRM) platformudur. Bu Gizlilik Politikası, Uygulama'yı kullanırken kişisel verilerin nasıl toplandığını, işlendiğini, paylaşıldığını ve korunduğunu, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ilgili mevzuat çerçevesinde açıklar.`}</P>
          </Section>

          <Section title="2. Veri Sorumlusu ve Veri İşleyen Ayrımı (Önemli)">
            <ul className="list-disc space-y-2 pl-5">
              <li>{`Hesap ve kullanım verileriniz (acente kullanıcısı olarak e-postanız, telefonunuz, acente bilgileriniz) bakımından SigortaOS veri sorumlusudur.`}</li>
              <li>{`Uygulamaya kendi müşterilerinize ait olarak girdiğiniz kişisel veriler bakımından acenteniz (siz) veri sorumlusu, SigortaOS ise veri işleyen sıfatıyla, yalnızca size hizmet sunmak amacıyla ve talimatlarınız doğrultusunda hareket eder. Bu verilerin hukuka uygun toplanması ve müşterilerin aydınlatılması acentenin sorumluluğundadır.`}</li>
            </ul>
          </Section>

          <Section title="3. Topladığımız Kişisel Veriler">
            <P>{`a) Hesap ve kimlik verileri: ad-soyad, e-posta, telefon numarası, acente adı/bilgileri, şifre (şifrelenmiş/özetlenmiş olarak saklanır).`}</P>
            <P>{`b) Uygulama kullanım verileri: bildirim için cihaz push jetonu, oturum ve işlem kayıtları (log), temel cihaz bilgileri.`}</P>
            <P>{`c) Acente tarafından girilen müşteri verileri: müşteri ad-soyadı, telefon numarası, T.C. kimlik numarası, araç plakası, poliçe bilgileri ve yüklenen evrak/belge görselleri.`}</P>
            <P>{`d) Özel nitelikli kişisel veriler: Sağlık sigortası gibi işlemlerde sağlık verisi ve T.C. kimlik numarası gibi veriler söz konusu olabilir. Bu veriler yalnızca acentenin talimatıyla işlenir ve ek koruma önlemlerine tabidir.`}</P>
          </Section>

          <Section title="4. Kişisel Verileri İşleme Amaçları ve Hukuki Sebepler">
            <P>{`Verileri; hizmetin sunulması, hesap oluşturma ve kimlik doğrulama (OTP), poliçe/müşteri/yenileme/teklif yönetimi, evrak görsellerinin metne dönüştürülmesi (OCR), hatırlatma ve bildirim gönderimi, güvenlik ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işleriz.`}</P>
            <P>{`Hukuki sebepler (KVKK m.5): sözleşmenin kurulması/ifası, meşru menfaat, hukuki yükümlülük ve — gerekli hallerde — açık rıza.`}</P>
          </Section>

          <Section title="5. Üçüncü Taraflarla Paylaşım ve Yurt Dışına Aktarım">
            <P>{`Hizmetin sunulabilmesi için aşağıdaki tedarikçilerle (veri işleyenlerle) sınırlı veri paylaşımı yapılır. Bu sağlayıcıların sunucuları yurt dışında bulunabileceğinden, ilgili veriler yurt dışına aktarılabilir:`}</P>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left">
                    <th className="py-2 pr-4 font-semibold text-slate-900">Sağlayıcı</th>
                    <th className="py-2 pr-4 font-semibold text-slate-900">Amaç</th>
                    <th className="py-2 font-semibold text-slate-900">Paylaşılan veri</th>
                  </tr>
                </thead>
                <tbody>
                  {THIRD_PARTIES.map((row) => (
                    <tr key={row[0]} className="border-b border-slate-200 align-top">
                      <td className="py-2 pr-4 font-medium text-slate-800">{row[0]}</td>
                      <td className="py-2 pr-4">{row[1]}</td>
                      <td className="py-2">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>{`Verilerinizi reklam amacıyla satmıyor veya kiralamıyoruz. Hukuken zorunlu hallerde yetkili kamu kurumlarıyla paylaşım yapılabilir.`}</P>
          </Section>

          <Section title="6. Çerezler ve İzleme">
            <P>{`Uygulama, üçüncü taraf reklam veya analitik/izleme (tracking) yazılımı kullanmaz. Web paneli yalnızca oturumun sürdürülmesi için gerekli teknik çerezleri kullanabilir.`}</P>
          </Section>

          <Section title="7. Saklama Süreleri">
            <P>{`Kişisel veriler, ilgili işleme amacının gerektirdiği ve mevzuatta öngörülen süreler boyunca saklanır. Amaç ortadan kalktığında veya talep üzerine veriler silinir, yok edilir ya da anonim hale getirilir. Acente, hesabını kapattığında ilgili veriler makul süre içinde silinir.`}</P>
          </Section>

          <Section title="8. Veri Güvenliği">
            <P>{`Verilerin korunması için; şifreli iletişim (HTTPS), şifrelerin özetlenerek saklanması, satır düzeyinde erişim kontrolü (RLS) ile acenteler arası veri izolasyonu, yetki/rol bazlı erişim ve telefon doğrulama (OTP) gibi teknik ve idari tedbirler uygulanır.`}</P>
          </Section>

          <Section title="9. İlgili Kişinin Hakları (KVKK m.11)">
            <P>{`Kişisel veri sahibi olarak; verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, işlenme amacını öğrenme, eksik/yanlış verilerin düzeltilmesini, silinmesini veya yok edilmesini isteme, işlemenin hukuka aykırılığı halinde itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı destek@sigortaos.com adresine iletebilirsiniz.`}</P>
            <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              {`Not: Acentenin sisteme girdiği müşteri verilerine ilişkin talepler, veri sorumlusu sıfatıyla öncelikle ilgili acenteye yöneltilmelidir.`}
            </p>
          </Section>

          <Section title="10. Çocukların Gizliliği">
            <P>{`SigortaOS, sigorta profesyonellerine yönelik bir iş uygulamasıdır ve çocuklara yönelik değildir; bilerek çocuklardan kişisel veri toplamaz.`}</P>
          </Section>

          <Section title="11. Politikadaki Değişiklikler">
            <P>{`Bu politika zaman zaman güncellenebilir. Önemli değişikliklerde Uygulama veya web sitesi üzerinden bilgilendirme yapılır; güncel sürüm her zaman bu sayfada yayımlanır.`}</P>
          </Section>

          <Section title="12. İletişim">
            <P>
              {`SigortaOS — E-posta: `}
              <a href="mailto:destek@sigortaos.com" className="text-indigo-600 hover:underline">
                destek@sigortaos.com
              </a>
              {` · Web: `}
              <a href="https://sigortaos.com" className="text-indigo-600 hover:underline">
                sigortaos.com
              </a>
            </P>
          </Section>
        </div>

        <p className="mt-12 border-t border-slate-200 pt-6 text-xs italic text-slate-400">
          {`Bu metin bilgilendirme amaçlı bir şablondur; nihai KVKK/yasal uyum ve "Aydınlatma Metni" gereksinimleri için bir hukuk danışmanından görüş almanız önerilir.`}
        </p>
      </article>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-6 text-center text-xs text-slate-400">
          {`© 2026 SigortaOS`}
        </div>
      </footer>
    </main>
  );
}
