<template>
  <div class="distribution-page" ref="pageRef">
    <!-- Loading状态（同步UniApp Loading组件） -->
    <div v-if="loading" class="dc-loading-overlay">
      <div class="dc-loading-spinner">
        <div class="dc-spinner"></div>
        <span class="dc-loading-text">{{ t('distribution.loading') || '加载中...' }}</span>
      </div>
    </div>

    <!-- 深度背景系统 -->
    <div class="dc-background">
      <!-- 光晕层 -->
      <div class="dc-glow-orb dc-glow-orb--1"></div>
      <div class="dc-glow-orb dc-glow-orb--2"></div>
      <div class="dc-glow-orb dc-glow-orb--3"></div>
    </div>

    <!-- 主内容区 -->
    <div class="dc-content">
      <!-- 页面头部 -->
      <header class="dc-header" v-scroll-reveal>
        <div class="dc-header__indicator"></div>
        <h1 class="dc-header__title">
          <span class="dc-header__icon">◈</span>
          {{ t('distribution.title') }}
        </h1>
        <div class="dc-header__line"></div>
      </header>

      <!-- 个人信息卡片 -->
      <section class="dc-section" v-scroll-reveal="{ delay: 100 }">
        <div class="dc-glass-card dc-glass-card--primary" @click="createRipple">
          <PersonalInfoCard :data="data" @withdraw="handleWithdraw" />
        </div>
      </section>

      <!-- 收益统计卡片 -->
      <section class="dc-section" v-scroll-reveal="{ delay: 200 }">
        <div class="dc-glass-card" @click="createRipple">
          <EarningsStatisticsCard
            :day-statistics="dayStatistics"
            :month-statistics="monthStatistics"
            :sum-statistics="sumStatistics"
            @tab-change="handleTabChange"
          />
        </div>
      </section>

      <!-- 功能区块 -->
      <section class="dc-section" v-scroll-reveal="{ delay: 300 }">
        <div class="dc-glass-card" @click="createRipple">
          <FunctionBlockColumn @show-qrcode="handleShowQrcode" />
        </div>
      </section>
    </div>

    <!-- 二维码弹窗 -->
    <el-dialog
      v-model="showQrcode"
      :title="t('distribution.qrcodeTitle')"
      width="400px"
      center
      class="dc-dialog"
    >
      <div class="dc-dialog__content">
        <div class="dc-qrcode-container">
          <div class="dc-qrcode-frame">
            <div class="dc-qrcode-corner dc-qrcode-corner--tl"></div>
            <div class="dc-qrcode-corner dc-qrcode-corner--tr"></div>
            <div class="dc-qrcode-corner dc-qrcode-corner--bl"></div>
            <div class="dc-qrcode-corner dc-qrcode-corner--br"></div>
            <!-- 二维码长按保存（同步UniApp show-menu-by-longpress，Web端用右键菜单） -->
            <img
              :src="qrcodeImage"
              alt="QR Code"
              class="dc-qrcode-image"
              loading="lazy"
              @contextmenu.prevent="showQrContextMenu"
              @touchstart="handleQrTouchStart"
              @touchend="handleQrTouchEnd"
            />
            <!-- 长按/右键上下文菜单 -->
            <div
              v-if="showContextMenu"
              class="dc-qrcode-context-menu"
              :style="{ top: contextMenuPos.y + 'px', left: contextMenuPos.x + 'px' }"
              @click.stop
            >
              <div class="dc-context-menu-item" @click="handleSaveQrcode">
                <span class="dc-context-menu-icon">↓</span>
                <span>{{ t('distribution.saveToAlbum') || '保存图片' }}</span>
              </div>
              <div class="dc-context-menu-item" @click="handleCopyQrcode">
                <span class="dc-context-menu-icon">📋</span>
                <span>{ t('distributionCenter.copyImage') }</span>
              </div>
              <div class="dc-context-menu-item" @click="handleShare">
                <span class="dc-context-menu-icon">↗</span>
                <span>{{ t('distribution.shareToFriend') || '分享' }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="dc-qrcode-footer">
          <div class="dc-qrcode-title">{{ t('distribution.qrcodeTitle') }}</div>
          <div class="dc-qrcode-copyright">COPYRIGHT © 2025-2035 IHUIINF AGI ALL RIGHTS RESERVED.</div>
          <div class="dc-qrcode-actions">
            <!-- 分享给好友（同步UniApp open-type="share"） -->
            <button class="dc-btn dc-btn--primary dc-btn--ripple" @click="handleShare">
              <span class="dc-btn__text">{{ t('distribution.shareToFriend') || '分享给好友' }}</span>
              <span class="dc-btn__icon">↗</span>
            </button>
            <!-- 保存到相册（同步UniApp handleSave） -->
            <button class="dc-btn dc-btn--ghost dc-btn--ripple" @click="handleSaveQrcode">
              <span class="dc-btn__text">{{ t('distribution.saveToAlbum') || '保存到相册' }}</span>
              <span class="dc-btn__icon">↓</span>
            </button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 实名认证弹窗 -->
    <el-dialog
      v-model="showVerify"
      :title="t('distribution.verifyTitle')"
      width="500px"
      class="dc-dialog"
    >
      <div class="dc-dialog__content">
        <div class="dc-verify-avatar">
          <div class="dc-avatar-ring">
            <div class="dc-avatar-ring__inner"></div>
            <img :src="avatarPic || defaultAvatar" alt="Avatar" class="dc-avatar-image" loading="lazy" />
          </div>
        </div>
        <div class="dc-verify-title">{{ t('distribution.verifyText') }}</div>
        <el-form :model="verifyForm" label-position="top" class="dc-form">
          <el-form-item :label="t('distribution.idNumber')">
            <el-input
              v-model="verifyForm.idNumber"
              :placeholder="t('distribution.idNumberPlaceholder')"
              class="dc-input"
            />
          </el-form-item>
          <el-form-item :label="t('distribution.realName')">
            <el-input
              v-model="verifyForm.realName"
              :placeholder="t('distribution.realNamePlaceholder')"
              class="dc-input"
            />
          </el-form-item>
        </el-form>
        <div class="dc-verify-actions">
          <button class="dc-btn dc-btn--ghost dc-btn--ripple" @click="showVerify = false">
            {{ t('common.cancel') }}
          </button>
          <button class="dc-btn dc-btn--primary dc-btn--ripple" @click="handleVerify">
            {{ t('distribution.confirm') }}
          </button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// 自定义指令类型
interface ScrollRevealBinding {
  value?: { delay?: number }
}

interface ScrollRevealDirective {
  mounted(el: HTMLElement, binding: ScrollRevealBinding): void
  unmounted(el: HTMLElement): void
}
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import type { UserInfoData } from '@/api/user'
import { useCleanup } from '@/composables/useCleanup'
import {
  getOperatorDataCardData,
  getInviteCode,
  getWxCode,
  realAuth,
} from '@/api/distribution'
import PersonalInfoCard from './distribution/components/PersonalInfoCard.vue'
import EarningsStatisticsCard from './distribution/components/EarningsStatisticsCard.vue'
import FunctionBlockColumn from './distribution/components/FunctionBlockColumn.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const pageRef = ref<HTMLElement | null>(null)
const cleanup = useCleanup()

// Loading状态（同步UniApp Loading组件）
const loading = ref(false)

// 滚动动画指令
// 用 WeakMap 存储每个元素对应的 observer，便于卸载时 disconnect
const observerMap = new WeakMap<HTMLElement, IntersectionObserver>()
const vScrollReveal: ScrollRevealDirective = {
  mounted(el: HTMLElement, binding: ScrollRevealBinding) {
    const options = binding.value || {}
    const delay = options.delay || 0

    el.style.opacity = '0'
    el.style.transform = 'translateY(30px)'
    el.style.transition = `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    observerMap.set(el, observer)
  },
  unmounted(el: HTMLElement) {
    const observer = observerMap.get(el)
    if (observer) {
      observer.disconnect()
      observerMap.delete(el)
    }
  },
}

// 涟漪点击效果
const createRipple = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const ripple = document.createElement('span')
  const rect = target.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = event.clientX - rect.left - size / 2
  const y = event.clientY - rect.top - size / 2

  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: radial-gradient(circle, color-mix(in srgb, var(--el-color-primary) 30%, transparent) 0%, transparent 70%);
    border-radius: var(--global-border-radius);
    transform: scale(0);
    animation: dc-ripple 0.6s ease-out forwards;
    pointer-events: none;
  `
  target.style.position = 'relative'
  target.style.overflow = 'hidden'
  target.appendChild(ripple)

  setTimeout(() => ripple.remove(), 600)
}

// 清理函数
const data = ref({
  totalIncome: 0,
  currentAmount: 0,
})

const dayStatistics = ref({
  amount: 0,
  incomplete: 0,
  finish: 0,
  order: 0,
  strength: 0,
  endAmount: 0,
})

const monthStatistics = ref({
  amount: 0,
  incomplete: 0,
  finish: 0,
  order: 0,
  strength: 0,
  endAmount: 0,
})

const sumStatistics = ref({
  amount: 0,
  incomplete: 0,
  finish: 0,
  order: 0,
  strength: 0,
  endAmount: 0,
})

const showQrcode = ref(false)
const qrcodeImage = ref('')
const showVerify = ref(false)

// 二维码长按/右键菜单（同步UniApp show-menu-by-longpress）
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
let longPressTimer: ReturnType<typeof setTimeout> | null = null
cleanup.add(() => { if (longPressTimer) clearTimeout(longPressTimer) })
const avatarPic = ref('')
const defaultAvatar = '/images/common/userIcon.svg'
const verifyForm = ref({
  idNumber: '',
  realName: '',
})

// 分享功能（同步UniApp open-type="share"）
const handleShare = async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: t('distributionCenter.distributionTitle'),
        text: '加入AI智汇社，开启智能分销之旅',
        url: window.location.href,
      })
      ElMessage.success(t('distribution.shareSuccess') || '分享成功')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        logger.warn('Share failed:', err)
        fallbackCopyLink()
      }
    }
  } else {
    fallbackCopyLink()
  }
}

