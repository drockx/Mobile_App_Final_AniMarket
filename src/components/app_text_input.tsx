import { forwardRef, useContext, useEffect, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { InputVisibilityContext } from './keyboard_scroll_view';
import { appTypography } from '@/constants/app_theme';

export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput({
  style, multiline, onFocus, onBlur, onLayout, onContentSizeChange, ...props
}, ref) {
  const input = useRef<TextInput>(null);
  const visibility = useContext(InputVisibilityContext);
  const fieldStyle = StyleSheet.flatten(style);
  const textColor = fieldStyle?.color ?? '#17221d';
  const blur = visibility?.blur;
  const maxHeight = visibility?.maxInputHeight;
  useImperativeHandle(ref, () => input.current!);
  useEffect(() => {
    const node = input.current;
    return () => blur?.(node);
  }, [blur]);

  return <TextInput
    placeholderTextColor="#52647a"
    selectionColor={Platform.OS === 'android' ? '#9fd3b4' : textColor}
    cursorColor={textColor}
    underlineColorAndroid="transparent"
    keyboardAppearance="light"
    textAlignVertical={multiline ? 'top' : 'center'}
    scrollEnabled
    {...props}
    ref={input}
    multiline={multiline}
    style={[styles.input, style, multiline && maxHeight != null && {
      maxHeight,
      minHeight: Math.min(typeof fieldStyle?.minHeight === 'number' ? fieldStyle.minHeight : 0, maxHeight),
    }]}
    onFocus={(event) => { visibility?.focus(input.current); onFocus?.(event); }}
    onBlur={(event) => { visibility?.blur(input.current); onBlur?.(event); }}
    onLayout={(event) => { onLayout?.(event); if (input.current?.isFocused()) visibility?.reveal(); }}
    onContentSizeChange={(event) => { onContentSizeChange?.(event); if (input.current?.isFocused()) visibility?.reveal(); }}
  />;
});

const styles = StyleSheet.create({
  input: { ...appTypography.input, minWidth: 0, color: '#17221d', paddingVertical: 10, includeFontPadding: false, textAlign: 'left' },
});
