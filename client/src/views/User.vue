<template>
  <div class="user-page-container" :class="{ 'mouse-active': isMouseInViewport }">
    <!-- 深度背景系统 -->
    <div class="user-bg-system">
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
      <div class="mouse-glow-effect"></div>
    </div>

    <!-- 整体布局 - 左侧导航 + 右侧内容 -->
    <div class="user-page-layout">
      <!-- 左侧导航栏 - 高科技工业风格 -->
      <aside class="user-sidebar scroll-reveal" :aria-label="t('user.sidebar.ariaLabel')" data-animation="fadeInLeft">
        <nav class="sidebar-nav glass-card" role="navigation" :aria-label="t('user.sidebar.menuAriaLabel')">
          <div class="nav-header">
            <span class="nav-badge-text font-edix">Menu</span>
            <div class="nav-indicator-line"></div>
          </div>
          <button v-for="(menuItem, index) in menuItems" :key="menuItem.index"
            :ref="(el: HTMLElement | null) => setNavItemRef(el, index)"
            :class="['nav-item', { active: activeMenu === menuItem.index }]"
            @click="e => handleNavClick(e, menuItem.index)" @keydown.enter="handleMenuSelect(menuItem.index)"
            @keydown.space.prevent="handleMenuSelect(menuItem.index)" @keydown="e => handleNavKeydown(e, index)"
            :aria-label="menuItem.label" :aria-current="activeMenu === menuItem.index ? 'page' : undefined"
            :tabindex="activeMenu === menuItem.index ? 0 : -1" type="button">
            <div class="nav-icon-wrap">
              <el-icon class="nav-icon" aria-hidden="true">
                <component :is="menuItem.icon" />
              </el-icon>
            </div>
            <span class="nav-label">{{ menuItem.label }}</span>
            <el-badge v-if="menuItem.badge && menuItem.badge > 0" :value="menuItem.badge" :max="99" class="nav-badge"
              :aria-label="t('user.sidebar.unreadMessages', { label: menuItem.label, count: menuItem.badge })
                " />
          </button>
        </nav>
      </aside>

      <!-- 右侧内容区 - 用户信息卡片 + 主要内容 -->
      <div class="user-right-content">
        <!-- 主要内容区域 -->
        <main class="user-content">
          <div class="content-wrapper">
            <!-- 页面标题 + 用户信息卡片（水平布局） -->
            <header class="page-header scroll-reveal" data-animation="fadeInUp" data-delay="150">
              <div class="header-left">
                <div class="header-badge">
                  <span class="status-dot"></span>
                  <span class="badge-text font-edix">User Center</span>
                </div>
                <h1 class="page-title" :id="`page-title-${activeMenu}`">{{ pageTitle }}</h1>
                <p class="page-description" :aria-describedby="`page-title-${activeMenu}`">
                  {{ pageDescription }}
                </p>
              </div>
              <div class="header-actions-bar">
                <el-tooltip :content="t('userPage.feedback')" placement="bottom">
                  <el-button circle @click="goToFeedback">
                    <el-icon><ChatDotRound /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
              <!-- 用户信息卡片：玻璃卡容器 + 后端拉取的最新用户信息 -->
              <div class="header-right">
                <div class="header-right-card glass-card">
                  <UserInfoCard :userInfo="currentUser" :showRechargeBtn="true" @edit-profile="scrollToNicknameInput"
                    @update:login-out="handleLoginOut" />
                </div>
              </div>
            </header>

            <!-- 内容卡片 - 玻璃态设计 -->
            <transition name="content-fade" mode="out-in">
              <div :key="`content-${activeMenu}`" class="content-card glass-card"
                :aria-labelledby="`page-title-${activeMenu}`" :aria-live="activeMenu === 'messages' ? 'polite' : 'off'"
                role="region">
                <div class="card-glow"></div>
                <!-- 个人信息 + 快捷操作 -->
                <div v-if="activeMenu === 'profile'" class="profile-section">
                  <UserProfile />
                  <div class="quick-actions-section">
                    <h3 class="section-title">{{ t('user.quickActions') }}</h3>
                    <UserCard />
                  </div>
                </div>

                <!-- 上传智能体 -->
                <UserUpload v-else-if="activeMenu === 'upload'" />

                <!-- 账户安全 -->
                <UserSecurity v-else-if="activeMenu === 'security'" />

                <!-- 消息中心 -->
                <UserMessages v-else-if="activeMenu === 'messages'" />

                <!-- 隐私设置 -->
                <UserPrivacy v-else-if="activeMenu === 'privacy'" />

                <!-- 系统设置 -->
                <UserSettings v-else-if="activeMenu === 'settings'" />

                <!-- 我的收藏 -->
                <UserFavorites v-else-if="activeMenu === 'favorites'" />

                <!-- 我的购买 -->
                <UserPurchases v-else-if="activeMenu === 'purchases'" />

                <!-- 我的审核 -->
                <UserExamine v-else-if="activeMenu === 'examine'" />

                <!-- 订单管理 -->
                <UserOrders v-else-if="activeMenu === 'orders'" />

                <!-- 开发者管理 -->
                <UserDeveloper v-else-if="activeMenu === 'developer'" />

                <!-- 数据统计 -->
                <UserStatistics v-else-if="activeMenu === 'statistics'" />

                <!-- 购买记录 -->
                <UserPurchaseRecords v-else-if="activeMenu === 'purchases-records'" />

                <!-- API服务（密钥管理） -->
                <UserApiService v-else-if="activeMenu === 'api-service'" />

                <!-- 会员权益 -->
                <UserMembershipBenefits v-else-if="activeMenu === 'benefits'" @openIntroduces="handleOpenIntroduce" />

                <!-- 学习中心 -->
                <div v-else-if="activeMenu === 'study'" class="study-section">
                  <UserStudyBar :barList="studyTabs" @change="handleStudyTabChange" />

                  <!-- 文本内容 -->
                  <div v-if="activeStudyTab === 'text'" class="study-content">
                    <div v-if="studyTextList.length" class="study-text-list">
                      <div v-for="item in studyTextList" :key="item.id" class="study-text-item" @click="handleStudyItemClick(item)">
                        <div class="text-item-info">
                          <h4 class="text-item-title">{{ item.title }}</h4>
                          <p class="text-item-preview">{{ item.summary }}</p>
                          <span class="text-item-time">{{ item.time }}</span>
                        </div>
                        <el-icon class="text-item-arrow"><ArrowRight /></el-icon>
                      </div>
                    </div>
                    <el-empty v-else :description="t('userPage.noTextContent')" />
                  </div>

                  <!-- 图片内容 -->
                  <div v-else-if="activeStudyTab === 'image'" class="study-content">
                    <div v-if="studyImageList.length" class="study-image-grid">
                      <div v-for="item in studyImageList" :key="item.id" class="study-image-item" @click="handleStudyItemClick(item)">
                        <img :src="item.url" :alt="item.title" class="study-image-thumb" loading="lazy" />
                        <span class="study-image-title">{{ item.title }}</span>
                      </div>
                    </div>
                    <el-empty v-else :description="t('userPage.noImageContent')" />
                  </div>

                  <!-- 视频内容 -->
                  <div v-else-if="activeStudyTab === 'video'" class="study-content">
                    <div v-if="studyVideoList.length" class="study-video-list">
                      <div v-for="item in studyVideoList" :key="item.id" class="study-video-card" @click="handleStudyItemClick(item)">
                        <div class="video-cover">
                          <img :src="item.cover" :alt="item.title" class="video-cover-img" loading="lazy" />
                          <div class="video-play-icon">
                            <el-icon :size="24"><VideoPlay /></el-icon>
                          </div>
                          <span class="video-duration">{{ item.duration }}</span>
                        </div>
                        <div class="video-info">
                          <h4 class="video-title">{{ item.title }}</h4>
                          <span class="video-meta">{{ item.views }}{{ t('userPage.views') }} · {{ item.time }}</span>
                        </div>
                      </div>
                    </div>
                    <el-empty v-else :description="t('userPage.noVideoContent')" />
                  </div>

                  <!-- 全部/默认 -->
                  <div v-else class="study-content">
                    <div v-if="studyTextList.length || studyImageList.length || studyVideoList.length" class="study-all-content">
                      <div v-for="item in studyTextList" :key="'t-' + item.id" class="study-text-item" @click="handleStudyItemClick(item)">
                        <div class="text-item-info">
                          <h4 class="text-item-title">{{ item.title }}</h4>
                          <p class="text-item-preview">{{ item.summary }}</p>
                          <span class="text-item-time">{{ item.time }}</span>
                        </div>
                        <el-icon class="text-item-arrow"><ArrowRight /></el-icon>
                      </div>
                      <div v-for="item in studyVideoList" :key="'v-' + item.id" class="study-video-card" @click="handleStudyItemClick(item)">
                        <div class="video-cover">
                          <img :src="item.cover" :alt="item.title" class="video-cover-img" loading="lazy" />
                          <div class="video-play-icon">
                            <el-icon :size="24"><VideoPlay /></el-icon>
                          </div>
                          <span class="video-duration">{{ item.duration }}</span>
                        </div>
                        <div class="video-info">
                          <h4 class="video-title">{{ item.title }}</h4>
                          <span class="video-meta">{{ item.views }}{{ t('userPage.views') }} · {{ item.time }}</span>
                        </div>
                      </div>
                    </div>
                    <el-empty v-else :description="t('userPage.noStudyContent')" />
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUserMenu } from '@/composables/user/useUserMenu'
import { useUserAuth } from '@/composables/user/useUserAuth'
import { useAuthStore } from '@/stores/auth'
import UserInfoCard from '@/components/user/UserInfoCard.vue'
import { useMouseGlow } from '@/composables/useMouseGlow'
import { useCleanup } from '@/composables/useCleanup'
import { ChatDotRound, ArrowRight, VideoPlay } from '@element-plus/icons-vue'

