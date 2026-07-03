<template>
  <div class="banner-detail">
    <div class="banner-detail__bg" />
    <div class="banner-detail__wrap">
      <!-- 返回导航 -->
      <nav class="banner-detail__nav" :aria-label="t('aiWorld.back')">
        <RouterLink :to="{ name: 'aiWorld' }" class="banner-detail__back">
          <el-icon><ArrowLeft /></el-icon>
          <span>{{ t('aiWorld.back') }}</span>
        </RouterLink>
      </nav>

      <!-- Hero 区 -->
      <section class="banner-detail__hero">
        <div class="banner-detail__hero-inner">
          <div class="banner-detail__hero-content">
            <span class="banner-detail__hero-badge">{{ t('aiWorld.bannerDetail.badge') }}</span>
            <h1 class="banner-detail__hero-title">{{ t('aiWorld.bannerDetail.heroTitle') }}</h1>
            <p class="banner-detail__hero-desc">{{ t('aiWorld.bannerDetail.heroDesc') }}</p>
            <div class="banner-detail__hero-stats">
              <div class="banner-detail__hero-avatars">
                <img
                  v-for="i in 3"
                  :key="i"
                  :src="avatarPlaceholders[i - 1]"
                  :alt="`Avatar ${i}`"
                  class="banner-detail__hero-avatar"
                  loading="lazy"
                />
                <div class="banner-detail__hero-avatar-count">{{ t('aiWorld.bannerDetail.tenThousandPlus') }}</div>
              </div>
              <p class="banner-detail__hero-stats-text">{{ t('aiWorld.bannerDetail.heroStats') }}</p>
            </div>
          </div>
          <div class="banner-detail__hero-image-wrap">
            <img
              :src="heroImageSrc"
              :alt="t('aiWorld.bannerDetail.heroTitle')"
              class="banner-detail__hero-image"
              loading="eager"
            />
          </div>
        </div>
      </section>

      <!-- 平台概述 -->
      <section id="overview" class="banner-detail__section">
        <div class="banner-detail__section-header">
          <span class="banner-detail__tag">{{ t('aiWorld.bannerDetail.overviewTag') }}</span>
          <h2 class="banner-detail__section-title">{{ t('aiWorld.bannerDetail.overviewTitle') }}</h2>
          <p class="banner-detail__section-desc">{{ t('aiWorld.bannerDetail.overviewDesc') }}</p>
        </div>
        <div class="banner-detail__grid banner-detail__grid--3">
          <div class="banner-detail__card">
            <div class="banner-detail__card-icon">
              <el-icon><Location /></el-icon>
            </div>
            <h3 class="banner-detail__card-title">{{ t('aiWorld.bannerDetail.platformPosition') }}</h3>
            <p class="banner-detail__card-desc">{{ t('aiWorld.bannerDetail.platformPositionDesc') }}</p>
          </div>
          <div class="banner-detail__card">
            <div class="banner-detail__card-icon">
              <el-icon><Aim /></el-icon>
            </div>
            <h3 class="banner-detail__card-title">{{ t('aiWorld.bannerDetail.developmentGoal') }}</h3>
            <ul class="banner-detail__card-list">
              <li><span class="banner-detail__highlight">1{{ t('aiWorld.bannerDetail.year') }}</span>{{ t('aiWorld.bannerDetail.colon') }}{{ t('aiWorld.bannerDetail.goal1Y') }}</li>
              <li><span class="banner-detail__highlight">3{{ t('aiWorld.bannerDetail.year') }}</span>{{ t('aiWorld.bannerDetail.colon') }}{{ t('aiWorld.bannerDetail.goal3Y') }}</li>
              <li><span class="banner-detail__highlight">10{{ t('aiWorld.bannerDetail.year') }}</span>{{ t('aiWorld.bannerDetail.colon') }}{{ t('aiWorld.bannerDetail.goal10Y') }}</li>
            </ul>
          </div>
          <div class="banner-detail__card">
            <div class="banner-detail__card-icon">
              <el-icon><Aim /></el-icon>
            </div>
            <h3 class="banner-detail__card-title">{{ t('aiWorld.bannerDetail.coreMission') }}</h3>
            <p class="banner-detail__card-desc">{{ t('aiWorld.bannerDetail.coreMissionDesc') }}</p>
            <p class="banner-detail__card-slogan">{{ t('aiWorld.bannerDetail.coreMissionSlogan') }}</p>
          </div>
        </div>
        <!-- 平台宗旨 -->
        <div class="banner-detail__slogan-box">
          <h3 class="banner-detail__slogan-title">{{ t('aiWorld.bannerDetail.platformSlogan') }}</h3>
          <div class="banner-detail__slogan-grid">
            <div class="banner-detail__slogan-item">
              <span class="banner-detail__slogan-label">{{ t('aiWorld.bannerDetail.aiEmpower') }}</span>
              <p class="banner-detail__slogan-desc">{{ t('aiWorld.bannerDetail.aiEmpowerDesc') }}</p>
            </div>
            <div class="banner-detail__slogan-item">
              <span class="banner-detail__slogan-label">{{ t('aiWorld.bannerDetail.trafficFission') }}</span>
              <p class="banner-detail__slogan-desc">{{ t('aiWorld.bannerDetail.trafficFissionDesc') }}</p>
            </div>
            <div class="banner-detail__slogan-item">
              <span class="banner-detail__slogan-label">{{ t('aiWorld.bannerDetail.globalRestructure') }}</span>
              <p class="banner-detail__slogan-desc">{{ t('aiWorld.bannerDetail.globalRestructureDesc') }}</p>
            </div>
            <div class="banner-detail__slogan-item">
              <span class="banner-detail__slogan-label">{{ t('aiWorld.bannerDetail.dawnEra') }}</span>
              <p class="banner-detail__slogan-desc">{{ t('aiWorld.bannerDetail.dawnEraDesc') }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 核心功能 -->
      <section id="function" class="banner-detail__section banner-detail__section--light">
        <div class="banner-detail__section-header">
          <span class="banner-detail__tag">{{ t('aiWorld.bannerDetail.functionTag') }}</span>
          <h2 class="banner-detail__section-title">{{ t('aiWorld.bannerDetail.functionTitle') }}</h2>
          <p class="banner-detail__section-desc">{{ t('aiWorld.bannerDetail.functionDesc') }}</p>
        </div>
        <div class="banner-detail__grid banner-detail__grid--3">
          <div
            v-for="(fn, idx) in functionItems"
            :key="idx"
            class="banner-detail__card banner-detail__card--compact"
          >
            <div class="banner-detail__card-icon banner-detail__card-icon--small">
              <el-icon><component :is="fn.icon" /></el-icon>
            </div>
            <h3 class="banner-detail__card-title">{{ fn.title }}</h3>
            <p class="banner-detail__card-desc">{{ fn.desc }}</p>
          </div>
        </div>
      </section>

      <!-- 企业解决方案 -->
      <section id="solution" class="banner-detail__section">
        <div class="banner-detail__section-header">
          <span class="banner-detail__tag">{{ t('aiWorld.bannerDetail.solutionTag') }}</span>
          <h2 class="banner-detail__section-title">{{ t('aiWorld.bannerDetail.solutionTitle') }}</h2>
          <p class="banner-detail__section-desc">{{ t('aiWorld.bannerDetail.solutionDesc') }}</p>
        </div>
        <div class="banner-detail__grid banner-detail__grid--3">
          <div
            v-for="(sol, idx) in solutionItems"
            :key="idx"
            class="banner-detail__solution-card"
          >
            <img
              :src="sol.image"
              :alt="sol.title"
              class="banner-detail__solution-img"
              loading="lazy"
            />
            <div class="banner-detail__solution-content">
              <h3 class="banner-detail__card-title">{{ sol.title }}</h3>
              <p class="banner-detail__card-desc">{{ sol.desc }}</p>
              <ul class="banner-detail__solution-list">
                <li v-for="(item, i) in sol.items" :key="i">
                  <el-icon class="banner-detail__check-icon"><Check /></el-icon>
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- 发展规划 -->
      <section id="development" class="banner-detail__section banner-detail__section--light">
        <div class="banner-detail__section-header">
          <span class="banner-detail__tag">{{ t('aiWorld.bannerDetail.developmentTag') }}</span>
          <h2 class="banner-detail__section-title">{{ t('aiWorld.bannerDetail.developmentTitle') }}</h2>
          <p class="banner-detail__section-desc">{{ t('aiWorld.bannerDetail.developmentDesc') }}</p>
        </div>
        <div class="banner-detail__grid banner-detail__grid--3">
          <div
            v-for="(dev, idx) in developmentItems"
            :key="idx"
            class="banner-detail__dev-card"
          >
            <div class="banner-detail__dev-badge">
              <el-icon><component :is="dev.icon" /></el-icon>
            </div>
            <h3 class="banner-detail__card-title">{{ dev.title }}</h3>
            <ul class="banner-detail__dev-list">
              <li v-for="(item, i) in dev.items" :key="i" class="banner-detail__dev-item">
                <span class="banner-detail__dev-num">{{ String(Number(i) + 1).padStart(2, '0') }}</span>
                <p>{{ item }}</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 核心价值 -->
      <section id="value" class="banner-detail__section">
        <div class="banner-detail__section-header">
          <span class="banner-detail__tag">{{ t('aiWorld.bannerDetail.valueTag') }}</span>
          <h2 class="banner-detail__section-title">{{ t('aiWorld.bannerDetail.valueTitle') }}</h2>
          <p class="banner-detail__section-desc">{{ t('aiWorld.bannerDetail.valueDesc') }}</p>
        </div>
        <div class="banner-detail__value-layout">
          <div class="banner-detail__value-list">
            <div
              v-for="(v, idx) in valueItems"
              :key="idx"
              class="banner-detail__value-item"
            >
              <div class="banner-detail__value-icon">
                <el-icon><component :is="v.icon" /></el-icon>
              </div>
              <div>
                <h3 class="banner-detail__card-title">{{ v.title }}</h3>
                <p class="banner-detail__card-desc">{{ v.desc }}</p>
              </div>
            </div>
          </div>
          <div class="banner-detail__value-image-wrap">
            <img
              :src="valueImageSrc"
              alt="Core value"
              class="banner-detail__value-image"
              loading="lazy"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Location,
  Aim,
  User,
  DataLine,
  TrendCharts,
  Share,
  Check,
  Cpu,
  Link,
  Connection,
} from '@element-plus/icons-vue'
import aiWorldLb1 from '@/assets/images/aiWorldLb1.jpg'
import aiWorldLb2 from '@/assets/images/aiWorldLb2.jpg'
import aiWorldLb3 from '@/assets/images/aiWorldLb3.jpg'
import aiWorldLb4 from '@/assets/images/aiWorldLb4.jpg'
import aiWorldLb5 from '@/assets/images/aiWorldLb5.jpg'

