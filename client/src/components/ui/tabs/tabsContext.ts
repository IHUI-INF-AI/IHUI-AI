import type { InjectionKey, Ref } from 'vue'

export interface TabsContext {
  activeTab: Ref<string>
  setActiveTab: (value: string) => void
}

export const TABS_KEY: InjectionKey<TabsContext> = Symbol('tabs')
