<template>
  <div ref="containerRef" class="markdown-stream-container" :class="containerClass">
    <MarkdownRender v-if="shouldRender" ref="markdownRenderRef" :content="content" :nodes="nodes"
      :enable-mermaid="enableMermaid" :enable-katex="enableKatex" :custom-components="resolvedCustomComponents"
      :parse-options="resolvedParseOptions" :max-live-nodes="maxLiveNodes" :virtual-window="virtualWindow"
      class="markdown-render" :style="renderStyle" @node-update="handleNodeUpdate" @content-update="handleContentUpdate"
      @render-complete="handleRenderComplete" @error="handleError" />
    <div v-else-if="placeholder && !error" class="markdown-placeholder">
      {{ placeholder }}
    </div>
    <div v-if="loading" class="markdown-loading">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <span>{{ resolvedLoadingText }}</span>
    </div>
    <div v-if="error" class="markdown-error">
      <ElAlert :title="errorMessage" type="error" :closable="true" @close="clearError">
        <template #default>
          <div class="error-details">
            <p>{{ errorMessage }}</p>
            <div class="error-actions" style="margin-top: 8px">
              <el-button link size="small" @click="clearError">{{ t('common.close') }}</el-button>
              <el-button link size="small" @click="clearErrorAndRetry" style="margin-left: 8px">
                {{ t('common.retry') }}
              </el-button>
            </div>
          </div>
        </template>
      </ElAlert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { MarkdownRender } from 'markstream-vue'
import { Loading } from '@element-plus/icons-vue'
import { ElAlert } from 'element-plus'
import { copyToClipboard } from '@/utils/clipboard'
import { logger } from '@/utils/logger'
import { customMarkdownComponents } from './custom-markdown-components'
import 'markstream-vue/index.css'

const { t } = useI18n()

interface Props {
  /** Markdown 内容 */
  content?: string
  /** 预解析的节点 */
  nodes?: unknown[]
  /** 是否启用 Mermaid 图表 */
  enableMermaid?: boolean
  /** 是否启用 KaTeX 公式 */
  enableKatex?: boolean
  /** 自定义组件映?*/
  customComponents?:
  | Record<string, () => Promise<unknown>>
  | (() => Record<string, () => Promise<unknown>>)
  /** 解析选项 */
  parseOptions?: Record<string, unknown> | (() => Record<string, unknown>)
  /** 占位符文?*/
  placeholder?: string
  /** 是否显示加载状?*/
  loading?: boolean
  /** 加载文本 */
  loadingText?: string
  /** 最大活动节点数（性能优化?*/
  maxLiveNodes?: number
  /** 是否启用虚拟窗口（性能优化?*/
  virtualWindow?: boolean
  /** 容器自定义类?*/
  containerClass?: string
  /** 渲染器自定义样式 */
  renderStyle?: string | Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  enableMermaid: true, // 默认启用 Mermaid 图表支持
  enableKatex: true, // 默认启用 KaTeX 公式支持
  loading: false,
  // 注意：不能在这里使用 t()，因?defineProps 会被提升?setup 外部
  // 使用空字符串作为默认值，在组件内部通过计算属性处理国际化
  loadingText: '',
  maxLiveNodes: 1000,
  virtualWindow: true,
})

const emit = defineEmits<{
  nodeUpdate: [node: unknown]
  contentUpdate: [content: string]
  renderComplete: []
  error: [error: Error]
}>()

const markdownRenderRef = ref<InstanceType<typeof MarkdownRender> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const error = ref<Error | null>(null)
const imageObserver = ref<MutationObserver | null>(null)
const cleanup = useCleanup()
cleanup.add(() => {
  if (imageObserver.value) {
    imageObserver.value.disconnect()
    imageObserver.value = null
  }
})

// 解析自定义组件（支持函数和对象）
const resolvedCustomComponents = computed(() => {
  if (!props.customComponents) {
    return customMarkdownComponents
  }
  if (typeof props.customComponents === 'function') {
    return props.customComponents()
  }
  return props.customComponents
})

// 解析解析选项（支持函数和对象?
const resolvedParseOptions = computed(() => {
  if (!props.parseOptions) {
    return {
      breaks: true,
      gfm: true,
    }
  }
  if (typeof props.parseOptions === 'function') {
    return props.parseOptions()
  }
  return props.parseOptions
})

