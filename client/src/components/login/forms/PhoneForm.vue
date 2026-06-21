<template>
  <div class="phone-form">
    <el-form
      ref="phoneFormRef"
      :model="formData"
      :rules="formRules"
      label-width="0"
      size="large"
      @submit.prevent="handleSubmit"
    >
      <!-- 手机号输入 -->
      <el-form-item prop="phone">
        <el-input
          v-model="formData.phone"
          :placeholder="
            isRegisterMode ? t('login.placeholders.phoneRegister') : t('login.placeholders.phone')
          "
          :prefix-icon="Phone"
          maxlength="11"
          clearable
          @input="handlePhoneInput"
        >
          <template #prepend>
            <el-select v-model="formData.countryCode" style="width: 80px">
              <el-option label="+86" value="+86" />
              <el-option label="+1" value="+1" />
              <el-option label="+44" value="+44" />
            </el-select>
          </template>
        </el-input>
      </el-form-item>

      <!-- 验证码输入 -->
      <el-form-item prop="smsCode">
        <div class="sms-code-input">
          <el-input
            v-model="formData.smsCode"
            :placeholder="t('login.placeholders.smsCode')"
            :prefix-icon="Message"
            maxlength="6"
            clearable
          />
          <el-button
            :disabled="!canSendSms || smsCountdown > 0"
            :loading="sendingSms"
            @click="sendSmsCode"
          >
            {{ smsButtonText }}
          </el-button>
        </div>
      </el-form-item>

      <!-- 注册模式下的额外字段 -->
      <template v-if="isRegisterMode">
        <!-- 密码输入 -->
        <el-form-item prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            :placeholder="t('login.placeholders.setLoginPassword')"
            :prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>

        <!-- 密码强度指示器 -->
        <PasswordStrengthIndicator :password="formData.password" />

        <!-- 确认密码 -->
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="formData.confirmPassword"
            type="password"
            :placeholder="t('login.placeholders.confirmLoginPassword')"
            :prefix-icon="Lock"
            show-password
            clearable
          />
        </el-form-item>

        <!-- 用户协议 -->
        <el-form-item prop="agreement">
          <el-checkbox v-model="formData.agreement">
            {{ t('login.agreement.prefix') }}
            <el-link type="primary" @click="showUserAgreement">{{
              t('login.agreement.userAgreement')
            }}</el-link>
            {{ t('login.agreement.and') }}
            <el-link type="primary" @click="showPrivacyPolicy">{{
              t('login.agreement.privacyPolicy')
            }}</el-link>
          </el-checkbox>
        </el-form-item>
      </template>

      <!-- 提交按钮 -->
      <el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          :disabled="!isFormValid"
          @click="handleSubmit"
          style="width: 100%"
        >
          {{ isRegisterMode ? t('login.buttons.submitRegister') : t('login.buttons.submitLogin') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Phone, Message, Lock } from '@element-plus/icons-vue'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator.vue'
import { usePhoneForm } from '../composables/usePhoneForm'

const { t } = useI18n()

interface PhoneFormProps {
  isRegisterMode: boolean
}

interface PhoneFormEmits {
  login: [data: PhoneLoginData]
  register: [data: PhoneRegisterData]
}

interface PhoneLoginData {
  phone: string
  countryCode: string
  smsCode: string
}

interface PhoneRegisterData extends PhoneLoginData {
  password: string
  confirmPassword: string
  agreement: boolean
}

const props = defineProps<PhoneFormProps>()
const emit = defineEmits<PhoneFormEmits>()

// 使用手机表单组合函数
const {
  phoneFormRef,
  formData,
  formRules,
  loading,
  sendingSms,
  smsCountdown,
  canSendSms,
  smsButtonText,
  isFormValid,
  handlePhoneInput,
  sendSmsCode,
  validateForm,
  resetForm,
} = usePhoneForm(props.isRegisterMode)

// 方法
const handleSubmit = async () => {
  const isValid = await validateForm()
  if (!isValid) return

  if (props.isRegisterMode) {
    const registerData: PhoneRegisterData = {
      phone: formData.phone,
      countryCode: formData.countryCode,
      smsCode: formData.smsCode,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      agreement: formData.agreement,
    }
    emit('register', registerData)
  } else {
    const loginData: PhoneLoginData = {
      phone: formData.phone,
      countryCode: formData.countryCode,
      smsCode: formData.smsCode,
    }
    emit('login', loginData)
  }
}

const showUserAgreement = () => {
  // 显示用户协议弹窗
}

const showPrivacyPolicy = () => {
  // 显示隐私政策弹窗
}

// 暴露方法给父组件
defineExpose({
  resetForm,
  validateForm,
})
</script>

<style scoped lang="scss">
.phone-form {
  .sms-code-input {
    display: flex;
    gap: 12px;

    .el-input {
      flex: 1;
    }

    .el-button {
      min-width: 120px;
      white-space: nowrap;
    }
  }

  .el-form-item {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .el-checkbox {
    font-size: 14px;
    color: var(--el-text-color-regular);

    .el-link {
      font-size: 14px;
    }
  }
}

// 响应式设计
@media (width <= 768px) {
  .phone-form {
    .sms-code-input {
      .el-button {
        min-width: 100px;
        font-size: 12px;
      }
    }
  }
}
</style>
