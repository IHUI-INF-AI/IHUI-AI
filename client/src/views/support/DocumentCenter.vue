<template>
  <div class="document-center-page">
    <div class="container">
      <!-- 搜索核心区 -->
      <section class="hero-search ihui-ai-fade-in-top-animation">
        <div class="hero-badge">
          <span class="status-dot"></span>
          <span class="badge-text font-edix">DOCS</span>
        </div>
        <h1>{{ t('documentCenter.title') }}</h1>
        <div class="search-wrapper unified-search-bar">
          <el-input
            v-model="searchQuery"
            :placeholder="t('documentCenter.searchPlaceholder')"
            @keydown.enter="handleSearchKeydown"
            @input="handleSearch"
          >
            <template #prefix>
              <SearchIcon />
            </template>
            <template #suffix>
              <kbd>⌘ K</kbd>
            </template>
          </el-input>
        </div>
      </section>

      <!-- 文档矩阵 -->
      <div class="doc-matrix">
        <!-- 快速开始 -->
        <div class="matrix-card ihui-ai-card-hover">
          <div class="card-header">
            <el-icon><Rocket /></el-icon>
            <h3>{{ t('documentCenter.quickStart') }}</h3>
          </div>
          <div class="doc-links">
            <div v-for="doc in quickStartDocs" :key="doc.id" class="doc-link-item" @click="handleDocClick(doc)">
              <div class="doc-meta">
                <span class="id">0{{ doc.id }}</span>
                <span class="title">{{ doc.title }}</span>
              </div>
              <el-icon class="arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>

        <!-- API 参考 -->
        <div class="matrix-card ihui-ai-card-hover">
          <div class="card-header">
            <el-icon><Code /></el-icon>
            <h3>{{ t('documentCenter.apiDocs') }}</h3>
          </div>
          <div class="doc-links">
            <div v-for="doc in apiDocs" :key="doc.id" class="doc-link-item" @click="handleDocClick(doc)">
              <div class="doc-meta">
                <span class="id">0{{ doc.id }}</span>
                <span class="title">{{ doc.title }}</span>
              </div>
              <el-icon class="arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>

        <!-- 开发指南 -->
        <div class="matrix-card ihui-ai-card-hover">
          <div class="card-header">
            <el-icon><BookOpen /></el-icon>
            <h3>{{ t('documentCenter.guides') }}</h3>
          </div>
          <div class="doc-links">
            <div v-for="doc in guides" :key="doc.id" class="doc-link-item" @click="handleDocClick(doc)">
              <div class="doc-meta">
                <span class="id">0{{ doc.id }}</span>
                <span class="title">{{ doc.title }}</span>
              </div>
              <el-icon class="arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- 开发者激励计划入口 -->
      <section class="incentive-program-section ihui-ai-fade-in-top-animation">
        <div class="section-label">{{ t('documentCenter.incentiveProgram.label') }}</div>
        <div class="incentive-cards">
          <div class="incentive-card card-glass ihui-ai-card-hover" @click="goToIncentiveDoc('dev-incentive-overview')">
            <div class="card-icon"><el-icon><Rocket /></el-icon></div>
            <div class="card-content">
              <h3>{{ t('documentCenter.incentiveProgram.overview') }}</h3>
              <p>{{ t('documentCenter.incentiveProgram.overviewDesc') }}</p>
            </div>
            <el-icon class="card-arrow"><ArrowRight /></el-icon>
          </div>
          <div class="incentive-card card-glass ihui-ai-card-hover" @click="goToIncentiveDoc('dev-incentive-publish')">
            <div class="card-icon"><el-icon><BookOpen /></el-icon></div>
            <div class="card-content">
              <h3>{{ t('documentCenter.incentiveProgram.publishGuide') }}</h3>
              <p>{{ t('documentCenter.incentiveProgram.publishGuideDesc') }}</p>
            </div>
            <el-icon class="card-arrow"><ArrowRight /></el-icon>
          </div>
          <div class="incentive-card card-glass ihui-ai-card-hover" @click="goToIncentiveDoc('dev-incentive-monetization')">
            <div class="card-icon"><el-icon><CreditCard /></el-icon></div>
            <div class="card-content">
              <h3>{{ t('documentCenter.incentiveProgram.monetizationGuide') }}</h3>
              <p>{{ t('documentCenter.incentiveProgram.monetizationGuideDesc') }}</p>
            </div>
            <el-icon class="card-arrow"><ArrowRight /></el-icon>
          </div>
          <div class="incentive-card card-glass ihui-ai-card-hover" @click="goToIncentiveDoc('dev-incentive-platform')">
            <div class="card-icon"><el-icon><Code /></el-icon></div>
            <div class="card-content">
              <h3>{{ t('documentCenter.incentiveProgram.platformIntro') }}</h3>
              <p>{{ t('documentCenter.incentiveProgram.platformIntroDesc') }}</p>
            </div>
            <el-icon class="card-arrow"><ArrowRight /></el-icon>
          </div>
        </div>
      </section>

      <!-- FAQ 中心（从 Help.vue 融合） -->
      <section class="faq-hub-section ihui-ai-fade-in-top-animation">
        <div class="section-label">01 / {{ t('help.sectionLabels.knowledgeNodes') }}</div>

        <div class="category-pills">
          <button
            v-for="cat in categories"
            :key="cat.key"
            :class="{ active: activeCategory === cat.key }"
            @click="handleCategoryClick(cat.key)"
          >
            <el-icon><component :is="cat.icon" /></el-icon>
            {{ t(cat.label) }}
          </button>
        </div>

        <div class="faq-stream">
          <div
            v-for="(faq, index) in filteredFAQs"
            :key="faq.id"
            class="faq-entry card-glass"
            :class="{ expanded: expandedFAQ === faq.id }"
          >
            <div class="entry-header" @click="toggleFAQ(faq.id)">
              <span class="entry-num">{{ String(Number(index) + 1).padStart(2, '0') }}</span>
              <h3 class="entry-q">{{ faq.question }}</h3>
              <div class="toggle-wrap">
                <el-icon class="toggle-ico"><ChevronDown /></el-icon>
              </div>
            </div>
            <Transition name="expand">
              <div v-if="expandedFAQ === faq.id" class="entry-body">
                <div class="entry-a">{{ faq.answer }}</div>
                <div class="entry-footer">
                  <div class="entry-tags">
                    <span v-for="tag in faq.tags" :key="tag">#{{ tag }}</span>
                  </div>
                  <div class="entry-actions">
                    <span>{{ t('help.wasThisHelpful') }}</span>
                    <button class="btn-vote" @click.stop="handleVote(faq.id, true)">{{ t('help.yes') }}</button>
                    <button class="btn-vote" @click.stop="handleVote(faq.id, false)">{{ t('help.no') }}</button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- 联络矩阵（从 Help.vue 融合） -->
      <section class="uplink-matrix-section ihui-ai-fade-in-top-animation">
        <div class="section-label">02 / {{ t('help.sectionLabels.uplinkChannels') }}</div>
        <div class="matrix-grid">
          <div class="channel-card card-glass ihui-ai-card-hover" @click="goToFeedback">
            <div class="ch-icon"><el-icon :size="32"><Edit3 /></el-icon></div>
            <div class="ch-info">
              <h3>{{ t('help.channels.feedback.title') }}</h3>
              <p>{{ t('help.channels.feedback.desc') }}</p>
            </div>
            <div class="ch-footer">
              <span class="ch-status">{{ t('help.channels.feedback.status') }}</span>
              <el-icon :size="16"><ArrowRight /></el-icon>
            </div>
          </div>

          <div class="channel-card card-glass ihui-ai-card-hover" @click="openCustomService">
            <div class="ch-icon"><el-icon :size="32"><MessageCircle /></el-icon></div>
            <div class="ch-info">
              <h3>{{ t('help.channels.liveUplink.title') }}</h3>
              <p>{{ t('help.channels.liveUplink.desc') }}</p>
            </div>
            <div class="ch-footer">
              <span class="ch-status online">{{ t('help.channels.liveUplink.status') }}</span>
              <el-icon :size="16"><ArrowRight /></el-icon>
            </div>
          </div>

          <div class="channel-card card-glass ihui-ai-card-hover" @click="goToApiDocs">
            <div class="ch-icon"><el-icon :size="32"><Terminal /></el-icon></div>
            <div class="ch-info">
              <h3>{{ t('help.channels.coreDocs.title') }}</h3>
              <p>{{ t('help.channels.coreDocs.desc') }}</p>
            </div>
            <div class="ch-footer">
              <span class="ch-status">{{ t('help.channels.coreDocs.status') }}</span>
              <el-icon :size="16"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </section>

      <!-- 条款与政策 -->
      <section id="terms-and-policies" class="terms-policies-section ihui-ai-fade-in-top-animation">
        <h2 class="section-title">{{ t('termsAndPolicies.title') }}</h2>
        <p class="section-subtitle">{{ t('termsAndPolicies.subtitle') }}</p>
        <div class="policies-matrix">
          <div
            v-for="policy in policies"
            :key="policy.id"
            class="policy-node matrix-card ihui-ai-card-hover"
            @click="goToRoute(policy.route, policy.query)"
          >
            <div class="node-header">
              <el-icon class="node-icon"><component :is="policy.icon" /></el-icon>
              <span class="node-id">{{ t(`termsAndPolicies.nodeIds.${policy.id}`) }}</span>
            </div>
            <h3>{{ policy.title }}</h3>
            <p>{{ policy.description }}</p>
            <div class="node-footer">
              <span class="read-btn">{{ t('termsAndPolicies.readFullText') }} <el-icon><ArrowRight /></el-icon></span>
            </div>
          </div>
        </div>
      </section>

      <!-- 底部快捷操作 -->
      <footer class="doc-footer">
        <div class="quick-nav">
          <button @click="openCustomerServiceChat()">{{ t('documentCenter.support') }}</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { markIcon } from '@/utils/markRaw'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'
