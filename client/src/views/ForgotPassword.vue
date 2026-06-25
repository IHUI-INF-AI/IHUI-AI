<template>
  <div class="forgot-password-page">
    <!-- 深度背景系统 -->
    <div class="fp-background-system">
      <!-- 光晕层 -->
      <div class="fp-glow-orb fp-glow-orb--primary"></div>
      <div class="fp-glow-orb fp-glow-orb--secondary"></div>
      <div class="fp-glow-orb fp-glow-orb--tertiary"></div>
      <!-- 粒子效果 -->
      <div class="fp-particles">
        <span v-for="n in 20" :key="n" class="fp-particle" :style="{ '--delay': `${n * 0.3}s`, '--x': `${Math.random() * 100}%`, '--duration': `${3 + Math.random() * 4}s` }"></span>
      </div>
    </div>

    <div class="forgot-password-container">
      <!-- 玻璃态卡片 -->
      <div class="forgot-password-card fp-glass-card fp-fade-in">
        <!-- 卡片边框光效 -->
        <div class="fp-card-border"></div>
        
        <div class="card-header">
          <button class="fp-back-btn fp-ripple" :aria-label="t('common.back')" @click="handleBack">
            <el-icon><ArrowLeft /></el-icon>
            <span class="btn-glow"></span>
          </button>
          <div class="fp-header-content">
            <h1 class="page-title fp-glitch-text" data-text="">
              <span class="fp-title-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              {{ t('forgotPassword.title') }}
            </h1>
            <p class="fp-subtitle">{{ t('forgotPassword.subtitle') }}</p>
          </div>
        </div>

        <!-- 进度步骤 - 工业风格 -->
        <div class="fp-steps-wrapper">
          <div class="fp-steps-track">
            <div class="fp-steps-progress" :style="{ width: `${(currentStep / 2) * 100}%` }"></div>
          </div>
          <div class="fp-steps-container">
            <div 
              v-for="(step, index) in [t('forgotPassword.step1'), t('forgotPassword.step2'), t('forgotPassword.step3')]" 
              :key="index"
              class="fp-step"
              :class="{ 
                'fp-step--active': currentStep === index, 
                'fp-step--completed': currentStep > index 
              }"
            >
              <div class="fp-step-indicator">
                <span class="fp-step-number">{{ String(index + 1).padStart(2, '0') }}</span>
                <span v-if="currentStep > index" class="fp-step-check">✓</span>
              </div>
              <span class="fp-step-label">{{ step }}</span>
            </div>
          </div>
        </div>

        <div class="form-container">
          <!-- Step 1: 验证身份 -->
          <Transition name="fp-slide" mode="out-in">
            <el-form
              v-if="currentStep === 0"
              ref="step1FormRef"
              :model="step1Form"
              :rules="step1Rules"
              label-position="top"
              class="forgot-form fp-form"
            >
              <div class="fp-form-group fp-stagger-item" style="

--stagger: 1">
                <label class="fp-label">
                  <span class="fp-label-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  {{ t('forgotPassword.email') }}
                </label>
                <el-form-item prop="email">
                  <div class="fp-input-wrapper">
                    <el-input
                      v-model="step1Form.email"
                      :placeholder="t('forgotPassword.emailPlaceholder')"
                      class="fp-input"
                    />
                    <div class="fp-input-border"></div>
                  </div>
                </el-form-item>
              </div>

              <div class="fp-form-group fp-stagger-item" style="

--stagger: 2">
                <label class="fp-label">
                  <span class="fp-label-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                  </span>
                  {{ t('forgotPassword.verificationCode') }}
                </label>
                <el-form-item prop="code">
                  <div class="code-input-group">
                    <div class="fp-input-wrapper fp-input-wrapper--flex">
                      <el-input
                        v-model="step1Form.code"
                        :placeholder="t('forgotPassword.codePlaceholder')"
                        class="fp-input"
                      />
                      <div class="fp-input-border"></div>
                    </div>
                    <button
                      type="button"
                      :disabled="countdown > 0"
                      @click="sendCode"
                      class="fp-code-btn fp-ripple"
                    >
                      <span class="fp-btn-text">
                        {{ countdown > 0 ? `${countdown}s` : t('forgotPassword.sendCode') }}
                      </span>
                      <span class="btn-glow"></span>
                    </button>
                  </div>
                </el-form-item>
              </div>

              <div class="fp-form-group fp-stagger-item" style="

