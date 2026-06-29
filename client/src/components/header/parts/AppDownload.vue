<!--
  应用下载菜单
  原 HeaderActions.vue 的 AppDownload 部分:
   - 触发器(Download + 文字 + 下拉箭头)
   - 5 个内置下载项(iOS / Android / 微信小程序 / 桌面 / 浏览器扩展)
   - 微信小程序扫码弹窗
   - 移动端隐藏(由父级 @media 控制)
-->
<template>
  <div
    ref="selectorEl"
    class="app-download-selector"
    role="button"
    :aria-label="t('common.downloadApp')"
    :aria-expanded="visible"
    :aria-haspopup="true"
    tabindex="0"
    @click="open"
    @mouseenter="open"
    @mouseleave="onSelectorLeave"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <el-icon class="download-icon">
      <Download />
    </el-icon>
    <span class="download-text">{{ t('common.downloadApp') }}</span>
    <i class="el-icon-arrow-down el-icon--right" :class="{ 'arrow-rotate': visible && !menuAbove }" />
  </div>

  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuEl"
      class="app-download-dropdown-menu"
      :class="{ 'menu-above': menuAbove }"
      role="menu"
      :aria-label="t('common.downloadApp')"
      @mouseenter="open"
      @mouseleave="onMenuLeave"
    >
      <a
        v-for="app in apps"
        :key="app.key"
        class="download-option"
        :class="{ active: current === app.key }"
        role="menuitem"
        :aria-label="app.name"
        :href="app.url === '#' ? undefined : app.url"
        :target="app.target"
        @click="handleClick(app, $event)"
        @keydown.enter.prevent="handleClick(app)"
      >
        <el-icon class="app-icon">
          <component :is="app.icon" />
        </el-icon>
        <span class="app-name">{{ app.name }}</span>
      </a>
    </div>
  </Teleport>

  <!-- 微信小程序扫码弹窗 -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="wechatQrVisible"
        class="wechat-qr-modal-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('hardcoded.headerActions.wechatMiniProgram')"
        @click="wechatQrVisible = false"
      >
        <div class="wechat-qr-modal" @click.stop>
          <div class="modal-header">
            <span class="modal-title">{{ t('hardcoded.headerActions.wechatMiniProgram') }}</span>
            <button
              class="modal-close"
              type="button"
              :aria-label="t('hardcoded.headerActions.close')"
              @click="wechatQrVisible = false"
            >
              <el-icon><Close /></el-icon>
            </button>
          </div>
          <div class="modal-body">
            <img
              src="/footer/erweima/footer-icon-2.png"
              class="qr-code-img"
              :alt="t('hardcoded.headerActions.wechatQrCode')"
              loading="lazy"
            />
            <p class="scan-tip">{{ t('hardcoded.headerActions.scanWechatTip') }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, markRaw, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Download,
  Iphone,
  Cellphone,
  Monitor,
  Connection,
  Tools,
  Close,
} from '@element-plus/icons-vue'
import { usePwa } from '@/composables/usePWA'
import { useCleanup } from '@/composables/useCleanup'
import { useDropdownPosition } from '@/composables/useDropdownPosition'

const { t } = useI18n()
const router = useRouter()
const { isInstallable, isInstalled, install } = usePwa()
const cleanup = useCleanup()

interface AppItem {
  key: string
  name: string
  icon: Component
  url: string
  target: string
  installable?: boolean
}

const visible = ref(false)
const wechatQrVisible = ref(false)
const current = ref<string>('')
const menuEl = ref<HTMLElement | null>(null)
const selectorEl = ref<HTMLElement | null>(null)

// 智能定位:下方放不下时向上弹出,menuAbove 用于同步箭头/动画方向
// AppDownload 最多 6 项(5 内置 + PWA),fallbackHeight 用 235 更准
const { menuAbove, updatePosition: updateMenuPosition } = useDropdownPosition({ fallbackHeight: 235 })

const BASE_APPS: AppItem[] = [
  { key: 'ios', name: 'iOS 应用', icon: markRaw(Iphone), url: '#', target: '_self' },
  {
    key: 'android',
    name: 'Android 应用',
    icon: markRaw(Cellphone),
    url: 'https://file.aizhs.top/sys-center/download/app/%E6%99%BA%E6%B1%87AI.apk',
    target: '_blank',
  },
  { key: 'wechat-miniprogram', name: '微信小程序', icon: markRaw(Connection), url: '#', target: '_self' },
  { key: 'desktop', name: '桌面端', icon: markRaw(Monitor), url: '#', target: '_self' },
  { key: 'browser-extension', name: '浏览器插件', icon: markRaw(Tools), url: '#', target: '_self' },
]

const apps = computed<AppItem[]>(() => {
  const list = [...BASE_APPS]
  if (isInstallable.value && !isInstalled.value) {
    list.push({
      key: 'pwa',
      name: t('headerHeaderActions.pwaApp'),
      icon: markRaw(Download),
      url: '#',
      target: '_self',
      installable: true,
    })
  }
  return list
})

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

const handleClick = async (app: AppItem, e?: Event) => {
  e?.preventDefault?.()
  e?.stopPropagation?.()

  try {
    if (app.key === 'pwa' && app.installable) {
      await install()
    } else if (app.key === 'wechat-miniprogram') {
      wechatQrVisible.value = true
    } else if (app.url && app.url !== '#') {
      if (app.target === '_blank') window.open(app.url, '_blank')
      else router.push(app.url)
    } else {
      ElMessage({ message: t('common.comingSoon'), type: 'info', plain: true })
    }
  } catch {
    ElMessage({ message: t('common.errors.actionFailed'), type: 'error' })
  } finally {
    visible.value = false
    current.value = app.key
  }
}

watch(visible, v => v && updateMenuPosition(selectorEl.value, menuEl.value))

const onClickOutside = (e: MouseEvent) => {
  const t = e.target
  if (!(t instanceof Node)) return
  if (selectorEl.value && (selectorEl.value === t || selectorEl.value.contains(t))) return
  if (menuEl.value && (menuEl.value === t || menuEl.value.contains(t))) return
  visible.value = false
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && visible.value) {
    visible.value = false
  }
}

onMounted(() => {
  cleanup.addEventListener(document, 'click', onClickOutside as EventListener)
  cleanup.addEventListener(document, 'keydown', onKeydown as EventListener)
})
</script>

<style scoped lang="scss">
.app-download-selector {
  display: inline-flex;
  align-items: center;
  height: 40px;
  min-height: 40px;
  gap: 6px;
  padding: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  cursor: pointer;
  border-radius: var(--global-border-radius);
  background-color: transparent;
  border: none;
  user-select: none;
  flex-shrink: 0;
  position: relative;
  z-index: var(--z-dropdown);

  .download-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .download-text {
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .el-icon-arrow-down {
    transition: transform 0.3s ease;
    font-size: 14px;
    flex-shrink: 0;
  }

  .arrow-rotate {
    transform: rotate(180deg);
  }

  &:hover {
    transform: scale(1.06);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }
}

@media (width <= 767px) {
  .app-download-selector {
    display: none;
  }
}
</style>
