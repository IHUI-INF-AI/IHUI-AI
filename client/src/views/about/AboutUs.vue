<template>
  <div class="about-us-page">
    <div class="story-bg">
      <div class="gradient-layer" />
      <div class="noise-texture" />
    </div>

    <div class="container">
      <!-- Hero：定位 + 数据 -->
      <header class="hero ihui-ai-fade-in-top-animation">
        <div class="hero-badge">
          <span class="status-dot"></span>
          <span class="badge-text font-edix">ABOUT</span>
        </div>
        <h1 class="hero-title">{{ t('aboutUs.heroTitle') }}</h1>
        <p class="hero-lead">{{ t('aboutUs.heroSubtitle') }}</p>
        <p v-if="t('aboutUs.heroMission')" class="hero-mission">{{ t('aboutUs.heroMission') }}</p>
        <div class="hero-stats">
          <template v-for="(stat, idx) in stats" :key="stat.key">
            <div v-if="Number(idx) > 0" class="stat-sep" aria-hidden="true" />
            <div class="stat">
              <span class="stat-value">{{ stat.value }}</span>
              <span class="stat-label">{{ t(stat.labelKey) }}</span>
            </div>
          </template>
        </div>
      </header>

      <!-- 公司简介 -->
      <section class="section intro-section">
        <div class="section-head">
          <span class="section-tag">{{ t('aboutUs.companyIntro.tag') }}</span>
          <h2 class="section-title">{{ t('aboutUs.companyIntro.title') }}</h2>
          <p v-if="t('aboutUs.companyIntro.subtitle')" class="section-subtitle">{{ t('aboutUs.companyIntro.subtitle') }}</p>
        </div>
        <div class="intro-layout">
          <div class="intro-content">
            <p class="intro-p">{{ t('aboutUs.companyIntro.paragraph1') }}</p>
            <p class="intro-p">{{ t('aboutUs.companyIntro.paragraph2') }}</p>
            <div class="intro-cta">
              <el-button type="primary" @click="goToRoute('/about/contact-us')">
                {{ t('aboutUs.quickNav.contactUs') }}
              </el-button>
            </div>
          </div>
          <div class="intro-visual">
            <div class="visual-card">
              <span class="visual-label">AI-FIRST</span>
              <span class="visual-sublabel">{{ t('aboutUs.companyIntro.visualSublabel') }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 发展历程 - 横向航道图 -->
      <section class="section timeline-section">
        <div class="section-head">
          <span class="section-tag">{{ t('aboutUs.developmentHistory.tag') }}</span>
          <h2 class="section-title">{{ t('aboutUs.developmentHistory.title') }}</h2>
        </div>
        <div class="timeline-wrapper">
          <button
            v-show="canScrollLeft"
            class="timeline-nav-btn timeline-nav-prev"
            aria-label="上一个"
            @click="scrollTimeline('left')"
          >
            <el-icon><ChevronLeft /></el-icon>
          </button>
          <div
            ref="timelineRef"
            class="timeline timeline-horizontal"
          >
            <div class="timeline-row timeline-row-cards">
              <div
                v-for="(m, i) in milestones"
                :key="'card-' + i"
                class="timeline-item-card"
              >
                <div class="timeline-card">
                  <span class="timeline-date">{{ m.date }}</span>
                  <h3 class="timeline-title">{{ m.title }}</h3>
                  <p class="timeline-desc">{{ m.description }}</p>
                </div>
              </div>
            </div>
            <div class="timeline-row timeline-row-track">
              <template v-for="(m, i) in milestones" :key="'track-' + i">
                <div class="timeline-dot" />
                <div v-if="Number(i) < milestones.length - 1" class="timeline-line" aria-hidden="true" />
              </template>
            </div>
          </div>
          <button
            v-show="canScrollRight"
            class="timeline-nav-btn timeline-nav-next"
            @click="scrollTimeline('right')"
          >
            <el-icon><ChevronRight /></el-icon>
          </button>
        </div>
      </section>

      <!-- 核心团队 -->
      <section class="section team-section">
        <div class="section-head">
          <span class="section-tag">{{ t('aboutUs.team.tag') }}</span>
          <h2 class="section-title">{{ t('aboutUs.team.title') }}</h2>
          <p v-if="t('aboutUs.team.subtitle')" class="section-subtitle">{{ t('aboutUs.team.subtitle') }}</p>
        </div>
        <div class="team-grid">
          <div
            v-for="member in teamMembers"
            :key="member.id"
            class="team-card"
          >
            <div class="team-avatar">
              <el-icon :size="32"><User /></el-icon>
            </div>
            <div class="team-info">
              <span class="team-role">{{ member.role }}</span>
              <h3 class="team-name">{{ member.name }}</h3>
              <p class="team-bio">{{ member.description }}</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { markIcon } from '@/utils/markRaw'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'
import {
  Target,
  Zap,
  Shield,
  Heart,
  User,
  ChevronLeft,
  ChevronRight,
} from '@/lib/lucide-fallback'

const router = useRouter()
const { t } = useI18n()
const cleanup = useCleanup()

const _goHome = () => router.push('/')
const goToRoute = (path: string) => router.push(path)

// 时间线滚动相关
const timelineRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(true)

const updateScrollState = () => {
  if (!timelineRef.value) return
  const { scrollLeft, scrollWidth, clientWidth } = timelineRef.value
  canScrollLeft.value = scrollLeft > 0
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 10
}

const scrollTimeline = (direction: 'left' | 'right') => {
  if (!timelineRef.value) return
  const scrollAmount = 320
  timelineRef.value.scrollBy({
    left: direction === 'left' ? -scrollAmount : scrollAmount,
    behavior: 'smooth'
  })
  setTimeout(updateScrollState, 300)
}

onMounted(() => {
  updateScrollState()
  if (timelineRef.value) cleanup.addEventListener(timelineRef.value, 'scroll', updateScrollState as EventListener)
})

const stats = computed(() => [
  { key: 'users', value: t('aboutUs.sixKPlus'), labelKey: 'aboutUs.stats.users' },
  { key: 'developers', value: '8000+', labelKey: 'aboutUs.stats.developers' },
  { key: 'models', value: '50+', labelKey: 'aboutUs.stats.models' },
])

const _values = computed(() => [
  { id: 1, title: t('aboutUs.coreValues.professional.title'), desc: t('aboutUs.coreValues.professional.description'), icon: markIcon(Target) },
  { id: 2, title: t('aboutUs.coreValues.efficient.title'), desc: t('aboutUs.coreValues.efficient.description'), icon: markIcon(Zap) },
  { id: 3, title: t('aboutUs.coreValues.reliable.title'), desc: t('aboutUs.coreValues.reliable.description'), icon: markIcon(Shield) },
  { id: 4, title: t('aboutUs.coreValues.innovative.title'), desc: t('aboutUs.coreValues.innovative.description'), icon: markIcon(Heart) },
])

const milestones = computed(() => [
  { date: t('aboutUs.milestones.companyFounded.date'), title: t('aboutUs.milestones.companyFounded.title'), description: t('aboutUs.milestones.companyFounded.description') },
  { date: t('aboutUs.milestones.aiAppStore.date'), title: t('aboutUs.milestones.aiAppStore.title'), description: t('aboutUs.milestones.aiAppStore.description') },
  { date: t('aboutUs.milestones.platformLaunched.date'), title: t('aboutUs.milestones.platformLaunched.title'), description: t('aboutUs.milestones.platformLaunched.description') },
  { date: t('aboutUs.milestones.angelFunding.date'), title: t('aboutUs.milestones.angelFunding.title'), description: t('aboutUs.milestones.angelFunding.description') },
  { date: t('aboutUs.milestones.firstUsers.date'), title: t('aboutUs.milestones.firstUsers.title'), description: t('aboutUs.milestones.firstUsers.description') },
  { date: t('aboutUs.milestones.modelIntegration.date'), title: t('aboutUs.milestones.modelIntegration.title'), description: t('aboutUs.milestones.modelIntegration.description') },
  { date: t('aboutUs.milestones.usersMilestone.date'), title: t('aboutUs.milestones.usersMilestone.title'), description: t('aboutUs.milestones.usersMilestone.description') },
  { date: t('aboutUs.milestones.developersMilestone.date'), title: t('aboutUs.milestones.developersMilestone.title'), description: t('aboutUs.milestones.developersMilestone.description') },
])

const teamMembers = computed(() => [
  { id: 1, name: t('aboutUs.teamMembers.founder.name'), role: t('aboutUs.teamMembers.founder.role'), description: t('aboutUs.teamMembers.founder.description') },
])
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

.about-us-page {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.story-bg {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;

  .gradient-layer {
    position: absolute;
    top: -20%;
    right: -10%;
    width: 80%;
    height: 80%;
    background: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.02);
    filter: blur(80px);
  }

  .noise-texture {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: 0.04;
  }
}

.container {
  position: relative;
  z-index: var(--z-base);
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;

  @include bp.min-width(tablet) {
    padding: 0 32px;
  }

  @include bp.min-width(laptop) {
    padding: 0 40px;
  }
}

// ----- 导航 -----
.story-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 0 16px;

  @include bp.min-width(tablet) {
    padding: 32px 0 24px;
  }

  .back-link {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    font-weight: 600;

    &:hover {
      color: var(--el-text-color-primary);
    }
  }

  .version-tag {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    border: var(--unified-border);
    padding: 4px 10px;
    border-radius: var(--global-border-radius);
  }
}

