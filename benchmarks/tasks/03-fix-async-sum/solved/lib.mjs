// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export async function sumAsync(arr) {
  const doubled = await Promise.all(arr.map(async (x) => x * 2));
  let s = 0;
  for (const v of doubled) {
    s += v;
  }
  return s;
}
