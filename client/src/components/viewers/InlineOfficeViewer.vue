<template>
  <div class="inline-office-viewer" :class="{ 'inline-office-viewer--pptx': isPpt }">
    <div v-if="loading" class="inline-office-viewer__loading">
      <div class="cyber-loader">
        <div class="cyber-loader__ring"></div>
        <div class="cyber-loader__ring"></div>
        <div class="cyber-loader__ring"></div>
        <div class="cyber-loader__core"></div>
      </div>
      <p>{{ t('hardcoded.edu_documentation.loadingDocument') }}</p>
    </div>
    <div v-else-if="error" class="inline-office-viewer__error">
      <p class="error-text">{{ error }}</p>
      <a v-if="downloadUrl" :href="downloadUrl" class="inline-office-viewer__download-btn" download>
        {{ t('hardcoded.edu_documentation.downloadDocument') }}
      </a>
    </div>
    <div v-else-if="isPpt && !docSrc" class="inline-office-viewer__fallback">
      <p class="fallback-message">{{ t('hardcoded.edu_documentation.officePreviewUnavailable') }}</p>
      <a v-if="downloadUrl" :href="downloadUrl" class="inline-office-viewer__download-btn" download>
        {{ t('hardcoded.edu_documentation.downloadDocument') }}
      </a>
    </div>
    <div ref="contentRef" class="inline-office-viewer__content">
      <VueOfficeDocx
        v-if="isDocx && docSrc"
        :src="docSrc"
        class="inline-office-viewer__iframe"
        @rendered="onRendered"
        @error="onVueOfficeError"
      />
      <VueOfficeExcel
        v-else-if="isExcel && docSrc"
        :src="docSrc"
        class="inline-office-viewer__iframe"
        @rendered="onRendered"
        @error="onVueOfficeError"
      />
      <VueOfficePptx
        v-else-if="isPpt && docSrc && pptxOptions.height > 0"
        :key="`pptx-${pptxOptions.width}-${pptxOptions.height}`"
        :src="docSrc"
        :options="pptxOptions"
        class="inline-office-viewer__iframe"
        @rendered="onRendered"
        @error="onVueOfficeError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick, defineAsyncComponent } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'

/** 7.1 包体优化：vue-office 按需异步加载，仅在渲染文档时拉取对应 chunk */
const VueOfficeDocx = defineAsyncComponent(() =>
  import('@vue-office/docx').then((m) => {
    import('@vue-office/docx/lib/index.css')
    return m.default
  })
)
const VueOfficeExcel = defineAsyncComponent(() =>
  import('@vue-office/excel').then((m) => {
    import('@vue-office/excel/lib/index.css')
    return m.default
  })
)
const VueOfficePptx = defineAsyncComponent(() =>
  import('@vue-office/pptx').then((m) => m.default)
)

const props = defineProps<{
  fileUrl: string
  fileType: string
  /** 可选：上传文件的 base64 数据，优先于 fileUrl 使用 */
  fileData?: string
}>()

const { t } = useI18n()
const cleanup = useCleanup()

const loading = ref(true)
const error = ref<string | null>(null)
const docSrc = ref<string | ArrayBuffer | Blob | null>(null)

let abortController: AbortController | null = null
cleanup.add(() => abortController?.abort())

const downloadUrl = computed(() => props.fileUrl || '')

const fileTypeLower = computed(() => props.fileType?.toLowerCase() || '')

const isDocx = computed(() => ['doc', 'docx'].includes(fileTypeLower.value))
const isExcel = computed(() => ['xls', 'xlsx'].includes(fileTypeLower.value))
const isPpt = computed(() => ['ppt', 'pptx'].includes(fileTypeLower.value))

const contentRef = ref<HTMLElement | null>(null)
const pptxOptions = ref<{ width: number; height: number }>({ width: 0, height: 0 })