defineOptions({
  name: 'AiWorldBannerDetail',
})

const { t } = useI18n()
const route = useRoute()

const heroImages = [aiWorldLb1, aiWorldLb2, aiWorldLb3, aiWorldLb4, aiWorldLb5]
const index = computed(() => {
  const idx = parseInt(route.params.index as string, 10)
  return Number.isNaN(idx) || idx < 0 || idx >= heroImages.length ? 0 : idx
})
const heroImageSrc = computed(() => heroImages[index.value])
const valueImageSrc = computed(() => heroImages[(index.value + 1) % heroImages.length])

const avatarPlaceholders = [
  '/images/common/empty.svg',
  '/images/common/empty.svg',
  '/images/common/empty.svg',
]

const functionItems = computed(() => [
  { icon: markRaw(User), title: t('aiWorld.bannerDetail.fn1Title'), desc: t('aiWorld.bannerDetail.fn1Desc') },
  { icon: markRaw(DataLine), title: t('aiWorld.bannerDetail.fn2Title'), desc: t('aiWorld.bannerDetail.fn2Desc') },
  { icon: markRaw(TrendCharts), title: t('aiWorld.bannerDetail.fn3Title'), desc: t('aiWorld.bannerDetail.fn3Desc') },
  { icon: markRaw(Cpu), title: t('aiWorld.bannerDetail.fn4Title'), desc: t('aiWorld.bannerDetail.fn4Desc') },
  { icon: markRaw(Cpu), title: t('aiWorld.bannerDetail.fn5Title'), desc: t('aiWorld.bannerDetail.fn5Desc') },
  { icon: markRaw(Cpu), title: t('aiWorld.bannerDetail.fn6Title'), desc: t('aiWorld.bannerDetail.fn6Desc') },
  { icon: markRaw(Connection), title: t('aiWorld.bannerDetail.fn7Title'), desc: t('aiWorld.bannerDetail.fn7Desc') },
  { icon: markRaw(TrendCharts), title: t('aiWorld.bannerDetail.fn8Title'), desc: t('aiWorld.bannerDetail.fn8Desc') },
  { icon: markRaw(User), title: t('aiWorld.bannerDetail.fn9Title'), desc: t('aiWorld.bannerDetail.fn9Desc') },
])

