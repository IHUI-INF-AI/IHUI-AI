<template>
  <div class="enterprise-service-page" ref="pageRef" role="main">
    <!-- 跳过导航链接 - 无障碍 -->
    <a href="#main-content" class="skip-link">{{ t('enterpriseService.skipToMain') }}</a>

    <!-- 滚动进度指示器 -->
    <div
      class="scroll-progress-bar"
      :style="{ width: scrollProgress + '%' }"
      role="progressbar"
      :aria-valuenow="Math.round(scrollProgress)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="t('enterpriseService.scrollProgress')"
    ></div>

    <!-- 侧边锚点导航 -->
    <nav
      class="side-nav"
      :class="{ 'is-visible': showSideNav }"
      :aria-label="t('enterpriseService.sectionNavigation')"
    >
      <div class="side-nav-content">
        <button
          v-for="section in pageSections"
          :key="section.id"
          class="side-nav-item"
          :class="{ 'is-active': activeSection === section.id }"
          @click="scrollToSectionSmooth(section.id)"
          @keydown.enter="scrollToSectionSmooth(section.id)"
          :aria-current="activeSection === section.id ? 'true' : undefined"
          :aria-label="t('enterpriseService.jumpToSection')"
        >
          <span class="side-nav-dot" aria-hidden="true"></span>
          <span class="side-nav-label">{{ section.label }}</span>
        </button>
      </div>
    </nav>

    <!-- 动态背景层 -->
    <div class="enterprise-bg">
      <div class="gradient-layer" :style="{ transform: `translateY(${parallaxOffset * 0.3}px)` }"></div>
      <div class="noise-texture"></div>
      <!-- 浮动粒子效果 -->
      <div class="floating-particles">
        <div v-for="i in 6" :key="i" class="particle" :style="getParticleStyle(i)"></div>
      </div>
      <!-- SVG动态装饰 -->
      <div class="svg-decorations">
        <!-- 旋转圆环 -->
        <svg class="deco-ring ring-1" viewBox="0 0 200 200" :style="{ transform: `rotate(${scrollProgress * 0.5}deg)` }">
          <circle cx="100" cy="100" r="90" fill="none" stroke="url(#gradient1)" stroke-width="0.5" stroke-dasharray="10 5"/>
          <circle cx="100" cy="100" r="70" fill="none" stroke="url(#gradient1)" stroke-width="0.3" stroke-dasharray="4 8"/>
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="color-mix(in srgb, var(--el-color-primary) 30%, transparent)"/>
              <stop offset="100%" stop-color="color-mix(in srgb, var(--el-color-primary) 30%, transparent)"/>
            </linearGradient>
          </defs>
        </svg>
        <!-- 几何多边形 -->
        <svg class="deco-polygon poly-1" viewBox="0 0 100 100">
          <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                   fill="none" stroke="color-mix(in srgb, var(--el-color-primary) 15%, transparent)" stroke-width="0.5"/>
        </svg>
        <!-- 网格点阵 -->
        <svg class="deco-dots dots-1" viewBox="0 0 100 100">
          <g fill="color-mix(in srgb, var(--el-color-primary) 20%, transparent)">
            <circle cx="10" cy="10" r="1.5"/>
            <circle cx="30" cy="10" r="1.5"/>
            <circle cx="50" cy="10" r="1.5"/>
            <circle cx="70" cy="10" r="1.5"/>
            <circle cx="90" cy="10" r="1.5"/>
            <circle cx="10" cy="30" r="1.5"/>
            <circle cx="30" cy="30" r="1.5"/>
            <circle cx="50" cy="30" r="1.5"/>
            <circle cx="70" cy="30" r="1.5"/>
            <circle cx="90" cy="30" r="1.5"/>
            <circle cx="10" cy="50" r="1.5"/>
            <circle cx="30" cy="50" r="1.5"/>
            <circle cx="50" cy="50" r="1.5"/>
            <circle cx="70" cy="50" r="1.5"/>
            <circle cx="90" cy="50" r="1.5"/>
          </g>
        </svg>
        <!-- 连接线 -->
        <svg class="deco-lines lines-1" viewBox="0 0 200 200">
          <line x1="0" y1="100" x2="200" y2="100" stroke="color-mix(in srgb, var(--el-color-primary) 10%, transparent)" stroke-width="0.5" stroke-dasharray="8 4"/>
          <line x1="100" y1="0" x2="100" y2="200" stroke="color-mix(in srgb, var(--el-color-primary) 10%, transparent)" stroke-width="0.5" stroke-dasharray="8 4"/>
          <line x1="0" y1="0" x2="200" y2="200" stroke="color-mix(in srgb, var(--el-color-primary) 8%, transparent)" stroke-width="0.5" stroke-dasharray="4 8"/>
        </svg>
      </div>
    </div>

    <!-- 页面加载骨架屏 -->
    <div v-if="isLoading" class="page-skeleton">
      <div class="skeleton-nav"></div>
      <div class="skeleton-hero">
        <div class="skeleton-label"></div>
        <div class="skeleton-title"></div>
        <div class="skeleton-desc"></div>
        <div class="skeleton-stats">
          <div class="skeleton-stat"></div>
          <div class="skeleton-stat"></div>
          <div class="skeleton-stat"></div>
        </div>
      </div>
    </div>

    <div class="container" v-show="!isLoading">
      <!-- 极简导航 -->
      <nav class="enterprise-nav" :class="{ 'is-visible': navVisible }">
        <el-button link @click="goHome" class="back-link">
          <el-icon><ArrowLeft /></el-icon> {{ t('enterpriseService.exit') }}
        </el-button>
        <span class="version-tag">{{ t('enterpriseService.badge') }}</span>
      </nav>

      <!-- 品牌英雄区 -->
      <header id="hero" class="enterprise-hero" ref="heroRef" :class="{ 'is-visible': heroVisible }">
        <div class="hero-label">
          <span class="label-text">{{ t('enterpriseService.communityLabel') }}</span>
          <span class="label-line"></span>
        </div>
        <h1 class="typewriter-title">{{ t('enterpriseService.heroTitle') }}<span class="typing-text gradient-text">{{ currentTypingText }}</span><span class="typing-cursor">|</span>
        </h1>
        <p class="mission-statement">{{ t('enterpriseService.heroSubtitle') }}</p>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-value" ref="statPrice">
              <AnimatedNumber :value="18000" :duration="2000" :delay="500" prefix="¥" />
            </span>
            <span class="stat-label">{{ t('enterpriseService.stats.priceLabel') }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item highlight">
            <span class="stat-value">
              <AnimatedNumber :value="6000" :duration="2000" :delay="700" prefix="¥" />
            </span>
            <span class="stat-label">{{ t('enterpriseService.stats.earlyBirdLabel') }}</span>
            <span class="stat-badge">-67%</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value">
              <AnimatedNumber :value="18" :duration="1500" :delay="900" />
            </span>
            <span class="stat-label">{{ t('enterpriseService.stats.seatsLabel') }}</span>
          </div>
        </div>
        <!-- 快速行动按钮 -->
        <div class="hero-actions">
          <el-button type="primary" size="large" class="cta-primary" @click="handleJoinClick">
            <span class="btn-text">{{ t('enterpriseService.join.cta') }}</span>
            <el-icon class="btn-icon"><ArrowRight /></el-icon>
          </el-button>
          <el-button size="large" class="cta-secondary" @click="goToAgentScenarioDetail">
            {{ t('enterpriseService.compass.cta') }}
          </el-button>
        </div>
      </header>

      <!-- 核心定位 -->
      <section id="positioning" class="core-positioning" v-scroll-reveal>
        <div class="section-label">{{ t('enterpriseService.sections.positioning') }}</div>
        <div class="positioning-card card-glass">
          <div class="positioning-icon">
            <div class="icon-glow"></div>
            <el-icon :size="48"><Target /></el-icon>
          </div>
          <div class="positioning-content">
            <h2>{{ t('enterpriseService.positioning.title') }}</h2>
            <p class="positioning-desc">{{ t('enterpriseService.positioning.description') }}</p>
            <div class="positioning-tags">
              <span class="tag" v-for="(tag, i) in positioningTags" :key="tag"
                    :style="{ animationDelay: `${Number(i) * 0.1}s` }">{{ tag }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 三大服务模块 -->
      <section id="modules" class="service-modules" v-scroll-reveal>
        <div class="section-label">{{ t('enterpriseService.sections.serviceModules') }}</div>
        <div class="modules-grid">
          <!-- 在地社群 -->
          <div class="module-card"
               :class="{ 'is-hovered': hoveredModule === 'local' }"
               @mouseenter="hoveredModule = 'local'"
               @mouseleave="hoveredModule = null"
               @click="scrollToSection('local-community')">
            <div class="module-glow"></div>
            <div class="module-header">
              <div class="module-icon">
                <el-icon :size="32"><Users /></el-icon>
              </div>
              <span class="module-tag">{{ t('enterpriseService.modules.module01') }}</span>
            </div>
            <h3>{{ t('enterpriseService.modules.localCommunity.title') }}</h3>
            <p>{{ t('enterpriseService.modules.localCommunity.description') }}</p>
            <div class="module-features">
              <span v-for="feature in ['courses', 'exploration', 'mutualAid']" :key="feature">
                {{ t(`enterpriseService.modules.localCommunity.features.${feature}`) }}
              </span>
            </div>
            <div class="module-footer">
              <span class="learn-more">{{ t('enterpriseService.learnMore') }}</span>
              <el-icon class="module-arrow"><ArrowRight /></el-icon>
            </div>
          </div>

          <!-- 线上社群 -->
          <div class="module-card"
               :class="{ 'is-hovered': hoveredModule === 'online' }"
               @mouseenter="hoveredModule = 'online'"
               @mouseleave="hoveredModule = null"
               @click="scrollToSection('online-community')">
            <div class="module-glow"></div>
            <div class="module-header">
              <div class="module-icon">
                <el-icon :size="32"><Globe /></el-icon>
              </div>
              <span class="module-tag">{{ t('enterpriseService.modules.module02') }}</span>
            </div>
            <h3>{{ t('enterpriseService.modules.onlineCommunity.title') }}</h3>
            <p>{{ t('enterpriseService.modules.onlineCommunity.description') }}</p>
            <div class="module-features">
              <span v-for="feature in ['platform', 'exchange', 'resources']" :key="feature">
                {{ t(`enterpriseService.modules.onlineCommunity.features.${feature}`) }}
              </span>
            </div>
            <div class="module-footer">
              <span class="learn-more">{{ t('enterpriseService.learnMore') }}</span>
              <el-icon class="module-arrow"><ArrowRight /></el-icon>
            </div>
          </div>

          <!-- AI专业服务 -->
          <div class="module-card featured"
               :class="{ 'is-hovered': hoveredModule === 'ai' }"
               @mouseenter="hoveredModule = 'ai'"
               @mouseleave="hoveredModule = null"
               @click="scrollToSection('ai-service')">
            <div class="module-glow"></div>
            <div class="featured-badge">{{ t('enterpriseService.coreService') }}</div>
            <div class="module-header">
              <div class="module-icon">
                <el-icon :size="32"><Bot /></el-icon>
              </div>
              <span class="module-tag">{{ t('enterpriseService.modules.module03') }}</span>
            </div>
            <h3>{{ t('enterpriseService.modules.aiService.title') }}</h3>
            <p>{{ t('enterpriseService.modules.aiService.description') }}</p>
            <div class="module-features">
              <span v-for="feature in ['model', 'agent', 'consulting']" :key="feature">
                {{ t(`enterpriseService.modules.aiService.features.${feature}`) }}
              </span>
            </div>
            <div class="module-footer">
              <span class="learn-more">{{ t('enterpriseService.learnMore') }}</span>
              <el-icon class="module-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </section>

      <!-- 企业AI化服务架构 -->
      <section class="ai-architecture" id="ai-architecture">
        <div class="section-label">{{ t('enterpriseService.sections.architecture') }}</div>
        <div class="architecture-intro">
          <h2>{{ t('enterpriseService.architecture.title') }}</h2>
          <p>{{ t('enterpriseService.architecture.description') }}</p>
        </div>

        <div class="architecture-layers">
          <!-- 物理世界 -->
          <div class="layer-card physical-world">
            <div class="layer-header">
              <span class="layer-tag">{{ t('enterpriseService.layers.layer01') }}</span>
              <h3>{{ t('enterpriseService.architecture.physicalWorld.title') }}</h3>
            </div>
            <div class="layer-content">
              <div class="layer-item">
                <div class="item-icon">
                  <el-icon><Building /></el-icon>
                </div>
                <div>
                  <h4>{{ t('enterpriseService.architecture.physicalWorld.structure.title') }}</h4>
                  <p>{{ t('enterpriseService.architecture.physicalWorld.structure.description') }}</p>
                </div>
              </div>
              <div class="layer-item">
                <div class="item-icon">
                  <el-icon><Workflow /></el-icon>
                </div>
                <div>
                  <h4>{{ t('enterpriseService.architecture.physicalWorld.process.title') }}</h4>
                  <p>{{ t('enterpriseService.architecture.physicalWorld.process.description') }}</p>
                </div>
              </div>
              <div class="layer-item">
                <div class="item-icon">
                  <el-icon><UserCheck /></el-icon>
                </div>
                <div>
                  <h4>{{ t('enterpriseService.architecture.physicalWorld.culture.title') }}</h4>
                  <p>{{ t('enterpriseService.architecture.physicalWorld.culture.description') }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 信息世界 -->
          <div class="layer-card info-world">
            <div class="layer-header">
              <span class="layer-tag">{{ t('enterpriseService.layers.layer02') }}</span>
              <h3>{{ t('enterpriseService.architecture.infoWorld.title') }}</h3>
            </div>
            <div class="layer-content">
              <div class="info-levels">
                <div class="info-level basic">
                  <span class="level-label">{{ t('enterpriseService.architecture.infoWorld.basic.label') }}</span>
                  <div class="level-items">
                    <span>{{ t('enterpriseService.architecture.infoWorld.basic.items.informatization') }}</span>
                    <span>{{ t('enterpriseService.architecture.infoWorld.basic.items.iot') }}</span>
                    <span>{{ t('enterpriseService.architecture.infoWorld.basic.items.automation') }}</span>
                  </div>
                </div>
                <div class="level-arrow">
                  <el-icon><ArrowRight /></el-icon>
                </div>
                <div class="info-level advanced">
                  <span class="level-label">{{ t('enterpriseService.architecture.infoWorld.advanced.label') }}</span>
                  <div class="level-items">
                    <span>{{ t('enterpriseService.architecture.infoWorld.advanced.items.perception') }}</span>
                    <span>{{ t('enterpriseService.architecture.infoWorld.advanced.items.generative') }}</span>
                    <span>{{ t('enterpriseService.architecture.infoWorld.advanced.items.agent') }}</span>
                    <span>{{ t('enterpriseService.architecture.infoWorld.advanced.items.physical') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- AI化效果 -->
          <div class="layer-card ai-effect">
            <div class="layer-header">
              <span class="layer-tag">{{ t('enterpriseService.layers.layer03') }}</span>
              <h3>{{ t('enterpriseService.architecture.aiEffect.title') }}</h3>
            </div>
            <div class="layer-content">
              <div class="effect-flow">
                <div class="effect-item">
                  <div class="effect-icon super-employee">
                    <el-icon><UserPlus /></el-icon>
                  </div>
                  <span>{{ t('enterpriseService.architecture.aiEffect.superEmployee') }}</span>
                </div>
                <el-icon class="flow-arrow"><ArrowRight /></el-icon>
                <div class="effect-item">
                  <div class="effect-icon super-team">
                    <el-icon><UsersRound /></el-icon>
                  </div>
                  <span>{{ t('enterpriseService.architecture.aiEffect.superTeam') }}</span>
                </div>
                <el-icon class="flow-arrow"><ArrowRight /></el-icon>
                <div class="effect-item">
                  <div class="effect-icon super-product">
                    <el-icon><Sparkles /></el-icon>
                  </div>
                  <span>{{ t('enterpriseService.architecture.aiEffect.superProduct') }}</span>
                </div>
              </div>
              <div class="effect-metrics">
                <div class="metric">
                  <span class="metric-label">{{ t('enterpriseService.architecture.aiEffect.metrics.cost') }}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">{{ t('enterpriseService.architecture.aiEffect.metrics.efficiency') }}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">{{ t('enterpriseService.architecture.aiEffect.metrics.experience') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 智能体场景罗盘 - 交互式可视化 -->
      <section id="compass" class="agent-compass" v-scroll-reveal>
        <div class="section-label">{{ t('enterpriseService.sections.agentCompass') }}</div>
        <div class="compass-intro">
          <h2>{{ t('enterpriseService.compass.title') }}</h2>
          <p>{{ t('enterpriseService.compass.description') }}</p>
        </div>

        <div class="compass-visual" ref="compassRef">
          <!-- 中心罗盘图 -->
          <div class="compass-center">
            <div class="compass-ring ring-outer" :style="{ transform: `rotate(${compassRotation}deg)` }"></div>
            <div class="compass-ring ring-middle"></div>
            <div class="compass-ring ring-inner">
              <div class="compass-core">
                <el-icon :size="32"><Compass /></el-icon>
                <span>AI</span>
              </div>
            </div>
          </div>

          <!-- 坐标轴标签 -->
          <div class="compass-axis-labels">
            <span class="axis-label axis-top">{{ t('enterpriseService.compass.axes.autonomy.high') }}</span>
            <span class="axis-label axis-bottom">{{ t('enterpriseService.compass.axes.autonomy.low') }}</span>
            <span class="axis-label axis-left">{{ t('enterpriseService.compass.axes.complexity.low') }}</span>
            <span class="axis-label axis-right">{{ t('enterpriseService.compass.axes.complexity.high') }}</span>
          </div>

          <!-- 四象限卡片 -->
          <div class="compass-quadrants-grid">
            <div v-for="quadrant in quadrantData"
                 :key="quadrant.id"
                 class="quadrant-card"
                 :class="[`quadrant-${quadrant.id}`, { 'is-active': activeQuadrant === quadrant.id }]"
                 @mouseenter="activeQuadrant = quadrant.id"
                 @mouseleave="activeQuadrant = null"
                 @click="goToAgentScenario(quadrant.type)">
              <div class="quadrant-indicator">
                <span class="indicator-dot"></span>
                <span class="indicator-line"></span>
              </div>
              <div class="quadrant-header">
                <span class="quadrant-tag">{{ quadrant.tag }}</span>
                <el-icon class="quadrant-icon" :size="24">
                  <component :is="quadrant.icon" />
                </el-icon>
              </div>
              <h4>{{ t(quadrant.titleKey) }}</h4>
              <p>{{ t(quadrant.descKey) }}</p>
              <div class="quadrant-examples">
                <span v-for="example in quadrant.examples" :key="example">
                  {{ t(example) }}
                </span>
              </div>
              <div class="quadrant-progress">
                <div class="progress-bar" :style="{ width: quadrant.adoption + '%' }"></div>
                <span class="progress-label">{{ quadrant.adoption }}% {{ t('enterpriseService.adoptionRate') }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="compass-cta">
          <el-button type="primary" size="large" class="cta-compass" @click="goToAgentScenarioDetail">
            <span>{{ t('enterpriseService.compass.cta') }}</span>
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </section>

      <!-- 课程体系 - 交互式时间轴 -->
      <section id="courses" class="course-system" v-scroll-reveal>
        <div class="section-label">{{ t('enterpriseService.sections.courseSystem') }}</div>
        <div class="course-intro">
          <h2>{{ t('enterpriseService.courses.title') }}</h2>
          <p>{{ t('enterpriseService.courses.description') }}</p>
        </div>

        <!-- 课程阶段选择器 -->
        <div class="course-phase-selector">
          <button
            v-for="(phase, index) in coursePhases"
            :key="phase.id"
            class="phase-btn"
            :class="{ active: activePhase === phase.id }"
            @click="activePhase = phase.id"
          >
            <span class="phase-number">{{ String(Number(index) + 1).padStart(2, '0') }}</span>
            <span class="phase-name">{{ phase.name }}</span>
          </button>
        </div>

        <!-- 时间轴内容 -->
        <div class="course-timeline">
          <div class="timeline-track">
            <div class="timeline-progress" :style="{ width: timelineProgress + '%' }"></div>
          </div>

          <!-- AI新工具课程 -->
          <div class="timeline-phase" :class="{ active: activePhase === 'aiTools', passed: coursePhaseIndex > 0 }">
            <div class="phase-marker">
              <div class="marker-dot">
                <el-icon><Cpu /></el-icon>
              </div>
              <div class="marker-line"></div>
            </div>
            <div class="phase-content">
              <div class="phase-header">
                <span class="phase-tag">{{ t('enterpriseService.phases.phase01') }}</span>
                <h3>{{ t('enterpriseService.courses.aiTools.title') }}</h3>
                <p class="phase-desc">{{ t('enterpriseService.courses.aiTools.description') }}</p>
              </div>
              <div class="course-list">
                <div
                  class="course-item"
                  v-for="(course, idx) in aiToolsCourses"
                  :key="course.key"
                  :style="{ animationDelay: `${Number(idx) * 0.1}s` }"
                >
                  <span class="course-duration">{{ course.duration }}</span>
                  <span class="course-name">{{ t(course.nameKey) }}</span>
                  <span class="course-badge new">{{ t('enterpriseService.badgeNew') }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 思维类课程 -->
          <div class="timeline-phase" :class="{ active: activePhase === 'thinking', passed: coursePhaseIndex > 1 }">
            <div class="phase-marker">
              <div class="marker-dot">
                <el-icon><Brain /></el-icon>
              </div>
              <div class="marker-line"></div>
            </div>
            <div class="phase-content">
              <div class="phase-header">
                <span class="phase-tag">{{ t('enterpriseService.phases.phase02') }}</span>
                <h3>{{ t('enterpriseService.courses.thinking.title') }}</h3>
                <p class="phase-desc">{{ t('enterpriseService.courses.thinking.description') }}</p>
              </div>
              <div class="course-list">
                <div
                  class="course-item"
                  v-for="(course, idx) in thinkingCourses"
                  :key="course.key"
                  :style="{ animationDelay: `${Number(idx) * 0.1}s` }"
                >
                  <span class="course-duration">{{ course.duration }}</span>
                  <span class="course-name">{{ t(course.nameKey) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 文化类课程 -->
          <div class="timeline-phase" :class="{ active: activePhase === 'culture', passed: coursePhaseIndex > 2 }">
            <div class="phase-marker">
              <div class="marker-dot">
                <el-icon><BookOpen /></el-icon>
              </div>
            </div>
            <div class="phase-content">
              <div class="phase-header">
                <span class="phase-tag">{{ t('enterpriseService.phases.phase03') }}</span>
                <h3>{{ t('enterpriseService.courses.culture.title') }}</h3>
                <p class="phase-desc">{{ t('enterpriseService.courses.culture.description') }}</p>
              </div>
              <div class="course-list">
                <div
                  class="course-item"
                  v-for="(course, idx) in cultureCourses"
                  :key="course.key"
                  :style="{ animationDelay: `${Number(idx) * 0.1}s` }"
                >
                  <span class="course-duration">{{ course.duration }}</span>
                  <span class="course-name">{{ t(course.nameKey) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- AI工具一览 -->
      <section id="tools" class="ai-tools-overview">
        <div class="section-label">{{ t('enterpriseService.sections.toolsOverview') }}</div>
        <div class="tools-intro">
          <h2>{{ t('enterpriseService.tools.title') }}</h2>
          <p>{{ t('enterpriseService.tools.description') }}</p>
        </div>

        <div class="tools-grid">
          <!-- 通用AI工具 -->
          <div class="tool-category">
            <h3>{{ t('enterpriseService.tools.general.title') }}</h3>
            <div class="tool-items">
              <div class="tool-item">
                <el-icon><FileText /></el-icon>
                <span>{{ t('enterpriseService.tools.general.text') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><Image /></el-icon>
                <span>{{ t('enterpriseService.tools.general.image') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><Mic /></el-icon>
                <span>{{ t('enterpriseService.tools.general.voice') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><Video /></el-icon>
                <span>{{ t('enterpriseService.tools.general.video') }}</span>
              </div>
            </div>
          </div>

          <!-- 行业智能体 -->
          <div class="tool-category">
            <h3>{{ t('enterpriseService.tools.industry.title') }}</h3>
            <div class="tool-items">
              <div class="tool-item">
                <el-icon><Factory /></el-icon>
                <span>{{ t('enterpriseService.tools.industry.manufacturing') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><GraduationCap /></el-icon>
                <span>{{ t('enterpriseService.tools.industry.education') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><Stethoscope /></el-icon>
                <span>{{ t('enterpriseService.tools.industry.healthcare') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><Building2 /></el-icon>
                <span>{{ t('enterpriseService.tools.industry.government') }}</span>
              </div>
            </div>
          </div>

          <!-- 职能智能体 -->
          <div class="tool-category">
            <h3>{{ t('enterpriseService.tools.function.title') }}</h3>
            <div class="tool-items">
              <div class="tool-item">
                <el-icon><Headphones /></el-icon>
                <span>{{ t('enterpriseService.tools.function.sales') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><Settings /></el-icon>
                <span>{{ t('enterpriseService.tools.function.production') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><Lightbulb /></el-icon>
                <span>{{ t('enterpriseService.tools.function.rd') }}</span>
              </div>
              <div class="tool-item">
                <el-icon><Briefcase /></el-icon>
                <span>{{ t('enterpriseService.tools.function.office') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 合作伙伴 - 无缝滚动Logo墙 -->
        <div class="partners-section">
          <h3>{{ t('enterpriseService.tools.partners.title') }}</h3>
          <div class="partners-marquee">
            <div class="marquee-track">
              <div class="marquee-content">
                <div v-for="partner in [...partners, ...partners]" :key="partner.name + Math.random()"
                     class="partner-item">
                  <div class="partner-logo">
                    <span class="partner-initial">{{ partner.name[0] }}</span>
                  </div>
                  <span class="partner-name">{{ partner.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 加入方式 -->
      <section id="join" class="join-section">
        <div class="section-label">{{ t('enterpriseService.sections.joinUs') }}</div>
        <div class="join-card card-glass">
          <div class="join-header">
            <h2>{{ t('enterpriseService.join.title') }}</h2>
            <p>{{ t('enterpriseService.join.description') }}</p>
          </div>

          <div class="pricing-comparison">
            <div class="price-card original">
              <span class="price-label">{{ t('enterpriseService.join.originalPrice') }}</span>
              <span class="price-value">¥18,000</span>
              <span class="price-unit">{{ t('enterpriseService.join.perYear') }}</span>
            </div>
            <div class="price-card early-bird">
              <span class="price-badge">{{ t('enterpriseService.join.earlyBird') }}</span>
              <span class="price-label">{{ t('enterpriseService.join.currentPrice') }}</span>
              <span class="price-value">¥6,000</span>
              <span class="price-unit">{{ t('enterpriseService.join.perYear') }}</span>
              <span class="price-note">{{ t('enterpriseService.join.seatsNote') }}</span>
            </div>
          </div>

          <div class="join-benefits">
            <h3>{{ t('enterpriseService.join.benefits.title') }}</h3>
            <div class="benefits-list">
              <div class="benefit-item">
                <el-icon><Check /></el-icon>
                <span>{{ t('enterpriseService.join.benefits.allCourses') }}</span>
              </div>
              <div class="benefit-item">
                <el-icon><Check /></el-icon>
                <span>{{ t('enterpriseService.join.benefits.exploration') }}</span>
              </div>
              <div class="benefit-item">
                <el-icon><Check /></el-icon>
                <span>{{ t('enterpriseService.join.benefits.mutualAid') }}</span>
              </div>
              <div class="benefit-item">
                <el-icon><Check /></el-icon>
                <span>{{ t('enterpriseService.join.benefits.onlineCommunity') }}</span>
              </div>
              <div class="benefit-item">
                <el-icon><Check /></el-icon>
                <span>{{ t('enterpriseService.join.benefits.aiAssistant') }}</span>
              </div>
              <div class="benefit-item">
                <el-icon><Check /></el-icon>
                <span>{{ t('enterpriseService.join.benefits.refund') }}</span>
              </div>
            </div>
          </div>

          <div class="join-cta">
            <el-button type="primary" size="large" @click="handleJoinClick">
              {{ t('enterpriseService.join.cta') }}
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <p class="join-hint">{{ t('enterpriseService.join.hint') }}</p>
          </div>
        </div>
      </section>

      <!-- 底部链接 -->
      <footer class="enterprise-footer">
        <div class="footer-info">
          <p class="company-name">{{ t('enterpriseService.footer.company') }}</p>
          <p class="company-location">{{ t('enterpriseService.footer.location') }}</p>
        </div>
        <div class="quick-nav">
          <button @click="goToRoute('/enterprise/agent-scenario')">{{ t('enterpriseService.footer.agentScenario') }}</button>
          <button @click="goToRoute('/enterprise/human-machine-collaboration')">{{ t('enterpriseService.footer.humanMachine') }}</button>
          <button @click="goToRoute('/about/about-us')">{{ t('enterpriseService.footer.contact') }}</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSEO, generateStructuredData } from '@/composables/useSEO'
import AnimatedNumber from '@/components/common/AnimatedNumber.vue'
import { useEnterpriseAnalytics } from '@/composables/useAnalytics'
import {
  ArrowLeft,
  ArrowRight,
  Target,
  Users,
  Globe,
  Bot,
  Building,
  Workflow,
  UserCheck,
  UserPlus,
  UsersRound,
  Sparkles,
  Cpu,
  Brain,
  BookOpen,
  FileText,
  Image,
  Mic,
  Video,
  Factory,
  GraduationCap,
  Stethoscope,
  Building2,
  Headphones,
  Settings,
  Lightbulb,
  Briefcase,
  Check,
  Compass,
  Zap,
  TrendingUp,
  Layers,
} from '@/lib/lucide-fallback'

const router = useRouter()
const { t } = useI18n()

// ===== 数据埋点 =====
const {
  trackEnterprisePageView,
  // 以下函数预留给将来的埋点需求
  // trackCTAClick,
  // trackModuleClick,
  // trackCoursePhaseSwitch,
  // trackQuadrantClick,
  // trackSideNavClick,
  // trackJoinConversion,
} = useEnterpriseAnalytics()

// 页面浏览埋点
onMounted(() => {
  trackEnterprisePageView()
})

// ===== SEO 配置 =====
useSEO({
  title: t('title.enterprise_service.企业AI化服务智'),
  description: t('data.enterprise_service.智汇AI社企业服'),
  keywords: t('enterprise.keywords'),
  ogTitle: t('enterprise.title'),
  ogDescription: t('enterpriseService.enterpriseDesc'),
  ogImage: '/images/enterprise-og.png',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  canonical: 'https://ihui.ai/enterprise'
})

// 生成结构化数据
onMounted(() => {
  generateStructuredData({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: t('data.enterprise_service.智汇AI社1'),
    url: 'https://ihui.ai',
    logo: 'https://ihui.ai/images/logo.svg',
    description: t('data.enterprise_service.AI时代企业理性2'),
    sameAs: [
      t('data.enterprise_service.httpswei29'),
    ],
    offers: {
      '@type': 'Offer',
      name: t('data.enterprise_service.企业AI化服务会3'),
      price: '6000',
      priceCurrency: 'CNY',
      availability: 'https://schema.org/InStock'
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: t('data.enterprise_service.企业服务4'),
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: t('data.enterprise_service.在地社群5'),
            description: t('data.enterprise_service.线下课程探索活动6')
          }
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: t('data.enterprise_service.线上社群7'),
            description: t('data.enterprise_service.便捷的在线交流平8')
          }
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: t('data.enterprise_service.AI专业服务9'),
            description: t('data.enterprise_service.专业大模型与智能10')
          }
        }
      ]
    }
  })
})

// ===== 响应式状态 =====
const isLoading = ref(true)
const navVisible = ref(false)
const heroVisible = ref(false)
const parallaxOffset = ref(0)
const scrollProgress = ref(0)
const hoveredModule = ref<string | null>(null)
const activeQuadrant = ref<string | null>(null)
const compassRotation = ref(0)
const activePhase = ref('aiTools')
const showSideNav = ref(false)
const activeSection = ref('hero')

// 页面区块配置
const pageSections = [
  { id: 'hero', label: t('data.enterprise_service.首页11') },
  { id: 'positioning', label: t('data.enterprise_service.定位12') },
  { id: 'modules', label: t('data.enterprise_service.服务13') },
  { id: 'ai-architecture', label: t('data.enterprise_service.架构14') },
  { id: 'compass', label: t('data.enterprise_service.罗盘15') },
  { id: 'courses', label: t('data.enterprise_service.课程16') },
  { id: 'tools', label: t('data.enterprise_service.工具17') },
  { id: 'join', label: t('data.enterprise_service.加入18') }
]

// 课程阶段数据
const coursePhases = [
  { id: 'aiTools', name: t('data.enterprise_service.AI工具课程19') },
  { id: 'thinking', name: t('data.enterprise_service.思维类课程20') },
  { id: 'culture', name: t('data.enterprise_service.文化类课程21') }
]

// 计算当前阶段索引
const coursePhaseIndex = computed(() => {
  return coursePhases.findIndex(p => p.id === activePhase.value)
})

// 计算时间轴进度
const timelineProgress = computed(() => {
  const index = coursePhaseIndex.value
  if (index === 0) return 15
  if (index === 1) return 50
  return 85
})

// DOM引用
const pageRef = ref<HTMLElement | null>(null)
const heroRef = ref<HTMLElement | null>(null)
const compassRef = ref<HTMLElement | null>(null)

// ===== 打字机效果 =====
const typingPhrases = [t('data.enterprise_service.企业服务30'), t('enterpriseService.typingPhrases.intelligentTransformation'), t('enterpriseService.typingPhrases.humanMachineCollaboration'), t('enterpriseService.typingPhrases.rationalEfficiency')]
const currentTypingText = ref('')
let phraseIndex = 0
let charIndex = 0
let isDeleting = false
let typingTimer: ReturnType<typeof setTimeout> | null = null
// 加载动画定时器
let loadAnimTimer: ReturnType<typeof setTimeout> | null = null

const runTypingEffect = () => {
  if (!typingPhrases.length) return
  const currentPhrase = typingPhrases[phraseIndex]
  if (!currentPhrase?.length) {
    phraseIndex = (phraseIndex + 1) % typingPhrases.length
    typingTimer = setTimeout(runTypingEffect, 500)
    return
  }
  let speed: number
  if (isDeleting) {
    if (charIndex <= 0) {
      isDeleting = false
      phraseIndex = (phraseIndex + 1) % typingPhrases.length
      currentTypingText.value = ''
      charIndex = 0
      speed = 500
    } else {
      charIndex--
      currentTypingText.value = currentPhrase.substring(0, charIndex)
      speed = 50
    }
  } else {
    currentTypingText.value = currentPhrase.substring(0, charIndex + 1)
    charIndex++
    if (charIndex >= currentPhrase.length) {
      isDeleting = true
      speed = 2000
    } else {
      speed = 100
    }
  }
  typingTimer = setTimeout(runTypingEffect, speed)
}

const startTypewriter = () => {
  if (typingTimer) {
    clearTimeout(typingTimer)
    typingTimer = null
  }
  phraseIndex = 0
  charIndex = 0
  isDeleting = false
  currentTypingText.value = ''
  runTypingEffect()
}

const positioningTags = ['AI TRANSFORMATION', 'RATIONAL EFFICIENCY', 'MUTUAL AID']

// 智能体场景罗盘数据
const quadrantData = [
  {
    id: 'q1',
    type: 'simple',
    tag: 'Q1',
    icon: Zap,
    titleKey: 'enterpriseService.compass.quadrants.simple.title',
    descKey: 'enterpriseService.compass.quadrants.simple.description',
    examples: [
      'enterpriseService.compass.quadrants.simple.examples.qa',
      'enterpriseService.compass.quadrants.simple.examples.workflow'
    ],
    adoption: 78
  },
  {
    id: 'q2',
    type: 'decision',
    tag: 'Q2',
    icon: Brain,
    titleKey: 'enterpriseService.compass.quadrants.decision.title',
    descKey: 'enterpriseService.compass.quadrants.decision.description',
    examples: [
      'enterpriseService.compass.quadrants.decision.examples.analysis',
      'enterpriseService.compass.quadrants.decision.examples.advisor'
    ],
    adoption: 45
  },
  {
    id: 'q3',
    type: 'execution',
    tag: 'Q3',
    icon: Layers,
    titleKey: 'enterpriseService.compass.quadrants.execution.title',
    descKey: 'enterpriseService.compass.quadrants.execution.description',
    examples: [
      'enterpriseService.compass.quadrants.execution.examples.meeting',
      'enterpriseService.compass.quadrants.execution.examples.approval'
    ],
    adoption: 52
  },
  {
    id: 'q4',
    type: 'complex',
    tag: 'Q4',
    icon: TrendingUp,
    titleKey: 'enterpriseService.compass.quadrants.complex.title',
    descKey: 'enterpriseService.compass.quadrants.complex.description',
    examples: [
      'enterpriseService.compass.quadrants.complex.examples.marketing',
      'enterpriseService.compass.quadrants.complex.examples.multiAgent'
    ],
    adoption: 23
  }
]

// 合作伙伴数据
const partners = [
  { name: t('data.enterprise_service.火山引擎22'), logo: '' },
  { name: t('data.enterprise_service.阿里云23'), logo: '' },
  { name: t('data.enterprise_service.腾讯云24'), logo: '' },
  { name: t('data.enterprise_service.九章智算云25'), logo: '' },
  { name: t('data.enterprise_service.致远互联26'), logo: '' },
  { name: 'OpenAI', logo: '' },
  { name: t('data.enterprise_service.百度智能云27'), logo: '' },
  { name: t('data.enterprise_service.华为云28'), logo: '' },
]

// 课程数据
const aiToolsCourses = [
  { key: 'ai-development', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.aiTools.items.development' },
  { key: 'ai-productivity', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.aiTools.items.productivity' },
  { key: 'ai-tools-intro', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.aiTools.items.toolsIntro' },
  { key: 'agent-building', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.aiTools.items.agentBuilding' },
  { key: 'structure-analysis', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.aiTools.items.structureAnalysis' },
  { key: 'ai-literacy', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.aiTools.items.aiLiteracy' },
]

const thinkingCourses = [
  { key: 'problem-solving', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.thinking.items.problemSolving' },
  { key: 'innovation-barriers', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.thinking.items.innovationBarriers' },
  { key: 'creative-learning', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.thinking.items.creativeLearning' },
  { key: 'org-change', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.thinking.items.orgChange' },
]

const cultureCourses = [
  { key: 'culture-management', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.culture.items.cultureManagement' },
  { key: 'mission-vision', duration: t('enterpriseService.courseDuration.oneLesson'), nameKey: 'enterpriseService.courses.culture.items.missionVision' },
  { key: 'eastern-philosophy', duration: t('enterpriseService.courseDuration.series'), nameKey: 'enterpriseService.courses.culture.items.easternPhilosophy' },
  { key: 'western-philosophy', duration: t('enterpriseService.courseDuration.series'), nameKey: 'enterpriseService.courses.culture.items.westernPhilosophy' },
]

// ===== 浮动粒子样式 =====
const getParticleStyle = (index: number) => {
  const sizes = [4, 6, 3, 5, 4, 7]
  const delays = [0, 2, 4, 1, 3, 5]
  const durations = [15, 20, 18, 22, 17, 25]
  const positions = [
    { left: '10%', top: '20%' },
    { left: '85%', top: '15%' },
    { left: '70%', top: '60%' },
    { left: '25%', top: '70%' },
    { left: '50%', top: '40%' },
    { left: '90%', top: '80%' }
  ]
  return {
    width: `${sizes[index - 1]}px`,
    height: `${sizes[index - 1]}px`,
    left: positions[index - 1].left,
    top: positions[index - 1].top,
    animationDelay: `${delays[index - 1]}s`,
    animationDuration: `${durations[index - 1]}s`
  }
}

// ===== 滚动视差 =====
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    parallaxOffset.value = window.scrollY * 0.5
    compassRotation.value = window.scrollY * 0.02
    // 计算滚动进度
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0

    // 显示/隐藏侧边导航（滚动超过300px时显示）
    showSideNav.value = window.scrollY > 300

    // 检测当前活动区块
    const sections = ['hero', 'positioning', 'modules', 'ai-architecture', 'compass', 'courses', 'tools', 'join']
    for (const sectionId of sections) {
      const el = document.getElementById(sectionId)
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= 200 && rect.bottom > 200) {
          activeSection.value = sectionId
          break
        }
      }
    }
  })
}

// 平滑滚动到指定区块
const scrollToSectionSmooth = (sectionId: string) => {
  const el = document.getElementById(sectionId)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
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
    }, 200)
    loadAnimTimer = setTimeout(() => {
      heroVisible.value = true
      // 启动打字机效果
      startTypewriter()
    }, 500)
  }, 800)

  window.addEventListener('scroll', handleScroll, { passive: true })
})

onActivated(() => {
  if (heroVisible.value) startTypewriter()
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => window.removeEventListener('scroll', handleScroll))
cleanup.add(() => { if (typingTimer) { clearTimeout(typingTimer); typingTimer = null } })
cleanup.add(() => { if (loadAnimTimer !== null) { clearTimeout(loadAnimTimer); loadAnimTimer = null } })
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })

// ===== 方法 =====
const goHome = () => router.push('/').catch(() => {})
const goToRoute = (path: string) => router.push(path).catch(() => {})

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const goToAgentScenario = (type: string) => {
  router.push(`/enterprise/agent-scenario?type=${type}`).catch(() => {})
}

const goToAgentScenarioDetail = () => {
  router.push('/enterprise/agent-scenario').catch(() => {})
}

const handleJoinClick = () => {
  router.push('/about/about-us?source=enterprise').catch(() => {})
}
</script>

<style scoped lang="scss">
@use "sass:color";
@use '@/styles/_breakpoints.scss' as bp;

// ===== 设计令牌 =====
// 说明：Sass 的 color.* 函数不能直接作用于 CSS 变量，所以拆分为「静态基色」和「CSS 变量」两套：
// - $accent-blue-base: 仅用于 color.adjust 等需要编译期颜色的场景
// - $accent-blue: 仍然使用 CSS 变量，供普通背景/描边等使用
$accent-blue-base: var(--color-primary); // 近似 Element Plus primary 色
$accent-blue: var(--el-color-primary);
$accent-purple: var(--el-color-primary-light-3);
$accent-pink: var(--el-color-danger-light-3);
$transition-smooth: cubic-bezier(0.16, 1, 0.3, 1);

.enterprise-service-page {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;

  // 性能优化 - GPU 加速
  * {
    backface-visibility: hidden;
  }
}

// ===== 无障碍 - 跳过链接 =====
.skip-link {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: var(--el-color-black);
  color: var(--el-color-white);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-weight: 600;
  z-index: var(--z-loading);
  transition: top 0.2s ease;
  text-decoration: none;

  &:focus {
    top: 16px;
    outline: 2px solid $accent-blue;
    outline-offset: 2px;
  }
}

// ===== 无障碍 - 焦点样式 =====
.side-nav-item,
.module-card,
.quadrant-card,
.phase-btn,
.tool-item,
.cta-primary,
.cta-secondary {
  &:focus-visible {
    outline: 2px solid $accent-blue;
    outline-offset: 2px;
  }
}

// 减少动画 - 尊重用户偏好
// 注意：以下  用于确保可访问性需求，覆盖所有动画效果
// 这是 WCAG 2.1 推荐的 prefers-reduced-motion 实现方式
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    /* stylelint-disable-next-line declaration-no-important */
    animation-duration: 0.01ms ;
    /* stylelint-disable-next-line declaration-no-important */
    animation-iteration-count: 1 ;
    /* stylelint-disable-next-line declaration-no-important */
    transition-duration: 0.01ms ;
  }

  .floating-particles,
  .svg-decorations {
    display: none;
  }
}

// ===== 性能优化层 =====
.enterprise-bg,
.scroll-progress-bar,
.side-nav,
.enterprise-hero .typewriter-title,
.module-card,
.layer-card,
.quadrant-card {
  will-change: transform, opacity;
  transform: translateZ(0);
}

// 动画完成后移除 will-change 优化内存
[v-scroll-reveal].is-revealed {
  will-change: auto;
}

// 减少重绘区域
.floating-particles .particle {
  contain: layout paint style;
}

.svg-decorations svg {
  contain: layout style;
}

// ===== 滚动进度条（使用全局定义） =====

// ===== 侧边锚点导航 =====
.side-nav {
  position: fixed;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  z-index: var(--z-header);
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;

  &.is-visible {
    opacity: 1;
    visibility: visible;
  }

  @include bp.tablet-down {
    display: none;
  }

  .side-nav-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 12px;
    background: rgb(var(--el-color-white-rgb), 0.8);
    backdrop-filter: blur(12px);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
  }

  .side-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    padding: 4px 8px 4px 4px;
    border-radius: var(--global-border-radius);
    transition: all 0.2s ease;

    &:hover {
      background: var(--el-fill-color-light);

      .side-nav-label {
        opacity: 1;
        transform: translateX(0);
      }
    }

    &.is-active {
      :where(.side-nav-dot) {
        background: $accent-blue;
        transform: scale(1.2);
        border: 2px solid var(--border-unified-color);
      }

      :where(.side-nav-label) {
        color: $accent-blue;
        font-weight: 600;
      }
    }

    .side-nav-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--global-border-radius);
      background: var(--el-border-color);
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .side-nav-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
      opacity: 0.7;
      transform: translateX(-4px);
      transition: all 0.2s ease;
      font-weight: 500;
    }
  }
}

// ===== 骨架屏 =====
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

    .skeleton-label {
      height: 12px;
      width: 180px;
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      margin-bottom: 24px;
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }

    .skeleton-title {
      height: 72px;
      width: 400px;
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      margin-bottom: 24px;
      animation: skeleton-pulse 1.5s ease-in-out infinite 0.1s;
    }

    .skeleton-desc {
      height: 48px;
      width: 600px;
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      margin-bottom: 48px;
      animation: skeleton-pulse 1.5s ease-in-out infinite 0.2s;
    }

    .skeleton-stats {
      display: flex;
      gap: 40px;

      :where(.skeleton-stat) {
        height: 60px;
        width: 120px;
        background: var(--el-fill-color-light);
        border-radius: var(--global-border-radius);
        animation: skeleton-pulse 1.5s ease-in-out infinite 0.3s;
      }
    }
  }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

// ===== 动态背景 =====
.enterprise-bg {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;

  .gradient-layer {
    position: absolute;
    top: -10%;
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

  .floating-particles {
    position: absolute;
    inset: 0;

    .particle {
      position: absolute;
    }
  }

  // SVG装饰
  .svg-decorations {
    position: absolute;
    inset: 0;
    overflow: hidden;

    :where(.deco-ring) {
      position: absolute;
      opacity: 0.6;

      &.ring-1 {
        width: 300px;
        height: 300px;
        right: -5%;
        top: 10%;
        animation: slow-spin 120s linear infinite;
      }
    }

    :where(.deco-polygon) {
      position: absolute;
      opacity: 0.4;

      &.poly-1 {
        width: 150px;
        height: 150px;
        left: 5%;
        top: 60%;
        animation: float-gentle 15s ease-in-out infinite;
      }
    }

    :where(.deco-dots) {
      position: absolute;
      opacity: 0.5;

      &.dots-1 {
        width: 120px;
        height: 120px;
        right: 15%;
        bottom: 20%;
        animation: pulse-opacity 4s ease-in-out infinite;
      }
    }

    :where(.deco-lines) {
      position: absolute;
      opacity: 0.3;

      &.lines-1 {
        width: 200px;
        height: 200px;
        left: 10%;
        top: 30%;
        animation: rotate-slow 60s linear infinite;
      }
    }
  }
}

@keyframes slow-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes float-gentle {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(10px, -15px) rotate(5deg); }
}

@keyframes pulse-opacity {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}

@keyframes rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes float-particle {
  0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
  25% { transform: translateY(-30px) translateX(10px); opacity: 0.25; }
  50% { transform: translateY(-10px) translateX(-15px); opacity: 0.1; }
  75% { transform: translateY(-25px) translateX(5px); opacity: 0.2; }
}

.container {
  position: relative;
  z-index: var(--z-base);
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 48px;

  @include bp.tablet-down {
    padding: 0 24px;
  }
}

// ===== 导航栏 =====
.enterprise-nav {
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
    color: $accent-blue;
    font-weight: 800;
    letter-spacing: 2px;
    border: var(--unified-border);
    padding: 4px 12px;
    background: rgba($accent-blue, 0.05);
    animation: tag-glow 3s ease-in-out infinite;
  }
}

@keyframes tag-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.9; }
}

// ===== 英雄区 - 极简科技风格 =====
.enterprise-hero {
  padding: 80px 0 120px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.8s ease, transform 0.8s $transition-smooth;
  transition-delay: 0.1s;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .hero-label {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;

    .label-text {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-text-color-secondary);
      font-weight: 500;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .label-line {
      flex: 1;
      max-width: 80px;
      height: 1px;
      background: var(--el-border-color);
    }
  }

  // 打字机标题样式
  .typewriter-title {
    font-size: clamp(36px, 7vw, 72px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    margin-bottom: 28px;
    color: var(--el-text-color-primary);

    .typing-text {
      display: inline;
      min-width: 4em;
    }

    // 渐变文字效果
    .gradient-text {
      color: $accent-blue;
    }

    // 闪烁光标
    .typing-cursor {
      display: inline-block;
      color: $accent-blue;
      font-weight: 400;
      animation: cursor-blink 1s step-end infinite;
      margin-left: 2px;
    }
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .mission-statement {
    font-size: 17px;
    color: var(--el-text-color-secondary);
    max-width: 560px;
    line-height: 1.7;
    margin-bottom: 56px;
    letter-spacing: 0.01em;
  }

  .hero-stats {
    display: flex;
    align-items: flex-start;
    gap: 0;
    margin-bottom: 56px;
    padding: 32px 0;
    border-top: var(--unified-border);
    border-bottom: var(--unified-border-bottom);

    @include bp.mobile-only {
      flex-direction: column;
      gap: 32px;
      padding: 24px 0;
    }

    :where(.stat-item) {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      padding: 0 32px;

      &:first-child {
        padding-left: 0;
      }

      &:last-child {
        padding-right: 0;
      }

      @include bp.mobile-only {
        padding: 0;
      }

      &.highlight {
        :where(.stat-value) {
          color: var(--el-color-black);
          position: relative;

          &::after {
            content: '';
            position: absolute;
            bottom: 4px;
            left: 0;
            right: 0;
            height: 3px;
            background: $accent-blue;
            border-radius: var(--global-border-radius);
          }
        }
      }

      :where(.stat-value) {
        font-family: var(--font-family-mono);
        font-size: 42px;
        font-weight: 700;
        color: var(--el-text-color-primary);
        letter-spacing: -0.02em;
        line-height: 1;
        margin-bottom: 8px;
      }

      :where(.stat-label) {
        font-size: 13px;
        color: var(--el-text-color-secondary);
        font-weight: 500;
        letter-spacing: 0.02em;
      }

      :where(.stat-badge) {
        position: absolute;
        top: 0;
        right: 32px;
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 600;
        color: var(--el-color-success);
        background: var(--el-color-success-light-9);
        padding: 4px 10px;
        border-radius: var(--global-border-radius);
        border: var(--unified-border);

        @include bp.mobile-only {
          right: 0;
        }
      }
    }

    .stat-divider {
      width: 1px;
      height: 64px;
      background: var(--el-border-color-lighter);
      flex-shrink: 0;

      @include bp.mobile-only {
        display: none;
      }
    }
  }

  .hero-actions {
    display: flex;
    gap: 12px;

    @include bp.mobile-only {
      flex-direction: column;
    }

    .cta-primary {
      padding: 14px 28px;
      font-weight: 600;
      font-size: 14px;
      background: var(--el-color-black);
      border: none;
      border-radius: var(--global-border-radius);
      position: relative;
      overflow: hidden;
      transition: all 0.2s ease;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: var(--color-white-5);
        transform: translateX(-100%);
        transition: transform 0.5s ease;
      }

      &:hover {
        background: var(--el-color-primary);
        transform: translateY(-1px);
        border-color: rgb(var(--el-color-black-rgb), 0.3);

        &::before {
          transform: translateX(100%);
        }
      }

      &:active {
        transform: translateY(0);
      }

      :where(.btn-text) {
        position: relative;
        z-index: var(--z-base);
      }

      :where(.btn-icon) {
        transition: transform 0.2s ease;
        margin-left: 4px;
      }

      &:hover :where(.btn-icon) {
        transform: translateX(3px);
      }
    }

    .cta-secondary {
      padding: 14px 28px;
      font-weight: 500;
      font-size: 14px;
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
      background: transparent;
      color: var(--el-text-color-primary);
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--el-text-color-primary);
        background: var(--el-fill-color-light);
      }
    }
  }
}

@keyframes char-reveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 极简科技风格 - 3D翻转字符动画
@keyframes char-flip-reveal {
  0% {
    opacity: 0;
    transform: translateY(100%) rotateX(-90deg);
  }

  60% {
    opacity: 1;
    transform: translateY(-5%) rotateX(5deg);
  }

  100% {
    opacity: 1;
    transform: translateY(0) rotateX(0);
  }
}

.section-label {
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  letter-spacing: 2px;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  text-transform: uppercase;

  &::before {
    content: '';
    width: 12px;
    height: 2px;
    background: $accent-blue;
    margin-right: 12px;
    border-radius: var(--global-border-radius);
  }

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--el-border-color-extra-light);
    margin-left: 16px;
  }
}

// ===== 滚动入场动画 - 增强版 =====
[v-scroll-reveal] {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);

  &.is-revealed {
    opacity: 1;
    transform: translateY(0);

    // 子元素交错动画
    .module-card,
    .layer-card,
    .quadrant-card,
    .tool-category,
    .phase-btn {
      animation: stagger-fade-in 0.5s ease forwards;
      opacity: 0;

      @for $i from 1 through 6 {
        &:nth-child(#{$i}) {
          animation-delay: #{$i * 0.08}s;
        }
      }
    }
  }
}

@keyframes stagger-fade-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ===== 全局微交互动画 =====
@keyframes subtle-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.02); opacity: 0.95; }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

// 交互式卡片悬停浮动
.module-card,
.layer-card,
.quadrant-card,
.tool-category {
  &:hover {
    animation: subtle-float 2s ease-in-out infinite;
  }
}

// 按钮脉冲效果
.cta-primary:focus-visible,
.cta-secondary:focus-visible {
  animation: pulse-glow 1.5s ease-in-out infinite;
}

// 加载骨架屏闪烁效果
.skeleton-label,
.skeleton-title,
.skeleton-desc,
.skeleton-stat {
  background: var(--el-fill-color-light);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

// ===== 核心定位 =====
.core-positioning {
  margin-bottom: 120px;

  .positioning-card {
    display: flex;
    gap: 40px;
    padding: 48px;
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    position: relative;
    overflow: hidden;

    @include bp.tablet-down {
      flex-direction: column;
      padding: 32px;
    }

    .positioning-icon {
      color: $accent-blue;
      flex-shrink: 0;
      position: relative;

      :where(.icon-glow) {
        position: absolute;
        inset: -20px;
        background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
        border-radius: var(--global-border-radius);
        animation: icon-pulse 3s ease-in-out infinite;
      }
    }

    .positioning-content {
      flex: 1;

      h2 {
        font-size: 28px;
        font-weight: 800;
        margin-bottom: 16px;
        color: var(--el-text-color-primary);
      }

      :where(.positioning-desc) {
        font-size: 16px;
        color: var(--el-text-color-regular);
        line-height: 1.8;
        margin-bottom: 24px;
      }

      :where(.positioning-tags) {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;

        :where(.tag) {
          font-family: var(--font-family-mono);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          color: var(--el-text-color-secondary);
          padding: 6px 12px;
          background: var(--el-fill-color-extra-light);
          border: var(--unified-border);
          opacity: 0;
          animation: tag-fade-in 0.5s ease forwards;

          &:hover {
            border-color: $accent-blue;
            color: $accent-blue;
          }
        }
      }
    }
  }
}

@keyframes icon-pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

@keyframes tag-fade-in {
  to { opacity: 1; }
}

// ===== 服务模块 - 极简科技风格 =====
:where(.service-modules) {
  margin-bottom: 140px;

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: var(--el-border-color-lighter);
    border-radius: var(--global-border-radius);
    overflow: hidden;

    @include bp.tablet-down {
      grid-template-columns: repeat(2, 1fr);
    }

    @include bp.mobile-only {
      grid-template-columns: 1fr;
    }
  }

  .module-card {
    background: var(--el-bg-color);
    padding: 40px 36px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;

    // 顶部渐变指示条
    .module-glow {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: $accent-blue;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    // 悬停波纹背景
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba($accent-blue, 0.03);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    &.featured {
      background: rgba($accent-blue, 0.02);

      :where(.featured-badge) {
        position: absolute;
        top: 20px;
        right: 20px;
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 600;
        color: $accent-blue;
        background: rgba($accent-blue, 0.08);
        padding: 5px 12px;
        border-radius: var(--global-border-radius);
        letter-spacing: 0.5px;
        border: var(--unified-border);
      }
    }

    &.is-hovered, &:hover {
      background: var(--el-fill-color-lighter);

      &::before {
        opacity: 1;
      }

      :where(.module-glow) {
        transform: scaleX(1);
      }

      :where(.module-arrow) {
        transform: translateX(4px);
        opacity: 1;
      }

      :where(.module-icon) {
        transform: scale(1.05) translateY(-2px);

        .el-icon {
          color: $accent-blue;
        }
      }

      h3 {
        color: $accent-blue;
      }
    }

    .module-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;

      :where(.module-icon) {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-fill-color-extra-light);
        border-radius: var(--global-border-radius);
        transition: all 0.3s ease;

        .el-icon {
          color: var(--el-text-color-secondary);
          transition: color 0.3s ease;
        }
      }

      :where(.module-tag) {
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 500;
        color: var(--el-text-color-placeholder);
        letter-spacing: 0.5px;
      }
    }

    h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 10px;
      color: var(--el-text-color-primary);
      transition: color 0.2s ease;
      letter-spacing: -0.01em;
    }

    p {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      line-height: 1.65;
      margin-bottom: 24px;
      min-height: 46px;
    }

    .module-features {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 28px;

      span {
        font-size: 12px;
        color: var(--el-text-color-regular);
        padding: 5px 12px;
        background: var(--el-fill-color-light);
        border-radius: var(--global-border-radius);
        transition: all 0.2s ease;
        font-weight: 500;

        &:hover {
          background: rgba($accent-blue, 0.08);
          color: $accent-blue;
        }
      }
    }

    :where(.module-footer) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 20px;
      border-top: var(--unified-border);

      :where(.learn-more) {
        font-size: 13px;
        color: var(--el-text-color-secondary);
        font-weight: 500;
      }

      :where(.module-arrow) {
        color: var(--el-text-color-placeholder);
        opacity: 0;
        transition: all 0.3s ease;
      }
    }
  }
}

// ===== AI架构图 - 极简交互式 =====
:where(.ai-architecture) {
  margin-bottom: 140px;

  .architecture-intro {
    margin-bottom: 56px;

    h2 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
      letter-spacing: -0.02em;
    }

    p {
      font-size: 15px;
      color: var(--el-text-color-secondary);
      line-height: 1.7;
      max-width: 600px;
    }
  }

  .architecture-layers {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .layer-card {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    overflow: hidden;
    transition: all 0.3s ease;

    &:hover {
      border-color: var(--el-border-color);

      :where(.layer-header) {
        background: var(--el-fill-color-light);

        :where(.layer-tag) {
          color: $accent-blue;
        }
      }

      :where(.layer-item) {
        :where(.item-icon) {
          transform: scale(1.05);
          background: rgba($accent-blue, 0.1);

          .el-icon {
            color: $accent-blue;
          }
        }
      }
    }

    :where(.layer-header) {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      background: var(--el-fill-color-lighter);
      border-bottom: var(--unified-border-bottom);
      transition: background 0.2s ease;

      :where(.layer-tag) {
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 600;
        color: var(--el-text-color-secondary);
        letter-spacing: 0.5px;
        transition: color 0.2s ease;
      }

      h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        margin: 0;
      }
    }

    .layer-content {
      padding: 28px 24px;
    }
  }

  .physical-world {
    .layer-content {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;

      @include bp.tablet-down {
        grid-template-columns: 1fr;
      }
    }

    :where(.layer-item) {
      display: flex;
      gap: 14px;
      padding: 16px;
      border-radius: var(--global-border-radius);
      transition: background 0.2s ease;

      &:hover {
        background: var(--el-fill-color-lighter);
      }

      :where(.item-icon) {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-fill-color-light);
        border-radius: var(--global-border-radius);
        flex-shrink: 0;
        transition: all 0.2s ease;

        .el-icon {
          color: var(--el-text-color-secondary);
          font-size: 20px;
          transition: color 0.2s ease;
        }
      }

      h4 {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 6px;
        color: var(--el-text-color-primary);
      }

      p {
        font-size: 13px;
        color: var(--el-text-color-secondary);
        line-height: 1.5;
        margin: 0;
      }
    }
  }

  .info-world {
    .info-levels {
      display: flex;
      align-items: stretch;
      gap: 16px;

      @include bp.tablet-down {
        flex-direction: column;
      }
    }

    .info-level {
      flex: 1;
      padding: 20px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--el-border-color);
        background: var(--el-fill-color-light);
      }

      :where(.level-label) {
        display: block;
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 1px;
        margin-bottom: 16px;
      }

      &.basic :where(.level-label) {
        color: var(--el-text-color-secondary);
      }

      &.advanced :where(.level-label) {
        color: $accent-blue;
      }

      :where(.level-items) {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        span {
          font-size: 12px;
          color: var(--el-text-color-regular);
          padding: 6px 12px;
          background: var(--el-bg-color);
          border: var(--unified-border);
          border-radius: var(--global-border-radius);
        }
      }
    }

    .level-arrow {
      color: var(--el-text-color-placeholder);
      font-size: 24px;

      @include bp.tablet-down {
        transform: rotate(90deg);
      }
    }
  }

  .ai-effect {
    .effect-flow {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      margin-bottom: 32px;

      @include bp.mobile-only {
        flex-direction: column;
      }

      :where(.flow-arrow) {
        color: var(--el-text-color-placeholder);
        font-size: 20px;

        @include bp.mobile-only {
          transform: rotate(90deg);
        }
      }
    }

    .effect-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      :where(.effect-icon) {
        width: 64px;
        height: 64px;
        border-radius: var(--global-border-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;

        &.super-employee {
          background: rgba($accent-blue, 0.1);
          color: $accent-blue;
        }

        &.super-team {
          background: rgba($accent-purple, 0.1);
          color: $accent-purple;
        }

        &.super-product {
          background: rgba($accent-pink, 0.1);
          color: $accent-pink;
        }
      }

      span {
        font-size: 14px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    .effect-metrics {
      display: flex;
      justify-content: center;
      gap: 48px;

      :where(.metric) {
        text-align: center;

        :where(.metric-label) {
          font-size: 13px;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }
}

// ===== 智能体场景罗盘 - 极简交互式 =====
.agent-compass {
  margin-bottom: 140px;

  .compass-intro {
    margin-bottom: 56px;

    h2 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
      letter-spacing: -0.02em;
    }

    p {
      font-size: 15px;
      color: var(--el-text-color-secondary);
      line-height: 1.7;
      max-width: 600px;
    }
  }

  .compass-visual {
    position: relative;
    padding: 60px 0;
    margin-bottom: 48px;
  }

  // 中心罗盘图
  .compass-center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 160px;
    height: 160px;
    z-index: calc(var(--z-base) + 1);

    @include bp.mobile-only {
      display: none;
    }

    :where(.compass-ring) {
      position: absolute;
      border-radius: var(--global-border-radius);
      border: var(--unified-border);

      &.ring-outer {
        inset: 0;
        border-style: dashed;
        animation: compass-rotate 30s linear infinite;
      }

      &.ring-middle {
        inset: 20px;
        background: rgba($accent-blue, 0.03);
      }

      &.ring-inner {
        inset: 40px;
        background: var(--el-bg-color);
        border-color: rgba($accent-blue, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }

    .compass-core {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: $accent-blue;

      span {
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
      }
    }
  }

  @keyframes compass-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  // 坐标轴标签
  .compass-axis-labels {
    position: absolute;
    inset: 0;
    pointer-events: none;

    @include bp.mobile-only {
      display: none;
    }

    :where(.axis-label) {
      position: absolute;
      font-family: var(--font-family-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--el-text-color-placeholder);
      letter-spacing: 1px;

      &.axis-top {
        top: 0;
        left: 50%;
        transform: translateX(-50%);
      }

      &.axis-bottom {
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
      }

      &.axis-left {
        left: 0;
        top: 50%;
        transform: translateY(-50%);
      }

      &.axis-right {
        right: 0;
        top: 50%;
        transform: translateY(-50%);
      }
    }
  }

  // 四象限卡片网格 - 极简风格
  .compass-quadrants-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px 120px;
    max-width: 900px;
    margin: 0 auto;

    @include bp.tablet-down {
      gap: 32px 60px;
    }

    @include bp.mobile-only {
      grid-template-columns: 1fr;
      gap: 16px;
    }
  }

  .quadrant-card {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 24px;
    cursor: pointer;
    transition: all 0.25s ease;
    position: relative;

    &:hover {
      border-color: var(--el-border-color);
      transform: translateY(-2px);

      :where(.quadrant-header .q-number) {
        background: $accent-blue;
        color: var(--el-bg-color-page);
      }

      h4 {
        color: $accent-blue;
      }
    }

    &.quadrant-q1 { order: 3; }
    &.quadrant-q2 { order: 1; }
    &.quadrant-q3 { order: 4; }
    &.quadrant-q4 { order: 2; }

    // 移动端使用单类与媒体查询，禁止高特异性
    @include bp.mobile-only {
      &.quadrant-q1,
      &.quadrant-q2,
      &.quadrant-q3,
      &.quadrant-q4 {
        order: unset;
      }
    }

    .quadrant-indicator {
      position: absolute;
      display: flex;
      align-items: center;

      @include bp.mobile-only {
        display: none;
      }

      :where(.indicator-dot) {
        width: 8px;
        height: 8px;
        background: $accent-blue;
        border-radius: var(--global-border-radius);
        border: 2px solid var(--border-unified-color);
      }

      :where(.indicator-line) {
        width: 40px;
        height: 1px;
        background: $accent-blue;
      }
    }

    &.quadrant-q1 :where(.quadrant-indicator) {
      top: 50%;
      right: -60px;
      transform: translateY(-50%);
    }

    &.quadrant-q2 :where(.quadrant-indicator) {
      top: 50%;
      right: -60px;
      transform: translateY(-50%);
    }

    &.quadrant-q3 :where(.quadrant-indicator) {
      top: 50%;
      left: -60px;
      transform: translateY(-50%) rotate(180deg);
    }

    &.quadrant-q4 :where(.quadrant-indicator) {
      top: 50%;
      left: -60px;
      transform: translateY(-50%) rotate(180deg);
    }

    &.is-active, &:hover {
      border-color: $accent-blue;
      transform: translateY(-4px) scale(1.02);

      :where(.quadrant-icon) {
        color: $accent-blue;
        transform: scale(1.1);
      }

      :where(.progress-bar) {
        background: $accent-blue;
      }
    }

    .quadrant-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      :where(.quadrant-tag) {
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 800;
        color: $accent-blue;
        letter-spacing: 1px;
        padding: 4px 10px;
        background: rgba($accent-blue, 0.08);
        border-radius: var(--global-border-radius);
      }

      :where(.quadrant-icon) {
        color: var(--el-text-color-placeholder);
        transition: all 0.3s ease;
      }
    }

    h4 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 10px;
      color: var(--el-text-color-primary);
    }

    p {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      margin-bottom: 16px;
      min-height: 40px;
    }

    .quadrant-examples {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 20px;

      span {
        font-size: 12px;
        color: var(--el-text-color-regular);
        padding: 4px 10px;
        background: var(--el-fill-color-extra-light);
        border-radius: var(--global-border-radius);
        transition: all 0.2s ease;

        &:hover {
          background: rgba($accent-blue, 0.1);
          color: $accent-blue;
        }
      }
    }

    :where(.quadrant-progress) {
      :where(.progress-bar) {
        height: 3px;
        background: var(--el-border-color-lighter);
        border-radius: var(--global-border-radius);
        margin-bottom: 8px;
        transition: all 0.6s ease;
      }

      :where(.progress-label) {
        font-family: var(--font-family-mono);
        font-size: 12px;
        color: var(--el-text-color-placeholder);
        letter-spacing: 0.5px;
      }
    }
  }

  .compass-cta {
    text-align: center;

    .cta-compass {
      padding: 16px 40px;
      font-weight: 700;

      // 使用静态基色参与渐变计算，避免对 CSS 变量调用 color.adjust 报错
      background: $accent-blue-base;
      border: var(--unified-border);

      &:hover {
        transform: translateY(-2px);
        border-color: rgba($accent-blue, 0.6);
      }
    }
  }
}

// ===== 课程体系 - 极简交互式 =====
:where(.course-system) {
  margin-bottom: 140px;

  .course-intro {
    margin-bottom: 56px;

    h2 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
      letter-spacing: -0.02em;
    }

    p {
      font-size: 15px;
      color: var(--el-text-color-secondary);
      line-height: 1.7;
      max-width: 600px;
    }
  }

  // 课程阶段选择器 - 极简标签风格
  .course-phase-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 40px;
    padding: 6px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);

    @include bp.mobile-only {
      flex-direction: column;
    }

    .phase-btn {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      background: transparent;
      border: none;
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover:not(.active) {
        background: rgb(var(--el-color-white-rgb), 0.5);
      }

      &.active {
        background: var(--el-bg-color);
        border: var(--unified-border);

        :where(.phase-number) {
          color: var(--el-color-white);
          background: var(--el-color-black);
        }

        :where(.phase-name) {
          color: var(--el-text-color-primary);
          font-weight: 600;
        }
      }

      .phase-number {
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 600;
        color: var(--el-text-color-placeholder);
        padding: 4px 8px;
        background: var(--el-fill-color-light);
        border-radius: var(--global-border-radius);
        transition: all 0.2s ease;
      }

      .phase-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--el-text-color-secondary);
        transition: all 0.3s ease;
      }
    }
  }

  // 时间轴
  .course-timeline {
    position: relative;

    .timeline-track {
      position: absolute;
      left: 24px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--el-border-color-extra-light);

      .timeline-progress {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        background: $accent-purple;
        transition: height 0.5s $transition-smooth;
      }
    }
  }

  // 时间轴阶段
  .timeline-phase {
    display: flex;
    gap: 32px;
    padding-bottom: 48px;
    opacity: 0.5;
    transition: all 0.4s $transition-smooth;

    &:last-child {
      padding-bottom: 0;

      .marker-line { display: none; }
    }

    &.active {
      opacity: 1;

      :where(.marker-dot) {
        background: $accent-purple;
        border-color: $accent-purple;
        border-width: 2px;

        .el-icon { color: var(--el-bg-color-page); }
      }

      :where(.phase-content) {
        background: var(--el-bg-color);
        border-color: rgba($accent-purple, 0.2);

        :where(.phase-tag) {
          color: $accent-purple;
          background: rgba($accent-purple, 0.1);
        }
      }

      :where(.course-item) {
        animation: course-fade-in 0.5s $transition-smooth forwards;
      }
    }

    &.passed {
      :where(.marker-dot) {
        background: $accent-purple;
        border-color: $accent-purple;

        .el-icon { color: var(--el-bg-color-page); }
      }
    }

    .phase-marker {
      position: relative;
      flex-shrink: 0;
      z-index: var(--z-base);

      :where(.marker-dot) {
        width: 48px;
        height: 48px;
        border-radius: var(--global-border-radius);
        background: var(--el-bg-color);
        border: 2px solid var(--el-border-color-lighter);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.4s $transition-smooth;

        .el-icon {
          font-size: 20px;
          color: var(--el-text-color-secondary);
          transition: all 0.3s ease;
        }
      }

      .marker-line {
        position: absolute;
        left: 50%;
        top: 56px;
        bottom: -48px;
        width: 2px;
        margin-left: -1px;
        background: var(--el-border-color-extra-light);
      }
    }

    .phase-content {
      flex: 1;
      background: var(--el-fill-color-extra-light);
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      padding: 24px;
      transition: all 0.4s $transition-smooth;

      :where(.phase-header) {
        margin-bottom: 20px;

        :where(.phase-tag) {
          font-family: var(--font-family-mono);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          color: var(--el-text-color-placeholder);
          padding: 4px 10px;
          background: var(--el-fill-color-light);
          border-radius: var(--global-border-radius);
          display: inline-block;
          margin-bottom: 12px;
          transition: all 0.3s ease;
        }

        h3 {
          font-size: 20px;
          font-weight: 700;
          color: var(--el-text-color-primary);
          margin: 0 0 8px;
        }

        :where(.phase-desc) {
          font-size: 14px;
          color: var(--el-text-color-secondary);
          margin: 0;
        }
      }

      :where(.course-list) {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      :where(.course-item) {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--el-bg-color);
        border-radius: var(--global-border-radius);
        opacity: 0;
        transform: translateX(-10px);

        :where(.course-duration) {
          font-family: var(--font-family-mono);
          font-size: 12px;
          font-weight: 800;
          color: $accent-purple;
          padding: 4px 10px;
          background: rgba($accent-purple, 0.1);
          border-radius: var(--global-border-radius);
          flex-shrink: 0;
        }

        :where(.course-name) {
          flex: 1;
          font-size: 14px;
          color: var(--el-text-color-regular);
        }

        :where(.course-badge) {
          font-size: 12px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: var(--global-border-radius);

          &.new {
            color: var(--el-color-success);
            background: var(--el-color-success-light-9);
          }
        }
      }
    }
  }
}

