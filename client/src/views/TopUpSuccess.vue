<template>
  <div class="top-up-success-page">
    <!-- 深度背景系统 -->
    <div class="background-system">
      <!-- 光晕层 -->
      <div class="glow-layer">
        <div class="glow glow--primary"></div>
        <div class="glow glow--secondary"></div>
        <div class="glow glow--accent"></div>
      </div>
      <!-- 粒子层 -->
      <div class="particles-layer">
        <span v-for="i in 20" :key="i" class="particle" :style="getParticleStyle(i)"></span>
      </div>
    </div>

    <!-- 玻璃态卡片 -->
    <div class="glass-card" :class="{ 'card-visible': isCardVisible }">
      <!-- 卡片边框光效 -->
      <div class="card-border-glow"></div>

      <!-- 成功图标动画 -->
      <div class="success-icon-wrapper">
        <div class="icon-ring icon-ring--outer"></div>
        <div class="icon-ring icon-ring--middle"></div>
        <div class="icon-ring icon-ring--inner"></div>
        <div class="icon-container">
          <svg class="checkmark-svg" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>
        <!-- 成功粒子爆发 -->
        <div class="success-particles">
          <span v-for="j in 12" :key="j" class="success-particle" :style="getSuccessParticleStyle(j)"></span>
        </div>
      </div>

      <!-- 标题区域 -->
      <div class="content-section">
        <h2 class="success-title">
          <span class="title-text">{{ t('topUpSuccess.title') }}</span>
          <span class="title-underline"></span>
        </h2>
        <p class="success-message">{{ t('topUpSuccess.message') }}</p>
      </div>

      <!-- 操作按钮 -->
      <div class="success-actions">
        <button class="action-btn action-btn--primary" @click="handleClick($event, goToHome)">
          <span class="btn-content">{{ t('topUpSuccess.backToHome') }}</span>
          <span class="btn-glow"></span>
          <span class="ripple-container"></span>
        </button>
        <button class="action-btn action-btn--secondary" @click="handleClick($event, goToUser)">
          <span class="btn-content">{{ t('topUpSuccess.viewAccount') }}</span>
          <span class="btn-border"></span>
          <span class="ripple-container"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const isCardVisible = ref(false)

onMounted(() => {
  // 延迟显示卡片以触发入场动画
  setTimeout(() => {
    isCardVisible.value = true
  }, 100)
})

const goToHome = () => {
  router.push('/')
}

const goToUser = () => {
  router.push('/user')
}

// 涟漪点击效果
const handleClick = (event: MouseEvent, callback: () => void) => {
  const button = event.currentTarget as HTMLElement
  const rippleContainer = button.querySelector('.ripple-container')
  if (!rippleContainer) {
    callback()
    return
  }

  const rect = button.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const size = Math.max(rect.width, rect.height) * 2

  const ripple = document.createElement('span')
  ripple.className = 'ripple'
  ripple.style.cssText = `
    left: ${x}px;
    top: ${y}px;
    width: ${size}px;
    height: ${size}px;
  `
  rippleContainer.appendChild(ripple)

  setTimeout(() => {
    ripple.remove()
    callback()
  }, 600)
}

// 背景粒子样式
const getParticleStyle = (_index: number) => {
  const random = (min: number, max: number) => Math.random() * (max - min) + min
  return {
    '--x': `${random(0, 100)}%`,
    '--y': `${random(0, 100)}%`,
    '--size': `${random(2, 6)}px`,
    '--duration': `${random(15, 30)}s`,
    '--delay': `${random(0, 10)}s`,
    '--opacity': random(0.3, 0.8),
  }
}

// 成功粒子样式
const getSuccessParticleStyle = (index: number) => {
  const angle = (index - 1) * 30
  return {
    '--angle': `${angle}deg`,
    '--delay': `${index * 0.05}s`,
  }
}
</script>

<style scoped lang="scss">
@use "sass:color";

// ============================================
// 设计变量 - 高科技工业风格
// ============================================
$brand-primary: var(--el-text-color-primary);
$brand-accent: var(--color-emerald-500);
$brand-glow: color-mix(in srgb, var(--el-color-primary) 60%, transparent);
$glass-bg-light: var(--color-white-8);
$glass-bg-dark: var(--color-black-40);
$glass-border: var(--border-unified-color);
$grid-color: var(--color-white-3);
$ts-text-primary: var(--el-bg-color);
$ts-text-secondary: var(--color-white-70);
$ts-text-muted: var(--color-white-50);

