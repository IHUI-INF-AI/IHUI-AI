<template>
  <div class="open-platform-container" :class="{ 'mouse-active': isMouseInViewport }">
    <!-- 滚动进度条（装饰性，对读屏隐藏） -->
    <div class="scroll-progress-bar" :style="{ transform: `scaleX(${scrollProgress})` }" aria-hidden="true"></div>

    <!-- 1. 背景效果层 - 增强版（装饰性） -->
    <div class="bg-effects" aria-hidden="true">
      <div class="glow-sphere glow-1"></div>
      <div class="glow-sphere glow-2"></div>
      <div class="noise-texture"></div>
      <!-- 浮动光球 -->
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
      <!-- 动态流动线条 -->
      <div class="dynamic-flows">
        <div v-for="i in 8" :key="i" class="flow-line" :style="flowStyles[i - 1] ?? {}"></div>
      </div>
      <!-- 鼠标跟随光效 -->
      <div class="mouse-glow-effect"></div>
    </div>

    <!-- 2. Hero 区域 -->
    <section class="hero-section op-content-layer" aria-labelledby="hero-title">
      <div class="container hero-wrapper">
        <div class="hero-content hero-content-visible">
          <div class="hero-tag-group">
            <span class="hero-tag pulse-glow">{{ t('openPlatform.tags.selfDeveloped') }}</span>
            <span class="hero-tag">{{ t('openPlatform.tags.openApi') }}</span>
            <span class="hero-tag secondary">{{ t('openPlatform.tags.stableVersion') }}</span>
          </div>
          <h1 id="hero-title" class="hero-title">
            <span class="hero-title-brand">{{ t('openPlatform.hero.titleBrand') }}</span>
            <span class="hero-title-line">{{ t('openPlatform.hero.title') }}<span class="accent-text gradient-text-animated">{{ currentTypingText }}</span><span class="cursor">_</span></span>
          </h1>
          <h2 class="hero-subtitle-en font-edix">{{ t('openPlatform.hero.subtitleEn') }}</h2>
          <p class="hero-description">{{ t('openPlatform.hero.description') }}</p>
          <p class="hero-arch-line" aria-hidden="true">{{ t('openPlatform.hero.archLine') }}</p>
          <div class="hero-actions">
            <button
              class="cta-btn primary ripple-btn"
              :aria-label="t('openPlatform.buttons.getStarted')"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); scrollToFeatureHub() }"
            >
              <span class="btn-text">{{ t('openPlatform.buttons.getStarted') }}</span>
              <el-icon><ArrowRight /></el-icon>
              <span class="btn-glow"></span>
            </button>
            <button
              class="cta-btn ghost ripple-btn"
              :aria-label="t('openPlatform.buttons.techSpecs')"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); goToDocs() }"
            >
              <span class="btn-text">{{ t('openPlatform.buttons.techSpecs') }}</span>
            </button>
            <button
              class="cta-btn ghost ripple-btn"
              :aria-label="t('openPlatform.buttons.learnArch')"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); scrollToIhuiArch() }"
            >
              <span class="btn-text">{{ t('openPlatform.buttons.learnArch') }}</span>
              <el-icon><ArrowRight /></el-icon>
            </button>
          </div>
        </div>

        <!-- 实时监控看板 -->
        <div class="hero-monitor">
          <div
            v-for="(stat, index) in stats"
            :key="stat.label"
            class="monitor-card glass scroll-reveal glow-border"
            :data-delay="Number(index) * 100"
            data-animation="fadeInUp"
          >
            <div class="monitor-header">
              <span class="pulse-dot"></span>
              <span class="monitor-label">{{ stat.label }}</span>
            </div>
            <div class="monitor-value font-edix gradient-text">{{ stat.value }}</div>
            <div class="monitor-trend">
              <el-icon><Lightning /></el-icon>
              <span>{{ t('openPlatform.status.running') }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2.5 自研 IHUI AI 架构与智汇 API（首屏后第一焦点） -->
    <section class="ihui-arch-section ihui-arch-section--featured" id="ihui-arch" aria-labelledby="ihui-arch-title">
      <div class="container">
        <div class="section-header text-center scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.ihuiArch') }}</span>
          <h2 id="ihui-arch-title" class="section-title ihui-arch-section__main-title">{{ t('openPlatform.ihuiArch.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.ihuiArch.subtitleEn') }}</h3>
          <p class="ihui-arch-lead">{{ t('openPlatform.ihuiArch.lead') }}</p>
        </div>
        <div class="ihui-arch-cards-wrap">
          <div class="ihui-arch-grid ihui-arch-grid--three">
            <div class="ihui-arch-card scroll-reveal" data-animation="fadeInUp" data-delay="0">
              <div class="ihui-arch-card__head">
                <span class="ihui-arch-card__badge">{{ t('openPlatform.ihuiArch.archBadge') }}</span>
                <h4 class="ihui-arch-card__title">{{ t('openPlatform.ihuiArch.archTitle') }}</h4>
              </div>
              <p class="ihui-arch-card__desc">{{ t('openPlatform.ihuiArch.archDesc') }}</p>
              <ul class="ihui-arch-card__list">
                <li>{{ t('openPlatform.ihuiArch.arch1') }}</li>
                <li>{{ t('openPlatform.ihuiArch.arch2') }}</li>
                <li>{{ t('openPlatform.ihuiArch.arch3') }}</li>
                <li>{{ t('openPlatform.ihuiArch.arch4') }}</li>
                <li>{{ t('openPlatform.ihuiArch.arch5') }}</li>
                <li>{{ t('openPlatform.ihuiArch.arch6') }}</li>
              </ul>
            </div>
            <div class="ihui-arch-card scroll-reveal" data-animation="fadeInUp" data-delay="100">
              <div class="ihui-arch-card__head">
                <span class="ihui-arch-card__badge">{{ t('openPlatform.ihuiArch.apiBadge') }}</span>
                <h4 class="ihui-arch-card__title">{{ t('openPlatform.ihuiArch.apiTitle') }}</h4>
              </div>
              <p class="ihui-arch-card__desc">{{ t('openPlatform.ihuiArch.apiDesc') }}</p>
              <ul class="ihui-arch-card__list">
                <li>{{ t('openPlatform.ihuiArch.api1') }}</li>
                <li>{{ t('openPlatform.ihuiArch.api2') }}</li>
                <li>{{ t('openPlatform.ihuiArch.api3') }}</li>
                <li>{{ t('openPlatform.ihuiArch.api4') }}</li>
                <li>{{ t('openPlatform.ihuiArch.api5') }}</li>
                <li>{{ t('openPlatform.ihuiArch.api6') }}</li>
              </ul>
            </div>
            <div class="ihui-arch-card ihui-arch-card--highlight scroll-reveal" data-animation="fadeInUp" data-delay="150">
              <div class="ihui-arch-card__head">
                <span class="ihui-arch-card__badge">{{ t('openPlatform.ihuiArch.highlightsBadge') }}</span>
                <h4 class="ihui-arch-card__title">{{ t('openPlatform.ihuiArch.highlightsTitle') }}</h4>
              </div>
              <p class="ihui-arch-card__desc">{{ t('openPlatform.ihuiArch.highlightsDesc') }}</p>
              <ul class="ihui-arch-card__list">
                <li>{{ t('openPlatform.ihuiArch.highlight1') }}</li>
                <li>{{ t('openPlatform.ihuiArch.highlight2') }}</li>
                <li>{{ t('openPlatform.ihuiArch.highlight3') }}</li>
                <li>{{ t('openPlatform.ihuiArch.highlight4') }}</li>
                <li>{{ t('openPlatform.ihuiArch.highlight5') }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. 技术管道 (Pipeline) -->
    <section id="pipeline" class="pipeline-section section-band" aria-labelledby="pipeline-title">
      <div class="container">
        <div class="section-header text-center scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.pipeline') }}</span>
          <h2 id="pipeline-title" class="section-title">{{ t('openPlatform.pipeline.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.pipeline.subtitleEn') }}</h3>
          <p class="pipeline-lead">{{ t('openPlatform.pipeline.lead') }}</p>
        </div>

        <div class="pipeline-visual glass">
          <div
            v-for="(step, index) in pipelineSteps"
            :key="step.title"
            class="pipeline-step scroll-reveal"
            :data-delay="Number(index) * 150"
            data-animation="fadeInUp"
          >
            <div class="step-icon-wrapper">
              <div class="step-icon pulse-glow"><el-icon :size="28"><component :is="step.icon" /></el-icon></div>
              <div v-if="Number(index) < pipelineSteps.length - 1" class="step-connector">
                <div class="connector-line"></div>
                <div class="connector-pulse"></div>
              </div>
            </div>
            <div class="step-content">
              <span class="step-tag">0{{ Number(index) + 1 }}</span>
              <h4>{{ step.title }}</h4>
              <p>{{ step.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. API 宇宙 (能力版图) -->
    <section id="api-matrix" class="api-universe-section section-band" aria-labelledby="api-matrix-title">
      <div class="container">
        <div class="section-header scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.apiMatrix') }}</span>
          <h2 id="api-matrix-title" class="section-title">{{ t('openPlatform.apiMatrix.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.apiMatrix.subtitleEn') }}</h3>
          <p class="api-matrix-lead">{{ t('openPlatform.apiMatrix.lead') }}</p>
        </div>

        <!-- 能力标签筛选 -->
        <div class="capability-tags-wrap scroll-reveal" data-animation="fadeInUp" role="group" :aria-label="t('openPlatform.capabilityTags.ariaFilterLabel')">
          <button
            v-for="tag in capabilityTags"
            :key="tag.id"
            type="button"
            class="capability-tag-btn"
            :class="{ active: selectedCapabilityTag === tag.id }"
            :aria-pressed="selectedCapabilityTag === tag.id"
            @click="selectedCapabilityTag = tag.id"
          >
            {{ t(tag.labelKey) }}
          </button>
        </div>

        <div class="api-grid">
          <div
            v-for="(api, index) in filteredApiUniverse"
            :key="api.title"
            class="api-card scroll-reveal glow-border"
            :data-delay="Number(index) * 100"
            data-animation="fadeInUp"
          >
            <div class="api-card-head">
              <div class="api-icon-box pulse-glow">
                <el-icon :size="24"><component :is="api.icon" /></el-icon>
              </div>
              <span class="api-status">{{ t('openPlatform.status.online') }}</span>
            </div>
            <h4 class="api-title">{{ api.title }}</h4>
            <p class="api-desc">{{ api.desc }}</p>
            <div class="api-footer">
              <span class="api-tag">{{ api.tagLabel }}</span>
              <span class="api-metrics">{{ t('openPlatform.metrics.latency') }} {{ api.latency }}</span>
            </div>
          </div>
        </div>

        <!-- 4.5 接口一览（智汇 API 主要端点，便于买方评估） -->
        <div id="api-list" class="api-list-block">
        <div class="section-header section-header--spaced scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.apiList') }}</span>
          <h2 class="section-title">{{ t('openPlatform.apiList.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.apiList.subtitleEn') }}</h3>
          <p class="api-matrix-lead">{{ t('openPlatform.apiList.lead') }}</p>
        </div>
        <div class="api-list-wrap scroll-reveal" data-animation="fadeInUp">
          <table class="api-list-table" role="table" :aria-label="t('openPlatform.apiList.title')">
            <thead>
              <tr>
                <th scope="col">{{ t('openPlatform.apiList.method') }}</th>
                <th scope="col">{{ t('openPlatform.apiList.path') }}</th>
                <th scope="col">{{ t('openPlatform.apiList.description') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ep in apiEndpoints" :key="ep.path">
                <td><code class="api-method">{{ ep.method }}</code></td>
                <td><code class="api-path">{{ ep.path }}</code></td>
                <td>
                  <span class="api-name">{{ t(ep.nameKey) }}</span>
                  <span class="api-desc">{{ t(ep.descKey) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </section>

    <!-- 5. 代码集成 (DX) -->
    <section id="dx" class="dx-section section-band" aria-labelledby="dx-title">
      <div class="container dx-wrapper">
        <div class="dx-info scroll-reveal" data-animation="fadeInLeft">
          <span class="section-idx">{{ t('openPlatform.sections.dx') }}</span>
          <h2 id="dx-title" class="section-title">{{ t('openPlatform.dx.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.dx.subtitleEn') }}</h3>
          <p class="dx-desc">{{ t('openPlatform.dx.description') }}</p>
          <ul class="dx-check-list">
            <li><el-icon class="check-icon"><Check /></el-icon>{{ t('openPlatform.dx.feature1') }}</li>
            <li><el-icon class="check-icon"><Check /></el-icon>{{ t('openPlatform.dx.feature2') }}</li>
            <li><el-icon class="check-icon"><Check /></el-icon>{{ t('openPlatform.dx.feature3') }}</li>
          </ul>
          <div class="sdk-marquee">
            <span v-for="sdk in sdks" :key="sdk" class="sdk-badge light-sweep">{{ sdk }}</span>
          </div>
        </div>

        <div class="dx-browser-wrapper scroll-reveal" data-animation="fadeInRight" data-delay="200">
          <div class="code-browser glass glow-border">
            <div class="browser-header">
              <div class="browser-dots"><span></span><span></span><span></span></div>
              <div class="browser-tabs" role="tablist" :aria-label="t('openPlatform.codeTabListLabel')">
                <button
                  v-for="tab in codeTabs"
                  :key="tab.id"
                  type="button"
                  class="browser-tab"
                  :class="{ active: activeCodeTab === tab.id }"
                  role="tab"
                  :aria-selected="activeCodeTab === tab.id"
                  :aria-label="tab.label"
                  @click="activeCodeTab = tab.id"
                >{{ tab.label }}</button>
              </div>
            </div>
            <div class="browser-body">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <pre class="code-content"><code v-html="currentCodeHtml"></code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. 行业场景 (Solutions) -->
    <section id="solutions" class="solutions-section" aria-labelledby="solutions-title">
      <div class="container">
        <div class="section-header text-center scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.solutions') }}</span>
          <h2 id="solutions-title" class="section-title">{{ t('openPlatform.solutions.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.solutions.subtitleEn') }}</h3>
        </div>

        <div class="solutions-grid">
          <div
            v-for="(solution, index) in solutions"
            :key="solution.title"
            class="solution-item glass scroll-reveal"
            :data-delay="Number(index) * 150"
            data-animation="fadeInUp"
            role="group"
            :aria-labelledby="`solution-title-${index}`"
          >
            <div class="solution-visual">
              <img
                :src="solution.image"
                :alt="solution.title"
                crossorigin="anonymous"
                loading="lazy"
                decoding="async"
                @error="handleImageError"
              >
              <div class="visual-mask"></div>
            </div>
            <div class="solution-content">
              <h4 :id="`solution-title-${index}`">{{ solution.title }}</h4>
              <p>{{ solution.desc }}</p>
              <div class="solution-link" aria-hidden="true">
                <span>{{ t('openPlatform.solutions.explore') }}</span>
                <el-icon><ArrowRight /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 7. 功能中心入口 -->
    <section class="feature-hub-section section-band" id="feature-hub" aria-labelledby="feature-hub-title">
      <div class="container">
        <div class="section-header text-center scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.featureHub') }}</span>
          <h2 id="feature-hub-title" class="section-title">{{ t('openPlatform.featureHub.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.featureHub.subtitleEn') }}</h3>
        </div>
        <div class="feature-hub-grid">
          <div
            v-for="(feature, index) in featureHub"
            :key="feature.title"
            class="feature-hub-card glass scroll-reveal glow-border"
            :data-delay="Number(index) * 80"
            data-animation="fadeInUp"
            role="button"
            tabindex="0"
            :aria-label="feature.title"
            @click="router.push(feature.route)"
            @keydown.enter.prevent="router.push(feature.route)"
            @keydown.space.prevent="router.push(feature.route)"
          >
            <div class="feature-hub-icon pulse-glow">
              <el-icon :size="28"><component :is="feature.icon" /></el-icon>
            </div>
            <div class="feature-hub-content">
              <h4>{{ feature.title }}</h4>
              <p>{{ feature.desc }}</p>
            </div>
            <div class="feature-hub-arrow">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 8. 生态支持 (保留3个资源链接) -->
    <section id="ecosystem" class="ecosystem-section" aria-labelledby="ecosystem-title">
      <div class="container">
        <div class="section-header scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.ecosystem') }}</span>
          <h2 id="ecosystem-title" class="section-title">{{ t('openPlatform.ecosystem.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.ecosystem.subtitleEn') }}</h3>
        </div>
        <div class="ecosystem-grid">
          <div
            class="ecosystem-card scroll-reveal glow-border"
            v-for="(item, index) in ecosystem"
            :key="item.title"
            :data-delay="Number(index) * 100"
            data-animation="fadeInUp"
          >
            <div class="eco-icon pulse-glow"><el-icon><component :is="item.icon" /></el-icon></div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.desc }}</p>
            <template v-if="item.link">
              <a v-if="isExternalLink(item.link)" :href="item.link" target="_blank" rel="noopener noreferrer" class="eco-link">{{ item.linkText }} <el-icon><ArrowRight /></el-icon></a>
              <router-link v-else :to="item.link" class="eco-link">{{ item.linkText }} <el-icon><ArrowRight /></el-icon></router-link>
            </template>
          </div>
        </div>

        <!-- 文档与资源聚合 -->
        <div class="section-header section-header--spaced-sm scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.docLinks') }}</span>
          <h2 class="section-title">{{ t('openPlatform.docLinks.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.docLinks.subtitleEn') }}</h3>
        </div>
        <div class="doc-links-wrap scroll-reveal" data-animation="fadeInUp">
          <component
            :is="link.internal ? 'router-link' : 'a'"
            v-for="link in docLinks"
            :key="link.labelKey"
            :to="link.internal ? link.href : undefined"
            :href="link.internal ? undefined : link.href"
            :target="link.internal ? undefined : '_blank'"
            :rel="link.internal ? undefined : 'noopener noreferrer'"
            class="doc-link-item"
            :aria-label="t(link.labelKey)"
          >
            <span class="doc-link-label">{{ t(link.labelKey) }}</span>
            <el-icon><ArrowRight /></el-icon>
          </component>
        </div>
      </div>
    </section>

    <!-- 8.5 购买与许可说明 -->
    <section class="sale-license-section sl" id="sale-license" aria-labelledby="sale-license-title">
      <div class="sl__container">
        <div class="section-header text-center sl__head scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx sl__label">{{ t('openPlatform.sections.sale') }}</span>
          <h2 id="sale-license-title" class="section-title sl__title">{{ t('openPlatform.sale.sectionTitle') }}</h2>
          <h3 class="section-subtitle-en font-edix sl__sub">{{ t('openPlatform.sale.sectionSubtitleEn') }}</h3>
        </div>

        <div class="sale-content sl__body">
          <!-- 售卖区快捷锚点导航 -->
          <nav id="sale-nav" class="sl-nav scroll-reveal" data-animation="fadeInUp" :aria-label="t('openPlatform.sale.navAriaLabel')">
            <a href="#sale-intro" class="sl-nav__link">{{ t('openPlatform.sale.navIntro') }}</a>
            <a href="#sale-who" class="sl-nav__link">{{ t('openPlatform.sale.navWho') }}</a>
            <a href="#sale-usecases" class="sl-nav__link">{{ t('openPlatform.sale.navUseCases') }}</a>
            <a href="#sale-why" class="sl-nav__link">{{ t('openPlatform.sale.navWhy') }}</a>
            <a href="#sale-pricing" class="sl-nav__link">{{ t('openPlatform.sale.navPricing') }}</a>
            <a href="#sale-pricing-compare" class="sl-nav__link">{{ t('openPlatform.sections.pricingCompare') }}</a>
            <a href="#sale-advantages" class="sl-nav__link">{{ t('openPlatform.sale.navAdvantages') }}</a>
            <a href="#sale-cases" class="sl-nav__link">{{ t('openPlatform.sale.navCases') }}</a>
            <a href="#sale-rules" class="sl-nav__link">{{ t('openPlatform.sale.navRules') }}</a>
            <a href="#sale-compare" class="sl-nav__link">{{ t('openPlatform.sale.navCompare') }}</a>
            <a href="#sale-faq" class="sl-nav__link">{{ t('openPlatform.sale.navFaq') }}</a>
            <a href="#feature-ref" class="sl-nav__link">{{ t('openPlatform.sections.featureRef') }}</a>
            <a href="#feature-table" class="sl-nav__link">{{ t('openPlatform.sections.featureTable') }}</a>
          </nav>

          <!-- 产品说明（置顶，快速建立认知） -->
          <div id="sale-intro" class="sale-block sl-card scroll-reveal" data-animation="fadeInUp">
            <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.sale.introTitle') }}</h4>
            <p class="sale-block-desc sl-card__p">{{ t('openPlatform.sale.introDesc') }}</p>
            <p class="sale-block-desc sl-card__p">{{ t('openPlatform.sale.introDesc2') }}</p>
            <p class="sale-block-desc sl-card__p">{{ t('openPlatform.sale.introDesc3') }}</p>
          </div>

          <!-- 适合谁使用 -->
          <div id="sale-who" class="sale-block sl-card scroll-reveal" data-animation="fadeInUp" data-delay="30">
            <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.sale.whoIsItForTitle') }}</h4>
            <ul class="sale-rules-list sl-card__list">
              <li>{{ t('openPlatform.sale.whoIsItFor1') }}</li>
              <li>{{ t('openPlatform.sale.whoIsItFor2') }}</li>
              <li>{{ t('openPlatform.sale.whoIsItFor3') }}</li>
              <li>{{ t('openPlatform.sale.whoIsItFor4') }}</li>
            </ul>
          </div>

          <!-- 典型使用场景（数据驱动） -->
          <div id="sale-usecases" class="sale-block sl-card scroll-reveal" data-animation="fadeInUp" data-delay="40">
            <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.sale.useCasesTitle') }}</h4>
            <ul class="sale-rules-list sl-card__list">
              <li v-for="key in useCaseKeys" :key="key">{{ t(key) }}</li>
            </ul>
          </div>

          <!-- 为什么选择我们（定价前强化卖点） -->
          <div id="sale-why" class="sale-block sl-why-choose scroll-reveal" data-animation="fadeInUp" data-delay="45">
            <h4 class="sale-block-title sl-why-choose__title">{{ t('openPlatform.sale.whyChooseTitle') }}</h4>
            <ul class="sl-why-choose__list">
              <li>{{ t('openPlatform.sale.whyChoose1') }}</li>
              <li>{{ t('openPlatform.sale.whyChoose2') }}</li>
              <li>{{ t('openPlatform.sale.whyChoose3') }}</li>
              <li>{{ t('openPlatform.sale.whyChoose4') }}</li>
              <li>{{ t('openPlatform.sale.whyChoose5') }}</li>
              <li>{{ t('openPlatform.sale.whyChoose6') }}</li>
              <li>{{ t('openPlatform.sale.whyChoose7') }}</li>
            </ul>
          </div>

          <!-- 定价（提前展示，促进决策） -->
          <div id="sale-pricing" class="sale-block sl-pricing scroll-reveal" data-animation="fadeInUp" data-delay="50">
            <h4 class="sale-block-title sl-pricing__title">{{ t('openPlatform.sale.pricingTitle') }}</h4>
            <p class="sale-block-sub sl-pricing__sub">{{ t('openPlatform.sale.pricingSubtitle') }}</p>
            <div class="pricing-cards sl-plan-grid">
              <div class="pricing-card sl-plan">
                <div class="pricing-card-name sl-plan__name">{{ t('openPlatform.sale.planFree') }}</div>
                <p class="pricing-card-desc sl-plan__desc">{{ t('openPlatform.sale.planFreeDesc') }}</p>
                <div class="pricing-card-price sl-plan__price">{{ t('openPlatform.sale.planPriceFree') }}</div>
                <p class="pricing-features-title sl-plan__features-head">{{ t('openPlatform.sale.pricingFeaturesTitle') }}</p>
                <ul class="pricing-features-list sl-plan__features">
                  <li v-for="key in planFreeFeatureKeys" :key="key">{{ t(`data.open_platform.${key}`) }}</li>
                </ul>
                <button type="button" class="sl-plan__cta cta-btn ghost ripple-btn" :aria-label="t('openPlatform.sale.planFreeCta')" @click="(e) => { createRipple(e, (e.currentTarget as HTMLElement)); scrollToFeatureHub() }">{{ t('openPlatform.sale.planFreeCta') }}</button>
              </div>
              <div class="pricing-card sl-plan sl-plan--recommended">
                <span class="pricing-card-badge sl-plan__badge">{{ t('openPlatform.sale.recommended') }}</span>
                <div class="pricing-card-name sl-plan__name">{{ t('openPlatform.sale.planStandard') }}</div>
                <p class="pricing-card-desc sl-plan__desc">{{ t('openPlatform.sale.planStandardDesc') }}</p>
                <div class="pricing-card-price sl-plan__price">{{ t('openPlatform.sale.planPriceStandard') }}</div>
                <p class="pricing-features-title sl-plan__features-head">{{ t('openPlatform.sale.pricingFeaturesTitle') }}</p>
                <ul class="pricing-features-list sl-plan__features">
                  <li v-for="key in planStandardFeatureKeys" :key="key">{{ t(`data.open_platform.${key}`) }}</li>
                </ul>
                <button type="button" class="sl-plan__cta cta-btn primary ripple-btn" :aria-label="t('openPlatform.sale.planStandardCta')" @click="(e) => { createRipple(e, (e.currentTarget as HTMLElement)); goToContact() }">{{ t('openPlatform.sale.planStandardCta') }}</button>
              </div>
              <div class="pricing-card sl-plan">
                <div class="pricing-card-name sl-plan__name">{{ t('openPlatform.sale.planEnterprise') }}</div>
                <p class="pricing-card-desc sl-plan__desc">{{ t('openPlatform.sale.planEnterpriseDesc') }}</p>
                <div class="pricing-card-price sl-plan__price">{{ t('openPlatform.sale.planPriceEnterprise') }}</div>
                <p class="pricing-features-title sl-plan__features-head">{{ t('openPlatform.sale.pricingFeaturesTitle') }}</p>
                <ul class="pricing-features-list sl-plan__features">
                  <li v-for="key in planEnterpriseFeatureKeys" :key="key">{{ t(`data.open_platform.${key}`) }}</li>
                </ul>
                <button type="button" class="sl-plan__cta cta-btn primary ripple-btn" :aria-label="t('openPlatform.sale.planEnterpriseCta')" @click="(e) => { createRipple(e, (e.currentTarget as HTMLElement)); goToContact() }">{{ t('openPlatform.sale.planEnterpriseCta') }}</button>
              </div>
            </div>
            <p class="sale-contact-note sl-pricing__note">{{ t('openPlatform.sale.contactPrice') }}</p>
            <div class="sl-pricing__cta">
              <button
                type="button"
                class="cta-btn primary ripple-btn sl-pricing__btn"
                :aria-label="t('openPlatform.sale.contactBusiness')"
                @click="(e) => { createRipple(e, (e.currentTarget as HTMLElement)); goToContact() }"
              >
                <span class="btn-text">{{ t('openPlatform.sale.contactBusiness') }}</span>
                <el-icon><ArrowRight /></el-icon>
              </button>
              <a
                href="https://github.com/ihui-ai"
                target="_blank"
                rel="noopener noreferrer"
                class="cta-btn ghost ripple-btn sl-pricing__btn"
                :aria-label="t('openPlatform.sale.viewGitHub')"
              >
                <span class="btn-text">{{ t('openPlatform.sale.viewGitHub') }}</span>
                <el-icon><ArrowRight /></el-icon>
              </a>
            </div>
          </div>

          <!-- 定价对比表 -->
          <div id="sale-pricing-compare" class="sale-block sl-card scroll-reveal" data-animation="fadeInUp" data-delay="55">
              <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.pricingCompare.title') }}</h4>
              <p class="sale-block-sub sl-card__sub">{{ t('openPlatform.pricingCompare.lead') }}</p>
              <div class="pricing-compare-wrap">
                <table class="pricing-compare-table" role="table" :aria-label="t('openPlatform.pricingCompare.title')">
                  <thead>
                    <tr>
                      <th scope="col">{{ t('openPlatform.pricingCompare.feature') }}</th>
                      <th scope="col">{{ t('openPlatform.pricingCompare.free') }}</th>
                      <th scope="col">{{ t('openPlatform.pricingCompare.standard') }}</th>
                      <th scope="col">{{ t('openPlatform.pricingCompare.enterprise') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in pricingComparisonRows" :key="row.featureKey">
                      <td>{{ t(row.featureKey) }}</td>
                      <td>{{ row.free ? t('openPlatform.pricingCompare.yes') : t('openPlatform.pricingCompare.no') }}</td>
                      <td>{{ row.standard ? t('openPlatform.pricingCompare.yes') : t('openPlatform.pricingCompare.no') }}</td>
                      <td>{{ row.enterprise ? t('openPlatform.pricingCompare.yes') : t('openPlatform.pricingCompare.no') }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
          </div>

          <!-- 产品全貌与优势（定价后展开细节） -->
          <div id="sale-advantages" class="sale-block sale-block-advantages sl-bento scroll-reveal" data-animation="fadeInUp" data-delay="60">
            <div class="sl-bento__intro">
              <h4 class="sale-block-title sl-bento__title">{{ t('data.open_platform.advantagesTitle') }}</h4>
              <p class="sale-block-sub advantages-subtitle sl-bento__tag">{{ t('data.open_platform.advantagesSubtitle') }}</p>
              <p class="sale-block-desc sl-bento__lead">{{ t('data.open_platform.advantagesIntro') }}</p>
            </div>
            <div class="advantages-grid sl-bento__grid">
              <div class="advantages-col sl-bento__col">
                <h5 class="advantages-col-title sl-bento__col-title">{{ t('data.open_platform.advantagesArchTitle') }}</h5>
                <ul class="sale-rules-list sl-bento__list">
                  <li>{{ t('data.open_platform.advantagesArchItem1') }}</li>
                  <li>{{ t('data.open_platform.advantagesArchItem2') }}</li>
                  <li>{{ t('data.open_platform.advantagesArchItem3') }}</li>
                  <li>{{ t('data.open_platform.advantagesArchItem4') }}</li>
                </ul>
              </div>
              <div class="advantages-col sl-bento__col">
                <h5 class="advantages-col-title sl-bento__col-title">{{ t('data.open_platform.advantagesModulesTitle') }}</h5>
                <ul class="sale-rules-list sl-bento__list">
                  <li>{{ t('data.open_platform.advantagesModulesItem1') }}</li>
                  <li>{{ t('data.open_platform.advantagesModulesItem2') }}</li>
                  <li>{{ t('data.open_platform.advantagesModulesItem3') }}</li>
                  <li>{{ t('data.open_platform.advantagesModulesItem4') }}</li>
                </ul>
              </div>
              <div class="advantages-col sl-bento__col">
                <h5 class="advantages-col-title sl-bento__col-title">{{ t('data.open_platform.advantagesHighlightsTitle') }}</h5>
                <ul class="sale-rules-list sl-bento__list">
                  <li>{{ t('data.open_platform.advantagesHighlight1') }}</li>
                  <li>{{ t('data.open_platform.advantagesHighlight2') }}</li>
                  <li>{{ t('data.open_platform.advantagesHighlight3') }}</li>
                  <li>{{ t('data.open_platform.advantagesHighlight4') }}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 客户/行业案例 -->
          <div id="sale-cases" class="sale-block sl-cases scroll-reveal" data-animation="fadeInUp" data-delay="70">
            <h4 class="sale-block-title sl-cases__title">{{ t('openPlatform.sale.casesTitle') }}</h4>
            <p class="sale-block-sub sl-cases__sub">{{ t('openPlatform.sale.casesSubtitle') }}</p>
            <div class="sl-cases__grid">
              <div v-for="(c, i) in customerCaseKeys" :key="i" class="sl-cases__card">
                <span class="sl-cases__card-tag">{{ t(c.tagKey) }}</span>
                <h5 class="sl-cases__card-title">{{ t(c.titleKey) }}</h5>
                <p class="sl-cases__card-desc">{{ t(c.descKey) }}</p>
              </div>
            </div>
          </div>

          <!-- 售卖规则 -->
          <div id="sale-rules" class="sale-block sl-card scroll-reveal" data-animation="fadeInUp" data-delay="100">
            <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.sale.rulesTitle') }}</h4>
            <p class="sale-block-sub sl-card__sub">{{ t('openPlatform.sale.rulesSubtitle') }}</p>
            <ul class="sale-rules-list sl-card__list">
              <li>{{ t('openPlatform.sale.rule1') }}</li>
              <li>{{ t('openPlatform.sale.rule2') }}</li>
              <li>{{ t('openPlatform.sale.rule3') }}</li>
              <li>{{ t('openPlatform.sale.rule4') }}</li>
              <li>{{ t('openPlatform.sale.rule5') }}</li>
            </ul>
          </div>

          <!-- 开源协议 -->
          <div class="sale-block sl-card scroll-reveal" data-animation="fadeInUp" data-delay="150">
            <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.sale.licenseTitle') }}</h4>
            <p class="sale-block-sub sl-card__sub">{{ t('openPlatform.sale.licenseSubtitle') }}</p>
            <div class="license-name sl-card__name">{{ t('openPlatform.sale.licenseName') }}</div>
            <p class="sale-block-desc sl-card__p">{{ t('openPlatform.sale.licenseSummary') }}</p>
            <a href="https://github.com/ihui-ai" target="_blank" rel="noopener noreferrer" class="sale-link sl-link">{{ t('openPlatform.sale.licenseLinkText') }} <el-icon><ArrowRight /></el-icon></a>
          </div>

          <!-- 交付与支持 -->
          <div class="sale-block sl-card scroll-reveal" data-animation="fadeInUp" data-delay="200">
            <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.sale.deliveryTitle') }}</h4>
            <p class="sale-block-sub sl-card__sub">{{ t('openPlatform.sale.deliverySubtitle') }}</p>
            <ul class="sale-rules-list sl-card__list">
              <li>{{ t('openPlatform.sale.delivery1') }}</li>
              <li>{{ t('openPlatform.sale.delivery2') }}</li>
              <li>{{ t('openPlatform.sale.delivery3') }}</li>
              <li>{{ t('openPlatform.sale.delivery4') }}</li>
            </ul>
          </div>

          <!-- 与自建/SaaS/开源对比（结构化） -->
          <div id="sale-compare" class="sale-block sl-compare scroll-reveal" data-animation="fadeInUp" data-delay="220">
            <h4 class="sale-block-title sl-compare__title">{{ t('openPlatform.sale.comparisonTitle') }}</h4>
            <p class="sale-block-desc sl-compare__intro">{{ t('openPlatform.sale.comparisonDesc') }}</p>
            <div class="sl-compare__grid">
              <div class="sl-compare__card">
                <h5 class="sl-compare__card-title">{{ t('openPlatform.sale.compareVsSelfTitle') }}</h5>
                <ul class="sl-compare__list">
                  <li>{{ t('openPlatform.sale.compareVsSelf1') }}</li>
                  <li>{{ t('openPlatform.sale.compareVsSelf2') }}</li>
                </ul>
              </div>
              <div class="sl-compare__card">
                <h5 class="sl-compare__card-title">{{ t('openPlatform.sale.compareVsSaaSTitle') }}</h5>
                <ul class="sl-compare__list">
                  <li>{{ t('openPlatform.sale.compareVsSaaS1') }}</li>
                  <li>{{ t('openPlatform.sale.compareVsSaaS2') }}</li>
                </ul>
              </div>
              <div class="sl-compare__card">
                <h5 class="sl-compare__card-title">{{ t('openPlatform.sale.compareVsOpenTitle') }}</h5>
                <ul class="sl-compare__list">
                  <li>{{ t('openPlatform.sale.compareVsOpen1') }}</li>
                  <li>{{ t('openPlatform.sale.compareVsOpen2') }}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 购买与许可 FAQ（数据驱动） -->
          <div id="sale-faq" class="sale-block sl-card scroll-reveal" data-animation="fadeInUp" data-delay="230">
            <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.sale.saleFaqTitle') }}</h4>
            <div class="faq-mini-list sl-faq">
              <div v-for="(faq, idx) in saleFaqKeys" :key="idx" class="faq-mini-item sl-faq__item">
                <span class="faq-mini-q sl-faq__q">{{ t(faq.q) }}</span>
                <p class="faq-mini-a sl-faq__a">{{ t(faq.a) }}</p>
              </div>
            </div>
          </div>

          <!-- README 与文档 -->
          <div class="sale-block sl-card scroll-reveal" data-animation="fadeInUp" data-delay="250">
            <h4 class="sale-block-title sl-card__title">{{ t('openPlatform.sale.readmeTitle') }}</h4>
            <p class="sale-block-sub sl-card__sub">{{ t('openPlatform.sale.readmeSubtitle') }}</p>
            <p class="sale-block-desc sl-card__p">{{ t('openPlatform.sale.readmeSummary') }}</p>
            <router-link to="/support/document-center" class="sale-link sl-link" :aria-label="t('openPlatform.sale.readmeLinkText')">{{ t('openPlatform.sale.readmeLinkText') }} <el-icon><ArrowRight /></el-icon></router-link>
          </div>

          <!-- 返回本段导航（长阅读后快速回到锚点列表） -->
          <div class="sl-back-nav-wrap scroll-reveal" data-animation="fadeInUp">
            <a href="#sale-nav" class="sl-back-nav" :aria-label="t('openPlatform.sale.backToNav')">{{ t('openPlatform.sale.backToNav') }} <el-icon><ArrowRight /></el-icon></a>
          </div>
        </div>
      </div>
    </section>

    <!-- 9. FAQ 区域 -->
    <section id="faq" class="faq-section" aria-labelledby="faq-title">
      <div class="container">
        <div class="section-header text-center scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.faq') }}</span>
          <h2 id="faq-title" class="section-title">{{ t('openPlatform.faq.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.faq.subtitleEn') }}</h3>
        </div>
        <div class="faq-grid">
          <div
            v-for="(faq, index) in faqs"
            :key="index"
            class="faq-card glass scroll-reveal glow-border"
            :data-delay="Number(index) * 100"
            data-animation="fadeInUp"
          >
            <div class="faq-q">
              <span class="q-icon gradient-text">Q</span>
              <h4>{{ faq.q }}</h4>
            </div>
            <div class="faq-a">
              <p>{{ faq.a }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 9.5 全功能参照表 -->
    <section id="feature-ref" class="feature-ref-section section-band" aria-labelledby="feature-ref-title">
      <div class="container">
        <div class="section-header scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.featureRef') }}</span>
          <h2 id="feature-ref-title" class="section-title">{{ t('openPlatform.featureRef.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.featureRef.subtitleEn') }}</h3>
          <p class="api-matrix-lead">{{ t('openPlatform.featureRef.lead') }}</p>
        </div>
        <div class="feature-ref-wrap scroll-reveal" data-animation="fadeInUp">
          <table class="feature-ref-table" role="table" :aria-label="t('openPlatform.featureRef.title')">
            <thead>
              <tr>
                <th scope="col">{{ t('openPlatform.featureRef.featureName') }}</th>
                <th scope="col">{{ t('openPlatform.featureRef.description') }}</th>
                <th scope="col">{{ t('openPlatform.featureRef.module') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in fullFeatureReferenceRows" :key="i">
                <th scope="row">{{ t(row.nameKey) }}</th>
                <td>{{ t(row.descKey) }}</td>
                <td>{{ t(row.moduleKey) }}</td>
              </tr>
            </tbody>
            </table>
        </div>
      </div>
    </section>

    <!-- 9.6 功能表 -->
    <section id="feature-table" class="feature-table-section section-band" aria-labelledby="feature-table-title">
      <div class="container">
        <div class="section-header scroll-reveal" data-animation="fadeInUp">
          <span class="section-idx">{{ t('openPlatform.sections.featureTable') }}</span>
          <h2 id="feature-table-title" class="section-title">{{ t('openPlatform.featureTable.title') }}</h2>
          <h3 class="section-subtitle-en font-edix">{{ t('openPlatform.featureTable.subtitleEn') }}</h3>
          <p class="api-matrix-lead">{{ t('openPlatform.featureTable.lead') }}</p>
        </div>
        <div class="feature-table-wrap scroll-reveal" data-animation="fadeInUp">
          <table class="feature-table-table" role="table" :aria-label="t('openPlatform.featureTable.title')">
            <thead>
              <tr>
                <th scope="col">{{ t('openPlatform.featureTable.featureName') }}</th>
                <th scope="col">{{ t('openPlatform.featureTable.description') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in featureTableRows" :key="i">
                <th scope="row">{{ t(row.nameKey) }}</th>
                <td>{{ t(row.descKey) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 10. 最后 CTA -->
    <section id="cta" class="cta-section scroll-reveal" data-animation="fadeInUp" aria-labelledby="cta-title">
      <div class="container">
        <div class="cta-wrapper glass glow-border-strong">
          <div class="cta-badge"><span class="badge-text font-edix">{{ t('openPlatform.cta.badge') }}</span></div>
          <p class="cta-tagline">{{ t('openPlatform.cta.tagline') }}</p>
          <h2 id="cta-title" class="cta-title gradient-text-animated">{{ t('openPlatform.cta.title') }}</h2>
          <p class="cta-text">{{ t('openPlatform.cta.description') }}</p>
          <div class="cta-buttons">
            <button
              class="cta-btn primary inverted ripple-btn"
              :aria-label="t('openPlatform.buttons.registerNow')"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); scrollToFeatureHub() }"
            >
              <span class="btn-text">{{ t('openPlatform.buttons.registerNow') }}</span>
              <span class="btn-glow"></span>
            </button>
            <button
              class="cta-btn ghost ripple-btn"
              :aria-label="t('openPlatform.buttons.bookDemo')"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); goToDocs() }"
            >
              <span class="btn-text">{{ t('openPlatform.buttons.bookDemo') }}</span>
            </button>
            <button
              class="cta-btn ghost ripple-btn"
              :aria-label="t('openPlatform.buttons.pricingLicense')"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); scrollToSaleLicense() }"
            >
              <span class="btn-text">{{ t('openPlatform.buttons.pricingLicense') }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 删除了 Footer，因为由 App.vue 统一根据路由元信息控制显示 -->
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getCurrentLocale, loadModule } from '@/locales'

const { t, locale } = useI18n()

import { ref, computed, onMounted, onActivated, nextTick, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { markIcon } from '@/utils/markRaw'
import { useRouter } from 'vue-router'
import { useMouseGlow } from '@/composables/useMouseGlow'
import { getProxiedImageUrl, switchImageProxy } from '@/utils/imageProxy'
import {
  Connection, Check, ArrowRight, Monitor, Box, Microphone,
  View, Share, Lock, Operation, Lightning,
  Document, Odometer, Cpu, UserFilled
} from '@element-plus/icons-vue'
import {
  apiEndpoints,
  docLinks,
  saleFaqKeys,
  mainFaqKeys,
  customerCaseKeys,
  useCaseKeys,
  pricingComparisonRows,
  capabilityTags,
  capabilitiesWithTags,
  fullFeatureReferenceRows,
  featureTableRows
} from '@/data/open-platform'

defineOptions({
  name: 'OpenPlatform',
  inheritAttrs: false,
})


const router = useRouter()
const activeCodeTab = ref('js')
const selectedCapabilityTag = ref('ALL')

const iconMap: Record<string, typeof Share> = {
  Share,
  Document,
  View,
  Microphone,
  Connection,
  Monitor
}

// ============ 高级动效系统 ============
// 滚动动画观察器
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())

const { isMouseInViewport } = useMouseGlow()

// 滚动进度
const scrollProgress = ref(0)

// 初始化滚动动画观察器（使用 main 为滚动根，否则在 main 内滚动时不会触发）
const initScrollAnimations = () => {
  const scrollRoot = document.querySelector('#main-content') || undefined
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = Math.max(0, parseInt(el.dataset.delay || '0', 10) || 0)
          const animation = (el.dataset.animation || 'fadeInUp').replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, '')
          const animClass = `animate-${animation}`

          setTimeout(() => {
            el.classList.add('scroll-animated', animClass)
          }, delay)

          observedElements.value.add(el)
        }
      })
    },
    {
      threshold: 0.05,
      rootMargin: '0px 0px -30px 0px',
      root: scrollRoot ?? undefined
    }
  )

  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// 滚动进度计算
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = Math.min(scrollTop / docHeight, 1)

    document.documentElement.style.setProperty('--scroll-progress', `${scrollProgress.value}`)
  })
}

// 3D 卡片透视效果
// ============ 图片错误处理 ============
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (!img) return

  // 如果当前是代理图片，尝试切换到下一个代理
  if (img.src.includes('images.weserv.nl') || img.src.includes('wsrv.nl')) {
    switchImageProxy()
    const originalSrc = img.src.replace(/^https:\/\/(images\.weserv\.nl|wsrv\.nl)\/\?url=/, '').replace(/&.*$/, '')
    if (originalSrc) {
      img.src = getProxiedImageUrl(decodeURIComponent(originalSrc), true)
      return
    }
  }

  // 如果代理都失败，使用默认图片
  img.src = '/images/APP.jpg'
}

// ============ 数字计数动画 ============
const animatedNumbers = ref<Map<string, number>>(new Map())

const initCountAnimation = () => {
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const target = parseInt(el.dataset.target || '0')
          const id = el.dataset.countId || Math.random().toString()

          animateNumber(id, 0, target, 2000)
          counterObserver.unobserve(el)
        }
      })
    },
    { threshold: 0.5 }
  )

  nextTick(() => {
    document.querySelectorAll('.count-up').forEach((el) => {
      counterObserver.observe(el)
    })
  })
}

