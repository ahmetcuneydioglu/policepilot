/**
 * src/components/DocumentUploader.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Evrak yükleme bileşeni — 3 kaynak:
 *   1. Kamera ile fotoğraf çek
 *   2. Galeriden seç
 *   3. Dosya seç (PDF / diğer)
 *
 * Düzeltilen hatalar:
 *  - iOS -54 "process may not map database": ActionSheetIOS kapandıktan sonra
 *    picker açmadan önce 350ms bekleme eklendi (iOS dismiss animasyonu).
 *  - Kamera/galeri izni reddedilince Ayarlar'a yönlendirme eklendi.
 *  - Dosya okuma fetch() → expo-file-system (storage.ts'de).
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, ActionSheetIOS, Platform, Linking,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { uploadDocument, EntityType, ACCEPTED_MIME_TYPES } from '@/lib/storage';
import type { DocumentRecord } from '@/lib/types';

// ─── Defensive imports ────────────────────────────────────────────────────────
function getImagePicker() {
  try { return require('expo-image-picker'); } catch { return null; }
}
function getDocumentPicker() {
  try { return require('expo-document-picker'); } catch { return null; }
}

// ─── iOS'ta action sheet kapandıktan sonra gecikme ────────────────────────────
// ActionSheetIOS dismiss animasyonu ~300ms sürer.
// Bu süre dolmadan UIDocumentPickerViewController veya kamera açılırsa
// iOS "process may not map database" (-54) hatası fırlatır.
function delayedOpen(fn: () => void, ms = 380) {
  setTimeout(fn, ms);
}

// ─── İzin reddedilince Ayarlar'a yönlendirme ─────────────────────────────────
function openSettings(title: string, desc: string) {
  Alert.alert(title, desc, [
    { text: 'İptal', style: 'cancel' },
    {
      text: 'Ayarları Aç',
      onPress: () => Linking.openSettings(),
    },
  ]);
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
      Alert.alert('Modül Eksik', 'Kamera modülü yüklenemedi.\nnpx expo run:ios --device ile rebuild yapın.');
      return;
    }

    // Mevcut izin durumunu önce kontrol et
    const { status: existing } = await ImagePicker.getCameraPermissionsAsync();

    if (existing === 'denied') {
      // Daha önce reddedilmiş — sistem diyaloğu göstermez, direkt Ayarlar'a yönlendir
      openSettings(
        'Kamera İzni Gerekli',
        'PolicePilot\'un kamerayı kullanabilmesi için Ayarlar > PolicePilot > Kamera iznini açın.'
      );
      return;
    }

    if (existing !== 'granted') {
      // İlk kez soruluyor
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        // Kullanıcı reddetti
        Alert.alert(
          'Kamera İzni Verilmedi',
          'Evrak fotoğrafı çekmek için kamera iznine ihtiyaç var.',
          [{ text: 'Tamam' }]
        );
        return;
      }
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
      Alert.alert('Modül Eksik', 'Galeri modülü yüklenemedi.\nnpx expo run:ios --device ile rebuild yapın.');
      return;
    }

    const { status: existing } = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (existing === 'denied') {
      openSettings(
        'Fotoğraf İzni Gerekli',
        'PolicePilot\'un galeriye erişebilmesi için Ayarlar > PolicePilot > Fotoğraflar iznini açın.'
      );
      return;
    }

    if (existing !== 'granted') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Verilmedi', 'Galeriye erişmek için fotoğraf izni gerekli.', [{ text: 'Tamam' }]);
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    // mimeType tespiti — HEIC/HEIF için de doğru type kullan
    let mime = 'image/jpeg';
    if (asset.fileName) {
      const ext = asset.fileName.split('.').pop()?.toLowerCase();
      if (ext === 'png')              mime = 'image/png';
      else if (ext === 'heic')        mime = 'image/heic';
      else if (ext === 'heif')        mime = 'image/heif';
      else if (ext === 'webp')        mime = 'image/webp';
    }

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
      Alert.alert('Modül Eksik', 'Dosya seçici modülü yüklenemedi.\nnpx expo run:ios --device ile rebuild yapın.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_MIME_TYPES,
      copyToCacheDirectory: true,   // Kritik: önbelleğe kopyalar → FileSystem erişimi güvenli
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
  async function doUpload(
    uri: string,
    fileName: string,
    mimeType: string,
    fileSize: number | null
  ) {
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
      Alert.alert('Hata', err?.message ?? 'Bilinmeyen hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  // ── iOS Action Sheet ─────────────────────────────────────────────────────────
  // delayedOpen ile action sheet'in kapanma animasyonu tamamlandıktan sonra
  // picker açılır → iOS -54 hatasını önler
  function showPicker() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', '📷 Kamera ile Çek', '🖼️ Galeriden Seç', '📎 Dosya Seç (PDF/Belge)'],
          cancelButtonIndex: 0,
          title: 'Evrak Ekle',
          message: 'PDF, JPG veya PNG desteklenir',
        },
        (buttonIndex) => {
          // ⚠️ Kritik: dismiss animasyonu (350ms) bekle
          if (buttonIndex === 1) delayedOpen(pickFromCamera);
          if (buttonIndex === 2) delayedOpen(pickFromGallery);
          if (buttonIndex === 3) delayedOpen(pickDocument);
        }
      );
    } else {
      // Android — Alert tabanlı menü (animasyon sorunu yok)
      Alert.alert('Evrak Ekle', 'Kaynak seçin:', [
        { text: '📷 Kamera', onPress: pickFromCamera },
        { text: '🖼️ Galeri',  onPress: pickFromGallery },
        { text: '📎 Dosya Seç', onPress: pickDocument },
        { text: 'İptal', style: 'cancel' },
      ]);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────────
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
