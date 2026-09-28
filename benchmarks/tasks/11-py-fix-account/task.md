<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。
-->

account.py 中 Account.withdraw 缺少校验：amount <= 0 应抛 ValueError；amount 超过余额也应抛 ValueError。请修复（正常取款照常扣减并返回新余额）。\n
