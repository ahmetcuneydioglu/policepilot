/**
 * src/components/DocumentSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Detay modallarına/ekranlarına gömülecek "Evraklar" bölümü.
 * DocumentList + DocumentUploader'ı birlikte kullanır.
 *
 * Kullanım:
 *   <DocumentSection
 *     entity="policies"
 *     entityId={policy.id}
 *     agencyId={agencyId}
 *     uploadedBy={userId}
 *   />
 */

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '@/lib/theme';
import { fetchDocuments, EntityType } from '@/lib/storage';
import type { DocumentRecord } from '@/lib/types';
import DocumentList from './DocumentList';
import DocumentUploader from './DocumentUploader';

type Props = {
  entity: EntityType;
  entityId: string;
  agencyId: string | null;
  uploadedBy: string | null;
  /** Opsiyonel: başlık override */
  title?: string;
};

export default function DocumentSection({
  entity, entityId, agencyId, uploadedBy, title,
}: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchDocuments({ entity, entityId });
    setDocs(result);
    setLoading(false);
  }, [entity, entityId]);

  useEffect(() => { load(); }, [load]);

  function handleUploaded(doc: DocumentRecord) {
    setDocs((prev) => [doc, ...prev]);
  }

  function handleDeleted(doc: DocumentRecord) {
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  }

  const sectionTitle = title ?? 'Evraklar';

  return (
    <View style={styles.section}>
      {/* Başlık + sayı */}
      <View style={styles.header}>
        <Text style={styles.title}>{sectionTitle}</Text>
        {!loading && docs.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{docs.length}</Text>
          </View>
        )}
      </View>

      {/* Liste */}
      <View style={styles.listWrap}>
        <DocumentList
          documents={docs}
          loading={loading}
          currentUserId={uploadedBy}
          onDeleted={handleDeleted}
        />
      </View>

      {/* Yükle butonu */}
      <DocumentUploader
        entity={entity}
        entityId={entityId}
        agencyId={agencyId}
        uploadedBy={uploadedBy}
        onUploaded={handleUploaded}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  listWrap: { marginBottom: 12 },
});
