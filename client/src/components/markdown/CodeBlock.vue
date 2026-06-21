<template>
  <div class="code-block-container">
    <div class="code-block-header">
      <div class="code-block-info">
        <span v-if="language" class="language-label">{{ language }}</span>
        <span v-else class="language-label">{{ t('hardcoded.code.block.代码') }}</span>
      </div>
      <div class="code-block-actions">
        <el-button
          text
          size="small"
          @click="handleCopy"
          :title="copied ? t('codeBlock.copied') : t('codeBlock.copy')"
          class="copy-button"
        >
          <el-icon>
            <Check v-if="copied" />
            <DocumentCopy v-else />
          </el-icon>
          <span>
            {{ copied ? t('codeBlock.copied') : t('codeBlock.copy') }}
          </span>
        </el-button>
        <el-button
          v-if="showLineNumbers"
          text
          size="small"
          @click="toggleLineNumbers"
          :title="t('codeBlock.toggleLineNumbers')"
        >
          <el-icon><List /></el-icon>
        </el-button>
      </div>
    </div>
    <div
      class="code-block-content"
      :class="{ 'with-line-numbers': showLineNumbers && lineNumbersVisible }"
    >
      <pre
        v-if="lineNumbersVisible"
        class="line-numbers"
      ><code v-for="n in lineCount" :key="n">{{ n }}</code></pre>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <pre
        class="code-content"
      ><code :class="`language-${language || 'text'}`" v-html="highlightedCode"></code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, DocumentCopy, List } from '@element-plus/icons-vue'
import { copyToClipboard } from '@/utils/clipboard'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import hljs from '@/utils/highlight'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

interface Props {
  code: string
  language?: string
  showLineNumbers?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  language: '',
  showLineNumbers: true,
})

const { t } = useI18n()
const { showSuccess } = useOperationFeedback()
const copied = ref(false)
const lineNumbersVisible = ref(props.showLineNumbers)
// 复制状态重置定时器
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

const cleanup = useCleanup()

// 计算代码行数
const lineCount = computed(() => {
  return props.code.split('\n').length
})

// 高亮代码
const highlightedCode = computed(() => {
  if (!props.code) return ''

  try {
    const lang = props.language || 'text'
    const language = hljs.getLanguage(lang) ? lang : 'text'
    const highlighted = hljs.highlight(props.code, { language })
    return highlighted.value
  } catch (error) {
    logger.warn('[CodeBlock] Code highlighting failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return props.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
})

// 复制代码
const handleCopy = async () => {
  const result = await copyToClipboard(props.code)
  if (result.success) {
    copied.value = true
    showSuccess(result.message || t('codeBlock.copySuccess'))
    if (copyResetTimer !== null) clearTimeout(copyResetTimer)
    copyResetTimer = cleanup.addTimer(() => {
      copied.value = false
    }, 2000)
  }
}

// 切换行号显示
const toggleLineNumbers = () => {
  lineNumbersVisible.value = !lineNumbersVisible.value
}
</script>

<style scoped lang="scss">
.code-block-container {
  border-radius: var(--global-border-radius);
  overflow: hidden;
  margin: 16px 0;
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--el-fill-color-light);
  border-bottom: var(--unified-border-bottom);

  .code-block-info {
    .language-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      font-weight: 500;
    }
  }

  .code-block-actions {
    display: flex;
    gap: 8px;

    .copy-button {
      font-size: 12px;
    }
  }
}

.code-block-content {
  position: relative;
  display: flex;
  overflow-x: auto;
  background-color: var(--el-fill-color-darker);

  &.with-line-numbers {
    .line-numbers {
      padding: 12px 8px;
      margin: 0;
      background-color: var(--el-fill-color-light);
      border-right: var(--unified-border);
      user-select: none;
      text-align: right;
      font-size: 12px;
      line-height: 1.5;
      color: var(--el-text-color-secondary);
      flex-shrink: 0;

      code {
        display: block;
        padding: 0;
        background: none;
        color: inherit;
      }
    }
  }

  .code-content {
    flex: 1;
    margin: 0;
    padding: 12px 16px;
    overflow-x: auto;
    background-color: var(--el-fill-color-darker);
    font-size: 14px;
    line-height: 1.5;

    code {
      display: block;
      padding: 0;
      background: none;
      color: var(--el-text-color-primary);
      font-family: var(--font-family-mono);
    }
  }
}

// 暗色模式支持
html.dark {
  .code-block-content {
    background-color: var(--el-fill-color-darker);

    .code-content {
      background-color: var(--el-fill-color-darker);
    }
  }
}
</style>
