/**
 * LinkLoop Type Scale System
 * 
 * Centralized typography tokens for consistent sizing across all screens.
 * Change a value here → updates everywhere in the app.
 * 
 * SCALE (modular, ~1.2 ratio):
 *   xs   10   – Tiny labels, badge counts, timestamps
 *   sm   12   – Disclaimers, hints, descriptions, captions
 *   md   14   – Body text, messages, input labels
 *   lg   16   – Card titles, button text, section sub-headers
 *   xl   18   – Section titles, status text
 *   xxl  22   – Modal titles, profile names
 *   h3   24   – Form headings
 *   h2   28   – Large stat values
 *   h1   32   – Hero text, glucose display
 *   hero 44   – Primary glucose reading
 *   mega 72   – CGM hero glucose
 * 
 * WEIGHTS:
 *   regular   '400'
 *   medium    '500'
 *   semibold  '600'
 *   bold      '700'
 *   extrabold '800'
 *   black     '900'
 */

export const TYPE = {
  // ── Size Scale ──────────────────────
  xs:   10,
  sm:   12,
  md:   14,
  lg:   16,
  xl:   18,
  xxl:  22,
  h3:   24,
  h2:   28,
  h1:   32,
  hero: 44,
  mega: 72,

  // ── Weight Presets ──────────────────
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
  black:     '900',
};

export default TYPE;
