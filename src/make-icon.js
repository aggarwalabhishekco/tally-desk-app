// make-icon.js
// Builds a tiny solid-color PNG at runtime (no external icon file needed),
// so the tray always has a valid, non-empty icon even before a real brand
// icon is added to build/. Pure Node (zlib + Buffer), no dependencies --
// testable without Electron.
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
}

// Solid square with a simple two-tone "T" mark (navy background, gold T),
// approximating the site's brand colours (--navy-900 #001a2e, --gold-500 #d4af37).
function makeSquarePNG(size = 32, bg = [0x00, 0x1a, 0x2e], fg = [0xd4, 0xaf, 0x37]) {
  const raw = Buffer.alloc(size * (1 + size * 4)); // filter byte + RGBA per row
  const barThickness = Math.max(2, Math.round(size * 0.14));
  const stemWidth = Math.max(2, Math.round(size * 0.18));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const isTopBar = y < barThickness;
      const isStem = x >= size / 2 - stemWidth / 2 && x <= size / 2 + stemWidth / 2;
      const paintFg = isTopBar || isStem;
      const [r, g, b] = paintFg ? fg : bg;
      const px = rowStart + 1 + x * 4;
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b; raw[px + 3] = 255;
    }
  }
  const idat = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { makeSquarePNG };
