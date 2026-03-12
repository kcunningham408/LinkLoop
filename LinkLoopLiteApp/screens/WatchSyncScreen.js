import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassCard from '../components/GlassCard';
import { FadeIn, stagger } from '../config/animations';
import { haptic } from '../config/haptics';
import TYPE from '../config/typography';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';

export default function WatchSyncScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { palette, getGradient } = useTheme();
  const isMember = user?.role === 'member';
  const accent = isMember ? palette.member : palette.warrior;

  const [watchCode, setWatchCode] = useState(null);
  const [watchCodeLoading, setWatchCodeLoading] = useState(false);

  const handleWatchPair = async () => {
    try {
      setWatchCodeLoading(true);
      const data = await authAPI.generateWatchPairCode();
      setWatchCode(data.code);
      haptic.success();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not generate code');
    } finally {
      setWatchCodeLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 + insets.bottom }}>
      <View style={styles.content}>
        {/* Hero illustration */}
        <FadeIn delay={0}>
        <View style={styles.heroSection}>
          <Text style={styles.heroIcon}>⌚</Text>
          <Text style={styles.heroTitle}>Apple Watch</Text>
          <Text style={styles.heroSubtitle}>
            View your glucose right on your wrist with live complications and instant alerts
          </Text>
        </View>
        </FadeIn>

        {/* Pairing Card */}
        <FadeIn delay={stagger(1, 100)}>
        <GlassCard style={styles.pairCard}>
          <Text style={[styles.sectionTitle, { color: accent }]}>🔗 Pair Your Watch</Text>
          <Text style={styles.description}>
            Generate a 6-digit code below, then enter it on your Apple Watch to link it to your LinkLoop account.
          </Text>

          {watchCode ? (
            <View style={styles.codeContainer}>
              <View style={[styles.codeBox, { borderColor: accent + '40' }]}>
                <Text style={[styles.codeText, { color: accent }]}>
                  {watchCode}
                </Text>
              </View>
              <Text style={styles.codeHint}>
                Enter this code on your Watch.{'\n'}Expires in 10 minutes.
              </Text>
              <TouchableOpacity onPress={handleWatchPair} style={styles.regenerateBtn}>
                <Text style={[styles.regenerateText, { color: accent }]}>Generate New Code</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.pairButton, { backgroundColor: accent }]}
              onPress={handleWatchPair}
              disabled={watchCodeLoading}
            >
              <Text style={styles.pairButtonIcon}>⌚</Text>
              <Text style={styles.pairButtonText}>
                {watchCodeLoading ? 'Generating...' : 'Generate Pairing Code'}
              </Text>
            </TouchableOpacity>
          )}
        </GlassCard>
        </FadeIn>

        {/* Features */}
        <FadeIn delay={stagger(2, 100)}>
        <GlassCard style={styles.featureCard}>
          <Text style={styles.sectionTitle}>What You Get</Text>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🔵</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Watch Face Complications</Text>
              <Text style={styles.featureDesc}>See your glucose number directly on your watch face — circular, rectangular, and inline styles</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>⚡</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Live Push from iPhone</Text>
              <Text style={styles.featureDesc}>Your iPhone pushes the latest reading to your Watch every 60 seconds — no waiting for the next poll</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📊</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Trend Graph</Text>
              <Text style={styles.featureDesc}>View your 3-hour glucose trend right on your wrist</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🔔</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Haptic Alerts</Text>
              <Text style={styles.featureDesc}>Get a tap on the wrist when glucose goes high or low</Text>
            </View>
          </View>
        </GlassCard>
        </FadeIn>

        {/* How it works */}
        <FadeIn delay={stagger(3, 100)}>
        <GlassCard style={styles.featureCard}>
          <Text style={styles.sectionTitle}>How It Works</Text>

          <View style={styles.stepItem}>
            <View style={[styles.stepBadge, { backgroundColor: accent }]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Install LinkLoop on your Watch</Text>
              <Text style={styles.stepDesc}>Open the Watch app on your iPhone and install LinkLoop</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={[styles.stepBadge, { backgroundColor: accent }]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Generate a pairing code</Text>
              <Text style={styles.stepDesc}>Tap the button above to get a 6-digit code</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={[styles.stepBadge, { backgroundColor: accent }]}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Enter code on your Watch</Text>
              <Text style={styles.stepDesc}>Open LinkLoop on your Watch and enter the code</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={[styles.stepBadge, { backgroundColor: accent }]}>
              <Text style={styles.stepNumber}>4</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Add complications</Text>
              <Text style={styles.stepDesc}>Long-press your watch face → Edit → add LinkLoop complications</Text>
            </View>
          </View>
        </GlassCard>
        </FadeIn>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 20 },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  heroIcon: { fontSize: 56, marginBottom: 12 },
  heroTitle: { fontSize: TYPE.h1, fontWeight: TYPE.extrabold, color: '#fff', marginBottom: 8 },
  heroSubtitle: { fontSize: TYPE.md, color: '#888', textAlign: 'center', lineHeight: 22 },

  // Pairing card
  pairCard: { borderRadius: 16, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: TYPE.xl, fontWeight: TYPE.bold, color: '#fff', marginBottom: 12 },
  description: { fontSize: TYPE.md, color: '#888', lineHeight: 22, marginBottom: 20 },

  codeContainer: { alignItems: 'center', marginVertical: 8 },
  codeBox: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignSelf: 'center',
  },
  codeText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 8,
    fontFamily: 'Courier',
  },
  codeHint: { fontSize: TYPE.sm, color: '#888', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  regenerateBtn: { marginTop: 16, paddingVertical: 8 },
  regenerateText: { fontWeight: TYPE.semibold, fontSize: TYPE.md },

  pairButton: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pairButtonIcon: { fontSize: 20 },
  pairButtonText: { fontSize: TYPE.lg, fontWeight: TYPE.bold, color: '#fff' },

  // Features
  featureCard: { borderRadius: 16, padding: 24, marginBottom: 20 },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  featureIcon: { fontSize: 22, marginRight: 14, marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: TYPE.semibold, color: '#fff', marginBottom: 3 },
  featureDesc: { fontSize: TYPE.sm, color: '#888', lineHeight: 18 },

  // Steps
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  stepNumber: { fontSize: 14, fontWeight: TYPE.bold, color: '#fff' },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: TYPE.semibold, color: '#fff', marginBottom: 3 },
  stepDesc: { fontSize: TYPE.sm, color: '#888', lineHeight: 18 },
});
