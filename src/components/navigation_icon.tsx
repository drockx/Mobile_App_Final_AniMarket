import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const sources = {
  back: require('../../assets/images/navigation/back.svg'),
  next: require('../../assets/images/navigation/next.svg'),
  down: require('../../assets/images/navigation/down.svg'),
  up: require('../../assets/images/navigation/up.svg'),
  close: require('../../assets/images/navigation/close.svg'),
} as const;
const sizes = { back: 24, next: 20, down: 20, up: 20, close: 22 } as const;

/** Fixed vector geometry keeps navigation icons consistent across platforms and font sizes. */
export function NavigationIcon({ name, color = '#12372a', size = sizes[name] }: {
  name: keyof typeof sources; color?: string; size?: number;
}) {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, flexShrink: 0, pointerEvents: 'none' }}>
    <Image source={sources[name]} contentFit="contain" tintColor={color} transition={0} style={StyleSheet.absoluteFill} />
  </View>;
}
