<template>
  <div class="user-center-container" ref="containerRef">
    <!-- 深度背景系统 -->
    <div class="uc-background">
      <!-- 光晕层 -->
      <div class="uc-glow-orb uc-glow-orb--primary"></div>
      <div class="uc-glow-orb uc-glow-orb--secondary"></div>
      <!-- 噪点纹理 -->
      <div class="uc-noise-overlay"></div>
    </div>

    <div class="user-center-content">
      <!-- 用户信息卡片 - 玻璃态 -->
      <div
        class="uc-glass-card uc-glass-card--hero uc-scroll-reveal"
        :class="{ 'uc-scroll-reveal--visible': visibleSections.hero }"
        @click="createRipple($event)"
      >
        <div class="uc-card-glow"></div>
        <UserInfoCard
          :userInfo="currentUser"
          :showRechargeBtn="true"
          @edit-profile="handleEditProfile"
          @update:login-out="handleLoginOut"
          @open-level-introduce-popup="handleOpenLevelIntroducePopup"
          @open-introduce-popup="handleOpenIntroducePopup"
          @open-introduce-popups="handleOpenIntroducePopups"
          @open-privateadvisory-popup="handleOpenPrivateAdvisoryPopup"
        />
      </div>

      <!-- 用户卡片 - 玻璃态 -->
      <div
        v-if="isLoggedIn"
        class="uc-glass-card uc-scroll-reveal"
        :class="{ 'uc-scroll-reveal--visible': visibleSections.userCard }"
        @click="createRipple($event)"
      >
        <div class="uc-card-glow"></div>
        <UserCard @handle-click="handleCardClick" />
      </div>

      <!-- 会员权益 - 玻璃态折叠面板 -->
      <div
        v-if="isLoggedIn && !isShow"
        class="uc-glass-card uc-glass-card--collapsible uc-scroll-reveal"
        :class="{ 'uc-scroll-reveal--visible': visibleSections.benefits }"
      >
        <div class="uc-card-glow"></div>
        <div
          class="membership-benefits-header"
          @click="toggleMembershipBenefits"
        >
          <span class="uc-header-text">{{ t('userCenter.membershipBenefits') }}</span>
          <div
            class="membership-benefits-arrow"
            :class="{ 'arrow-rotate': showMembershipBenefits }"
          >
            <svg
              class="uc-arrow-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
        <Transition name="uc-collapse">
          <div v-show="showMembershipBenefits" class="membership-benefits-content">
            <UserMembershipBenefits @open-introduces="handleOpenIntroduces" />
          </div>
        </Transition>
      </div>

      <!-- 网站链接 - 工业风格按钮 -->
      <div
        class="uc-link-section uc-scroll-reveal"
        :class="{ 'uc-scroll-reveal--visible': visibleSections.link }"
      >
        <div
          class="uc-industrial-btn"
          @click="copyWebsiteLink"
        >
          <div class="uc-btn-border"></div>
          <div class="uc-btn-content">
            <img
              class="website-link-image"
              src="https://file.aizhs.top/sys-mini/yejiao.png"
              alt="Website Link"
              loading="lazy"
            />
          </div>
          <div class="btn-glow"></div>
        </div>
      </div>
    </div>

    <!-- 弹窗保持原样 -->
    <LoginPopup
      v-if="showLoginPopup"
      :loginInfo="currentUser"
      @login="handleLogin"
      @close="handleCloseLoginPopup"
      @update:login-out="handleLoginOut"
    />

    <ImageSharePopup v-if="showImageSharePopup" @close="closeImageSharePopup" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import UserInfoCard from '@/components/user/UserInfoCard.vue'
import UserCard from '@/components/user/UserCard.vue'
import UserMembershipBenefits from '@/components/user/UserMembershipBenefits.vue'
import LoginPopup from '@/components/user/LoginPopup.vue'
import ImageSharePopup from '@/components/user/ImageSharePopup.vue'

const { t } = useI18n()

const cleanup = useCleanup()

// 滚动动画相关
const containerRef = ref<HTMLElement | null>(null)
const visibleSections = reactive({
  hero: false,
  userCard: false,
  benefits: false,
  link: false,
})

