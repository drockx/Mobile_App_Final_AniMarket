import { Pressable, StyleSheet, Text, View } from 'react-native';

type AuthCheckboxProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

export function AuthCheckbox({ checked, label, onChange }: AuthCheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.checkedBox]}>
        {checked && <Text allowFontScaling={false} style={styles.check}>✓</Text>}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 48, paddingVertical: 8 },
  box: { width: 27, height: 27, flexShrink: 0, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  checkedBox: { backgroundColor: '#83c91d', borderColor: '#83c91d', alignItems: 'center', justifyContent: 'center' },
  check: { color: '#fff', fontSize: 19, fontWeight: '700', lineHeight: 24 },
  label: { flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.96)', fontSize: 14, lineHeight: 20 },
});
