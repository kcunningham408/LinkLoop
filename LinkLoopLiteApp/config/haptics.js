/**
 * Haptic feedback utilities for LinkLoop
 * Wraps expo-haptics with semantic helper functions.
 *
 * Usage:
 *   import { haptic } from '../config/haptics';
 *   haptic.light();          // tab tap, card press
 *   haptic.medium();         // send message, save action
 *   haptic.success();        // login, connect, task completed
 *   haptic.warning();        // delete prompt, remove member
 *   haptic.error();          // failed action
 */
import * as Haptics from 'expo-haptics';

export const haptic = {
  /** Subtle tap — navigation, cards, toggles */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /** Medium press — send, save, log */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /** Heavy thud — destructive confirmation, long-press actions */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),

  /** Success — login, connected, saved successfully */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  /** Warning — delete prompts, remove member, threshold alerts */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),

  /** Error — failed login, network errors */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  /** Selection tick — picker changes, emoji selection, theme selection */
  selection: () => Haptics.selectionAsync(),
};
