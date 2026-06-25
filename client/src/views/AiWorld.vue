<template>
  <div ref="pageRef" class="ai-world-page">
    <!-- 极简背景（与文档中心一致） -->
    <div class="ai-world-page__bg" />

    <div class="ai-world-page__wrap" :class="{ 'ai-world-page__wrap--nav-fixed': !isTabletDown }">
      <!-- 左侧菜单栏：Teleport 到 body 避免被 #main-content 内 transform/滚动容器影响，真正固定于视口 -->
      <Teleport to="body" :disabled="isTabletDown">
        <aside v-if="!loading && sectionNavTreeWithIndex.length" class="ai-world-page__nav" :aria-label="t('common.categoryNav')">
          <nav class="ai-world-page__nav-inner">
          <template v-for="(navSection, si) in sectionNavTreeWithIndex" :key="navSection.sectionTitle">
            <!-- 仅一个子项且无/重复子标题：单一级菜单，不展开 -->
            <button v-if="
              navSection.children.length === 1 &&
              (!navSection.children[0].subTitle ||
                isSubTitleRedundant(navSection.sectionTitle, navSection.children[0].subTitle))
            " type="button" class="ai-world-page__nav-item"
              :class="{ 'ai-world-page__nav-item--active': activeSectionIndex === navSection.children[0].flatIndex }"
              @click="scrollToSection(navSection.children[0].flatIndex)">
              {{ navSection.sectionTitle }}
            </button>
            <!-- 多个子项或子标题有意义：父级可折叠 + 子菜单（顺序与页面内容一致） -->
            <template v-else>
              <button type="button" class="ai-world-page__nav-parent"
                :class="{ 'ai-world-page__nav-parent--active': isNavSectionActive(navSection) }"
                :aria-expanded="isSectionExpanded(navSection.sectionTitle)"
                @click="toggleSection(navSection.sectionTitle)">
                <span class="ai-world-page__nav-parent-text">{{ navSection.sectionTitle }}</span>
              </button>
              <div v-show="isSectionExpanded(navSection.sectionTitle)" class="ai-world-page__nav-children">
                <button v-for="(child, childIdx) in navSection.children" :key="child.flatIndex" type="button"
                  class="ai-world-page__nav-item ai-world-page__nav-item--sub"
                  :class="{ 'ai-world-page__nav-item--active': activeSectionIndex === child.flatIndex }"
                  @click="selectChild(navSection.sectionTitle, childIdx, child.flatIndex, true)">
                  {{ getNavChildLabel(navSection.sectionTitle, child.subTitle) }}
                </button>
              </div>
            </template>
          </template>
        </nav>
        </aside>
      </Teleport>

      <div class="ai-world-page__container">
        <!-- 标题区：Hero 轮播图 - 重构为带叠层内容与高级样式的卡片式轮播 -->
        <section class="ai-world-page__hero" :aria-label="t('common.aiWorldCarousel')">
          <div class="ai-world-page__hero-carousel-wrap">
            <el-carousel :interval="4500" height="440px" indicator-position="none" arrow="hover"
              class="ai-world-page__hero-carousel">
              <el-carousel-item v-for="(item, idx) in heroCarouselItems" :key="idx">
                <div
                  class="ai-world-page__hero-slide"
                  role="button"
                  tabindex="0"
                  :aria-label="`${t('aiWorld.heroCarousel')} ${Number(idx) + 1}, ${t('aiWorld.heroCta')}`"
                  @click="handleHeroImageClick(idx)"
                  @keydown.enter="handleHeroImageClick(idx)"
                  @keydown.space.prevent="handleHeroImageClick(idx)"
                >
                  <div class="ai-world-page__hero-slide__media">
                    <img
                      :src="item.src"
                      :alt="`${t('aiWorld.heroCarousel')} ${Number(idx) + 1}`"
                      class="ai-world-page__hero-slide__img"
                      loading="lazy"
                      @error="handleHeroImageError"
                    />
                  </div>
                  <div class="ai-world-page__hero-slide__overlay" aria-hidden="true" />
                  <div class="ai-world-page__hero-slide__content">
                    <h2 class="ai-world-page__hero-slide__title">{{ t('aiWorld.heroOverlayTitle') }}</h2>
                    <p class="ai-world-page__hero-slide__subtitle">{{ t('aiWorld.heroOverlaySubtitle') }}</p>
                    <span class="ai-world-page__hero-slide__cta">{{ t('aiWorld.heroCta') }}</span>
                  </div>
                </div>
              </el-carousel-item>
            </el-carousel>
          </div>
        </section>

        <div v-if="loading" class="ai-world-page__loading">
          <span>{{ t('aiWorld.loading') }}</span>
        </div>

        <div v-else-if="hasError" class="ai-world-page__empty">
          <p>{{ t('common.errors.loadFailed') }}</p>
          <button type="button" class="ai-world-page__back-btn" @click="fetchList">{{ t('common.retry') }}</button>
        </div>

        <!-- 详情模式：点击「查看更多」后，整个内容区仅显示该分类的全部内容 -->
        <template v-else-if="isDetailMode">
          <header class="ai-world-page__detail-header">
            <button type="button" class="ai-world-page__back-btn" @click="handleBackToList">
              {{ t('aiWorld.back') }}
            </button>
            <h2 class="ai-world-page__detail-title">
              {{ detailSectionTitle }}{{ detailSubSection ? ` / ${formatSubTitleForDisplay(detailSubSection)}` : '' }}
            </h2>
          </header>
          <section class="ai-world-page__section">
            <div class="ai-world-page__grid">
              <RouterLink v-for="item in detailItems" :key="item.id"
                :to="{ name: 'aiWorldDetail', params: { id: item.id } }" class="ai-world-card"
                :style="{ backgroundColor: 'var(--color-gray-light)' }">
                <div class="ai-world-card__icon-wrap">
                  <img :src="item.coverUrl" :alt="item.title" class="ai-world-card__icon" loading="lazy"
                    @error="handleImageError" />
                </div>
                <div class="ai-world-card__content" :style="{ backgroundColor: 'transparent' }">
                  <h3 class="ai-world-card__title">{{ item.title }}</h3>
                  <p v-if="item.description" class="ai-world-card__desc">{{ item.description }}</p>
                </div>
              </RouterLink>
            </div>
          </section>
        </template>

        <template v-else-if="sectionNavTreeWithIndex.length">
          <div v-for="navSection in sectionNavTreeWithIndex" :key="navSection.sectionTitle"
            class="ai-world-page__content-section">
            <!-- 标题 + 右侧查看更多 -->
            <header class="ai-world-page__content-section-header">
              <h2 class="ai-world-page__content-section-title">{{ navSection.sectionTitle }}</h2>
              <button type="button" class="ai-world-page__view-more" @click="handleViewMore(navSection)">
                {{ t('aiWorld.viewMore') }}
              </button>
            </header>
            <!-- 子分类：横向标签（有二级时显示），点击切换当前 section 显示的子项 -->
            <div
              v-if="navSection.children.length > 1 || (navSection.children.length === 1 && navSection.children[0].subTitle)"
              class="ai-world-page__tabs">
              <button v-for="(child, childIdx) in navSection.children" :key="child.flatIndex" type="button"
                class="ai-world-page__tab"
                :class="{ 'ai-world-page__tab--active': getSelectedChildIndex(navSection.sectionTitle) === childIdx }"
                @click="selectChild(navSection.sectionTitle, childIdx, child.flatIndex)">
                {{ getTabLabel(navSection.sectionTitle, child.subTitle) }}
              </button>
            </div>
            <!-- 仅显示当前选中的子项内容（默认第一个） -->
            <section :id="sectionId(selectedChild(navSection).flatIndex)" class="ai-world-page__section"
              :data-section-index="selectedChild(navSection).flatIndex">
              <div class="ai-world-page__grid">
                <RouterLink v-for="item in selectedChild(navSection).items" :key="item.id"
                  :to="{ name: 'aiWorldDetail', params: { id: item.id } }" class="ai-world-card"
                  :style="{ backgroundColor: 'var(--color-gray-light)' }">
                  <div class="ai-world-card__icon-wrap">
                    <img :src="item.coverUrl" :alt="item.title" class="ai-world-card__icon" loading="lazy"
                      @error="handleImageError" />
                  </div>
                  <div class="ai-world-card__content" :style="{ backgroundColor: 'transparent' }">
                    <h3 class="ai-world-card__title">{{ item.title }}</h3>
                    <p v-if="item.description" class="ai-world-card__desc">{{ item.description }}</p>
                  </div>
                </RouterLink>
              </div>
            </section>
          </div>
        </template>

        <div v-else class="ai-world-page__empty">
          <p>{{ t('aiWorld.empty') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated, onDeactivated, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { loadModule, getCurrentLocale } from '@/locales'
import { logger } from '@/utils/logger'
import {
  getAiWorldList,
  siteToItem,
  buildSectionWithSubs,
  isSubTitleRedundant,
  formatSubTitleForDisplay,
} from '@/api/ai/ai/ai-world'
import type { AiWorldSection, AiWorldSectionWithSubs, AiWorldItem } from '@/api/ai/ai/ai-world'
import aiWorldLb1 from '@/assets/images/aiWorldLb1.jpg?url'
import aiWorldLb2 from '@/assets/images/aiWorldLb2.jpg?url'
import aiWorldLb3 from '@/assets/images/aiWorldLb3.jpg?url'
import aiWorldLb4 from '@/assets/images/aiWorldLb4.jpg?url'
import aiWorldLb5 from '@/assets/images/aiWorldLb5.jpg?url'

defineOptions({
  name: 'AiWorld',
})

const { t } = useI18n()
const router = useRouter()
const baseUrl = import.meta.env.BASE_URL || '/'

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()

/** Hero 轮播图：来自 src/assets/images/aiWorldLb1-5，使用 ?url 确保每张图片独立解析 */
const heroCarouselItems: { src: string }[] = [
  { src: aiWorldLb1 as string },
  { src: aiWorldLb2 as string },
  { src: aiWorldLb3 as string },
  { src: aiWorldLb4 as string },
  { src: aiWorldLb5 as string },
]

function handleHeroImageError(e: Event) {
  const el = e.target as HTMLImageElement
  if (el) el.src = `${baseUrl}images/common/empty.svg`
}

function handleHeroImageClick(idx: number) {
  router.push({ path: `/ai-world/banner-detail/${idx}` })
}

const sections = ref<AiWorldSection[]>([])
const loading = ref(true)
const hasError = ref(false)

/** 详情模式：点击「查看更多」后，整个内容区仅显示该分类的全部内容 */
const isDetailMode = ref(false)
const detailSectionTitle = ref('')
const detailSubSection = ref('')
const detailItems = ref<AiWorldItem[]>([])

/** 带子分类的 section 树（按 subSection 分组） */
const sectionNavTree = computed<AiWorldSectionWithSubs[]>(() =>
  sections.value.map((sec) => buildSectionWithSubs(sec, siteToItem))
)

/** 带 flatIndex 的导航树（子项可点击滚动） */
interface NavChild {
  subTitle: string
  items: AiWorldItem[]
  flatIndex: number
}
interface NavSection {
  sectionTitle: string
  children: NavChild[]
}
const sectionNavTreeWithIndex = computed<NavSection[]>(() => {
  const result: NavSection[] = []
  let idx = 0
  for (const sec of sectionNavTree.value) {
    const children: NavChild[] = sec.children.map((ch) => ({
      subTitle: ch.subTitle,
      items: ch.items,
      flatIndex: idx++,
    }))
    result.push({ sectionTitle: sec.sectionTitle, children })
  }
  return result
})

/** 扁平块列表：用于内容区渲染与滚动定位 */
interface FlatBlock {
  sectionTitle: string
  subTitle: string
  items: AiWorldItem[]
  flatIndex: number
}
const _flatBlocks = computed<FlatBlock[]>(() => {
  const list: FlatBlock[] = []
  let idx = 0
  for (const sec of sectionNavTree.value) {
    for (const child of sec.children) {
      list.push({
        sectionTitle: sec.sectionTitle,
        subTitle: child.subTitle,
        items: child.items,
        flatIndex: idx++,
      })
    }
  }
  return list
})

/** 侧边栏子项展示文案：无「全部」，重复或空时用主分类名，含 | 的格式化为 / */
function getNavChildLabel(sectionTitle: string, subTitle: string): string {
  if (isSubTitleRedundant(sectionTitle, subTitle) || !subTitle?.trim()) return sectionTitle
  return formatSubTitleForDisplay(subTitle)
}

function handleImageError(e: Event) {
  const el = e.target as HTMLImageElement
  if (el) el.src = '/images/common/empty.svg'
}

/** 用于滚动定位的 section id 前缀 */
const SECTION_ID_PREFIX = 'aw-section-'

function sectionId(index: number): string {
  return `${SECTION_ID_PREFIX}${index}`
}

/** 顶部全局导航高度偏移（选中菜单时内容贴在导航下方显示；移动端需兼容 sticky 菜单栏高度） */
const SCROLL_OFFSET = 160

function scrollToSection(flatIndex: number) {
  const el = document.getElementById(sectionId(flatIndex))
  if (!el) {
    activeSectionIndex.value = flatIndex
    return
  }
  // scrollIntoView 会滚动最近的滚动祖先（#main-content 或 window），scroll-margin-top 控制顶部留白
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeSectionIndex.value = flatIndex
}

/** 选择某 section 的子项：更新选中状态并高亮，可选滚动到该 section */
function selectChild(sectionTitle: string, childIdx: number, flatIndex: number, scroll = false) {
  selectedChildIndexBySection.value = {
    ...selectedChildIndexBySection.value,
    [sectionTitle]: childIdx,
  }
  activeSectionIndex.value = flatIndex
  if (scroll) scrollToSection(flatIndex)
}

/** 当前 section 选中的子项下标（默认 0） */
function getSelectedChildIndex(sectionTitle: string): number {
  return selectedChildIndexBySection.value[sectionTitle] ?? 0
}

/** 当前 section 选中的子项对象（默认第一个） */
function selectedChild(navSection: NavSection): NavChild {
  if (navSection.children.length === 0) {
    return { subTitle: '', items: [], flatIndex: -1 }
  }
  const idx = Math.min(
    getSelectedChildIndex(navSection.sectionTitle),
    navSection.children.length - 1
  )
  return navSection.children[idx >= 0 ? idx : 0]
}

/** 内容区横向标签文案：无「全部」，空则用主分类名 */
function getTabLabel(sectionTitle: string, subTitle: string): string {
  const s = (subTitle || '').trim()
  return s ? formatSubTitleForDisplay(subTitle) : sectionTitle
}

/** 当前滚动到的 section 索引（用于高亮左侧菜单项） */
const activeSectionIndex = ref(0)

/** 有二级菜单时，每个 section 当前选中的子项下标，默认 0（第一个） */
const selectedChildIndexBySection = ref<Record<string, number>>({})

/** 二级菜单展开状态（sectionTitle -> 是否展开），默认全部展开，可点击父级收起/展开 */
const expandedSections = ref<Set<string>>(new Set())

/** 有二级的 section 是否展开 */
function isSectionExpanded(sectionTitle: string): boolean {
  return expandedSections.value.has(sectionTitle)
}

/** 一级菜单是否有子项被选中（用于父级选中效果） */
function isNavSectionActive(navSection: NavSection): boolean {
  return navSection.children.some((ch) => ch.flatIndex === activeSectionIndex.value)
}

/** 根据 flatIndex 获取所属的 section（用于选中时展开对应二级菜单、收起其他） */
function getSectionTitleByFlatIndex(flatIndex: number): string | null {
  for (const sec of sectionNavTreeWithIndex.value) {
    if (sec.children.some((ch) => ch.flatIndex === flatIndex)) return sec.sectionTitle
  }
  return null
}

function toggleSection(sectionTitle: string) {
  const next = new Set(expandedSections.value)
  if (next.has(sectionTitle)) next.delete(sectionTitle)
  else next.add(sectionTitle)
  expandedSections.value = next
}

// 数据加载后，二级菜单默认全部展开，便于用户看到全部分类与内容
watch(
  () => sectionNavTreeWithIndex.value,
  (tree: NavSection[]) => {
    if (tree.length === 0) {
      expandedSections.value = new Set()
      return
    }
    expandedSections.value = new Set(tree.map((s: NavSection) => s.sectionTitle))
  },
  { immediate: true, deep: true }
)

// 选中其他菜单时：仅当切换到不同 section 时收起/展开；选中同一一级菜单下的内容时保持展开
watch(
  () => activeSectionIndex.value,
  (idx) => {
    const sectionTitle = getSectionTitleByFlatIndex(idx)
    if (!sectionTitle) return
    // 若当前已展开的 section 包含选中项，则不收起（同 section 内切换子项时）
    const currentExpanded = [...expandedSections.value]
    if (currentExpanded.some((t) => t === sectionTitle)) return
    expandedSections.value = new Set([sectionTitle])
  }
)

/** 页面根节点 ref，用于限定查询范围 */
const pageRef = ref<HTMLElement | null>(null)

/** 是否为 tablet-down（与 _breakpoints tablet-down 一致：max-width 1279px），Teleport 在此断点禁用以保留 sticky 侧栏 */
const isTabletDown = ref(false)
const TABLET_DOWN_MAX = 1279
let tabletDownMq: MediaQueryList | null = null
let tabletDownHandler: ((e: MediaQueryListEvent) => void) | null = null

function setupTabletDownListener() {
  tabletDownMq = window.matchMedia(`(max-width: ${TABLET_DOWN_MAX}px)`)
  isTabletDown.value = tabletDownMq.matches
  tabletDownHandler = (e: MediaQueryListEvent) => {
    isTabletDown.value = e.matches
  }
  tabletDownMq.addEventListener('change', tabletDownHandler)
}

function teardownTabletDownListener() {
  if (tabletDownMq && tabletDownHandler) {
    tabletDownMq.removeEventListener('change', tabletDownHandler)
    tabletDownMq = null
    tabletDownHandler = null
  }
}

/** 根据滚动位置更新左侧菜单高亮（在 rAF 中读 getBoundingClientRect，确保布局已更新） */
let scrollRafId: number | null = null
function updateActiveByScroll() {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const page = pageRef.value
    if (!page || sectionNavTreeWithIndex.value.length === 0) return
    const blocks = page.querySelectorAll<HTMLElement>('[data-section-index]')
    if (!blocks.length) return
    const headerOffset = SCROLL_OFFSET
    let currentFlatIndex = 0
    for (let i = 0; i < blocks.length; i++) {
      const el = blocks[i]
      const top = el.getBoundingClientRect().top
      const flatIndex = parseInt(el.getAttribute('data-section-index') ?? '0', 10)
      if (top <= headerOffset) currentFlatIndex = flatIndex
    }
    activeSectionIndex.value = currentFlatIndex
  })
}