const animateRafIds = new Set<number>()

const animateNumber = (id: string, start: number, end: number, duration: number) => {
  const startTime = performance.now()

  const update = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)

    const easeOutExpo = 1 - Math.pow(2, -10 * progress)
    const current = Math.floor(start + (end - start) * easeOutExpo)

    animatedNumbers.value.set(id, current)

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

// ============ 磁吸按钮效果 ============
const _handleMagneticMove = (e: MouseEvent, btnRef: HTMLElement | null) => {
  if (!btnRef) return

  const rect = btnRef.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2

  btnRef.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`
}

const _resetMagnetic = (btnRef: HTMLElement | null) => {
  if (!btnRef) return
  btnRef.style.transform = 'translate(0, 0)'
}

// ============ 涟漪点击效果 ============
const createRipple = (e: MouseEvent, el: HTMLElement | null) => {
  if (!el) return
  // hero 区域两个按钮禁用涟漪，避免点击时出现向右拉长的视觉 bug
  if (el.closest('.hero-actions')) return

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

// ============ 视差滚动 ============
const parallaxY = ref(0)
const handleParallax = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    parallaxY.value = window.scrollY * 0.3
    document.documentElement.style.setProperty('--parallax-y', `${parallaxY.value}px`)
  })
}

// 打字机状态（使用 computed 保证 i18n 生效且随语言切换更新）
const phrases = computed(() => [t('data.open_platform.AI核心生产力4'), t('data.open_platform.phrase2'), t('data.open_platform.phrase3'), t('data.open_platform.phrase4')])
const currentTypingText = ref('')
let phraseIdx = 0
let charIdx = 0
let isDeletingText = false
let typingInterval: ReturnType<typeof setInterval> | null = null

const runTypeEffect = () => {
  const list = phrases.value
  if (!list.length) return
  const currentPhrase = list[phraseIdx]
  if (!currentPhrase?.length) {
    phraseIdx = (phraseIdx + 1) % list.length
    typingInterval = setTimeout(runTypeEffect, 500)
    return
  }

  let speed: number
  if (isDeletingText) {
    if (charIdx <= 0) {
      isDeletingText = false
      phraseIdx = (phraseIdx + 1) % list.length
      currentTypingText.value = ''
      charIdx = 0
      speed = 500
    } else {
      charIdx--
      currentTypingText.value = currentPhrase.substring(0, charIdx)
      speed = 60
    }
  } else {
    currentTypingText.value = currentPhrase.substring(0, charIdx + 1)
    charIdx++
    if (charIdx >= currentPhrase.length) {
      isDeletingText = true
      speed = 2000
    } else {
      speed = 120
    }
  }
  typingInterval = setTimeout(runTypeEffect, speed)
}

const startTypewriter = () => {
  if (typingInterval) clearTimeout(typingInterval)
  phraseIdx = 0
  charIdx = 0
  isDeletingText = false
  currentTypingText.value = ''
  runTypeEffect()
}

// 确保开放平台语言包已加载（首屏与切换语言后均能正确显示翻译，避免显示键名）
const ensureOpenPlatformLocale = async () => {
  const current = typeof locale === 'string' ? locale : (locale as { value?: string })?.value || getCurrentLocale()
  await loadModule(current as 'zh-CN' | 'en' | 'ja' | 'zh-TW' | 'ko', 'openPlatform')
}
watch(locale, ensureOpenPlatformLocale, { immediate: false })
onMounted(async () => {
  try { await ensureOpenPlatformLocale() } catch (e) { console.error(e) }
  startTypewriter()

  // SEO：开放平台页标题与描述
  const title = t('openPlatform.hero.titleBrand') && t('openPlatform.hero.title')
    ? `${t('openPlatform.hero.titleBrand')} - ${t('openPlatform.hero.title')}`
    : t('OpenPlatform.openPlatformTitle')
  document.title = title
  let metaDesc = document.querySelector('meta[name="description"]')
  if (!metaDesc) {
    metaDesc = document.createElement('meta')
    metaDesc.setAttribute('name', 'description')
    document.head.appendChild(metaDesc)
  }
  metaDesc.setAttribute('content', t('openPlatform.hero.description'))

  // 初始化高级动效系统
  initScrollAnimations()
  initCountAnimation()

  // 添加事件监听
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('scroll', handleParallax, { passive: true })

  // 初始滚动进度计算
  handleScroll()
})

onActivated(() => {
  startTypewriter()
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (typingInterval) { clearTimeout(typingInterval); typingInterval = null } })
cleanup.add(() => { animateRafIds.forEach(id => cancelAnimationFrame(id)); animateRafIds.clear() })
cleanup.add(() => { if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null } })
cleanup.add(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('scroll', handleParallax)
})
cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })

// 统计数据（computed 保证 i18n 翻译键生效且随语言切换更新）
const stats = computed(() => [
  { label: t('data.open_platform.系统吞吐量REQ'), value: '100M+' },
  { label: t('data.open_platform.活跃开发者DEV1'), value: '50K+' },
  { label: t('data.open_platform.平均可用性SLA2'), value: '99.99%' },
  { label: t('data.open_platform.边缘接入延迟LA3'), value: '< 50ms' }
])

// 处理管道
const pipelineSteps = computed(() => [
  { title: t('title.open_platform.安全准入'), desc: t('openPlatform.pipelineDesc1'), icon: markIcon(Lock) },
  { title: t('title.open_platform.集群分发1'), desc: t('openPlatform.pipelineDesc2'), icon: markIcon(Share) },
  { title: t('title.open_platform.深度协作2'), desc: t('openPlatform.pipelineDesc3'), icon: markIcon(Operation) },
  { title: t('title.open_platform.质量回溯3'), desc: t('openPlatform.pipelineDesc4'), icon: markIcon(Lightning) }
])

// API 宇宙（能力标签筛选）
const filteredApiUniverse = computed(() => {
  const list = selectedCapabilityTag.value === 'ALL'
    ? capabilitiesWithTags
    : capabilitiesWithTags.filter((c) => c.tag === selectedCapabilityTag.value)
  return list.map((c) => {
    const tagItem = capabilityTags.find((t) => t.id === c.tag)
    return {
      title: t(c.titleKey),
      desc: t(c.descKey),
      icon: iconMap[c.iconName] ?? Share,
      tag: c.tag,
      tagLabel: tagItem ? t(tagItem.labelKey) : c.tag,
      latency: c.latency
    }
  })
})

// SDK 与 代码
const sdks = ['Python', 'Node.js', 'Go', 'Rust', 'Java', 'PHP']
const codeTabs = [
  { id: 'js', label: 'JavaScript' },
  { id: 'py', label: 'Python' },
  { id: 'curl', label: 'cURL' }
]

const currentCodeHtml = computed(() => {
  if (activeCodeTab.value === 'js') {
    return `<span class="c">// 初始化客户端</span><br/><span class="k">const</span> ihui = <span class="k">require</span>(<span class="s">'ihui-ai-sdk'</span>);<br/><span class="k">const</span> client = <span class="k">new</span> ihui.Client({ apiKey: <span class="s">'YOUR_SK'</span> });<br/><br/><span class="k">async function</span> main() {<br/>  <span class="k">const</span> res = <span class="k">await</span> client.swarm.create({<br/>    task: <span class="s">'${t("openPlatform.codeTaskComment")}'</span>,<br/>    agents: [<span class="s">'reasoning'</span>, <span class="s">'coder'</span>]<br/>  });<br/>  console.log(res.result);<br/>}`
  }
  if (activeCodeTab.value === 'py') {
    return `<span class="k">import</span> ihui<br/><br/><span class="c"># ${t("openPlatform.codeSimpleIntegration")}</span><br/>client = ihui.Client(api_key=<span class="s">"YOUR_SK"</span>)<br/><br/>res = client.chat.completions.create(<br/>    model=<span class="s">"ihui-pro-v2"</span>,<br/>    messages=[{<span class="s">"role"</span>: <span class="s">"user"</span>, <span class="s">"content"</span>: <span class="s">"Hello!"</span>}]<br/>)<br/><span class="k">print</span>(res.choices[0].message)`
  }
  return `curl https://api.aizhs.top/v1/chat/completions \\<br/>  -H <span class="s">"Authorization: Bearer YOUR_SK"</span> \\<br/>  -H <span class="s">"Content-Type: application/json"</span> \\<br/>  -d '{<br/>    <span class="s">"model"</span>: <span class="s">"ihui-v2"</span>,<br/>    <span class="s">"messages"</span>: [{"role": <span class="s">"user"</span>, "content": <span class="s">"Hello!"</span>}]<br/>  }'`
})

