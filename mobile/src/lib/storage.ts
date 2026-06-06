/**
 * src/lib/storage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase Storage + documents tablosu işlemleri.
 *
 * KURALLAR:
 *  - Sadece anon key — service role asla kullanılmaz
 *  - RLS her zaman aktif (documents tablosu + Storage bucket)
 *  - Bucket adı: "documents"
 *  - Dosya yolu: {agency_id}/{entity}/{entity_id}/{timestamp}_{filename}
 */

import { supabase } from './supabase';
import { DocumentRecord } from './types';

// ─── Sabitler ─────────────────────────────────────────────────────────────────
export const BUCKET = 'documents';

export type EntityType = 'customers' | 'requests' | 'policies';

// Desteklenen MIME tipler
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
];

// ─── Dosya yolu oluştur ────────────────────────────────────────────────────────
export function buildStoragePath(
  agencyId: string | null,
  entity: EntityType,
  entityId: string,
  fileName: string
): string {
  const ts = Date.now();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const prefix = agencyId ? `agency_${agencyId}` : 'shared';
  return `${prefix}/${entity}/${entityId}/${ts}_${safe}`;
}

// ─── Dosya yükle ──────────────────────────────────────────────────────────────
export type UploadDocumentParams = {
  /** Yüklenecek dosyanın URI'si (file:// veya content://) */
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
  entity: EntityType;
  entityId: string;
  agencyId: string | null;
  uploadedBy: string | null;
};

export type UploadResult =
  | { ok: true; doc: DocumentRecord }
  | { ok: false; error: string };

export async function uploadDocument(params: UploadDocumentParams): Promise<UploadResult> {
  const {
    uri, fileName, mimeType, fileSize,
    entity, entityId, agencyId, uploadedBy,
  } = params;

  // 1. ArrayBuffer olarak oku
  let arrayBuffer: ArrayBuffer;
  try {
    const response = await fetch(uri);
    arrayBuffer = await response.arrayBuffer();
  } catch (err: any) {
    return { ok: false, error: `Dosya okunamadı: ${err?.message ?? err}` };
  }

  // 2. Storage path oluştur
  const path = buildStoragePath(agencyId, entity, entityId, fileName);

  // 3. Supabase Storage'a yükle
  const { error: storageError } = await (supabase.storage as any)
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (storageError) {
    return { ok: false, error: `Yükleme hatası: ${storageError.message}` };
  }

  // 4. documents tablosuna kayıt ekle
  const payload: Omit<DocumentRecord, 'id' | 'created_at'> = {
    agency_id: agencyId,
    customer_id:  entity === 'customers' ? entityId : null,
    request_id:   entity === 'requests'  ? entityId : null,
    policy_id:    entity === 'policies'  ? entityId : null,
    file_name: fileName,
    file_path: path,
    file_type: mimeType,
    file_size: fileSize ?? null,
    bucket: BUCKET,
    uploaded_by: uploadedBy,
  };

  const { data, error: dbError } = await (supabase.from('documents') as any)
    .insert(payload)
    .select()
    .single();

  if (dbError) {
    // DB kaydı başarısız — Storage'dan da sil (orphan önle)
    await (supabase.storage as any).from(BUCKET).remove([path]);
    return { ok: false, error: `Kayıt hatası: ${dbError.message}` };
  }

  return { ok: true, doc: data as DocumentRecord };
}

// ─── Signed URL al (görüntüleme/indirme) ──────────────────────────────────────
export async function getSignedUrl(
  filePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await (supabase.storage as any)
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl as string;
}

// ─── Evrakları listele ────────────────────────────────────────────────────────
export async function fetchDocuments(params: {
  entity: EntityType;
  entityId: string;
}): Promise<DocumentRecord[]> {
  const col =
    params.entity === 'customers' ? 'customer_id' :
    params.entity === 'requests'  ? 'request_id' :
    'policy_id';

  const { data, error } = await (supabase.from('documents') as any)
    .select('*')
    .eq(col, params.entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Storage] fetchDocuments error:', error.message);
    return [];
  }
  return (data ?? []) as DocumentRecord[];
}

// ─── Evrak sil ────────────────────────────────────────────────────────────────
export async function deleteDocument(doc: DocumentRecord): Promise<{ ok: boolean; error?: string }> {
  // 1. Storage'dan sil
  const { error: storageErr } = await (supabase.storage as any)
    .from(BUCKET)
    .remove([doc.file_path]);

  if (storageErr) {
    console.warn('[Storage] delete storage error:', storageErr.message);
    // Devam et — DB kaydını yine de silmeye çalış
  }

  // 2. DB kaydını sil
  const { error: dbErr } = await (supabase.from('documents') as any)
    .delete()
    .eq('id', doc.id);

  if (dbErr) return { ok: false, error: dbErr.message };
  return { ok: true };
}

// ─── MIME → ikon + renk ──────────────────────────────────────────────────────
export function fileIcon(mimeType: string): { icon: string; color: string } {
  if (mimeType === 'application/pdf') return { icon: '📄', color: '#DC2626' };
  if (mimeType.startsWith('image/'))  return { icon: '🖼️',  color: '#2563EB' };
  return { icon: '📎', color: '#6B7280' };
}

// ─── Dosya boyutunu okunabilir yap ────────────────────────────────────────────
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
