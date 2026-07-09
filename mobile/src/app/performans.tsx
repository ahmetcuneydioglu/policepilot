/**
 * src/app/performans.tsx — Personel Performans Merkezi (acente sahibi/yönetici)
 * Web /api/team/performance + /api/team/coaching köprüsü üzerinden çalışır.
 * Bölümler:
 *   1) EKİP ÖZETİ        — team.* toplamları (müşteri/teklif/poliçe/prim/dönüşüm)
 *   2) 7-GÜN AKTİVİTE     — last7[] bar satırı
 *   3) PERSONEL SIRALAMASI — users[] (owner hariç, skora göre azalan) + karta dokun → detay modalı
 *   4) AI KOÇLUK          — /api/team/coaching items + "AI ile zenginleştir"
 * Yetki: 403 → "acente yöneticileri içindir" boş durumu; 401 → "Sunucu güncellemesi yayınlanmalı".
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Type, Shadow } from '@/lib/theme';
import { formatTRY, formatShortTRY } from '@/lib/format';
import { apiGet, ApiError } from '@/lib/api';

/* ── Web sözleşmesiyle birebir tipler (lib/performance.ts, lib/coaching.ts) ── */
type UserPerf = {
  id: string;
  name: string;
  role_label: string;
  agency_role: string | null;
  customers: number;
  quotes_total: number;
  interactions_total: number;
  interactions_month: number;
  visits_total: number;
  quotes_month: number;
  quotes_won: number;
  policies_total: number;
  policies_month: number;
  total_premium: number;
  total_commission: number;
  conversion: number;
  opportunities_total: number;
  opportunities_won: number;
  opp_conversion: number;
  score: number;
  last_activity: string | null;
  last_login: string | null;
};

type AgencyPerformance = {
  users: UserPerf[];
  leaders: {
    most_active: UserPerf | null;
    top_quotes: UserPerf | null;
    top_policies: UserPerf | null;
    top_premium: UserPerf | null;
    top_conversion: UserPerf | null;
  };
  last7: { date: string; count: number }[];
  team: {
    total_customers: number;
    total_quotes: number;
    total_interactions: number;
    total_policies: number;
    total_premium: number;
    total_commission: number;
    conversion: number;
    avg_conversion: number;
  };
  unattributed: number;
};

type CoachingSeverity = 'high' | 'medium' | 'low' | 'positive';
type CoachingItem = {
  user_id: string;
  user_name: string;
  severity: CoachingSeverity;
  tag: string;
  observation: string;
  action: string;
};
type CoachingResponse = {
  items: CoachingItem[];
  generated_by: 'rules' | 'ai';
  ai_available: boolean;
  ai_error?: boolean;
};

const IDLE_DAYS = 7;

