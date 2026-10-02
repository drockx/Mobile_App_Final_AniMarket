import { AppTextInput as TextInput } from '@/components/app_text_input';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputProps } from 'react-native';
import { appFormStyles } from '@/constants/app_theme';

import { accountColors } from './account_screen_layout';

export function AccountField({ label, value, onChangeText, required = false, secureTextEntry = false, ...props }: Pick<TextInputProps, 'autoCapitalize' | 'autoComplete' | 'keyboardType' | 'secureTextEntry' | 'returnKeyType'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholder={label}
          placeholderTextColor={accountColors.muted}
          secureTextEntry={secureTextEntry && !visible}
          autoCapitalize={secureTextEntry ? 'none' : props.autoCapitalize}
          autoCorrect={secureTextEntry || props.keyboardType === 'email-address' ? false : undefined}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
        />
        {secureTextEntry && <Pressable accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} accessibilityState={{ selected: visible }} onPress={() => setVisible((current) => !current)} style={styles.toggle}>
          <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
        </Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { ...appFormStyles.field },
  label: { ...appFormStyles.label, color: accountColors.text },
  required: { color: accountColors.red },
  inputWrap: { minHeight: 52, borderWidth: 1, borderColor: accountColors.line, borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' },
  toggle: { flexShrink: 0, minWidth: 60, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  toggleText: { color: accountColors.forest, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center', includeFontPadding: false },
  input: { ...appFormStyles.value, flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, color: accountColors.text },
});
