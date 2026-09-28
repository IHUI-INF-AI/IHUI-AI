// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return (s[mid - 1] + s[mid]) / 2;
}

export function mode(arr) {
  if (!arr.length) return null;
  const counts = new Map();
  let best = null;
  let bestCount = 0;
  for (const x of arr) {
    const c = (counts.get(x) || 0) + 1;
    counts.set(x, c);
    if (c > bestCount) {
      bestCount = c;
      best = x;
    }
  }
  return best;
}
