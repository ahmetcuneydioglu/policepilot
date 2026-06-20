// plugins/withoutPushEntitlement.js
// ─────────────────────────────────────────────────────────────────────────────
// expo-notifications config plugin'i (node_modules'ta kurulu olduğu için Expo
// tarafından OTOMATİK autolink edilir) iOS'a "aps-environment" (remote push)
// entitlement'ı ekler. com.canahmettt.policepilot bundle id'si Apple Developer'da
// Push capability ile kayıtlı olmadığından, bu entitlement gerçek cihaz
// imzalamasını bozuyor (xcodebuild error 65).
//
// Bu plugin entitlement zincirinde EN SON çalışacak şekilde (app.json plugins
// dizisinin son elemanı) eklenir ve aps-environment'ı siler. Local bildirimler
// bu entitlement'ı gerektirmediği için etkilenmez.
//
// İleride remote push gerçekten gerekirse: Apple Developer'da App ID + Push
// capability oluştur, sonra bu plugin'i app.json'dan kaldır.

const { withEntitlementsPlist } = require('expo/config-plugins');

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withoutPushEntitlement = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    if (cfg.modResults && 'aps-environment' in cfg.modResults) {
      delete cfg.modResults['aps-environment'];
    }
    return cfg;
  });

module.exports = withoutPushEntitlement;
