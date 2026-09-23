import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SplashScreenProps = {
  onContinue: () => void;
};

export function SplashScreen({ onContinue }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const logoSize = Math.min(width * 0.68, 250);

  return (
    <ImageBackground
      source={require('../../../../assets/images/branding/splash-bg.png')}
      resizeMode="cover"
      style={styles.screen}
      accessibilityLabel="Farm landscape with livestock"
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(9,25,17,0.04)', 'rgba(9,25,17,0)', 'rgba(9,25,17,0.10)', 'rgba(9,25,17,0.25)']}
        locations={[0, 0.45, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: insets.top + 72, paddingBottom: Math.max(insets.bottom, 18) + 8 }]}>
        <Image
          source={require('../../../../assets/images/branding/animarket-logo.png')}
          resizeMode="contain"
          style={{ width: logoSize, height: logoSize }}
          accessibilityLabel="AniMarket logo"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue to login"
          onPress={onContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.headline}>Your Trusted Livestock{'\n'}Marketplace</Text>
          <View style={styles.nextCircle}>
            <Text style={styles.arrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">→</Text>
          </View>
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#18291d',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  cta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 86,
    marginTop: 'auto',
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(30,84,52,0.82)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  headline: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  nextCircle: {
    width: 58,
    height: 58,
    marginLeft: 12,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f7ef',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  arrow: {
    color: '#173c2b',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '500',
  },
});