const solutionItems = computed(() => [
  {
    title: t('aiWorld.bannerDetail.sol1Title'),
    desc: t('aiWorld.bannerDetail.sol1Desc'),
    image: aiWorldLb1,
    items: [
      t('aiWorld.bannerDetail.sol1Item1'),
      t('aiWorld.bannerDetail.sol1Item2'),
      t('aiWorld.bannerDetail.sol1Item3'),
      t('aiWorld.bannerDetail.sol1Item4'),
    ],
  },
  {
    title: t('aiWorld.bannerDetail.sol2Title'),
    desc: t('aiWorld.bannerDetail.sol2Desc'),
    image: aiWorldLb2,
    items: [
      t('aiWorld.bannerDetail.sol2Item1'),
      t('aiWorld.bannerDetail.sol2Item2'),
      t('aiWorld.bannerDetail.sol2Item3'),
      t('aiWorld.bannerDetail.sol2Item4'),
    ],
  },
  {
    title: t('aiWorld.bannerDetail.sol3Title'),
    desc: t('aiWorld.bannerDetail.sol3Desc'),
    image: aiWorldLb3,
    items: [
      t('aiWorld.bannerDetail.sol3Item1'),
      t('aiWorld.bannerDetail.sol3Item2'),
      t('aiWorld.bannerDetail.sol3Item3'),
      t('aiWorld.bannerDetail.sol3Item4'),
    ],
  },
  {
    title: t('aiWorld.bannerDetail.sol4Title'),
    desc: t('aiWorld.bannerDetail.sol4Desc'),
    image: aiWorldLb4,
    items: [
      t('aiWorld.bannerDetail.sol4Item1'),
      t('aiWorld.bannerDetail.sol4Item2'),
      t('aiWorld.bannerDetail.sol4Item3'),
      t('aiWorld.bannerDetail.sol4Item4'),
    ],
  },
  {
    title: t('aiWorld.bannerDetail.sol5Title'),
    desc: t('aiWorld.bannerDetail.sol5Desc'),
    image: aiWorldLb5,
    items: [
      t('aiWorld.bannerDetail.sol5Item1'),
      t('aiWorld.bannerDetail.sol5Item2'),
      t('aiWorld.bannerDetail.sol5Item3'),
      t('aiWorld.bannerDetail.sol5Item4'),
    ],
  },
  {
    title: t('aiWorld.bannerDetail.sol6Title'),
    desc: t('aiWorld.bannerDetail.sol6Desc'),
    image: aiWorldLb1,
    items: [
      t('aiWorld.bannerDetail.sol6Item1'),
      t('aiWorld.bannerDetail.sol6Item2'),
      t('aiWorld.bannerDetail.sol6Item3'),
      t('aiWorld.bannerDetail.sol6Item4'),
    ],
  },
])

