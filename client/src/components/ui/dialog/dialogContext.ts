import type { InjectionKey, Ref } from 'vue'

export interface DialogContext {
  isOpen: Ref<boolean>
  closeDialog: () => void
}

export const DIALOG_KEY: InjectionKey<DialogContext> = Symbol('dialog')
