export interface ValidationResult {
  valid: boolean
  contrastRatio: number
  suggestions?: string[]
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace(/^#/, '').trim()
  const match = normalized.match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return null
  let r: number
  let g: number
  let b: number
  if (normalized.length === 3) {
    r = parseInt(normalized.charAt(0) + normalized.charAt(0), 16)
    g = parseInt(normalized.charAt(1) + normalized.charAt(1), 16)
    b = parseInt(normalized.charAt(2) + normalized.charAt(2), 16)
  } else {
    r = parseInt(normalized.slice(0, 2), 16)
    g = parseInt(normalized.slice(2, 4), 16)
    b = parseInt(normalized.slice(4, 6), 16)
  }
  return { r, g, b }
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const linearize = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function contrastRatio(fg: string, bg: string): number {
  const fgRgb = hexToRgb(fg)
  const bgRgb = hexToRgb(bg)
  if (!fgRgb || !bgRgb) return 1
  const l1 = relativeLuminance(fgRgb)
  const l2 = relativeLuminance(bgRgb)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function validateContrast(
  fg: string,
  bg: string,
  level: 'AA' | 'AAA' = 'AA',
): ValidationResult {
  const ratio = contrastRatio(fg, bg)
  const threshold = level === 'AAA' ? 7 : 4.5
  const valid = ratio >= threshold
  const suggestions = valid ? undefined : [suggestColor(fg, bg)]
  return { valid, contrastRatio: Number(ratio.toFixed(2)), suggestions }
}

export function suggestColor(fg: string, bg: string): string {
  const fgRgb = hexToRgb(fg)
  const bgRgb = hexToRgb(bg)
  if (!fgRgb || !bgRgb) return fg
  const isLightBg = relativeLuminance(bgRgb) > 0.5
  let { r, g, b } = fgRgb
  const step = 8
  for (let i = 0; i < 32; i++) {
    if (contrastRatio(rgbToHex(r, g, b), bg) >= 4.5) {
      return rgbToHex(r, g, b)
    }
    if (isLightBg) {
      r = Math.max(0, r - step)
      g = Math.max(0, g - step)
      b = Math.max(0, b - step)
    } else {
      r = Math.min(255, r + step)
      g = Math.min(255, g + step)
      b = Math.min(255, b + step)
    }
  }
  return rgbToHex(r, g, b)
}