// 导入i18n的t函数
const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const cleanup = useCleanup()

/** UserInfoCard 所需的用户信息结构（与 UserCenter 一致） */
interface UserInfoForCard {
  uuid?: string
  openId?: string
  isLoggedIn: boolean
  username: string
  nickname?: string
  isVip: number | null
  knowledgeBaseQuota?: string
  remainingTokens?: string
  userId?: string
  avatarUrl?: string
  avatar?: string
  memberLevelText?: string
  nextLevelInfoText?: string
  identityType?: number
  tokenQuantity?: number
  phone?: string
  zhsToken?: string
}

/** 从 authStore 派生当前用户信息，供 UserInfoCard 显示；登录后显示真实头像、昵称、手机、余额等 */
const currentUser = computed<UserInfoForCard>(() => {
  const user = authStore.user as { uuid?: string; username?: string; nickname?: string; avatar?: string; phone?: string; isVip?: boolean; vipLevelVO?: { levelName?: string }; identityType?: number } | null
  if (authStore.isLoggedIn && user) {
    return {
      uuid: user.uuid,
      openId: '',
      isLoggedIn: true,
      username: user.nickname || user.username || t('userCenter.defaultUsername'),
      nickname: user.nickname || user.username,
      isVip: user.isVip ? 1 : 0,
      knowledgeBaseQuota: String(authStore.balance ?? 0),
      remainingTokens: String(authStore.balance ?? 0),
      tokenQuantity: authStore.balance ?? 0,
      userId: user.uuid ?? '',
      avatarUrl: user.avatar || '',
      avatar: user.avatar || '',
      memberLevelText: user.vipLevelVO?.levelName ?? (user.isVip ? t('userCenter.vipMember') : t('userCenter.regularMember')),
      nextLevelInfoText: t('userCenter.openMembershipPrivilege'),
      identityType: user.identityType ?? 0,
      phone: user.phone ?? '',
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

/** 未登录时点击「登录/注册」：跳转登录页并带回当前页 */
function handleLoginOut() {
  router.push({ path: '/login', query: { returnUrl: '/user' } }).catch(() => {})
}

// ============ 高级动效系统 ============
// 滚动动画观察器
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())

const { isMouseInViewport } = useMouseGlow()

// 导航项引用
const navItemRefs = ref<(HTMLElement | null)[]>([])

const setNavItemRef = (el: any, index: number) => {
  if (el) {
    navItemRefs.value[index] = el as HTMLElement
  }
}

// 初始化滚动动画观察器
const initScrollAnimations = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay || '0'
          const animation = el.dataset.animation || 'fadeInUp'

          setTimeout(() => {
            el.classList.add('scroll-animated', `animate-${animation}`)
          }, parseInt(delay))

          observedElements.value.add(el)
        }
      })
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  )
  cleanup.add(() => scrollObserver?.disconnect())

  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// 涟漪点击效果
