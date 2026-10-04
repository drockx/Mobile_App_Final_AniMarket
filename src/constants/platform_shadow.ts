import { Platform, type ViewStyle } from 'react-native';

/** Preserve native shadows and render the same opaque hex theme colors with CSS on web. */
export function platformShadow(color: string, opacity: number, radius: number, offsetY: number, elevation: number): ViewStyle {
  if (Platform.OS !== 'web') {
    return { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: offsetY }, elevation };
  }
  const hex = color.slice(1);
  const rgb = parseInt(hex.length === 3 ? hex.split('').map((digit) => digit + digit).join('') : hex, 16);
  return { boxShadow: `0px ${offsetY}px ${radius}px rgba(${rgb >> 16},${(rgb >> 8) & 255},${rgb & 255},${opacity.toFixed(2)})` };
}