const shouldRender = computed(() => {
  return (props.content || props.nodes) && !error.value
})

const errorMessage = computed(() => {
  return error.value?.message || t('markdown.renderFailed')
})

// 解析 loadingText，如果为空则使用默认的国际化文本
const resolvedLoadingText = computed(() => {
  return props.loadingText || t('common.loading')
})

// 处理节点更新
const handleNodeUpdate = (node: unknown) => {
  emit('nodeUpdate', node)
}

// 处理内容更新
const handleContentUpdate = (content: string) => {
  emit('contentUpdate', content)
}

// 处理渲染完成
const handleRenderComplete = () => {
  emit('renderComplete')
  // 渲染完成后添加代码块复制功能
  nextTick(() => {
    addCodeBlockCopyButtons()
    // 渲染完成后再次规范图片样式（确保最新节点也被处理）
    const target =
      (containerRef.value?.querySelector('.markdown-render') as HTMLElement | null) ||
      (markdownRenderRef.value?.$el as HTMLElement | null) ||
      (document.querySelector('.markdown-stream-container .markdown-render') as HTMLElement | null) ||
      undefined
    if (target) {
      normalizeImages(target)
    } else {
      normalizeImages(document)
    }
  })
}

// 处理错误
const handleError = (err: Error) => {
  error.value = err
  emit('error', err)
  logger.error('MarkdownStream render error:', err)

  // 如果?Mermaid ?KaTeX 相关错误，提供更友好的提?
  if (err.message.includes('mermaid') || err.message.includes('Mermaid')) {
    logger.warn('Mermaid diagram rendering failed, please check diagram syntax')
  } else if (err.message.includes('katex') || err.message.includes('KaTeX')) {
    logger.warn('KaTeX formula rendering failed, please check formula syntax')
  }
}

// 监听内容变化
watch(
  () => props.content,
  newContent => {
    if (newContent) {
      error.value = null
      emit('contentUpdate', newContent)
      // 内容更新后重新添加复制按?
      nextTick(() => {
        addCodeBlockCopyButtons()
        // 内容更新后再次规范图片样?
        const target =
          (containerRef.value?.querySelector('.markdown-render') as HTMLElement | null) ||
          (markdownRenderRef.value?.$el as HTMLElement | null) ||
          (document.querySelector('.markdown-stream-container .markdown-render') as HTMLElement | null) ||
          undefined
        if (target) {
          normalizeImages(target)
        } else {
          normalizeImages(document)
        }
      })
    }
  }
)

// 添加代码块复制按钮（支持 pre.language-xxx 无内?code 的情况，右上角单独复制按钮）
const addCodeBlockCopyButtons = () => {
  const container =
    containerRef.value?.querySelector('.markdown-render') ||
    markdownRenderRef.value?.$el ||
    document.querySelector('.markdown-stream-container .markdown-render')
  if (!container) return

  // 查找所有代码块：pre[class*="language-"]（含无内?code ?pre）以及已?pre code ?pre
  const preElements = container.querySelectorAll('pre[class*="language-"]')
  if (preElements.length === 0) {
    // 兼容：仅?pre > code ?language ?pre 上的情况
    container.querySelectorAll('pre code').forEach((codeEl: Element) => {
      const pre = (codeEl as HTMLElement).parentElement
      if (pre && !pre.classList.contains('has-copy-btn')) {
        (pre as HTMLElement).classList.add('has-copy-btn')
        addCopyButtonToPre(pre as HTMLElement, (codeEl as HTMLElement).textContent || '')
      }
    })
  } else {
    preElements.forEach((preElement: Element) => {
      const pre = preElement as HTMLElement
      if (pre.classList.contains('has-copy-btn')) return
      pre.classList.add('has-copy-btn')

      const codeEl = pre.querySelector('code')
      const codeText = (codeEl ? codeEl.textContent : pre.textContent) || ''
      if (!codeText.trim()) return

      addCopyButtonToPre(pre, codeText)
    })
  }
}

// 统一清理与规范图片样式（移除 max-w-96，避免宽度被 Tailwind 限制?
function normalizeImages(root: HTMLElement | Document) {
  root
    .querySelectorAll('figure.text-center img, .markdown-body img')
    .forEach((imgEl: Element) => {
      const img = imgEl as HTMLElement
      if (img.classList.contains('max-w-96')) {
        img.classList.remove('max-w-96')
      }
      // 再保险一次：移除可能?Tailwind 固定宽度?
      ;['w-96', 'w-80', 'max-w-lg', 'max-w-xl'].forEach(cls => {
        if (img.classList.contains(cls)) {
          img.classList.remove(cls)
        }
      })
    })
}