--stagger: 3">
                <button type="button" @click="handleStep1Next" class="fp-submit-btn fp-ripple">
                  <span class="fp-btn-content">
                    <span>{{ t('forgotPassword.next') }}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fp-btn-arrow">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </span>
                  <span class="btn-glow"></span>
                  <span class="fp-btn-shine"></span>
                </button>
              </div>
            </el-form>
          </Transition>

          <!-- Step 2: 设置新密码 -->
          <Transition name="fp-slide" mode="out-in">
            <el-form
              v-if="currentStep === 1"
              ref="step2FormRef"
              :model="step2Form"
              :rules="step2Rules"
              label-position="top"
              class="forgot-form fp-form"
            >
              <div class="fp-form-group fp-stagger-item" style="

--stagger: 1">
                <label class="fp-label">
                  <span class="fp-label-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  {{ t('forgotPassword.newPassword') }}
                </label>
                <el-form-item prop="password">
                  <div class="fp-input-wrapper">
                    <el-input
                      v-model="step2Form.password"
                      type="password"
                      :placeholder="t('forgotPassword.passwordPlaceholder')"
                      class="fp-input"
                      show-password
                    />
                    <div class="fp-input-border"></div>
                  </div>
                </el-form-item>
              </div>

              <div class="fp-form-group fp-stagger-item" style="

--stagger: 2">
                <label class="fp-label">
                  <span class="fp-label-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      <polyline points="9 12 11 14 15 10"/>
                    </svg>
                  </span>
                  {{ t('forgotPassword.confirmPassword') }}
                </label>
                <el-form-item prop="confirmPassword">
                  <div class="fp-input-wrapper">
                    <el-input
                      v-model="step2Form.confirmPassword"
                      type="password"
                      :placeholder="t('forgotPassword.confirmPasswordPlaceholder')"
                      class="fp-input"
                      show-password
                    />
                    <div class="fp-input-border"></div>
                  </div>
                </el-form-item>
              </div>

              <div class="fp-form-group fp-stagger-item" style="

--stagger: 3">
                <div class="fp-password-tips">
                  <div class="fp-tips-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>{{ t('forgotPassword.passwordTips') }}</span>
                  </div>
                  <ul class="fp-tips-list">
                    <li><span class="fp-tip-bullet"></span>{{ t('forgotPassword.tip1') }}</li>
                    <li><span class="fp-tip-bullet"></span>{{ t('forgotPassword.tip2') }}</li>
                    <li><span class="fp-tip-bullet"></span>{{ t('forgotPassword.tip3') }}</li>
                    <li><span class="fp-tip-bullet"></span>{{ t('forgotPassword.tip4') }}</li>
                  </ul>
                </div>
              </div>

              <div class="fp-form-group fp-stagger-item" style="

--stagger: 4">
                <button type="button" @click="handleStep2Next" class="fp-submit-btn fp-ripple">
                  <span class="fp-btn-content">
                    <span>{{ t('forgotPassword.next') }}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fp-btn-arrow">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </span>
                  <span class="btn-glow"></span>
                  <span class="fp-btn-shine"></span>
                </button>
              </div>
            </el-form>
          </Transition>

          <!-- Step 3: 成功 -->
          <Transition name="fp-slide" mode="out-in">
            <div v-if="currentStep === 2" class="success-container fp-success">
              <div class="fp-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div class="fp-success-rings">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <h2 class="fp-success-title">{{ t('forgotPassword.success') }}</h2>
              <p class="fp-success-desc">{{ t('forgotPassword.successDesc') }}</p>
              <button @click="goToLogin" class="fp-submit-btn fp-ripple fp-success-btn">
                <span class="fp-btn-content">
                  <span>{{ t('forgotPassword.goToLogin') }}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fp-btn-arrow">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </span>
                <span class="btn-glow"></span>
                <span class="fp-btn-shine"></span>
              </button>
            </div>
          </Transition>
        </div>

        <!-- 卡片底部装饰 -->
        <div class="fp-card-footer">
          <div class="fp-footer-line"></div>
          <span class="fp-footer-text">{{ t('forgotPassword.footerText') }}</span>
          <div class="fp-footer-line"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { sendVerificationCode, verifyCode, resetPassword } from '@/api/user/user'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()
const router = useRouter()

