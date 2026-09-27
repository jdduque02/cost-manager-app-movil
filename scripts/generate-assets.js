const sharp = require('sharp');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'assets', 'sprig-isotipo.svg');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const specs = [
  { file: 'icon.png', size: 1024 },
  { file: 'adaptive-icon.png', size: 1024 },
  { file: 'splash-icon.png', size: 200 },
  { file: 'favicon.png', size: 48 },
];

(async () => {
  for (const { file, size } of specs) {
    await sharp(SVG_PATH)
      .resize(size, size, { fit: 'contain', background: { r: 27, g: 67, b: 50, alpha: 1 } })
      .png()
      .toFile(path.join(ASSETS_DIR, file));
    console.log(`Generated ${file} (${size}x${size})`);
  }
})();
