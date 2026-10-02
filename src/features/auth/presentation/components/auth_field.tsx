import { AppTextInput as TextInput } from '@/components/app_text_input';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextInputProps } from 'react-native';
import { appFormStyles } from '@/constants/app_theme';

type AuthFieldProps = Pick<
  TextInputProps,
  'autoCapitalize' | 'autoComplete' | 'keyboardType' | 'maxLength' | 'returnKeyType' | 'onSubmitEditing' | 'editable'
> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  compact?: boolean;
  error?: string;
};

export function AuthField({
  label,
  value,
  onChangeText,
  secure = false,
  compact = false,
  editable = true,
  error,
  ...inputProps
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
      <View style={[styles.inputWrap, compact && styles.compactWrap, error && styles.inputError]}>
        <TextInput
          {...inputProps}
          editable={editable}
          autoCapitalize={secure ? 'none' : inputProps.autoCapitalize}
          autoCorrect={secure || inputProps.keyboardType === 'email-address' ? false : undefined}
          accessibilityLabel={label}
          placeholder={label}
          placeholderTextColor="rgba(255,255,255,0.72)"
          selectionColor={Platform.OS === 'android' ? '#477f60' : '#fff'}
          keyboardAppearance="dark"
          secureTextEntry={secure && !visible}
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.input,
            compact && styles.compactInput,
          ]}
        />
        {secure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            accessibilityState={{ disabled: !editable, selected: visible }}
            disabled={!editable}
            hitSlop={6}
            onPress={() => setVisible((current) => !current)}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 0 },
  label: { ...appFormStyles.label, color: '#fff', marginBottom: 8 },
  compactLabel: { marginBottom: 8 },
  inputWrap: { minHeight: 60, borderRadius: 17, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.78)', backgroundColor: 'rgba(0,0,0,0.24)', flexDirection: 'row', alignItems: 'center' },
  compactWrap: { minHeight: 52, borderRadius: 15 },
  input: {
    ...appFormStyles.value,
    flex: 1,
    minWidth: 0,
    minHeight: 57,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    backgroundColor: 'transparent',
  },
  compactInput: { minHeight: 49 },
  inputError: { borderColor: '#ffb4a8' },
  toggle: {
    flexShrink: 0,
    minWidth: 60,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center', includeFontPadding: false },
  errorText: { color: '#ffd2ca', fontSize: 14, lineHeight: 20, marginTop: 5, paddingHorizontal: 2 },
});
