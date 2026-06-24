<template>
  <div class="top-up-fail-page">
    <!-- 深度背景系统 -->
    <div class="tf-background">
      <!-- 光晕层 -->
      <div class="tf-glow tf-glow--error"></div>
      <div class="tf-glow tf-glow--ambient"></div>
    </div>

    <!-- 玻璃态卡片 -->
    <div class="tf-card" :class="{ 'tf-card--visible': isVisible }">
      <!-- 卡片边框光效 -->
      <div class="tf-card__border"></div>
      
      <!-- 失败图标动画 -->
      <div class="tf-icon-wrapper">
        <div class="tf-icon-pulse"></div>
        <div class="tf-icon-ring tf-icon-ring--1"></div>
        <div class="tf-icon-ring tf-icon-ring--2"></div>
        <div class="tf-icon">
          <svg viewBox="0 0 64 64" class="tf-icon__svg">
            <circle cx="32" cy="32" r="28" class="tf-icon__circle" />
            <path d="M22 22L42 42M42 22L22 42" class="tf-icon__x" />
          </svg>
        </div>
      </div>

      <!-- 错误代码显示 -->
      <div class="tf-error-code">
        <span class="tf-error-code__label">ERROR</span>
        <span class="tf-error-code__value">PAYMENT_FAILED</span>
      </div>

      <!-- 标题 -->
      <h2 class="tf-title">{{ t('topUpFail.title') }}</h2>
      
      <!-- 消息 -->
      <p class="tf-message">{{ failMessage }}</p>

      <!-- 分隔线 -->
      <div class="tf-divider">
        <span class="tf-divider__line"></span>
        <span class="tf-divider__dot"></span>
        <span class="tf-divider__line"></span>
      </div>

      <!-- 操作按钮 -->
      <div class="tf-actions">
        <button 
          class="tf-btn tf-btn--primary" 
          @click="handleRetry"
          @mousedown="createRipple($event)"
        >
          <span class="tf-btn__text">{{ t('topUpFail.retry') }}</span>
          <span class="tf-btn__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 4v6h6M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </span>
        </button>
        <button 
          class="tf-btn tf-btn--secondary" 
          @click="handleGoHome"
          @mousedown="createRipple($event)"
        >
          <span class="tf-btn__text">{{ t('topUpFail.backToHome') }}</span>
          <span class="tf-btn__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </span>
        </button>
      </div>

      <!-- 底部装饰 -->
      <div class="tf-footer">
        <div class="tf-footer__line"></div>
        <span class="tf-footer__text">SYSTEM STATUS: TRANSACTION INCOMPLETE</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const failMessage = ref(t('topUpFail.defaultMessage'))
const isVisible = ref(false)

onMounted(() => {
  // 从路由参数获取失败原因
  const reason = route.query.reason as string
  if (reason) {
    failMessage.value = reason
  }
  
  // 触发入场动画
  nextTick(() => {
    setTimeout(() => {
      isVisible.value = true
    }, 100)
  })
})

const retryTopUp = () => {
  router.push('/top-up')
}

const goToHome = () => {
  router.push('/')
}

// 带动画的重试
const handleRetry = () => {
  retryTopUp()
}

// 带动画的返回首页
const handleGoHome = () => {
  goToHome()
}