const createRipple = (e: MouseEvent, el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  const ripple = document.createElement('span')
  const size = Math.max(rect.width, rect.height)

  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  ripple.classList.add('ripple-effect')

  el.appendChild(ripple)

  setTimeout(() => ripple.remove(), 600)
}

// 滚动到页面顶部的辅助函数
const scrollToTop = () => {
  // 强制滚动所有可能的滚动容器到顶部
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  window.scrollTo(0, 0)

  // 同时滚动可能的内部容器
  const containers = [
    document.querySelector('#main-content'),
    document.querySelector('.main-content'),
    document.querySelector('.user-right-content'),
    document.querySelector('.user-content'),
    document.querySelector('.content-wrapper'),
    document.querySelector('.user-page-container'),
    document.querySelector('.user-page-layout')
  ]
  containers.forEach(el => {
    if (el) {
      el.scrollTop = 0
      // 也尝试使用 scrollTo 方法
      if (typeof (el as Element & { scrollTo?: (x: number, y: number) => void }).scrollTo === 'function') {
        (el as Element & { scrollTo: (x: number, y: number) => void }).scrollTo(0, 0)
      }
    }
  })
}

// 导航点击处理（带涟漪效果）
const handleNavClick = (e: MouseEvent, menuIndex: string) => {
  const target = e.currentTarget as HTMLElement
  createRipple(e, target)
  handleMenuSelect(menuIndex)

  // 多次尝试滚动，覆盖各种情况
  // 立即滚动
  scrollToTop()

  // nextTick 后滚动
  nextTick(scrollToTop)

  // 延迟滚动（覆盖异步组件加载和 transition 动画）
  // transition 动画持续 350ms，所以在 100ms、200ms、400ms 后各滚动一次
  setTimeout(scrollToTop, 100)
  setTimeout(scrollToTop, 200)
  setTimeout(scrollToTop, 400)
}