let scrollContainer: HTMLElement | null = null

/** 绑定滚动监听：优先 #main-content（官网主内容区滚动容器），并监听 window 兜底 */
function attachScrollListeners() {
  detachScrollListeners()
  const main = document.getElementById('main-content')
  if (main) {
    scrollContainer = main
    main.addEventListener('scroll', updateActiveByScroll, { passive: true })
  }
  window.addEventListener('scroll', updateActiveByScroll, { passive: true })
}

function detachScrollListeners() {
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', updateActiveByScroll)
    scrollContainer = null
  }
  window.removeEventListener('scroll', updateActiveByScroll)
}

/** 定时轮询兜底：确保滚动时高亮能更新（部分环境下 scroll 事件可能不触发） */
let scrollPollTimer: ReturnType<typeof setInterval> | null = null
const SCROLL_POLL_MS = 150

function startScrollPoll() {
  stopScrollPoll()
  scrollPollTimer = setInterval(updateActiveByScroll, SCROLL_POLL_MS)
}

function stopScrollPoll() {
  if (scrollPollTimer) {
    clearInterval(scrollPollTimer)
    scrollPollTimer = null
  }
}

/** Intersection Observer：以视口为 root，避免依赖具体滚动容器 */
let intersectionObserver: IntersectionObserver | null = null
const intersectingFlatIndices = ref<Set<number>>(new Set())

