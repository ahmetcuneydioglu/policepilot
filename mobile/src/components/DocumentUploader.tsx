/**
 * src/components/DocumentUploader.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Evrak yükleme bileşeni — 3 kaynak:
 *   1. Kamera ile fotoğraf çek
 *   2. Galeriden seç
 *   3. Dosya seç (PDF / diğer)
 *
 * Props:
 *   entity       — 'customers' | 'requests' | 'policies'
 *   entityId     — ilgili kaydın UUID'si
 *   agencyId     — acente UUID (nullable)
 *   uploadedBy   — oturum açmış kullanıcı UUID (nullable)
 *   onUploaded   — yükleme sonrası çağrılır
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { uploadDocument, EntityType, ACCEPTED_MIME_TYPES } from '@/lib/storage';
import type { DocumentRecord } from '@/lib/types';

// Defensive imports — native modül yoksa crash olmaz
function getImagePicker() {
  try { return require('expo-image-picker'); } catch { return null; }
}
function getDocumentPicker() {
  try { return require('expo-document-picker'); } catch { return null; }
}

type Props = {
  entity: EntityType;
  entityId: string;
  agencyId: string | null;
  uploadedBy: string | null;
  onUploaded: (doc: DocumentRecord) => void;
};

export default function DocumentUploader({
  entity, entityId, agencyId, uploadedBy, onUploaded,
}: Props) {
  const [loading, setLoading] = useState(false);

  // ── Kamera ──────────────────────────────────────────────────────────────────
  async function pickFromCamera() {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      Alert.alert('Hata', 'Kamera modülü yüklenemedi. Rebuild gerekebilir.');
      return;
    }

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera kullanmak için izin verin.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    await doUpload(
      asset.uri,
      asset.fileName ?? `photo_${Date.now()}.jpg`,
      'image/jpeg',
      asset.fileSize ?? null
    );
  }

  // ── Galeri ───────────────────────────────────────────────────────────────────
  async function pickFromGallery() {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      Alert.alert('Hata', 'Galeri modülü yüklenemedi. Rebuild gerekebilir.');
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeriye erişmek için izin verin.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const mime = asset.type === 'image' ? 'image/jpeg' : 'image/jpeg';
    await doUpload(
      asset.uri,
      asset.fileName ?? `image_${Date.now()}.jpg`,
      mime,
      asset.fileSize ?? null
    );
  }

  // ── Dosya Seç (PDF / PNG / JPG) ────────────────────────────────────────────
  async function pickDocument() {
    const DocumentPicker = getDocumentPicker();
    if (!DocumentPicker) {
      Alert.alert('Hata', 'Dosya seçici modülü yüklenemedi. Rebuild gerekebilir.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    await doUpload(
      asset.uri,
      asset.name,
      asset.mimeType ?? 'application/octet-stream',
      asset.size ?? null
    );
  }

  // ── Ortak yükleme fonksiyonu ─────────────────────────────────────────────────
  async function doUpload(uri: string, fileName: string, mimeType: string, fileSize: number | null) {
    setLoading(true);
    try {
      const result = await uploadDocument({
        uri, fileName, mimeType, fileSize,
        entity, entityId, agencyId, uploadedBy,
      });

      if (result.ok) {
        onUploaded(result.doc);
      } else {
        Alert.alert('Yükleme Başarısız', result.error);
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }

  // ── iOS Action Sheet / Android menü ─────────────────────────────────────────
  function showPicker() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', '📷 Kamera ile Çek', '🖼️ Galeriden Seç', '📎 Dosya Seç (PDF/Belge)'],
          cancelButtonIndex: 0,
          title: 'Evrak Ekle',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickFromCamera();
          if (buttonIndex === 2) pickFromGallery();
          if (buttonIndex === 3) pickDocument();
        }
      );
    } else {
      // Android — Alert tabanlı menü
      Alert.alert('Evrak Ekle', 'Kaynak seçin:', [
        { text: '📷 Kamera', onPress: pickFromCamera },
        { text: '🖼️ Galeri', onPress: pickFromGallery },
        { text: '📎 Dosya Seç', onPress: pickDocument },
        { text: 'İptal', style: 'cancel' },
      ]);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.btn} onPress={showPicker} activeOpacity={0.75}>
      <Text style={styles.btnIcon}>＋</Text>
      <Text style={styles.btnText}>Evrak Ekle</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
  },
  btnIcon: { fontSize: 18, color: Colors.primary, marginRight: 8, fontWeight: '300' },
  btnText: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: Spacing.md,
  },
  loadingText: { marginLeft: 10, fontSize: 14, color: Colors.secondary },
});