/* ── Yardımcılar ──────────────────────────────────────────────────────────── */
function relTime(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  const days = Math.floor(hrs / 24);
  return `${days} gün önce`;
}
function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}
function initials(name: string): string {
  return name.split(' ').map((n) => n[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}
function scoreTone(s: number) {
  if (s >= 75) return { fg: Colors.success, bg: Colors.successBg, label: 'Yüksek' };
  if (s >= 50) return { fg: Colors.primary, bg: Colors.primaryLight, label: 'İyi' };
  if (s >= 25) return { fg: '#B45309', bg: Colors.warningBg, label: 'Orta' };
  return { fg: Colors.danger, bg: Colors.dangerBg, label: 'Düşük' };
}
function sevTone(s: CoachingSeverity) {
  switch (s) {
    case 'high': return { fg: Colors.danger, bg: Colors.dangerBg, strip: Colors.danger };
    case 'medium': return { fg: '#B45309', bg: Colors.warningBg, strip: Colors.warning };
    case 'positive': return { fg: Colors.success, bg: Colors.successBg, strip: Colors.success };
    default: return { fg: Colors.secondary, bg: Colors.surface, strip: Colors.border };
  }
}

// Saha Günlüğü (Portföy Faz 4) — /api/portfolio/insights sözleşmesi
type SahaStaff = {
  id: string; name: string;
  interactions: number; phone: number; visits: number; whatsapp: number;
  quotes_sent: number; won: number; open_deals: number; stale_deals: number;
};
type SahaInsights = {
  totals: { interactions: number; visits: number; quotes_sent: number; won: number };
  staff: SahaStaff[];
  stale_deals: { id: string; title: string; customer_name: string | null; owner_name: string | null; days: number }[];
};

export default function PerformansScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<AgencyPerformance | null>(null);
  const [selected, setSelected] = useState<UserPerf | null>(null);

  // Koçluk durumu
  const [coaching, setCoaching] = useState<CoachingResponse | null>(null);
  const [coachLoading, setCoachLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);

  // Saha Günlüğü (Portföy Faz 4) — haftalık kokpit, best-effort
  const [saha, setSaha] = useState<SahaInsights | null>(null);

  const loadPerf = useCallback(async () => {
    setError(null);
    setForbidden(false);
    try {
      const perf = await apiGet<AgencyPerformance>('/api/team/performance');
      setData(perf);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
      } else if (e instanceof ApiError && e.status === 401) {
        setError('Sunucu güncellemesi yayınlanmalı.');
      } else {
        setError(e instanceof Error ? e.message : 'Performans verisi alınamadı.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCoaching = useCallback(async (enrich: boolean) => {
    if (enrich) setEnriching(true); else setCoachLoading(true);
    try {
      const res = await apiGet<CoachingResponse>(`/api/team/coaching${enrich ? '?enrich=1' : ''}`);
      setCoaching(res);
    } catch {
      // Koçluk ikincil — sessizce geç (ana ekran yine de gösterilir)
    } finally {
      setCoachLoading(false);
      setEnriching(false);
    }
  }, []);

  const loadSaha = useCallback(async () => {
    try {
      const res = await apiGet<SahaInsights>('/api/portfolio/insights');
      setSaha(res);
    } catch {
      // İkincil bölüm — sessizce geç (Portföy kullanılmıyorsa/deploy eskiyse ekran yine çalışır)
    }
  }, []);

  useEffect(() => {
    loadPerf();
    loadCoaching(false);
    loadSaha();
  }, [loadPerf, loadCoaching, loadSaha]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPerf(), loadCoaching(false), loadSaha()]);
    setRefreshing(false);
  }, [loadPerf, loadCoaching, loadSaha]);

  // Yalnız çalışanlar (owner hariç), skora göre azalan
  const staff = useMemo(
    () => (data ? data.users.filter((u) => u.agency_role !== 'owner').sort((a, b) => b.score - a.score) : []),
    [data],
  );
  const idle = useMemo(() => staff.filter((u) => daysSince(u.last_activity) >= IDLE_DAYS), [staff]);
  const maxDay = useMemo(() => Math.max(1, ...(data?.last7.map((d) => d.count) ?? [1])), [data]);
  const selectedRank = selected ? staff.findIndex((u) => u.id === selected.id) + 1 : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hBtn}><Text style={styles.hBack}>‹ Geri</Text></TouchableOpacity>
        <Text style={styles.hTitle}>Performans</Text>
        <View style={styles.hBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : forbidden ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>Yöneticilere özel</Text>
          <Text style={styles.emptyText}>Bu görünüm acente yöneticileri içindir.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View style={styles.errBanner}>
              <Text style={styles.errText}>{error}</Text>
              <TouchableOpacity onPress={loadPerf}><Text style={styles.errRetry}>Tekrar dene</Text></TouchableOpacity>
            </View>
          )}

          {data && (
            <>
              {/* ══ 1) EKİP ÖZETİ ════════════════════════════════════════════ */}
              <Text style={styles.sectionLabel}>EKİP ÖZETİ</Text>
              <Text style={styles.sectionSub}>Acentenizin toplam üretimi (tüm ekip)</Text>
              <View style={styles.statGrid}>
                <StatCard emoji="👥" label="Müşteri" value={String(data.team.total_customers)} />
                <StatCard emoji="🤝" label="Görüşme" value={String(data.team.total_interactions ?? 0)} />
                <StatCard emoji="📄" label="Fırsat" value={String(data.team.total_quotes)} />
                <StatCard emoji="🛡️" label="Poliçe" value={String(data.team.total_policies)} />
                <StatCard emoji="💰" label="Prim" value={formatShortTRY(data.team.total_premium)} />
                <StatCard emoji="📈" label="Dönüşüm" value={`%${data.team.conversion}`} />
                <StatCard emoji="🧾" label="Komisyon" value={formatShortTRY(data.team.total_commission)} />
              </View>

              {/* ══ 2) 7-GÜN AKTİVİTE ════════════════════════════════════════ */}
              <View style={styles.barCard}>
                <Text style={styles.barTitle}>SON 7 GÜN AKTİVİTE</Text>
                <View style={styles.barRow}>
                  {data.last7.map((d) => {
                    const h = Math.max(d.count > 0 ? 6 : 2, Math.round((d.count / maxDay) * 56));
                    return (
                      <View key={d.date} style={styles.barCol}>
                        <Text style={styles.barCount}>{d.count}</Text>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { height: h, backgroundColor: d.count > 0 ? Colors.primary : Colors.border }]} />
                        </View>
                        <Text style={styles.barDay}>{d.date.slice(8)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* ══ SAHA GÜNLÜĞÜ · BU HAFTA (Portföy kokpiti) ═══════════════ */}
              {saha && (saha.totals.interactions > 0 || saha.totals.quotes_sent > 0 || saha.totals.won > 0 || saha.stale_deals.length > 0) && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>SAHA GÜNLÜĞÜ · BU HAFTA</Text>
                  <Text style={styles.sectionSub}>
                    {saha.totals.interactions} görüşme · {saha.totals.visits} ziyaret · {saha.totals.quotes_sent} teklif · {saha.totals.won} poliçe
                  </Text>
                  <View style={styles.sahaCard}>
                    {saha.staff.filter((s) => s.interactions + s.quotes_sent + s.won + s.open_deals > 0).map((s, i, arr) => (
                      <View key={s.id} style={[styles.sahaRow, i < arr.length - 1 && styles.sahaRowBorder]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sahaName} numberOfLines={1}>{s.name}</Text>
                          <Text style={styles.sahaSub}>
                            🤝 {s.interactions} görüşme (📞{s.phone} · 🚶{s.visits} · 💬{s.whatsapp}) · 📄 {s.quotes_sent} · 🛡 {s.won}
                          </Text>
                        </View>
                        {s.stale_deals > 0 ? (
                          <View style={styles.sahaStaleBadge}>
                            <Text style={styles.sahaStaleText}>⏳ {s.stale_deals}</Text>
                          </View>
                        ) : (
                          <Text style={styles.sahaOpen}>{s.open_deals} açık iş</Text>
                        )}
                      </View>
                    ))}
                    {saha.stale_deals.length > 0 && (
                      <View style={styles.sahaStaleBox}>
                        <Text style={styles.sahaStaleTitle}>BEKLETİLEN İŞLER</Text>
                        {saha.stale_deals.slice(0, 4).map((d) => (
                          <TouchableOpacity key={d.id} onPress={() => router.push(`/portfoy?open=${d.id}`)} activeOpacity={0.7}>
                            <Text style={styles.sahaStaleRow} numberOfLines={1}>
                              • {d.customer_name ?? d.title} — {d.owner_name ?? '?'} · <Text style={{ fontWeight: '800' }}>{d.days} gün</Text> temassız
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* ══ 3) PERSONEL SIRALAMASI ═══════════════════════════════════ */}
              <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>PERSONEL SIRALAMASI</Text>
              <Text style={styles.sectionSub}>Performans skoruna göre (acente sahibi hariç)</Text>

              {idle.length > 0 && (
                <View style={styles.idleBanner}>
                  <Text style={styles.idleText}>
                    <Text style={styles.idleBold}>{idle.length} çalışan</Text> {IDLE_DAYS}+ gündür işlem yapmadı: {idle.map((u) => u.name).join(', ')}
                  </Text>
                </View>
              )}

              {staff.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>👥</Text>
                  <Text style={styles.emptyText}>Henüz çalışan yok. Satış personeli ekledikçe sıralama burada oluşur.</Text>
                </View>
              ) : (
                staff.map((u, i) => <RankCard key={u.id} user={u} rank={i + 1} onPress={() => setSelected(u)} />)
              )}

              {data.unattributed > 0 && (
                <Text style={styles.footnote}>
                  {data.unattributed} eski müşteri kaydı bir personele atfedilemiyor (sistem öncesi). Yeni kayıtlar otomatik atanır.
                </Text>
              )}

              {/* ══ 4) AI KOÇLUK ═════════════════════════════════════════════ */}
              <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>AI KOÇLUK</Text>
              <Text style={styles.sectionSub}>Ekip verinizden somut öneriler</Text>

              {coachLoading ? (
                <View style={styles.coachLoading}><ActivityIndicator color={Colors.primary} /></View>
              ) : coaching && coaching.items.length > 0 ? (
                <View style={styles.coachWrap}>
                  <View style={styles.coachHeadRow}>
                    <Text style={styles.coachHeadText}>
                      {coaching.generated_by === 'ai' ? '✨ Yapay zeka tarafından yazıldı' : '🤖 Otomatik üretildi'}
                    </Text>
                    {coaching.generated_by !== 'ai' && coaching.ai_available && (
                      <TouchableOpacity
                        style={[styles.enrichBtn, enriching && { opacity: 0.6 }]}
                        onPress={() => loadCoaching(true)}
                        disabled={enriching}
                        activeOpacity={0.85}
                      >
                        {enriching
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={styles.enrichBtnText}>✨ AI ile zenginleştir</Text>}
                      </TouchableOpacity>
                    )}
                    {coaching.generated_by === 'ai' && (
                      <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>✨ AI</Text></View>
                    )}
                  </View>
                  {coaching.ai_error && (
                    <Text style={styles.coachWarn}>AI şu an yanıt vermedi — kural-tabanlı öneriler gösteriliyor.</Text>
                  )}
                  {coaching.items.map((it, i) => {
                    const tone = sevTone(it.severity);
                    return (
                      <View key={`${it.user_id}-${i}`} style={styles.coachItem}>
                        <View style={[styles.coachStrip, { backgroundColor: tone.strip }]} />
                        <View style={styles.coachBody}>
                          <View style={styles.coachTopRow}>
                            <View style={[styles.tagChip, { backgroundColor: tone.bg }]}>
                              <Text style={[styles.tagChipText, { color: tone.fg }]}>{it.tag}</Text>
                            </View>
                            <Text style={styles.coachName}>{it.user_name}</Text>
                          </View>
                          <Text style={styles.coachObs}>{it.observation}</Text>
                          <Text style={styles.coachAction}>
                            <Text style={styles.coachActionLabel}>Öneri: </Text>{it.action}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>✅</Text>
                  <Text style={styles.emptyText}>Şu an dikkat gerektiren bir durum yok. Ekibin yolunda.</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {selected && data && (
        <DetailModal
          user={selected}
          rank={selectedRank}
          avgConversion={data.team.avg_conversion}
          onClose={() => setSelected(null)}
        />
      )}
    </SafeAreaView>
  );
}

/* ── Stat kartı ───────────────────────────────────────────────────────────── */
function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ── Sıralama kartı ───────────────────────────────────────────────────────── */
function RankCard({ user, rank, onPress }: { user: UserPerf; rank: number; onPress: () => void }) {
  const tone = scoreTone(user.score);
  const isIdle = daysSince(user.last_activity) >= IDLE_DAYS;
  const rankBg = rank === 1 ? Colors.warningBg : rank === 2 ? Colors.surface : rank === 3 ? Colors.amberBg : Colors.surface;
  const rankFg = rank === 1 ? '#B45309' : rank <= 3 ? Colors.text : Colors.secondary;
  return (
    <TouchableOpacity style={styles.rankCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rankTop}>
        <View style={[styles.rankNo, { backgroundColor: rankBg }]}>
          <Text style={[styles.rankNoText, { color: rankFg }]}>{rank === 1 ? '👑' : rank}</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user.name)}</Text></View>
        <View style={styles.rankIdent}>
          <Text style={styles.rankName} numberOfLines={1}>{user.name}</Text>
          <Text style={[styles.rankSub, isIdle && { color: Colors.warning }]}>
            {user.role_label} · {relTime(user.last_activity)}
          </Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.scoreBadgeText, { color: tone.fg }]}>{user.score}</Text>
        </View>
      </View>
      <View style={styles.rankMetrics}>
        <Metric label="Poliçe" value={String(user.policies_total)} />
        <Metric label="Prim" value={formatShortTRY(user.total_premium)} />
        <Metric label="Dönüşüm" value={`%${user.conversion}`} />
      </View>
    </TouchableOpacity>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

/* ── Detay modalı ─────────────────────────────────────────────────────────── */
function DetailModal({ user, rank, avgConversion, onClose }: {
  user: UserPerf; rank: number; avgConversion: number; onClose: () => void;
}) {
  const tone = scoreTone(user.score);
  const convDelta = user.quotes_total >= 2 ? user.conversion - avgConversion : null;
  const isIdle = daysSince(user.last_activity) >= IDLE_DAYS;

  const metrics: { k: string; v: string; sub?: string }[] = [
    { k: 'Müşteri', v: String(user.customers) },
    { k: 'Fırsat', v: String(user.quotes_total), sub: `bu ay ${user.quotes_month}` },
    { k: 'Görüşme', v: String(user.interactions_total ?? 0), sub: `ziyaret ${user.visits_total ?? 0}` },
    { k: 'Poliçe', v: String(user.policies_total), sub: `bu ay ${user.policies_month}` },
    { k: 'Kazanılan', v: String(user.quotes_won) },
    { k: 'Toplam Prim', v: formatTRY(user.total_premium) },
    { k: 'Komisyon', v: formatTRY(user.total_commission) },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.hBtn}><Text style={styles.hBack}>Kapat</Text></TouchableOpacity>
          <Text style={styles.hTitle}>Personel</Text>
          <View style={styles.hBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Kimlik + skor */}
          <View style={styles.detailHead}>
            <View style={styles.avatarLg}><Text style={styles.avatarLgText}>{initials(user.name)}</Text></View>
            <View style={styles.detailIdent}>
              <Text style={styles.detailName}>{user.name}</Text>
              <Text style={styles.detailRole}>{user.role_label} · Sıralama #{rank}</Text>
            </View>
            <View style={[styles.scoreBadgeLg, { backgroundColor: tone.bg }]}>
              <Text style={[styles.scoreBadgeLgText, { color: tone.fg }]}>{user.score}</Text>
              <Text style={[styles.scoreBadgeLgLabel, { color: tone.fg }]}>{tone.label}</Text>
            </View>
          </View>

          {/* Dönüşüm satırı */}
          <View style={[styles.card, { marginTop: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={styles.convLabel}>Dönüşüm</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.convValue}>%{user.conversion}</Text>
              {convDelta != null && convDelta !== 0 && (
                <Text style={[styles.convDelta, { color: convDelta > 0 ? Colors.success : Colors.danger }]}>
                  ekip ort. {convDelta > 0 ? '+' : ''}{convDelta}
                </Text>
              )}
            </View>
          </View>

          {/* Metrik kırılımı */}
          <View style={styles.metricGrid}>
            {metrics.map((m) => (
              <View key={m.k} style={styles.metricGridCell}>
                <Text style={styles.metricGridValue}>{m.v}</Text>
                <Text style={styles.metricGridLabel}>{m.k}</Text>
                {m.sub && <Text style={styles.metricGridSub}>{m.sub}</Text>}
              </View>
            ))}
          </View>

          {/* Satış fırsatları */}
          {user.opportunities_total > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>SATIŞ FIRSATLARI</Text>
              <View style={[styles.card, { flexDirection: 'row', gap: Spacing.sm }]}>
                <OppCell value={String(user.opportunities_total)} label="fırsat" />
                <OppCell value={String(user.opportunities_won)} label="kazanılan" />
                <OppCell value={`%${user.opp_conversion}`} label="dönüşüm" />
              </View>
            </>
          )}

          {/* Zaman bilgileri */}
          <View style={[styles.card, { marginTop: Spacing.lg }]}>
            <View style={styles.detailRow}>
              <Text style={styles.detailRowLabel}>Son işlem</Text>
              <Text style={[styles.detailRowValue, isIdle && { color: Colors.warning }]}>{relTime(user.last_activity)}</Text>
            </View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailRowLabel}>Son giriş</Text>
              <Text style={styles.detailRowValue}>{relTime(user.last_login)}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function OppCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.oppCell}>
      <Text style={styles.oppValue}>{value}</Text>
      <Text style={styles.oppLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hBtn: { minWidth: 56 },
  hBack: { ...Type.subhead, color: Colors.primary },
  hTitle: { ...Type.heading, fontSize: 16 },

  errBanner: { backgroundColor: Colors.dangerBg, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.danger },
  errText: { ...Type.caption, color: Colors.danger, lineHeight: 17 },
  errRetry: { ...Type.subhead, color: Colors.danger, marginTop: 6 },

  sectionLabel: { ...Type.label, marginBottom: 2 },
  sectionSub: { ...Type.caption, color: Colors.placeholder, marginBottom: Spacing.sm },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: { width: '31.5%', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  statEmoji: { fontSize: 18, marginBottom: 6 },
  statValue: { ...Type.heading, fontSize: 18, color: Colors.heading },
  statLabel: { ...Type.caption, color: Colors.placeholder, marginTop: 2 },

  // Bar
  barCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.sm, ...Shadow.sm },

  // Saha Günlüğü (Portföy kokpiti)
  sahaCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.sm, overflow: 'hidden' },
  sahaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 11 },
  sahaRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  sahaName: { ...Type.subhead, fontSize: 14 },
  sahaSub: { ...Type.caption, marginTop: 2 },
  sahaOpen: { ...Type.caption, color: Colors.placeholder, marginLeft: 8 },
  sahaStaleBadge: { backgroundColor: Colors.dangerBg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  sahaStaleText: { fontSize: 11, fontWeight: '800', color: Colors.danger },
  sahaStaleBox: { backgroundColor: Colors.warningBg, paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 4 },
  sahaStaleTitle: { fontSize: 10, fontWeight: '800', color: '#D97706', letterSpacing: 0.6, marginBottom: 2 },
  sahaStaleRow: { fontSize: 12, color: '#D97706', lineHeight: 18 }, // warningBg üstünde iki temada da okunur (gorevler ile aynı desen)
  barTitle: { ...Type.label, marginBottom: Spacing.md },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 86 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barCount: { ...Type.caption, fontSize: 10, color: Colors.secondary, marginBottom: 4 },
  barTrack: { height: 56, justifyContent: 'flex-end' },
  barFill: { width: 18, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barDay: { ...Type.caption, fontSize: 10, color: Colors.placeholder, marginTop: 4 },

  // Idle banner
  idleBanner: { backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.warning },
  idleText: { ...Type.caption, color: '#92400E', lineHeight: 17 },
  idleBold: { fontWeight: '800', color: '#92400E' },

  // Sıralama kartı
  rankCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  rankTop: { flexDirection: 'row', alignItems: 'center' },
  rankNo: { width: 30, height: 30, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankNoText: { fontSize: 14, fontWeight: '800' },
  avatar: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.heading, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rankIdent: { flex: 1, minWidth: 0 },
  rankName: { ...Type.subhead, fontSize: 14 },
  rankSub: { ...Type.caption, color: Colors.secondary, marginTop: 1 },
  scoreBadge: { minWidth: 38, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md, alignItems: 'center' },
  scoreBadgeText: { fontSize: 16, fontWeight: '800' },
  rankMetrics: { flexDirection: 'row', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { ...Type.subhead, fontSize: 14, color: Colors.heading },
  metricLabel: { ...Type.caption, fontSize: 11, color: Colors.placeholder, marginTop: 1 },

  footnote: { ...Type.caption, fontSize: 11, color: Colors.placeholder, marginTop: 6, paddingHorizontal: 2 },

  // Koçluk
  coachLoading: { paddingVertical: Spacing.lg, alignItems: 'center' },
  coachWrap: { },
  coachHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  coachHeadText: { ...Type.caption, color: Colors.secondary, flex: 1 },
  enrichBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  enrichBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  aiBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  aiBadgeText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  coachWarn: { ...Type.caption, color: '#B45309', marginBottom: Spacing.sm },
  coachItem: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, marginBottom: 10, overflow: 'hidden', ...Shadow.sm },
  coachStrip: { width: 4 },
  coachBody: { flex: 1, padding: Spacing.md },
  coachTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  tagChip: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  tagChipText: { fontSize: 11, fontWeight: '800' },
  coachName: { ...Type.subhead, fontSize: 13 },
  coachObs: { ...Type.caption, color: Colors.text, lineHeight: 18 },
  coachAction: { ...Type.caption, color: Colors.heading, lineHeight: 18, marginTop: 4 },
  coachActionLabel: { fontWeight: '800', color: Colors.primary },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: Spacing.lg },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { ...Type.heading, fontSize: 16, marginBottom: 4 },
  emptyText: { ...Type.caption, color: Colors.secondary, textAlign: 'center', lineHeight: 18 },

  // Detay
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  detailHead: { flexDirection: 'row', alignItems: 'center' },
  avatarLg: { width: 52, height: 52, borderRadius: Radius.lg, backgroundColor: Colors.heading, alignItems: 'center', justifyContent: 'center' },
  avatarLgText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  detailIdent: { flex: 1, marginLeft: Spacing.md, minWidth: 0 },
  detailName: { ...Type.heading, fontSize: 17 },
  detailRole: { ...Type.caption, color: Colors.secondary, marginTop: 2 },
  scoreBadgeLg: { minWidth: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center' },
  scoreBadgeLgText: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  scoreBadgeLgLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },

  convLabel: { ...Type.subhead, color: Colors.secondary },
  convValue: { ...Type.heading, fontSize: 18, color: Colors.heading },
  convDelta: { fontSize: 12, fontWeight: '800' },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  metricGridCell: { width: '31.5%', backgroundColor: Colors.card, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', ...Shadow.sm },
  metricGridValue: { ...Type.heading, fontSize: 16, color: Colors.heading },
  metricGridLabel: { ...Type.caption, fontSize: 11, color: Colors.secondary, marginTop: 3 },
  metricGridSub: { ...Type.caption, fontSize: 10, color: Colors.placeholder, marginTop: 1 },

  oppCell: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  oppValue: { ...Type.heading, fontSize: 16, color: Colors.heading },
  oppLabel: { ...Type.caption, fontSize: 11, color: Colors.secondary, marginTop: 2 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailRowLabel: { ...Type.caption, color: Colors.secondary },
  detailRowValue: { ...Type.subhead, fontSize: 14, color: Colors.heading },
});