// 滚动到昵称输入框并聚焦
const scrollToNicknameInput = () => {
  // 确保当前在个人信息页面
  if (activeMenu.value !== 'profile') {
    handleMenuSelect('profile')
  }

  // 等待DOM更新后滚动到输入框
  nextTick(() => {
    setTimeout(() => {
      // 查找昵称输入框
      const nicknameInput = document.querySelector('input[placeholder*=t("User.nickname")], input[aria-label*=t("User.nickname2")], .el-input input') as HTMLInputElement
      if (nicknameInput) {
        // 滚动到输入框位置
        nicknameInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 延迟聚焦，等待滚动完成
        setTimeout(() => {
          nicknameInput.focus()
          nicknameInput.select()
        }, 300)
      }
    }, 100)
  })
}

// 懒加载子组件以优化性能
const UserProfile = defineAsyncComponent(() => import('@/components/user/UserProfile.vue'))
const UserSecurity = defineAsyncComponent(() => import('@/components/user/UserSecurity.vue'))
const UserMessages = defineAsyncComponent(() => import('@/components/user/UserMessages.vue'))
const UserPrivacy = defineAsyncComponent(() => import('@/components/user/UserPrivacy.vue'))
const UserSettings = defineAsyncComponent(() => import('@/components/user/UserSettings.vue'))
const UserFavorites = defineAsyncComponent(() => import('@/components/user/UserFavorites.vue'))
const UserPurchases = defineAsyncComponent(() => import('@/components/user/UserPurchases.vue'))
const UserUpload = defineAsyncComponent(() => import('@/components/user/UserUpload.vue'))
const UserExamine = defineAsyncComponent(() => import('@/components/user/UserExamine.vue'))
const UserOrders = defineAsyncComponent(() => import('@/components/user/UserOrders.vue'))
const UserDeveloper = defineAsyncComponent(() => import('@/components/user/UserDeveloper.vue'))
const UserPurchaseRecords = defineAsyncComponent(
  () => import('@/components/user/UserPurchaseRecords.vue')
)
const UserStatistics = defineAsyncComponent(() => import('@/components/user/UserStatistics.vue'))
const UserApiService = defineAsyncComponent(() => import('@/components/user/UserApiService.vue'))
const UserMembershipBenefits = defineAsyncComponent(() => import('@/components/user/UserMembershipBenefits.vue'))
const UserStudyBar = defineAsyncComponent(() => import('@/components/user/UserStudyBar.vue'))
const UserCard = defineAsyncComponent(() => import('@/components/user/UserCard.vue'))

