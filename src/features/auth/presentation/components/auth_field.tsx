import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

type AuthFieldProps = Pick<
  TextInputProps,
  'autoCapitalize' | 'autoComplete' | 'keyboardType' | 'maxLength' | 'returnKeyType'
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
          accessibilityLabel={label}
          placeholder={label}
          placeholderTextColor="rgba(255,255,255,0.72)"
          selectionColor="#fff"
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
            hitSlop={6}
            onPress={() => setVisible((current) => !current)}
            style={[styles.toggle, compact && styles.compactToggle]}
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
    height: 60,
    borderRadius: 17,
    paddingHorizontal: 19,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.78)',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  compactInput: { height: 52, borderRadius: 15, paddingHorizontal: 16, fontSize: 15 },
  inputError: { borderColor: '#ffb4a8' },
  secureInput: { paddingRight: 68 },
  toggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  compactToggle: { height: 52 },
  toggleText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  errorText: { color: '#ffd2ca', fontSize: 14, lineHeight: 20, marginTop: 5, paddingHorizontal: 2 },
});
