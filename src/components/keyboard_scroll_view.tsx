import { createContext, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, type ScrollViewProps, type TextInput } from 'react-native';

import { inputScrollDelta } from './input_visibility';

type InputVisibility = {
  focus: (input: TextInput | null) => void;
  blur: (input: TextInput | null) => void;
  reveal: () => void;
  maxInputHeight: number | null;
};
export const InputVisibilityContext = createContext<InputVisibility | null>(null);

/** Uses the existing native keyboard and scroll APIs, including in Expo Go. */
export const KeyboardScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardScrollView({
  children, horizontal, onScroll, onLayout, onContentSizeChange, ...props
}, ref) {
  const scroll = useRef<ScrollView>(null);
  const focused = useRef<TextInput | null>(null);
  const offset = useRef(0);
  const frame = useRef<number | null>(null);
  const [height, setHeight] = useState(0);
  useImperativeHandle(ref, () => scroll.current!);

  const reveal = useCallback(() => {
    if (horizontal || !focused.current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = focused.current;
      const view = scroll.current;
      if (!input?.isFocused() || !view) return;
      view.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
        input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
          if (focused.current !== input || !input.isFocused() || !height || !inputHeight) return;
          // react-native-web has no Keyboard.metrics implementation.
          const keyboardTop = Platform.OS === 'web' ? undefined : Keyboard.metrics?.()?.screenY;
          const delta = inputScrollDelta({ y: inputY, height: inputHeight }, { y, height }, keyboardTop);
          if (Math.abs(delta) > 1) view.scrollTo({ y: Math.max(0, offset.current + delta), animated: false });
        });
      });
    });
  }, [horizontal]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', reveal);
    const changed = Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidChangeFrame', reveal) : null;
    return () => {
      shown.remove(); changed?.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [reveal]);

  const focus = useCallback((input: TextInput | null) => { focused.current = input; reveal(); }, [reveal]);
  const blur = useCallback((input: TextInput | null) => { if (focused.current === input) focused.current = null; }, []);
  const visibility = useMemo<InputVisibility>(() => ({
    focus,
    blur,
    reveal,
    maxInputHeight: !horizontal && height > 0 ? Math.max(48, height - 24) : null,
  }), [focus, blur, reveal, horizontal, height]);

  return <InputVisibilityContext.Provider value={visibility}>
    <ScrollView {...props} ref={scroll} horizontal={horizontal} keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'} scrollEventThrottle={props.scrollEventThrottle ?? 16}
      onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
      onLayout={(event) => { setHeight(event.nativeEvent.layout.height); onLayout?.(event); reveal(); }}
      onContentSizeChange={(width, height) => { onContentSizeChange?.(width, height); reveal(); }}>
      {children}
    </ScrollView>
  </InputVisibilityContext.Provider>;
});
