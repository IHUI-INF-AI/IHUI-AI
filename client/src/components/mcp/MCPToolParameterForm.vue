<template>
  <div class="mcp-tool-parameter-form">
    <el-form :model="formData" :rules="formRules" ref="formRef" label-width="120px">
      <el-form-item
        v-for="(schema, key) in toolSchema?.properties || {}"
        :key="key"
        :label="getFieldLabel(key, schema)"
        :prop="key"
        :required="isRequired(key)"
      >
        <!-- 字符串类型 -->
        <el-input
          v-if="schema.type === 'string'"
          v-model="formData[key]"
          :placeholder="getPlaceholder(key, schema)"
          :type="schema.format === 'textarea' ? 'textarea' : 'text'"
          :rows="schema.format === 'textarea' ? 4 : 1"
          clearable
        >
          <template #prefix>
            <el-icon v-if="schema.format === 'uri'"><Link /></el-icon>
            <el-icon v-else-if="schema.format === 'email'"><MessageSquare /></el-icon>
          </template>
        </el-input>

        <!-- 数字类型 -->
        <el-input-number
          v-else-if="schema.type === 'number' || schema.type === 'integer'"
          v-model="formData[key]"
          :min="schema.minimum"
          :max="schema.maximum"
          :step="schema.type === 'integer' ? 1 : 0.1"
          :placeholder="getPlaceholder(key, schema)"
          style="width: 100%"
        />

        <!-- 布尔类型 -->
        <el-switch v-else-if="schema.type === 'boolean'" v-model="formData[key]" />

        <!-- 枚举类型 -->
        <el-select
          v-else-if="schema.enum"
          v-model="formData[key]"
          :placeholder="getPlaceholder(key, schema)"
          style="width: 100%"
          clearable
        >
          <el-option
            v-for="option in schema.enum"
            :key="option"
            :label="String(option)"
            :value="option"
          />
        </el-select>

        <!-- 数组类型 -->
        <div v-else-if="schema.type === 'array'" class="array-input">
          <el-tag
            v-for="(item, index) in (formData[key] as Array<unknown>) || []"
            :key="index"
            closable
            @close="removeArrayItem(key, index)"
            style="margin-right: 8px; margin-bottom: 8px"
          >
            {{ item }}
          </el-tag>
          <el-input
            v-model="arrayInputs[key]"
            :placeholder="t('mcp.params.addItem')"
            size="small"
            style="width: 200px; display: inline-block"
            @keyup.enter="addArrayItem(key)"
          >
            <template #append>
              <el-button @click="addArrayItem(key)">
                <el-icon><Plus /></el-icon>
              </el-button>
            </template>
          </el-input>
        </div>

        <!-- 对象类型 -->
        <el-card v-else-if="schema.type === 'object'" shadow="never">
          <MCPToolParameterForm
            :tool-schema="{ properties: schema.properties }"
            v-model="formData[key]"
          />
        </el-card>

        <!-- 描述提示 -->
        <div v-if="schema.description" class="field-description">
          <el-icon><Info /></el-icon>
          <span>{{ schema.description }}</span>
        </div>

        <!-- 默认值提示 -->
        <div v-if="schema.default !== undefined" class="field-default">
          <el-text type="info" size="small">
            {{ t('mcp.params.defaultValue') }}: {{ schema.default }}
          </el-text>
        </div>
      </el-form-item>
    </el-form>

    <!-- 自动补全建议 -->
    <div v-if="suggestions.length > 0" class="suggestions">
      <el-divider>
        <el-icon><Zap /></el-icon>
        {{ t('mcp.params.suggestions') }}
      </el-divider>
      <div class="suggestion-list">
        <el-tag
          v-for="(suggestion, index) in suggestions"
          :key="index"
          effect="plain"
          @click="applySuggestion(suggestion)"
          style="cursor: pointer; margin-right: 8px; margin-bottom: 8px"
        >
          {{ suggestion.label }}
        </el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { Link, MessageSquare, Plus, Info, Zap } from '@/lib/lucide-fallback'
import type { FormInstance, FormRules } from 'element-plus'

interface Props {
  toolSchema?: {
    properties?: Record<string, unknown>
    required?: string[]
  }
  modelValue?: Record<string, unknown>
  context?: {
    userMessageSquare?: string
    conversationHistory?: Array<{ role: string; content: string }>
  }
}