const currentStep = ref(0)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null
const step1FormRef = ref<FormInstance | null>(null)
const step2FormRef = ref<FormInstance | null>(null)
const codeId = ref('')

const cleanup = useCleanup()

const step1Form = reactive({
  email: '',
  code: '',
})

const step2Form = reactive({
  password: '',
  confirmPassword: '',
})

const validateConfirmPassword = (
  _rule: any,
  value: string,
  callback: (error?: Error) => void
) => {
  if (value === '') {
    callback(new Error(t('forgotPassword.confirmPasswordRequired')))
  } else if (value !== step2Form.password) {
    callback(new Error(t('forgotPassword.passwordMismatch')))
  } else {
    callback()
  }
}

const step1Rules: FormRules = {
  email: [
    { required: true, message: t('forgotPassword.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('forgotPassword.emailInvalid'), trigger: 'blur' },
  ],
  code: [{ required: true, message: t('forgotPassword.codeRequired'), trigger: 'blur' }],
}

const step2Rules: FormRules = {
  password: [
    { required: true, message: t('forgotPassword.passwordRequired'), trigger: 'blur' },
    { min: 8, message: t('forgotPassword.passwordMinLength'), trigger: 'blur' },
  ],
  confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }],
}

const handleBack = () => {
  const routerWithGo = router as ReturnType<typeof useRouter> & {
    go: (delta: number) => void
  }
  routerWithGo.go(-1)
}

const sendCode = async () => {
  if (!step1Form.email) {
    ElMessage.warning(t('forgotPassword.emailRequired'))
    return
  }

  try {
    const response = await sendVerificationCode({
      type: 'email',
      target: step1Form.email,
    })

    if (response.code === 200 && response.data) {
      codeId.value = response.data.codeId
      ElMessage.success(t('forgotPassword.codeSent'))
      countdown.value = 60
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = cleanup.addInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          if (countdownTimer) {
            clearInterval(countdownTimer)
            countdownTimer = null
          }
        }
      }, 1000)
    } else {
      ElMessage.error(response.message || t('forgotPassword.sendCodeFailed'))
    }
  } catch {
    ElMessage.error(t('forgotPassword.sendCodeFailed'))
  }
}

const handleStep1Next = async () => {
  if (!step1FormRef.value) return

  await step1FormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      try {
        const response = await verifyCode({
          codeId: codeId.value,
          code: step1Form.code,
        })

        if (response.code === 200) {
          currentStep.value = 1
        } else {
          ElMessage.error(response.message || t('forgotPassword.codeInvalid'))
        }
      } catch {
        ElMessage.error(t('forgotPassword.codeInvalid'))
      }
    }
  })
}

const handleStep2Next = async () => {
  if (!step2FormRef.value) return

  await step2FormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      try {
        const response = await resetPassword({
          email: step1Form.email,
          code: step1Form.code,
          newPassword: step2Form.password,
        })

        if (response.code === 200) {
          ElMessage.success(t('forgotPassword.passwordResetSuccess'))
          currentStep.value = 2
        } else {
          ElMessage.error(response.message || t('forgotPassword.resetPasswordFailed'))
        }
      } catch {
        ElMessage.error(t('forgotPassword.resetPasswordFailed'))
      }
    }
  })
}

const goToLogin = () => {
  router.push('/login')
}
</script>

<style lang="scss" scoped>
// ==========================================
// 高科技工业风格 - 忘记密码页面
// ==========================================

// 设计令牌
$brand-primary: var(--el-bg-color-page);
$brand-secondary: var(--el-fill-color-darker);
$accent-cyan: var(--el-color-primary);
$accent-white: var(--el-color-white);
$text-primary: var(--el-text-color-primary);
$text-secondary: var(--el-text-color-regular);
$text-muted: var(--el-text-color-placeholder);
$glass-bg: var(--el-fill-color-lighter);
$glass-border: var(--border-unified-color);
$glow-cyan: color-mix(in srgb, var(--el-color-primary) 50%, transparent);

// 动画时间
$transition-fast: 0.15s;
$transition-normal: 0.3s;
$transition-slow: 0.5s;

// ==========================================
// 页面容器
// ==========================================
.forgot-password-page {
  min-height: 100vh;
  background: $brand-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

// ==========================================
// 深度背景系统
// ==========================================
.fp-background-system {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-0);
}

