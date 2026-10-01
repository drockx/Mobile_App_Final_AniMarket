import { StyleSheet, Text, View } from 'react-native';
import { animalIcons } from '@/constants/animal_icons';
const icons = { Cow: animalIcons.cow, Pig: animalIcons.pig, Goat: animalIcons.goat, Chicken: animalIcons.poultry };

export function AnimalPlaceholder({ category }: { category?: keyof typeof icons }) {
  return <View accessible accessibilityRole="image" accessibilityLabel={`${category ?? 'Livestock'} photo unavailable`} style={[StyleSheet.absoluteFill, styles.box]}>
    <Text allowFontScaling={false} style={styles.icon}>{category ? icons[category] : '📷'}</Text>
  </View>;
}
const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf5ed' }, icon: { fontSize: 42 } });
