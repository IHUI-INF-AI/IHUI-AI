<template>
  <DesignSystemCard :title="t('aiChat.componentGenerator.title')" radius="15" padding="lg">
    <div class="component-generator">
      <!-- 生成表单 -->
      <form @submit.prevent="handleGenerate" class="generator-form mb-lg">
        <div class="form-group mb-md">
          <label for="component-name" class="form-label">{{ t('aiChat.componentGenerator.componentName') }}</label>
          <input
            id="component-name"
            v-model="request.componentName"
            link
            class="form-input"
            placeholder="UserCard"
            required
          />
        </div>

        <div class="form-group mb-md">
          <label for="component-description" class="form-label">{{ t('aiChat.componentGenerator.componentDescription') }}</label>
          <textarea
            id="component-description"
            v-model="request.description"
            class="form-textarea"
            rows="3"
            :placeholder="t('aiChat.componentGenerator.descriptionPlaceholder')"
            required
          />
        </div>

        <div class="form-group mb-md">
          <label class="form-label">{{ t('aiChat.componentGenerator.features') }}</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input
                id="use-design-system"
                name="use-design-system"
                v-model="request.useDesignSystem"
                type="checkbox"
                :checked="request.useDesignSystem !== false"
              />
              <span>{{ t('aiChat.componentGenerator.useDesignSystem') }}</span>
            </label>
            <label class="checkbox-label">
              <input id="use-seo" name="use-seo" v-model="request.useSEO" type="checkbox" />
              <span>{{ t('aiChat.componentGenerator.useSEO') }}</span>
            </label>
            <label class="checkbox-label">
              <input
                id="use-animations"
                name="use-animations"
                v-model="request.useAnimations"
                type="checkbox"
              />
              <span>{{ t('aiChat.componentGenerator.useAnimations') }}</span>
            </label>
          </div>
        </div>

        <div class="form-actions">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            :loading="isGenerating"
            :disabled="!request.componentName || !request.description || isGenerating"
          >
            {{ t('aiChat.componentGenerator.generate') }}
          </Button>
        </div>
      </form>

      <!-- 生成的组件代码 -->
      <div v-if="generatedComponent" class="generated-component">
        <div class="code-tabs mb-md">
          <button
            v-for="tab in tabs"
            :key="tab"
            :class="['tab-button', { active: activeTab === tab }]"
            @click="activeTab = tab"
          >
            {{ t(`aiChat.componentGenerator.tabs.${tab.toLowerCase()}`) }}
          </button>
        </div>

        <div class="code-content">
          <pre v-if="activeTab === 'Template'"><code>{{ generatedComponent.template }}</code></pre>
          <pre v-if="activeTab === 'Script'"><code>{{ generatedComponent.script }}</code></pre>
          <pre v-if="activeTab === 'Style'"><code>{{ generatedComponent.style }}</code></pre>
          <div v-if="activeTab === 'Documentation'" class="markdown-content">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-html="sanitizeHtml(renderMarkdown(generatedComponent.documentation))"></div>
          </div>
        </div>

        <div class="code-actions mt-md">
          <Button variant="secondary" @click="handleCopy">{{ t('aiChat.componentGenerator.copyCode') }}</Button>
          <Button variant="primary" @click="handleSave">{{ t('aiChat.componentGenerator.saveComponent') }}</Button>
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="error" class="error-message mt-md">
        <span class="text-danger">❌ {{ error }}</span>
      </div>
    </div>
  </DesignSystemCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DOMPurify from 'dompurify'
import { logger } from '../../utils/logger'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import {
  useAgenticComponentGenerator,
  type ComponentGenerationRequest,
} from '@/composables/useAgenticComponentGenerator'
import DesignSystemCard from '@/components/design-system/DesignSystemCard.vue'
import Button from '@/components/design-system/Button.vue'

const { t } = useI18n()

const { isGenerating, generatedComponent, error, generateComponent } =
  useAgenticComponentGenerator()

const request = ref<ComponentGenerationRequest>({
  componentName: '',
  description: '',
  useDesignSystem: true,
  useSEO: false,
  useAnimations: false,
})

