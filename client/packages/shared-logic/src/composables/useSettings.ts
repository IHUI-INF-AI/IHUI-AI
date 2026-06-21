import { ref, watch } from 'vue'
import { getStorage, setStorage } from '../utils/index'

export interface Settings {
  notifications: boolean
  messagePreview: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
  darkMode: boolean
  fontSize: 'small' | 'default' | 'large'
  language: 'zh-CN' | 'en'
  privacyShowOnline: boolean
  privacyShowReading: boolean
  autoPlayVideo: boolean
  [key: string]: any
}

const SETTINGS_KEY = 'app_settings'

const defaultSettings: Settings = {
  notifications: true,
  messagePreview: true,
  soundEnabled: true,
  vibrationEnabled: true,
  darkMode: false,
  fontSize: 'default',
  language: 'zh-CN',
  privacyShowOnline: true,
  privacyShowReading: true,
  autoPlayVideo: true,
}

function loadSettings(): Settings {
  const raw = getStorage(SETTINGS_KEY)
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return { ...defaultSettings, ...parsed }
    } catch {
      return { ...defaultSettings }
    }
  }
  return { ...defaultSettings }
}

const settings = ref<Settings>(loadSettings())

export function useSettings() {
  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    settings.value[key] = value
    save()
  }

  function updateSettings(partial: Partial<Settings>) {
    settings.value = { ...settings.value, ...partial }
    save()
  }

  function resetSettings() {
    settings.value = { ...defaultSettings }
    save()
  }

  function save() {
    setStorage(SETTINGS_KEY, JSON.stringify(settings.value))
  }

  function getSetting<K extends keyof Settings>(key: K): Settings[K] {
    return settings.value[key]
  }

  watch(settings, () => {
    save()
  }, { deep: true })

  return {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    getSetting,
  }
}
