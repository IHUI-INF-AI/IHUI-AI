export const TYPE_LABEL: Record<string, string> = {
  single_choice: 'single_choice',
  multi_choice: 'multi_choice',
  judgment: 'judgment',
  fill_blank: 'fill_blank',
  subjective: 'subjective',
  programming: 'programming',
}

/** 题目类型 i18n key 静态映射表:typeLabel.${type} — 用于消除 `t(`typeLabel.${var}`)` 动态拼接 */
export const TYPE_LABEL_KEY: Record<string, string> = {
  single_choice: 'typeLabel.single_choice',
  multi_choice: 'typeLabel.multi_choice',
  judgment: 'typeLabel.judgment',
  fill_blank: 'typeLabel.fill_blank',
  subjective: 'typeLabel.subjective',
  programming: 'typeLabel.programming',
}
