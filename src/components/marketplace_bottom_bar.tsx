import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Tab = 'home' | 'messages';

type MarketplaceBottomBarProps = {
  activeTab: Tab;
  bottomInset: number;
  onHome?: () => void;
  onMessages?: () => void;
};

const green = '#123f32';
const muted = '#879ab7';

const icons = {
  home: { ios: 'house', android: 'home', web: 'home' },
  messages: { ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  chart: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  profile: { ios: 'person.crop.circle', android: 'person_outline', web: 'person_outline' },
} as const;

function NavigationItem({
  label,
  icon,
  active = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof SymbolView>['name'];
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tab, disabled && styles.tabDisabled]}
    >
      <SymbolView name={icon} size={22} tintColor={active ? green : muted} />
      <Text numberOfLines={1} style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function MarketplaceBottomBar({
  activeTab,
  bottomInset,
  onHome,
  onMessages,
}: MarketplaceBottomBarProps) {
  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 6) }]}>
      <NavigationItem label="Home" icon={icons.home} active={activeTab === 'home'} onPress={onHome} />
      <NavigationItem label="Messages" icon={icons.messages} active={activeTab === 'messages'} onPress={onMessages} />
      <View style={styles.addSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create listing"
          accessibilityState={{ disabled: true }}
          disabled
          style={styles.addButton}
        >
          <SymbolView name={icons.add} size={26} tintColor="#fff" />
        </Pressable>
      </View>
      <NavigationItem label="Market Reference" icon={icons.chart} disabled />
      <NavigationItem label="Profile" icon={icons.profile} disabled />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4e9ef',
    paddingTop: 5,
    shadowColor: '#5d6f7d',
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabDisabled: { opacity: 0.68 },
  tabLabel: { color: muted, fontSize: 10, lineHeight: 13, textAlign: 'center' },
  tabLabelActive: { color: green, fontWeight: '700' },
  addSlot: { width: 54, minHeight: 52, alignItems: 'center' },
  addButton: {
    width: 44,
    height: 44,
    marginTop: -10,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1c2c27',
    shadowOpacity: 0.26,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
});