import {
  Rocket,
  Code,
  BookOpen,
  ArrowRight,
  Document,
  Lock,
  UserCheck,
  CreditCard,
  User,
  Lock as LockIcon,
  MessageCircle,
  Edit3,
  Terminal,
  ChevronDown,
  Book,
} from '@/lib/lucide-fallback'
import { ElMessage } from 'element-plus'
import { openCustomerServiceChat } from '@/composables/useOpenCustomerServiceChat'
import SearchIcon from '@/components/common/SearchIcon.vue'

const { t } = useI18n()
const router = useRouter()
const cleanup = useCleanup()
const searchQuery = ref('')
const activeCategory = ref('all')
const expandedFAQ = ref<string | null>(null)

// 文档条目接口
interface DocItem {
  id: number
  title: string
  url?: string
  docId?: string
  docType?: string
}

const goToRoute = (path: string, query?: Record<string, string>) =>
  router.push(query ? { path, query } : path)

const goToIncentiveDoc = (docId: string) => {
  router.push({ path: '/docs', query: { doc: docId } })
}

// 搜索功能：跳转到 /docs 并传递搜索关键词
const handleSearch = () => {
  const query = searchQuery.value.trim()
  if (query) {
    router.push({ path: '/docs', query: { search: query } })
  }
}