// 涟漪效果
const createRipple = (event: MouseEvent) => {
  const button = event.currentTarget as HTMLElement
  const ripple = document.createElement('span')
  const rect = button.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = event.clientX - rect.left - size / 2
  const y = event.clientY - rect.top - size / 2
  
  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    border-radius: var(--global-border-radius);
    transform: scale(0);
    animation: ripple-effect 0.6s ease-out;
    pointer-events: none;
  `
  
  button.appendChild(ripple)
  
  setTimeout(() => {
    ripple.remove()
  }, 600)
}
</script>

<style scoped lang="scss">
// 注意：全局变量由 vite.config.ts 通过 additionalData 自动注入

// ============================================
// 本地设计变量（使用不同命名避免与全局变量冲突）
// ============================================
$tf-brand-primary: var(--el-bg-color-page);
$tf-error-color: var(--el-color-danger);
$tf-error-glow: rgb(var(--el-color-danger-rgb), 0.4);
$tf-glass-bg: var(--el-fill-color-lighter);
$tf-glass-border: var(--border-unified-color);
$local-text-primary: var(--el-text-color-primary);
$local-text-secondary: var(--el-text-color-secondary);
$local-text-muted: var(--el-text-color-placeholder);
$font-family-mono: 'HarmonyOS Sans SC', monospace;

// ============================================
// 页面容器
// ============================================
.top-up-fail-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  background: $tf-brand-primary;
  overflow: hidden;
  padding: clamp(20px, 5vh, 40px) clamp(16px, 4vw, 28px);
  box-sizing: border-box;
}

// ============================================
// 深度背景系统
// ============================================
.tf-background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

// 光晕层
.tf-glow {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(100px);
  opacity: 0.6;
  
  &--error {
    width: 400px;
    height: 400px;
    top: 30%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: $tf-error-glow;
    animation: glow-pulse-error 3s ease-in-out infinite;
  }
  
  &--ambient {
    width: 600px;
    height: 600px;
    bottom: -200px;
    right: -200px;
    background: var(--color-gray-3c3c3c-30);
    animation: glow-drift 8s ease-in-out infinite;
  }
}

@keyframes glow-pulse-error {
  0%, 100% { 
    opacity: 0.4; 
    transform: translate(-50%, -50%) scale(1);
  }

  50% { 
    opacity: 0.7; 
    transform: translate(-50%, -50%) scale(1.1);
  }
}

@keyframes glow-drift {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-30px, -20px); }
}



// ============================================
// 玻璃态卡片
// ============================================
.tf-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  padding: clamp(32px, 6vw, 48px);
  background: $tf-glass-bg;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  text-align: center;
  z-index: var(--z-base);
  
  // 入场动画
  opacity: 0;
  transform: translateY(30px) scale(0.95);
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  
  &--visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  
  // 卡片边框光效
  &__border {
    position: absolute;
    inset: -1px;
    border-radius: var(--global-border-radius);
    background: var(--color-red-glow);
    z-index: -1;
    animation: border-glow 3s ease-in-out infinite;
  }
}

@keyframes border-glow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

// ============================================
// 失败图标
// ============================================
.tf-icon-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
}

.tf-icon-pulse {
  position: absolute;
  inset: 0;
  border-radius: var(--global-border-radius);
  background: color-mix(in srgb, var(--el-color-primary) 20%, transparent);
  animation: icon-pulse 2s ease-in-out infinite;
}

@keyframes icon-pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 0.2; }
}

.tf-icon-ring {
  position: absolute;
  inset: 0;
  border-radius: var(--global-border-radius);
  border: 2px solid $tf-error-color;
  opacity: 0;
  
  &--1 {
    animation: ring-expand 2s ease-out infinite;
  }
  
  &--2 {
    animation: ring-expand 2s ease-out infinite 1s;
  }
}

@keyframes ring-expand {
  0% {
    transform: scale(0.5);
    opacity: 0.8;
  }

  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.tf-icon {
  position: absolute;
  inset: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &__svg {
    width: 100%;
    height: 100%;
  }
  
  &__circle {
    fill: none;
    stroke: $tf-error-color;
    stroke-width: 2;
    stroke-dasharray: 176;
    stroke-dashoffset: 176;
    animation: circle-draw 1s ease-out 0.3s forwards;
  }
  
  &__x {
    stroke: $tf-error-color;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-dasharray: 28;
    stroke-dashoffset: 28;
    animation: x-draw 0.5s ease-out 1s forwards;
  }
}

@keyframes circle-draw {
  to { stroke-dashoffset: 0; }
}

@keyframes x-draw {
  to { stroke-dashoffset: 0; }
}

// ============================================
// 错误代码
// ============================================
.tf-error-code {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--color-red-transparent-10);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-bottom: 20px;
  font-family: $font-family-mono;
  font-size: 11px;
  letter-spacing: 0.05em;
  
  &__label {
    color: $tf-error-color;
    font-weight: 600;
  }
  
  &__value {
    color: $local-text-secondary;
  }
}

// ============================================
// 标题和消息
// ============================================
.tf-title {
  font-size: clamp(24px, 5vw, 32px);
  font-weight: 700;
  color: $local-text-primary;
  margin: 0 0 12px;
  letter-spacing: -0.02em;
}

.tf-message {
  font-size: clamp(14px, 3vw, 16px);
  color: $local-text-secondary;
  margin: 0 0 28px;
  line-height: 1.6;
}

// ============================================
// 分隔线
// ============================================
.tf-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 28px;
  
  &__line {
    width: 60px;
    height: 1px;
    background: $tf-glass-border;
  }
  
  &__dot {
    width: 4px;
    height: 4px;
    background: $local-text-muted;
    border-radius: var(--global-border-radius);
  }
}

// ============================================
// 按钮
// ============================================
.tf-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.tf-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  border: none;
  border-radius: var(--global-border-radius);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &__icon {
    width: 18px;
    height: 18px;
    opacity: 0.8;
    transition: transform 0.3s ease;
    
    svg {
      width: 100%;
      height: 100%;
    }
  }
  
  &--primary {
    background: $tf-error-color;
    color: var(--el-bg-color-page);
    box-shadow: var(--global-box-shadow);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--global-box-shadow);
      
      .tf-btn__icon {
        transform: rotate(-45deg);
      }
    }
    
    &:active {
      transform: translateY(0);
    }
  }
  
  &--secondary {
    background: var(--color-white-5);
    color: $local-text-primary;
    border: var(--unified-border);
    
    &:hover {
      background: var(--color-white-10);
      border-color: var(--border-unified-color-hover);
      transform: translateY(-2px);
      
      .tf-btn__icon {
        transform: scale(1.1);
      }
    }
    
    &:active {
      transform: translateY(0);
    }
  }
}

// 涟漪动画
@keyframes ripple-effect {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

// ============================================
// 底部装饰
// ============================================
.tf-footer {
  margin-top: 32px;
  padding-top: 20px;
  border-top: var(--unified-border);
  
  &__line {
    width: 40px;
    height: 2px;
    background: $tf-error-color;
    margin: 0 auto 12px;
    animation: line-pulse 2s ease-in-out infinite;
  }
  
  &__text {
    font-family: $font-family-mono;
    font-size: 10px;
    color: $local-text-muted;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
}

@keyframes line-pulse {
  0%, 100% { opacity: 0.5; width: 40px; }
  50% { opacity: 1; width: 60px; }
}

// ============================================
// 亮色模式适配
// ============================================
:root:not(.dark) {
  .top-up-fail-page {
    background: var(--el-bg-color);
  }
  
  .tf-glow--error {
    background: var(--color-red-glow-2);
  }
  
  .tf-glow--ambient {
    background: var(--color-black-5);
  }
  
  .tf-card {
    background: var(--color-white-90);
    border-color: var(--border-unified-color);
    
    &__border {
      background: var(--color-red-transparent-10);
    }
  }
  
  .tf-title {
    color: var(--el-text-color-primary);
  }
  
  .tf-message {
    color: var(--el-text-color-secondary);
  }
  
  .tf-divider__line {
    background: var(--color-black-5);
  }
  
  .tf-btn--secondary {
    background: var(--color-black-3);
    color: var(--el-text-color-primary);
    border-color: var(--border-unified-color);
    
    &:hover {
      background: var(--color-black-6);
      border-color: var(--border-unified-color-hover);
    }
  }
  
  .tf-footer {
    border-top-color: var(--border-unified-color);
    
    &__text {
      color: var(--el-text-color-placeholder);
    }
  }
}

// ============================================
// 响应式适配
// ============================================
@media (width <= 480px) {
  .tf-card {
    padding: clamp(24px, 5vw, 32px);
    border-radius: var(--global-border-radius);
  }
  
  .tf-icon-wrapper {
    width: 100px;
    height: 100px;
  }
  
  .tf-actions {
    flex-direction: column;
  }
  
  .tf-btn {
    width: 100%;
    justify-content: center;
  }
}

// ============================================
// 减少动画偏好
// ============================================
@media (prefers-reduced-motion: reduce) {
  .tf-glow,
  .tf-icon-pulse,
  .tf-icon-ring,
  .tf-card__border,
  .tf-footer__line {
    animation: none;
  }
  
  .tf-icon__circle,
  .tf-icon__x {
    stroke-dashoffset: 0;
    animation: none;
  }
  
  .tf-card {
    opacity: 1;
    transform: none;
  }
}
</style>
