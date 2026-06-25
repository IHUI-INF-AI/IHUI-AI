<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/**
 * About.vue - 关于我们页面 (Premium Tech Edition)
 *
 * @description 高科技工业风格重构版
 * @author AI Design System
 */

import { ref, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import useLang from '@/composables/useLang'
import { Home, Cpu, Users, Zap, Globe, Target, Mail, MapPin, Phone, ArrowRight, Sparkles } from '@/lib/lucide-fallback'
import { useSEO } from '@/composables/useSEO'

useSEO({
  title: t('about.seo.title'),
  description: t('about.seo.description'),
  keywords: t('about.seo.keywords'),
  ogTitle: t('about.seo.ogTitle'),
  ogDescription: t('about.seo.ogDescription'),
  canonical: 'https://www.zhihui-ai.com/about'
})

const { t: _t } = useLang
const router = useRouter()

// ============ 高级动效系统 ============
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())
const scrollProgress = ref(0)

// 初始化滚动动画
const initScrollAnimations = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay || '0'
          setTimeout(() => {
            el.classList.add('scroll-animated', 'animate-fadeInUp')
          }, parseInt(delay))
          observedElements.value.add(el)
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  )

  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// 滚动进度
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = Math.min(scrollTop / docHeight, 1)
  })
}

// 涟漪效果
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

// 数字动画
const animatedStats = ref({ users: 0, projects: 0, uptime: 0, countries: 0 })
const targetStats = { users: 100000, projects: 5000, uptime: 99.9, countries: 50 }

const animateRafIds = new Set<number>()

const animateNumber = (key: keyof typeof animatedStats.value, target: number, duration: number) => {
  const start = performance.now()
  const update = (now: number) => {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(2, -10 * progress)
    animatedStats.value[key] = key === 'uptime'
      ? parseFloat((target * eased).toFixed(1))
      : Math.floor(target * eased)
    if (progress < 1) {
      animateRafIds.delete(rafId)
      rafId = requestAnimationFrame(update)
      animateRafIds.add(rafId)
    } else {
      animateRafIds.delete(rafId)
    }
  }
  let rafId = requestAnimationFrame(update)
  animateRafIds.add(rafId)
}

// 统计数字观察器
let statsObserver: IntersectionObserver | null = null
const initStatsAnimation = () => {
  statsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateNumber('users', targetStats.users, 2000)
          animateNumber('projects', targetStats.projects, 2000)
          animateNumber('uptime', targetStats.uptime, 2000)
          animateNumber('countries', targetStats.countries, 2000)
          statsObserver?.disconnect()
        }
      })
    },
    { threshold: 0.3 }
  )
  nextTick(() => {
    const statsEl = document.querySelector('.stats-section')
    if (statsEl) statsObserver?.observe(statsEl)
  })
}

onMounted(() => {
  initScrollAnimations()
  initStatsAnimation()
  window.addEventListener('scroll', handleScroll)
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => scrollObserver?.disconnect())
cleanup.add(() => statsObserver?.disconnect())
cleanup.add(() => window.removeEventListener('scroll', handleScroll))
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })

const goHome = () => router.push('/')

// 平台特性
const features = [
  { icon: Cpu, title: t('title.about.AI智能对话'), desc: t('about.features.aiDialogDesc'), tag: 'CORE' },
  { icon: Zap, title: t('title.about.极速响应1'), desc: t('about.features.fastResponseDesc'), tag: 'PERFORMANCE' },
  { icon: Users, title: t('title.about.专业社区2'), desc: t('about.features.communityDesc'), tag: 'COMMUNITY' },
  { icon: Globe, title: t('title.about.全球覆盖3'), desc: t('about.features.globalDesc'), tag: 'GLOBAL' }
]

