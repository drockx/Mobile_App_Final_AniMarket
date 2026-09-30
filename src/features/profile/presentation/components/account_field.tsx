import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { accountColors } from './account_screen_layout';

export function AccountField({ label, value, onChangeText, required = false, ...props }: Pick<TextInputProps, 'autoCapitalize' | 'autoComplete' | 'keyboardType' | 'secureTextEntry' | 'returnKeyType'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor="#8a968e"
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  label: { color: accountColors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  required: { color: accountColors.red },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: accountColors.line, borderRadius: 11, backgroundColor: '#fff', color: accountColors.text, fontSize: 14 },
});