function updateActiveFromIntersecting() {
  const set = intersectingFlatIndices.value
  if (set.size === 0) return
  const minIdx = Math.min(...set)
  activeSectionIndex.value = minIdx
}

function setupIntersectionObserver() {
  intersectionObserver?.disconnect()
  intersectionObserver = null
  const page = pageRef.value
  if (!page) return
  const root = document.getElementById('main-content')
  const rootMargin = `-${SCROLL_OFFSET}px 0px 0px 0px`
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      const next = new Set(intersectingFlatIndices.value)
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement
        const flatIndex = parseInt(el.getAttribute('data-section-index') ?? '0', 10)
        if (entry.isIntersecting) next.add(flatIndex)
        else next.delete(flatIndex)
      })
      intersectingFlatIndices.value = next
      updateActiveFromIntersecting()
    },
    { root: root ?? null, rootMargin, threshold: 0 }
  )
  const blocks = page.querySelectorAll<HTMLElement>('[data-section-index]')
  blocks.forEach((el) => intersectionObserver?.observe(el))
}

function teardownIntersectionObserver() {
  intersectionObserver?.disconnect()
  intersectionObserver = null
  intersectingFlatIndices.value = new Set()
}

// 内容或 tab 变化后重新建立 observer
watch(
  () => [sectionNavTreeWithIndex.value.length, selectedChildIndexBySection.value],
  () => {
    nextTick(() => {
      if (pageRef.value?.querySelector('[data-section-index]')) {
        setupIntersectionObserver()
        updateActiveByScroll()
      }
    })
  },
  { deep: true }
)

