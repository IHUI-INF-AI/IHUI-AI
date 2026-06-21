<template>
  <div class="mcp-quick-call">
    <el-popover v-model:visible="visible" placement="bottom-end" :width="400" trigger="click">
      <template #reference>
        <el-button :icon="Wrench" circle type="primary" :title="t('mcp.quickCall.title')" />
      </template>

      <div class="quick-call-content">
        <div class="quick-call-header">
          <h4>{{ t('mcp.quickCall.title') }}</h4>
          <el-button link size="small" @click="refreshWrench">
            <el-icon><RefreshCw /></el-icon>
          </el-button>
        </div>

        <el-input
          v-model="searchKeyword"
          :placeholder="t('mcp.quickCall.search')"
          size="small"
          clearable
          style="margin-bottom: 12px"
        >
          <template #prefix>
            <SearchIcon />
          </template>
        </el-input>

        <div class="tools-list">
          <div
            v-for="toolItem in filteredWrench"
            :key="`${toolItem.server.id}-${toolItem.tool.name}`"
            class="tool-item"
            @click="quickInvoke(toolItem)"
          >
            <div class="tool-item-header">
              <strong>{{ toolItem.tool.name }}</strong>
              <el-tag size="small" effect="plain">
                {{ toolItem.server.name }}
              </el-tag>
            </div>
            <p class="tool-item-desc">
              {{ toolItem.tool.description || t('mcp.quickCall.noDescription') }}
            </p>
          </div>
        </div>

        <el-empty
          v-if="filteredWrench.length === 0"
          :description="t('mcp.quickCall.noWrench')"
          :image-size="80"
        />

        <div class="quick-call-footer">
          <el-button link size="small" @click="goToManager">
            {{ t('mcp.quickCall.manage') }}
          </el-button>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Wrench, RefreshCw } from '@/lib/lucide-fallback'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useMCP } from '@/composables/useMCP'
import { useOperationFeedback } from '@/composables/useOperationFeedback'

const { t } = useI18n()
const router = useRouter()
const { showError } = useOperationFeedback()
const { allTools, availableServers, loadMCPServers, getServerCapabilities, invokeMCPTool } =
  useMCP()

const visible = ref(false)
const searchKeyword = ref('')

const filteredWrench = computed(() => {
  if (!searchKeyword.value) {
    return allTools.value.slice(0, 10) // 只显示前10个
  }
  const keyword = searchKeyword.value.toLowerCase()
  return allTools.value.filter(
    item =>
      item.tool.name.toLowerCase().includes(keyword) ||
      item.tool.description?.toLowerCase().includes(keyword) ||
      item.server.name.toLowerCase().includes(keyword)
  )
})

const refreshWrench = async () => {
  await loadMCPServers()
  // 加载所有服务器的能力
  for (const server of availableServers.value) {
    await getServerCapabilities(server.id)
  }
}

const quickInvoke = async (toolItem: {
  server: Record<string, unknown>
  tool: Record<string, unknown>
}) => {
  visible.value = false
  // 快速调用，使用默认参数
  const serverId = (toolItem.server as { id?: string }).id
  const toolName = (toolItem.tool as { name?: string }).name
  if (!serverId || !toolName) {
    showError(t('mcpMCPQuickCall.invalidServerOrTool'))
    return
  }
  await invokeMCPTool(serverId, toolName, {})
}

const goToManager = () => {
  visible.value = false
  router.push('/mcp-manager')
}

onMounted(async () => {
  try { await refreshWrench() } catch (e) { console.error(e) }
})
</script>

<style scoped lang="scss">
.mcp-quick-call {
  .quick-call-content {
    .quick-call-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      h4 {
        margin: 0;
        font-size: 16px;
      }
    }

    .tools-list {
      max-height: 300px;
      overflow-y: auto;

      .tool-item {
        padding: 8px;
        border-radius: var(--global-border-radius);
        cursor: pointer;
        transition: background-color 0.2s;
        margin-bottom: 4px;

        &:hover {
          background-color: var(--el-bg-color-page);
        }

        .tool-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;

          strong {
            font-size: 14px;
          }
        }

        .tool-item-desc {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .quick-call-footer {
      margin-top: 12px;
      padding-top: 12px;
      border-top: var(--unified-border);
      text-align: center;
    }
  }
}
</style>