@keyframes course-fade-in {
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

// ===== AI工具展示 - 极简卡片式 =====
:where(.ai-tools-overview) {
  margin-bottom: 140px;

  .tools-intro {
    margin-bottom: 56px;

    h2 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
      letter-spacing: -0.02em;
    }

    p {
      font-size: 15px;
      color: var(--el-text-color-secondary);
      line-height: 1.7;
      max-width: 600px;
    }
  }

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 56px;

    @include bp.tablet-down {
      grid-template-columns: repeat(2, 1fr);
    }

    @include bp.mobile-only {
      grid-template-columns: 1fr;
    }
  }

  .tool-category {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 24px;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--el-border-color);

      h3 {
        color: $accent-blue;
      }
    }

    h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: var(--unified-border-bottom);
      transition: color 0.2s ease;
    }

    .tool-items {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tool-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--global-border-radius);
      transition: background 0.15s ease;

      &:hover {
        background: var(--el-fill-color-lighter);

        .el-icon {
          color: $accent-blue;
        }
      }

      .el-icon {
        color: var(--el-text-color-placeholder);
        font-size: 16px;
        flex-shrink: 0;
        transition: color 0.15s ease;
      }

      span {
        font-size: 13px;
        color: var(--el-text-color-regular);
      }
    }
  }

  .partners-section {
    text-align: center;
    overflow: hidden;

    h3 {
      font-size: 14px;
      font-weight: 700;
      color: var(--el-text-color-secondary);
      margin-bottom: 24px;
    }

    .partners-marquee {
      position: relative;

      &::before,
      &::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        width: 80px;
        z-index: calc(var(--z-base) + 1);
        pointer-events: none;
      }

      &::before {
        left: 0;
        background: var(--el-bg-color-page);
      }

      &::after {
        right: 0;
        background: var(--el-bg-color-page);
      }
    }

    .marquee-track {
      overflow: hidden;
    }

    .marquee-content {
      display: flex;
      gap: 32px;
      animation: marquee-scroll 30s linear infinite;
      width: fit-content;

      &:hover {
        animation-play-state: paused;
      }
    }

    .partner-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      background: var(--el-bg-color);
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      transition: all 0.3s ease;
      flex-shrink: 0;

      &:hover {
        border-color: $accent-blue;
        transform: translateY(-2px);
      }

      :where(.partner-logo) {
        width: 32px;
        height: 32px;
        border-radius: var(--global-border-radius);
        background: rgba($accent-blue, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;

        :where(.partner-initial) {
          font-family: var(--font-family-mono);
          font-size: 14px;
          font-weight: 800;
          color: $accent-blue;
        }
      }

      .partner-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }
    }
  }
}

