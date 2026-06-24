/**
 * Settings 用户信息管理 Composable
 *
 * 负责用户信息的加载、更新和头像上传
 *
 * @packageDocumentation
 */

import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { updateUserInfo, uploadAvatar } from '@/api/user'

/**
 * 用户信息接口
 */
export interface UserInfo {
  avatar: string
  nickname: string
  email: string
  phone: string
}

/**
 * useSettingsUserInfo 配置选项
 */
export interface UseSettingsUserInfoOptions {
  /** 默认头像 URL */
  defaultAvatar?: string
  /** 用户信息更新成功后回调 */
  onUpdateSuccess?: () => void
}

/**
 * Settings 用户信息管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回用户信息状态和方法
 */
export function useSettingsUserInfo(options: UseSettingsUserInfoOptions = {}) {
  const { defaultAvatar = '', onUpdateSuccess } = options
  const { t } = useI18n()
  const { handleResult } = useOperationFeedback()

  // 用户信息
  const userInfo = reactive<UserInfo>({
    avatar: '',
    nickname: '',
    email: '',
    phone: '',
  })

  // 头像输入引用
  const avatarInput = ref<HTMLInputElement | null>(null)

  /**
   * 加载用户信息
   */
  const loadUserInfo = (data: Partial<UserInfo>): void => {
    if (data.avatar) userInfo.avatar = data.avatar
    if (data.nickname) userInfo.nickname = data.nickname
    if (data.email) userInfo.email = data.email
    if (data.phone) userInfo.phone = data.phone
  }

  /**
   * 更新用户信息
   */
  const updateUserInfoData = async (): Promise<void> => {
    await handleResult(updateUserInfo(userInfo), {
      successMessage: t('user.messages.settings.profileUpdateSuccess'),
      errorMessage: t('user.messages.settings.profileUpdateFailed'),
      onSuccess: () => {
        if (onUpdateSuccess) {
          onUpdateSuccess()
        }
      },
    })
  }

  /**
   * 触发头像上传
   */
  const triggerAvatarUpload = (): void => {
    if (avatarInput.value) {
      avatarInput.value.click()
    } else {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      if (input) {
        input.click()
      }
    }
  }

  /**
   * 处理头像上传
   */
  const handleAvatarChange = async (event: Event): Promise<void> => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    // 验证文件类型和大小
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      void handleResult(Promise.reject(new Error(t('user.messages.settings.imageFormatError'))), {
        errorMessage: t('user.messages.settings.imageFormatError'),
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      void handleResult(Promise.reject(new Error(t('user.messages.settings.imageSizeError'))), {
        errorMessage: t('user.messages.settings.imageSizeError'),
      })
      return
    }

    await handleResult(uploadAvatar(file), {
      successMessage: t('user.messages.settings.avatarUploadSuccess'),
      errorMessage: t('user.messages.settings.avatarUploadFailed'),
      onSuccess: (response: any) => {
        const res = response as { code?: number | string; data?: { url?: string } }
        const codeNum = typeof res.code === 'string' ? parseInt(res.code, 10) : res.code
        if (codeNum === 0 && res.data?.url) {
          userInfo.avatar = res.data.url
        }
      },
      onError: (error: any) => {
        // 类型断言处理错误对象
        const errorObj = error as { response?: { status?: number } }
        if (errorObj.response?.status === 413) {
          void handleResult(Promise.reject(new Error(t('user.messages.settings.imageTooLarge'))), {
            errorMessage: t('user.messages.settings.imageTooLarge'),
          })
        } else if (errorObj.response?.status === 415) {
          void handleResult(
            Promise.reject(new Error(t('user.messages.settings.unsupportedImageFormat'))),
            {
              errorMessage: t('user.messages.settings.unsupportedImageFormat'),
            }
          )
        }
      },
    })
  }

  return {
    // 状态
    userInfo,
    avatarInput,
    defaultAvatar,

    // 方法
    loadUserInfo,
    updateUserInfoData,
    triggerAvatarUpload,
    handleAvatarChange,
  }
}