// 支持回车搜索
const handleSearchKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleSearch()
  }
}

const handleDocClick = (doc: DocItem) => {
  if (doc.url) {
    if (doc.url.startsWith('http')) window.open(doc.url, '_blank')
    else router.push(doc.url)
  } else if (doc.docId) {
    router.push({ path: '/docs', query: { doc: doc.docId } })
  } else {
    ElMessage.info(t('documentCenter.comingSoon'))
  }
}

// 模拟数据（保持与原文件一致但结构化）
const quickStartDocs = ref([
  { id: 1, title: t('title.document_center.快速入门概览'), docId: 'dev-introduction' },
  { id: 2, title: t('title.document_center.账户认证授权1'), docId: 'dev-authentication' },
  { id: 3, title: t('title.document_center.首个应用搭建2'), docId: 'dev-setup' },
])

const apiDocs = ref([
  { id: 1, title: t('title.document_center.RESTAPI参3'), docId: 'dev-api-overview' },
  { id: 2, title: t('title.document_center.WebSocke4'), docId: 'dev-api-chat' },
  { id: 3, title: t('title.document_center.GraphQL查5'), docId: 'dev-api-overview' },
])

const guides = ref([
  { id: 1, title: t('title.document_center.SDK集成最佳实6'), docId: 'dev-sdk-javascript' },
  { id: 2, title: t('title.document_center.性能优化指南7'), docId: 'dev-best-practices' },
  { id: 3, title: t('title.document_center.错误处理规范8'), docId: 'dev-api-error' },
])

