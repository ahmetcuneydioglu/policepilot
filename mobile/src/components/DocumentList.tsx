/**
 * src/components/DocumentList.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Evrak listesi bileşeni.
 * Signed URL ile dosya açma + expo-sharing ile paylaşma + silme destekler.
 *
 * Props:
 *   documents    — DocumentRecord[]
 *   loading      — fetch devam ediyor mu
 *   currentUserId — silme yetkisi için
 *   onDeleted    — bir evrak silindikten sonra çağrılır
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Image,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { getSignedUrl, deleteDocument, fileIcon, formatFileSize } from '@/lib/storage';
import type { DocumentRecord } from '@/lib/types';

// Defensive imports
function getWebBrowser() { try { return require('expo-web-browser'); } catch { return null; } }
function getSharing()    { try { return require('expo-sharing');     } catch { return null; } }
function getFileSystem() { try { return require('expo-file-system'); } catch { return null; } }

type Props = {
  documents: DocumentRecord[];
  loading: boolean;
  currentUserId: string | null;
  onDeleted: (doc: DocumentRecord) => void;
};

// ─── Tek satır ─────────────────────────────────────────────────────────────────
function DocRow({
  doc,
  currentUserId,
  onDeleted,
}: {
  doc: DocumentRecord;
  currentUserId: string | null;
  onDeleted: (d: DocumentRecord) => void;
}) {
  const [opening, setOpening] = useState(false);
  const { icon, color } = fileIcon(doc.file_type);

  const isImage = doc.file_type.startsWith('image/');
  const isPdf   = doc.file_type === 'application/pdf';

  const dateStr = new Date(doc.created_at).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const sizeStr = doc.file_size ? formatFileSize(doc.file_size) : '';

  async function openFile() {
    setOpening(true);
    try {
      const signedUrl = await getSignedUrl(doc.file_path);
      if (!signedUrl) {
        Alert.alert('Hata', 'Dosya bağlantısı alınamadı.');
        return;
      }

      if (isImage) {
        // Görüntüyü expo-web-browser'da aç
        const Browser = getWebBrowser();
        if (Browser) {
          await Browser.openBrowserAsync(signedUrl);
        } else {
          Alert.alert('Hata', 'Tarayıcı modülü yüklenemedi.');
        }
      } else if (isPdf) {
        // PDF: önce cihaza indir, sonra paylaş/aç
        await downloadAndOpen(signedUrl, doc.file_name);
      } else {
        const Browser = getWebBrowser();
        if (Browser) await Browser.openBrowserAsync(signedUrl);
      }
    } finally {
      setOpening(false);
    }
  }

  async function downloadAndOpen(url: string, name: string) {
    const FileSystem = getFileSystem();
    if (!FileSystem) {
      Alert.alert('Hata', 'Dosya sistemi modülü yüklenemedi.');
      return;
    }

    try {
      // Legacy API — expo-file-system v55'te her ikisi de çalışır
      const localUri = FileSystem.cacheDirectory + name;
      const { uri: downloadedUri } = await FileSystem.downloadAsync(url, localUri);

      // Paylaşma ile aç (iOS: Files/Preview, Android: ilgili uygulama)
      const Sharing = getSharing();
      if (Sharing) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadedUri, {
            mimeType: 'application/pdf',
            dialogTitle: name,
            UTI: 'com.adobe.pdf',
          });
          return;
        }
      }
      // Sharing yoksa web browser'da signed URL'i aç
      const Browser = getWebBrowser();
      if (Browser) await Browser.openBrowserAsync(url);
    } catch (err: any) {
      Alert.alert('Hata', `Dosya açılamadı: ${err?.message ?? err}`);
    }
  }

  async function handleShare() {
    const signedUrl = await getSignedUrl(doc.file_path);
    if (!signedUrl) { Alert.alert('Hata', 'Bağlantı alınamadı.'); return; }

    const FileSystem = getFileSystem();
    const Sharing = getSharing();
    if (!FileSystem || !Sharing) {
      Alert.alert('Hata', 'Paylaşma modülü yüklenemedi.');
      return;
    }

    try {
      const localUri = FileSystem.cacheDirectory + doc.file_name;
      await FileSystem.downloadAsync(signedUrl, localUri);
      await Sharing.shareAsync(localUri, {
        mimeType: doc.file_type,
        dialogTitle: doc.file_name,
      });
    } catch (err: any) {
      Alert.alert('Paylaşma Hatası', err?.message ?? 'Bilinmeyen hata');
    }
  }

  function handleDelete() {
    Alert.alert(
      'Evrakı Sil',
      `"${doc.file_name}" silinecek. Bu işlem geri alınamaz.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            const res = await deleteDocument(doc);
            if (res.ok) {
              onDeleted(doc);
            } else {
              Alert.alert('Hata', res.error ?? 'Silinemedi');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.row}>
      {/* İkon */}
      <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>

      {/* Bilgi */}
      <TouchableOpacity style={styles.info} onPress={openFile} activeOpacity={0.7}>
        <Text style={styles.fileName} numberOfLines={1}>{doc.file_name}</Text>
        <Text style={styles.meta}>
          {dateStr}{sizeStr ? `  •  ${sizeStr}` : ''}
        </Text>
      </TouchableOpacity>

      {/* Aksiyonlar */}
      <View style={styles.actions}>
        {opening ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
        ) : (
          <TouchableOpacity onPress={openFile} style={styles.actionBtn}>
            <Text style={styles.actionIcon}>👁️</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
          <Text style={styles.actionIcon}>⬆️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
          <Text style={styles.actionIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Ana bileşen ───────────────────────────────────────────────────────────────
export default function DocumentList({ documents, loading, currentUserId, onDeleted }: Props) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.centerText}>Evraklar yükleniyor...</Text>
      </View>
    );
  }

  if (documents.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📂</Text>
        <Text style={styles.emptyText}>Henüz evrak eklenmemiş</Text>
      </View>
    );
  }

  return (
    <View>
      {documents.map((doc) => (
        <DocRow
          key={doc.id}
          doc={doc}
          currentUserId={currentUserId}
          onDeleted={onDeleted}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  iconText: { fontSize: 20 },
  info: { flex: 1, marginRight: 8 },
  fileName: { fontSize: 13, fontWeight: '600', color: Colors.heading, marginBottom: 3 },
  meta: { fontSize: 11, color: Colors.secondary },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 6 },
  actionIcon: { fontSize: 15 },
  center: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  centerText: { marginLeft: 10, color: Colors.secondary, fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 20 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 13, color: Colors.secondary },
});
