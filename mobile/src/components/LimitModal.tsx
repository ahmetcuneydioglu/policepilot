/**
 * src/components/LimitModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Limit dolduğunda veya acente pasifse gösterilen şık uyarı modal'ı.
 * Sade Alert yerine görsel olarak zengin bir bildirim sağlar.
 *
 * Kullanım:
 *   <LimitModal
 *     visible={showLimit}
 *     entity="customers"
 *     current={5}
 *     max={5}
 *     reason="limit_exceeded"
 *     onClose={() => setShowLimit(false)}
 *   />
 */

import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';
import type { LimitEntity } from '@/lib/limits';

const W = Dimensions.get('window').width;

type Reason = 'inactive' | 'limit_exceeded' | 'agency_not_found' | 'no_agency' | undefined;

type Props = {
  visible: boolean;
  entity: LimitEntity;
  current?: number;
  max?: number;
  reason?: Reason;
  onClose: () => void;
};

const ENTITY_META: Record<LimitEntity, { label: string; icon: string; plural: string }> = {
  customers: { label: 'Müşteri',       icon: '👥', plural: 'müşteri'       },
  requests:  { label: 'Teklif Talebi', icon: '📋', plural: 'teklif talebi' },
  policies:  { label: 'Poliçe',        icon: '📄', plural: 'poliçe'        },
  users:     { label: 'Kullanıcı',     icon: '👤', plural: 'kullanıcı'     },
};

export default function LimitModal({ visible, entity, current, max, reason, onClose }: Props) {
  const meta = ENTITY_META[entity] ?? ENTITY_META.customers;

  const isInactive    = reason === 'inactive';
  const isNoAgency    = reason === 'no_agency' || reason === 'agency_not_found';
  const isLimitExceed = reason === 'limit_exceeded' || (!isInactive && !isNoAgency);

  // İlerleme yüzdesi
  const pct = (max && max > 0 && current != null) ? Math.min(current / max, 1) : 1;
  const barW = Math.round((W - 96) * pct);
  const totalW = W - 96;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Arka plan overlay */}
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Kart */}
        <View style={s.card}>

          {/* İkon alanı */}
          <View style={[s.iconWrap, isInactive ? s.iconWrapOrange : s.iconWrapRed]}>
            <Text style={s.iconEmoji}>{isInactive ? '⏸️' : isNoAgency ? '🔗' : '🚫'}</Text>
          </View>

          {/* Başlık */}
          <Text style={s.title}>
            {isInactive
              ? 'Acente Pasif'
              : isNoAgency
              ? 'Acente Bağlantısı Yok'
              : `${meta.label} Limiti Doldu`}
          </Text>

          {/* Açıklama */}
          <Text style={s.desc}>
            {isInactive
              ? 'Acenteniz şu anda pasif durumda. İşlem yapabilmek için yöneticinizle iletişime geçin.'
              : isNoAgency
              ? 'Hesabınız bir acenteye bağlı değil. Lütfen yöneticinizle iletişime geçin.'
              : `Acentenizin ${meta.plural} limiti doldu. Yeni ${meta.plural} eklemek için planınızı yükseltmeniz gerekiyor.`}
          </Text>

          {/* Kullanım göstergesi — sadece limit_exceeded için */}
          {isLimitExceed && max != null && current != null && (
            <View style={s.usageBox}>
              {/* Sayısal gösterge */}
              <View style={s.usageHeader}>
                <View style={s.usageLabelRow}>
                  <Text style={s.usageIcon}>{meta.icon}</Text>
                  <Text style={s.usageLabel}>{meta.label}</Text>
                </View>
                <Text style={s.usageCount}>
                  <Text style={s.usageCurrent}>{current}</Text>
                  <Text style={s.usageSep}> / </Text>
                  <Text style={s.usageMax}>{max}</Text>
                </Text>
              </View>

              {/* Progress bar */}
              <View style={[s.barTrack, { width: totalW }]}>
                <View style={[s.barFill, { width: barW }]} />
              </View>

              <Text style={s.usageNote}>Limit: {max} {meta.plural}</Text>
            </View>
          )}

          {/* Kapat butonu */}
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.closeBtnText}>Anladım</Text>
          </TouchableOpacity>

          {/* İpucu */}
          {isLimitExceed && (
            <Text style={s.hint}>
              Limit artırmak için yöneticinizle veya destek ekibiyle iletişime geçin.
            </Text>
          )}

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },

  // İkon
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconWrapRed: { backgroundColor: '#FEE2E2' },
  iconWrapOrange: { backgroundColor: '#FEF3C7' },
  iconEmoji: { fontSize: 34 },

  // Metinler
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.heading,
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  // Kullanım kutusu
  usageBox: {
    backgroundColor: '#FFF1F2',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FECDD3',
    padding: 14,
    width: '100%',
    marginBottom: 20,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  usageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usageIcon: { fontSize: 16, marginRight: 6 },
  usageLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.heading,
  },
  usageCount: {
    fontSize: 15,
    fontWeight: '700',
  },
  usageCurrent: {
    color: '#DC2626',
    fontSize: 18,
    fontWeight: '800',
  },
  usageSep: { color: Colors.secondary },
  usageMax: { color: Colors.secondary },
  barTrack: {
    height: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    height: 8,
    backgroundColor: '#DC2626',
    borderRadius: 4,
  },
  usageNote: {
    fontSize: 11,
    color: '#991B1B',
    textAlign: 'right',
  },

  // Buton
  closeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  hint: {
    fontSize: 11,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