// ============================================
// 页面容器
// ============================================
.top-up-success-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(20px, 5vh, 40px) clamp(16px, 4vw, 28px);
  box-sizing: border-box;
  overflow: hidden;
  background: var(--color-dark-bg-1);
}

// ============================================
// 深度背景系统
// ============================================
.background-system {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-0);
}

// 光晕层
.glow-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.glow {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(100px);
  animation: glowFloat 20s ease-in-out infinite;

  &--primary {
    width: 600px;
    height: 600px;
    background: var(--color-emerald-10b981-08);
    top: -200px;
    right: -100px;
    animation-delay: 0s;
  }

  &--secondary {
    width: 500px;
    height: 500px;
    background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
    bottom: -150px;
    left: -100px;
    animation-delay: -7s;
  }

  &--accent {
    width: 400px;
    height: 400px;
    background: color-mix(in srgb, var(--el-color-primary) 4%, transparent);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation-delay: -14s;
  }
}

@keyframes glowFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -20px) scale(1.1); }
  50% { transform: translate(-20px, 30px) scale(0.95); }
  75% { transform: translate(20px, 20px) scale(1.05); }
}

// 粒子层
.particles-layer {
  position: absolute;
  inset: 0;
}

.particle {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--size);
  height: var(--size);
  background: $brand-accent;
  border-radius: var(--global-border-radius);
  opacity: var(--opacity);
  animation: particleFloat var(--duration) linear infinite;
  animation-delay: var(--delay);
}

@keyframes particleFloat {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: var(--opacity);
  }

  50% {
    opacity: calc(var(--opacity) * 0.5);
  }

  100% {
    transform: translateY(-100vh) rotate(360deg);
    opacity: var(--opacity);
  }
}

// ============================================
// 玻璃态卡片
// ============================================
.glass-card {
  position: relative;
  z-index: var(--z-base);
  width: 100%;
  max-width: 480px;
  padding: clamp(32px, 6vw, 56px) clamp(24px, 5vw, 48px);
  background: $glass-bg-dark;
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  text-align: center;

  // 入场动画
  opacity: 0;
  transform: translateY(40px) scale(0.95);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);

  &.card-visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  // 悬停效果
  &:hover {
    border-color: var(--border-unified-color-hover);

    .card-border-glow {
      opacity: 1;
    }
  }
}

// 卡片边框光效
.card-border-glow {
  position: absolute;
  inset: -1px;
  border-radius: var(--global-border-radius);
  background: transparent;
  border: var(--unified-border);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
  z-index: -1;
}

@keyframes borderRotate {
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(360deg); }
}

// ============================================
// 成功图标动画
// ============================================
.success-icon-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 32px;
}

// 图标环
.icon-ring {
  position: absolute;
  border-radius: var(--global-border-radius);
  border: 1px solid;

  &--outer {
    inset: 0;
    border-color: var(--color-emerald-10b981-20);
    animation: ringPulse 3s ease-in-out infinite;
  }

  &--middle {
    inset: 10px;
    border-color: var(--color-emerald-10b981-30);
    animation: ringPulse 3s ease-in-out infinite 0.5s;
  }

  &--inner {
    inset: 20px;
    border-color: var(--color-emerald-glow);
    animation: ringPulse 3s ease-in-out infinite 1s;
  }
}

@keyframes ringPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.05);
    opacity: 0.7;
  }
}

// 图标容器
.icon-container {
  position: absolute;
  inset: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
}

// SVG 勾选动画
.checkmark-svg {
  width: 52px;
  height: 52px;
}

.checkmark-circle {
  stroke: $brand-accent;
  stroke-width: 2;
  stroke-dasharray: 157;
  stroke-dashoffset: 157;
  animation: circleStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) 0.3s forwards;
}

.checkmark-check {
  stroke: $brand-accent;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: checkStroke 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes circleStroke {
  to { stroke-dashoffset: 0; }
}

@keyframes checkStroke {
  to { stroke-dashoffset: 0; }
}

// 成功粒子爆发
.success-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.success-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  background: $brand-accent;
  border-radius: var(--global-border-radius);
  opacity: 0;
  animation: particleBurst 1s ease-out 1.2s forwards;
  transform: rotate(var(--angle)) translateX(0);
}

@keyframes particleBurst {
  0% {
    opacity: 1;
    transform: rotate(var(--angle)) translateX(0);
  }

  100% {
    opacity: 0;
    transform: rotate(var(--angle)) translateX(80px);
  }
}

