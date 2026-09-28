// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { TForm } from './types'

export const EMPTY_FORM: TForm = {
  name: '',
  description: '',
  config: '{\n  "single": 5,\n  "multi": 3,\n  "scorePerQuestion": 5\n}',
}

export function templateToForm(t: {
  name: string
  description: string | null
  config: unknown
}): TForm {
  return {
    name: t.name,
    description: t.description ?? '',
    config: t.config ? JSON.stringify(t.config, null, 2) : EMPTY_FORM.config,
  }
}