// 使用 MutationObserver 监听 Markdown 渲染区域的变化，确保异步节点也能被处?
onMounted(() => {
  const getTarget = (): HTMLElement | null => {
    const direct = containerRef.value?.querySelector('.markdown-render') as HTMLElement | null
    if (direct) return direct
    if (markdownRenderRef.value?.$el) return markdownRenderRef.value.$el as HTMLElement
    return document.querySelector('.markdown-stream-container .markdown-render') as HTMLElement | null
  }

  const target = getTarget()
  if (!target || typeof MutationObserver === 'undefined') return

  // 先做一次初始规?
  normalizeImages(target)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            normalizeImages(node)
          }
        })
      }
    }
  })

  observer.observe(target, {
    childList: true,
    subtree: true,
  })

  imageObserver.value = observer
})

// 用于自动清理所有动态添加的事件监听器
const listenerAbortController = ref<AbortController | null>(null)

// ?pre 的右上角添加单独复制按钮
function addCopyButtonToPre(preElement: HTMLElement, codeText: string) {
  let wrapper = preElement.parentElement
  if (!wrapper?.classList.contains('code-block-wrapper')) {
    wrapper = document.createElement('div')
    wrapper.className = 'code-block-wrapper'
    preElement.parentNode?.insertBefore(wrapper, preElement)
    wrapper.appendChild(preElement)
  }

  if (wrapper.querySelector('.code-block-copy-btn')) return

  const copyBtn = document.createElement('button')
  copyBtn.className = 'code-block-copy-btn'
  copyBtn.setAttribute('aria-label', t('common.copy'))
  copyBtn.type = 'button'
  copyBtn.title = t('common.copy')

  const copyText = document.createElement('span')
  copyText.className = 'code-block-copy-btn-text'
  copyText.textContent = t('common.copy')
  copyBtn.appendChild(copyText)

  copyBtn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const result = await copyToClipboard(codeText)
      if (result.success) {
        copyText.textContent = t('common.copySuccess')
        copyBtn.classList.add('is-copied')
        setTimeout(() => {
          copyText.textContent = t('common.copy')
          copyBtn.classList.remove('is-copied')
        }, 2000)
      } else {
        logger.error('Copy failed:', result.message)
      }
    } catch (error) {
      logger.error('Copy code block failed', error)
    }
  }, { signal: listenerAbortController.value?.signal })

  wrapper.appendChild(copyBtn)
  preElement.style.margin = '0'
  preElement.style.borderRadius = '0 0 var(--global-border-radius) var(--global-border-radius)'
}

// 组件挂载后添加复制按?
onMounted(() => {
  // 初始化 AbortController 用于统一管理动态事件监听器
  listenerAbortController.value = cleanup.addAbortController()
  nextTick(() => {
    addCodeBlockCopyButtons()
  })
})

// 组件更新后添加复制按?- Vue 3 使用 watch 替代 onUpdated
watch(
  () => props.content,
  () => {
    nextTick(() => {
      addCodeBlockCopyButtons()
    })
  },
  { immediate: true }
)

// 滚动到顶?
const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
  if (containerRef.value) {
    containerRef.value.scrollTo({
      top: 0,
      behavior,
    })
  } else if (markdownRenderRef.value?.$el) {
    const el = markdownRenderRef.value.$el as HTMLElement
    el.scrollTo({
      top: 0,
      behavior,
    })
  }
}

// 滚动到底?
const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
  if (containerRef.value) {
    containerRef.value.scrollTo({
      top: containerRef.value.scrollHeight,
      behavior,
    })
  } else if (markdownRenderRef.value?.$el) {
    const el = markdownRenderRef.value.$el as HTMLElement
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    })
  }
}

// 滚动到指定位?
const scrollTo = (options: { top?: number; left?: number; behavior?: ScrollBehavior }) => {
  if (containerRef.value) {
    containerRef.value.scrollTo(options)
  } else if (markdownRenderRef.value?.$el) {
    const el = markdownRenderRef.value.$el as HTMLElement
    el.scrollTo(options)
  }
}

