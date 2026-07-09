import type { InjectionKey, ComputedRef } from 'vue'

export interface SelectContext {
  modelValue: ComputedRef<any>
  multiple: boolean
  selectOption: (value: any, label: string) => void
  close: () => void
}

export const SELECT_KEY: InjectionKey<SelectContext> = Symbol('SELECT_KEY')
