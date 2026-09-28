<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。
-->

lib.mjs 中 clamp(v, min, max) 需处理边界：v 为 undefined 或 NaN 时返回 min；min > max 时先交换再夹取。请按此规范修复（如 clamp(5,10,1)===5，clamp(undefined,1,10)===1）。\n