// 使用菜单管理 Composable
const { activeMenu, menuItems, pageTitle, pageDescription, handleMenuSelect, handleNavKeydown } =
  useUserMenu()

// 使用认证和初始化 Composable
useUserAuth()

// 学习中心 Tab 数据
const studyTabs = ref([
  { name: '全部', id: 'all' },
  { name: '文本', id: 'text' },
  { name: '图片', id: 'image' },
  { name: '视频', id: 'video' },
])

const handleStudyTabChange = (item: { name: string; id?: string | number }) => {
  activeStudyTab.value = String(item.id || 'all')
}

// 学习中心 - 当前激活的Tab
const activeStudyTab = ref('all')

// 登录弹窗
const _showLoginPopup = ref(false)

// 文本内容列表
const studyTextList = ref([
  { id: 1, title: 'AI智能体开发入门指南', summary: '从零开始了解AI智能体的概念、架构和开发流程，帮助您快速上手...', time: '2025-06-10', type: 'text' },
  { id: 2, title: '大语言模型基础知识', summary: '深入理解Transformer架构、注意力机制以及主流大语言模型的工作原理...', time: '2025-06-08', type: 'text' },
  { id: 3, title: 'Prompt Engineering最佳实践', summary: '掌握提示词工程的核心技巧，让AI更好地理解并执行您的指令...', time: '2025-06-05', type: 'text' },
  { id: 4, title: 'RAG检索增强生成详解', summary: '学习如何将外部知识库与大模型结合，构建更准确的问答系统...', time: '2025-06-01', type: 'text' },
])

// 图片内容列表
const studyImageList = ref([
  { id: 1, title: 'AI架构图解', url: '/images/study/architecture.png', type: 'image' },
  { id: 2, title: '工作流示意图', url: '/images/study/workflow.png', type: 'image' },
  { id: 3, title: '模型对比表', url: '/images/study/model-compare.png', type: 'image' },
  { id: 4, title: '部署流程图', url: '/images/study/deploy.png', type: 'image' },
  { id: 5, title: 'API调用示例', url: '/images/study/api-example.png', type: 'image' },
  { id: 6, title: '性能优化指南', url: '/images/study/performance.png', type: 'image' },
])

