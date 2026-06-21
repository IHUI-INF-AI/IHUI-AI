<!--
  语言切换器
  从原 HeaderActions.vue 抽出,负责:
   - 国旗 + 语言名 + 下拉箭头显示
   - 鼠标/键盘触发
   - Teleport 到 body 的下拉面板
   - 选中状态高亮
   - 全局样式已抽到 styles/_header-actions.scss
-->
<template>
  <div
    ref="selectorEl"
    class="language-selector"
    role="button"
    :aria-label="t('common.selectLanguage')"
    :aria-expanded="visible"
    :aria-haspopup="true"
    tabindex="0"
    @click="open"
    @mouseenter="open"
    @mouseleave="onSelectorLeave"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <img
      v-if="getFlagSrc(currentCode)"
      class="flag-icon"
      :src="getFlagSrc(currentCode)"
      :alt="currentText"
      loading="lazy"
    />
    <span v-else class="flag-badge">{{ currentAbbr }}</span>
    <span class="language-text">{{ currentText }}</span>
    <i class="el-icon-arrow-down el-icon--right" :class="{ 'arrow-rotate': visible }" />
  </div>

  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuEl"
      class="language-dropdown-menu"
      role="menu"
      :aria-label="t('common.selectLanguage')"
      @mouseenter="open"
      @mouseleave="onMenuLeave"
    >
      <a
        v-for="lang in languages"
        :key="lang.code"
        class="language-option"
        :class="{ active: currentCode === lang.code }"
        role="menuitem"
        :aria-label="lang.name"
        :aria-selected="currentCode === lang.code"
        @click="select(lang.code)"
        @keydown.enter.prevent="select(lang.code)"
      >
        <img
          v-if="getFlagSrc(lang.code)"
          class="flag-icon"
          :src="getFlagSrc(lang.code)"
          :alt="lang.name"
          loading="lazy"
        />
        <span v-else class="flag-badge">{{ getAbbr(lang.code) }}</span>
        <span class="language-name">{{ lang.name }}</span>
      </a>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import {
  switchLanguage,
  supportedLanguages,
  getCurrentLanguage,
  type Language,
} from '@/composables/useLang'

const emit = defineEmits<{
  (e: 'change', lang: Language): void
}>()

const { t, locale } = useI18n()

const VALID_LANGUAGES: Language[] = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

const FLAG_SRC: Record<string, string> = {
  'zh-CN': '/images/flags/zh-CN.svg',
  'zh-TW': '/images/flags/zh-TW.svg',
  en: '/images/flags/en.svg',
  ja: '/images/flags/ja.svg',
  ko: '/images/flags/ko.svg',
}
const ABBR_MAP: Record<string, string> = {
  'zh-CN': 'CN',
  'zh-TW': 'TW',
  en: 'EN',
  ja: 'JA',
  ko: 'KO',
}

const getFlagSrc = (code: string): string => FLAG_SRC[code] || ''
const getAbbr = (code: string): string => ABBR_MAP[code] || 'LANG'

const visible = ref(false)
const menuEl = ref<HTMLElement | null>(null)
const selectorEl = ref<HTMLElement | null>(null)

const currentCode = computed<Language>(() => {
  const global = getCurrentLanguage.value as string | undefined
  if (global) return global as Language
  const loc = locale as unknown
  if (loc && typeof loc === 'object' && 'value' in loc) {
    return ((loc as { value?: string }).value || 'zh-CN') as Language
  }
  return ((loc as unknown as string) || 'zh-CN') as Language
})

const currentText = computed(() => supportedLanguages[currentCode.value] || supportedLanguages['zh-CN'])
const currentAbbr = computed(() => getAbbr(currentCode.value))

const languages = computed(() =>
  Object.entries(supportedLanguages).map(([code, name]) => ({
    code: code as Language,
    name,
  })),
)

const open = () => {
  visible.value = true
}
const close = () => {
  visible.value = false
}
const toggle = (e?: Event) => {
  e?.preventDefault?.()
  e?.stopPropagation?.()
  visible.value = !visible.value
}

const onSelectorLeave = (e: MouseEvent) => {
  const to = e.relatedTarget as Node | null
  if (menuEl.value && to && (menuEl.value === to || menuEl.value.contains(to))) return
  close()
}
const onMenuLeave = (e: MouseEvent) => {
  const to = e.relatedTarget as Node | null
  if (selectorEl.value && to && (selectorEl.value === to || selectorEl.value.contains(to))) return
  close()
}

const select = (code: string) => {
  if (!VALID_LANGUAGES.includes(code as Language)) return
  switchLanguage(code as Language)
  const loc = locale as unknown
  if (loc && typeof loc === 'object' && 'value' in loc) {
    ;(loc as { value: string }).value = code
  }
  document.documentElement.lang = code
  visible.value = false
  emit('change', code as Language)
}

const updatePosition = async () => {
  await nextTick()
  if (!selectorEl.value || !menuEl.value) return
  const rect = selectorEl.value.getBoundingClientRect()
  const menu = menuEl.value
  const menuWidth = menu.offsetWidth || 160
  const top = rect.bottom + 2
  const maxLeft = window.innerWidth - menuWidth - 8
  const left = Math.max(8, Math.min(rect.left, maxLeft))
  menu.style.left = `${Math.round(left)}px`
  menu.style.top = `${Math.round(top)}px`
  menu.style.right = 'auto'
}

watch(visible, v => v && updatePosition())

const onClickOutside = (e: MouseEvent) => {
  const target = e.target
  if (!(target instanceof Node)) return
  if (selectorEl.value && (selectorEl.value === target || selectorEl.value.contains(target))) return
  if (menuEl.value && (menuEl.value === target || menuEl.value.contains(target))) return
  visible.value = false
}

let resizeRafId: number | null = null
const onResize = () => {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    if (visible.value) updatePosition()
  })
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && visible.value) {
    visible.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize, { passive: true })
})
// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => document.removeEventListener('click', onClickOutside))
cleanup.add(() => document.removeEventListener('keydown', onKeydown))
cleanup.add(() => window.removeEventListener('resize', onResize))
cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
</script>

<style scoped lang="scss">
.language-selector {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  height: 40px;
  min-height: 40px;
  position: relative;
  z-index: var(--z-dropdown);
  gap: 6px;
  padding: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  cursor: pointer;
  border-radius: var(--global-border-radius);
  background-color: transparent;
  border: none;
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  user-select: none;
  line-height: 1;
  box-sizing: border-box;
  flex-shrink: 0;

  .flag-icon {
    width: 18px;
    height: 12px;
    flex-shrink: 0;
    display: block;
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .flag-badge {
    padding: 0 4px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .language-text {
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .el-icon-arrow-down {
    transition: transform 0.3s ease;
    font-size: 14px;
    color: var(--el-text-color-primary);
    flex-shrink: 0;
  }

  .arrow-rotate {
    transform: rotate(180deg);
  }

  &:hover {
    transform: scale(1.06);

    .flag-icon {
      transform: scale(1.1);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }
}

@media (width <= 767px) {
  .language-selector {
    padding: 6px 8px;
    min-width: 36px;

    .language-text,
    .el-icon-arrow-down {
      display: none;
    }

    .flag-icon {
      width: 20px;
      height: 14px;
    }
  }
}
</style>
