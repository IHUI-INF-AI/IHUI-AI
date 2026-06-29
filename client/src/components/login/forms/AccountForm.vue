<template>
  <div class="account-form-container">
    <el-form
      :model="formData"
      :rules="formRules"
      ref="formRef"
      class="login-form"
      @submit.prevent="handleSubmit"
    >
      <!-- 用户名/邮箱输入 -->
      <el-form-item prop="username">
        <el-input
          v-model="formData.username"
          :placeholder="
            isRegisterMode
              ? t('login.placeholders.username')
              : t('login.placeholders.usernameOrEmail')
          "
          size="large"
          clearable
          @keyup.enter="handleSubmit"
        >
          <template #prefix>
            <el-icon class="input-icon"><User /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <!-- 邮箱输入（仅注册模式） -->
      <el-form-item v-if="isRegisterMode" prop="email">
        <el-input
          v-model="formData.email"
          :placeholder="t('login.placeholders.email')"
          size="large"
          clearable
          @keyup.enter="handleSubmit"
        >
          <template #prefix>
            <el-icon class="input-icon"><Message /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <!-- 密码输入 -->
      <el-form-item prop="password">
        <el-input
          v-model="formData.password"
          :type="passwordVisible ? 'text' : 'password'"
          :placeholder="
            isRegisterMode ? t('login.placeholders.setPassword') : t('login.placeholders.password')
          "
          size="large"
          clearable
          @input="handlePasswordInput"
          @keyup.enter="handleSubmit"
        >
          <template #prefix>
            <el-icon class="input-icon"><Lock /></el-icon>
          </template>
          <template #suffix>
            <div
              class="password-toggle-icon"
              @click.stop="togglePasswordVisibility"
              :title="passwordVisible ? t('login.password.hide') : t('login.password.show')"
            >
              <el-icon>
                <component :is="passwordVisible ? 'Hide' : 'View'" />
              </el-icon>
            </div>
          </template>
        </el-input>

        <!-- 密码强度指示器 -->
        <PasswordStrengthIndicator
          v-if="isRegisterMode && formData.password"
          :password="formData.password"
        />
      </el-form-item>

      <!-- 确认密码（仅注册模式） -->
      <el-form-item v-if="isRegisterMode" prop="confirmPassword">
        <el-input
          v-model="formData.confirmPassword"
          :type="passwordVisible ? 'text' : 'password'"
          :placeholder="t('login.placeholders.confirmPassword')"
          size="large"
          clearable
          @keyup.enter="handleSubmit"
        >
          <template #prefix>
            <el-icon class="input-icon"><Lock /></el-icon>
          </template>
          <template #suffix>
            <div
              class="password-toggle-icon"
              @click.stop="togglePasswordVisibility"
              :title="passwordVisible ? t('login.password.hide') : t('login.password.show')"
              :aria-label="passwordVisible ? t('login.password.hide') : t('login.password.show')"
            >
              <el-icon>
                <component :is="passwordVisible ? 'Hide' : 'View'" />
              </el-icon>
            </div>
          </template>
        </el-input>
      </el-form-item>

      <!-- 验证码（注册模式） -->
      <el-form-item v-if="isRegisterMode" prop="captcha">
        <CaptchaInput v-model="formData.captcha" @refresh="refreshCaptcha" />
      </el-form-item>

      <!-- 提交按钮 -->
      <el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          @click="handleSubmit"
          class="submit-btn"
        >
          {{ isRegisterMode ? t('login.buttons.register') : t('login.buttons.login') }}
        </el-button>
      </el-form-item>

      <!-- 忘记密码链接（仅登录模式） -->
      <div v-if="!isRegisterMode" class="forgot-password">
        <el-button type="primary" link @click="handleForgotPassword">{{
          t('login.forgotPassword')
        }}</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { User, Lock, Message } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'
import { useI18n } from 'vue-i18n'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator.vue'
import CaptchaInput from '../components/CaptchaInput.vue'
import { useAccountForm } from '../composables/useAccountForm'

const { t } = useI18n()

interface AccountFormProps {
  isRegisterMode: boolean
}

interface LoginData {
  username: string
  password: string
}

interface RegisterData {
  username: string
  email: string
  password: string
  confirmPassword: string
  captcha: string
}

interface AccountFormEmits {
  login: [data: LoginData]
  register: [data: RegisterData]
}

const props = defineProps<AccountFormProps>()
const emit = defineEmits<AccountFormEmits>()

// 表单引用
const formRef = ref<FormInstance | undefined>(undefined)

// 使用表单逻辑
const {
  formData,
  formRules,
  loading,
  passwordVisible,
  togglePasswordVisibility,
  handlePasswordInput,
  refreshCaptcha,
  validateForm,
  resetForm: _resetForm,
} = useAccountForm(props.isRegisterMode)

// 提交处理
const handleSubmit = async () => {
  const isValid = await validateForm(formRef.value)
  if (!isValid) return

  if (props.isRegisterMode) {
    emit('register', { ...formData })
  } else {
    emit('login', {
      username: formData.username,
      password: formData.password,
    })
  }
}

// 忘记密码
const handleForgotPassword = () => {
  // 处理忘记密码逻辑
}
</script>

<style scoped lang="scss">
.account-form-container {
  width: 100%;
  background-color: transparent;
  background: transparent;
}

// 暗色模式下的样式 - 使用 CSS 变量和高特异性选择器
.account-form-container {
  --account-form-bg: transparent;
  --account-form-color: inherit;
}

:deep(.dark-mode) .account-form-container,
html.dark .account-form-container,
.dark-mode .account-form-container {
  --account-form-bg: transparent;
  --account-form-color: var(--el-color-white);
  
  background-color: var(--account-form-bg);
  background: var(--account-form-bg);
  color: var(--account-form-color);
}

.login-form {
  .el-form-item {
    margin-bottom: 20px;
  }

  .input-icon {
    color: var(--el-text-color-placeholder);
  }

  .password-toggle-icon {
    cursor: pointer;
    color: var(--el-text-color-placeholder);
    transition: color 0.3s ease;

    &:hover {
      color: var(--el-color-primary);
    }
  }

  // 调整清除按钮显示在眼睛图标左侧
  .el-input :deep(.el-input__suffix-inner) {
    display: flex ;
    flex-direction: row-reverse ;
    align-items: center ;
    gap: 4px;
  }
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 600;
}

.forgot-password {
  text-align: center;
  margin-top: 16px;
}

@media (width <= 768px) {
  .submit-btn {
    height: 40px;
    font-size: 14px;
  }
}
</style>