function setupScrollHighlight() {
  attachScrollListeners()
  startScrollPoll()
  nextTick(() => {
    if (pageRef.value?.querySelector('[data-section-index]')) {
      setupIntersectionObserver()
      updateActiveByScroll()
    }
  })
}

onMounted(() => {
  setupTabletDownListener()
  // 加载 aiWorld i18n 模块, 确保 t() 能正确翻译
  loadModule(getCurrentLocale(), 'aiWorld').catch((e) => {
    logger.warn('[AiWorld] Failed to load aiWorld i18n module:', e)
  })
  fetchList().then(() => {
    nextTick(() => {
      setTimeout(setupScrollHighlight, 100)
    })
  }).catch((e) => { console.error(e) })
})

onActivated(() => {
  if (sectionNavTreeWithIndex.value.length > 0) {
    nextTick(() => {
      setTimeout(setupScrollHighlight, 50)
    })
  }
})

onDeactivated(() => {
  stopScrollPoll()
  detachScrollListeners()
  teardownIntersectionObserver()
})

cleanup.add(() => {
  teardownTabletDownListener()
  stopScrollPoll()
  detachScrollListeners()
  teardownIntersectionObserver()
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
})

async function fetchList() {
  loading.value = true
  hasError.value = false
  try {
    const res = await getAiWorldList({ pageNum: 1, pageSize: 12 })
    if (res.success && Array.isArray(res.data)) {
      sections.value = res.data
    } else {
      sections.value = []
    }
  } catch {
    sections.value = []
    hasError.value = true
  } finally {
    loading.value = false
  }
}

