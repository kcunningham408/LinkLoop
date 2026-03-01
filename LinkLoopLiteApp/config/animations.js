/**
 * Entrance animation utilities for LinkLoop.
 *
 * Uses React Native Reanimated for 60 fps native-driver animations.
 *
 * Components:
 *   <FadeIn>       – Fade-in + optional slide-up on mount
 *   <StaggerIn>    – Wraps children with staggered entrance delays
 *
 * Hook:
 *   useEntrance()  – Low-level hook returning animated style
 */

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  FadeIn as ReanimatedFadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
} from 'react-native-reanimated';

// ── Timing presets ──────────────────────────────────────────────
export const DURATION = {
  fast: 250,
  normal: 400,
  slow: 600,
};

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1); // CSS ease equivalent

// ── useEntrance hook ────────────────────────────────────────────
/**
 * Returns an animated style that fades + slides content in on mount.
 *
 * @param {number} delay   – ms before animation starts (default 0)
 * @param {number} duration – ms for the animation (default 400)
 * @param {number} slideY  – vertical offset to slide from (default 20)
 * @param {number} slideX  – horizontal offset to slide from (default 0)
 */
export function useEntrance({ delay = 0, duration = DURATION.normal, slideY = 20, slideX = 0 } = {}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: EASE })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * slideY },
      { translateX: (1 - progress.value) * slideX },
    ],
  }));

  return animatedStyle;
}

// ── useScalePop hook ────────────────────────────────────────────
/**
 * Scale-pop entrance (for hero values, emojis, etc.)
 */
export function useScalePop({ delay = 0, from = 0.85 } = {}) {
  const scale = useSharedValue(from);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION.fast }));
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 12, stiffness: 180 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return animatedStyle;
}

// ── <FadeIn> component ──────────────────────────────────────────
/**
 * Wrapper that fades + slides its children in on mount.
 *
 *   <FadeIn delay={100} slideY={30}>
 *     <YourContent />
 *   </FadeIn>
 */
export function FadeIn({ children, delay = 0, duration = DURATION.normal, slideY = 20, slideX = 0, style }) {
  const entranceStyle = useEntrance({ delay, duration, slideY, slideX });

  return (
    <Animated.View style={[entranceStyle, style]}>
      {children}
    </Animated.View>
  );
}

// ── <ScalePop> component ────────────────────────────────────────
export function ScalePop({ children, delay = 0, from = 0.85, style }) {
  const popStyle = useScalePop({ delay, from });

  return (
    <Animated.View style={[popStyle, style]}>
      {children}
    </Animated.View>
  );
}

// ── Stagger helper ──────────────────────────────────────────────
/**
 * Calculates delay for the Nth item in a staggered list.
 *
 *   stagger(2)        → 200  (3rd item, base 0ms, step 100ms)
 *   stagger(0, 150)   → 150  (1st item, base 150ms)
 */
export function stagger(index, baseDelay = 0, step = 80) {
  return baseDelay + index * step;
}

export default { useEntrance, useScalePop, FadeIn, ScalePop, stagger, DURATION };
