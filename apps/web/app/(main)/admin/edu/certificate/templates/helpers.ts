import type { Template, TForm } from './types'

export const PAGE_SIZE = 10

export const EMPTY: TForm = {
  name: '',
  description: '',
  awardingOrganization: '',
  awarderName: '',
  awardConditions: '',
  validityPolicy: 'permanent',
  validDays: '365',
  validFrom: '',
  validTo: '',
  backgroundImage: '',
  templateConfig: '',
  status: true,
}

export function parseValidityPolicy(raw: string | null): {
  mode: string
  validDays: string
  validFrom: string
  validTo: string
} {
  const v = raw ?? 'permanent'
  if (v.startsWith('custom_days:')) {
    return {
      mode: 'custom_days',
      validDays: v.slice('custom_days:'.length),
      validFrom: '',
      validTo: '',
    }
  }
  if (v.startsWith('date_range:')) {
    const rest = v.slice('date_range:'.length)
    const [from, to] = rest.split('~')
    return { mode: 'date_range', validDays: '365', validFrom: from ?? '', validTo: to ?? '' }
  }
  return { mode: v, validDays: '365', validFrom: '', validTo: '' }
}

export function encodeValidityPolicy(form: TForm): string {
  if (form.validityPolicy === 'custom_days') {
    return `custom_days:${form.validDays || '365'}`
  }
  if (form.validityPolicy === 'date_range') {
    return `date_range:${form.validFrom}~${form.validTo}`
  }
  return form.validityPolicy
}

export function templateToForm(t: Template): TForm {
  const parsed = parseValidityPolicy(t.validityPolicy)
  return {
    name: t.name,
    description: t.description ?? '',
    awardingOrganization: t.awardingOrganization ?? '',
    awarderName: t.awarderName ?? '',
    awardConditions: t.awardConditions ?? '',
    validityPolicy: parsed.mode,
    validDays: parsed.validDays,
    validFrom: parsed.validFrom,
    validTo: parsed.validTo,
    backgroundImage: t.backgroundImage ?? '',
    templateConfig: t.templateConfig ? JSON.stringify(t.templateConfig, null, 2) : '',
    status: t.status === 1,
  }
}
