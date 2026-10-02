import { AppTextInput as TextInput } from '@/components/app_text_input';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputProps } from 'react-native';

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
          style={[styles.input, secureTextEntry && styles.secureInput]}
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
  field: { gap: 7 },
  label: { color: accountColors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  required: { color: accountColors.red },
  inputWrap: { position: 'relative' },
  secureInput: { paddingRight: 72 },
  toggle: { position: 'absolute', right: 4, top: 0, bottom: 0, minWidth: 60, minHeight: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  toggleText: { color: accountColors.forest, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  input: { minHeight: 50, paddingHorizontal: 13, borderWidth: 1, borderColor: accountColors.line, borderRadius: 11, backgroundColor: '#fff', color: accountColors.text, fontSize: 16, lineHeight: 22 },
});
