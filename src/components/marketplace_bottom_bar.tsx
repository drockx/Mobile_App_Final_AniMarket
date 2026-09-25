import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Tab = 'home' | 'messages' | 'profile';

type MarketplaceBottomBarProps = {
  activeTab: Tab;
  bottomInset: number;
};

const forest = '#12372a';
const muted = '#859189';

function showComingSoon(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

const icons = {
  home: { ios: 'house', android: 'home', web: 'home' },
  messages: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  chart: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  profile: { ios: 'person', android: 'person_outline', web: 'person_outline' },
} as const;

function NavigationItem({
  label,
  icon,
  active = false,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof SymbolView>['name'];
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={styles.tab}
    >
      <SymbolView name={icon} size={19} tintColor={active ? forest : muted} />
      <Text numberOfLines={1} style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function MarketplaceBottomBar({ activeTab, bottomInset }: MarketplaceBottomBarProps) {
  return (
    <View accessibilityRole="tablist" style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 12) }]}>
      <NavigationItem label="Home" icon={icons.home} active={activeTab === 'home'} onPress={() => router.navigate('/home')} />
      <NavigationItem label="Messages" icon={icons.messages} active={activeTab === 'messages'} onPress={() => router.navigate('/messages')} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sell livestock"
        onPress={() => showComingSoon('Sell livestock', 'Listing creation is coming soon.')}
        style={styles.sellTab}
      >
        <View style={styles.sellCircle}><SymbolView name={icons.add} size={20} tintColor="#fff" /></View>
        <Text style={styles.tabLabel}>Sell</Text>
      </Pressable>
      <NavigationItem
        label="Market Reference"
        icon={icons.chart}
        onPress={() => showComingSoon('Market Reference', 'Regional prices are coming soon.')}
      />
      <NavigationItem label="Profile" icon={icons.profile} active={activeTab === 'profile'} onPress={() => router.navigate('/profile')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#dfe8e2',
    paddingTop: 8,
    paddingHorizontal: 7,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    paddingTop: 3,
  },
  tabLabel: { color: muted, fontSize: 9, lineHeight: 12, textAlign: 'center' },
  tabLabelActive: { color: forest, fontWeight: '800' },
  sellTab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
  },
  sellCircle: {
    width: 37,
    height: 37,
    marginTop: -10,
    borderRadius: 19,
    backgroundColor: forest,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#12372a',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