/**
 * 点击「查看更多」：切换为详情模式，用选中的 section/subSection 替换整个内容区，
 * 并调用 GET /bot/sites/kind?pageNum=1&pageSize=50&section=xxx&subSection=xxx
 */
async function handleViewMore(navSection: NavSection) {
  const sectionTitle = navSection.sectionTitle
  const child = selectedChild(navSection)
  const subTitle = isSubTitleRedundant(sectionTitle, child.subTitle) ? '' : (child.subTitle || '').trim()

  isDetailMode.value = true
  detailSectionTitle.value = sectionTitle
  detailSubSection.value = subTitle
  loading.value = true
  detailItems.value = []

  try {
    const params: { pageNum: number; pageSize: number; section: string; subSection?: string } = {
      pageNum: 1,
      pageSize: 50,
      section: sectionTitle,
    }
    if (subTitle) params.subSection = subTitle
    const res = await getAiWorldList(params)
    if (res.success && Array.isArray(res.data)) {
      const items: AiWorldItem[] = []
      for (const sec of res.data) {
        for (const site of sec.aiBotSites || []) {
          items.push(siteToItem(site))
        }
      }
      detailItems.value = items
    }
  } catch {
    detailItems.value = []
  } finally {
    loading.value = false
  }
}

function handleBackToList() {
  isDetailMode.value = false
  detailSectionTitle.value = ''
  detailSubSection.value = ''
  detailItems.value = []
}

</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

/* 颜色：整体页面灰色背景，菜单栏与内容区白色浮层 */
$aw-gray-page: var(--color-neutral-100);

/* 整体页面背景（灰色） */
$aw-panel-bg: var(--el-bg-color);

/* 菜单栏、内容区白色背景 */
$aw-gray-card: var(--color-gray-fafafa);