// 降级方案：复制链接
const fallbackCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success(t('distribution.linkCopied') || '链接已复制到剪贴板')
  } catch {
    ElMessage.warning(t('distribution.copyFailed') || '复制失败，请手动复制')
  }
}

// 二维码右键菜单（同步UniApp show-menu-by-longpress，Web端用contextmenu事件）
const showQrContextMenu = (e: MouseEvent) => {
  contextMenuPos.value = { x: e.offsetX, y: e.offsetY }
  showContextMenu.value = true
}

// 长按检测（移动端touch事件模拟show-menu-by-longpress）
const handleQrTouchStart = (e: TouchEvent) => {
  const _touch = e.touches[0]
  longPressTimer = setTimeout(() => {
    contextMenuPos.value = { x: 0, y: 0 }
    showContextMenu.value = true
  }, 500)
}

const handleQrTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// 点击其他区域关闭菜单
const hideContextMenu = () => {
  showContextMenu.value = false
}

// 复制二维码图片（Web端替代UniApp复制图片能力）
const handleCopyQrcode = async () => {
  showContextMenu.value = false
  if (!qrcodeImage.value) return
  try {
    const response = await fetch(qrcodeImage.value)
    const blob = await response.blob()
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ])
    ElMessage.success(t('distributionCenter.imageCopied'))
  } catch {
    ElMessage.info(t('distributionCenter.longPressToSave'))
  }
}