// 团队成员
const team = [
  { name: t('data.about.张明远'), role: t('about.team.role1'), desc: t('about.team.desc1'), avatar: '/images/team/ceo.jpg' },
  { name: t('data.about.李思涵1'), role: t('about.team.role2'), desc: t('about.team.desc2'), avatar: '/images/team/cto.jpg' },
  { name: t('data.about.王晓峰2'), role: t('about.team.role3'), desc: t('about.team.desc3'), avatar: '/images/team/cpo.jpg' }
]

// 里程碑
const milestones = [
  { year: '2022', event: t('about.milestones.event1'), desc: t('about.milestones.desc1') },
  { year: '2023', event: t('about.milestones.event2'), desc: t('about.milestones.desc2') },
  { year: '2024', event: t('about.milestones.event3'), desc: t('about.milestones.desc3') },
  { year: '2025', event: t('about.milestones.event4'), desc: t('about.milestones.desc4') }
]
</script>

<template>
  <div class="about-root">
    <!-- 滚动进度条 -->
    <div class="scroll-progress-bar" :style="{ width: `${scrollProgress * 100}%` }"></div>

    <!-- 深度背景系统 -->
    <div class="bg-system">
      <div class="bg-glow glow-1"></div>
      <div class="bg-glow glow-2"></div>
    </div>

    <!-- Hero Section -->
    <section id="about-hero" class="hero-section" aria-labelledby="about-hero-title">
      <div class="container">
        <div class="hero-content scroll-reveal" data-delay="0">
          <div class="hero-badge">
            <Sparkles class="badge-icon" :size="14" />
            <span class="badge-text font-edix">{{ t('about.badge') }}</span>
          </div>
          <h1 class="hero-title">{{ t('about.构建未来的') }}<span class="gradient-text">{{ t('about.AI基础设施') }}</span>
          </h1>
          <p class="hero-desc">{{ t('about.我们致力于打造全球领') }}</p>
          <div class="hero-actions">
            <button class="btn-primary magnetic" @click="goHome">
              <Home :size="18" />
              <span>{{ t('about.返回首页') }}</span>
            </button>
            <button class="btn-ghost" @click="$router.push('/support/document-center')">
              <span>{{ t('about.了解更多') }}</span>
              <ArrowRight :size="18" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section id="about-stats" class="stats-section" aria-labelledby="about-stats-heading">
      <div class="container">
        <h2 id="about-stats-heading" class="sr-only">{{ t('about.活跃用户') }}</h2>
        <div class="stats-grid">
          <div class="stat-item scroll-reveal" data-delay="0">
            <div class="stat-value">{{ animatedStats.users.toLocaleString() }}+</div>
            <div class="stat-label">{{ t('about.活跃用户') }}</div>
          </div>
          <div class="stat-item scroll-reveal" data-delay="100">
            <div class="stat-value">{{ animatedStats.projects.toLocaleString() }}+</div>
            <div class="stat-label">{{ t('about.AI项目') }}</div>
          </div>
          <div class="stat-item scroll-reveal" data-delay="200">
            <div class="stat-value">{{ animatedStats.uptime }}%</div>
            <div class="stat-label">{{ t('about.服务可用性') }}</div>
          </div>
          <div class="stat-item scroll-reveal" data-delay="300">
            <div class="stat-value">{{ animatedStats.countries }}+</div>
            <div class="stat-label">{{ t('about.覆盖国家') }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Mission Section -->
    <section id="about-mission" class="mission-section" aria-labelledby="about-mission-title">
      <div class="container">
        <div class="section-header scroll-reveal">
          <span class="section-tag">{{ t('about.mission.tag') }}</span>
          <h2 id="about-mission-title" class="section-title">{{ t('about.让AI触手可及') }}</h2>
          <div class="title-line"></div>
        </div>
        <div class="mission-content scroll-reveal" data-delay="200">
          <div class="mission-card glass-card">
            <Target class="mission-icon" :size="48" />
            <h3>{{ t('about.使命愿景') }}</h3>
            <p>{{ t('about.智汇AI的使命是降低') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <div class="container">
        <div class="section-header scroll-reveal">
          <span class="section-tag">{{ t('about.features.tag') }}</span>
          <h2 class="section-title">{{ t('about.平台核心能力') }}</h2>
          <div class="title-line"></div>
        </div>
        <div class="features-grid">
          <div
            v-for="(feature, index) in features"
            :key="feature.title"
            class="feature-card glass-card scroll-reveal"
            :data-delay="Number(index) * 100"
            @click="(e) => createRipple(e, $event.currentTarget as HTMLElement)"
          >
            <div class="feature-tag">{{ feature.tag }}</div>
            <component :is="feature.icon" class="feature-icon" :size="32" />
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.desc }}</p>
            <div class="feature-glow"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Timeline Section -->
    <section class="timeline-section">
      <div class="container">
        <div class="section-header scroll-reveal">
          <span class="section-tag">{{ t('about.journey.tag') }}</span>
          <h2 class="section-title">{{ t('about.发展历程') }}</h2>
          <div class="title-line"></div>
        </div>
        <!-- 横向航道图：上方一排卡片，下方一条横线轨道 -->
        <div class="timeline timeline-horizontal">
          <div class="timeline-row timeline-row-cards">
            <div
              v-for="(milestone, index) in milestones"
              :key="'card-' + milestone.year"
              class="timeline-item-card scroll-reveal"
              :data-delay="Number(index) * 80"
            >
              <div class="timeline-content glass-card">
                <div class="timeline-year">{{ milestone.year }}</div>
                <h4>{{ milestone.event }}</h4>
                <p>{{ milestone.desc }}</p>
              </div>
            </div>
          </div>
          <div class="timeline-row timeline-row-track">
            <template v-for="(milestone, index) in milestones" :key="'track-' + milestone.year">
              <div class="marker-dot"></div>
              <div class="marker-line" v-if="Number(index) < milestones.length - 1"></div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Team Section -->
    <section class="team-section">
      <div class="container">
        <div class="section-header scroll-reveal">
          <span class="section-tag">{{ t('about.team.tag') }}</span>
          <h2 class="section-title">{{ t('about.核心团队') }}</h2>
          <div class="title-line"></div>
        </div>
        <div class="team-grid">
          <div
            v-for="(member, index) in team"
            :key="member.name"
            class="team-card glass-card scroll-reveal"
            :data-delay="Number(index) * 100"
          >
            <div class="member-avatar">
              <div class="avatar-placeholder">{{ member.name.charAt(0) }}</div>
              <div class="avatar-ring"></div>
            </div>
            <h3>{{ member.name }}</h3>
            <div class="member-role">{{ member.role }}</div>
            <p>{{ member.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact Section -->
    <section class="contact-section">
      <div class="container">
        <div class="section-header scroll-reveal">
          <span class="section-tag">{{ t('about.contact.tag') }}</span>
          <h2 class="section-title">{{ t('about.联系我们') }}</h2>
          <div class="title-line"></div>
        </div>
        <div class="contact-grid scroll-reveal" data-delay="200">
          <div class="contact-card glass-card">
            <Mail class="contact-icon" :size="24" />
            <h4>{{ t('about.电子邮件') }}</h4>
            <p>contact@ihui.ai</p>
          </div>
          <div class="contact-card glass-card">
            <MapPin class="contact-icon" :size="24" />
            <h4>{{ t('about.公司地址') }}</h4>
            <p>{{ t('about.中国上海市浦东新区张') }}</p>
          </div>
          <div class="contact-card glass-card">
            <Phone class="contact-icon" :size="24" />
            <h4>{{ t('about.联系电话') }}</h4>
            <p>400-888-8888</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables' as v;

// 设计令牌（与项目 variables 对齐）
$bg-page: var(--el-bg-color-page);
$bg-card: var(--el-bg-color);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$brand-primary: v.$primary-color;
$brand-secondary: v.$primary-light;
$accent-color: v.$success-color;

// 深度背景系统
.about-root {
  min-height: 100vh;
  min-height: 100dvh;
  background: $bg-page;
  position: relative;
  overflow-x: hidden;
}

.bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  overflow: hidden;

  .bg-glow {
    position: absolute;
    width: 520px;
    height: 520px;
    border-radius: var(--global-border-radius);
    filter: blur(100px);
    opacity: 0.12;

    &.glow-1 {
      top: -180px;
      right: -180px;
      background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    }

    &.glow-2 {
      bottom: -180px;
      left: -180px;
      background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    }
  }

}

@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(48px, 48px); }
}