// FAQ 分类（从 Help.vue 融合）
const categories = [
  { key: 'all', label: 'help.categories.all', icon: Book },
  { key: 'account', label: 'help.categories.account', icon: User },
  { key: 'security', label: 'help.categories.security', icon: LockIcon },
  { key: 'payment', label: 'help.categories.payment', icon: CreditCard },
]

// FAQ 数据（从 Help.vue 融合）
const localFAQs = computed(() => [
  { id: '1', category: 'account', question: t('help.faqs.register.question'), answer: t('help.faqs.register.answer'), tags: [t('help.tags.register'), t('help.faqs.beginner')] },
  { id: '2', category: 'payment', question: t('help.faqs.credits.question'), answer: t('help.faqs.credits.answer'), tags: [t('help.tags.billing'), t('help.faqs.recharge')] },
  { id: '3', category: 'security', question: t('help.faqs.apiKeyLeak.question'), answer: t('help.faqs.apiKeyLeak.answer'), tags: [t('help.tags.security'), 'API'] },
  { id: '4', category: 'usage', question: t('help.faqs.quality.question'), answer: t('help.faqs.quality.answer'), tags: [t('help.tags.prompt'), t('help.faqs.optimize')] },
])

interface FAQItem {
  id: string
  category: string
  question: string
  answer: string
  tags: string[]
}

const filteredFAQs = computed(() => {
  let res: FAQItem[] = localFAQs.value
  if (activeCategory.value !== 'all') res = res.filter((f) => f.category === activeCategory.value)
  if (searchQuery.value) res = res.filter((f) => f.question.toLowerCase().includes(searchQuery.value.toLowerCase()))
  return res
})

const handleCategoryClick = (k: string) => {
  activeCategory.value = k
  expandedFAQ.value = null
}

const toggleFAQ = (id: string) => {
  expandedFAQ.value = expandedFAQ.value === id ? null : id
}

const handleVote = (faqId: string, isHelpful: boolean) => {
  ElMessage.success(isHelpful ? t('help.feedbackSubmitted') : t('help.feedbackFailed'))
}

// 联络矩阵方法（从 Help.vue 融合）
const goToFeedback = () => router.push('/feedback')
const goToApiDocs = () => router.push('/api-docs')
// 在线客服：跳转客服中心页（含在线对话、工单、FAQ）
const openCustomService = () => router.push('/customer-service')

// 条款与政策：跳转到 /docs 统一文档页
const policies = computed(() => [
  { id: '1', title: t('termsAndPolicies.policies.termsOfService.title'), description: t('termsAndPolicies.policies.termsOfService.description'), icon: markIcon(Document), route: '/docs', query: { doc: 'terms-of-service' } },
  { id: '2', title: t('termsAndPolicies.policies.privacyPolicy.title'), description: t('termsAndPolicies.policies.privacyPolicy.description'), icon: markIcon(Lock), route: '/docs', query: { doc: 'privacy-policy' } },
  { id: '3', title: t('termsAndPolicies.policies.userAgreement.title'), description: t('termsAndPolicies.policies.userAgreement.description'), icon: markIcon(UserCheck), route: '/docs', query: { doc: 'user-agreement' } },
  { id: '4', title: t('termsAndPolicies.policies.paymentTerms.title'), description: t('termsAndPolicies.policies.paymentTerms.description'), icon: markIcon(CreditCard), route: '/docs', query: { doc: 'payment-terms' } },
])

let docScrollRafId: number | null = null
cleanup.add(() => { if (docScrollRafId !== null) cancelAnimationFrame(docScrollRafId) })