interface Emits {
  (e: 'update:modelValue', value: Record<string, unknown>): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  context: () => ({}),
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const { showSuccess } = useOperationFeedback()
const formRef = ref<FormInstance | null>(null)
const arrayInputs = ref<Record<string, string>>({})

// 使用本地表单数据并与外部 v-model 双向同步
const formData = ref<Record<string, unknown>>({ ...(props.modelValue || {}) })

watch(
  () => props.modelValue,
  val => {
    if (val) {
      formData.value = { ...val }
    } else {
      formData.value = {}
    }
  },
  { deep: true }
)

watch(
  formData,
  val => {
    emit('update:modelValue', val)
  },
  { deep: true }
)

// 自动提取参数建议
const suggestions = computed(() => {
  const suggs: Array<{ key: string; value: any; label: string }> = []
  const userMessageSquare = props.context?.userMessageSquare || ''

  if (!props.toolSchema?.properties) return suggs

  const properties = props.toolSchema.properties as Record<string, unknown>

  for (const [key, schemaValue] of Object.entries(properties)) {
    const schema = schemaValue as Record<string, unknown>
    // 从用户消息中提取参数
    const extracted = extractParameterFromMessageSquare(userMessageSquare, key, schema)
    if (extracted !== undefined && !formData.value[key]) {
      suggs.push({
        key,
        value: extracted,
        label: `${key}: ${String(extracted).substring(0, 30)}`,
      })
    }
  }

  return suggs
})

// 表单验证规则
const formRules = computed<FormRules>(() => {
  const rules: FormRules = {}
  if (!props.toolSchema?.properties) return rules

  const properties = props.toolSchema.properties as Record<string, Record<string, unknown>>

  for (const [key, schemaValue] of Object.entries(properties)) {
    const schema = schemaValue as Record<string, unknown>
    const rule: Record<string, unknown> = {}

    if (isRequired(key)) {
      rule.required = true
      rule.message = t('mcp.params.required', { field: key })
      rule.trigger = 'blur'
    }

    if (schema.type === 'string' && schema.minLength) {
      rule.min = schema.minLength
      rule.message = t('mcp.params.minLength', {
        field: key,
        min: schema.minLength,
      })
    }

    if (schema.type === 'string' && schema.maxLength) {
      rule.max = schema.maxLength
      rule.message = t('mcp.params.maxLength', {
        field: key,
        max: schema.maxLength,
      })
    }

    if (schema.type === 'number' && schema.minimum !== undefined) {
      rule.min = schema.minimum
      rule.message = t('mcp.params.minValue', {
        field: key,
        min: schema.minimum,
      })
    }

    if (schema.type === 'number' && schema.maximum !== undefined) {
      rule.max = schema.maximum
      rule.message = t('mcp.params.maxValue', {
        field: key,
        max: schema.maximum,
      })
    }

    if (schema.pattern && typeof schema.pattern === 'string') {
      try {
        rule.pattern = new RegExp(schema.pattern)
        rule.message = t('mcp.params.pattern', { field: key })
      } catch {
        // 无效的正则表达式，跳过模式验证
      }
    }

    if (Object.keys(rule).length > 0) {
      rules[key] = rule
    }
  }

  return rules
})

const getFieldLabel = (key: string, schema: Record<string, unknown>): string => {
  return typeof schema.title === 'string' ? schema.title : key
}

const getPlaceholder = (key: string, schema: Record<string, unknown>): string => {
  if (typeof schema.placeholder === 'string') return schema.placeholder
  if (typeof schema.description === 'string') return schema.description
  return t('mcp.params.enter', { field: key })
}

const isRequired = (key: string): boolean => {
  return props.toolSchema?.required?.includes(key) || false
}

const addArrayItem = (key: string) => {
  if (!formData.value[key]) {
    formData.value[key] = []
  }
  const input = arrayInputs.value[key]
  if (input?.trim()) {
    ;(formData.value[key] as unknown[]).push(input.trim())
    arrayInputs.value[key] = ''
  }
}

const removeArrayItem = (key: string, index: number) => {
  if (formData.value[key] && Array.isArray(formData.value[key])) {
    const arr = formData.value[key] as unknown[]
    // 检查索引是否有效
    if (index >= 0 && index < arr.length) {
      arr.splice(index, 1)
    }
  }
}

const applySuggestion = (suggestion: { key: string; value: any; label: string }) => {
  formData.value[suggestion.key] = suggestion.value
  showSuccess(t('mcp.params.suggestionApplied'))
}

// 从消息中提取参数
function extractParameterFromMessageSquare(
  message: string,
  paramName: string,
  schema: Record<string, unknown>
): any {
  const lowerMessageSquare = message.toLowerCase()
  const lowerParamName = paramName.toLowerCase()

  // URL 提取
  if (schema.format === 'uri' || paramName.includes('url')) {
    const urlMatch = message.match(/https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.[a-z]{2,}/i)
    if (urlMatch) return urlMatch[0]
  }

  // 邮箱提取
  if (schema.format === 'email' || paramName.includes('email')) {
    const emailMatch = message.match(/[^\s]+@[^\s]+\.[^\s]+/i)
    if (emailMatch) return emailMatch[0]
  }

  // 数字提取
  if (schema.type === 'number' || schema.type === 'integer') {
    const numberMatch = message.match(/\d+/)
    if (numberMatch) {
      const num = parseFloat(numberMatch[0])
      return isNaN(num) ? undefined : num
    }
  }

  // 参数名匹配
  if (lowerMessageSquare.includes(lowerParamName)) {
    try {
      // 转义特殊字符，避免正则表达式错误
      const escapedParamName = lowerParamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`${escapedParamName}[\\s:：=]+([^\\s,，]+)`, 'i')
      const match = message.match(regex)
      if (match && match[1]) {
        return parseValue(match[1], schema)
      }
    } catch {
      // 正则表达式构造失败，跳过
    }
  }

  return undefined
}

function parseValue(value: string, schema: Record<string, unknown>): any {
  if (schema.type === 'number' || schema.type === 'integer') {
    const num = parseFloat(value)
    return isNaN(num) ? undefined : num
  }
  if (schema.type === 'boolean') {
    return value.toLowerCase() === 'true' || value === '1'
  }
  return value
}

// 暴露验证方法
defineExpose({
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields(),
  getFormData: () => formData.value,
})
</script>

<style scoped lang="scss">
.mcp-tool-parameter-form {
  .array-input {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  .field-description {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    .el-icon {
      font-size: 14px;
    }
  }

  .field-default {
    margin-top: 4px;
  }

  .suggestions {
    margin-top: 20px;
    padding: 12px;
    background: var(--el-bg-color-page);
    border-radius: var(--global-border-radius);

    .suggestion-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  }
}
</style>
