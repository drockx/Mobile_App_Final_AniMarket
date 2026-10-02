import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { parseDate } from '../domain/checkout';
import { checkoutColors as color, checkoutIcons as icons } from './checkout_controls';

export const money = (value: number) => `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
export const amountRange = (min: number, max: number) => min === max ? money(min) : `${money(min)}–${money(max)}`;
export const readableDate = (value: string) => parseDate(value)?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) ?? value;

export function OrderNotice({ children }: { children: string }) {
  return <View style={styles.notice}><Text style={styles.noticeText}>{children}</Text></View>;
}

export function OrderSteps({ current }: { current: 0 | 1 | 2 }) {
  const { fontScale } = useWindowDimensions();
  const diameter = Math.max(28, Math.ceil(18 * fontScale + 10));
  return <View accessible accessibilityLabel={`Checkout step ${current + 1}, ${['Details', 'Review', 'Placed'][current]} of 3`} style={styles.steps}>
    {['Details', 'Review', 'Placed'].map((label, index) => <View key={label} style={styles.stepSegment}>
      <View style={styles.stepMarker}>
        <View style={[styles.stepLine, index <= current && styles.stepLineDone, index === 0 && styles.stepLineHidden]} />
        <View style={[styles.stepNumber, { width: diameter, height: diameter }, index <= current && styles.stepActive]}>
          {index < current ? <SymbolView name={icons.check} size={16} tintColor="#fff" /> : <Text style={[styles.stepNumberText, index === current && styles.stepActiveText]}>{index + 1}</Text>}
        </View>
        <View style={[styles.stepLine, index < current && styles.stepLineDone, index === 2 && styles.stepLineHidden]} />
      </View>
      <Text style={[styles.stepLabel, index <= current && styles.stepActiveLabel]}>{label}</Text>
    </View>)}
  </View>;
}

export function OrderSummaryRow({ label, value, total = false, detail = false }: { label: string; value: string; total?: boolean; detail?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.15 || (detail && value.length > 36);
  return <View style={[styles.summaryRow, detail && styles.detailRow, total && styles.totalRow, stacked && styles.summaryStacked]}>
    <Text style={[styles.summaryLabel, total && styles.totalLabel, stacked && styles.summaryStackedLabel]}>{label}</Text>
    <Text style={[styles.summaryValue, total && styles.totalValue, stacked && styles.summaryStackedValue]}>{value}</Text>
  </View>;
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', marginBottom: 20 },
  stepSegment: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  stepMarker: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#dde6e0' },
  stepLineDone: { backgroundColor: color.green },
  stepLineHidden: { backgroundColor: 'transparent' },
  stepNumber: { flexShrink: 0, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dde6e0' },
  stepNumberText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: color.muted },
  stepLabel: { alignSelf: 'stretch', paddingHorizontal: 4, textAlign: 'center', color: color.muted, fontSize: 13, lineHeight: 18 },
  stepActive: { backgroundColor: color.green },
  stepActiveText: { color: '#fff' },
  stepActiveLabel: { color: color.green, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginVertical: 9 },
  detailRow: { marginVertical: 0, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#edf2ee' },
  summaryLabel: { flex: 1, minWidth: 0, color: color.muted, fontSize: 14, lineHeight: 20 },
  summaryValue: { color: color.text, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  summaryStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
  summaryStackedLabel: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  summaryStackedValue: { textAlign: 'left', flexShrink: 0 },
  totalRow: { borderTopWidth: 1, borderTopColor: color.line, paddingTop: 12 },
  totalLabel: { color: color.text, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  totalValue: { color: color.green, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  notice: { borderWidth: 1, borderColor: color.warnLine, backgroundColor: color.warn, borderRadius: 12, padding: 12, marginTop: 12 },
  noticeText: { color: '#684500', fontSize: 14, lineHeight: 20 },
});
