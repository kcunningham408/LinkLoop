# LinkLoop Build Fixes Reference

## Date: March 6, 2026

---

## Fix #1: Space-in-Path Quoting Bug (EXConstants / EXUpdates Script Phases)

### Problem
Xcode archive builds failed with:
```
bash: /Users/kevin/Desktop/KC: No such file or directory
Command PhaseScriptExecution failed with a nonzero exit code
```

The error came from the `[CP-User] Generate app.config for prebuilt Constants.manifest` build phase in the EXConstants pod target.

### Root Cause
The workspace path `/Users/kevin/Desktop/KC Stuff/App Ideas/...` contains spaces. The CocoaPods-generated `Pods.xcodeproj/project.pbxproj` had two script phases that used `bash -l -c` with an unquoted `$PODS_TARGET_SRCROOT` variable:

```
shellScript = "bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"";
```

When Xcode runs this, `$PODS_TARGET_SRCROOT` expands to the full path with spaces. Inside `bash -c "..."`, the unquoted path causes word splitting — bash interprets `/Users/kevin/Desktop/KC` as the command and `Stuff/App Ideas/...` as separate arguments.

`$PODS_TARGET_SRCROOT` resolves via the xcconfig:
```
PODS_TARGET_SRCROOT = ${PODS_ROOT}/../../node_modules/expo-constants/ios
```

### Fix
Edited `/ios/Pods/Pods.xcodeproj/project.pbxproj` — changed both affected script phases to use single quotes around the `bash -c` argument with escaped double quotes around the variable:

**EXConstants (line ~27776):**
```
# BEFORE (broken):
shellScript = "bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"";

# AFTER (fixed):
shellScript = "bash -l -c '\"$PODS_TARGET_SRCROOT\"/../scripts/get-app-config-ios.sh'";
```

**EXUpdates (line ~27786):**
```
# BEFORE (broken):
shellScript = "bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\"";

# AFTER (fixed):
shellScript = "bash -l -c '\"$PODS_TARGET_SRCROOT\"/../scripts/create-updates-resources-ios.sh'";
```

### When This Happens
- After running `npx expo prebuild --clean` (regenerates the Pods project)
- After running `pod install` (regenerates Pods.xcodeproj)
- Any time the Pods project is regenerated from scratch

### How to Re-Apply
After any `pod install` or `expo prebuild`, search for and fix these lines:
```bash
grep -n 'bash -l -c' "/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/LinkLoopLiteApp/ios/Pods/Pods.xcodeproj/project.pbxproj"
```
Then replace any `bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/SCRIPTNAME.sh\"` with `bash -l -c '\"$PODS_TARGET_SRCROOT\"/../scripts/SCRIPTNAME.sh'`.

### Misleading Symptoms
- Earlier builds showed `** ARCHIVE INTERRUPTED **` instead of `** ARCHIVE FAILED **` because xcodebuild was accidentally killed by terminal management (killall, signal propagation from piped commands, etc.)
- The actual `** ARCHIVE FAILED **` with the real error only appeared when running xcodebuild with `nohup` to protect it from signals
- `grep "error:"` on the build log returns mostly noise (Obj-C method signatures containing "error:" in their names) — use `grep "Command PhaseScriptExecution failed\|bash:.*No such file"` instead

---

## Fix #2: Missing ios/scripts/get-app-config-ios.sh (Red Herring)

This was attempted as a fix but was NOT the actual problem. The script phase references `$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh` which resolves to `node_modules/expo-constants/scripts/get-app-config-ios.sh` (which already exists). Copying it to `ios/scripts/` had no effect because that's not the path the build phase uses.

---

## Build Command Reference

### Archive Build
```bash
cd "/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/LinkLoopLiteApp/ios" && \
nohup xcodebuild -workspace LinkLoop.xcworkspace \
  -scheme LinkLoop \
  -configuration Release \
  -archivePath build/LinkLoop.xcarchive \
  archive \
  -destination "generic/platform=iOS" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=CT3KS56744 \
  CURRENT_PROJECT_VERSION=59 \
  MARKETING_VERSION=1.5.0 \
  > /tmp/linkloop-build.log 2>&1 &
```

**Important:** Use `nohup ... &` to prevent terminal signal interruption from killing the build.

### Check Build Result
```bash
grep "ARCHIVE SUCCEEDED\|ARCHIVE FAILED\|ARCHIVE INTERRUPTED" /tmp/linkloop-build.log
```

### Find Real Errors (not noise)
```bash
grep "Command PhaseScriptExecution failed\|bash:.*No such file\|ld: error\|clang: error\|Undefined symbol\|linker command failed" /tmp/linkloop-build.log
```

### Export IPA
```bash
xcodebuild -exportArchive \
  -archivePath build/LinkLoop.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist build/ExportOptions.plist
```

### ExportOptions.plist Location
Template at: `LinkLoopLite/builds/v1.5.0-watchos-build1/ExportOptions.plist`
- method: app-store-connect
- signingStyle: automatic
- teamID: CT3KS56744

### Copy & Open in Transporter
```bash
cp build/export/LinkLoop.ipa "/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/builds/LinkLoop-v1.5.0-buildXX-ios.ipa"
open -a Transporter "/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/builds/LinkLoop-v1.5.0-buildXX-ios.ipa"
```

---

## Key Paths
- **App root:** `/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/LinkLoopLiteApp/`
- **iOS workspace:** `ios/LinkLoop.xcworkspace`
- **Pods project:** `ios/Pods/Pods.xcodeproj/project.pbxproj`
- **DerivedData:** `~/Library/Developer/Xcode/DerivedData/LinkLoop-fqqjueakaexazpeubjijdzrcflqr/`
- **Builds folder:** `/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/builds/`
- **Bundle ID:** `com.vibecmd.linkloop`
- **Team:** `CT3KS56744`

## Build History
| Build | Version | Status | Notes |
|-------|---------|--------|-------|
| 59    | 1.5.0   | ✅ Success | Cross-circle refactor, Watch auto-refresh, v8 icon |
| 46    | 1.5.0   | ✅ Success | Previous submission |
| 43    | 1.5.0   | ✅ Success | Local build |
