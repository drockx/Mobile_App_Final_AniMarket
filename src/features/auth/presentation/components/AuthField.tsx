import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

type AuthFieldProps = Pick<TextInputProps, 'autoCapitalize' | 'autoComplete' | 'keyboardType' | 'maxLength'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  compact?: boolean;
};

export function AuthField({ label, value, onChangeText, secure = false, compact = false, ...inputProps }: AuthFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor="rgba(255,255,255,0.84)"
        selectionColor="#fff"
        secureTextEntry={secure && !visible}
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, secure && styles.secureInput]}
      />
      {secure && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          onPress={() => setVisible((current) => !current)}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  label: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 7 },
  compactLabel: { marginBottom: 6 },
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
  secureInput: { paddingRight: 68 },
  toggle: { position: 'absolute', right: 12, bottom: 0, height: 60, justifyContent: 'center', paddingHorizontal: 6 },
  toggleText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
