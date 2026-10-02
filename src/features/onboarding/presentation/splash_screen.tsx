import { NavigationIcon } from '@/components/navigation_icon';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
      source={require('../../../../assets/images/branding/splash_bg.png')}
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

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 72, paddingBottom: Math.max(insets.bottom + 5, 39) }]} showsVerticalScrollIndicator={false}>
        <Image
          source={require('../../../../assets/images/branding/animarket_logo.png')}
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
              <NavigationIcon name="next" size={24} />
            </View>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#18291d',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    gap: 32,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
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
    flex: 1,
    minWidth: 0,
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  nextButton: {
    width: 48,
    height: 48,
    flexShrink: 0,
    marginLeft: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
});