// 光晕层
.fp-glow-orb {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(80px);
  opacity: 0.4;
  animation: fp-orb-float 20s ease-in-out infinite;
  
  &--primary {
    width: 500px;
    height: 500px;
    background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    top: -200px;
    right: -100px;
    animation-delay: 0s;
  }
  
  &--secondary {
    width: 400px;
    height: 400px;
    background: var(--color-white-15);
    bottom: -150px;
    left: -100px;
    animation-delay: -7s;
  }
  
  &--tertiary {
    width: 300px;
    height: 300px;
    background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.2;
    animation-delay: -14s;
  }
}

@keyframes fp-orb-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -30px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(-30px, -20px) scale(1.02); }
}

// 粒子效果
.fp-particles {
  position: absolute;
  inset: 0;
}

.fp-particle {
  position: absolute;
  width: 2px;
  height: 2px;
  background: $accent-cyan;
  border-radius: var(--global-border-radius);
  left: var(--x);
  animation: fp-particle-rise var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
  opacity: 0;
  
  &::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 4px;
    background: inherit;
    border-radius: var(--global-border-radius);
    filter: blur(2px);
    top: -1px;
    left: -1px;
  }
}

@keyframes fp-particle-rise {
  0% { bottom: -10px; opacity: 0; }
  10% { opacity: 0.8; }
  90% { opacity: 0.8; }
  100% { bottom: 100%; opacity: 0; }
}

// ==========================================
// 容器
// ==========================================
.forgot-password-container {
  width: 100%;
  max-width: 520px;
  position: relative;
  z-index: var(--z-base);
}

// ==========================================
// 玻璃态卡片
// ==========================================
.fp-glass-card {
  background: $glass-bg;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-white-3);
    pointer-events: none;
  }
}

// 卡片边框光效
.fp-card-border {
  position: absolute;
  inset: -1px;
  border-radius: var(--global-border-radius);
  background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
  z-index: -1;
  opacity: 0.5;
}

// ==========================================
// 淡入动画
// ==========================================
.fp-fade-in {
  animation: fp-fade-in 0.8s ease-out;
}

@keyframes fp-fade-in {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ==========================================
// 卡片头部
// ==========================================
.card-header {
  display: flex;
  align-items: center;
  padding: 28px 32px;
  background: var(--color-black-45);
  border-bottom: var(--unified-border-bottom);
  gap: 16px;
}

.fp-back-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--global-border-radius);
  background: var(--color-white-5);
  border: var(--unified-border);
  color: $text-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all $transition-normal ease;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  
  &:hover {
    background: var(--color-white-10);
    border-color: $accent-cyan;
    .el-icon {
      transform: translateX(-2px);
    }
  }
  
  .el-icon {
    font-size: 18px;
    transition: transform $transition-normal ease;
  }
}

.fp-header-content {
  flex: 1;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: $text-primary;
  display: flex;
  align-items: center;
  gap: 12px;
  letter-spacing: -0.02em;
}

.fp-title-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 100%;
    height: 100%;
    stroke: $accent-cyan;
  }
}

.fp-subtitle {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: $text-muted;
  margin: 6px 0 0;
  font-family: var(--font-family-mono);
}

// ==========================================
// 进度步骤
// ==========================================
.fp-steps-wrapper {
  padding: 32px 32px 24px;
  position: relative;
}

.fp-steps-track {
  position: absolute;
  top: 50px;
  left: 80px;
  right: 80px;
  height: 2px;
  background: var(--color-white-10);
  border-radius: var(--global-border-radius);
  
  .fp-steps-progress {
    height: 100%;
    background: $accent-cyan;
    border-radius: var(--global-border-radius);
    transition: width $transition-slow ease;
    }
}

.fp-steps-container {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: var(--z-base);
}

.fp-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.fp-step-indicator {
  width: 40px;
  height: 40px;
  border-radius: var(--global-border-radius);
  background: var(--color-white-5);
  border: var(--unified-border);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all $transition-normal ease;
  
  .fp-step-number {
    font-size: 12px;
    font-weight: 600;
    color: $text-muted;
    font-family: var(--font-family-mono);
    transition: opacity $transition-normal ease;
  }
  
  .fp-step-check {
    position: absolute;
    font-size: 16px;
    color: $accent-cyan;
    opacity: 0;
    transform: scale(0);
    transition: all $transition-normal ease;
  }
}

.fp-step-label {
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
  text-align: center;
  transition: color $transition-normal ease;
}

