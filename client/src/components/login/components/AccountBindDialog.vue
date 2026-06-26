<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="450px" :close-on-click-modal="false"
    :close-on-press-escape="true" :center="true" :modal="true" append-to-body class="account-bind-dialog"
    @close="handleClose">
    <el-form :model="bindForm" :rules="bindFormRules" ref="bindFormRef" label-width="80px" class="bind-form">
      <el-form-item :label="t('settings.labels.email')" prop="email">
        <el-input id="bind-email" name="bind-email" v-model="bindForm.email" :placeholder="t('auth.emailPlaceholder')"
          clearable />
      </el-form-item>
      <el-form-item :label="t('auth.usernameLabel')" prop="username">
        <el-input id="bind-username" name="bind-username" v-model="bindForm.username" :placeholder="usernamePlaceholder"
          clearable />
      </el-form-item>
      <el-form-item :label="t('auth.passwordLabel')" prop="password">
        <el-input id="bind-password" name="bind-password" v-model="bindForm.password"
          :type="passwordVisible ? 'text' : 'password'" :placeholder="isPasswordDisabled ? '' : passwordPlaceholder" maxlength="20"
          :clearable="!isPasswordDisabled" :disabled="isPasswordDisabled"
          @keyup.enter="handleConfirm">
          <template v-if="!isPasswordDisabled" #suffix>
            <label class="password-eye-container" :aria-label="passwordVisible ? t('login.password.hide') : t('login.password.show')" @click.stop>
              <input type="checkbox" :checked="passwordVisible" @change="togglePasswordVisible" />
              <svg class="eye" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512">
                <path
                  d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z">
                </path>
              </svg>
              <svg class="eye-slash" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 640 512">
                <path
                  d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z">
                </path>
              </svg>
            </label>
          </template>
        </el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="loading">
          {{ confirmButtonText }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import { FormValidator } from '@/utils/formValidation'
import { InputValidator } from '@/utils/security'
import { setEmail, setPwd } from '@/api/user/user'

// needPwd 为 0 时使用的占位密码（仅展示，不可编辑）
const DEFAULT_PASSWORD_PLACEHOLDER = '********'

// Props
interface Props {
  modelValue: boolean
  isRegisterMode?: boolean
  loading?: boolean
  uuid?: string
  /** 接口返回的 needPwd：1=需补填密码可编辑，0=已有密码则密码框默认占位并置灰 */
  needPwd?: number
  initialData?: {
    email?: string
    username?: string
    password?: string
    /** 与 needPwd 一致，打开弹窗时由父组件写入，用于禁用密码框 */
    needPwd?: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  isRegisterMode: false,
  loading: false,
  uuid: '',
  needPwd: 1,
  initialData: () => ({})
})

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', data: { email: string; username: string; password: string }): void
  (e: 'cancel'): void
}>()

// i18n
const { t } = useI18n()
const route = useRoute()

// Refs
const bindFormRef = ref<FormInstance | undefined>(undefined)
const passwordVisible = ref(false)

// 双向绑定 visible
const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

// 表单数据
const bindForm = reactive({
  email: '',
  username: '',
  password: '',
})

// 计算属性
const dialogTitle = computed(() => {
  return props.isRegisterMode
    ? t('auth.accountBindRegisterTitle')
    : t('auth.accountBindLoginTitle')
})

const usernamePlaceholder = computed(() => {
  return props.isRegisterMode
    ? t('register.placeholders.username')
    : t('auth.usernamePlaceholder')
})

const passwordPlaceholder = computed(() => {
  return props.isRegisterMode
    ? t('register.placeholders.password')
    : t('auth.passwordHint')
})

const confirmButtonText = computed(() => {
  return t('auth.bind')
})

// 当前是否不需要补填密码（0=已有密码，密码框置灰；1=需补填）
const needPwdValue = computed(() => Number(props.initialData?.needPwd ?? props.needPwd ?? 1))
const isPasswordDisabled = computed(() => needPwdValue.value === 0)

