import type { Template, TForm } from './types'

export const PAGE_SIZE = 10

export const EMPTY: TForm = {
  name: '',
  description: '',
  awardingOrganization: '',
  awarderName: '',
  awardConditions: '',
  validityPolicy: 'permanent',
  backgroundImage: '',
  templateConfig: '',
  status: true,
}

export function templateToForm(t: Template): TForm {
  return {
    name: t.name,
    description: t.description ?? '',
    awardingOrganization: t.awardingOrganization ?? '',
    awarderName: t.awarderName ?? '',
    awardConditions: t.awardConditions ?? '',
    validityPolicy: t.validityPolicy ?? 'permanent',
    backgroundImage: t.backgroundImage ?? '',
    templateConfig: t.templateConfig ? JSON.stringify(t.templateConfig, null, 2) : '',
    status: t.status === 1,
  }
}
