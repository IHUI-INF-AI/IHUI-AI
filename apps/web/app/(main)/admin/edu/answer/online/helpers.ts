// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/** 题目类型 i18n key 静态映射表:typeLabel.${type} — 用于消除 `t(`typeLabel.${var}`)` 动态拼接 */
export const TYPE_LABEL_KEY: Record<string, string> = {
  single_choice: 'typeLabel.single_choice',
  multi_choice: 'typeLabel.multi_choice',
  judgment: 'typeLabel.judgment',
  fill_blank: 'typeLabel.fill_blank',
  subjective: 'typeLabel.subjective',
  programming: 'typeLabel.programming',
}
