const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'iphone-6.5');
const dest = path.join(__dirname, 'ipad-12.9');

fs.mkdirSync(dest, { recursive: true });

const files = fs.readdirSync(src).filter(f => f.endsWith('.png'));

files.forEach(file => {
  const srcFile = path.join(src, file);
  const destFile = path.join(dest, file);
  fs.copyFileSync(srcFile, destFile);
  execFileSync('/usr/bin/sips', ['-z', '2752', '2064', destFile, '--out', destFile]);
  console.log('Done: ' + file);
});

console.log('\nAll ' + files.length + ' iPad screenshots done at 2064x2752');