// ----- Hero -----
.hero {
  padding: 32px 0 56px;

  @include bp.min-width(tablet) {
    padding: 48px 0 72px;
  }

  .hero-eyebrow {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: hsl(var(--primary));
    margin-bottom: 12px;
    text-transform: uppercase;
  }

  .hero-title {
    font-size: clamp(28px, 5vw, 44px);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--el-text-color-primary);
    margin: 0 0 16px;
  }

  .hero-lead {
    font-size: 16px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
    max-width: 540px;
    margin-bottom: 20px;

    @include bp.min-width(tablet) {
      font-size: 17px;
      margin-bottom: 24px;
    }
  }

  .hero-mission {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    max-width: 480px;
    margin-bottom: 28px;
    padding-left: 14px;
    border-left: 3px solid hsl(var(--primary));
    line-height: 1.5;

    @include bp.min-width(tablet) {
      margin-bottom: 36px;
    }
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 6px 12px;
    background: var(--el-fill-color-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--el-color-primary);
    }

    .badge-text {
      font-family: EDIX, sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--el-text-color-primary);
      text-transform: uppercase;
    }
  }

  .hero-stats {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 32px;

    @include bp.min-width(tablet) {
      gap: 0 40px;
    }
  }

  .stat-sep {
    width: 1px;
    height: 28px;
    background: var(--el-border-color-extra-light);
    align-self: center;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .stat-value {
      font-size: 24px;
      font-weight: 800;
      color: var(--el-text-color-primary);
      line-height: 1.2;
      letter-spacing: -0.02em;

      @include bp.min-width(tablet) {
        font-size: 28px;
      }
    }

    .stat-label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }
}

