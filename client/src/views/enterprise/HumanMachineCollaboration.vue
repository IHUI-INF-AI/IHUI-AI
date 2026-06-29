<template>
  <div class="human-machine-page" ref="pageRef">
    <!-- 滚动进度指示器 -->
    <div class="scroll-progress-bar" :style="{ width: scrollProgress + '%' }"></div>

    <!-- 动态背景层 -->
    <div class="hm-bg">
      <div class="gradient-layer" :style="{ transform: `translateY(${parallaxOffset * 0.3}px)` }"></div>
      <div class="noise-texture"></div>
      <!-- 装饰性元素 -->
      <div class="floating-orbs">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
      </div>
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
      <nav class="hm-nav" :class="{ 'is-visible': navVisible }">
        <el-button link @click="goBack" class="back-link">
          <el-icon><ArrowLeft /></el-icon> ENTERPRISE / BACK
        </el-button>
        <span class="version-tag">HUMAN-MACHINE</span>
      </nav>

      <!-- 英雄区 -->
      <header class="hm-hero" :class="{ 'is-visible': heroVisible }">
        <div class="hero-label">
          <span class="label-text">HUMAN-MACHINE COLLABORATION</span>
          <span class="label-line"></span>
        </div>
        <h1>
          <span v-for="(char, index) in heroTitle" :key="index" 
                class="char" 
                :style="{ '--char-index': index }">{{ char === ' ' ? '\u00A0' : char }}</span>
        </h1>
        <p class="hero-subtitle">{{ t('humanMachine.heroSubtitle') }}</p>
        <!-- 关键指标 -->
        <div class="hero-metrics">
          <div class="metric">
            <div class="metric-icon">
              <el-icon><TrendingDown /></el-icon>
            </div>
            <div class="metric-info">
              <span class="metric-value"><AnimatedNumber :value="40" :duration="1500" suffix="%" /></span>
              <span class="metric-label">{{ t('hardcoded.human.machine.collaboration.成本降低') }}</span>
            </div>
          </div>
          <div class="metric">
            <div class="metric-icon">
              <el-icon><TrendingUp /></el-icon>
            </div>
            <div class="metric-info">
              <span class="metric-value"><AnimatedNumber :value="300" :duration="2000" suffix="%" /></span>
              <span class="metric-label">{{ t('hardcoded.human.machine.collaboration.效率提升') }}</span>
            </div>
          </div>
          <div class="metric">
            <div class="metric-icon">
              <el-icon><Star /></el-icon>
            </div>
            <div class="metric-info">
              <span class="metric-value"><AnimatedNumber :value="95" :duration="1800" suffix="%" /></span>
              <span class="metric-label">{{ t('hardcoded.human.machine.collaboration.满意度') }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- 架构概述 -->
      <section class="architecture-overview" v-scroll-reveal>
        <div class="section-label">ARCHITECTURE OVERVIEW</div>
        <div class="overview-diagram">
          <div class="world-card physical-world" :class="{ 'is-hovered': hoveredWorld === 'physical' }" 
               @mouseenter="hoveredWorld = 'physical'" @mouseleave="hoveredWorld = null">
            <div class="world-glow"></div>
            <div class="world-icon">
              <el-icon :size="40"><Building /></el-icon>
            </div>
            <h3>{{ t('humanMachine.architecture.physicalWorld.title') }}</h3>
            <p>{{ t('humanMachine.architecture.physicalWorld.description') }}</p>
            <div class="world-badge">01</div>
          </div>
          <div class="connection-arrow">
            <div class="arrow-line"></div>
            <el-icon><ArrowLeftRight /></el-icon>
            <div class="arrow-pulse"></div>
          </div>
          <div class="world-card info-world" :class="{ 'is-hovered': hoveredWorld === 'info' }"
               @mouseenter="hoveredWorld = 'info'" @mouseleave="hoveredWorld = null">
            <div class="world-glow"></div>
            <div class="world-icon">
              <el-icon :size="40"><Database /></el-icon>
            </div>
            <h3>{{ t('humanMachine.architecture.infoWorld.title') }}</h3>
            <p>{{ t('humanMachine.architecture.infoWorld.description') }}</p>
            <div class="world-badge">02</div>
          </div>
          <div class="connection-arrow">
            <div class="arrow-line"></div>
            <el-icon><ArrowRight /></el-icon>
            <div class="arrow-pulse"></div>
          </div>
          <div class="world-card super-enterprise" :class="{ 'is-hovered': hoveredWorld === 'super' }"
               @mouseenter="hoveredWorld = 'super'" @mouseleave="hoveredWorld = null">
            <div class="world-glow"></div>
            <div class="world-icon">
              <el-icon :size="40"><Sparkles /></el-icon>
            </div>
            <h3>{{ t('humanMachine.architecture.superEnterprise.title') }}</h3>
            <p>{{ t('humanMachine.architecture.superEnterprise.description') }}</p>
            <div class="world-badge featured">03</div>
          </div>
        </div>
      </section>

      <!-- 物理世界 -->
      <section class="physical-world-detail" v-scroll-reveal>
        <div class="section-label">PHYSICAL WORLD</div>
        <div class="section-intro">
          <h2>{{ t('humanMachine.physicalWorld.title') }}</h2>
          <p>{{ t('humanMachine.physicalWorld.intro') }}</p>
        </div>
        
        <div class="physical-cards">
          <!-- 组织架构 -->
          <div class="physical-card">
            <div class="card-header">
              <span class="card-tag">STRUCTURE</span>
              <el-icon :size="28"><Building /></el-icon>
            </div>
            <h3>{{ t('humanMachine.physicalWorld.structure.title') }}</h3>
            <p>{{ t('humanMachine.physicalWorld.structure.description') }}</p>
            <div class="card-features">
              <div class="feature">
                <el-icon><Check /></el-icon>
                <span>{{ t('humanMachine.physicalWorld.structure.features.mapping') }}</span>
              </div>
              <div class="feature">
                <el-icon><Check /></el-icon>
                <span>{{ t('humanMachine.physicalWorld.structure.features.digital') }}</span>
              </div>
              <div class="feature">
                <el-icon><Check /></el-icon>
                <span>{{ t('humanMachine.physicalWorld.structure.features.hybrid') }}</span>
              </div>
            </div>
          </div>

          <!-- 流程梳理 -->
          <div class="physical-card">
            <div class="card-header">
              <span class="card-tag">PROCESS</span>
              <el-icon :size="28"><Workflow /></el-icon>
            </div>
            <h3>{{ t('humanMachine.physicalWorld.process.title') }}</h3>
            <p>{{ t('humanMachine.physicalWorld.process.description') }}</p>
            <div class="process-flows">
              <div class="flow-item">
                <span class="flow-label">{{ t('humanMachine.physicalWorld.process.forward.label') }}</span>
                <div class="flow-steps">
                  <span>{{ t('humanMachine.physicalWorld.process.forward.goal') }}</span>
                  <el-icon><ArrowRight /></el-icon>
                  <span>{{ t('humanMachine.physicalWorld.process.forward.process') }}</span>
                  <el-icon><ArrowRight /></el-icon>
                  <span>{{ t('humanMachine.physicalWorld.process.forward.role') }}</span>
                </div>
              </div>
              <div class="flow-item">
                <span class="flow-label">{{ t('humanMachine.physicalWorld.process.reverse.label') }}</span>
                <div class="flow-steps">
                  <span>{{ t('humanMachine.physicalWorld.process.reverse.role') }}</span>
                  <el-icon><ArrowRight /></el-icon>
                  <span>{{ t('humanMachine.physicalWorld.process.reverse.process') }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 人本价值 -->
          <div class="physical-card">
            <div class="card-header">
              <span class="card-tag">HUMAN VALUE</span>
              <el-icon :size="28"><Heart /></el-icon>
            </div>
            <h3>{{ t('humanMachine.physicalWorld.humanValue.title') }}</h3>
            <p>{{ t('humanMachine.physicalWorld.humanValue.description') }}</p>
            <div class="value-grid">
              <div class="value-item">
                <span class="value-name">{{ t('humanMachine.physicalWorld.humanValue.values.culture') }}</span>
              </div>
              <div class="value-item">
                <span class="value-name">{{ t('humanMachine.physicalWorld.humanValue.values.mission') }}</span>
              </div>
              <div class="value-item">
                <span class="value-name">{{ t('humanMachine.physicalWorld.humanValue.values.critical') }}</span>
              </div>
              <div class="value-item">
                <span class="value-name">{{ t('humanMachine.physicalWorld.humanValue.values.humility') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 信息世界 -->
      <section class="info-world-detail" v-scroll-reveal>
        <div class="section-label">INFORMATION WORLD</div>
        <div class="section-intro">
          <h2>{{ t('humanMachine.infoWorld.title') }}</h2>
          <p>{{ t('humanMachine.infoWorld.intro') }}</p>
        </div>
        
        <div class="info-levels">
          <!-- 初级信息世界 -->
          <div class="info-level-card">
            <div class="level-header">
              <span class="level-tag">LEVEL_01</span>
              <h3>{{ t('humanMachine.infoWorld.basic.title') }}</h3>
            </div>
            <p class="level-desc">{{ t('humanMachine.infoWorld.basic.description') }}</p>
            <div class="level-items">
              <div class="level-item">
                <el-icon><Database /></el-icon>
                <div>
                  <span class="item-name">{{ t('humanMachine.infoWorld.basic.items.informatization.name') }}</span>
                  <span class="item-desc">{{ t('humanMachine.infoWorld.basic.items.informatization.desc') }}</span>
                </div>
              </div>
              <div class="level-item">
                <el-icon><Wifi /></el-icon>
                <div>
                  <span class="item-name">{{ t('humanMachine.infoWorld.basic.items.iot.name') }}</span>
                  <span class="item-desc">{{ t('humanMachine.infoWorld.basic.items.iot.desc') }}</span>
                </div>
              </div>
              <div class="level-item">
                <el-icon><Cog /></el-icon>
                <div>
                  <span class="item-name">{{ t('humanMachine.infoWorld.basic.items.automation.name') }}</span>
                  <span class="item-desc">{{ t('humanMachine.infoWorld.basic.items.automation.desc') }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="level-connector">
            <el-icon><ArrowDown /></el-icon>
            <span>{{ t('humanMachine.infoWorld.evolution') }}</span>
          </div>

          <!-- 高级信息世界 -->
          <div class="info-level-card advanced">
            <div class="level-header">
              <span class="level-tag">LEVEL_02</span>
              <h3>{{ t('humanMachine.infoWorld.advanced.title') }}</h3>
            </div>
            <p class="level-desc">{{ t('humanMachine.infoWorld.advanced.description') }}</p>
            <div class="level-items ai-items">
              <div class="level-item">
                <div class="ai-icon perception">
                  <el-icon><Eye /></el-icon>
                </div>
                <div>
                  <span class="item-name">{{ t('humanMachine.infoWorld.advanced.items.perception.name') }}</span>
                  <span class="item-desc">{{ t('humanMachine.infoWorld.advanced.items.perception.desc') }}</span>
                </div>
              </div>
              <div class="level-item">
                <div class="ai-icon generative">
                  <el-icon><Wand2 /></el-icon>
                </div>
                <div>
                  <span class="item-name">{{ t('humanMachine.infoWorld.advanced.items.generative.name') }}</span>
                  <span class="item-desc">{{ t('humanMachine.infoWorld.advanced.items.generative.desc') }}</span>
                </div>
              </div>
              <div class="level-item">
                <div class="ai-icon agent">
                  <el-icon><Bot /></el-icon>
                </div>
                <div>
                  <span class="item-name">{{ t('humanMachine.infoWorld.advanced.items.agent.name') }}</span>
                  <span class="item-desc">{{ t('humanMachine.infoWorld.advanced.items.agent.desc') }}</span>
                </div>
              </div>
              <div class="level-item">
                <div class="ai-icon physical">
                  <el-icon><Cpu /></el-icon>
                </div>
                <div>
                  <span class="item-name">{{ t('humanMachine.infoWorld.advanced.items.physical.name') }}</span>
                  <span class="item-desc">{{ t('humanMachine.infoWorld.advanced.items.physical.desc') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 超级企业 -->
      <section class="super-enterprise-detail" v-scroll-reveal>
        <div class="section-label">SUPER ENTERPRISE</div>
        <div class="section-intro">
          <h2>{{ t('humanMachine.superEnterprise.title') }}</h2>
          <p>{{ t('humanMachine.superEnterprise.intro') }}</p>
        </div>
        
        <div class="super-cards">
          <!-- 超级员工 -->
          <div class="super-card">
            <div class="super-icon employee">
              <el-icon :size="36"><UserPlus /></el-icon>
            </div>
            <h3>{{ t('humanMachine.superEnterprise.superEmployee.title') }}</h3>
            <p>{{ t('humanMachine.superEnterprise.superEmployee.description') }}</p>
            <div class="super-features">
              <span>{{ t('humanMachine.superEnterprise.superEmployee.features.productivity') }}</span>
              <span>{{ t('humanMachine.superEnterprise.superEmployee.features.decision') }}</span>
              <span>{{ t('humanMachine.superEnterprise.superEmployee.features.creativity') }}</span>
            </div>
          </div>

          <!-- 超级团队 -->
          <div class="super-card">
            <div class="super-icon team">
              <el-icon :size="36"><UsersRound /></el-icon>
            </div>
            <h3>{{ t('humanMachine.superEnterprise.superTeam.title') }}</h3>
            <p>{{ t('humanMachine.superEnterprise.superTeam.description') }}</p>
            <div class="super-features">
              <span>{{ t('humanMachine.superEnterprise.superTeam.features.collaboration') }}</span>
              <span>{{ t('humanMachine.superEnterprise.superTeam.features.intelligence') }}</span>
              <span>{{ t('humanMachine.superEnterprise.superTeam.features.agility') }}</span>
            </div>
          </div>

          <!-- 超级产品 -->
          <div class="super-card">
            <div class="super-icon product">
              <el-icon :size="36"><Sparkles /></el-icon>
            </div>
            <h3>{{ t('humanMachine.superEnterprise.superProduct.title') }}</h3>
            <p>{{ t('humanMachine.superEnterprise.superProduct.description') }}</p>
            <div class="super-features">
              <span>{{ t('humanMachine.superEnterprise.superProduct.features.personalized') }}</span>
              <span>{{ t('humanMachine.superEnterprise.superProduct.features.intelligent') }}</span>
              <span>{{ t('humanMachine.superEnterprise.superProduct.features.iterative') }}</span>
            </div>
          </div>
        </div>

        <!-- 效果指标 -->
        <div class="effect-metrics">
          <h3>{{ t('humanMachine.superEnterprise.metrics.title') }}</h3>
          <div class="metrics-grid">
            <div class="metric-item">
              <div class="metric-icon">
                <el-icon><TrendingDown /></el-icon>
              </div>
              <span class="metric-name">{{ t('humanMachine.superEnterprise.metrics.cost') }}</span>
              <span class="metric-desc">{{ t('humanMachine.superEnterprise.metrics.costDesc') }}</span>
            </div>
            <div class="metric-item">
              <div class="metric-icon">
                <el-icon><TrendingUp /></el-icon>
              </div>
              <span class="metric-name">{{ t('humanMachine.superEnterprise.metrics.efficiency') }}</span>
              <span class="metric-desc">{{ t('humanMachine.superEnterprise.metrics.efficiencyDesc') }}</span>
            </div>
            <div class="metric-item">
              <div class="metric-icon">
                <el-icon><Star /></el-icon>
              </div>
              <span class="metric-name">{{ t('humanMachine.superEnterprise.metrics.experience') }}</span>
              <span class="metric-desc">{{ t('humanMachine.superEnterprise.metrics.experienceDesc') }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 实施路径 -->
      <section class="implementation-path">
        <div class="section-label">IMPLEMENTATION PATH</div>
        <div class="path-content">
          <h2>{{ t('humanMachine.implementation.title') }}</h2>
          <p class="path-intro">{{ t('humanMachine.implementation.intro') }}</p>
          
          <div class="path-timeline">
            <div class="path-step">
              <div class="step-marker">
                <span class="step-number">1</span>
              </div>
              <div class="step-content">
                <h4>{{ t('humanMachine.implementation.steps.assessment.title') }}</h4>
                <p>{{ t('humanMachine.implementation.steps.assessment.desc') }}</p>
              </div>
            </div>
            <div class="path-step">
              <div class="step-marker">
                <span class="step-number">2</span>
              </div>
              <div class="step-content">
                <h4>{{ t('humanMachine.implementation.steps.planning.title') }}</h4>
                <p>{{ t('humanMachine.implementation.steps.planning.desc') }}</p>
              </div>
            </div>
            <div class="path-step">
              <div class="step-marker">
                <span class="step-number">3</span>
              </div>
              <div class="step-content">
                <h4>{{ t('humanMachine.implementation.steps.pilot.title') }}</h4>
                <p>{{ t('humanMachine.implementation.steps.pilot.desc') }}</p>
              </div>
            </div>
            <div class="path-step">
              <div class="step-marker">
                <span class="step-number">4</span>
              </div>
              <div class="step-content">
                <h4>{{ t('humanMachine.implementation.steps.scale.title') }}</h4>
                <p>{{ t('humanMachine.implementation.steps.scale.desc') }}</p>
              </div>
            </div>
            <div class="path-step">
              <div class="step-marker">
                <span class="step-number">5</span>
              </div>
              <div class="step-content">
                <h4>{{ t('humanMachine.implementation.steps.optimize.title') }}</h4>
                <p>{{ t('humanMachine.implementation.steps.optimize.desc') }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="hm-cta">
        <div class="cta-content">
          <h2>{{ t('humanMachine.cta.title') }}</h2>
          <p>{{ t('humanMachine.cta.description') }}</p>
          <div class="cta-buttons">
            <el-button type="primary" size="large" @click="goToEnterprise">
              {{ t('humanMachine.cta.learnMore') }}
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-button size="large" @click="goToContact">
              {{ t('humanMachine.cta.contact') }}
            </el-button>
          </div>
        </div>
      </section>

      <!-- 底部 -->
      <footer class="hm-footer">
        <div class="quick-nav">
          <button @click="goToRoute('/enterprise')">{{ t('humanMachine.footer.enterprise') }}</button>
          <button @click="goToRoute('/enterprise/agent-scenario')">{{ t('humanMachine.footer.agentScenario') }}</button>
          <button @click="goToRoute('/about/about-us')">{{ t('humanMachine.footer.contact') }}</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AnimatedNumber from '@/components/common/AnimatedNumber.vue'
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  ArrowDown,
  Building,
  Database,
  Sparkles,
  Workflow,
  Heart,
  Check,
  Wifi,
  Cog,
  Eye,
  Wand2,
  Bot,
  Cpu,
  UserPlus,
  UsersRound,
  TrendingDown,
  TrendingUp,
  Star,
} from '@/lib/lucide-fallback'

const router = useRouter()
const { t } = useI18n()

// ===== 响应式状态 =====
const isLoading = ref(true)
const navVisible = ref(false)
const heroVisible = ref(false)
const parallaxOffset = ref(0)
const scrollProgress = ref(0)
const pageRef = ref<HTMLElement | null>(null)
const hoveredWorld = ref<string | null>(null)

// 计算属性
const heroTitle = computed(() => t('humanMachine.heroTitle'))

// ===== 滚动处理 =====
const cleanup = useCleanup()
let scrollRafId: number | null = null
// 加载动画定时器
let loadAnimTimer: ReturnType<typeof setTimeout> | null = null
cleanup.add(() => {
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
  }
  if (loadAnimTimer !== null) {
    clearTimeout(loadAnimTimer)
  }
})
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    parallaxOffset.value = window.scrollY * 0.5
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
  if (loadAnimTimer !== null) clearTimeout(loadAnimTimer)
  loadAnimTimer = setTimeout(() => {
    isLoading.value = false
    loadAnimTimer = setTimeout(() => {
      navVisible.value = true
      heroVisible.value = true
    }, 100)
  }, 600)

  cleanup.addEventListener(window, 'scroll', handleScroll as EventListener, { passive: true })
})

// ===== 方法 =====
const goBack = () => router.push('/enterprise')
const goToRoute = (path: string) => router.push(path)
const goToEnterprise = () => router.push('/enterprise')
const goToContact = () => router.push('/about/about-us?source=human-machine')
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

// 设计令牌
$accent-pink: var(--el-color-danger-light-3);
$accent-purple: var(--el-color-primary-light-3);
$transition-smooth: cubic-bezier(0.16, 1, 0.3, 1);

.human-machine-page {
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
      width: 250px;
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

.hm-bg {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  
  .gradient-layer {
    position: absolute;
    bottom: -20%;
    right: -10%;
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
  
  // 浮动光球
  .floating-orbs {
    position: absolute;
    inset: 0;
    overflow: hidden;
    
    .orb {
      position: absolute;
      border-radius: var(--global-border-radius);
      filter: blur(60px);
      animation: float-orb 20s ease-in-out infinite;
      
      &.orb-1 {
        width: 300px;
        height: 300px;
        background: rgba($accent-pink, 0.08);
        top: 10%;
        left: -5%;
        animation-delay: 0s;
      }
      
      &.orb-2 {
        width: 200px;
        height: 200px;
        background: rgba($accent-purple, 0.08);
        bottom: 30%;
        right: -3%;
        animation-delay: -7s;
      }
      
      &.orb-3 {
        width: 250px;
        height: 250px;
        background: rgb(var(--el-text-color-primary), 0.06);
        top: 50%;
        left: 30%;
        animation-delay: -14s;
      }
    }
  }
}

@keyframes float-orb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -30px) scale(1.1); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(20px, 10px) scale(1.05); }
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

.hm-nav {
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
    color: $accent-pink;
    font-weight: 800;
    letter-spacing: 2px;
    border: var(--unified-border);
    padding: 4px 12px;
    background: rgba($accent-pink, 0.05);
    animation: tag-glow 3s ease-in-out infinite;
  }
}

@keyframes tag-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.9; }
}

// ===== 英雄区 - 极简科技风格 =====
.hm-hero {
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
  
  .hero-metrics {
    display: flex;
    gap: 24px;
    
    @include bp.mobile-only {
      flex-direction: column;
      gap: 20px;
    }
    
    .metric {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .metric-icon {
        width: 48px;
        height: 48px;
        border-radius: var(--global-border-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba($accent-pink, 0.1);
        color: $accent-pink;
        
        .el-icon {
          font-size: 24px;
        }
      }
      
      .metric-info {
        display: flex;
        flex-direction: column;
        
        .metric-value {
          font-family: var(--font-family-mono);
          font-size: 24px;
          font-weight: 900;
          color: var(--el-text-color-primary);
        }
        
        .metric-label {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
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
  color: var(--el-color-danger-light-3);
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

.architecture-overview {
  margin-bottom: 100px;
  
  .overview-diagram {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    
    @include bp.tablet-down {
      flex-direction: column;
    }
  }
  
  .world-card {
    flex: 1;
    max-width: 280px;
    padding: 32px;
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    text-align: center;
    position: relative;
    transition: all 0.4s $transition-smooth;
    overflow: hidden;
    
    .world-glow {
      position: absolute;
      inset: -50%;
      background: transparent;
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
    }
    
    &.is-hovered {
      transform: translateY(-8px);
      border-color: rgba($accent-pink, 0.3);
      
      .world-glow {
        opacity: 1;
      }
    }
    
    .world-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      font-family: var(--font-family-mono);
      font-size: 12px;
      font-weight: 800;
      color: var(--el-text-color-placeholder);
      
      &.featured {
        color: $accent-pink;
      }
    }
    
    .world-icon {
      margin-bottom: 16px;
      color: var(--el-text-color-secondary);
      transition: all 0.3s ease;
    }
    
    &.physical-world {
      .world-icon { color: var(--el-color-primary); }
      .world-glow { background: color-mix(in srgb, var(--el-color-primary) 4%, transparent); }
      &.is-hovered { border-color: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.3); }
    }
    
    &.info-world {
      .world-icon { color: $accent-purple; }
      .world-glow { background: color-mix(in srgb, var(--el-color-primary) 4%, transparent); }
      &.is-hovered { border-color: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.3); }
    }
    
    &.super-enterprise {
      .world-icon { color: $accent-pink; }
      .world-glow { background: color-mix(in srgb, var(--el-color-primary) 4%, transparent); }
      &.is-hovered { border-color: rgb(var(--el-color-danger-rgb, 245, 108, 108), 0.3); }
    }
    
    h3 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
    }
    
    p {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      margin: 0;
    }
  }
  
  .connection-arrow {
    color: var(--el-text-color-placeholder);
    font-size: 24px;
    flex-shrink: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .arrow-line {
      position: absolute;
      width: 60px;
      height: 2px;
      background: var(--el-border-color-lighter);
      
      @include bp.tablet-down {
        width: 2px;
        height: 40px;
        background: var(--el-border-color-lighter);
      }
    }
    
    .arrow-pulse {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: var(--global-border-radius);
      background: $accent-pink;
      animation: arrow-pulse 2s ease-in-out infinite;
    }
    
    .el-icon {
      position: relative;
      z-index: var(--z-base);
      background: var(--el-bg-color-page);
      padding: 4px;
    }
    
    @include bp.tablet-down {
      transform: rotate(90deg);
    }
  }
}

@keyframes arrow-pulse {
  0%, 100% { opacity: 0; transform: translateX(-30px); }
  50% { opacity: 1; transform: translateX(0); }
}

.section-intro {
  margin-bottom: 48px;
  
  h2 {
    font-size: 28px;
    font-weight: 800;
    margin-bottom: 16px;
    color: var(--el-text-color-primary);
  }
  
  p {
    font-size: 15px;
    color: var(--el-text-color-regular);
    line-height: 1.8;
    max-width: 600px;
  }
}

.physical-world-detail {
  margin-bottom: 100px;
  
  .physical-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    
    @include bp.tablet-down {
      grid-template-columns: repeat(2, 1fr);
    }
    
    @include bp.mobile-only {
      grid-template-columns: 1fr;
    }
  }
  
  .physical-card {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 24px;
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      
      .card-tag {
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 800;
        color: var(--el-color-primary);
        letter-spacing: 1px;
      }
      
      .el-icon {
        color: var(--el-color-primary);
      }
    }
    
    h3 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
    }
    
    > p {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      margin-bottom: 20px;
    }
    
    .card-features {
      .feature {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        border-bottom: var(--unified-border-bottom);
        
        &:last-child {
          border-bottom: none;
        }
        
        .el-icon {
          color: var(--el-color-primary);
          font-size: 14px;
        }
        
        span {
          font-size: 13px;
          color: var(--el-text-color-regular);
        }
      }
    }
    
    .process-flows {
      .flow-item {
        padding: 12px 0;
        border-bottom: var(--unified-border-bottom);
        
        &:last-child {
          border-bottom: none;
        }
        
        .flow-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--el-text-color-placeholder);
          display: block;
          margin-bottom: 8px;
        }
        
        .flow-steps {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          
          span {
            font-size: 12px;
            color: var(--el-text-color-regular);
            padding: 4px 8px;
            background: var(--el-fill-color-extra-light);
            border-radius: var(--global-border-radius);
          }
          
          .el-icon {
            color: var(--el-text-color-placeholder);
            font-size: 12px;
          }
        }
      }
    }
    
    .value-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      
      .value-item {
        padding: 12px;
        background: var(--el-fill-color-extra-light);
        border-radius: var(--global-border-radius);
        text-align: center;
        
        .value-name {
          font-size: 12px;
          color: var(--el-text-color-regular);
        }
      }
    }
  }
}