// 保存二维码到相册（同步UniApp handleSave）
const handleSaveQrcode = async () => {
  showContextMenu.value = false
  if (!qrcodeImage.value) {
    ElMessage.warning(t('distribution.noQrcode') || '暂无二维码')
    return
  }

  try {
    // 尝试使用 canvas 下载
    const response = await fetch(qrcodeImage.value)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'qrcode.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success(t('distribution.downloadSuccess') || '保存成功')
  } catch (_err) {
    // 降级：直接打开图片
    window.open(qrcodeImage.value, '_blank')
    ElMessage.info(t('distribution.openImage') || '已在新窗口打开图片，请右键保存')
  }
}

onMounted(() => {
  fetchDistributionData()
  fetchQrcode()
  const user = authStore.user as UserInfoData | null
  avatarPic.value = user?.avatar || ''
  // 点击页面其他区域关闭右键菜单
  cleanup.addEventListener(document, 'click', hideContextMenu as EventListener)
})

const fetchDistributionData = async () => {
  loading.value = true
  try {
    const result = await getOperatorDataCardData()
    if (result.success && result.data) {
      data.value = result.data

      if (result.data.dayStatistics) {
        dayStatistics.value = result.data.dayStatistics
      }

      if (result.data.monthStatistics) {
        monthStatistics.value = result.data.monthStatistics
      }

      if (result.data.sumStatistics) {
        sumStatistics.value = result.data.sumStatistics
      }
    }
  } catch (error) {
    logger.error('Failed to get distribution data:', error)
  } finally {
    loading.value = false
  }
}

