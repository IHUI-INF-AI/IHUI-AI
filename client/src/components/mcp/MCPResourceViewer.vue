<template>
  <div class="mcp-resource-viewer">
    <el-card>
      <template #header>
        <div class="resource-header">
          <div class="resource-title">
            <el-icon><FileText /></el-icon>
            <span>{{ resource.name || resource.uri }}</span>
          </div>
          <div class="resource-actions">
            <el-button link size="small" @click="refreshResource">
              <el-icon><RefreshCw /></el-icon>
              {{ t('common.refresh') }}
            </el-button>
            <el-button link size="small" @click="downloadResource">
              <el-icon><Download /></el-icon>
              {{ t('common.download') }}
            </el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="resource-content">
        <!-- 资源信息 -->
        <el-descriptions :column="2" border>
          <el-descriptions-item :label="t('mcp.resource.uri')">
            <code>{{ resource.uri }}</code>
          </el-descriptions-item>
          <el-descriptions-item :label="t('mcp.resource.mimeType')">
            {{ resource.mimeType || t('mcp.resource.unknown') }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="resource.description"
            :label="t('mcp.resource.description')"
            :span="2"
          >
            {{ resource.description }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 资源内容 -->
        <el-divider />
        <div class="resource-body">
          <!-- 文本内容 -->
          <div v-if="isTextContent" class="text-content">
            <pre>{{ resourceContent }}</pre>
          </div>

          <!-- JSON 内容 -->
          <div v-else-if="isJsonContent" class="json-content">
            <el-tabs v-model="jsonViewMode">
              <el-tab-pane :label="t('mcp.resource.pretty')" name="pretty">
                <pre>{{ formatJson(resourceContent) }}</pre>
              </el-tab-pane>
              <el-tab-pane :label="t('mcp.resource.raw')" name="raw">
                <pre>{{ resourceContent }}</pre>
              </el-tab-pane>
              <el-tab-pane :label="t('mcp.resource.tree')" name="tree">
                <MCPDataStructure :data="parsedJson" />
              </el-tab-pane>
            </el-tabs>
          </div>

          <!-- 图片内容 -->
          <div v-else-if="isImageContent" class="image-content">
            <el-image
              :src="resourceContent"
              fit="contain"
              :preview-src-list="[resourceContent]"
              style="max-width: 100%"
            />
          </div>

          <!-- HTML 内容 -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-else-if="isHtmlContent"
            class="html-content"
            v-html="sanitizeHtml(resourceContent)"
          />

          <!-- 其他内容 -->
          <div v-else class="other-content">
            <el-alert :title="t('mcp.resource.unsupportedType')" type="warning" :closable="false" />
            <div class="content-preview">
              <pre>{{ String(resourceContent).substring(0, 1000) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useApiError } from '@/composables/useApiError'
import { FileText, RefreshCw, Download } from '@/lib/lucide-fallback'
import type { MCPResource } from '@/api/tools/mcp'
import { getMCPResource } from '@/api/tools/mcp'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import MCPDataStructure from './MCPDataStructure.vue'

interface Props {
  resource: MCPResource
  serverId: string
}

const props = defineProps<Props>()
const { t } = useI18n()
const { showSuccess, showWarning } = useOperationFeedback()

const { loading, execute: executeApi } = useApiError({ showMessage: false })
const resourceContent = ref<Record<string, unknown> | null>(null)
const jsonViewMode = ref('pretty')

const isTextContent = computed(() => {
  const mime = props.resource.mimeType || ''
  return mime.startsWith('text/') || mime.includes('plain') || mime.includes('code')
})

const isJsonContent = computed(() => {
  const mime = props.resource.mimeType || ''
  return mime.includes('json')
})

const isImageContent = computed(() => {
  const mime = props.resource.mimeType || ''
  return mime.startsWith('image/')
})

const isHtmlContent = computed(() => {
  const mime = props.resource.mimeType || ''
  return mime.includes('html')
})

const parsedJson = computed(() => {
  if (!isJsonContent.value || !resourceContent.value) return null
  try {
    return typeof resourceContent.value === 'string'
      ? JSON.parse(resourceContent.value)
      : resourceContent.value
  } catch {
    return null
  }
})

const formatJson = (json: any): string => {
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json
    return JSON.stringify(parsed, null, 2)
  } catch {
    return String(json)
  }
}

const loadResource = async () => {
  const data = await executeApi(() => getMCPResource(props.serverId, props.resource.uri))
  if (data !== null) {
    resourceContent.value = (
      data && typeof data === 'object' ? data : {}
    ) as Record<string, unknown>
  }
}

const refreshResource = () => {
  loadResource()
}

const downloadResource = () => {
  if (!resourceContent.value) {
    showWarning(t('mcp.resource.noContent'))
    return
  }

  const blob = new Blob([String(resourceContent.value)], {
    type: props.resource.mimeType || 'text/plain',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.resource.name || 'resource'
  a.click()
  URL.revokeObjectURL(url)
  showSuccess(t('mcp.resource.downloadStarted'))
}

onMounted(() => {
  loadResource()
})
</script>

<style scoped lang="scss">
.mcp-resource-viewer {
  .resource-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .resource-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    .resource-actions {
      display: flex;
      gap: 8px;
    }
  }

  .resource-content {
    .resource-body {
      margin-top: 16px;

      .text-content,
      .json-content {
        pre {
          padding: 12px;
          background: var(--el-bg-color-page);
          border-radius: var(--global-border-radius);
          overflow-x: auto;
          font-family: var(--font-family-mono);
          font-size: 13px;
          line-height: 1.6;
        }
      }

      .image-content {
        text-align: center;
        padding: 20px;
      }

      .html-content {
        padding: 12px;
        background: var(--el-bg-color-page);
        border-radius: var(--global-border-radius);
        max-height: 600px;
        overflow-y: auto;
      }

      .other-content {
        .content-preview {
          margin-top: 12px;
          padding: 12px;
          background: var(--el-bg-color-page);
          border-radius: var(--global-border-radius);
          max-height: 400px;
          overflow-y: auto;

          pre {
            margin: 0;
            font-family: var(--font-family-mono);
            font-size: 12px;
          }
        }
      }
    }
  }
}
</style>
