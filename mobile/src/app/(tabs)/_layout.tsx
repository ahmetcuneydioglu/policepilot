import { Tabs } from 'expo-router';
import { Text, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/lib/theme';
import { useNotificationStore } from '@/lib/NotificationContext';

function TabBarIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  const { unreadCount } = useNotificationStore();

  return (
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
          <BlurView tint="light" intensity={80} style={[StyleSheet.absoluteFill, styles.tabBlur]} />
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="renewals"
        options={{
          title: 'Yenilemeler',
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="🔄" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Müşteriler',
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Teklifler',
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="📋" focused={focused} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.danger,
            color: '#fff',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="✨" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Daha',
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="☰" focused={focused} />,
        }}
      />

      {/* Tab bar'da gizli ama "Daha" üzerinden erişilebilir rotalar */}
      <Tabs.Screen name="policies" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBlur: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
});