const fetchQrcode = async () => {
  try {
    const inviteCodeRes = await getInviteCode()
    if (inviteCodeRes.success && inviteCodeRes.data) {
      const qrRes = await getWxCode(inviteCodeRes.data.invite_code)
      if (qrRes.success && qrRes.data) {
        qrcodeImage.value = qrRes.data
      }
    }
  } catch (error) {
    logger.error('Failed to get QR code:', error)
  }
}

const handleTabChange = (tab: string) => {
  logger.info('Switching to:', tab)
}

const handleShowQrcode = () => {
  showQrcode.value = true
}

const _handleDownloadQrcode = () => {
  const link = document.createElement('a')
  link.href = qrcodeImage.value
  link.download = 'qrcode.png'
  link.click()
  ElMessage.success(t('distribution.downloadSuccess'))
}

const handleWithdraw = () => {
  if (data.value.currentAmount <= 0) {
    ElMessage.warning(t('distribution.noWithdrawAmount'))
    return
  }

  const _user = authStore.user as UserInfoData | null
  const authInfo = authStore.authInfo as { realName?: string; idCard?: string } | null
  if (!authInfo?.realName && !authInfo?.idCard) {
    showVerify.value = true
  } else {
    ElMessage.info(t('distribution.withdrawFeature'))
  }
}

const handleVerify = async () => {
  try {
    const user = authStore.user as UserInfoData | null
    const uuid = user?.uuid || ''

    if (!uuid) {
      ElMessage.error(t('distribution.verifyFailed'))
      return
    }

    const result = await realAuth(
      verifyForm.value.realName,
      verifyForm.value.idNumber,
      uuid,
    )
    if (result.success || result.code === 200) {
      ElMessage.success(t('distribution.verifySuccess'))
      showVerify.value = false
    } else {
      ElMessage.error(result.message || t('distribution.verifyFailed'))
    }
  } catch (error) {
    logger.error('Real name authentication failed:', error)
    ElMessage.error(t('distribution.verifyFailed'))
  }
}
</script>

<style scoped lang="scss">
// ============================================
// 高科技工业风格 - Distribution Center
// Design: 深度背景 + 玻璃态 + 滚动动画 + 涟漪
// ============================================

// 设计令牌
$brand-primary: var(--el-text-color-primary);
$brand-accent: var(--el-bg-color);
$surface-glass: var(--color-white-3);
$surface-glass-hover: var(--color-white-6);
$border-subtle: var(--border-unified-color);
$border-active: var(--border-unified-color-hover);
$text-primary: var(--color-gray-ededed);
$text-secondary: var(--color-gray-888888);
$text-muted: var(--color-gray-555555);
$glow-primary: var(--color-white-5);
$glow-accent: color-mix(in srgb, var(--el-color-primary) 30%, transparent);

// 涟漪动画
@keyframes dc-ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }

  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

// 光晕呼吸动画
@keyframes dc-glow-pulse {
  0%, 100% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(1);
  }

  50% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

// 指示器闪烁
@keyframes dc-blink {
  0%, 100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

// 主容器
.distribution-page {
  position: relative;
  min-height: 100vh;
  background: $brand-primary;
  overflow-x: hidden;
}

// ============================================
// 深度背景系统
// ============================================
.dc-background {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-0);
}

// 光晕球体
.dc-glow-orb {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(100px);
  animation: dc-glow-pulse 8s ease-in-out infinite;

  &--1 {
    width: 600px;
    height: 600px;
    background: $glow-accent;
    top: 10%;
    left: 20%;
    animation-delay: 0s;
  }

  &--2 {
    width: 400px;
    height: 400px;
    background: var(--color-gray-3c3c3c-20);
    top: 60%;
    right: 10%;
    animation-delay: 2s;
  }

  &--3 {
    width: 300px;
    height: 300px;
    background: var(--color-gray-505050-15);
    bottom: 20%;
    left: 40%;
    animation-delay: 4s;
  }
}

