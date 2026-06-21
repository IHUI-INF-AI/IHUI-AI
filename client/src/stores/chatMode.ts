import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { StorageManager } from '@/utils/storage'

const STORAGE_KEY = 'chat_mode_state'

export type ChatMode = 'global' | 'dialog' | 'agent'

export const useChatModeStore = defineStore(
  'chatMode',
  () => {
    const savedState = StorageManager.getItem<{ mode: ChatMode; showModeSwitcher: boolean }>(STORAGE_KEY)

    const mode = ref<ChatMode>(savedState?.mode || 'dialog')
    const showModeSwitcher = ref(savedState?.showModeSwitcher ?? true)

    const setMode = (newMode: ChatMode) => {
      mode.value = newMode
    }

    const toggleMode = () => {
      const modes: ChatMode[] = ['global', 'dialog', 'agent']
      const currentIndex = modes.indexOf(mode.value)
      const nextIndex = (currentIndex + 1) % modes.length
      mode.value = modes[nextIndex]
    }

    const setShowModeSwitcher = (show: boolean) => {
      showModeSwitcher.value = show
    }

    watch([mode, showModeSwitcher], ([newMode, newShow]) => {
      StorageManager.setItem(STORAGE_KEY, { mode: newMode, showModeSwitcher: newShow })
    })

    return {
      mode,
      showModeSwitcher,
      setMode,
      toggleMode,
      setShowModeSwitcher,
    }
  }
)
