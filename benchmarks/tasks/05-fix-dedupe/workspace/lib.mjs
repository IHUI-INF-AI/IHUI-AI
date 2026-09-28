// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export function dedupe(arr) {
  const seen = [];
  return arr.filter((x) => {
    if (seen.includes(x)) {
      seen.push(x);
      return true;
    }
    return false;
  });
}