const developmentItems = computed(() => [
  {
    icon: markRaw(Cpu),
    title: t('aiWorld.bannerDetail.dev1Title'),
    items: [
      t('aiWorld.bannerDetail.dev1Item1'),
      t('aiWorld.bannerDetail.dev1Item2'),
      t('aiWorld.bannerDetail.dev1Item3'),
    ],
  },
  {
    icon: markRaw(Link),
    title: t('aiWorld.bannerDetail.dev2Title'),
    items: [
      t('aiWorld.bannerDetail.dev2Item1'),
      t('aiWorld.bannerDetail.dev2Item2'),
      t('aiWorld.bannerDetail.dev2Item3'),
    ],
  },
  {
    icon: markRaw(Connection),
    title: t('aiWorld.bannerDetail.dev3Title'),
    items: [
      t('aiWorld.bannerDetail.dev3Item1'),
      t('aiWorld.bannerDetail.dev3Item2'),
      t('aiWorld.bannerDetail.dev3Item3'),
    ],
  },
])

const valueItems = computed(() => [
  { icon: markRaw(User), title: t('aiWorld.bannerDetail.val1Title'), desc: t('aiWorld.bannerDetail.val1Desc') },
  { icon: markRaw(Cpu), title: t('aiWorld.bannerDetail.val2Title'), desc: t('aiWorld.bannerDetail.val2Desc') },
  { icon: markRaw(TrendCharts), title: t('aiWorld.bannerDetail.val3Title'), desc: t('aiWorld.bannerDetail.val3Desc') },
  { icon: markRaw(Share), title: t('aiWorld.bannerDetail.val4Title'), desc: t('aiWorld.bannerDetail.val4Desc') },
])