// 行业方案
const solutions = computed(() => [
  { title: t('title.open_platform.智能金融风控10'), desc: t('openPlatform.solutionDesc1'), image: getProxiedImageUrl('https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800', false), tags: [t('data.open_platform.研报分析5'), t('openPlatform.solutionTagRisk')] },
  { title: t('title.open_platform.电商全链路闭环11'), desc: t('openPlatform.solutionDesc2'), image: getProxiedImageUrl('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800', false), tags: [t('data.open_platform.图文建模6'), t('openPlatform.solutionTagSupport')] },
  { title: t('title.open_platform.法律文档审计12'), desc: t('openPlatform.solutionDesc3'), image: getProxiedImageUrl('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=800', false), tags: [t('data.open_platform.文书比对7'), t('openPlatform.solutionTagCompliance')] }
])

// 功能中心入口（含文件管理、权限管理、审计日志，便于企业客户发现）
const featureHub = computed(() => [
  { title: t('title.open_platform.数据看板13'), desc: t('openPlatform.featureHubDesc1'), icon: markIcon(Odometer), route: '/open/dashboard' },
  { title: t('title.open_platform.SDK集成14'), desc: t('openPlatform.featureHubDesc2'), icon: markIcon(Document), route: '/open/sdks' },
  { title: t('title.open_platform.模型市场15'), desc: t('openPlatform.featureHubDesc3'), icon: markIcon(Cpu), route: '/open/models' },
  { title: t('title.open_platform.智能体中心16'), desc: t('openPlatform.featureHubDesc4'), icon: markIcon(UserFilled), route: '/open/agents' },
  { title: t('title.open_platform.API文档17'), desc: t('openPlatform.featureHubDesc5'), icon: markIcon(Connection), route: '/open/apis' },
  { title: t('title.open_platform.知识文档18'), desc: t('openPlatform.featureHubDesc6'), icon: markIcon(Document), route: '/open/documents' },
  { title: t('title.open_platform.文件管理22'), desc: t('openPlatform.featureHubDesc7'), icon: markIcon(Document), route: '/files' },
  { title: t('title.open_platform.权限管理23'), desc: t('openPlatform.featureHubDesc8'), icon: markIcon(Lock), route: '/permissions' },
  { title: t('title.open_platform.审计日志24'), desc: t('openPlatform.featureHubDesc9'), icon: markIcon(Operation), route: '/audit' }
])

