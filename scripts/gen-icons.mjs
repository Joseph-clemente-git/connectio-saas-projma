import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const outDir = process.argv[2]
mkdirSync(outDir, { recursive: true })

const glyph = `
  <path d="m10.586 5.414-5.172 5.172"/>
  <path d="m18.586 13.414-5.172 5.172"/>
  <path d="M6 12h12"/>
  <circle cx="12" cy="20" r="2"/>
  <circle cx="12" cy="4" r="2"/>
  <circle cx="20" cy="12" r="2"/>
  <circle cx="4" cy="12" r="2"/>
`

function iconSvg({ size, rounded, glyphScaleFrac }) {
  const glyphSize = size * glyphScaleFrac
  const scale = glyphSize / 24
  const offset = (size - glyphSize) / 2
  const rx = rounded ? size * 0.2225 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${rx}" fill="#2563EB"/>
    <g transform="translate(${offset},${offset}) scale(${scale})" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
      ${glyph}
    </g>
  </svg>`
}

const targets = [
  { name: 'icon-192.png', size: 192, rounded: true, glyphScaleFrac: 0.625 },
  { name: 'icon-512.png', size: 512, rounded: true, glyphScaleFrac: 0.625 },
  { name: 'icon-512-maskable.png', size: 512, rounded: false, glyphScaleFrac: 0.5 },
  { name: 'apple-touch-icon.png', size: 180, rounded: true, glyphScaleFrac: 0.6 },
]

for (const t of targets) {
  const svg = iconSvg(t)
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, t.name))
  console.log('wrote', t.name)
}
