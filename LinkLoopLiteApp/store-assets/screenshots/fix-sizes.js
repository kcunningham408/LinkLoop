const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname);

const targets = [
  { folder: 'iphone-6.5', w: 1284, h: 2778 },
  { folder: 'iphone-6.7', w: 1290, h: 2796 },
  { folder: 'iphone-6.9', w: 1320, h: 2868 },
  { folder: 'ipad-12.9', w: 2064, h: 2752 },
];

targets.forEach(({ folder, w, h }) => {
  const dir = path.join(base, folder);
  if (!fs.existsSync(dir)) { console.log('SKIP (no folder):', folder); return; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  files.forEach(file => {
    const fp = path.join(dir, file);
    execFileSync('/usr/bin/sips', ['-z', String(h), String(w), fp, '--out', fp]);
    const result = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', fp]).toString();
    const pw = result.match(/pixelWidth: (\d+)/)[1];
    const ph = result.match(/pixelHeight: (\d+)/)[1];
    console.log(`${folder}/${file}: ${pw}x${ph}`);
  });
});

console.log('\nAll done.');
