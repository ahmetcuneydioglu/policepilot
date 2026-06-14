"use client";

/**
 * Ekip / Kullanıcı Yönetimi — tam sayfa.
 * Asıl mantık paylaşılan TeamManagement bileşeninde; aynı bileşen Ayarlar
 * sayfasına da gömülüdür (acente sahibinin yönetim merkezi).
 */

import TeamManagement from "@/components/TeamManagement";

export default function TeamPage() {
  return (
    <div className="max-w-4xl">
      <TeamManagement />
    </div>
  );
}