onMounted(() => {
  if (typeof window !== 'undefined' && window.location.hash === '#terms-and-policies') {
    docScrollRafId = requestAnimationFrame(() => {
      const el = document.getElementById('terms-and-policies')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

.document-center-page {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.container {
  position: relative;
  z-index: var(--z-base);
  width: 100%;
  padding: 0 24px;

  @include bp.tablet-down { padding: 0 16px; }
}

.hero-search {
  padding: 20px 0 36px;
  text-align: center;

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 6px 12px;
    background: var(--el-fill-color-light);
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

  h1 { font-size: clamp(26px, 4vw, 36px); font-weight: 800; margin: 0 0 20px; letter-spacing: -0.5px; color: var(--el-text-color-primary); line-height: 1.2; }
  .search-wrapper { max-width: 520px; margin: 0 auto; }
}

// 搜索框样式由全局 .unified-search-bar 统一；仅保留 suffix kbd 样式
.unified-search-bar :deep(.el-input__suffix) {
  kbd {
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: var(--global-border-radius);
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
}

.doc-matrix {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;

  @include bp.tablet-down { grid-template-columns: 1fr; gap: 16px; }
}

.matrix-card {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--el-color-primary);
    h3 { font-size: 12px; font-weight: 700; color: var(--el-text-color-regular); text-transform: uppercase; letter-spacing: 0.5px; }
  }
}

.doc-links {
  display: flex;
  flex-direction: column;
  gap: 0;
}

// 开发者激励计划入口样式
.incentive-program-section {
  margin-top: 32px;
}

.incentive-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @include bp.tablet-down { grid-template-columns: 1fr; }
}

.incentive-card {
  background-color: transparent;
  border-radius: var(--global-border-radius);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: var(--el-fill-color-light);
    .card-icon { color: var(--el-color-primary); transform: scale(1.1); }
    .card-arrow { transform: translateX(4px); color: var(--el-color-primary); }
  }

  .card-icon {
    background: transparent;
    color: var(--el-color-primary);
    font-size: 24px;
    transition: all 0.3s;
    flex-shrink: 0;
  }

  .card-content {
    background: transparent;
    flex: 1;

    h3 {
      font-size: 14px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      margin: 0 0 4px;
    }

    p {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin: 0;
      line-height: 1.4;
    }
  }

  .card-arrow {
    background: transparent;
    color: var(--el-text-color-placeholder);
    font-size: 16px;
    transition: all 0.3s;
    flex-shrink: 0;
  }
}

.doc-link-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: transparent;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 36px;

  &:hover {
    background: var(--el-fill-color-extra-light);
    .id { color: var(--el-color-primary); }
    .title { color: var(--el-text-color-primary); }
    .arrow { transform: translateX(4px); color: var(--el-text-color-primary); }
  }

  .doc-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    .id { font-family: var(--font-family-mono); font-size: 12px; color: var(--el-border-color-darker); font-weight: 700; transition: color 0.3s; }
    .title { font-size: 12px; color: var(--el-text-color-regular); font-weight: 500; transition: color 0.3s; }
  }
  .arrow { color: var(--el-border-color-extra-light); transition: all 0.3s; font-size: 13px; }
}

// FAQ 中心样式（从 Help.vue 融合）
.faq-hub-section {
  margin-top: 48px;
  padding-top: 40px;
  border-top: var(--unified-border);
}

.section-label {
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--el-color-primary);
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--el-border-color-lighter);
    margin-left: 16px;
  }
}

.category-pills {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
  flex-wrap: wrap;

  button {
    background: var(--el-bg-color);
    border: none;
    padding: 8px 16px;
    border-radius: var(--global-border-radius);
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.3s;

    &.active {
      background: var(--el-color-primary);
      color: var(--el-bg-color);
    }
  }

  :where(button):hover:not(.active) {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
  }
}