// 视频内容列表
const studyVideoList = ref([
  { id: 1, title: 'AI智能体实战教程', cover: '/images/study/video1-cover.png', duration: '32:15', views: 1280, time: '2025-06-10', type: 'video' },
  { id: 2, title: '大模型微调入门', cover: '/images/study/video2-cover.png', duration: '45:30', views: 890, time: '2025-06-07', type: 'video' },
  { id: 3, title: '工作流搭建实战', cover: '/images/study/video3-cover.png', duration: '28:42', views: 650, time: '2025-06-03', type: 'video' },
])

function handleStudyItemClick(item: any) {
  if (item && item.id) {
    router.push(`/study/${item.type || 'text'}/${item.id}`).catch(() => {})
  }
}

function goToFeedback() {
  router.push('/feedback').catch(() => {})
}

const handleOpenIntroduce = () => {
  router.push('/vip').catch(() => {})
}

// 生命周期
onMounted(async () => {
  initScrollAnimations()
  // 已登录时拉取最新用户信息（昵称、头像、手机、余额、VIP 等）与后端保持一致
  if (authStore.isLoggedIn) {
    try {
      await authStore.fetchUserInfo()
    } catch (_e) {
      // 接口失败时继续使用缓存，不阻塞页面
    }
  }
})
</script>

<style scoped lang="scss">
@use './User.vue.styles';
@use '@/styles/breakpoints' as bp;

// ============ 高科技工业风格变量 ============
$brand-primary: var(--el-bg-color-page);
$brand-secondary: var(--el-text-color-secondary);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$bg-page: var(--el-bg-color-page);

// ============ 布局间距修复 ============
// 注意：主要样式在 User.vue.styles.scss 中定义
// 这里只做必要的覆盖

// ============ 深度背景系统 ============
.user-bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;

  .bg-glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(80px);
    opacity: 0.12;
    animation: floatOrb 15s ease-in-out infinite;

    &.orb-1 {
      width: 400px;
      height: 400px;
      top: 10%;
      right: 10%;
      background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
      animation-delay: 0s;
    }

    &.orb-2 {
      width: 350px;
      height: 350px;
      bottom: 20%;
      left: 5%;
      background: rgb(var(--el-text-color-placeholder-rgb), 0.15);
      animation-delay: -7s;
    }
  }

  .mouse-glow-effect {
    position: absolute;
    left: 0;
    top: 0;
    width: 500px;
    height: 500px;
    border-radius: var(--global-border-radius);
    background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
    opacity: 0;
    pointer-events: none;
  }
}

.user-page-container {
  position: relative;
  z-index: var(--z-base);

  &.mouse-active .mouse-glow-effect {
    opacity: 0;
  }
}

