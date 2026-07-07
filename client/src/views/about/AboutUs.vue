<template>
  <div class="about-hub">
    <div class="story-bg">
      <div class="gradient-layer" />
      <div class="noise-texture" />
    </div>

    <div class="container">
      <nav class="story-nav ihui-ai-fade-in-top-animation">
        <span class="version-tag">ABOUT HUB</span>
        <div class="hub-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeSection === tab.id"
            :class="['hub-tab', { 'is-active': activeSection === tab.id }]"
            @click="scrollTo(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>
      </nav>
    </div>

    <div class="container section-container">
      <AboutSection />
      <ContactSection />
      <SupplierSection />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSEO } from '@/composables/useSEO'
import { loadModule, getCurrentLocale } from '@/locales'
import AboutSection from './sections/AboutSection.vue'
import ContactSection from './sections/ContactSection.vue'
import SupplierSection from './sections/SupplierSection.vue'

const { t } = useI18n()
const route = useRoute()
const _router = useRouter()

// 2026-07-08: 显式预热 aboutUs + footer 模块, 避免首屏渲染时 i18n key 裸露
// (asyncModules 已注册 aboutUs, 但首次进入页面时模块可能尚未加载, 这里主动触发)
loadModule(getCurrentLocale(), 'aboutUs')

useSEO({
  title: t('about.seo.title'),
  description: t('about.seo.description'),
  keywords: t('about.seo.keywords'),
  ogTitle: t('about.seo.ogTitle'),
  ogDescription: t('about.seo.ogDescription'),
  canonical: 'https://www.zhihui-ai.com/about/about-us',
})

const tabs = [
  { id: 'about', label: t('navigation.aboutUs') },
  { id: 'contact', label: t('navigation.contactUs') },
  { id: 'supplier', label: t('navigation.becomeSupplier') },
] as const

type SectionId = (typeof tabs)[number]['id']
const activeSection = ref<SectionId>('about')

let observer: IntersectionObserver | null = null
let suppressScrollSpyUntil = 0

const scrollTo = (id: SectionId) => {
  const el = document.getElementById(id)
  if (!el) return
  suppressScrollSpyUntil = Date.now() + 800
  activeSection.value = id
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (typeof window !== 'undefined') {
    const next = `${window.location.pathname}#${id}`
    window.history.replaceState(null, '', next)
  }
}

const applyHash = () => {
  const hash = route.hash.replace(/^#/, '')
  if (hash === 'about' || hash === 'contact' || hash === 'supplier') {
    suppressScrollSpyUntil = Date.now() + 800
    activeSection.value = hash
    requestAnimationFrame(() => {
      const el = document.getElementById(hash)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
}

// 2026-07-08: 监听 hash 变化 (侧边栏 hash 跳转时滚动到对应 section)
// 之前 onMounted 只读一次, 用户从侧边栏切换 hash 时不会自动滚动
watch(() => route.hash, () => applyHash())

onMounted(() => {
  applyHash()
  observer = new IntersectionObserver(
    (entries) => {
      if (Date.now() < suppressScrollSpyUntil) return
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) {
        const id = (visible.target as HTMLElement).id as SectionId
        if (id && id !== activeSection.value) {
          activeSection.value = id
        }
      }
    },
    { rootMargin: '-100px 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
  )
  ;['about', 'contact', 'supplier'].forEach((id) => {
    const el = document.getElementById(id)
    if (el && observer) observer.observe(el)
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

.about-hub {
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

.section-container {
  padding-top: 8px;
  padding-bottom: 80px;
}

.story-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
  padding: 24px 0 16px;

  @include bp.min-width(tablet) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 32px 0 20px;
  }

  .version-tag {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    border: var(--unified-border);
    padding: 4px 10px;
    border-radius: var(--global-border-radius);
    align-self: flex-start;

    @include bp.min-width(tablet) {
      align-self: center;
    }
  }
}

.hub-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  background: var(--el-fill-color-extra-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 4px;
}

.hub-tab {
  flex: 1 1 auto;
  min-width: 90px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  background: transparent;
  border: none;
  border-radius: calc(var(--global-border-radius) - 2px);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;

  &:hover {
    color: var(--el-text-color-primary);
  }

  &.is-active {
    background: var(--el-color-primary);
    color: var(--el-color-white);
  }
}
</style>