</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

$primary: var(--el-text-color-primary);
$secondary: var(--el-text-color-primary);
$light: var(--color-gray-f5f7fa);
$text-primary: var(--color-gray-111);
$text-secondary: var(--color-gray-666);
$border-light: var(--el-border-color-lighter);

.banner-detail {
  --bd-primary: #{$primary};
  --bd-secondary: #{$secondary};
  --bd-light: #{$light};
  --bd-text: #{$text-primary};
  --bd-text-secondary: #{$text-secondary};
  --bd-border: #{$border-light};

  min-height: 100%;
  position: relative;
}

.banner-detail__bg {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  background: var(--el-bg-color);
  pointer-events: none;
}

.banner-detail__wrap {
  position: relative;
  z-index: var(--z-base);
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 24px 64px;

  @include bp.tablet-down {
    padding: 16px 16px 48px;
  }
}

.banner-detail__nav {
  margin-bottom: 24px;
}

.banner-detail__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--bd-text-secondary);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.15s ease;

  &:hover {
    color: var(--bd-text);
  }
}

/* Hero */
.banner-detail__hero {
  background: var(--bd-light);
  margin: 0 -24px 48px;
  padding: 32px 24px 48px;

  @include bp.tablet-down {
    margin: 0 -16px 32px;
    padding: 24px 16px 32px;
  }
}

.banner-detail__hero-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;

  @include bp.laptop-up {
    flex-direction: row;
    align-items: center;
    gap: 48px;
  }
}

.banner-detail__hero-content {
  flex: 1;
}

.banner-detail__hero-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba($primary, 0.1);
  color: var(--bd-primary);
  border-radius: var(--global-border-radius);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
}

.banner-detail__hero-title {
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  font-weight: 700;
  line-height: 1.25;
  color: var(--bd-text);
  margin: 0 0 16px;
  letter-spacing: -0.02em;
}

.banner-detail__hero-desc {
  font-size: 1rem;
  color: var(--bd-text-secondary);
  line-height: 1.6;
  margin: 0 0 24px;
  max-width: 32rem;

  @include bp.tablet-up {
    font-size: 1.125rem;
  }
}

.banner-detail__hero-stats {
  display: flex;
  align-items: center;
  gap: 24px;
}

.banner-detail__hero-avatars {
  display: flex;
  align-items: center;
}

.banner-detail__hero-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--el-bg-color);
  margin-left: -8px;
  object-fit: cover;

  &:first-child {
    margin-left: 0;
  }
}

.banner-detail__hero-avatar-count {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--el-bg-color);
  margin-left: -8px;
  background: rgba($primary, 0.1);
  color: var(--bd-primary);
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-detail__hero-stats-text {
  font-size: 13px;
  color: var(--bd-text-secondary);
  margin: 0;
}

.banner-detail__hero-image-wrap {
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;

  @include bp.laptop-up {
    width: 50%;
    max-width: 400px;
  }
}

.banner-detail__hero-image {
  width: 100%;
  height: auto;
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
}

/* Section */
.banner-detail__section {
  margin-bottom: 64px;

  &--light {
    background: var(--bd-light);
    margin-left: -24px;
    margin-right: -24px;
    padding: 48px 24px;

  @include bp.tablet-down {
    margin-left: -16px;
    margin-right: -16px;
    padding: 32px 16px;
  }
  }
}

.banner-detail__section-header {
  text-align: center;
  margin-bottom: 40px;
}

.banner-detail__tag {
  display: inline-block;
  padding: 4px 16px;
  background: rgba($primary, 0.1);
  color: var(--bd-primary);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 16px;
}

.banner-detail__section-title {
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  color: var(--bd-text);
  margin: 0 0 16px;
  letter-spacing: -0.02em;
}

.banner-detail__section-desc {
  font-size: 1rem;
  color: var(--bd-text-secondary);
  max-width: 48rem;
  margin: 0 auto;
  line-height: 1.6;
}

/* Grid */
.banner-detail__grid {
  display: grid;
  gap: 24px;

  &--3 {
    grid-template-columns: 1fr;

    @include bp.tablet-up {
      grid-template-columns: repeat(2, 1fr);
    }

    @include bp.laptop-up {
      grid-template-columns: repeat(3, 1fr);
    }
  }
}

