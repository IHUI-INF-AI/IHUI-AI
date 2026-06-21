/**
 * 用户个人信息 Composable
 * 提取自 User.vue，用于管理用户个人信息相关逻辑
 */

import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { updateUserInfo, sendVerificationCode, type UserInfoData } from '@/api/user'
import { FormValidator } from '@/utils/formValidation'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useApiError } from '@/composables/useApiError'
import { logger } from '@/utils/logger'
import type { FormInstance } from 'element-plus'

export interface ProfileForm {
  uuid: string
  nickname: string
  email: string
  phone: string
  signature: string
  gender: number
  birthday: string
}

export function useUserProfile() {
  const { t } = useI18n()
  const authStore = useAuthStore()
  const { handleResult: handleOperationResult } = useOperationFeedback()
  const { handleError } = useApiError()

  // 表单引用
  const profileFormRef = ref<FormInstance | undefined>(undefined)

  // 表单数据
  const profileForm = reactive<ProfileForm>({
    uuid: '',
    nickname: '',
    email: '',
    phone: '',
    signature: '',
    gender: 0,
    birthday: '',
  })

  // 独立的 gender ref，用于确保 el-radio-group 的 v-model 正常工作
  // 初始值必须是数字 0（保密），确保与 el-radio 的 :value 类型匹配
  const genderRef = ref<number>(0)

  // 确保 genderRef 始终是有效的数字值
  const ensureValidGender = (value: any): number => {
    if (typeof value === 'number' && [0, 1, 2].includes(value)) {
      return value
    }
    if (typeof value === 'string') {
      const num = parseInt(value, 10)
      if ([0, 1, 2].includes(num)) {
        return num
      }
    }
    return 0 // 默认保密
  }

  // 保存状态
  const profileSaving = ref(false)

  // 验证状态
  const emailVerified = ref(false)
  const phoneVerified = ref(false)

  // 表单验证规则
  const profileRules = computed(() => ({
    nickname: [
      { required: true, message: t('user.validation.nickname'), trigger: 'blur' },
      { min: 2, max: 20, message: t('user.validation.nicknameLength'), trigger: 'blur' },
    ],
    email: [{ type: 'email', message: t('user.validation.email'), trigger: 'blur' }],
    phone: [{ pattern: /^1[3-9]\d{9}$/, message: t('user.validation.phone'), trigger: 'blur' }],
    signature: [{ max: 100, message: t('user.validation.signatureLength'), trigger: 'blur' }],
  }))

  // 初始化表单
  const initProfileForm = (): void => {
    const user = authStore.user as UserInfoData | null
    if (user) {
      // uuid 优先使用 uuid 字段，如果没有则回退到 id 字段，最后尝试手机号
      profileForm.uuid = user.uuid || user.id || user.phone || '暂无'
      profileForm.nickname = user.nickname || ''
      profileForm.email = user.email || ''
      profileForm.phone = user.phone || ''
      profileForm.signature = user.signature || ''
      // 确保 gender 是有效的数字类型（0=保密, 1=男, 2=女）
      const validGender = ensureValidGender(user.gender)
      profileForm.gender = validGender
      genderRef.value = validGender // 同步更新独立的 ref
      logger.debug('[UserProfile] Gender initialized to:', validGender)
      profileForm.birthday = user.birthday || ''
      emailVerified.value = !!user.email
      phoneVerified.value = !!user.phone
    }
  }

  // 监听 authStore.user 变化，当用户数据更新时自动重新初始化表单
  // 这确保了当 fetchUserInfo 在后台完成时，表单能够更新为最新数据
  // 使用 immediate: true 确保首次也会执行，deep: true 监听深层变化
  watch(
    () => authStore.user as UserInfoData | null,
    (newUser: UserInfoData | null, oldUser: UserInfoData | null | undefined) => {
      if (newUser) {
        // 检查是否有实际数据变化（避免重复初始化）
        // 修复：当表单为空但 store 有数据时，也需要更新表单
        const hasNewData = newUser.nickname !== oldUser?.nickname ||
                          newUser.email !== oldUser?.email ||
                          newUser.phone !== oldUser?.phone ||
                          newUser.signature !== oldUser?.signature ||
                          newUser.gender !== oldUser?.gender ||
                          newUser.birthday !== oldUser?.birthday
        
        // 如果有新数据，或者表单 nickname 为空但 store 有值，则更新表单
        const formIsEmpty = !profileForm.nickname && !profileForm.email
        const storeHasData = !!newUser.nickname || !!newUser.email
        
        if (hasNewData || (formIsEmpty && storeHasData)) {
          logger.debug('[UserProfile] Detected user data change, updating form:', {
            newNickname: newUser.nickname,
            newEmail: newUser.email,
            formNickname: profileForm.nickname,
          })
          initProfileForm()
        }
      }
    },
    { deep: true, immediate: true }
  )

  // 保存个人信息
  const handleSaveProfile = async (): Promise<void> => {
    if (!profileFormRef.value) return

    try {
      await profileFormRef.value.validate(undefined)
      profileSaving.value = true

      // 清理输入 - 使用 genderRef 的值确保获取最新的性别选择
      const sanitizedData = {
        nickname: FormValidator.sanitizeInput(profileForm.nickname),
        email: profileForm.email ? FormValidator.sanitizeInput(profileForm.email) : '',
        phone: profileForm.phone ? FormValidator.sanitizeInput(profileForm.phone) : '',
        signature: profileForm.signature ? FormValidator.sanitizeInput(profileForm.signature) : '',
        gender: genderRef.value,
        birthday: profileForm.birthday || '',
      }

      const result = await handleOperationResult<UserInfoData>(updateUserInfo(sanitizedData), {
        successMessage: t('user.messages.saveSuccess'),
      })

      if (result) {
        // 更新 store
        const store = authStore as ReturnType<typeof useAuthStore> & {
          updateUserInfo: (userInfo: Partial<UserInfoData>) => void
        }
        store.updateUserInfo({
          nickname: result.nickname || profileForm.nickname,
          email: result.email || profileForm.email,
          phone: result.phone || profileForm.phone,
          signature: result.signature || profileForm.signature,
          gender: result.gender !== undefined ? result.gender : profileForm.gender,
          birthday: result.birthday || profileForm.birthday,
          avatar: result.avatar || (authStore.user as UserInfoData | null)?.avatar,
        })
      }
    } catch (error: any) {
      handleError(error, { customMessage: t('user.messages.saveFailedRetry') })
    } finally {
      profileSaving.value = false
    }
  }

  // 重置表单
  const handleResetProfile = (): void => {
    initProfileForm()
  }

  // 验证邮箱（发送验证码）
  const handleVerifyEmail = async (): Promise<void> => {
    try {
      const email = profileForm.email || (authStore.user as UserInfoData | null)?.email || ''
      if (!email) {
        handleError(new Error(t('user.validation.emailRequired')), {
          customMessage: t('user.messages.emailRequired'),
        })
        return
      }
      await handleOperationResult(sendVerificationCode({ type: 'email', target: email }), {
        successMessage: t('user.messages.emailVerificationSent'),
        onSuccess: () => {
          // 注意：这里只是发送了验证码，实际验证需要用户输入验证码
          // emailVerified 应该在用户输入验证码并验证成功后设置为 true
        },
      })
    } catch (error: any) {
      handleError(error)
    }
  }

  // 验证手机（发送验证码）
  const handleVerifyPhone = async (): Promise<void> => {
    try {
      const phone = profileForm.phone || (authStore.user as UserInfoData | null)?.phone || ''
      if (!phone) {
        handleError(new Error(t('user.validation.phoneRequired')), {
          customMessage: t('user.messages.phoneRequired'),
        })
        return
      }
      await handleOperationResult(sendVerificationCode({ type: 'phone', target: phone }), {
        successMessage: t('user.messages.phoneVerificationSent'),
        onSuccess: () => {
          // 注意：这里只是发送了验证码，实际验证需要用户输入验证码
          // phoneVerified 应该在用户输入验证码并验证成功后设置为 true
        },
      })
    } catch (error: any) {
      handleError(error)
    }
  }

  return {
    // 表单引用
    profileFormRef,
    // 表单数据
    profileForm,
    // 独立的 gender ref（用于 el-radio-group 的 v-model）
    genderRef,
    // 状态
    profileSaving,
    emailVerified,
    phoneVerified,
    // 验证规则
    profileRules,
    // 方法
    initProfileForm,
    handleSaveProfile,
    handleResetProfile,
    handleVerifyEmail,
    handleVerifyPhone,
  }
}