.info-world-detail {
  margin-bottom: 100px;
  
  .info-levels {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .info-level-card {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 32px;
    
    &.advanced {
      border-color: var(--color-violet-8b5cf6-30);
      background: color-mix(in srgb, var(--el-color-primary) 2%, transparent);
    }
    
    .level-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      
      .level-tag {
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 800;
        color: var(--el-color-primary-light-3);
        letter-spacing: 1px;
      }
      
      h3 {
        font-size: 20px;
        font-weight: 700;
        color: var(--el-text-color-primary);
        margin: 0;
      }
    }
    
    .level-desc {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      margin-bottom: 24px;
    }
    
    .level-items {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      
      @include bp.tablet-down {
        grid-template-columns: 1fr;
      }
      
      &.ai-items {
        grid-template-columns: repeat(4, 1fr);
        
        @include bp.tablet-down {
          grid-template-columns: repeat(2, 1fr);
        }
        
        @include bp.mobile-only {
          grid-template-columns: 1fr;
        }
      }
    }
    
    .level-item {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: var(--el-fill-color-extra-light);
      border-radius: var(--global-border-radius);
      
      > .el-icon {
        color: var(--el-text-color-secondary);
        font-size: 24px;
        flex-shrink: 0;
      }
      
      .ai-icon {
        width: 40px;
        height: 40px;
        border-radius: var(--global-border-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        
        .el-icon {
          font-size: 20px;
          color: var(--el-bg-color-page);
        }
        
        &.perception {
          background: var(--el-text-color-primary);
        }
        
        &.generative {
          background: var(--el-text-color-primary);
        }
        
        &.agent {
          background: var(--el-text-color-primary);
        }
        
        &.physical {
          background: var(--color-amber-500);
        }
      }
      
      div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .item-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
      
      .item-desc {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
  
  .level-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-placeholder);
    
    .el-icon {
      font-size: 24px;
    }
    
    span {
      font-size: 12px;
    }
  }
}

.super-enterprise-detail {
  margin-bottom: 100px;
  
  .super-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-bottom: 48px;
    
    @include bp.tablet-down {
      grid-template-columns: repeat(2, 1fr);
    }
    
    @include bp.mobile-only {
      grid-template-columns: 1fr;
    }
  }
  
  .super-card {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 32px;
    text-align: center;
    
    .super-icon {
      width: 80px;
      height: 80px;
      border-radius: var(--global-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      
      &.employee {
        background: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.1);
        color: var(--el-color-primary);
      }
      
      &.team {
        background: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.1);
        color: var(--el-color-primary-light-3);
      }
      
      &.product {
        background: rgb(var(--el-color-danger-rgb, 245, 108, 108), 0.1);
        color: var(--el-color-danger-light-3);
      }
    }
    
    h3 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
    }
    
    p {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      margin-bottom: 20px;
    }
    
    .super-features {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      
      span {
        font-size: 12px;
        color: var(--el-text-color-regular);
        padding: 6px 12px;
        background: var(--el-fill-color-extra-light);
        border-radius: var(--global-border-radius);
      }
    }
  }
  
  .effect-metrics {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 32px;
    
    h3 {
      font-size: 16px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      margin-bottom: 24px;
      text-align: center;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      
      @include bp.mobile-only {
        grid-template-columns: 1fr;
      }
    }
    
    .metric-item {
      text-align: center;
      
      .metric-icon {
        width: 48px;
        height: 48px;
        border-radius: var(--global-border-radius);
        background: var(--el-fill-color-extra-light);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 12px;
        
        .el-icon {
          font-size: 24px;
          color: var(--el-color-danger-light-3);
        }
      }
      
      .metric-name {
        display: block;
        font-size: 16px;
        font-weight: 700;
        color: var(--el-text-color-primary);
        margin-bottom: 4px;
      }
      
      .metric-desc {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}

.implementation-path {
  margin-bottom: 100px;
  
  .path-content {
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
    
    .path-intro {
      font-size: 15px;
      color: var(--el-text-color-regular);
      line-height: 1.8;
      margin-bottom: 40px;
      max-width: 600px;
    }
  }
  
  .path-timeline {
    position: relative;
    padding-left: 48px;
    
    &::before {
      content: '';
      position: absolute;
      left: 19px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--el-border-color-extra-light);
    }
  }
  
  .path-step {
    position: relative;
    padding-bottom: 32px;
    
    &:last-child {
      padding-bottom: 0;
    }
    
    .step-marker {
      position: absolute;
      left: -48px;
      top: 0;
      width: 40px;
      height: 40px;
      border-radius: var(--global-border-radius);
      background: var(--el-bg-color);
      border: 2px solid var(--border-unified-color);
      display: flex;
      align-items: center;
      justify-content: center;
      
      .step-number {
        font-family: var(--font-family-mono);
        font-size: 14px;
        font-weight: 800;
        color: var(--el-color-danger-light-3);
      }
    }
    
    .step-content {
      h4 {
        font-size: 16px;
        font-weight: 700;
        color: var(--el-text-color-primary);
        margin-bottom: 8px;
      }
      
      p {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        line-height: 1.6;
        margin: 0;
      }
    }
  }
}

.hm-cta {
  margin-bottom: 100px;
  
  .cta-content {
    text-align: center;
    padding: 60px;
    background: rgb(var(--el-color-primary-rgb, 64, 158, 255), 0.05);
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

.hm-footer {
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
  .hm-bg {
    .gradient-layer {
      background: color-mix(in srgb, var(--el-color-primary) 4%, transparent);
    }
    
    .floating-orbs .orb {
      opacity: 0.3;
    }
  }
  
  .scroll-progress-bar {
    opacity: 0.9;
  }
  
  .hm-nav .version-tag {
    background: rgba($accent-pink, 0.15);
    border-color: rgba($accent-pink, 0.4);
  }
  
  :where(.hero-metrics) :where(.metric) .metric-icon {
    background: rgba($accent-pink, 0.15);
  }
  
  .world-card {
    background: var(--color-white-2);
    
    &.is-hovered {
      background: var(--color-white-4);
    }
    
    .world-glow {
      opacity: 0.8;
    }
  }
  
  .physical-card, .info-level-card, .super-card {
    background: var(--color-white-2);
    
    &.advanced {
      background: rgba($accent-purple, 0.04);
    }
  }
  
  .level-item {
    background: var(--color-white-4);
  }
  
  .effect-metrics {
    background: var(--color-white-2);
    
    .metric-icon {
      background: var(--color-white-5);
    }
  }
  
  .path-content {
    background: var(--color-white-2);
    
    .step-marker {
      background: var(--color-black-30);
    }
  }
  
  .hm-cta .cta-content {
    background: rgba($accent-pink, 0.1);
  }
}
</style>