// ----- 通用 section -----
.section {
  padding: 40px 0 44px;
  border-top: var(--unified-border);

  @include bp.min-width(tablet) {
    padding: 52px 0 56px;
  }
}

.section-head {
  margin-bottom: 24px;

  @include bp.min-width(tablet) {
    margin-bottom: 32px;
  }
}

.section-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: hsl(var(--primary));
  margin-bottom: 6px;
  text-transform: uppercase;
}

.section-title {
  font-size: 21px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: -0.02em;
  line-height: 1.25;

  @include bp.min-width(tablet) {
    font-size: 25px;
  }
}

.section-subtitle {
  font-size: 14px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
  margin-top: 8px;
  max-width: 560px;
}

// ----- 公司简介 -----
.intro-section .intro-layout {
  display: grid;
  gap: 32px;

  @include bp.min-width(tablet) {
    grid-template-columns: 1fr 280px;
    gap: 48px;
    align-items: start;
  }
}

.intro-content {
  .intro-p {
    font-size: 15px;
    line-height: 1.72;
    color: var(--el-text-color-regular);
    margin-bottom: 14px;

    &:last-of-type {
      margin-bottom: 22px;
    }
  }

  .intro-cta :deep(.el-button) {
    font-weight: 600;
    padding: 10px 20px;
  }
}