// 生态与FAQ
const ecosystem = computed(() => [
  { title: t('title.open_platform.管理控制台19'), desc: t('openPlatform.ecosystemDesc1'), icon: markIcon(Monitor), link: '/api-home', linkText: t('openPlatform.ecosystemLinkManage') },
  { title: t('title.open_platform.工作流商店20'), desc: t('openPlatform.ecosystemDesc2'), icon: markIcon(Box), link: '/support/document-center', linkText: t('openPlatform.ecosystemLinkPlugins') },
  { title: t('title.open_platform.GitHub仓库21'), desc: t('openPlatform.ecosystemDesc3'), icon: markIcon(Share), link: 'https://github.com/ihui-ai', linkText: t('openPlatform.ecosystemLinkSdk') }
])

// 定价功能明细键（与 i18n sale.planXxxFeature1..N 对应）
const planFreeFeatureKeys = ['planFreeFeature1', 'planFreeFeature2', 'planFreeFeature3', 'planFreeFeature4', 'planFreeFeature5', 'planFreeFeature6']
const planStandardFeatureKeys = ['planStandardFeature1', 'planStandardFeature2', 'planStandardFeature3', 'planStandardFeature4', 'planStandardFeature5', 'planStandardFeature6', 'planStandardFeature7', 'planStandardFeature8', 'planStandardFeature9', 'planStandardFeature10']
const planEnterpriseFeatureKeys = ['planEnterpriseFeature1', 'planEnterpriseFeature2', 'planEnterpriseFeature3', 'planEnterpriseFeature4', 'planEnterpriseFeature5', 'planEnterpriseFeature6']

