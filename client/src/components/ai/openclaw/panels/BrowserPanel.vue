<template>
  <div class="openclaw-panel-content browser-panel">
    <p class="openclaw-desc openclaw-desc--intro">
      {{ t('floatingChat.openclaw.browserPanelIntro') }}
    </p>

    <!-- 快速操作：打开网址、截图（需 OpenClaw 可用） -->
    <section v-if="openClaw" class="openclaw-section browser-panel__quick">
      <h4 class="openclaw-section__title">{{ t('floatingChat.openclaw.browserQuickActions') }}</h4>
      <div class="browser-panel__url-row">
        <el-input
          v-model="navigateUrl"
          :placeholder="t('floatingChat.openclaw.browserUrlPlaceholder')"
          size="small"
          class="browser-panel__url-input"
          clearable
          @keyup.enter="handleNavigate"
        />
        <el-button type="primary" size="small" :loading="navigateLoading" @click="handleNavigate">
          {{ t('floatingChat.openclaw.browserOpen') }}
        </el-button>
      </div>
      <div class="browser-panel__actions">
        <el-button size="small" :loading="screenshotLoading" @click="handleScreenshot">
          {{ t('floatingChat.openclaw.browserScreenshot') }}
        </el-button>
      </div>
      <div v-if="pageState?.url" class="browser-panel__current">
        <span class="browser-panel__current-label">{{ t('floatingChat.openclaw.browserCurrentPage') }}：</span>
        <a :href="pageState.url" target="_blank" rel="noopener noreferrer" class="browser-panel__current-link">
          {{ pageState.title || pageState.url }}
        </a>
      </div>
    </section>

    <!-- 内嵌浏览器区域（需 OpenClaw 可用） -->
    <section v-if="openClaw" class="openclaw-section browser-panel__frame-wrap">
      <h4 class="openclaw-section__title">{{ t('floatingChat.openclaw.browserView') }}</h4>
      <div ref="browserContainerRef" class="browser-panel__container" />
    </section>

    <!-- 后端工具列表 -->
    <section class="openclaw-section">
      <div class="openclaw-toolbar openclaw-section__head">
        <h4 class="openclaw-section__title">{{ t('floatingChat.openclaw.browserBackendTools') }}</h4>
        <el-button link size="small" :loading="loading" @click="loadTools">{{ t('common.refresh') }}</el-button>
      </div>
      <div v-if="loading" class="openclaw-loading">{{ t('common.loading') }}</div>
      <ul v-else class="openclaw-tool-list">
        <li v-for="tool in browserTools" :key="tool.name" class="openclaw-tool-list__item">
          <span class="openclaw-tool-list__name">{{ tool.name }}</span>
          <span v-if="tool.description" class="openclaw-tool-list__desc">{{ tool.description }}</span>
        </li>
      </ul>
      <div v-if="!loading && browserTools.length === 0" class="openclaw-empty-block">
        <p class="openclaw-empty">{{ t('floatingChat.openclaw.noBrowserTools') }}</p>
      </div>
    </section>

    <!-- 在对话中让 AI 操作 -->
    <section class="openclaw-section browser-panel__cta">
      <p class="openclaw-empty-hint">{{ t('floatingChat.openclaw.browserPanelEmptyHint') }}</p>
      <el-button type="primary" plain size="small" class="browser-panel__cta-btn" @click="emit('use-in-chat')">
        {{ t('floatingChat.openclaw.browserUseInChat') }}
      </el-button>
    </section>

    <!-- 截图预览弹窗 -->
    <el-dialog
      v-model="screenshotPreviewVisible"
      :title="t('floatingChat.openclaw.browserScreenshot')"
      width="90%"
      max-width="800px"
      destroy-on-close
      append-to-body
      class="browser-panel__screenshot-dialog"
    >
      <img v-if="screenshotDataUrl" :src="screenshotDataUrl" alt="Screenshot" class="browser-panel__screenshot-img" loading="lazy" />
      <template #footer>
        <el-button @click="screenshotPreviewVisible = false">{{ t('common.close') }}</el-button>
        <el-button v-if="screenshotDataUrl" type="primary" @click="downloadScreenshot">{{ t('floatingChat.openclaw.browserDownloadScreenshot') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getTools } from '@/api/openclaw'
import { getBrowserAutomation } from '@/services/clawdbot/browser'
import { useOpenClaw } from '@/composables/useOpenClaw'
import type { ToolDefinition } from '@/api/openclaw'

const emit = defineEmits<{ (e: 'use-in-chat'): void }>()

const { t } = useI18n()

// 后端工具列表
const browserTools = ref<ToolDefinition[]>([])
const loading = ref(false)

// 快速操作
const navigateUrl = ref('')
const navigateLoading = ref(false)
const screenshotLoading = ref(false)
const browserContainerRef = ref<HTMLElement | null>(null)
const screenshotPreviewVisible = ref(false)
const screenshotDataUrl = ref('')

let openClaw: ReturnType<typeof useOpenClaw> | null = null
try {
  openClaw = useOpenClaw()
} catch {
  openClaw = null
}
const pageState = computed(() => openClaw?.state.browserState ?? null)

async function loadTools() {
  loading.value = true
  try {
    const res = await getTools('browser')
    browserTools.value = (res.data as ToolDefinition[]) ?? []
  } catch {
    browserTools.value = []
  } finally {
    loading.value = false
  }
}

async function handleNavigate() {
  const url = navigateUrl.value?.trim()
  if (!url) {
    ElMessage.warning(t('floatingChat.openclaw.browserUrlRequired'))
    return
  }
  let targetUrl = url
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`
  }
  navigateLoading.value = true
  try {
    if (!openClaw) throw new Error('OpenClaw not available')
    await openClaw.browserNavigate(targetUrl)
    navigateUrl.value = targetUrl
    ElMessage.success(t('floatingChat.openclaw.browserNavigateSuccess'))
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    ElMessage.error(t('floatingChat.openclaw.browserNavigateError') + ': ' + msg)
  } finally {
    navigateLoading.value = false
  }
}

async function handleScreenshot() {
  screenshotLoading.value = true
  screenshotDataUrl.value = ''
  screenshotPreviewVisible.value = false
  try {
    if (!openClaw) throw new Error('OpenClaw not available')
    const dataUrl = await openClaw.browserScreenshot()
    screenshotDataUrl.value = dataUrl || ''
    screenshotPreviewVisible.value = true
    if (dataUrl) {
      ElMessage.success(t('floatingChat.openclaw.browserScreenshotSuccess'))
    }
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    ElMessage.error(t('floatingChat.openclaw.browserScreenshotError') + ': ' + msg)
  } finally {
    screenshotLoading.value = false
  }
}

function downloadScreenshot() {
  if (!screenshotDataUrl.value) return
  try {
    const a = document.createElement('a')
    a.href = screenshotDataUrl.value
    a.download = `screenshot-${Date.now()}.png`
    a.click()
    ElMessage.success(t('floatingChat.openclaw.browserDownloadSuccess'))
  } catch {
    ElMessage.error(t('common.error'))
  }
}

onMounted(() => {
  loadTools()
  nextTick(() => {
    if (browserContainerRef.value) {
      const browser = getBrowserAutomation()
      browser.initialize(browserContainerRef.value).catch(() => {
        // 初始化失败时仅记录，不阻塞面板
      })
    }
  })
})

onUnmounted(() => {
  // 不关闭浏览器单例，以便其他处复用
})
</script>

<style lang="scss" scoped>
.openclaw-desc--intro {
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.browser-panel__quick {
  .browser-panel__url-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  .browser-panel__url-input {
    flex: 1;
    min-width: 0;
  }

  .browser-panel__actions {
    margin-bottom: 8px;
  }

  .browser-panel__current {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .browser-panel__current-label {
    margin-right: 4px;
  }

  .browser-panel__current-link {
    color: var(--el-color-primary);
    text-decoration: none;
    word-break: break-all;

    &:hover {
      text-decoration: underline;
    }
  }
}

.browser-panel__frame-wrap {
  .browser-panel__container {
    min-height: 280px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    overflow: hidden;
    background: var(--el-fill-color-lighter);
  }
}

.openclaw-tool-list__desc {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.openclaw-empty-block {
  margin-top: 8px;
}

.openclaw-empty-hint {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.browser-panel__cta {
  padding-top: 16px;
  border-top: var(--unified-border);

  .browser-panel__cta-btn {
    margin-top: 4px;
  }
}

.browser-panel__screenshot-img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
</style>
