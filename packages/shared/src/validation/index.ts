// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export {
  dictTypeSchema,
  dictItemSchema,
  EMPTY_DICT_TYPE_FORM,
  EMPTY_DICT_ITEM_FORM,
  type DictTypeFormValues,
  type DictItemFormValues,
} from './dict-schema'
export { tagSchema, EMPTY_TAG_FORM, type TagFormValues } from './tag-schema'
export {
  helpSchema,
  EMPTY_HELP_FORM,
  HELP_CATEGORY_VALUES,
  type HelpFormValues,
  type HelpCategory,
} from './help-schema'
export { askSchema, EMPTY_ASK_FORM, ASK_STATUS_VALUES, type AskFormValues } from './ask-schema'
export {
  VALIDATION_NS,
  buildMessage,
  VALIDATION_KEYS,
  DEFAULT_VALIDATION_MESSAGES,
  type ValidationKey,
} from './form-schema'
