<template>
  <el-dialog
    v-model="visible"
    width="420px"
    :close-on-click-modal="false"
    :show-close="true"
    class="login-popup-dialog"
    destroy-on-close
  >
    <div class="login-popup">
      <!-- 头部标题 -->
      <div class="login-header">
        <h2 class="login-title">{{ t('userComponents.loginPopup.login') || '登录' }}</h2>
        <p class="login-subtitle">{{ t('userLoginPopup.welcomeBack') }}</p>
      </div>

      <!-- 手机号 + 验证码表单 -->
      <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top" class="login-form">
        <el-form-item prop="phone" :label="t('userComponents.loginPopup.phone') || '手机号'">
          <el-input
            v-model="formData.phone"
            placeholder="请输入手机号"
            maxlength="11"
            :prefix-icon="Iphone"
            clearable
            size="large"
          />
        </el-form-item>

        <el-form-item prop="code" :label="t('userComponents.loginPopup.code') || '验证码'">
          <div class="code-input-group">
            <el-input
              v-model="formData.code"
              placeholder="请输入验证码"
              maxlength="6"
              :prefix-icon="Lock"
              size="large"
              class="code-input"
              @keyup.enter="handleLogin"
            />
            <el-button
              size="large"
              class="code-btn"
              :disabled="countdown > 0"
              @click="handleSendCode"
            >
              {{ countdown > 0 ? `${countdown}s` : (t('userComponents.loginPopup.sendCode') || '发送验证码') }}
            </el-button>
          </div>
        </el-form-item>

        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          {{ t('userComponents.loginPopup.login') || '登录' }}
        </el-button>
      </el-form>

      <!-- 分割线 -->
      <div class="divider">
        <span class="divider-text">{{ t('loginPopup.or') }}</span>
      </div>

      <!-- 微信登录按钮 -->
      <el-button
        size="large"
        class="wechat-login-btn"
        @click="handleWechatLogin"
      >
        <svg class="wechat-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.917-7.062-6.122zm-2.18 2.768c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
        </svg>
        {{ t('userComponents.loginPopup.wechatLogin') || '微信登录' }}
      </el-button>

      <!-- 底部链接 -->
      <div class="login-footer">
        <span class="footer-text">
          {{ t('loginPopup.noAccount') }}
          <el-link type="primary" :underline="false" @click="goRegister">{{ t('loginPopup.registerNow') }}</el-link>
        </span>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Iphone, Lock } from '@element-plus/icons-vue'
import { sendPhoneLoginCode, phoneLogin, completePhoneLogin } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const cleanup = useCleanup()

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'login-success'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const formRef = ref<FormInstance>()
const loading = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const formData = reactive({
  phone: '',
  code: '',
})

const formRules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' },
  ],
}

async function handleSendCode() {
  if (!formData.phone) {
    ElMessage.warning(t('userLoginPopup.enterPhone'))
    return
  }
  const phoneReg = /^1[3-9]\d{9}$/
  if (!phoneReg.test(formData.phone)) {
    ElMessage.warning(t('userLoginPopup.invalidPhone'))
    return
  }

  try {
    await sendPhoneLoginCode(formData.phone)
    ElMessage.success(t('userLoginPopup.codeSent'))
    countdown.value = 60
    countdownTimer = cleanup.addInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        if (countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }
      }
    }, 1000)
  } catch {
    ElMessage.error(t('userLoginPopup.codeSendFailed'))
  }
}

async function handleLogin() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    loading.value = true
    try {
      const verifyResult = await phoneLogin({ phone: formData.phone, code: formData.code })
      if (verifyResult.success && verifyResult.data) {
        const tempKey = verifyResult.data
        const completeResult = await completePhoneLogin({
          phone: formData.phone,
          tempKey,
        })
        if (completeResult.success && completeResult.data) {
          const loginData = completeResult.data as { token?: string; user?: Record<string, unknown> }
          if (loginData.token) {
            authStore.token = loginData.token
          }
          if (loginData.user) {
            authStore.user = loginData.user as any
          }
          ElMessage.success(t('userLoginPopup.loginSuccess'))
          emit('login-success')
          visible.value = false
        } else {
          throw new Error(completeResult.message || '登录失败')
        }
      } else {
        throw new Error(verifyResult.message || '验证码验证失败')
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '登录失败')
    } finally {
      loading.value = false
    }
  })
}

function handleWechatLogin() {
  const appId = import.meta.env.VITE_WECHAT_PC_APP_ID || ''
  const redirectUri = encodeURIComponent(window.location.origin + '/api/login/wechat/pc/wxCode')
  if (appId) {
    window.location.href = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=web#${window.location.href}`
  } else {
    ElMessage.info(t('userLoginPopup.wechatLoginNotConfigured'))
  }
}

function goRegister() {
  visible.value = false
  router.push('/register')
}

</script>

<style scoped>
.login-popup {
  padding: 8px 0;
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
}

.login-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.login-form {
  margin-bottom: 8px;
}

.login-form :deep(.el-form-item__label) {
  font-weight: 500;
}

.code-input-group {
  display: flex;
  gap: 12px;
  width: 100%;
}

.code-input {
  flex: 1;
}

.code-btn {
  flex-shrink: 0;
  min-width: 120px;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: var(--global-border-radius);
  margin-top: 4px;
}

.divider {
  display: flex;
  align-items: center;
  margin: 20px 0;
  gap: 12px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--el-border-color-lighter);
}

.divider-text {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.wechat-login-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  border-radius: var(--global-border-radius);
  background-color: var(--color-wechat-07c160);
  border-color: var(--color-wechat-07c160);
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.wechat-login-btn:hover {
  background-color: var(--color-green-06ad56);
  border-color: var(--color-green-06ad56);
  color: var(--color-white);
}

.wechat-icon {
  flex-shrink: 0;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
}

.footer-text {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