// 表单验证规则
const bindFormRules = reactive({
  email: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        // XSS检查
        if (FormValidator.containsXSS(value)) {
          callback(new Error(t('auth.validation.unsafeChars')))
          return
        }
        // 邮箱格式验证
        if (!InputValidator.isValidEmail(value)) {
          callback(new Error(t('auth.validation.invalidEmail')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  username: [
    { required: true, message: t('auth.usernameOrPhoneOrEmail'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        // XSS检查
        if (FormValidator.containsXSS(value)) {
          callback(new Error(t('auth.validation.unsafeChars')))
          return
        }
        // 清理输入
        const sanitized = FormValidator.sanitizeInput(value)
        if (sanitized !== value) {
          bindForm.username = sanitized
        }
        // 格式验证：用户名、手机号或邮箱
        const isUsername = /^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$/.test(value)
        const isPhone = InputValidator.isValidPhone(value)
        const isEmail = InputValidator.isValidEmail(value)
        if (!isUsername && !isPhone && !isEmail) {
          callback(new Error(t('auth.validation.invalidUsernameOrPhoneOrEmail')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  password: [
    { required: true, message: t('auth.validation.passwordRequired'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        // XSS检查
        if (FormValidator.containsXSS(value)) {
          callback(new Error(t('auth.validation.passwordUnsafeChars')))
          return
        }

        // 获取当前登录来源
        const currentSource = route.query.source as string
        const isCrossProjectLogin =
          currentSource && currentSource !== 'main' && currentSource !== 'user'

        // 跨项目登录时使用宽松的密码验证
        if (isCrossProjectLogin) {
          // 跨项目登录：只做基本长度检查
          if (value.length < 1) {
            callback(new Error(t('auth.validation.passwordRequired')))
            return
          }
          callback()
          return
        }

        // 官网登录：严格的密码验证
        // 长度检查
        if (value.length < 8) {
          callback(new Error(t('auth.validation.passwordMinLength')))
          return
        }
        if (value.length > 20) {
          callback(new Error(t('auth.validation.passwordMaxLength')))
          return
        }
        // 密码强度检查 - 必须包含字母、数字和特殊符号
        const hasLetter = /[a-zA-Z]/.test(value)
        const hasNumber = /\d/.test(value)
        const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)

        if (!hasLetter) {
          callback(new Error(t('auth.validation.passwordRequireLetter')))
          return
        }
        if (!hasNumber) {
          callback(new Error(t('auth.validation.passwordRequireNumber')))
          return
        }
        if (!hasSpecialChar) {
          callback(new Error(t('auth.validation.passwordRequireSpecial')))
          return
        }

        // 额外的密码强度检查
        const strengthResult = InputValidator.validatePasswordStrength(value)
        if (!strengthResult.valid) {
          callback(new Error(t('auth.passwordStrengthInsufficient')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
})

// 切换密码可见性
const togglePasswordVisible = () => {
  passwordVisible.value = !passwordVisible.value
}

// 处理确认
const handleConfirm = async (): Promise<void> => {
  if (!bindFormRef.value) return

  const uuid = (props.uuid || '').trim()
  const username = bindForm.username.trim()
  const password = bindForm.password
  const email = bindForm.email.trim()
  const initialEmail = (props.initialData?.email || '').trim()
  const needPwd = needPwdValue.value

  // needPwd 为 0 时只校验邮箱和账号，不校验、不提交密码
  if (needPwd === 0) {
    try {
      await bindFormRef.value.validateField(['email', 'username'])
    } catch {
      return
    }
  } else {
    try {
      await bindFormRef.value.validate()
    } catch {
      return
    }
  }

  // 1) 邮箱：只有当用户输入了邮箱且与当前邮箱不同，才调用 setEmail
  if (email) {
    if (!InputValidator.isValidEmail(email)) {
      ElMessage.error(t('auth.validation.invalidEmail'))
      return
    }
    if (email !== initialEmail) {
      try {
        await setEmail({ uuid, email })
        ElMessage.success(t('msg.account_bind_dialog.邮箱设置成功'))
      } catch {
        ElMessage.error(t('msg.account_bind_dialog.邮箱设置失败1'))
        return
      }
    }
  }

  // 2) 密码：仅 needPwd===1 时调用“密码绑定/设置”接口
  if (needPwd === 1) {
    if (!InputValidator.isValidPhone(username)) {
      ElMessage.error(t('auth.phoneFormatIncorrect'))
      return
    }
    try {
      await setPwd({ phone: username, password, uuid: uuid || undefined })
      ElMessage.success(t('msg.account_bind_dialog.密码设置成功2'))
    } catch {
      ElMessage.error(t('msg.account_bind_dialog.密码设置失败3'))
      return
    }
  }

  // 成功后通知外部，并关闭弹窗
  emit('confirm', { email, username, password: needPwd === 1 ? password : '' })
  visible.value = false
}

// 处理取消
const handleCancel = () => {
  visible.value = false
  emit('cancel')
}

// 处理关闭
const handleClose = () => {
  bindForm.email = ''
  bindForm.username = ''
  bindForm.password = ''
  passwordVisible.value = false
  if (bindFormRef.value) {
    bindFormRef.value.clearValidate()
  }
  emit('cancel')
}

// 监听 modelValue 变化，初始化表单数据
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    // 弹窗打开时，使用初始数据填充表单
    bindForm.email = props.initialData?.email || ''
    bindForm.username = props.initialData?.username || ''
    if (needPwdValue.value === 0) {
      bindForm.password = DEFAULT_PASSWORD_PLACEHOLDER
    } else {
      bindForm.password = props.initialData?.password || ''
    }
    passwordVisible.value = false

    // 清除验证状态
    nextTick(() => {
      if (bindFormRef.value) {
        bindFormRef.value.clearValidate()
      }
    })
  }
})

// 暴露方法供外部调用
defineExpose({
  resetForm: () => {
    bindForm.email = ''
    bindForm.username = ''
    bindForm.password = ''
    passwordVisible.value = false
    if (bindFormRef.value) {
      bindFormRef.value.clearValidate()
    }
  },
  setFormData: (data: { email?: string; username?: string; password?: string }) => {
    if (data.email !== undefined) bindForm.email = data.email
    if (data.username !== undefined) bindForm.username = data.username
    if (data.password !== undefined) bindForm.password = data.password
  }
})
</script>

<style scoped>
/* ============================================
 * AccountBindDialog CSS 变量定义
 * 使用 --abd- 前缀避免冲突
 * ============================================ */
.account-bind-dialog {
  /* 对话框位置变量 */
  --abd-close-btn-top: 20px;
  --abd-close-btn-right: 20px;
  --abd-close-btn-z-index: var(--z-popover);
  
  /* 对话框样式变量 */
  --abd-dialog-z-index: var(--z-modal);
  --abd-dialog-radius: 8px;
  --abd-dialog-shadow: var(--global-box-shadow);
  
  /* 遮罩层变量 */
  --abd-overlay-z-index: var(--z-modal);
  --abd-overlay-bg: var(--color-black-50);
  --abd-overlay-blur: 2px;
  
  /* 输入框变量 - 仅用普通边框 */
  --abd-input-bg: var(--el-fill-color-blank);
  
  /* 密码眼睛图标变量 */
  --abd-eye-size: 22px;
  --abd-eye-color: var(--el-text-color-placeholder);
  
  /* Footer 变量 */
  --abd-footer-gap: 12px;
}

/* 确保对话框在屏幕中心显示 */
.account-bind-dialog :deep(.el-dialog) {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  z-index: var(--abd-dialog-z-index);
  border-radius: var(--abd-dialog-radius);
  box-shadow: var(--abd-dialog-shadow);
}

/* 遮罩层样式 - 弱化其他区域 */
.account-bind-dialog :deep(.el-overlay) {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--abd-overlay-bg);
  z-index: var(--abd-overlay-z-index);
  backdrop-filter: blur(var(--abd-overlay-blur));
  -webkit-backdrop-filter: blur(var(--abd-overlay-blur));
}

/* 账号绑定对话框 - 适配明暗模式 */
.account-bind-dialog :deep(.el-dialog__header) {
  color: var(--el-text-color-primary);
}

.account-bind-dialog :deep(.el-dialog__title) {
  color: var(--el-text-color-primary);
}

.account-bind-dialog :deep(.el-dialog__body) {
  color: var(--el-text-color-primary);
}

.account-bind-dialog :deep(.el-form-item__label) {
  color: var(--el-text-color-regular);
}

.account-bind-dialog :deep(.el-input__wrapper) {
  background-color: var(--abd-input-bg);
  border: var(--unified-border);
  box-shadow: none;
}

.account-bind-dialog :deep(.el-input__wrapper:hover) {
  border-color: var(--border-unified-color-hover);
}

.account-bind-dialog :deep(.el-input__wrapper.is-focus) {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

.account-bind-dialog :deep(.el-input__inner) {
  color: var(--el-text-color-primary);
  background-color: transparent;
}

.account-bind-dialog :deep(.el-input__inner::placeholder) {
  color: var(--el-text-color-placeholder);
}

.account-bind-dialog :deep(.el-input__prefix) {
  color: var(--el-text-color-regular);
}

.account-bind-dialog :deep(.el-input__suffix) {
  color: var(--el-text-color-regular);
}

/* 密码显示/隐藏眼睛图标 - 使用 :deep() 穿透到 el-input 内部 */
.bind-form :deep(.password-eye-container) {
  /* 使用组件级变量 */
  --color: var(--abd-eye-color);
  --size: var(--abd-eye-size);
  
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  cursor: pointer;
  font-size: var(--size);
  user-select: none;
  fill: var(--color);
  width: var(--size);
  height: var(--size);
  min-width: var(--size);
  min-height: var(--size);
  max-width: var(--size);
  max-height: var(--size);
  background: transparent;
  background-color: transparent;
  border: none;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.bind-form :deep(.password-eye-container .eye) {
  position: absolute;
  width: 100%;
  height: 100%;
  animation: keyframes-fill .5s;
}

.bind-form :deep(.password-eye-container .eye-slash) {
  position: absolute;
  width: 100%;
  height: 100%;
  animation: keyframes-fill .5s;
  display: none;
}

/* ------ On check event ------ */
.bind-form :deep(.password-eye-container input:checked ~ .eye) {
  display: none;
}

.bind-form :deep(.password-eye-container input:checked ~ .eye-slash) {
  display: block;
}

/* ------ Hide the default checkbox ------ */
.bind-form :deep(.password-eye-container input) {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.account-bind-dialog :deep(.dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: var(--abd-footer-gap);
}

/* ------ Animation ------ */
@keyframes keyframes-fill {
  0% {
    transform: scale(0);
    opacity: 0;
  }

  50% {
    transform: scale(1.2);
  }
}
</style>