/* 卡片背景（略亮于页面，与背景区分） */
$aw-gray-elevated: var(--color-gray-e8e8e8);

/* 悬停、选中、图标容器略深 */
$aw-gray-border: var(--color-text-muted);

/* 描边 */

/* 整体页面灰色背景（不含顶部导航栏），菜单栏与内容区白色 */
.ai-world-page {
  --ai-world-page-bg: #{$aw-gray-page};
  --ai-world-panel-bg: #{$aw-panel-bg};

  min-height: 100vh;
  background-color: var(--ai-world-page-bg);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.ai-world-page__bg {
  position: absolute;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  background-color: var(--ai-world-page-bg);
}

.ai-world-page__wrap {
  position: relative;
  z-index: var(--z-base);
  width: 100%;
  min-height: 100vh;
}

/* 左侧菜单栏：固定于视口左侧，与顶部导航栏间距 10px，不随内容滚动 */
.ai-world-page__nav {
  position: fixed;
  left: 10px;
  top: calc(var(--global-header-height) + 10px);
  width: 200px;
  height: calc(100vh - var(--global-header-height) - 20px);
  padding: 8px 20px 20px;
  overflow-y: auto;
  z-index: calc(var(--z-base) + 9);
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  font-family: var(--el-font-family, var(--font-family-chinese));
  font-weight: 500;

  @include bp.tablet-down {
    position: sticky;
    top: calc(var(--global-header-height) + 10px);
    height: auto;
    width: 100%;
    padding: 20px;
    border-right: none;
    border-bottom: var(--unified-border-bottom);
    overflow-y: visible;
    z-index: calc(var(--z-base) + 19);
    background-color: var(--el-bg-color);
  }
}

/* 侧栏内所有按钮统一字重，避免选中/未选中粗细不一致 */
.ai-world-page__nav button {
  font-weight: 500;
}

.ai-world-page__nav-inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  min-width: 0;

  @include bp.tablet-down {
    flex-flow: row wrap;
    gap: 8px;
  }
}

/* 有左侧菜单时，主内容区左移留出空间：10px + 200px + 10px */
.ai-world-page__nav+.ai-world-page__container {
  margin-left: 220px;

  @include bp.tablet-down {
    margin-left: 0;
  }
}

/* 侧栏 Teleport 到 body 时，wrap 无 nav 兄弟，用 modifier 为内容区留出左侧空间 */
.ai-world-page__wrap--nav-fixed > .ai-world-page__container {
  margin-left: 220px;
  width: calc(100% - 230px);

  @include bp.tablet-down {
    margin-left: 0;
    width: 100%;
  }
}

.ai-world-page__nav-parent {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.02em;
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  text-align: center;
  transition: color 0.2s ease, background 0.2s ease;
  box-sizing: border-box;
  min-width: 0;

  &:hover {
    color: var(--el-text-color-primary);
    background: $aw-gray-elevated;
  }

  &--active {
    color: var(--el-text-color-primary);
    background: $aw-gray-elevated;
    font-weight: 500;
  }
}

.ai-world-page__nav-children {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  min-width: 0;
}

.ai-world-page__nav-parent-text {
  white-space: normal;
  word-break: break-word;
  text-align: center;
  font-weight: 500;
}

.ai-world-page__nav-item {
  display: block;
  width: 100%;
  padding: 10px 14px;
  min-height: 40px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  text-align: center;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
  box-sizing: border-box;
  min-width: 0;

  &:hover {
    color: var(--el-text-color-primary);
    background: $aw-gray-elevated;
  }

  &--active {
    color: var(--el-text-color-primary);
    background: $aw-gray-elevated;
    font-weight: 500;
  }

  /* 二级子项：较一级菜单小一号 */
  &--sub {
    font-size: 12px;
  }

  @include bp.tablet-down {
    width: auto;
    padding: 8px 14px;
    font-size: 13px;
    border-radius: var(--global-border-radius);
  }
}

/* 内容区：白色背景，上右下外边距 10px，8px 圆角，描边 */
.ai-world-page__container {
  position: relative;
  width: 100%;
  padding: 24px 24px 48px;
  padding-top: 0;

  /* Hero 轮播顶部由 carousel item padding 20px 控制 */
  box-sizing: border-box;
  background-color: var(--ai-world-panel-bg);
  margin-top: 10px;
  margin-right: 10px;
  margin-bottom: 10px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);

  @include bp.tablet-down {
    padding: 16px 16px 32px;
    margin-right: 0;
    margin-bottom: 0;
  }
}

/* 有左侧导航时：占满右侧剩余宽度，左外边距 220px，右留 10px */
.ai-world-page__nav+.ai-world-page__container {
  width: calc(100% - 230px);

  /* 220px 左侧 + 10px 右侧 */
  margin-left: 220px;

  @include bp.tablet-down {
    width: 100%;
    margin-left: 0;
  }
}

/* 标题区：Hero 轮播图 - 容器与图片同大，无边框/阴影，两侧铺满无留白 */
.ai-world-page__hero {
  margin-left: -24px;
  margin-right: -24px;
  width: calc(100% + 48px);
  padding: 0 0 20px;
  text-align: center;

  @include bp.tablet-down {
    margin-left: -16px;
    margin-right: -16px;
    width: calc(100% + 32px);
  }
}