/* Card */
.banner-detail__card {
  padding: 24px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition: box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    box-shadow: var(--global-box-shadow);
  }

  &--compact {
    padding: 20px;
  }
}

.banner-detail__section--light .banner-detail__card {
  background: var(--el-bg-color);
}

.banner-detail__card-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--global-border-radius);
  background: rgba($primary, 0.1);
  color: var(--bd-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 16px;

  &--small {
    width: 40px;
    height: 40px;
    font-size: 20px;
    margin-bottom: 12px;
  }
}

.banner-detail__card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--bd-text);
  margin: 0 0 8px;
}

.banner-detail__card-desc {
  font-size: 14px;
  color: var(--bd-text-secondary);
  line-height: 1.5;
  margin: 0;
}

.banner-detail__card-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;

  li {
    font-size: 14px;
    color: var(--bd-text-secondary);
    margin: 6px 0;
  }
}

.banner-detail__highlight {
  font-weight: 600;
  color: var(--bd-primary);
}

.banner-detail__card-slogan {
  font-size: 14px;
  font-weight: 500;
  color: var(--bd-primary);
  margin: 12px 0 0;
}

/* Slogan box */
.banner-detail__slogan-box {
  margin-top: 40px;
  padding: 32px;
  background: rgba($primary, 0.05);
  border-radius: var(--global-border-radius);
}

.banner-detail__slogan-title {
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  color: var(--bd-text);
  margin: 0 0 32px;
}

.banner-detail__slogan-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;

  @include bp.tablet-up {
    grid-template-columns: repeat(2, 1fr);
  }

  @include bp.laptop-up {
    grid-template-columns: repeat(4, 1fr);
  }
}

.banner-detail__slogan-item {
  text-align: center;
}

.banner-detail__slogan-label {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--bd-primary);
  margin-bottom: 8px;
}

.banner-detail__slogan-desc {
  font-size: 13px;
  color: var(--bd-text-secondary);
  margin: 0;
  line-height: 1.5;
}

/* Solution card */
.banner-detail__solution-card {
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: var(--global-box-shadow);
  }
}

.banner-detail__solution-img {
  width: 100%;
  height: 192px;
  object-fit: cover;
  display: block;
}

.banner-detail__solution-content {
  padding: 24px;
}

.banner-detail__solution-list {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--bd-text-secondary);

  li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 6px 0;
  }
}

.banner-detail__check-icon {
  color: var(--bd-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

/* Dev card */
.banner-detail__dev-card {
  position: relative;
  padding: 32px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: var(--global-box-shadow);
  }
}

.banner-detail__section--light .banner-detail__dev-card {
  background: var(--el-bg-color);
}

.banner-detail__dev-badge {
  position: absolute;
  top: -20px;
  left: -20px;
  width: 64px;
  height: 64px;
  background: var(--bd-primary);
  color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.banner-detail__dev-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.banner-detail__dev-item {
  display: flex;
  gap: 12px;
  margin: 16px 0 0;

  p {
    margin: 0;
    font-size: 14px;
    color: var(--bd-text-secondary);
    line-height: 1.5;
  }
}

.banner-detail__dev-num {
  font-weight: 700;
  color: var(--bd-primary);
  flex-shrink: 0;
}

/* Value */
.banner-detail__value-layout {
  display: grid;
  gap: 48px;

  @include bp.laptop-up {
    grid-template-columns: 1fr 1fr;
    align-items: center;
  }
}

.banner-detail__value-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.banner-detail__value-item {
  display: flex;
  gap: 24px;
}

.banner-detail__value-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--global-border-radius);
  background: rgba($primary, 0.1);
  color: var(--bd-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.banner-detail__value-image-wrap {
  width: 100%;
}

.banner-detail__value-image {
  width: 100%;
  height: auto;
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
}

</style>

<style lang="scss">
html.dark .banner-detail {
  --bd-text: var(--el-text-color-primary);
  --bd-text-secondary: var(--el-text-color-secondary);
  --bd-border: var(--el-border-color);

  .banner-detail__bg {
    background: var(--el-bg-color-page);
  }

  .banner-detail__hero {
    background: var(--el-fill-color-extra-light);
  }

  .banner-detail__card,
  .banner-detail__dev-card {
    background: var(--el-fill-color-extra-light);
    border-color: var(--el-border-color);
  }

  .banner-detail__section--light {
    background: var(--el-fill-color-extra-light);
  }
}
</style>