// ============ 简洁卡片 ============
// 使用 CSS 变量替代 
.glass-card {
  // CSS 变量定义
  --glass-card-bg: var(--el-bg-color);
  --glass-card-border: var(--unified-border);

  background: var(--glass-card-bg);
  border: var(--glass-card-border);
  position: relative;
  overflow: hidden;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

// ============ 滚动触发动画系统 ============
.scroll-reveal {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.6s ease, transform 0.6s ease;

  &.scroll-animated {
    transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.animate-fadeInUp {
    opacity: 1;
    transform: translateY(0);
  }

  &.animate-fadeInLeft {
    opacity: 1;
    transform: translateX(0);
  }

  &.animate-fadeInRight {
    opacity: 1;
    transform: translateX(0);
  }
}

// 动画初始状态（未激活时）
.scroll-reveal[data-animation="fadeInLeft"]:not(.animate-fadeInLeft) {
  transform: translateX(-30px);
}

.scroll-reveal[data-animation="fadeInRight"]:not(.animate-fadeInRight) {
  transform: translateX(30px);
}

// ============ 侧边栏高科技风格 ============
// 使用 CSS 变量替代 
.user-sidebar {
  // CSS 变量定义
  --sidebar-nav-radius: 20px;
  --sidebar-nav-padding: clamp(16px, 2vw, 24px);
  --sidebar-nav-item-radius: 14px;

  .sidebar-nav {
    border-radius: var(--sidebar-nav-radius);
    padding: var(--sidebar-nav-padding);
    height: auto;
    min-height: auto;
    max-height: none;

    .nav-header {
      padding: 0 12px 16px;
      margin-bottom: 12px;
      border-bottom: var(--unified-border-bottom);

      .nav-badge-text {
        font-family: 'EDIX';
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-secondary);
        opacity: 0.8;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .nav-indicator-line {
        width: 32px;
        height: 2px;
        background: var(--el-text-color-secondary);
        margin-top: 8px;
        border-radius: var(--global-border-radius);
      }
    }

    .nav-item {
      border-radius: var(--sidebar-nav-item-radius);
      margin-bottom: 4px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: none;
      background: transparent;

      .nav-icon-wrap {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-fill-color-light);
        border-radius: var(--global-border-radius);
        transition: all 0.3s;
        flex-shrink: 0;
      }

      &:hover {
        background: var(--el-fill-color-lighter);

        .nav-icon-wrap {
          background: var(--el-fill-color);
          transform: scale(1.05);
        }
      }

      &.active {
        background: var(--el-fill-color-light);

        .nav-icon-wrap {
          background: var(--el-color-primary);

          .nav-icon {
            color: var(--el-button-text-color);
          }
        }

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 60%;
          background: var(--el-color-primary);
          border-radius: var(--global-border-radius);
          animation: slideIndicator 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      }
    }
  }
}

// ============ 页面标题高科技风格 ============
.page-header {
  display: flex;
  align-items: flex-start; // 改为顶部对齐，让各自保持自然高度
  gap: 20px;
  margin-bottom: 24px;

  .header-left {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 8px; // 微调顶部对齐
  }

  .header-right {
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: flex-end;
    align-items: stretch;
  }

  .header-right-card {
    width: 100%;
    max-width: 380px;
    border-radius: var(--global-border-radius);
    padding: 0;
    overflow: hidden;
    display: flex;
    align-items: stretch;
  }

  .header-right-card :deep(.user-info-card) {
    width: 100%;
    padding: 20px;
    box-sizing: border-box;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 8px;
    background: rgb(var(--el-fill-color-light-rgb), 0.5);
    width: fit-content;

    .status-dot {
      width: 6px;
      height: 6px;
      background: var(--el-color-primary);
      border-radius: var(--global-border-radius);
      animation: pulse 2s infinite;
    }

    .badge-text {
      font-family: 'EDIX';
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--el-text-color-secondary);
      text-transform: uppercase;
    }
  }

  .page-title {
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .page-description {
    margin-top: 4px;
    font-size: 15px;
    color: $text-sec;
    line-height: 1.6;
  }
}

// ============ 内容卡片增强 ============
// 使用 CSS 变量替代 
.content-card {
  --content-card-radius: 24px;
  --content-card-padding: clamp(28px, 4vw, 48px);

  border-radius: var(--content-card-radius);
  padding: var(--content-card-padding);
  min-height: 500px;
  box-shadow: none;

  &::before {
    display: none;
  }
}

// ============ 内容切换动画 ============
.content-fade-enter-active,
.content-fade-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.content-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.content-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% {
    transform: translate(0, 0);
  }

  100% {
    transform: translate(60px, 60px);
  }
}