// ============================================
// 主内容区
// ============================================
.dc-content {
  position: relative;
  z-index: var(--z-base);
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 60px;
}

// ============================================
// 页面头部
// ============================================
.dc-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 40px;
  padding-bottom: 24px;
  border-bottom: var(--unified-border-bottom);

  &__indicator {
    width: 8px;
    height: 8px;
    background: $text-secondary;
    border-radius: var(--global-border-radius);
    animation: dc-blink 2s ease-in-out infinite;
  }

  &__icon {
    font-size: 24px;
    color: $text-secondary;
    margin-right: 8px;
    letter-spacing: 0.02em;
  }

  &__title {
    font-size: 28px;
    font-weight: 600;
    color: $text-primary;
    letter-spacing: -0.02em;
    margin: 0;
    display: flex;
    align-items: center;
  }

  &__line {
    flex: 1;
    height: 1px;
    background: $border-active;
  }
}

// ============================================
// 内容区块
// ============================================
.dc-section {
  margin-bottom: 24px;
}

// ============================================
// 玻璃态卡片
// ============================================
.dc-glass-card {
  position: relative;
  background: $surface-glass;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 24px;
  backdrop-filter: blur(20px);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  // 顶部高光
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--color-white-5);
  }

  &:hover {
    background: $surface-glass-hover;
    border-color: $border-active;
    transform: translateY(-2px);
  }

  &--primary {
    border-color: $border-active;

    &::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: var(--color-white-01);
      pointer-events: none;
    }
  }
}

// ============================================
// 弹窗样式
// ============================================
.dc-dialog {
  :deep(.el-dialog) {
    background: var(--color-dark-141414-95);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    backdrop-filter: blur(30px);
    box-shadow: var(--global-box-shadow);

    .el-dialog__header {
      border-bottom: var(--unified-border-bottom);
      padding: 20px 24px;

      .el-dialog__title {
        color: $text-primary;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
    }

    .el-dialog__body {
      padding: 24px;
    }
  }

  &__content {
    text-align: center;
  }
}

// 二维码容器
.dc-qrcode-container {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.dc-qrcode-frame {
  position: relative;
  padding: 16px;
  background: var(--color-white-2);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.dc-qrcode-corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: $text-secondary;
  border-style: solid;
  border-width: 0;

  &--tl {
    top: -1px;
    left: -1px;
    border-top-width: 2px;
    border-left-width: 2px;
    border-top-left-radius: var(--global-border-radius);
  }

  &--tr {
    top: -1px;
    right: -1px;
    border-top-width: 2px;
    border-right-width: 2px;
    border-top-right-radius: var(--global-border-radius);
  }

  &--bl {
    bottom: -1px;
    left: -1px;
    border-bottom-width: 2px;
    border-left-width: 2px;
    border-bottom-left-radius: var(--global-border-radius);
  }

  &--br {
    bottom: -1px;
    right: -1px;
    border-bottom-width: 2px;
    border-right-width: 2px;
    border-bottom-right-radius: var(--global-border-radius);
  }
}

.dc-qrcode-image {
  width: 240px;
  height: 240px;
  border-radius: var(--global-border-radius);
  display: block;
}

.dc-qrcode-footer {
  .dc-qrcode-title {
    font-size: 18px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
  }

  .dc-qrcode-copyright {
    font-size: 12px;
    color: $text-muted;
    letter-spacing: 0.02em;
    margin-bottom: 20px;
    font-family: var(--font-family-mono);
  }
}

// 实名认证
.dc-verify-avatar {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.dc-avatar-ring {
  position: relative;
  width: 120px;
  height: 120px;

  &__inner {
    position: absolute;
    inset: -4px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    animation: dc-glow-pulse 3s ease-in-out infinite;
  }
}

.dc-avatar-image {
  width: 100%;
  height: 100%;
  border-radius: var(--global-border-radius);
  border: 2px solid $border-subtle;
  object-fit: cover;
}

.dc-verify-title {
  font-size: 22px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 28px;
  letter-spacing: -0.02em;
}

// 表单样式
.dc-form {
  text-align: left;
  margin-bottom: 24px;

  :deep(.el-form-item__label) {
    color: $text-secondary;
    font-size: 13px;
    letter-spacing: 0.01em;
  }

  :deep(.el-input__wrapper) {
    background: var(--color-white-3);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    box-shadow: none;
    transition: all 0.3s ease;

    &:hover,
    &.is-focus {
      border-color: $border-active;
      background: var(--color-white-5);
    }

    .el-input__inner {
      color: $text-primary;

      &::placeholder {
        color: $text-muted;
      }
    }
  }
}

.dc-verify-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

// ============================================
// Loading组件样式（同步UniApp Loading组件）
// ============================================
.dc-loading-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-black-50);
  backdrop-filter: blur(4px);
  z-index: var(--z-notification);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dc-loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  background: $surface-glass;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  backdrop-filter: blur(20px);
}

.dc-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid $border-subtle;
  border-top-color: $text-primary;
  border-radius: 50%;
  animation: dc-spin 0.8s linear infinite;
}

