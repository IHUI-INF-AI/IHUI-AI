import { reactive, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useDarkModeStore } from '@/stores/darkMode'
import { updatePreferences } from '@/api/system/settings'
import { switchLanguage } from '@/composables/useLang'

/**
 * 应用设置接口
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  autoSave: boolean
  mouseFollower: boolean
}

/**
 * useSettingsApp 配置选项
 */
export interface UseSettingsAppOptions {
  /** 应用设置更新成功后回调 */
  onUpdateSuccess?: () => void
}

/**
 * Settings 应用设置管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回应用设置状态和方法
 */
export function useSettingsApp(options: UseSettingsAppOptions = {}) {
  const { onUpdateSuccess } = options
  const { t } = useI18n()
  const { handleResult } = useOperationFeedback()
  const darkModeStore = useDarkModeStore()

  // 使用 useLocalStorage 管理鼠标跟随效果设置
  const mouseFollowerEnabled = useLocalStorage<boolean>('mouseFollowerEnabled', true)

  // 应用设置
  const appSettings = reactive<AppSettings>({
    theme: 'light',
    language: 'zh-CN',
    autoSave: true,
    mouseFollower: mouseFollowerEnabled.value,
  })

  // 同步 mouseFollowerEnabled 到 appSettings
  watch(
    mouseFollowerEnabled,
    newValue => {
      appSettings.mouseFollower = newValue
    },
    { immediate: true }
  )

  // 同步 appSettings.mouseFollower 到 mouseFollowerEnabled
  watch(
    () => appSettings.mouseFollower,
    newValue => {
      mouseFollowerEnabled.value = newValue
    }
  )

  /**
   * 加载应用设置
   */
  const loadAppSettings = (data: Partial<AppSettings>): void => {
    if (data.theme) appSettings.theme = data.theme
    if (data.language) appSettings.language = data.language
    if (typeof data.autoSave === 'boolean') appSettings.autoSave = data.autoSave
    if (typeof data.mouseFollower === 'boolean') {
      appSettings.mouseFollower = data.mouseFollower
    }
  }

  /**
   * 更新应用设置
   */
  const updateAppSettingsData = async (): Promise<void> => {
    await handleResult(
      updatePreferences({
        theme: appSettings.theme as 'light' | 'dark' | 'auto',
        language: appSettings.language,
        autoSave: appSettings.autoSave,
      }),
      {
        successMessage: t('user.messages.settings.appSettingsUpdateSuccess'),
        errorMessage: t('user.messages.settings.appSettingsUpdateFailed'),
        onSuccess: () => {
          // watch 会自动同步 appSettings.mouseFollower 到 mouseFollowerEnabled
          // useLocalStorage 会自动保存到 localStorage

          // 切换界面语言
          switchLanguage(appSettings.language as 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko')

          // 应用主题设置（统一使用 html.dark 机制）
          if (appSettings.theme === 'dark') {
            if (!darkModeStore.isDarkMode.value) darkModeStore.toggleDarkMode()
          } else if (appSettings.theme === 'light') {
            if (darkModeStore.isDarkMode.value) darkModeStore.toggleDarkMode()
          } else {
            const prefersDark =
              window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            const shouldDark = prefersDark
            const isDark = !!darkModeStore.isDarkMode.value
            if (shouldDark !== isDark) darkModeStore.toggleDarkMode()
          }

          if (onUpdateSuccess) {
            onUpdateSuccess()
          }
        },
      }
    )
  }

  return {
    // 状态
    appSettings,
    mouseFollowerEnabled,

    // 方法
    loadAppSettings,
    updateAppSettingsData,
  }
}
