#!/usr/bin/env python3
"""Patch the Bundle React Native code script in LinkLoop.xcodeproj to handle spaces in path."""

pbxproj = '/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/LinkLoopLiteApp/ios/LinkLoop.xcodeproj/project.pbxproj'

with open(pbxproj, 'r') as f:
    content = f.read()

# The problematic pattern: backtick expansion that word-splits on spaces
old = '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`'

# Fixed: use $() to capture the path, then source it with quotes
new = 'RN_SCRIPT=$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\nsource \\"$RN_SCRIPT\\"'

if old in content:
    content = content.replace(old, new)
    with open(pbxproj, 'w') as f:
        f.write(content)
    print('PATCHED OK - replaced backtick with source "$RN_SCRIPT"')
else:
    print('Pattern not found, searching for similar...')
    # Find the line with react-native-xcode.sh
    for i, line in enumerate(content.split('\n'), 1):
        if 'react-native-xcode.sh' in line:
            print(f'Line {i}: {repr(line[:300])}')