@keyframes dc-spin {
  to {
    transform: rotate(360deg);
  }
}

.dc-loading-text {
  font-size: 14px;
  color: $text-secondary;
  letter-spacing: 0.02em;
}

// ============================================
// 二维码弹窗操作按钮
// ============================================
.dc-qrcode-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

// ============================================
// 二维码右键/长按菜单（同步UniApp show-menu-by-longpress）
// ============================================
.dc-qrcode-context-menu {
  position: absolute;
  background: var(--color-dark-141414-95);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  backdrop-filter: blur(20px);
  box-shadow: var(--global-box-shadow);
  z-index: calc(var(--z-base) + 9);
  min-width: 160px;
  padding: 4px 0;
  animation: dc-menu-fadeIn 0.15s ease-out;
}

@keyframes dc-menu-fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dc-context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  font-size: 13px;
  color: $text-primary;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: $surface-glass-hover;
  }

  .dc-context-menu-icon {
    font-size: 14px;
    width: 20px;
    text-align: center;
  }
}

// ============================================
// 按钮样式
// ============================================
.dc-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 28px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
  border-radius: var(--global-border-radius);
  border: none;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  &--primary {
    background: $text-primary;
    color: $brand-primary;

    &:hover {
      background: var(--el-bg-color);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }
  }

  &--ghost {
    background: transparent;
    color: $text-secondary;
    border: var(--unified-border);

    &:hover {
      border-color: $border-active;
      color: $text-primary;
    }
  }

  &--ripple {
    overflow: hidden;
  }

  &__icon {
    font-size: 16px;
  }
}

// ============================================
// 响应式设计
// ============================================
@media (width <= 768px) {
  .dc-content {
    padding: 24px 16px 40px;
  }

  .dc-header {
    flex-wrap: wrap;
    gap: 12px;

    &__title {
      font-size: 22px;
    }

    &__line {
      display: none;
    }
  }

  .dc-glass-card {
    padding: 16px;
    border-radius: var(--global-border-radius);
  }

  .dc-qrcode-image {
    width: 200px;
    height: 200px;
  }

  .dc-glow-orb {
    &--1 {
      width: 300px;
      height: 300px;
    }

    &--2 {
      width: 200px;
      height: 200px;
    }

    &--3 {
      display: none;
    }
  }
}

@media (width <= 480px) {
  .dc-content {
    padding: 16px 12px 32px;
  }

  .dc-header {
    &__indicator {
      display: none;
    }

    &__title {
      font-size: 20px;
    }
  }

  .dc-glass-card {
    padding: 12px;
  }

  .dc-qrcode-image {
    width: 160px;
    height: 160px;
  }

  .dc-avatar-ring {
    width: 100px;
    height: 100px;
  }

  .dc-verify-title {
    font-size: 18px;
  }

  .dc-btn {
    padding: 10px 20px;
    font-size: 13px;
  }
}

// ============================================
// 暗色模式适配（已是暗色主题）
// 当前已是暗色设计，无需额外调整
// ============================================
</style>
