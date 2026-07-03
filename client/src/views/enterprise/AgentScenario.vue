<template>
  <div class="agent-scenario-page" ref="pageRef">
    <!-- 滚动进度指示器 -->
    <div class="scroll-progress-bar" :style="{ width: scrollProgress + '%' }"></div>

    <!-- 动态背景层 -->
    <div class="scenario-bg">
      <div class="gradient-layer" :style="{ transform: `translateY(${parallaxOffset * 0.3}px)` }"></div>
      <div class="noise-texture"></div>
      <!-- 装饰性SVG图形 -->
      <svg class="deco-svg deco-1" viewBox="0 0 100 100" :style="{ transform: `rotate(${scrollProgress * 0.5}deg)` }">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-violet-8b5cf6-10)" stroke-width="1" stroke-dasharray="8 4"/>
      </svg>
      <svg class="deco-svg deco-2" viewBox="0 0 100 100">
        <polygon points="50,5 95,50 50,95 5,50" fill="none" stroke="var(--color-violet-8b5cf6-08)" stroke-width="1"/>
      </svg>
    </div>

    <!-- 页面加载骨架屏 -->
    <div v-if="isLoading" class="page-skeleton">
      <div class="skeleton-nav"></div>
      <div class="skeleton-hero">
        <div class="skeleton-label"></div>
        <div class="skeleton-title"></div>
        <div class="skeleton-desc"></div>
      </div>
    </div>

    <div class="container" v-show="!isLoading">
      <!-- 导航 -->
      <nav class="scenario-nav" :class="{ 'is-visible': navVisible }">
        <el-button link @click="goBack" class="back-link">
          <el-icon><ArrowLeft /></el-icon> ENTERPRISE / BACK
        </el-button>
        <span class="version-tag">AGENT COMPASS</span>
      </nav>

      <!-- 英雄区 -->
      <header class="scenario-hero" :class="{ 'is-visible': heroVisible }">
        <div class="hero-label">
          <span class="label-text">AGENT SCENARIO COMPASS</span>
          <span class="label-line"></span>
        </div>
        <h1>
          <span v-for="(char, index) in heroTitle" :key="index" 
                class="char" 
                :style="{ '--char-index': index }">{{ char === ' ' ? '\u00A0' : char }}</span>
        </h1>
        <p class="hero-subtitle">{{ t('agentScenario.heroSubtitle') }}</p>
        <!-- 快速统计 -->
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-value"><AnimatedNumber :value="4" :duration="1000" /></span>
            <span class="stat-label">{{ t('hardcoded.agent.scenario.应用象限') }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value"><AnimatedNumber :value="78" :duration="1500" suffix="%" /></span>
            <span class="stat-label">{{ t('hardcoded.agent.scenario.企业已部署Q1') }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value"><AnimatedNumber :value="3" :duration="1200" suffix="x" /></span>
            <span class="stat-label">{{ t('hardcoded.agent.scenario.效率提升') }}</span>
          </div>
        </div>
      </header>

      <!-- 罗盘概述 -->
      <section class="compass-overview" v-scroll-reveal>
        <div class="section-label">OVERVIEW</div>
        <div class="overview-content">
          <div class="overview-text">
            <h2>{{ t('agentScenario.overview.title') }}</h2>
            <p>{{ t('agentScenario.overview.description') }}</p>
            <div class="overview-highlight">
              <span class="highlight-label">{{ t('agentScenario.overview.keyPoint') }}</span>
              <p>{{ t('agentScenario.overview.keyPointText') }}</p>
            </div>
          </div>
          <div class="overview-diagram">
            <div class="diagram-box">
              <div class="axis axis-x">
                <span class="axis-start">{{ t('agentScenario.axes.complexity.low') }}</span>
                <span class="axis-name">{{ t('agentScenario.axes.complexity.title') }}</span>
                <span class="axis-end">{{ t('agentScenario.axes.complexity.high') }}</span>
              </div>
              <div class="axis axis-y">
                <span class="axis-start">{{ t('agentScenario.axes.autonomy.low') }}</span>
                <span class="axis-name">{{ t('agentScenario.axes.autonomy.title') }}</span>
                <span class="axis-end">{{ t('agentScenario.axes.autonomy.high') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 四象限详解 -->
      <section class="quadrants-detail">
        <div class="section-label">QUADRANT ANALYSIS</div>
        
        <!-- Q1: 简单决策兼简单执行 -->
        <div class="quadrant-card" :class="{ active: activeQuadrant === 'simple' }" @click="setActiveQuadrant('simple')">
          <div class="quadrant-header">
            <span class="quadrant-tag">QUADRANT_01</span>
            <h3>{{ t('agentScenario.quadrants.simple.title') }}</h3>
          </div>
          <div class="quadrant-body">
            <div class="quadrant-description">
              <p>{{ t('agentScenario.quadrants.simple.fullDescription') }}</p>
            </div>
            <div class="quadrant-characteristics">
              <h4>{{ t('agentScenario.characteristics.title') }}</h4>
              <div class="char-grid">
                <div class="char-item">
                  <el-icon><Minus /></el-icon>
                  <span>{{ t('agentScenario.quadrants.simple.chars.steps') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><Minus /></el-icon>
                  <span>{{ t('agentScenario.quadrants.simple.chars.calls') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><Minus /></el-icon>
                  <span>{{ t('agentScenario.quadrants.simple.chars.volume') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><Minus /></el-icon>
                  <span>{{ t('agentScenario.quadrants.simple.chars.dependency') }}</span>
                </div>
              </div>
            </div>
            <div class="quadrant-examples">
              <h4>{{ t('agentScenario.examples.title') }}</h4>
              <div class="example-list">
                <div class="example-item">
                  <el-icon><MessageSquare /></el-icon>
                  <div>
                    <span class="example-name">{{ t('agentScenario.quadrants.simple.examples.qa.name') }}</span>
                    <span class="example-desc">{{ t('agentScenario.quadrants.simple.examples.qa.desc') }}</span>
                  </div>
                </div>
                <div class="example-item">
                  <el-icon><Workflow /></el-icon>
                  <div>
                    <span class="example-name">{{ t('agentScenario.quadrants.simple.examples.workflow.name') }}</span>
                    <span class="example-desc">{{ t('agentScenario.quadrants.simple.examples.workflow.desc') }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="quadrant-value">
              <h4>{{ t('agentScenario.value.title') }}</h4>
              <p>{{ t('agentScenario.quadrants.simple.value') }}</p>
            </div>
          </div>
        </div>

        <!-- Q2: 复杂决策智能体 -->
        <div class="quadrant-card" :class="{ active: activeQuadrant === 'decision' }" @click="setActiveQuadrant('decision')">
          <div class="quadrant-header">
            <span class="quadrant-tag">QUADRANT_02</span>
            <h3>{{ t('agentScenario.quadrants.decision.title') }}</h3>
          </div>
          <div class="quadrant-body">
            <div class="quadrant-description">
              <p>{{ t('agentScenario.quadrants.decision.fullDescription') }}</p>
            </div>
            <div class="quadrant-characteristics">
              <h4>{{ t('agentScenario.characteristics.title') }}</h4>
              <div class="char-grid">
                <div class="char-item">
                  <el-icon><Sparkles /></el-icon>
                  <span>{{ t('agentScenario.quadrants.decision.chars.openEnded') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><Brain /></el-icon>
                  <span>{{ t('agentScenario.quadrants.decision.chars.reasoning') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><FileText /></el-icon>
                  <span>{{ t('agentScenario.quadrants.decision.chars.output') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><TrendingUp /></el-icon>
                  <span>{{ t('agentScenario.quadrants.decision.chars.prediction') }}</span>
                </div>
              </div>
            </div>
            <div class="quadrant-examples">
              <h4>{{ t('agentScenario.examples.title') }}</h4>
              <div class="example-list">
                <div class="example-item">
                  <el-icon><BarChart3 /></el-icon>
                  <div>
                    <span class="example-name">{{ t('agentScenario.quadrants.decision.examples.analysis.name') }}</span>
                    <span class="example-desc">{{ t('agentScenario.quadrants.decision.examples.analysis.desc') }}</span>
                  </div>
                </div>
                <div class="example-item">
                  <el-icon><Lightbulb /></el-icon>
                  <div>
                    <span class="example-name">{{ t('agentScenario.quadrants.decision.examples.advisor.name') }}</span>
                    <span class="example-desc">{{ t('agentScenario.quadrants.decision.examples.advisor.desc') }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="quadrant-value">
              <h4>{{ t('agentScenario.value.title') }}</h4>
              <p>{{ t('agentScenario.quadrants.decision.value') }}</p>
            </div>
          </div>
        </div>

        <!-- Q3: 复杂执行智能体 -->
        <div class="quadrant-card" :class="{ active: activeQuadrant === 'execution' }" @click="setActiveQuadrant('execution')">
          <div class="quadrant-header">
            <span class="quadrant-tag">QUADRANT_03</span>
            <h3>{{ t('agentScenario.quadrants.execution.title') }}</h3>
          </div>
          <div class="quadrant-body">
            <div class="quadrant-description">
              <p>{{ t('agentScenario.quadrants.execution.fullDescription') }}</p>
            </div>
            <div class="quadrant-characteristics">
              <h4>{{ t('agentScenario.characteristics.title') }}</h4>
              <div class="char-grid">
                <div class="char-item">
                  <el-icon><Target /></el-icon>
                  <span>{{ t('agentScenario.quadrants.execution.chars.clearIntent') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><GitBranch /></el-icon>
                  <span>{{ t('agentScenario.quadrants.execution.chars.multiStep') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><Plug /></el-icon>
                  <span>{{ t('agentScenario.quadrants.execution.chars.multiAPI') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><Link /></el-icon>
                  <span>{{ t('agentScenario.quadrants.execution.chars.crossSystem') }}</span>
                </div>
              </div>
            </div>
            <div class="quadrant-examples">
              <h4>{{ t('agentScenario.examples.title') }}</h4>
              <div class="example-list">
                <div class="example-item">
                  <el-icon><Calendar /></el-icon>
                  <div>
                    <span class="example-name">{{ t('agentScenario.quadrants.execution.examples.meeting.name') }}</span>
                    <span class="example-desc">{{ t('agentScenario.quadrants.execution.examples.meeting.desc') }}</span>
                  </div>
                </div>
                <div class="example-item">
                  <el-icon><CheckCircle /></el-icon>
                  <div>
                    <span class="example-name">{{ t('agentScenario.quadrants.execution.examples.approval.name') }}</span>
                    <span class="example-desc">{{ t('agentScenario.quadrants.execution.examples.approval.desc') }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="quadrant-value">
              <h4>{{ t('agentScenario.value.title') }}</h4>
              <p>{{ t('agentScenario.quadrants.execution.value') }}</p>
            </div>
          </div>
        </div>

        <!-- Q4: 复杂决策兼复杂执行 -->
        <div class="quadrant-card featured" :class="{ active: activeQuadrant === 'complex' }" @click="setActiveQuadrant('complex')">
          <div class="quadrant-header">
            <span class="quadrant-tag">QUADRANT_04</span>
            <span class="featured-badge">{{ t('agentScenario.quadrants.complex.badge') }}</span>
            <h3>{{ t('agentScenario.quadrants.complex.title') }}</h3>
          </div>
          <div class="quadrant-body">
            <div class="quadrant-description">
              <p>{{ t('agentScenario.quadrants.complex.fullDescription') }}</p>
            </div>
            <div class="quadrant-characteristics">
              <h4>{{ t('agentScenario.characteristics.title') }}</h4>
              <div class="char-grid">
                <div class="char-item">
                  <el-icon><Compass /></el-icon>
                  <span>{{ t('agentScenario.quadrants.complex.chars.autonomousPlanning') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><Zap /></el-icon>
                  <span>{{ t('agentScenario.quadrants.complex.chars.autonomousExecution') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><RefreshCw /></el-icon>
                  <span>{{ t('agentScenario.quadrants.complex.chars.lifecycle') }}</span>
                </div>
                <div class="char-item">
                  <el-icon><Users /></el-icon>
                  <span>{{ t('agentScenario.quadrants.complex.chars.multiAgent') }}</span>
                </div>
              </div>
            </div>
            <div class="quadrant-examples">
              <h4>{{ t('agentScenario.examples.title') }}</h4>
              <div class="example-list">
                <div class="example-item">
                  <el-icon><Megaphone /></el-icon>
                  <div>
                    <span class="example-name">{{ t('agentScenario.quadrants.complex.examples.marketing.name') }}</span>
                    <span class="example-desc">{{ t('agentScenario.quadrants.complex.examples.marketing.desc') }}</span>
                  </div>
                </div>
                <div class="example-item">
                  <el-icon><Network /></el-icon>
                  <div>
                    <span class="example-name">{{ t('agentScenario.quadrants.complex.examples.multiAgent.name') }}</span>
                    <span class="example-desc">{{ t('agentScenario.quadrants.complex.examples.multiAgent.desc') }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="quadrant-value">
              <h4>{{ t('agentScenario.value.title') }}</h4>
              <p>{{ t('agentScenario.quadrants.complex.value') }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 落地建议 -->
      <section class="implementation-guide">
        <div class="section-label">IMPLEMENTATION GUIDE</div>
        <div class="guide-content">
          <h2>{{ t('agentScenario.guide.title') }}</h2>
          <p class="guide-intro">{{ t('agentScenario.guide.intro') }}</p>
          
          <div class="guide-steps">
            <div class="step-item">
              <span class="step-number">01</span>
              <h4>{{ t('agentScenario.guide.steps.identify.title') }}</h4>
              <p>{{ t('agentScenario.guide.steps.identify.desc') }}</p>
            </div>
            <div class="step-item">
              <span class="step-number">02</span>
              <h4>{{ t('agentScenario.guide.steps.evaluate.title') }}</h4>
              <p>{{ t('agentScenario.guide.steps.evaluate.desc') }}</p>
            </div>
            <div class="step-item">
              <span class="step-number">03</span>
              <h4>{{ t('agentScenario.guide.steps.pilot.title') }}</h4>
              <p>{{ t('agentScenario.guide.steps.pilot.desc') }}</p>
            </div>
            <div class="step-item">
              <span class="step-number">04</span>
              <h4>{{ t('agentScenario.guide.steps.scale.title') }}</h4>
              <p>{{ t('agentScenario.guide.steps.scale.desc') }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="scenario-cta">
        <div class="cta-content">
          <h2>{{ t('agentScenario.cta.title') }}</h2>
          <p>{{ t('agentScenario.cta.description') }}</p>
          <div class="cta-buttons">
            <el-button type="primary" size="large" @click="goToEnterprise">
              {{ t('agentScenario.cta.learnMore') }}
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-button size="large" @click="goToContact">
              {{ t('agentScenario.cta.contact') }}
            </el-button>
          </div>
        </div>
      </section>

      <!-- 底部 -->
      <footer class="scenario-footer">
        <div class="quick-nav">
          <button @click="goToRoute('/enterprise')">{{ t('agentScenario.footer.enterprise') }}</button>
          <button @click="goToRoute('/enterprise/human-machine-collaboration')">{{ t('agentScenario.footer.humanMachine') }}</button>
          <button @click="goToRoute('/about/about-us')">{{ t('agentScenario.footer.contact') }}</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AnimatedNumber from '@/components/common/AnimatedNumber.vue'
import { useCleanup } from '@/composables/useCleanup'
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Sparkles,
  Brain,
  FileText,
  TrendingUp,
  BarChart3,
  Lightbulb,
  Target,
  GitBranch,
  Plug,
  Link,
  Calendar,
  CheckCircle,
  Compass,
  Zap,
  RefreshCw,
  Users,
  Megaphone,
  Network,
  MessageSquare,
  Workflow,
} from '@/lib/lucide-fallback'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// ===== 响应式状态 =====
const isLoading = ref(true)
const navVisible = ref(false)
const heroVisible = ref(false)
const parallaxOffset = ref(0)
const scrollProgress = ref(0)
const activeQuadrant = ref<string | null>(null)
const pageRef = ref<HTMLElement | null>(null)

// 计算属性
const heroTitle = computed(() => t('agentScenario.heroTitle'))

// ===== 滚动处理 =====
const cleanup = useCleanup()
let scrollRafId: number | null = null
// 加载动画定时器
let loadAnimTimer: ReturnType<typeof setTimeout> | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    parallaxOffset.value = window.scrollY * 0.5
    // 计算滚动进度
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0
  })
}

// ===== 滚动入场指令 =====
// 用 WeakMap 存储每个元素对应的 observer，便于卸载时 disconnect
const observerMap = new WeakMap<HTMLElement, IntersectionObserver>()
const vScrollReveal = {
  mounted(el: HTMLElement) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('is-revealed')
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
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
  }
}

// ===== 生命周期 =====
onMounted(() => {
  // 模拟加载
  if (loadAnimTimer !== null) clearTimeout(loadAnimTimer)
  loadAnimTimer = setTimeout(() => {
    isLoading.value = false
    loadAnimTimer = setTimeout(() => {
      navVisible.value = true
      heroVisible.value = true
    }, 100)
  }, 600)

  cleanup.addEventListener(window, 'scroll', handleScroll, { passive: true })
  // 组件销毁时清理动画帧和加载定时器
  cleanup.add(() => {
    if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null }
  })
  cleanup.add(() => {
    if (loadAnimTimer !== null) { clearTimeout(loadAnimTimer); loadAnimTimer = null }
  })

  // 从URL参数获取默认展开的象限
  const type = route.query.type as string
  if (type && ['simple', 'decision', 'execution', 'complex'].includes(type)) {
    activeQuadrant.value = type
    loadAnimTimer = setTimeout(() => {
      const element = document.querySelector(`.quadrant-card.active`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 800)
  }
})

// ===== 方法 =====
const goBack = () => router.push('/enterprise').catch(() => {})
const goToRoute = (path: string) => router.push(path).catch(() => {})
const goToEnterprise = () => router.push('/enterprise').catch(() => {})
const goToContact = () => router.push('/about/about-us?source=agent-scenario').catch(() => {})

const setActiveQuadrant = (quadrant: string) => {
  activeQuadrant.value = activeQuadrant.value === quadrant ? null : quadrant
}
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

// 设计令牌
$accent-purple: var(--el-color-primary-light-3);
$transition-smooth: cubic-bezier(0.16, 1, 0.3, 1);

.agent-scenario-page {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

// 骨架屏
.page-skeleton {
  position: fixed;
  inset: 0;
  z-index: var(--z-header);
  background: var(--el-bg-color-page);
  padding: 40px 48px;
  
  .skeleton-nav {
    height: 20px;
    width: 200px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }
  
  .skeleton-hero {
    margin-top: 80px;
    
    .skeleton-label, .skeleton-title, .skeleton-desc {
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }
    
    .skeleton-label {
      height: 12px;
      width: 200px;
      margin-bottom: 24px;
    }
    
    .skeleton-title {
      height: 56px;
      width: 400px;
      margin-bottom: 24px;
      animation-delay: 0.1s;
    }
    
    .skeleton-desc {
      height: 48px;
      width: 500px;
      animation-delay: 0.2s;
    }
  }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.scenario-bg {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  
  .gradient-layer {
    position: absolute;
    top: 0;
    left: -20%;
    width: 60%;
    height: 60%;
    background: color-mix(in srgb, var(--el-color-primary) 2%, transparent);
    filter: blur(120px);
    transition: transform 0.1s linear;
  }
  
  .noise-texture {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    opacity: 0.03;
  }
  
  // 装饰性SVG
  .deco-svg {
    position: absolute;
    opacity: 0.5;
    
    &.deco-1 {
      width: 200px;
      height: 200px;
      right: 5%;
      top: 15%;
      animation: slow-rotate 60s linear infinite;
    }
    
    &.deco-2 {
      width: 150px;
      height: 150px;
      left: 10%;
      bottom: 20%;
      animation: slow-rotate 80s linear infinite reverse;
    }
  }
}

@keyframes slow-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.container {
  position: relative;
  z-index: var(--z-base);
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 48px;
  
  @include bp.tablet-down {
    padding: 0 24px;
  }
}

.scenario-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 0;
  opacity: 0;
  transform: translateY(-20px);
  transition: all 0.8s $transition-smooth;
  
  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
  
  .back-link {
    color: var(--el-text-color-secondary);
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 1px;
    transition: all 0.3s ease;
    
    &:hover {
      color: var(--el-text-color-primary);
      transform: translateX(-4px);
    }
  }
  
  .version-tag {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: $accent-purple;
    font-weight: 800;
    letter-spacing: 2px;
    border: var(--unified-border);
    padding: 4px 12px;
    background: rgba($accent-purple, 0.05);
    animation: tag-glow 3s ease-in-out infinite;
  }
}

@keyframes tag-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.9; }
}

// ===== 英雄区 - 极简科技风格 =====
.scenario-hero {
  padding: 80px 0 100px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transition-delay: 0.15s;
  
  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
  
  .hero-label {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    
    .label-text {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-text-color-secondary);
      font-weight: 600;
      letter-spacing: 2px;
    }
    
    .label-line {
      flex: 1;
      max-width: 80px;
      height: 1px;
      background: var(--el-border-color);
    }
  }
  
  h1 {
    font-size: clamp(28px, 5vw, 48px);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin-bottom: 16px;
    color: var(--el-text-color-primary);
    overflow: hidden;
    transform-style: preserve-3d;
    perspective: 1000px;
    
    .char {
      display: inline-block;
      opacity: 0;
      transform: translateY(100%) rotateX(-90deg);
      transform-origin: center top;
    }
  }
  
  // 只有在 hero 可见时才触发字符动画
  &.is-visible h1 .char {
    animation: char-flip-reveal 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    animation-delay: calc(var(--char-index) * 0.1s + 0.3s);
  }
  
  .hero-subtitle {
    font-size: 15px;
    color: var(--el-text-color-secondary);
    max-width: 550px;
    line-height: 1.7;
    margin-bottom: 36px;
  }
  
  .hero-stats {
    display: flex;
    align-items: center;
    gap: 32px;
    
    @include bp.mobile-only {
      flex-direction: column;
      align-items: flex-start;
      gap: 20px;
    }
    
    .stat-item {
      display: flex;
      flex-direction: column;
      
      .stat-value {
        font-family: var(--font-family-mono);
        font-size: 32px;
        font-weight: 900;
        color: var(--el-text-color-primary);
      }
      
      .stat-label {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        margin-top: 4px;
      }
    }
    
    .stat-divider {
      width: 1px;
      height: 36px;
      background: var(--el-border-color-lighter);
      
      @include bp.mobile-only {
        display: none;
      }
    }
  }
}

@keyframes char-flip-reveal {
  0% {
    opacity: 0;
    transform: translateY(100%) rotateX(-90deg);
  }

  100% {
    opacity: 1;
    transform: translateY(0) rotateX(0deg);
  }
}

// 滚动入场动画
[v-scroll-reveal] {
  opacity: 0;
  transform: translateY(40px);
  transition: all 0.8s $transition-smooth;
  
  &.is-revealed {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-label {
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--el-color-primary-light-3);
  font-weight: 800;
  letter-spacing: 4px;
  margin-bottom: 40px;
  display: flex;
  align-items: center;
  
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--el-border-color-extra-light);
    margin-left: 20px;
  }
}

.compass-overview {
  margin-bottom: 100px;
  
  .overview-content {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 48px;
    align-items: start;
    
    @include bp.tablet-down {
      grid-template-columns: 1fr;
    }
  }
  
  .overview-text {
    h2 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 20px;
      color: var(--el-text-color-primary);
    }
    
    p {
      font-size: 15px;
      color: var(--el-text-color-regular);
      line-height: 1.8;
      margin-bottom: 24px;
    }
    
    .overview-highlight {
      padding: 20px;
      background: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.05);
      border-left: 3px solid var(--border-unified-color);
      
      .highlight-label {
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 800;
        color: var(--el-color-primary-light-3);
        letter-spacing: 1px;
        display: block;
        margin-bottom: 8px;
      }
      
      p {
        font-size: 14px;
        margin: 0;
      }
    }
  }
  
  :where(.overview-diagram) {
    .diagram-box {
      aspect-ratio: 1;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      position: relative;
      background: var(--el-bg-color);
      
      .axis {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        color: var(--el-text-color-placeholder);
        
        .axis-name {
          font-weight: 700;
          color: var(--el-text-color-secondary);
        }
      }
      
      .axis-x {
        bottom: 20px;
        left: 20px;
        right: 20px;
      }
      
      .axis-y {
        top: 20px;
        bottom: 20px;
        left: 20px;
        flex-direction: column;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        transform: rotate(180deg);
      }
    }
  }
}

.quadrants-detail {
  margin-bottom: 100px;
  
  .quadrant-card {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    margin-bottom: 20px;
    overflow: hidden;
    transition: all 0.3s ease;
    cursor: pointer;
    
    &:hover {
      border-color: var(--el-border-color-lighter);
    }
    
    &.active {
      border-color: var(--border-unified-color-hover);
      
      .quadrant-body {
        max-height: 2000px;
        padding: 32px;
        opacity: 1;
      }
    }
    
    &.featured {
      border-color: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.3);
      background: color-mix(in srgb, var(--el-color-primary) 2%, transparent);
    }
  }
  
  .quadrant-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px 32px;
    
    .quadrant-tag {
      font-family: var(--font-family-mono);
      font-size: 12px;
      font-weight: 800;
      color: var(--el-color-primary-light-3);
      letter-spacing: 1px;
    }
    
    .featured-badge {
      font-size: 12px;
      font-weight: 700;
      color: var(--el-text-color-primary); /* 规则C: light-3 浅底用主题感知文字色 (原 var(--el-bg-color-page) 白字在浅蓝底对比度不足) */
      background: var(--el-color-primary-light-3);
      padding: 2px 8px;
      border-radius: var(--global-border-radius);
    }
    
    h3 {
      font-size: 18px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      margin: 0;
      flex: 1;
    }
  }
  
  .quadrant-body {
    max-height: 0;
    padding: 0 32px;
    opacity: 0;
    overflow: hidden;
    transition: all 0.4s ease;
  }
  
  .quadrant-description {
    margin-bottom: 32px;
    
    p {
      font-size: 15px;
      color: var(--el-text-color-regular);
      line-height: 1.8;
    }
  }
  
  .quadrant-characteristics {
    margin-bottom: 32px;
    
    h4 {
      font-size: 14px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      margin-bottom: 16px;
    }
    
    .char-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      
      @include bp.tablet-down {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    
    .char-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--el-fill-color-extra-light);
      border-radius: var(--global-border-radius);
      
      .el-icon {
        color: var(--el-color-primary-light-3);
        font-size: 16px;
      }
      
      span {
        font-size: 12px;
        color: var(--el-text-color-regular);
      }
    }
  }
  
  .quadrant-examples {
    margin-bottom: 32px;
    
    h4 {
      font-size: 14px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      margin-bottom: 16px;
    }
    
    .example-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .example-item {
      display: flex;
      gap: 16px;
      padding: 16px;
      background: var(--el-fill-color-extra-light);
      border-radius: var(--global-border-radius);
      
      .el-icon {
        color: var(--el-color-primary-light-3);
        font-size: 24px;
        flex-shrink: 0;
      }
      
      div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .example-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
      
      .example-desc {
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }
  }
  
  .quadrant-value {
    padding: 20px;
    background: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.05);
    border-radius: var(--global-border-radius);
    
    h4 {
      font-size: 12px;
      font-weight: 700;
      color: var(--el-color-primary-light-3);
      margin-bottom: 8px;
    }
    
    p {
      font-size: 14px;
      color: var(--el-text-color-regular);
      line-height: 1.6;
      margin: 0;
    }
  }
}

.implementation-guide {
  margin-bottom: 100px;
  
  .guide-content {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 48px;
    
    @include bp.mobile-only {
      padding: 32px 24px;
    }
    
    h2 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
    }
    
    .guide-intro {
      font-size: 15px;
      color: var(--el-text-color-regular);
      line-height: 1.8;
      margin-bottom: 40px;
      max-width: 600px;
    }
  }
  
  .guide-steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    
    @include bp.tablet-down {
      grid-template-columns: repeat(2, 1fr);
    }
    
    @include bp.mobile-only {
      grid-template-columns: 1fr;
    }
  }
  
  .step-item {
    .step-number {
      font-family: var(--font-family-mono);
      font-size: 32px;
      font-weight: 900;
      color: var(--el-border-color-lighter);
      display: block;
      margin-bottom: 16px;
    }
    
    h4 {
      font-size: 16px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      margin-bottom: 8px;
    }
    
    p {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
    }
  }
}

.scenario-cta {
  margin-bottom: 100px;
  
  .cta-content {
    text-align: center;
    padding: 60px;
    background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    
    @include bp.mobile-only {
      padding: 40px 24px;
    }
    
    h2 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
    }
    
    p {
      font-size: 15px;
      color: var(--el-text-color-regular);
      margin-bottom: 32px;
    }
    
    .cta-buttons {
      display: flex;
      justify-content: center;
      gap: 16px;
      
      @include bp.mobile-only {
        flex-direction: column;
      }
    }
  }
}

.scenario-footer {
  padding: 60px 0;
  border-top: var(--unified-border);
  
  .quick-nav {
    display: flex;
    justify-content: center;
    gap: 40px;
    
    @include bp.mobile-only {
      gap: 24px;
    }
    
    button {
      background: none;
      border: none;
      color: var(--el-text-color-placeholder);
      font-family: var(--font-family-mono);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1px;
      cursor: pointer;
      transition: color 0.3s;
      
      &:hover {
        color: var(--el-text-color-primary);
      }
    }
  }
}

// 暗色模式适配
html.dark {
  .scenario-bg {
    .gradient-layer {
      background: color-mix(in srgb, var(--el-color-primary) 4%, transparent);
    }
    
    .deco-svg {
      opacity: 0.3;
    }
  }
  
  .scroll-progress-bar {
    opacity: 0.9;
  }
  
  .scenario-nav .version-tag {
    background: rgba($accent-purple, 0.15);
    border-color: rgba($accent-purple, 0.4);
  }
  
  .quadrant-card {
    background: var(--color-white-2);
    
    &:hover {
      background: var(--color-white-4);
    }
    
    &.active {
      background: var(--color-white-3);
    }
    
    &.featured {
      background: var(--color-white-2);
    }
    
    .char-item {
      background: var(--color-white-4);
    }
    
    .example-item {
      background: var(--color-white-4);
    }
    
    .quadrant-value {
      background: rgba($accent-purple, 0.1);
    }
  }
  
  .overview-diagram .diagram-box {
    background: var(--color-white-2);
  }
  
  .guide-content {
    background: var(--color-white-2);
  }
  
  .scenario-cta .cta-content {
    background: var(--color-violet-8b5cf6-08);
  }
}
</style>
