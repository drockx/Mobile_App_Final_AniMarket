import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appColors, appTypography } from '@/constants/app_theme';
import { VerificationReviewScreen } from '@/features/profile/presentation/verification_review_screen';
import { MarketPriceEditorScreen } from './market_price_editor_screen';

export function AdminPortalScreen({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<'reviews' | 'prices'>('reviews');
  const navigation = <View style={styles.tabs}>
    {([{ value: 'reviews', label: 'ID Reviews' }, { value: 'prices', label: 'Market Prices' }] as const).map((item) =>
      <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: tab === item.value }} onPress={() => setTab(item.value)} style={[styles.tab, tab === item.value && styles.selected]}>
        <Text style={[styles.label, tab === item.value && styles.selectedLabel]}>{item.label}</Text>
      </Pressable>)}
  </View>;
  return tab === 'reviews'
    ? <VerificationReviewScreen title="Admin Portal" onSignOut={onSignOut} navigation={navigation} />
    : <MarketPriceEditorScreen onSignOut={onSignOut} navigation={navigation} />;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { flex: 1, minWidth: 120, minHeight: 48, padding: 12, borderWidth: 1, borderColor: appColors.forest, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: appColors.forest },
  label: { ...appTypography.button, color: appColors.forest, textAlign: 'center' },
  selectedLabel: { color: '#fff' },
});