.faq-stream {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:where(.faq-entry) {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: all 0.3s;

  .entry-header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    cursor: pointer;

    .entry-num {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      font-weight: 700;
      min-width: 24px;
    }

    .entry-q {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-regular);
      margin: 0;
      transition: color 0.3s;
    }

    .toggle-ico {
      color: var(--el-text-color-placeholder);
      transition: all 0.3s;
    }
  }

  &:hover {
    border-color: var(--el-border-color);
    .entry-q { color: var(--el-text-color-primary); }
  }

  &.expanded {
    border-color: var(--el-border-color);
    background: var(--el-fill-color-light);
    .entry-q { color: var(--el-color-primary); }
    .toggle-ico { transform: rotate(180deg); color: var(--el-text-color-primary); }
  }

  :where(.entry-body) {
    padding: 0 20px 20px 56px;
    animation: slideDown 0.3s ease;

    .entry-a {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      line-height: 1.7;
      margin-bottom: 16px;
    }

    :where(.entry-footer) {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;

      :where(.entry-tags) {
        display: flex;
        gap: 8px;

        span {
          font-family: var(--font-family-mono);
          font-size: 12px;
          color: var(--el-text-color-placeholder);
          font-weight: 600;
        }
      }

      .entry-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        color: var(--el-text-color-placeholder);

        .btn-vote {
          background: none;
          border: none;
          color: var(--el-text-color-secondary);
          padding: 2px 10px;
          border-radius: var(--global-border-radius);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.3s;

          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
    }
  }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

// 联络矩阵样式（从 Help.vue 融合）
.uplink-matrix-section {
  margin-top: 48px;
  padding-top: 40px;
  border-top: var(--unified-border);
}

.matrix-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;

  @include bp.tablet-down { grid-template-columns: 1fr; }
}

.channel-card {
  background: var(--el-bg-color);
  padding: 24px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 160px;

  &:hover {
    background: var(--el-fill-color-light);
    .ch-icon { color: var(--el-color-primary); transform: scale(1.05); }
  }

  .ch-icon {
    color: var(--el-color-primary);
    transition: all 0.3s;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  h3 {
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 6px;
    color: var(--el-text-color-primary);
  }

  p {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
    margin: 0 0 16px;
    flex: 1;
  }

  .ch-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;

    .ch-status {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      font-weight: 600;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    :where(.ch-status).online { color: var(--color-emerald-500); }
  }
}

/* 条款与政策区块 */
.terms-policies-section {
  margin-top: 48px;
  padding-top: 40px;
  border-top: var(--unified-border);

  .section-title {
    font-size: clamp(22px, 3.5vw, 28px);
    font-weight: 800;
    margin: 0 0 8px;
    letter-spacing: -0.5px;
    color: var(--el-text-color-primary);
  }

  .section-subtitle {
    color: var(--el-text-color-secondary);
    font-size: 14px;
    max-width: 560px;
    line-height: 1.5;
    margin-bottom: 24px;
  }
}

.policies-matrix {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;

  @include bp.tablet-down { grid-template-columns: 1fr; }
}

.policy-node {
  cursor: pointer;
  padding: 20px 24px;

  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    .node-icon { color: var(--el-text-color-placeholder); font-size: 22px; }

    .node-id {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      font-weight: 800;
    }
  }
  h3 { font-size: 16px; font-weight: 800; margin-bottom: 6px; color: var(--el-text-color-primary); }
  p { font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.55; margin-bottom: 12px; }

  .node-footer .read-btn {
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 800;
    color: var(--el-text-color-placeholder);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: color 0.3s;
  }

  &:hover {
    .node-id { color: var(--el-color-primary); }
    :where(.node-footer) .read-btn { color: var(--el-text-color-primary); }
  }
}

.doc-footer {
  margin-top: 40px;
  padding: 24px 0 32px;
  border-top: var(--unified-border);

  .quick-nav {
    display: flex;
    justify-content: center;
    gap: 24px;

    button {
      background: none; border: none; color: var(--el-text-color-placeholder); font-family: var(--font-family-mono);
      font-size: 12px; font-weight: 700; letter-spacing: 1.5px; cursor: pointer;
      transition: color 0.3s;
      &:hover { color: var(--el-color-primary); }
    }
  }
}

// 暗色模式覆盖
html.dark .document-center-page {
  background-color: var(--el-bg-color-page);
}
</style>