@keyframes marquee-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

// ===== 加入区块 - 极简CTA风格 =====
:where(.join-section) {
  margin-bottom: 80px;

  .join-card {
    background: var(--el-fill-color-lighter);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 64px 48px;

    @include bp.mobile-only {
      padding: 40px 24px;
      border-radius: var(--global-border-radius);
    }
  }

  .join-header {
    text-align: center;
    margin-bottom: 48px;

    h2 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
      letter-spacing: -0.02em;
    }

    p {
      font-size: 15px;
      color: var(--el-text-color-secondary);
    }
  }

  .pricing-comparison {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 48px;

    @include bp.mobile-only {
      flex-direction: column;
      align-items: center;
    }
  }

  .price-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 40px;
    border-radius: var(--global-border-radius);
    position: relative;
    transition: all 0.2s ease;

    &.original {
      background: var(--el-fill-color-light);

      :where(.price-value) {
        text-decoration: line-through;
        color: var(--el-text-color-placeholder);
      }
    }

    &.early-bird {
      background: var(--el-color-black);
      border: var(--unified-border);

      &:hover {
        transform: translateY(-2px);
        border-color: rgb(var(--el-color-success-rgb), 0.5);
      }

      :where(.price-badge) {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        font-family: var(--font-family-mono);
        font-size: 12px;
        font-weight: 600;
        color: var(--el-color-black);
        background: var(--el-color-success);
        padding: 4px 12px;
        border-radius: var(--global-border-radius);
        letter-spacing: 0.5px;
      }

      :where(.price-label) {
        color: rgb(var(--el-color-white-rgb), 0.6);
      }

      :where(.price-value) {
        color: var(--el-color-white);
      }

      :where(.price-unit) {
        color: rgb(var(--el-color-white-rgb), 0.5);
      }
    }

    :where(.price-label) {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 8px;
      font-weight: 500;
    }

    :where(.price-value) {
      font-family: var(--font-family-mono);
      font-size: 36px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      letter-spacing: -0.02em;
    }

    :where(.price-unit) {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
    }

    :where(.price-note) {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      margin-top: 8px;
    }
  }

  .join-benefits {
    margin-bottom: 48px;

    h3 {
      font-size: 18px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      margin-bottom: 24px;
      text-align: center;
    }

    :where(.benefits-list) {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;

      @include bp.tablet-down {
        grid-template-columns: repeat(2, 1fr);
      }

      @include bp.mobile-only {
        grid-template-columns: 1fr;
      }
    }

    :where(.benefit-item) {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--el-fill-color-extra-light);
      border-radius: var(--global-border-radius);

      .el-icon {
        color: $accent-blue;
        flex-shrink: 0;
      }

      span {
        font-size: 14px;
        color: var(--el-text-color-regular);
      }
    }
  }

  .join-cta {
    text-align: center;

    :deep(.el-button) {
      padding: 16px 48px;
      font-weight: 700;
    }

    .join-hint {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      margin-top: 16px;
    }
  }
}