function updatePptxSize() {
  const el = contentRef.value
  if (el && isPpt.value) {
    const w = el.clientWidth || 735
    const h = el.clientHeight || 793
    if (w > 0 && h > 0) pptxOptions.value = { width: w, height: h }
  }
}

let resizeObserver: ResizeObserver | null = null
cleanup.add(() => resizeObserver?.disconnect())

async function loadSource() {
  loading.value = true
  error.value = null
  docSrc.value = null

  try {
    if (props.fileData) {
      const binary = atob(props.fileData)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      docSrc.value = bytes.buffer
      loading.value = false
      return
    }

    if (!props.fileUrl) {
      error.value = t('hardcoded.edu_documentation.iframeLoadFailed')
      loading.value = false
      return
    }

    const url = props.fileUrl.startsWith('http') ? props.fileUrl : window.location.origin + props.fileUrl
    const parsed = new URL(url)
    const sameOrigin = parsed.origin === window.location.origin

    if (sameOrigin) {
      abortController = new AbortController()
      const res = await fetch(url, { method: 'GET', signal: abortController.signal })
      if (!res.ok) {
        error.value = t('hardcoded.edu_documentation.iframeLoadFailed')
        loading.value = false
        return
      }
      docSrc.value = await res.arrayBuffer()
    } else {
      docSrc.value = url
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    error.value = (e as Error).message || t('hardcoded.edu_documentation.iframeLoadFailed')
  } finally {
    loading.value = false
  }
}

function onRendered() {
  loading.value = false
}

function onVueOfficeError(e: any) {
  error.value = (e as Error)?.message || t('hardcoded.edu_documentation.iframeLoadFailed')
  loading.value = false
}

watch(
  () => [props.fileUrl, props.fileType, props.fileData] as const,
  () => loadSource(),
  { immediate: false }
)

watch(
  () => isPpt.value && !!docSrc.value && !loading.value,
  (show) => {
    if (show) nextTick(() => nextTick(updatePptxSize))
  },
  { immediate: true }
)

onMounted(() => {
  loadSource()
  nextTick(updatePptxSize)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updatePptxSize)
  }
})

watch(
  () => contentRef.value,
  (el) => {
    if (el && resizeObserver) resizeObserver.observe(el)
  },
  { immediate: true, flush: 'post' }
)
</script>

<style lang="scss" scoped>
.inline-office-viewer {
  width: 100%;
  height: 100%;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);

  &__loading,
  &__error,
  &__fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px;

    .error-text,
    .fallback-message {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      text-align: center;
      margin: 0;
    }
  }

  /* 下载按钮：与项目全局主按钮样式统一（Element Plus 主色 + 设计令牌） */
  &__download-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--el-bg-color-page);
    background: var(--el-color-primary);
    border: none;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

    &:hover {
      background: var(--el-color-primary-light-3);
      color: var(--el-bg-color-page);
      box-shadow: var(--global-box-shadow);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: 2px;
    }
  }

  &__content {
    width: 100%;
    height: 100%;
    overflow: auto;
    border-radius: var(--global-border-radius);
  }

  &__iframe {
    width: 100%;
    min-height: 100%;
    border: none;
    background: var(--el-bg-color-page);
  }

  /* PPT 时预览根节点填满内容区，实际高度由 :options 传入的 height 控制，与左侧边栏底部齐平 */
  &--pptx &__iframe {
    height: 100%;
  }

  .cyber-loader {
    position: relative;
    width: 48px;
    height: 48px;
  }

  .cyber-loader__ring {
    position: absolute;
    inset: 0;
    border: 2px solid var(--el-border-color);
    border-top-color: var(--el-color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .cyber-loader__ring:nth-child(2) {
    inset: 6px;
    animation-duration: 1.2s;
    animation-direction: reverse;
  }

  .cyber-loader__ring:nth-child(3) {
    inset: 12px;
    animation-duration: 1.6s;
  }

  .cyber-loader__core {
    position: absolute;
    inset: 18px;
    background: var(--el-fill-color);
    border-radius: 50%;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}
</style>