.fp-step--active {
  .fp-step-indicator {
    background: var(--color-cyan-00f0ff-10);
    border-color: $accent-cyan;
    .fp-step-number {
      color: $accent-cyan;
    }
  }
  
  .fp-step-label {
    color: $text-primary;
  }
}

.fp-step--completed {
  .fp-step-indicator {
    background: $accent-cyan;
    border-color: $accent-cyan;
    
    .fp-step-number {
      opacity: 0;
    }
    
    .fp-step-check {
      opacity: 1;
      transform: scale(1);
      color: $brand-primary;
    }
  }
  
  .fp-step-label {
    color: $accent-cyan;
  }
}

// ==========================================
// 表单容器
// ==========================================
.form-container {
  padding: 8px 32px 32px;
}

.fp-form {
  :deep(.el-form-item) {
    margin-bottom: 0;
    
    .el-form-item__error {
      color: var(--el-color-danger);
      font-size: 12px;
      padding-top: 6px;
    }
  }
}

.fp-form-group {
  margin-bottom: 24px;
}

// 交错动画
.fp-stagger-item {
  animation: fp-stagger-in 0.5s ease-out backwards;
  animation-delay: calc(var(--stagger) * 0.1s);
}

@keyframes fp-stagger-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ==========================================
// 表单标签
// ==========================================
.fp-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
  color: $text-secondary;
  margin-bottom: 10px;
}

.fp-label-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 100%;
    height: 100%;
    stroke: $accent-cyan;
    opacity: 0.7;
  }
}

// ==========================================
// 输入框
// ==========================================
.fp-input-wrapper {
  position: relative;
  
  &--flex {
    flex: 1;
  }
  
  .fp-input-border {
    position: absolute;
    inset: 0;
    border-radius: var(--global-border-radius);
    pointer-events: none;
    border: var(--unified-border);
    transition: all $transition-normal ease;
  }
  
  &:focus-within {
    .fp-input-border {
      border-color: $accent-cyan;
      }
  }
}

.fp-input {
  :deep(.el-input__wrapper) {
    background: var(--color-white-3);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 12px 16px;
    box-shadow: none;
    transition: all $transition-normal ease;
    
    &:hover {
      background: var(--color-white-5);
    }
    
    &.is-focus {
      background: var(--color-white-5);
      border-color: transparent;
    }
  }
  
  :deep(.el-input__inner) {
    color: $text-primary;
    font-size: 14px;
    
    &::placeholder {
      color: $text-muted;
    }
  }
  
  :deep(.el-input__suffix) {
    color: $text-muted;
    
    .el-input__password {
      cursor: pointer;
      
      &:hover {
        color: $accent-cyan;
      }
    }
  }
}

// ==========================================
// 验证码输入组
// ==========================================
.code-input-group {
  display: flex;
  gap: 12px;
}

.fp-code-btn {
  flex-shrink: 0;
  min-width: 120px;
  height: 48px;
  padding: 0 20px;
  background: var(--color-cyan-00f0ff-10);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: $accent-cyan;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all $transition-normal ease;
  
  &:hover:not(:disabled) {
    background: var(--color-cyan-00f0ff-20);
    border-color: $accent-cyan;
    }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .fp-btn-text {
    position: relative;
    z-index: var(--z-base);
  }
}

// ==========================================
// 提交按钮
// ==========================================
.fp-submit-btn {
  width: 100%;
  height: 52px;
  margin-top: 8px;
  background: $accent-cyan;
  border: none;
  border-radius: var(--global-border-radius);
  color: $brand-primary;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all $transition-normal ease;
  
  &:hover {
    transform: translateY(-2px);
    .fp-btn-arrow {
      transform: translateX(4px);
    }
  }
  
  &:active {
    transform: translateY(0);
  }
}

.fp-btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  z-index: var(--z-base);
}

.fp-btn-arrow {
  width: 18px;
  height: 18px;
  transition: transform $transition-normal ease;
}

// 扫光效果已移至全局样式 (styles/index.scss)

.fp-btn-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: var(--color-white-15);
  transition: left 0.5s ease;
}

.fp-submit-btn:hover .fp-btn-shine {
  left: 100%;
}

// ==========================================
// 涟漪效果
// ==========================================
.fp-ripple {
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 50%;
    left: 50%;
    pointer-events: none;
    background: var(--color-white-15);
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    transition: transform 0.6s ease, opacity 0.6s ease;
  }
  
  &:active::after {
    transform: translate(-50%, -50%) scale(2);
    opacity: 1;
    transition: 0s;
  }
}