// 容器 - 与项目 max-w-wide 一致
.container {
  max-width: min(1280px, 92vw);
  margin: 0 auto;
  padding: 0 v.$spacing-lg;
  position: relative;
  z-index: var(--z-base);

  @media (width <= 768px) {
    padding: 0 v.$spacing-md;
  }
}

// Section 通用 - 响应式间距
section {
  padding: clamp(48px, 8vw, 100px) 0;
}

.section-header {
  text-align: center;
  margin-bottom: clamp(40px, 6vw, 64px);
}

.section-tag {
  display: inline-block;
  font-size: v.$font-size-xs;
  font-weight: v.$font-weight-bold;
  letter-spacing: 0.12em;
  color: $text-sec;
  margin-bottom: v.$spacing-md;
  padding: v.$spacing-sm v.$spacing-lg;
  border: var(--unified-border);
  border-radius: v.$radius-120;
  text-transform: uppercase;
}

.section-title {
  font-size: clamp(26px, 3.8vw, 40px);
  font-weight: 900;
  color: $text-main;
  letter-spacing: -0.03em;
  margin: 0;
  line-height: 1.2;
}

.title-line {
  width: 48px;
  height: 4px;
  background: var(--el-color-primary);
  margin: v.$spacing-lg auto 0;
  border-radius: var(--global-border-radius);
}