.enterprise-footer {
  padding: 60px 0;
  border-top: var(--unified-border);
  display: flex;
  justify-content: space-between;
  align-items: center;

  @include bp.tablet-down {
    flex-direction: column;
    gap: 32px;
    text-align: center;
  }

  .footer-info {
    .company-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      margin-bottom: 8px;
    }

    .company-location {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin: 0;
    }
  }

  .quick-nav {
    display: flex;
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

// ===== 暗色模式适配 - 增强版 =====
html.dark {
  .enterprise-service-page {
    --dark-card-bg: rgb(var(--el-color-white-rgb), 0.03);
    --dark-card-hover: rgb(var(--el-color-white-rgb), 0.06);
    --dark-border: var(--border-unified-color);
    --dark-glow: rgba(#{$accent-purple}, 0.15);
  }

  .enterprise-bg {
    .gradient-layer {
      background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
    }

    :where(.floating-particles) .particle {
      opacity: 0.15;
    }

    .svg-decorations {
      opacity: 0.6;

      :where(.deco-ring) {
        opacity: 0.5;
      }

      :where(.deco-dots) {
        opacity: 0.4;
      }
    }
  }

  .scroll-progress-bar {
    background: $accent-blue;
    opacity: 0.8;
  }

  .side-nav {
    background: rgb(var(--el-color-black-rgb), 0.6);
    backdrop-filter: blur(12px);
    border-color: rgb(var(--el-color-white-rgb), 0.08);

    :where(.side-nav-item) {
      &.is-active :where(.side-nav-dot) {
        background: $accent-blue;
        border: 2px solid var(--border-unified-color);
      }
    }
  }

  .enterprise-nav .version-tag {
    background: rgba($accent-blue, 0.1);
    border-color: rgba($accent-blue, 0.3);
  }

  .enterprise-hero {
    :where(.hero-label) .label-line {
      background: rgb(var(--el-color-white-rgb), 0.15);
    }

    :where(.hero-stats) {
      .stat-divider {
        background: rgb(var(--el-color-white-rgb), 0.08);
      }

      .stat-badge {
        background: rgb(var(--el-color-success-rgb), 0.15);
        border-color: rgb(var(--el-color-success-rgb), 0.3);
      }
    }

    .cta-primary {
      background: var(--el-color-white);
      color: var(--el-color-black);

      &:hover {
        background: rgb(var(--el-color-white-rgb), 0.9);
      }
    }

    .cta-secondary {
      border-color: rgb(var(--el-color-white-rgb), 0.2);
      color: var(--el-text-color-primary);

      &:hover {
        border-color: rgb(var(--el-color-white-rgb), 0.4);
        background: rgb(var(--el-color-white-rgb), 0.05);
      }
    }
  }

  .section-label::before {
    background: $accent-blue;
  }

  .module-card {
    background: var(--dark-card-bg);
    border-color: var(--dark-border);

    &::before {
      background: color-mix(in srgb, var(--el-color-primary) 4%, transparent);
    }

    &:hover,
    &.is-hovered {
      background: var(--dark-card-hover);
      border-color: rgba($accent-blue, 0.3);

      :where(.module-glow) {
        background: $accent-blue;
        opacity: 0.8;
      }
    }
  }

  .layer-card {
    background: var(--dark-card-bg);
    border-color: var(--dark-border);

    &:hover {
      border-color: rgb(var(--el-color-white-rgb), 0.15);

      .layer-header {
        background: rgb(var(--el-color-white-rgb), 0.04);
      }
    }

    .layer-header {
      background: rgb(var(--el-color-white-rgb), 0.02);
      border-color: var(--dark-border);
    }
  }

  .course-phase-selector {
    background: var(--dark-card-bg);
    border-color: var(--dark-border);

    :where(.phase-btn) {
      &:hover:not(.active) {
        background: rgb(var(--el-color-white-rgb), 0.03);
      }

      &.active {
        background: rgb(var(--el-color-white-rgb), 0.08);
        border-color: rgb(var(--el-color-white-rgb), 0.15);

        :where(.phase-number) {
          background: var(--el-color-white);
          color: var(--el-color-black);
        }
      }
    }
  }

  .timeline-phase :where(.phase-content) {
    background: var(--dark-card-bg);

    :where(.course-item) {
      background: rgb(var(--el-color-white-rgb), 0.02);

      &:hover {
        background: rgb(var(--el-color-white-rgb), 0.05);
      }
    }
  }

  .quadrant-card {
    background: var(--dark-card-bg);
    border-color: var(--dark-border);

    &:hover {
      background: var(--dark-card-hover);
      border-color: rgb(var(--el-color-white-rgb), 0.15);

      :where(.quadrant-header .q-number) {
        background: $accent-blue;
      }
    }
  }

  .tool-category {
    background: var(--dark-card-bg);
    border-color: var(--dark-border);

    &:hover {
      background: var(--dark-card-hover);
      border-color: rgb(var(--el-color-white-rgb), 0.15);
    }

    .tool-item:hover {
      background: rgb(var(--el-color-white-rgb), 0.04);
    }
  }

  .partners-marquee {
    .partner-item {
      background: var(--dark-card-bg);
      border-color: var(--dark-border);

      &:hover {
        background: var(--dark-card-hover);
      }
    }
  }

  .join-section .join-card {
    background: var(--color-white-2);
    border-color: var(--dark-border);

    :where(.price-card.early-bird) {
      background: var(--el-color-white);

      :where(.price-badge) {
        background: var(--el-color-success);
        color: var(--el-color-white);
      }

      :where(.price-label),
      :where(.price-unit) {
        color: var(--el-text-color-secondary);
      }

      :where(.price-value) {
        color: var(--el-color-black);
      }
    }
  }

  .enterprise-cta .cta-primary {
    &:hover {
      border-color: rgba($accent-purple, 0.5);
    }
  }
}
</style>
