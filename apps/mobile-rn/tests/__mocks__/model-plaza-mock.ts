/**
 * ModelPlazaScreen placeholder mock
 */
import { createElement } from 'react'

export function ModelPlazaScreen(_props: { items?: Array<Record<string, unknown>> }) {
  return createElement('div', { 'data-testid': 'model-plaza-screen' }, null)
}

export type ModelPlazaItem = Record<string, unknown>
export type ModelPlazaProvider = Record<string, unknown>
export type ModelPlazaScreenProps = Record<string, unknown>
