# LinkLoop T1D — Store Assets

All app store images are generated from `generate-all-store-images.html`.

## How to Use

1. Open `generate-all-store-images.html` in **Chrome or Safari**
2. Preview all screenshots at the bottom of the page
3. Click **Export All PNGs** to download everything, or use the per-section buttons
4. Move exported PNGs into the appropriate folders below

## Required Image Sizes

### Apple App Store

| Asset | Size (px) | Folder | Notes |
|-------|-----------|--------|-------|
| iPhone 6.7" Screenshots | 1290 x 2796 | `screenshots/iphone-6.7/` | iPhone 15 Pro Max, 14 Pro Max |
| iPhone 6.5" Screenshots | 1284 x 2778 | `screenshots/iphone-6.5/` | iPhone 11 Pro Max, XS Max |
| iPad 12.9" Screenshots | 2048 x 2732 | `screenshots/ipad-12.9/` | iPad Pro 12.9" |
| Apple Watch Screenshots | 410 x 502 | `screenshots/watch/` | Series 9, Ultra |
| App Icon | 1024 x 1024 | `icon/` | Already exists |

### Google Play Store

| Asset | Size (px) | Folder | Notes |
|-------|-----------|--------|-------|
| Feature Graphic | 1024 x 500 | `google-play/feature-graphic/` | Required for listing |
| Phone Screenshots | 1080 x 1920 | `google-play/phone/` | 16:9 portrait |
| 7" Tablet Screenshots | 1200 x 1600 | `google-play/tablet-7/` | Optional but recommended |
| Hi-res Icon | 512 x 512 | `google-play/` | Already exists |

## Screenshots Generated (6 screens)

1. **home** — Dashboard with Today's Average card and quick-access grid
2. **glucose** — Real-time glucose reading, 24-hour trend chart, Time in Range
3. **insights** — AI Daily Summary, Ask Loop, Motivation, Patterns
4. **care-circle** — Family members, group chat, glucose sharing
5. **challenges** — Active challenge progress, available challenges list
6. **watch** — Apple Watch promo with feature bullets

## Watch Screenshots (3 screens)

1. **watch-glucose** — Main glucose display (112 mg/dL, In Range)
2. **watch-complication** — Watch face with LinkLoop complication
3. **watch-high-alert** — High glucose alert state (245 mg/dL)

## File Naming Convention

Exported files follow this pattern:
```
{section}_{screen-id}.png
```

Examples:
- `iphone67_home.png`
- `iphone65_glucose.png`
- `ipad_insights.png`
- `watch_watch-glucose.png`
- `google-phone_care-circle.png`
- `google-tablet_challenges.png`
- `google_feature-graphic.png`

## Brand Colors Used

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#0A0A0F` | Dark theme base |
| Ocean Blue | `#4A90D9` | Primary accent |
| Gradient End | `#3A7BC8` | Gradient secondary |
| Green | `#34C759` | In-range glucose |
| Red | `#FF3B30` | High glucose alerts |
| Orange | `#FF9500` | Low glucose, supplies |
| Yellow | `#FFD60A` | Achievements, challenges |
| Cyan | `#00D4FF` | Watch accent, AI features |
| Card BG | `#1A1A24` | Card backgrounds |

## Total Assets

- **6** iPhone 6.7" screenshots
- **6** iPhone 6.5" screenshots
- **6** iPad 12.9" screenshots
- **3** Apple Watch screenshots
- **1** Google Play Feature Graphic
- **6** Google Play Phone screenshots
- **6** Google Play Tablet screenshots
- **Total: 34 images**
