const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'iphone-6.5');
const outDir = path.join(__dirname, 'ipad-13');

// Create output dir
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// Get all PNGs from source
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png'));
console.log(`Found ${files.length} screenshots to resize for iPad 13" (2064x2752)`);

files.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(outDir, file);
  
  // Copy file first
  fs.copyFileSync(src, dest);
  
  // Resize using sips - execFileSync avoids all shell quoting issues
  execFileSync('sips', ['-z', '2752', '2064', dest, '--out', dest]);
  
  // Verify
  const info = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', dest]).toString();
  const w = info.match(/pixelWidth:\s*(\d+)/)[1];
  const h = info.match(/pixelHeight:\s*(\d+)/)[1];
  console.log(`  ${file} → ${w}x${h} ✓`);
});

// Also create 2048x2732 versions (iPad 12.9")
const outDir2 = path.join(__dirname, 'ipad-12.9-new');
if (!fs.existsSync(outDir2)) fs.mkdirSync(outDir2);
console.log(`\nAlso creating iPad 12.9" versions (2048x2732)`);

files.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(outDir2, file);
  fs.copyFileSync(src, dest);
  execFileSync('sips', ['-z', '2732', '2048', dest, '--out', dest]);
  const info = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', dest]).toString();
  const w = info.match(/pixelWidth:\s*(\d+)/)[1];
  const h = info.match(/pixelHeight:\s*(\d+)/)[1];
  console.log(`  ${file} → ${w}x${h} ✓`);
});

console.log('\nDone! iPad screenshots ready.');
