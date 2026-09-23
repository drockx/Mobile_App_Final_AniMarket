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

      <View style={[styles.content, { paddingTop: insets.top + 72, paddingBottom: Math.max(insets.bottom + 5, 39) }]}>
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
          style={({ pressed }) => [styles.ctaPressable, pressed && styles.ctaPressed]}
        >
          <LinearGradient
            colors={['#25481f', '#2b711e']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.headline}>Your Trusted Livestock{'\n'}Marketplace</Text>
            <View style={styles.nextButton}>
              <Text
                style={styles.arrow}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                →
              </Text>
            </View>
          </LinearGradient>
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
  ctaPressable: {
    alignSelf: 'stretch',
    marginTop: 'auto',
    borderRadius: 46,
    shadowColor: '#000',
    shadowOpacity: 0.19,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 8,
  },
  cta: {
    minHeight: 92,
    borderRadius: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 25,
    paddingRight: 22,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  ctaPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  headline: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  nextButton: {
    width: 67,
    height: 40,
    marginLeft: 16,
    borderRadius: 20,
    transform: [{ translateY: -2 }],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  arrow: {
    color: '#12372a',
    fontSize: 27,
    lineHeight: 29,
    fontWeight: '500',
    marginTop: -1,
  },
});