// 玻璃卡片 - 使用项目圆角与阴影
.glass-card {
  background: var(--color-white-72);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: var(--unified-border);
  border-radius: v.$border-radius;
  box-shadow: var(--global-box-shadow);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: rgba($brand-primary, 0.18);
    box-shadow: var(--global-box-shadow);
  }
}

// Hero Section - 更清晰的层次与留白
.hero-section {
  padding: clamp(100px, 14vw, 180px) 0 clamp(64px, 10vw, 100px);

  .hero-content {
    max-width: 720px;
    text-align: center;
    margin: 0 auto;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: v.$spacing-sm;
    padding: v.$spacing-sm v.$spacing-lg;
    border: var(--unified-border);
    border-radius: v.$radius-120;
    font-size: v.$font-size-xs;
    font-weight: v.$font-weight-bold;
    letter-spacing: 0.08em;
    color: $text-sec;
    margin-bottom: v.$spacing-xl;

    .badge-icon {
      color: $accent-color;
    }
  }

  .hero-title {
    font-size: clamp(32px, 5.5vw, 56px);
    font-weight: 900;
    line-height: 1.12;
    color: $text-main;
    letter-spacing: -0.04em;
    margin: 0 0 v.$spacing-lg;

    .gradient-text {
      color: $brand-primary;
    }
  }

  .hero-desc {
    font-size: clamp(v.$font-size-base, 1.2vw, v.$font-size-lg);
    line-height: 1.75;
    color: $text-sec;
    margin: 0 0 v.$spacing-2xl;
  }

  .hero-actions {
    display: flex;
    gap: v.$spacing-md;
    justify-content: center;
    flex-wrap: wrap;
  }
}

// 按钮样式 - 与项目圆角一致
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: v.$spacing-md v.$spacing-xl;
  background: $brand-primary;
  color: var(--el-bg-color-page);
  border: none;
  border-radius: v.$border-radius;
  font-size: v.$font-size-sm;
  font-weight: v.$font-weight-bold;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--global-box-shadow);
  }
}