.ai-world-page__hero-carousel-wrap {
  width: 100%;
  overflow: hidden;
}

.ai-world-page__hero-carousel {
  width: 100%;

  :deep(.el-carousel__container) {
    height: 440px;
  }

  :deep(.el-carousel__item) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  }

  :deep(.el-carousel__arrow) {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-white-90);
    border: var(--unified-border);
    color: var(--el-text-color-regular);
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;

    &:hover {
      background: var(--el-bg-color);
      color: var(--el-text-color-primary);
      border-color: var(--el-border-color);
    }
  }

  :deep(.el-carousel__arrow .el-icon) {
    font-size: 18px;
  }
}

/* Hero 单张幻灯片：可点击卡片容器，含媒体层 + 渐变叠层 + 文案与 CTA */
.ai-world-page__hero-slide {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  width: 100%;
  height: 100%;
  min-height: 400px;
  position: relative;
  cursor: pointer;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  border: var(--unified-border);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.01);
    box-shadow: var(--global-box-shadow);
  }

  &:focus-visible {
    outline: var(--el-border-width-primary) solid var(--el-color-primary);
    outline-offset: 2px;
  }
}

.ai-world-page__hero-slide__media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.ai-world-page__hero-slide__img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 400px;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.ai-world-page__hero-slide:hover .ai-world-page__hero-slide__img {
  transform: scale(1.03);
}

/* 底部渐变叠层，保证文字可读 */
.ai-world-page__hero-slide__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    var(--color-black-75) 0%,
    color-mix(in srgb, var(--el-color-primary) 35%, transparent) 35%,
    transparent 65%
  );
  pointer-events: none;
}

/* 叠层上的文案区：左下对齐，留白充足 */
.ai-world-page__hero-slide__content {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 28px 32px 32px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  pointer-events: none;
  z-index: var(--z-base);

  @include bp.tablet-down {
    padding: 20px 24px 24px;
    gap: 8px;
  }
}

.ai-world-page__hero-slide__title {
  margin: 0;
  font-size: clamp(1.25rem, 1rem + 0.8vw, 1.75rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--color-gray-ededed);
  line-height: 1.25;
}

.ai-world-page__hero-slide__subtitle {
  margin: 0;
  font-size: clamp(0.8125rem, 0.75rem + 0.35vw, 0.9375rem);
  font-weight: 400;
  letter-spacing: 0.01em;
  color: var(--color-white-85);
  line-height: 1.45;
  max-width: 520px;
}

.ai-world-page__hero-slide__cta {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  padding: 10px 20px;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--color-gray-111);
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
  cursor: pointer;
}

.ai-world-page__hero-slide:hover .ai-world-page__hero-slide__cta {
  background: var(--color-gray-fafafa);
  border-color: var(--el-bg-color);
  color: var(--color-dark-bg-1);
}

/* 内容区：按 section 分组，标题 + 横向子标签 + 卡片网格 */
.ai-world-page__content-section {
  margin-bottom: 48px;

  &:last-child {
    margin-bottom: 0;
  }
}

.ai-world-page__content-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.ai-world-page__content-section-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  margin: 0;
  min-width: 0;
}

/* 横向子标签：未选=浅底灰字，选中=深底白字，对比明显不反 */
.ai-world-page__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.ai-world-page__tab {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  background: $aw-gray-card;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  font-family: inherit;

  &:hover {
    color: var(--el-text-color-primary);
    border-color: $aw-gray-border;
    background: $aw-gray-elevated;
  }

  /* 选中：主题色底 + 与主色对比的文字（亮色主题黑底白字，暗色主题白底黑字） */
  &--active {
    color: var(--el-bg-color-page);
    background: var(--el-color-primary);
    border: var(--el-border-width-primary) solid var(--el-color-primary);

    &:hover {
      color: var(--el-bg-color-page);
      background: var(--el-color-primary-dark-2);
      border-color: var(--el-color-primary-dark-2);
    }
  }
}

/* 滚动到该区块时保留顶部间距（与 SCROLL_OFFSET 一致），单级/二级点击后内容能贴导航下方 */
.ai-world-page__section {
  margin-top: 8px;
  scroll-margin-top: 160px;

  /* 与 SCROLL_OFFSET 一致，避免被 sticky 菜单栏遮挡 */
}

.ai-world-page__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.ai-world-page__section-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  margin: 0;
}

.ai-world-page__section-sub {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-left: 8px;
}

.ai-world-page__view-more {
  flex-shrink: 0;
  margin-left: 16px;
  padding: 6px 10px;
  min-height: 32px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: var(--el-text-color-primary);
  }

  @media (width <= 767px) {
    min-height: 40px;
    padding: 8px 12px;
  }
}

.ai-world-page__detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.ai-world-page__back-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  background: $aw-gray-elevated;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-family: inherit;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;

  &:hover {
    color: var(--el-text-color-primary);
    background: var(--color-text-muted);
    border-color: $aw-gray-border;
  }
}

.ai-world-page__detail-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
  margin: 0;
  min-width: 0;
}

