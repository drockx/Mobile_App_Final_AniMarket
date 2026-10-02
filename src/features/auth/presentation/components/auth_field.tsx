import { AppTextInput as TextInput } from '@/components/app_text_input';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextInputProps } from 'react-native';

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
      <View style={styles.inputWrap}>
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
            secure && styles.secureInput,
            error && styles.inputError,
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
  container: { position: 'relative' },
  label: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 7 },
  compactLabel: { marginBottom: 5 },
  inputWrap: { position: 'relative' },
  input: {
    width: '100%',
    minHeight: 60,
    borderRadius: 17,
    paddingHorizontal: 19,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.78)',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  compactInput: { minHeight: 52, borderRadius: 15, paddingHorizontal: 16, fontSize: 15 },
  inputError: { borderColor: '#ffb4a8' },
  secureInput: { paddingRight: 68 },
  toggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  toggleText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  errorText: { color: '#ffd2ca', fontSize: 14, lineHeight: 20, marginTop: 5, paddingHorizontal: 2 },
});