html.dark .btn-primary {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: v.$spacing-md v.$spacing-xl;
  background: transparent;
  color: $text-main;
  border: var(--unified-border);
  border-radius: v.$border-radius;
  font-size: v.$font-size-sm;
  font-weight: v.$font-weight-bold;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    background: $bg-card;
    border-color: $brand-primary;
  }
}

// Stats Section - 卡片式分隔
.stats-section {
  padding: clamp(56px, 8vw, 88px) 0;
  background: rgba($brand-primary, 0.02);

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: v.$spacing-lg;

    @media (width <= 768px) {
      grid-template-columns: repeat(2, 1fr);
      gap: v.$spacing-md;
    }
  }

  .stat-item {
    text-align: center;
    padding: v.$spacing-xl v.$spacing-md;
    border-radius: v.$border-radius-sm;
    background: var(--color-white-50);
    border: var(--unified-border);
    transition: border-color 0.25s ease, background 0.25s ease;

    &:hover {
      background: var(--color-white-80);
      border-color: $border-light;
    }
  }

  .stat-value {
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 900;
    color: $text-main;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: v.$font-size-sm;
    color: $text-sec;
    margin-top: v.$spacing-sm;
    font-weight: v.$font-weight-semibold;
  }
}

// Mission Section
.mission-section {
  .mission-card {
    max-width: 640px;
    margin: 0 auto;
    padding: clamp(40px, 6vw, 64px);
    text-align: center;

    .mission-icon {
      color: $brand-primary;
      margin-bottom: v.$spacing-lg;
    }

    h3 {
      font-size: clamp(v.$font-size-xl, 2vw, v.$font-size-2xl);
      font-weight: 800;
      color: $text-main;
      margin: 0 0 v.$spacing-lg;
    }

    p {
      font-size: v.$font-size-base;
      line-height: 1.85;
      color: $text-sec;
      margin: 0;
    }
  }
}