const faqs = computed(() =>
  mainFaqKeys.map((faq) => ({ q: t(faq.q), a: t(faq.a) }))
)

// 流动线条样式
const flowStyles = [
  { top: '10%', '--delay': '0s', opacity: 0.05 },
  { top: '30%', '--delay': '2s', opacity: 0.03 },
  { top: '50%', '--delay': '4s', opacity: 0.04 },
  { top: '70%', '--delay': '1s', opacity: 0.02 },
  { top: '90%', '--delay': '3s', opacity: 0.05 },
  { left: '20%', width: '1px', height: '100%', '--delay': '5s', opacity: 0.03 },
  { left: '50%', width: '1px', height: '100%', '--delay': '0s', opacity: 0.02 },
  { left: '80%', width: '1px', height: '100%', '--delay': '2s', opacity: 0.04 }
]

const scrollToFeatureHub = () => {
  const el = document.querySelector('#feature-hub')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
const scrollToSaleLicense = () => {
  const el = document.querySelector('#sale-license')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
const scrollToIhuiArch = () => {
  const el = document.querySelector('#ihui-arch')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
const goToDocs = () => router.push('/support/document-center')
const goToContact = () => router.push('/about/contact-us')
function isExternalLink(href: string) {
  return typeof href === 'string' && (href.startsWith('http://') || href.startsWith('https://'))
}
</script>

<style scoped lang="scss">
@use '@/styles/_open-platform';
</style>

<!-- 架构三卡：非 scoped 兜底，保证「整体大卡片 + 缩小空白」在开放平台页一定生效 -->
<style lang="scss">
:where(.open-platform-container) :where(.ihui-arch-section) {
  .section-header {
    margin-bottom: 28px;
  }

  .ihui-arch-cards-wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 28px 36px;
    background: none;
    border: none;
  }

  .ihui-arch-grid.ihui-arch-grid--three {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
  }

  .ihui-arch-card {
    padding: 0 24px;
    border: none;
    border-radius: 0;
    background: none;
    &:first-child { padding-left: 0; }
    &:last-child { padding-right: 0; }
  }
}

:where(.open-platform-container) :where(.sl) {
  .sl-bento,
  .sl-card {
    border-radius: var(--global-border-radius);
    border: 2px solid var(--op-border);
    background: var(--op-glass-bg);
  }

  .sl-plan {
    border-radius: var(--global-border-radius);
    border: 2px solid var(--op-border);
    background: var(--op-bg);
  }
  .sl-plan.sl-plan--recommended { border-top-width: 4px; border-top-color: var(--op-accent); }
  .sl-plan .sl-plan__badge { background: var(--op-accent); color: var(--el-bg-color); border-radius: 0 0 0 12px; }
}

:where(html.dark) :where(.open-platform-container) :where(.sl) {
  .sl-bento, .sl-card { background: var(--op-glass-bg); border-color: var(--op-border); }
  .sl-plan { background: var(--color-white-4); border-color: var(--op-border); }
  .sl-plan .sl-plan__badge { background: var(--op-color); color: var(--op-bg); border-color: var(--op-color); }
}
</style>