// 涟漪效果
function createRipple(event: MouseEvent) {
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
    background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    border-radius: var(--global-border-radius);
    transform: scale(0);
    animation: uc-ripple 0.6s ease-out forwards;
    pointer-events: none;
    z-index: calc(var(--z-base) + 9);
  `
  target.appendChild(ripple)
  setTimeout(() => ripple.remove(), 600)
}

// 滚动观察器
let scrollObserver: IntersectionObserver | null = null

function setupScrollObserver() {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const section = el.dataset.section
          if (section && section in visibleSections) {
            visibleSections[section as keyof typeof visibleSections] = true
          }
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  )
  cleanup.add(cleanupScrollObserver)

  nextTick(() => {
    const sections = document.querySelectorAll('.uc-scroll-reveal')
    sections.forEach((el, index) => {
      const sectionKeys = ['hero', 'userCard', 'benefits', 'link']
      ;(el as HTMLElement).dataset.section = sectionKeys[index] || 'hero'
      scrollObserver?.observe(el)
    })
  })
}

function cleanupScrollObserver() {
  scrollObserver?.disconnect()
  scrollObserver = null
}

interface UserInfo {
  uuid?: string
  openId?: string
  isLoggedIn: boolean
  username: string
  isVip: number | null
  knowledgeBaseQuota: string
  remainingTokens: string
  userId: string
  avatarUrl: string
  memberLevelText: string
  nextLevelInfoText: string
  identityType: number
  tokenQuantity: number
  phone?: string
  zhsToken?: string
}

const router = useRouter()
const authStore = useAuthStore()
const { initCompleted } = storeToRefs(authStore)

interface UserWithVip {
  uuid?: string
  username?: string
  nickname?: string
  avatar?: string
  phone?: string
  isVip?: boolean
  vipLevelVO?: { levelName?: string }
  identityType?: number
}

// 使用 computed 属性，自动响应 authStore 的变化
const currentUser = computed<UserInfo>(() => {
  const user = authStore.user as UserWithVip | null
  if (authStore.isLoggedIn && user) {
    return {
      uuid: user.uuid,
      openId: '',
      isLoggedIn: true,
      username: user.nickname || user.username || t('userCenter.defaultUsername'),
      isVip: user.isVip ? 1 : 0,
      knowledgeBaseQuota: String(authStore.balance || 0),
      remainingTokens: String(authStore.balance || 0),
      tokenQuantity: authStore.balance || 0,
      userId: user.uuid || '',
      avatarUrl: user.avatar || 'https://file.aizhs.top/sys-mini/daixaodiming.png',
      memberLevelText: user.vipLevelVO?.levelName || (user.isVip ? t('userCenter.vipMember') : t('userCenter.regularMember')),
      nextLevelInfoText: t('userCenter.openMembershipPrivilege'),
      identityType: user.identityType || 0,
      phone: user.phone || '',
      zhsToken: '',
    }
  }
  return {
    isLoggedIn: false,
    username: '',
    isVip: null,
    knowledgeBaseQuota: '',
    remainingTokens: '',
    userId: '',
    avatarUrl: '',
    memberLevelText: t('userCenter.regularMember'),
    nextLevelInfoText: t('userCenter.openMembershipPrivilege'),
    identityType: 0,
    tokenQuantity: 0,
  }
})

const showLoginPopup = ref(false)
const showImageSharePopup = ref(false)
const showMembershipBenefits = ref(false)
const isShow = ref(false)

const isLoggedIn = computed(() => authStore.isLoggedIn)

onMounted(async () => {
  // 等待 authStore 初始化完成（最多等待3秒）
  let attempts = 0
  const maxAttempts = 30 // 30 * 100ms = 3秒
  while (!initCompleted.value && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }
  if (attempts >= maxAttempts) {
    logger.warn('[UserCenter] Waiting for authStore initialization timeout')
  } else {
    logger.debug('[UserCenter] authStore initialization complete')
  }
  checkPlatform()
  setupEventListeners()
  setupScrollObserver()
})

function checkPlatform() {
  const userAgent = navigator.userAgent
  isShow.value = /iPad|iPhone|iPod/.test(userAgent) && !(window as Window & { MSStream?: any }).MSStream
}

function setupEventListeners() {
  cleanup.addEventListener(window, 'showImageSharePopup', handleShowImageSharePopup as EventListener)
}

function handleShowImageSharePopup() {
  showImageSharePopup.value = true
}

function handleEditProfile() {
  if (!currentUser.value.isLoggedIn) {
    showLoginPopup.value = true
  } else {
    router.push('/settings')
  }
}

function handleLoginOut(data: UserInfo) {
  currentUser.value = data
  authStore.logout()
  showLoginPopup.value = false
}

function handleLogin(event: any) {
  logger.info('[UserCenter] User logged in', { event })
  authStore.fetchUserInfo()
  showLoginPopup.value = false
}

function handleCloseLoginPopup() {
  showLoginPopup.value = false
}

function handleOpenLevelIntroducePopup() {
  router.push('/vip/details?type=levelPopup')
}

function handleOpenIntroducePopup() {
  router.push('/vip/details?type=IntroducePopup')
}

function handleOpenIntroducePopups() {
  router.push('/vip/details?type=IntroducePopups')
}

function handleOpenPrivateAdvisoryPopup() {
  router.push('/vip/details?type=PrivateAdvisory')
}

function handleOpenIntroduces() {
  if (currentUser.value.isVip === 0) {
    handleOpenIntroducePopup()
  } else if (currentUser.value.isVip === 1) {
    handleOpenIntroducePopups()
  } else {
    handleOpenPrivateAdvisoryPopup()
  }
}

function handleCardClick(key: string) {
  if (!isLoggedIn.value) {
    showLoginPopup.value = true
    return
  }

  const routes: Record<string, string> = {
    order: '/orders',
    money: '/top-up',
    token: '/token-value',
    model: '/agents',
    distribution: '/distribution',
  }

  if (routes[key]) {
    router.push(routes[key])
  }
}

function toggleMembershipBenefits() {
  showMembershipBenefits.value = !showMembershipBenefits.value
}

function closeImageSharePopup() {
  showImageSharePopup.value = false
}

function copyWebsiteLink() {
  const websiteUrl = 'https://www.aizhs.top'
  navigator.clipboard
    .writeText(websiteUrl)
    .then(() => {
      ElMessage.success(t('userCenter.copyWebsite.success'))
    })
    .catch(() => {
      ElMessage.error(t('userCenter.copyWebsite.failed'))
    })
}

function _formatTokenValue(value: number): string {
  if (value >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿'
  } else if (value >= 10000) {
    return (value / 10000).toFixed(2) + '万'
  } else {
    return value.toString()
  }
}
</script>

<style scoped lang="scss">
// ============================================
// 高科技工业风格 - UserCenter
// ============================================

// 设计令牌
$uc-brand-primary: var(--el-bg-color-page);
$uc-brand-accent: var(--el-fill-color-darker);
$uc-surface-dark: var(--el-bg-color-page);
$uc-surface-card: var(--el-fill-color-lighter);
$uc-border-subtle: var(--border-unified-color);
$uc-border-glow: var(--border-unified-color-hover);
$uc-text-primary: var(--el-text-color-primary);
$uc-text-secondary: var(--el-text-color-regular);
$uc-glow-primary: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
$uc-glow-secondary: color-mix(in srgb, var(--el-color-primary) 30%, transparent);

// 动画时间
$uc-transition-fast: 0.15s;
$uc-transition-normal: 0.3s;
$uc-transition-slow: 0.6s;

// 涟漪动画
@keyframes uc-ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }

  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

// 光晕脉动
@keyframes uc-glow-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

// 滚动淡入
@keyframes uc-fade-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// 主容器
// ============================================
.user-center-container {
  position: relative;
  min-height: 100vh;
  background: $uc-surface-dark;
  padding: 24px;
  overflow-x: hidden;
  color: $uc-text-primary;
}

// ============================================
// 深度背景系统
// ============================================
.uc-background {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-0);
  overflow: hidden;
}

// 光晕
.uc-glow-orb {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(100px);
  animation: uc-glow-pulse 8s ease-in-out infinite;

  &--primary {
    width: 500px;
    height: 500px;
    top: -150px;
    right: -100px;
    background: $uc-glow-primary;
  }

  &--secondary {
    width: 400px;
    height: 400px;
    bottom: -100px;
    left: -100px;
    background: $uc-glow-secondary;
    animation-delay: 4s;
  }
}

// 噪点纹理
.uc-noise-overlay {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  mix-blend-mode: overlay;
}

// ============================================
// 内容区域
// ============================================
.user-center-content {
  position: relative;
  z-index: var(--z-base);
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// ============================================
// 玻璃态卡片
// ============================================
.uc-glass-card {
  position: relative;
  background: $uc-surface-card;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition:
    transform $uc-transition-normal cubic-bezier(0.4, 0, 0.2, 1),
    border-color $uc-transition-normal;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-white-2);
    pointer-events: none;
  }

  &:hover {
    border-color: $uc-border-glow;
    transform: translateY(-2px);
  }

  &--hero {
    border-radius: var(--global-border-radius);
  }

  &--collapsible {
    .membership-benefits-header {
      padding: 16px 20px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: var(--unified-border-bottom);
      transition: border-color $uc-transition-normal;

      &:hover {
        border-bottom-color: $uc-border-subtle;
      }
    }
  }
}

// 卡片内部光晕
.uc-card-glow {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 1px;
  background: var(--color-white-8);
}

// ============================================
// 滚动动画
// ============================================
.uc-scroll-reveal {
  opacity: 0;
  transform: translateY(30px);
  transition:
    opacity $uc-transition-slow cubic-bezier(0.4, 0, 0.2, 1),
    transform $uc-transition-slow cubic-bezier(0.4, 0, 0.2, 1);

  &--visible {
    opacity: 1;
    transform: translateY(0);
  }

  @for $i from 1 through 4 {
    &:nth-child(#{$i}) {
      transition-delay: #{($i - 1) * 0.1}s;
    }
  }
}

// ============================================
// 会员权益面板
// ============================================
.uc-header-text {
  font-size: 15px;
  font-weight: 500;
  color: $uc-text-primary;
  letter-spacing: 0.02em;
}

.membership-benefits-arrow {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform $uc-transition-normal cubic-bezier(0.4, 0, 0.2, 1);

  &.arrow-rotate {
    transform: rotate(180deg);
  }
}

.uc-arrow-icon {
  width: 18px;
  height: 18px;
  color: $uc-text-secondary;
  transition: color $uc-transition-fast;

  .membership-benefits-header:hover & {
    color: $uc-text-primary;
  }
}

.membership-benefits-content {
  padding: 0 20px 20px;
}

// 折叠动画
.uc-collapse-enter-active,
.uc-collapse-leave-active {
  transition:
    max-height $uc-transition-normal cubic-bezier(0.4, 0, 0.2, 1),
    opacity $uc-transition-normal;
  overflow: hidden;
}

.uc-collapse-enter-from,
.uc-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.uc-collapse-enter-to,
.uc-collapse-leave-from {
  max-height: 500px;
  opacity: 1;
}

// ============================================
// 工业风格链接按钮
// ============================================
.uc-link-section {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.uc-industrial-btn {
  position: relative;
  width: 100%;
  cursor: pointer;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: transform $uc-transition-normal cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.01);

    .uc-btn-border {
      opacity: 1;
    }

    // 扫光效果已移至全局样式 (styles/index.scss)
  }

  &:active {
    transform: scale(0.99);
  }
}

.uc-btn-border {
  position: absolute;
  inset: 0;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  opacity: 0;
  transition: opacity $uc-transition-normal;
  pointer-events: none;
}

.uc-btn-content {
  position: relative;
  z-index: var(--z-base);
}

// 扫光效果已移至全局样式 (styles/index.scss)

.website-link-image {
  width: 100%;
  display: block;
  border-radius: var(--global-border-radius);
  opacity: 0.9;
  transition: opacity $uc-transition-normal;

  .uc-industrial-btn:hover & {
    opacity: 1;
  }
}

// ============================================
// 响应式设计
// ============================================
@media (width <= 768px) {
  .user-center-container {
    padding: 16px;
  }

  .user-center-content {
    gap: 16px;
  }

  .uc-glass-card {
    border-radius: var(--global-border-radius);

    &--hero {
      border-radius: var(--global-border-radius);
    }

    &--collapsible {
      .membership-benefits-header {
        padding: 14px 16px;
      }
    }
  }

  .membership-benefits-content {
    padding: 0 16px 16px;
  }

  .uc-glow-orb {
    &--primary {
      width: 300px;
      height: 300px;
    }

    &--secondary {
      width: 250px;
      height: 250px;
    }
  }
}

@media (width <= 480px) {
  .user-center-container {
    padding: 12px;
  }

  .user-center-content {
    gap: 14px;
  }

  .uc-glass-card {
    border-radius: var(--global-border-radius);

    &--hero {
      border-radius: var(--global-border-radius);
    }

    &--collapsible {
      .membership-benefits-header {
        padding: 12px 14px;
      }
    }
  }

  .uc-header-text {
    font-size: 14px;
  }

  .membership-benefits-content {
    padding: 0 14px 14px;
  }

  .uc-link-section {
    margin-top: 12px;
  }

  .uc-industrial-btn {
    border-radius: var(--global-border-radius);
  }

  .website-link-image {
    border-radius: var(--global-border-radius);
  }
}

@media (width <= 375px) {
  .user-center-container {
    padding: 10px;
  }

  .user-center-content {
    gap: 12px;
  }
}

// ============================================
// 暗色模式适配
// ============================================
// 暗色模式下 overlay 混合会让噪点纹理叠加异常，可能影响背景可读性，改用 normal
:where(html.dark) .uc-noise-overlay,
:where(body.dark) :where(.uc-noise-overlay) {
  mix-blend-mode: normal;
}

// ============================================
// 深度覆盖子组件样式
// ============================================
:deep(.user-info-card),
:deep(.user-card) {
  background: transparent;
  box-shadow: none;
  border: none;
}

:deep(.el-card) {
  background: transparent;
  border: none;
  box-shadow: none;
}
</style>