@keyframes floatOrb {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  25% {
    transform: translate(30px, -20px) scale(1.05);
  }

  50% {
    transform: translate(-20px, 30px) scale(0.95);
  }

  75% {
    transform: translate(-30px, -10px) scale(1.02);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

@keyframes rippleExpand {
  0% {
    transform: scale(0);
    opacity: 0.6;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes slideIndicator {
  from {
    width: 0;
    opacity: 0;
  }

  to {
    width: 4px;
    opacity: 1;
  }
}

// ============ 快捷操作和学习中心 ============
.profile-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.quick-actions-section {
  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 16px;
  }
}

.study-section {
  .study-content {
    margin-top: 16px;
  }

  .study-placeholder {
    color: var(--el-text-color-secondary);
    text-align: center;
    padding: 40px 0;
  }
}

// 学习中心 - 文本列表
.study-text-list,
.study-all-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.study-text-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-lighter);
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    background: var(--el-fill-color);
    transform: translateX(4px);
  }

  .text-item-info {
    flex: 1;
    min-width: 0;
  }

  .text-item-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .text-item-preview {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin: 0 0 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .text-item-time {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  .text-item-arrow {
    flex-shrink: 0;
    margin-left: 12px;
    color: var(--el-text-color-secondary);
  }
}

// 学习中心 - 图片网格
.study-image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.study-image-item {
  display: flex;
  flex-direction: column;
  border-radius: var(--global-border-radius);
  border: 1px solid transparent;
  overflow: hidden;
  background: var(--el-fill-color-lighter);
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    transform: translateY(-4px);
    border-color: var(--el-border-color);
  }

  .study-image-thumb {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }

  .study-image-title {
    padding: 8px 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 学习中心 - 视频卡片
.study-video-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.study-video-card {
  display: flex;
  gap: 14px;
  padding: 12px;
  border-radius: var(--global-border-radius);
  border: 1px solid transparent;
  background: var(--el-fill-color-lighter);
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    background: var(--el-fill-color);
    transform: translateY(-2px);
    border-color: var(--el-border-color);
  }

  .video-cover {
    position: relative;
    width: 160px;
    height: 90px;
    flex-shrink: 0;
    border-radius: var(--global-border-radius);
    overflow: hidden;

    .video-cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .video-play-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-black-30);
      color: var(--color-white);
      opacity: 0;
      transition: opacity 0.25s;
    }

    .video-duration {
      position: absolute;
      bottom: 4px;
      right: 6px;
      padding: 2px 6px;
      border-radius: var(--global-border-radius);
      background: var(--color-black-70);
      color: var(--color-white);
      font-size: 12px;
    }
  }

  &:hover .video-play-icon {
    opacity: 1;
  }

  .video-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;

    .video-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin: 0 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .video-meta {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
}

// 头部操作栏
.header-actions-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

// ============ 响应式调整 ============
// 通过覆盖 CSS 变量实现响应式
@include bp.mobile-only {
  .user-bg-system {
    .bg-glow-orb {
      width: 200px;
      height: 200px;
      opacity: 0.08;
    }
  }

  .user-sidebar {
    // 覆盖 CSS 变量实现响应式
    --sidebar-nav-radius: 16px;
    --sidebar-nav-padding: 12px;
    --sidebar-nav-item-radius: 10px;

    .sidebar-nav {
      .nav-header {
        display: none;
      }

      .nav-item {
        .nav-icon-wrap {
          width: 32px;
          height: 32px;
        }
      }
    }
  }

  .content-card {
    // 覆盖 CSS 变量实现响应式
    --content-card-radius: 16px;
    --content-card-padding: 20px;
  }

  .page-header .header-badge {
    padding: 4px 10px;
    font-size: 9px;
  }
}

// ============ 暗色模式适配 ============
html.dark {
  .glass-card {
    --glass-card-bg: var(--el-bg-color);
    --glass-card-border: var(--unified-border);
  }

  .user-bg-system .bg-glow-orb {
    opacity: 0.08;
  }

  .page-header .header-badge {
    background: var(--color-gray-323232-50);
    border-color: var(--color-white-10);
  }

}
</style>