const activeTab = ref<'Template' | 'Script' | 'Style' | 'Documentation'>('Template')
const tabs = ['Template', 'Script', 'Style', 'Documentation'] as const

const handleGenerate = async () => {
  try {
    await generateComponent(request.value)
  } catch (err) {
    logger.error(t('aiChat.componentGenerator.generateFailed'), err)
  }
}

const handleCopy = () => {
  let code = ''
  if (activeTab.value === 'Template') {
    code = generatedComponent.value?.template || ''
  } else if (activeTab.value === 'Script') {
    code = generatedComponent.value?.script || ''
  } else if (activeTab.value === 'Style') {
    code = generatedComponent.value?.style || ''
  } else {
    code = generatedComponent.value?.documentation || ''
  }

  navigator.clipboard.writeText(code).then(() => {
    // 可以添加成功提示
  }).catch(() => { ElMessage.error('复制失败') })
}

const handleSave = () => {
  // 保存组件的逻辑
  // 可以调用 API 或使用文件系统
  logger.info(t('common.messages.saving') + ':', generatedComponent.value)
}

const renderMarkdown = (markdown: string): string => {
  // 简单的 Markdown 渲染 - 使用 DOMPurify 防止 XSS
  const html = markdown
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    .replace(/\n/gim, '<br>')
  return DOMPurify.sanitize(html)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

:where(.component-generator) {
  .generator-form {
    .form-group {
      .form-label {
        display: block;
        margin-bottom: $spacing-xs;
        font-weight: $font-weight-medium;
        color: $text-primary;
        font-size: $font-size-sm;
      }

      .form-input,
      .form-textarea {
        width: 100%;
        padding: $spacing-sm $spacing-md;
        border: var(--unified-border);
        border-radius: $radius-8;
        font-size: $font-size-base;
        font-family: var(--global-font-family);
        color: $text-primary;
        background-color: var(--el-bg-color);
        transition: $transition-base;

        &:focus {
          outline: none;
          border-color: $primary-color;
          background-color: $bg-hover;
        }
      }

      .form-textarea {
        resize: vertical;
        min-height: 80px;
      }

      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: $spacing-sm;

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: $spacing-sm;
          cursor: pointer;

          input[type='checkbox'] {
            cursor: pointer;
          }
        }
      }
    }
  }

  .generated-component {
    border: var(--unified-border);
    border-radius: $radius-8;
    background-color: $bg-secondary;
    padding: $spacing-md;

    .code-tabs {
      display: flex;
      gap: $spacing-sm;
      border-bottom: var(--unified-border-bottom);
      padding-bottom: $spacing-sm;

      .tab-button {
        padding: $spacing-xs $spacing-md;
        border: none;
        background: transparent;
        color: $text-secondary;
        cursor: pointer;
        border-radius: $radius-4;
        transition: $transition-base;

        &:hover {
          background-color: $bg-hover;
        }

        &.active {
          color: $primary-color;
          background-color: $bg-hover;
          font-weight: $font-weight-semibold;
        }
      }
    }

    .code-content {
      margin-top: $spacing-md;
      max-height: 500px;
      overflow: auto;

      pre {
        margin: 0;
        padding: $spacing-md;
        background-color: $bg-primary;
        border-radius: $radius-4;
        overflow-x: auto;

        code {
          font-family: var(--font-family-mono);
          font-size: $font-size-sm;
          color: $text-primary;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      }

      .markdown-content {
        padding: $spacing-md;
        background-color: $bg-primary;
        border-radius: $radius-4;

        :deep(h1),
        :deep(h2),
        :deep(h3) {
          margin-top: $spacing-md;
          margin-bottom: $spacing-sm;
          color: $text-primary;
        }

        :deep(code) {
          background-color: $bg-secondary;
          padding: 2px 4px;
          border-radius: $radius-2;
          font-family: var(--font-family-mono);
        }
      }
    }

    .code-actions {
      display: flex;
      gap: $spacing-md;
    }
  }

  .error-message {
    padding: $spacing-sm;
    background-color: var(--el-bg-color);
    border-radius: $radius-4;
    font-size: $font-size-sm;
  }
}
</style>