.ai-world-page__loading,
.ai-world-page__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 64px 24px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 卡片网格：与文档中心 doc-matrix 类似的响应式 */
.ai-world-page__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;

  @include bp.tablet-down {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  @media (width <= 480px) {
    grid-template-columns: 1fr;
  }
}

/* 卡片：与页面统一灰阶，12px 圆角、极细描边；强制覆盖任何全局白底 */
.ai-world-card {
  --aw-card-bg: #{$aw-gray-card};
  --aw-card-border: #{$aw-gray-border};

  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  background: var(--aw-card-bg);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  text-decoration: none;
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    background: var(--aw-card-bg);
    color: var(--el-text-color-primary);
  }

  &--no-link {
    cursor: default;
    pointer-events: none;

    &:hover {
      transform: none;
      border-color: var(--aw-card-border);
      background: var(--aw-card-bg);
    }
  }
}

.ai-world-card__icon-wrap {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: $aw-gray-elevated;
}

.ai-world-card__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ai-world-card__content {
  flex: 1;
  min-width: 0;
  background: transparent;
  transition: none;
}

/* 标题和描述：纯文本无背景，效果完全跟随卡片，覆盖全局 [class*="card"] 误匹配 */
.ai-world-card__title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
  margin: 0 0 6px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  background: none;
  background-color: transparent;
  border: none;
  box-shadow: none;
}

.ai-world-card__desc {
  font-size: 13px;
  font-weight: 400;
  color: var(--el-text-color-primary);
  margin: 0;
  line-height: 1.45;
  letter-spacing: 0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  background: none;
  background-color: transparent;
  border: none;
  box-shadow: none;
}
</style>

<!-- 全局：Teleport 侧栏字重统一 + 卡片背景（规范：Teleport 用全局样式块、完整 BEM、提高特异性用 CSS 变量控制） -->
<style lang="scss">
/* 侧栏字重统一：Teleport 到 body 时用 BEM 单类覆盖全局 button，禁止高特异性 */
.ai-world-page__nav,
  .ai-world-page__nav .ai-world-page__nav-inner,
  .ai-world-page__nav button,
  .ai-world-page__nav .ai-world-page__nav-parent,
  .ai-world-page__nav .ai-world-page__nav-parent-text,
  .ai-world-page__nav .ai-world-page__nav-item {
  font-weight: 500;
}

.ai-world-page .ai-world-card {
  background: var(--color-gray-fafafa);
}

.ai-world-page .ai-world-card:hover {
  background: var(--color-neutral-100);
}

.ai-world-page .ai-world-card__title,
.ai-world-page .ai-world-card__desc {
  background: none;
  background-color: transparent;
  border: none;
  box-shadow: none;
}

/* 暗色模式：整体页面深色，菜单栏与内容区为 elevated 浮层 - 使用 :where(html.dark) 降低特异性 */
:where(html.dark) .ai-world-page {
  --ai-world-page-bg: var(--el-bg-color-page);
  --ai-world-panel-bg: var(--el-bg-color);

  .ai-world-page__nav {
    background-color: var(--el-bg-color);
  }

  .ai-world-page__tab {
    color: var(--el-text-color-regular);
    background: var(--color-white-6);
    border-color: var(--el-border-color);

    &:hover {
      color: var(--el-text-color-primary);
      background: var(--color-white-10);
    }

    &--active {
      color: var(--el-bg-color-page);
      background: var(--el-color-primary);
      border: var(--el-border-width-primary) solid var(--el-color-primary);

      &:hover {
        background: var(--el-color-primary-dark-2);
        border-color: var(--el-color-primary-dark-2);
      }
    }
  }

  .ai-world-page__back-btn {
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-dark);
    border-color: var(--el-border-color);

    &:hover {
      color: var(--el-text-color-primary);
      background: var(--el-fill-color-darker);
      border-color: var(--el-border-color-hover);
    }
  }

  .ai-world-page__nav-parent {
    color: var(--el-text-color-secondary);

    &:hover {
      color: var(--el-text-color-primary);
      background: var(--el-fill-color-darker);
    }

    &--active {
      color: var(--el-text-color-primary);
      background: var(--el-fill-color-dark);
    }
  }

  .ai-world-page__nav-item {
    color: var(--el-text-color-secondary);

    &:hover {
      color: var(--el-text-color-primary);
      background: var(--el-fill-color-darker);
    }

    &--active {
      color: var(--el-text-color-primary);
      background: var(--el-fill-color-dark);
    }
  }

  .ai-world-card {
    --aw-card-bg: var(--color-white-8);
    --aw-card-border: var(--el-border-color);

    background: var(--color-white-8);

    &:hover {
      background: var(--color-white-12);
    }
  }

  .ai-world-card__title,
  .ai-world-card__desc {
    color: var(--el-text-color-primary);
  }

  .ai-world-card__icon-wrap {
    background: var(--el-fill-color-dark);
  }
}

/* 侧栏 Teleport 到 body 时不在 .ai-world-page 内，暗色模式需单独覆盖 */
:where(html.dark) .ai-world-page__nav {
  background-color: var(--el-bg-color);
}
</style>