// ============================================
// 内容区域
// ============================================
.content-section {
  margin-bottom: 32px;
}

.success-title {
  position: relative;
  display: inline-block;
  margin: 0 0 16px;
  font-size: clamp(24px, 5vw, 32px);
  font-weight: 700;
  color: $ts-text-primary;
  letter-spacing: -0.02em;
}

.title-text {
  position: relative;
  z-index: var(--z-base);
}

.title-underline {
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 3px;
  background: $brand-accent;
  border-radius: var(--global-border-radius);
  animation: underlineExpand 0.6s ease-out 1.4s forwards;
}

@keyframes underlineExpand {
  to { width: 100%; }
}

.success-message {
  margin: 0;
  font-size: clamp(14px, 3vw, 16px);
  color: $ts-text-secondary;
  line-height: 1.6;
  letter-spacing: 0.01em;
}

// ============================================
// 操作按钮
// ============================================
.success-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;

  @media (width >= 400px) {
    flex-direction: row;
    justify-content: center;
  }
}

.action-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
  height: 48px;
  padding: 0 24px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .btn-content {
    position: relative;
    z-index: calc(var(--z-base) + 1);
  }

  // 主按钮
  &--primary {
    background: $brand-accent;
    color: var(--app-button-text-on-primary); // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
    box-shadow: var(--global-box-shadow);

    // 扫光效果已移至全局样式 (styles/index.scss)

    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--global-box-shadow);
    }

    &:active {
      transform: translateY(0);
    }
  }

  // 次按钮
  &--secondary {
    background: transparent;
    color: $ts-text-primary;

    .btn-border {
      position: absolute;
      inset: 0;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      transition: all 0.3s ease;
    }

    &:hover {
      .btn-border {
        border-color: var(--border-unified-color-hover);
        box-shadow: var(--global-box-shadow);
      }
    }

    &:active {
      .btn-border {
        background: var(--color-white-5);
      }
    }
  }
}

// 涟漪效果
.ripple-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

:deep(.ripple) {
  position: absolute;
  border-radius: var(--global-border-radius);
  background: var(--color-white-30);
  transform: translate(-50%, -50%) scale(0);
  animation: rippleEffect 0.6s ease-out forwards;
}

@keyframes rippleEffect {
  to {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
  }
}

// ============================================
// 亮色模式适配
// ============================================
:global(html:not(.dark)) {
  .top-up-success-page {
    background: var(--el-text-color-primary);
  }

  .glow {
    &--primary {
      background: var(--color-emerald-10b981-10);
    }

    &--secondary {
      background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
    }

    &--accent {
      background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
    }
  }

  .particle {
    /* 使用 color-mix 实现略深色，避免对 CSS 变量使用 SASS color.adjust 报错 */
    background: color-mix(in srgb, var(--color-emerald-500) 90%, black);
  }

  .glass-card {
    background: var(--color-white-70);
    border-color: var(--border-unified-color);
    box-shadow: var(--global-box-shadow);

    &:hover {
      border-color: var(--border-unified-color-hover);
    }
  }

  .success-title {
    color: var(--color-gray-111);
  }

  .success-message {
    color: var(--color-gray-666);
  }

  .action-btn--secondary {
    color: var(--color-gray-111);

    .btn-border {
      border-color: var(--border-unified-color-hover);
    }

    &:hover .btn-border {
      border-color: var(--border-unified-color-hover);
      box-shadow: var(--global-box-shadow);
    }
  }

  :deep(.ripple) {
    background: var(--color-black-15);
  }
}

// ============================================
// 响应式适配
// ============================================
@media (width <= 480px) {
  .glass-card {
    padding: 28px 20px;
    border-radius: var(--global-border-radius);
  }

  .success-icon-wrapper {
    width: 100px;
    height: 100px;
    margin-bottom: 24px;
  }

  .icon-container {
    inset: 20px;
  }

  .checkmark-svg {
    width: 44px;
    height: 44px;
  }

  .action-btn {
    width: 100%;
    min-width: unset;
  }
}

// ============================================
// 减少动画偏好
// ============================================
@media (prefers-reduced-motion: reduce) {
  .glow,
  .particle,
  .icon-ring,
  .card-border-glow {
    animation: none;
  }

  .glass-card {
    transition: none;
    opacity: 1;
    transform: none;
  }

  .checkmark-circle,
  .checkmark-check {
    animation: none;
    stroke-dashoffset: 0;
  }

  .success-particle {
    display: none;
  }

  .title-underline {
    animation: none;
    width: 100%;
  }
}
</style>
