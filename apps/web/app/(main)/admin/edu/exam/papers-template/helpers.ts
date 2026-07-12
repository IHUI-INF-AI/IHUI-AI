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