// ==========================================
// 密码提示
// ==========================================
.fp-password-tips {
  background: var(--color-white-2);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px 20px;
}

.fp-tips-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
  color: $text-secondary;
  margin-bottom: 12px;
  
  svg {
    width: 16px;
    height: 16px;
    stroke: $accent-cyan;
    opacity: 0.7;
  }
}

.fp-tips-list {
  margin: 0;
  padding: 0;
  list-style: none;
  
  li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 12px;
    color: $text-muted;
    margin-bottom: 8px;
    line-height: 1.5;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

.fp-tip-bullet {
  width: 4px;
  height: 4px;
  background: $accent-cyan;
  border-radius: var(--global-border-radius);
  margin-top: 6px;
  flex-shrink: 0;
  opacity: 0.5;
}

// ==========================================
// 成功状态
// ==========================================
.fp-success {
  padding: 48px 32px;
  text-align: center;
}

.fp-success-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 48px;
    height: 48px;
    stroke: $accent-cyan;
    stroke-width: 2;
    animation: fp-check-draw 0.8s ease forwards;
  }
}

@keyframes fp-check-draw {
  0% {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
  }

  100% {
    stroke-dasharray: 100;
    stroke-dashoffset: 0;
  }
}

.fp-success-rings {
  position: absolute;
  inset: 0;
  
  span {
    position: absolute;
    inset: 0;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    opacity: 0;
    animation: fp-ring-expand 2s ease-out infinite;
    
    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.5s; }
    &:nth-child(3) { animation-delay: 1s; }
  }
}

@keyframes fp-ring-expand {
  0% {
    transform: scale(0.5);
    opacity: 0.8;
  }

  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.fp-success-title {
  font-size: 24px;
  font-weight: 700;
  color: $text-primary;
  margin: 0 0 12px;
  letter-spacing: -0.02em;
}

.fp-success-desc {
  font-size: 14px;
  color: $text-secondary;
  margin: 0 0 32px;
  line-height: 1.6;
}

.fp-success-btn {
  max-width: 240px;
  margin: 0 auto;
}

// ==========================================
// 卡片底部
// ==========================================
.fp-card-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 32px;
  border-top: var(--unified-border);
}

.fp-footer-line {
  flex: 1;
  height: 1px;
  background: $glass-border;
}

.fp-footer-text {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.2em;
  color: $text-muted;
  font-family: var(--font-family-mono);
}

// ==========================================
// 过渡动画
// ==========================================
.fp-slide-enter-active,
.fp-slide-leave-active {
  transition: all $transition-normal ease;
}

.fp-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.fp-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

// ==========================================
// 响应式
// ==========================================
@media (width <= 768px) {
  .forgot-password-page {
    padding: 16px;
    align-items: flex-start;
    padding-top: 40px;
  }
  
  .forgot-password-container {
    max-width: 100%;
  }
  
  .fp-glass-card {
    border-radius: var(--global-border-radius);
  }
  
  .card-header {
    padding: 20px 24px;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .fp-back-btn {
    width: 40px;
    height: 40px;
  }
  
  .page-title {
    font-size: 20px;
  }
  
  .fp-steps-wrapper {
    padding: 24px 24px 20px;
  }
  
  .fp-steps-track {
    left: 60px;
    right: 60px;
  }
  
  .fp-step-indicator {
    width: 36px;
    height: 36px;
  }
  
  .fp-step-label {
    font-size: 12px;
  }
  
  .form-container {
    padding: 8px 24px 24px;
  }
  
  .code-input-group {
    flex-direction: column;
  }
  
  .fp-code-btn {
    width: 100%;
    min-width: unset;
  }
  
  .fp-submit-btn {
    height: 48px;
  }
  
  .fp-card-footer {
    padding: 16px 24px;
  }
  
  .fp-success {
    padding: 32px 24px;
  }
  
  .fp-success-icon {
    width: 64px;
    height: 64px;
    
    svg {
      width: 36px;
      height: 36px;
    }
  }
  
  .fp-success-title {
    font-size: 20px;
  }
}

// ==========================================
// 暗色模式适配
// ==========================================
html.dark {
  .forgot-password-page {
    background: $brand-primary;
  }
}
</style>
