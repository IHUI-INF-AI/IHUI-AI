<template>
  <div class="mcp-result-preview">
    <!-- 字符串类型 -->
    <div v-if="typeof data === 'string'" class="preview-string">
      <div class="string-content">{{ data }}</div>
    </div>

    <!-- 数字类型 -->
    <div v-else-if="typeof data === 'number'" class="preview-number">
      <el-statistic :value="data" />
    </div>

    <!-- 布尔类型 -->
    <div v-else-if="typeof data === 'boolean'" class="preview-boolean">
      <el-tag :type="data ? 'success' : 'info'">
        {{ data ? t('common.yes') : t('common.no') }}
      </el-tag>
    </div>

    <!-- 对象类型 -->
    <div v-else-if="typeof data === 'object' && data !== null" class="preview-object">
      <!-- 数组 -->
      <div v-if="Array.isArray(data)" class="preview-array">
        <div class="array-header">
          <span class="array-count">
            {{ t('mcp.result.arrayCount', { count: data.length }) }}
          </span>
        </div>
        <div class="array-items">
          <div v-for="(item, index) in data.slice(0, maxItems)" :key="index" class="array-item">
            <MCPResultPreview :data="item" />
          </div>
          <div v-if="data.length > maxItems" class="array-more">
            <el-button link size="small" @click="emit('update:maxItems', data.length)">
              {{ t('mcp.result.showMore', { count: data.length - maxItems }) }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- 普通对象 -->
      <div v-else class="preview-object-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item v-for="(value, key) in data" :key="key" :label="key">
            <MCPResultPreview :data="value" />
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <!-- 空值 -->
    <div v-else class="preview-null">
      <el-tag type="info">{{ t('mcp.result.null') }}</el-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  data: unknown
  maxItems?: number
}

withDefaults(defineProps<Props>(), {
  maxItems: 10,
})

const emit = defineEmits<{
  'update:maxItems': [value: number]
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.mcp-result-preview {
  .preview-string {
    .string-content {
      padding: 8px;
      background: var(--el-bg-color-page);
      border-radius: var(--global-border-radius);
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  .preview-array {
    .array-header {
      margin-bottom: 8px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .array-items {
      .array-item {
        margin-bottom: 8px;
        padding: 8px;
        background: var(--el-bg-color-page);
        border-radius: var(--global-border-radius);
        border-left: var(--el-border-width-primary) solid var(--el-color-primary);
      }

      .array-more {
        text-align: center;
        margin-top: 8px;
      }
    }
  }

  .preview-object-content {
    :deep(.el-descriptions__label) {
      font-weight: 600;
    }
  }
}
</style>
