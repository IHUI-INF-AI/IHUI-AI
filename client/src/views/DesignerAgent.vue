<template>
  <div class="page-container">
    <div class="panel radius-auto">
      <div class="section">
        <div class="section-title">{{ t('designer.mode') }}</div>
        <el-radio-group v-model="mode" size="small">
          <el-radio-button value="strategy">{{ t('designer.labels.strategy') }}</el-radio-button>
          <el-radio-button value="audit">{{ t('designer.labels.audit') }}</el-radio-button>
          <el-radio-button value="blueprint">{{ t('designer.labels.blueprint') }}</el-radio-button>
          <el-radio-button value="code">{{ t('designer.labels.code') }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="section">
        <div class="section-title">{{ t('designer.model') }}</div>
        <el-select v-model="selectedModelId" :placeholder="t('designer.selectModel')" filterable>
          <el-option
            v-for="m in models"
            :key="m.id"
            :label="m.displayName || m.name"
            :value="m.id"
          />
        </el-select>
      </div>
      <div class="section">
        <div class="section-title">{{ t('designer.input') }}</div>
        <el-input
          v-model="userInput"
          type="textarea"
          :rows="8"
          :placeholder="t('designer.placeholder')"
        />
      </div>
      <div class="actions">
        <el-button size="large" :loading="isRunning" @click="run">
          {{ t('designer.actions.generate') }}
        </el-button>
        <el-button size="large" @click="reset">{{ t('designer.actions.reset') }}</el-button>
      </div>
    </div>
    <div class="result radius-auto">
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="t('designer.tabs.output')" name="output">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="output" v-html="renderedOutput"></div>
        </el-tab-pane>
        <el-tab-pane :label="t('designer.tabs.vue')" name="vue">
          <pre class="code" v-if="codeVue">{{ codeVue }}</pre>
          <el-empty v-else :description="t('designer.empty')" />
        </el-tab-pane>
        <el-tab-pane :label="t('designer.tabs.react')" name="react">
          <pre class="code" v-if="codeReact">{{ codeReact }}</pre>
          <el-empty v-else :description="t('designer.empty')" />
        </el-tab-pane>
        <el-tab-pane :label="t('designer.tabs.html')" name="html">
          <pre class="code" v-if="codeHtml">{{ codeHtml }}</pre>
          <el-empty v-else :description="t('designer.empty')" />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'

import { getAvailableModels, type AIModelInfo } from '@/api/models'
import { chatCompletionsStream, type ChatMessage } from '@/api/ai-proxy'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

const { t } = useI18n()
const { showWarning, showError: showErrorMsg } = useOperationFeedback()
const mode = ref<'strategy' | 'audit' | 'blueprint' | 'code'>('strategy')
const models = ref<AIModelInfo[]>([])
const selectedModelId = ref<string>('')
const userInput = ref<string>('')
const isRunning = ref<boolean>(false)
const activeTab = ref<string>('output')
const output = ref<string>('')
const codeVue = ref<string>('')
const codeReact = ref<string>('')
const codeHtml = ref<string>('')

const selectedModel = computed(() => {
  return models.value.find(m => m.id === selectedModelId.value) || null
})

const SYSTEM_PROMPT = ref<string>(
  [
    t('designer.prompts.line1'),
    t('designer.prompts.line2'),
    t('designer.prompts.line3'),
    t('designer.prompts.line4'),
  ].join('\n')
)

const renderedOutput = computed(() => sanitizeHtml(output.value.replace(/\n/g, '<br/>')))

const run = async () => {
  if (!selectedModel.value) {
    showWarning(t('designer.errors.selectModel'))
    return
  }
  if (!userInput.value.trim()) {
    showWarning(t('designer.errors.enterRequirement'))
    return
  }
  isRunning.value = true
  output.value = ''
  codeVue.value = ''
  codeReact.value = ''
  codeHtml.value = ''
  activeTab.value = 'output'

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT.value },
    {
      role: 'user',
      content: JSON.stringify({
        mode: mode.value,
        input: userInput.value,
        expect: {
          strategy: t('designer.expect.strategy'),
          audit: t('designer.expect.audit'),
          blueprint: t('designer.expect.blueprint'),
          code: t('designer.expect.code'),
        },
      }),
    },
  ]

  try {
    await chatCompletionsStream(
      {
        model: selectedModel.value.name,
        messages,
        temperature: 0.2,
      },
      event => {
        if (event.event === 'chunk' && event.content) {
          output.value += event.content
        }
        if (event.event === 'completed') {
          const vueMatch = output.value.match(/```vue[\s\S]*?```/)
          const reactMatch = output.value.match(/```tsx[\s\S]*?```/)
          const htmlMatch = output.value.match(/```html[\s\S]*?```/)
          if (vueMatch) codeVue.value = vueMatch[0].replace(/```vue|```/g, '').trim()
          if (reactMatch) codeReact.value = reactMatch[0].replace(/```tsx|```/g, '').trim()
          if (htmlMatch) codeHtml.value = htmlMatch[0].replace(/```html|```/g, '').trim()
        }
        if (event.event === 'error' && event.message) {
          showErrorMsg(event.message)
        }
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    showErrorMsg(message || t('designer.errors.generateFailed'))
  } finally {
    isRunning.value = false
  }
}

const reset = () => {
  userInput.value = ''
  output.value = ''
  codeVue.value = ''
  codeReact.value = ''
  codeHtml.value = ''
  activeTab.value = 'output'
}

onMounted(async () => {
  try { const res = await getAvailableModels(); models.value = res.data || []; const first = models.value.find(m => m.isAvailable) || models.value[0] || null; if (first) selectedModelId.value = first.id } catch (e) { console.error(e) }
})
</script>

<style lang="scss" scoped>
.designer-agent {
  display: flex;
  gap: 15px;
  height: 100%;
  flex-direction: column;
  min-height: 0;
}

.panel {
  width: 360px;
  background-color: var(--el-fill-color-light);
  border: none;
  border-radius: var(--global-border-radius);
  padding: 16px;
}

.section {
  margin-bottom: 16px;
}

.section-title {
  color: var(--el-text-color-regular);
  font-size: 14px;
  margin-bottom: 8px;
}

.actions {
  display: flex;
  gap: 12px;
}

.result {
  flex: 1;
  background-color: var(--el-fill-color-light);
  border: none;
  border-radius: var(--global-border-radius);
  padding: 16px;
  min-height: 0;
  overflow-y: auto;
}

.output {
  color: var(--el-text-color-regular);
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
}

.code {
  background: var(--el-fill-color-light);
  border: none;
  border-radius: var(--global-border-radius);
  padding: 12px;
  color: var(--el-text-color-primary);
  overflow: auto;
}
</style>