.intro-visual {
  .visual-card {
    background: var(--el-fill-color-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.2s ease, background 0.2s ease;

    .visual-label {
      font-size: 18px;
      font-weight: 800;
      color: var(--el-text-color-primary);
      letter-spacing: 0.02em;
    }

    .visual-sublabel {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }
}

// ----- 核心价值 -----
.values-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @include bp.min-width(tablet) {
    gap: 20px;
  }

  @include bp.mobile-only {
    grid-template-columns: 1fr;
  }
}

.value-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 22px 18px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s ease, background 0.2s ease;

  @include bp.min-width(tablet) {
    padding: 24px 20px;
    min-height: 148px;
  }

  &:hover {
    border-color: var(--el-border-color);
    background: var(--el-fill-color-extra-light);

    .value-icon {
      color: hsl(var(--primary));
    }
  }

  .value-icon {
    color: hsl(var(--primary));
    font-size: 20px;
    margin-bottom: 14px;
    transition: color 0.2s ease;
    flex-shrink: 0;
  }

  .value-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    margin-bottom: 6px;
    flex-shrink: 0;
  }

  .value-desc {
    font-size: 13px;
    line-height: 1.52;
    color: var(--el-text-color-secondary);
    flex: 1;
  }
}

// ----- 时间轴：横向航道图（上排卡片，下排轨道线+圆点）-----
.timeline-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline-nav-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: var(--unified-border);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: calc(var(--z-base) + 9);

  &:hover {
    background: var(--el-fill-color-light);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    color: var(--el-color-primary);
  }

  &:active {
    transform: scale(0.95);
  }

  .el-icon {
    font-size: 20px;
  }
}

.timeline-horizontal {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  overflow: auto hidden;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: var(--el-border-color) transparent;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: var(--global-border-radius);
  }
}

.timeline-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: max-content;
  min-width: 100%;
  gap: 0;
}

.timeline-row-cards {
  margin-bottom: 16px;
}

.timeline-item-card {
  flex: 0 0 200px;
  width: 200px;
  padding: 0 8px;
  &:first-child { padding-left: 0; }
  &:last-child { padding-right: 0; }

  @include bp.min-width(tablet) {
    flex: 0 0 240px;
    width: 240px;
  }
}

.timeline-card {
  background: var(--el-fill-color-extra-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 18px 14px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s ease, background 0.2s ease;

  @include bp.min-width(tablet) {
    padding: 20px 16px;
  }

  &:hover {
    border-color: var(--el-border-color-lighter);
    background: var(--el-fill-color-light);
  }
}

.timeline-date {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: hsl(var(--primary));
  flex-shrink: 0;
}

.timeline-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0;
  line-height: 1.3;

  @include bp.min-width(tablet) {
    font-size: 15px;
  }
}

.timeline-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  margin: 0;
  flex: 1;

  @include bp.min-width(tablet) {
    font-size: 13px;
  }
}

.timeline-row-track {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}

.timeline-row-track .timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--global-border-radius);
  background: hsl(var(--primary));
  flex-shrink: 0;
  border: 2px solid var(--el-border-color-lighter);
}

.timeline-row-track .timeline-line {
  flex: 0 0 40px;
  height: 2px;
  background: var(--el-border-color-lighter);
}

// ----- 团队 -----
.team-grid {
  display: grid;
  gap: 20px;

  @include bp.min-width(tablet) {
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
}

.team-card {
  display: flex;
  gap: 18px;
  padding: 20px 22px;
  background: var(--el-fill-color-extra-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: border-color 0.2s ease, background 0.2s ease;

  @include bp.min-width(tablet) {
    padding: 24px;
    gap: 20px;
  }

  &:hover {
    border-color: var(--el-border-color-lighter);
    background: var(--el-fill-color-light);
  }
}

.team-avatar {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  border: var(--unified-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);

  @include bp.min-width(tablet) {
    width: 56px;
    height: 56px;
  }
}

.team-info {
  min-width: 0;

  .team-role {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: hsl(var(--primary));
    display: block;
    margin-bottom: 4px;
  }

  .team-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    margin-bottom: 6px;
  }

  .team-bio {
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
  }
}

// ----- 底部 -----
.story-footer {
  padding: 20px 20px 24px;
  border-top: var(--unified-border);
  max-width: 420px;
  margin: 0 auto;

  @include bp.min-width(tablet) {
    padding: 24px 20px 32px;
  }
}

.footer-tagline {
  font-size: 14px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  text-align: center;
  margin: 0;
}

.footer-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px 36px;

  button {
    background: none;
    border: none;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    padding: 0;
    transition: color 0.2s ease;

    &:hover {
      color: var(--el-text-color-primary);
    }
  }
}
</style>
