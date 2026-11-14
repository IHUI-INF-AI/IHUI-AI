import { toRgba, contrast } from './scripts/audit-app-text-contrast.mjs'

const L = {
  'brand.cta': '#000000', 'brand.ctaForeground': '#FFFFFF',
  'brand.DEFAULT': '#000000', 'brand.foreground': '#FFFFFF',
  'surface.onBrand': '#FFFFFF', 'surface.light': '#FFFFFF', 'surface.card': '#FFFFFF', 'surface.bg': '#F5F5F5',
  'text.inverse': '#FAFAFA', 'text.primary': '#0A0A0A', 'text.secondary': '#666666', 'text.tertiary': '#A3A3A3', 'text.medium': '#404040',
  'selection.DEFAULT': '#FFFFFF', 'selection.foreground': '#0A0A0A',
  'brandAccent.DEFAULT': '#8fb8cc', 'brandAccent.foreground': '#1e3a47', 'brandAccent.deep': '#244e5e',
  'error.bg': '#FFE5E5', 'error.onBg': '#C0392B', 'error.text': '#B03028',
  'warning.amber': '#f59e0b', 'warning.amberLight': '#fef3c7', 'warning.onAmber': '#5c230e', 'warning.amberText': '#92400e', 'warning.light': '#fffbeb', 'warning.DEFAULT': '#f59e0b',
  'success.DEFAULT': '#22c55e', 'success.onGreen': '#065F46', 'success.lighter': '#d1fae5', 'success.deepText': '#065F46', 'success.light': '#ecfdf5', 'success.deep': '#0a6b30', 'success.lightest': '#f0fdf4',
  'danger.light': '#fee2e2', 'danger.deepText': '#b91c1c', 'danger.DEFAULT': '#dc2626', 'danger.bright': '#f87171',
  'vip.gold': '#FFD700',
}
const D = {
  'brand.cta': '#ffffff', 'brand.ctaForeground': '#000000',
  'brand.DEFAULT': '#FFFFFF', 'brand.foreground': '#000000',
  'surface.onBrand': '#FFFFFF', 'surface.light': '#262626', 'surface.card': '#1A1A1A', 'surface.bg': '#242424',
  'text.inverse': '#0A0A0A', 'text.primary': '#FAFAFA', 'text.secondary': '#A3A3A3', 'text.tertiary': '#737373', 'text.medium': '#D4D4D4',
  'selection.DEFAULT': '#000000', 'selection.foreground': '#FAFAFA',
  'brandAccent.DEFAULT': '#a3c4d6', 'brandAccent.foreground': '#16262e', 'brandAccent.deep': '#a3c4d6',
  'error.bg': '#7F1D1D', 'error.onBg': '#FCA5A5', 'error.text': '#FCA5A5',
  'warning.amber': '#f59e0b', 'warning.amberLight': '#78350f', 'warning.onAmber': '#5c230e', 'warning.amberText': '#fbbf24', 'warning.light': '#451a03', 'warning.DEFAULT': '#f59e0b',
  'success.DEFAULT': '#2dd269', 'success.onGreen': '#065F46', 'success.lighter': '#064e3b', 'success.deepText': '#86efac', 'success.light': '#052e16', 'success.deep': '#16a34a', 'success.lightest': '#052e16',
  'danger.light': '#7f1d1d', 'danger.deepText': '#ff9e9e', 'danger.DEFAULT': '#C0392B', 'danger.bright': '#fca5a5',
  'vip.gold': '#FFD700',
}

const PAIRS = [
  ['brand.ctaForeground', 'brand.cta'],
  ['brand.foreground', 'brand.DEFAULT'],
  ['surface.onBrand', 'brand.cta'],
  ['surface.light', 'brand.cta'],
  ['text.inverse', 'brand.cta'],
  ['selection.foreground', 'selection.DEFAULT'],
  ['brandAccent.foreground', 'brandAccent.DEFAULT'],
  ['error.onBg', 'error.bg'],
  ['error.text', 'error.bg'],
  ['success.onGreen', 'success.DEFAULT'],
  ['warning.onAmber', 'warning.amber'],
  ['danger.deepText', 'danger.light'],
  ['success.deepText', 'success.lighter'],
  ['warning.amberText', 'warning.amberLight'],
  ['text.primary', 'surface.bg'],
  ['text.secondary', 'surface.bg'],
  ['text.tertiary', 'surface.bg'],
  ['text.medium', 'surface.bg'],
]

for (const [f, b] of PAIRS) {
  const l = contrast(toRgba(L[f]), toRgba(L[b]))
  const d = contrast(toRgba(D[f]), toRgba(D[b]))
  const ok = l >= 4.5 && d >= 4.5
  console.log((ok ? 'OK  ' : 'FAIL'), (f + ' on ' + b).padEnd(46), 'L=' + String(l).padEnd(6), 'D=' + d)
}