// 清除错误并重?
const clearErrorAndRetry = () => {
  error.value = null
  // 触发重新渲染
  nextTick(() => {
    if (props.content) {
      emit('contentUpdate', props.content)
    }
  })
}

// 清除错误
const clearError = () => {
  error.value = null
}

// 暴露方法供父组件调用
defineExpose({
  scrollToTop,
  scrollToBottom,
  scrollTo,
  getContent: () => props.content,
  clearError,
  clearErrorAndRetry,
  // 获取容器元素
  getContainer: () => containerRef.value,
  // 获取渲染器元?
  getRenderer: () => markdownRenderRef.value?.$el,
})
</script>

<style scoped lang="scss">
// 导入代码块样?
@import '@/styles/markdown-code-block';

.markdown-stream-container {
  width: 100%;

  .markdown-render {
    :deep(.markdown-body) {
      // 保持与现有样式一?
      font-family: var(--font-family-chinese);
      line-height: 1.6;
      color: var(--el-text-color-primary);

      // 代码块样式（基础样式，详细样式在 markdown-code-block.scss 中）
      pre {
        background-color: var(--el-fill-color-light);
        border-radius: var(--global-border-radius);
        padding: 16px;
        overflow-x: auto;

        code {
          font-family: var(--font-family-mono);
          font-size: 14px;
        }
      }

      // 确保代码块包装器样式正确
      .code-block-wrapper {
        margin: 16px 0;

        pre {
          margin: 0;
          border-radius: var(--global-border-radius);
        }
      }

      // 表格样式
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;

        th,
        td {
          border: var(--unified-border);
          padding: 8px 12px;
          text-align: left;
        }

        th {
          background-color: var(--el-fill-color-light);
          font-weight: 600;
        }
      }

      // 列表样式
      ul,
      ol {
        padding-left: 24px;
        margin: 8px 0;
      }

      li {
        margin: 4px 0;
      }

      // 链接样式
      a {
        color: var(--el-color-primary);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      // 引用样式
      blockquote {
        border-left: var(--el-border-width-primary) solid var(--el-color-primary);
        padding-left: 16px;
        margin: 16px 0;
        color: var(--el-text-color-secondary);
        background-color: var(--el-fill-color-lighter);
        border-radius: var(--global-border-radius);
        padding: 12px 16px;
      }

      // 标题样式
      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        margin: 16px 0 8px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      h1 {
        font-size: 24px;
      }

      h2 {
        font-size: 20px;
      }

      h3 {
        font-size: 18px;
      }

      h4 {
        font-size: 16px;
      }

      h5 {
        font-size: 14px;
      }

      h6 {
        font-size: 12px;
      }

      // ===== AIChat 中图片消息布局修正 =====
      // 图像生成结果会被渲染?figure.text-center > div.relative.inline-block > img.max-w-96...
      // 这里统一?markdown 容器宽度自适应，强制使?100% 宽度
      figure.text-center {
        width: 100% ;
        max-width: 100% ;
        margin-left: 0;
        margin-right: 0;

        >.relative.inline-block {
          width: 100% ;
          max-width: 100% ;
          display: block;
        }

        img {
          width: 100% ;
          max-width: 100% ;
          height: auto ;
          display: block;
        }

        .max-w-96 {
          max-width: 100% ;
        }
      }
    }
  }

  .markdown-placeholder {
    color: var(--el-text-color-placeholder);
    font-style: italic;
    padding: 16px;
    text-align: center;
  }

  .markdown-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    color: var(--el-text-color-secondary);

    .is-loading {
      animation: rotating 2s linear infinite;
    }
  }

  .markdown-error {
    padding: 16px;

    .error-details {
      p {
        margin: 0 0 8px;
        color: var(--el-text-color-primary);
      }

      .error-actions {
        display: flex;
        gap: 8px;
      }
    }
  }
}

:deep(img.max-w-96) {
  max-width: 100% ;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

// 暗色模式支持
:where(html.dark) {
  :where(.markdown-stream-container) {
    .markdown-render {
      :deep(.markdown-body) {
        pre {
          background-color: var(--el-fill-color-dark);
        }

        table {
          th {
            background-color: var(--el-fill-color-dark);
          }
        }

        blockquote {
          background-color: var(--el-fill-color-dark);
        }
      }
    }
  }
}
</style>
