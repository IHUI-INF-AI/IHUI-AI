// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export function avg(nums) {
  if (!nums.length) return 0;
  let s = 0;
  for (let i = 0; i < nums.length; i++) s += nums[i];
  return s / nums.length;
}