// Features Section - 四列网格，响应式两列/单列
.features-section {
  .features-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: v.$spacing-lg;

    @media (width <= 1024px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (width <= 640px) {
      grid-template-columns: 1fr;
      gap: v.$spacing-md;
    }
  }

  .feature-card {
    padding: v.$spacing-xl;
    cursor: pointer;

    .feature-tag {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.1em;
      color: $accent-color;
      margin-bottom: v.$spacing-md;
    }

    .feature-icon {
      color: $brand-primary;
      margin-bottom: v.$spacing-md;
    }

    h3 {
      font-size: v.$font-size-lg;
      font-weight: 800;
      color: $text-main;
      margin: 0 0 v.$spacing-sm;
    }

    p {
      font-size: v.$font-size-sm;
      line-height: 1.7;
      color: $text-sec;
      margin: 0;
    }

    .feature-glow {
      position: absolute;
      inset: 0;
      background: color-mix(in srgb, var(--el-color-primary) 3%, transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }

    &:hover .feature-glow {
      opacity: 1;
    }
  }
}

// Timeline Section - 横向航道图（上：卡片横排，下：轨道线+圆点）
.timeline-section {
  .timeline-horizontal {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
  }

  .timeline-row {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    width: 100%;
    gap: 0;
  }

  .timeline-row-cards {
    margin-bottom: v.$spacing-md;
  }

  .timeline-item-card {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 v.$spacing-sm;
  }

  .timeline-item-card:first-child {
    padding-left: 0;
  }

  .timeline-item-card:last-child {
    padding-right: 0;
  }

  .timeline-row-track {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 0 v.$spacing-sm;
  }

  .timeline-row-track .marker-dot {
    width: 12px;
    height: 12px;
    background: $brand-primary;
    border-radius: var(--global-border-radius);
    flex-shrink: 0;
    box-shadow: var(--global-box-shadow);
  }

  .timeline-row-track .marker-line {
    flex: 1;
    height: 2px;
    min-width: 16px;
    background: $brand-primary;
  }

  .timeline-content {
    width: 100%;
    padding: v.$spacing-lg;
    text-align: center;
    height: 100%;
    box-sizing: border-box;

    .timeline-year {
      font-size: v.$font-size-xs;
      font-weight: 900;
      color: $accent-color;
      letter-spacing: 0.1em;
      margin-bottom: v.$spacing-sm;
    }

    h4 {
      font-size: v.$font-size-lg;
      font-weight: 800;
      color: $text-main;
      margin: 0 0 v.$spacing-sm;
    }

    p {
      font-size: v.$font-size-sm;
      color: $text-sec;
      margin: 0;
      line-height: 1.65;
    }
  }

  @media (width <= 768px) {
    .timeline-row {
      flex-wrap: nowrap;
      overflow: auto hidden;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      padding-bottom: v.$spacing-sm;
    }

    .timeline-row-cards {
      margin-bottom: v.$spacing-sm;
    }

    .timeline-item-card {
      flex: 0 0 min(260px, 78vw);
      scroll-snap-align: start;
      padding: 0 v.$spacing-xs;
    }

    .timeline-row-track {
      padding: 0 v.$spacing-xs;
    }

    .timeline-row-track .marker-line {
      min-width: v.$spacing-sm;
    }
  }
}

// Team Section - 头像与卡片排版
:where(.team-section) {
  .team-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: v.$spacing-xl;

    @media (width <= 768px) {
      grid-template-columns: 1fr;
      gap: v.$spacing-lg;
    }
  }

  .team-card {
    padding: v.$spacing-2xl v.$spacing-xl;
    text-align: center;

    .member-avatar {
      position: relative;
      width: 88px;
      height: 88px;
      margin: 0 auto v.$spacing-lg;

      .avatar-placeholder {
        width: 100%;
        height: 100%;
        background: $brand-primary;
        border-radius: var(--global-border-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: v.$font-size-3xl;
        font-weight: 900;
        color: var(--el-bg-color-page);
      }

      .avatar-ring {
        position: absolute;
        inset: -5px;
        border: 2px solid $border-light;
        border-radius: var(--global-border-radius);
        animation: pulse 2.5s ease-in-out infinite;
      }
    }

    h3 {
      font-size: v.$font-size-xl;
      font-weight: 800;
      color: $text-main;
      margin: 0 0 v.$spacing-sm;
    }

    .member-role {
      font-size: v.$font-size-sm;
      font-weight: v.$font-weight-bold;
      color: $accent-color;
      margin-bottom: v.$spacing-md;
    }

    p {
      font-size: v.$font-size-sm;
      color: $text-sec;
      line-height: 1.7;
      margin: 0;
    }
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.7; }
}

// Contact Section - 联系卡片统一间距
.contact-section {
  .contact-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: v.$spacing-lg;

    @media (width <= 768px) {
      grid-template-columns: 1fr;
      gap: v.$spacing-md;
    }
  }

  .contact-card {
    padding: v.$spacing-xl;
    text-align: center;

    .contact-icon {
      color: $brand-primary;
      margin-bottom: v.$spacing-md;
    }

    h4 {
      font-size: v.$font-size-base;
      font-weight: 800;
      color: $text-main;
      margin: 0 0 v.$spacing-sm;
    }

    p {
      font-size: v.$font-size-sm;
      color: $text-sec;
      margin: 0;
    }
  }
}

// 滚动动画 - 更柔和的入场
.scroll-reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);

  &.scroll-animated {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes rippleExpand {
  to { transform: scale(4); opacity: 0; }
}

// 暗色模式
:global(html.dark) {
  .about-root {
    background: var(--el-bg-color);
  }

  .glass-card {
    background: var(--color-dark-141414-85);
    border-color: var(--color-white-8);

    &:hover {
      border-color: var(--color-white-14);
    }
  }

  .bg-system {
    .bg-glow {
      opacity: 0.1;
    }
  }

  .stats-section {
    background: var(--color-white-2);

    .stat-item:hover {
      background: var(--color-white-6);
      border-color: var(--color-white-8);
    }
  }

  .team-card .avatar-placeholder {
    background: var(--color-gray-222);
  }
}
</style>
