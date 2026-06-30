import { useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadow } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';
import { FEATURES } from '@/lib/features';
import BulkPolicyImportMobile from '@/components/BulkPolicyImportMobile';

function TabBarIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
  );
}

// Ortada yükseltilmiş aksiyon butonu (v1.0: Tara/OCR · quoteCenter açıksa Teklif)
function CenterTabButton({ onPress, accessibilityState, label, icon }: { onPress?: (e?: any) => void; accessibilityState?: { selected?: boolean }; label: string; icon: string }) {
  const focused = accessibilityState?.selected;
  return (
    <View style={styles.teklifSlot} pointerEvents="box-none">
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.teklifTouch} accessibilityRole="button" accessibilityLabel={label}>
        <LinearGradient colors={[Colors.primary, '#1E3A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.teklifCircle}>
          <Text style={styles.teklifIcon}>{icon}</Text>
        </LinearGradient>
        <Text style={[styles.teklifLabel, focused && { color: Colors.primary }]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabsLayout() {
  const { agencyId } = useProfile();
  const [scanOpen, setScanOpen] = useState(false);
  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.secondary,
        tabBarHideOnKeyboard: true,
        // Yüzen buzlu cam tab bar — içerik altından geçer (ekranlarda alt boşluk var)
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          paddingBottom: Platform.OS === 'ios' ? 0 : 8,
          height: Platform.OS === 'ios' ? 82 : 64,
        },
        tabBarBackground: () => (
          <BlurView tint="light" intensity={95} style={[StyleSheet.absoluteFill, styles.tabBlur]} />
        ),
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Ana Sayfa', tabBarIcon: ({ focused }) => <TabBarIcon emoji="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="renewals"
        options={{ title: 'Yenilemeler', tabBarIcon: ({ focused }) => <TabBarIcon emoji="🔄" focused={focused} /> }}
      />
      <Tabs.Screen
        name="teklif"
        options={{
          title: FEATURES.quoteCenter ? 'Teklif' : 'Tara',
          tabBarButton: (props) => (
            <CenterTabButton
              {...props}
              label={FEATURES.quoteCenter ? 'Teklif' : 'Tara'}
              icon={FEATURES.quoteCenter ? '⚡' : '📷'}
              onPress={FEATURES.quoteCenter ? props.onPress : () => setScanOpen(true)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: 'Müşteriler', tabBarIcon: ({ focused }) => <TabBarIcon emoji="👥" focused={focused} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'Daha', tabBarIcon: ({ focused }) => <TabBarIcon emoji="☰" focused={focused} /> }}
      />

      {/* Tab bar'da gizli ama "Daha" / merkez butondan erişilebilir rotalar */}
      <Tabs.Screen name="requests" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="policies" options={{ href: null }} />
      <Tabs.Screen name="muayene" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
    </Tabs>
    {!FEATURES.quoteCenter && scanOpen && agencyId && (
      <BulkPolicyImportMobile
        agencyId={agencyId}
        onClose={() => setScanOpen(false)}
        onDone={() => {}}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  tabBlur: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  teklifSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  teklifTouch: { alignItems: 'center', transform: [{ translateY: -18 }] },
  teklifCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff', ...Shadow.md },
  teklifIcon: { fontSize: 24, color: '#fff' },
  teklifLabel: { fontSize: 10, fontWeight: '700', color: Colors.secondary, marginTop: 4 },
});
