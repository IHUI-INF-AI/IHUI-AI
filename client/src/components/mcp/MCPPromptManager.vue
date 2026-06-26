<template>
  <div class="mcp-prompt-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('mcp.prompts.title') }}</span>
          <el-button link @click="refreshPrompts">
            <el-icon><RefreshCw /></el-icon>
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </template>

      <!-- 提示词列表 -->
      <el-input
        v-model="searchKeyword"
        :placeholder="t('mcp.prompts.search')"
        clearable
        style="margin-bottom: 16px"
      >
        <template #prefix>
          <SearchIcon />
        </template>
      </el-input>

      <el-row :gutter="16">
        <el-col
          v-for="promptItem in filteredPrompts"
          :key="`${promptItem.server.id}-${promptItem.prompt.name}`"
          :xs="24"
          :sm="12"
          :md="8"
        >
          <el-card class="prompt-card" shadow="hover" @click="showPromptDialog(promptItem)">
            <div class="prompt-header">
              <h4>{{ promptItem.prompt.name }}</h4>
              <el-tag size="small" effect="plain">
                {{ promptItem.server.name }}
              </el-tag>
            </div>
            <p class="prompt-description">
              {{ promptItem.prompt.description || t('mcp.prompts.noDescription') }}
            </p>
            <div v-if="promptItem.prompt.arguments" class="prompt-arguments">
              <el-tag
                v-for="arg in promptItem.prompt.arguments"
                :key="arg.name"
                size="small"
                effect="plain"
                style="margin-right: 4px; margin-bottom: 4px"
              >
                {{ arg.name }}
                <span v-if="arg.required" class="required-mark">*</span>
              </el-tag>
            </div>
            <div class="prompt-actions">
              <el-button type="primary" size="small" @click.stop="usePrompt(promptItem)">
                {{ t('mcp.prompts.use') }}
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="filteredPrompts.length === 0" :description="t('mcp.prompts.noPrompts')" />
    </el-card>

    <!-- 提示词使用对话框 -->
    <el-dialog v-model="showPromptDialog" :title="selectedPrompt?.prompt.name" width="700px">
      <div v-if="selectedPrompt">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('mcp.prompts.server')">
            {{ selectedPrompt.server.name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('mcp.prompts.description')">
            {{ selectedPrompt.prompt.description || t('mcp.prompts.noDescription') }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <!-- 参数输入 -->
        <div v-if="selectedPrompt.prompt.arguments" class="prompt-arguments-form">
          <h4>{{ t('mcp.prompts.arguments') }}</h4>
          <el-form :model="promptArguments" label-width="120px">
            <el-form-item
              v-for="arg in selectedPrompt.prompt.arguments"
              :key="arg.name"
              :label="arg.name"
              :required="arg.required"
            >
              <el-input
                v-model="promptArguments[arg.name]"
                :placeholder="arg.description || arg.name"
                type="textarea"
                :rows="3"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- 结果预览 -->
        <el-divider />
        <div v-if="promptResult" class="prompt-result">
          <h4>{{ t('mcp.prompts.result') }}</h4>
          <el-input v-model="promptResult" type="textarea" :rows="10" readonly />
          <div class="result-actions">
            <el-button @click="copyResult">
              <el-icon><Copy /></el-icon>
              {{ t('common.copy') }}
            </el-button>
            <el-button @click="downloadResult">
              <el-icon><Download /></el-icon>
              {{ t('common.download') }}
            </el-button>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showPromptDialog = false">
          {{ t('common.close') }}
        </el-button>
        <el-button type="primary" :loading="callingPrompt" @click="executePrompt">
          {{ t('mcp.prompts.execute') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { RefreshCw, Copy, Download } from '@/lib/lucide-fallback'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useMCP } from '@/composables/useMCP'
import { callMCPPrompt } from '@/api/tools/mcp'
import type { MCPPrompt } from '@/api/tools/mcp'

const { t } = useI18n()
const { showSuccess, showError, showWarning } = useOperationFeedback()
const { allPrompts, availableServers, loadMCPServers, getServerCapabilities } = useMCP()

const searchKeyword = ref('')
const showPromptDialog = ref(false)
const selectedPrompt = ref<{
  server: Record<string, unknown>
  prompt: MCPPrompt
} | null>(null)
const promptArguments = ref<Record<string, string>>({})
const promptResult = ref('')
const callingPrompt = ref(false)

const filteredPrompts = computed(() => {
  if (!searchKeyword.value) {
    return allPrompts.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return allPrompts.value.filter(
    item =>
      item.prompt.name.toLowerCase().includes(keyword) ||
      item.prompt.description?.toLowerCase().includes(keyword) ||
      item.server.name.toLowerCase().includes(keyword)
  )
})

const refreshPrompts = async () => {
  await loadMCPServers()
  for (const server of availableServers.value) {
    await getServerCapabilities(server.id)
  }
}

const showPromptDialogFn = (promptItem: { server: Record<string, unknown>; prompt: MCPPrompt }) => {
  selectedPrompt.value = promptItem
  promptArguments.value = {}
  promptResult.value = ''
  showPromptDialog.value = true
}

const usePrompt = (promptItem: { server: Record<string, unknown>; prompt: MCPPrompt }) => {
  showPromptDialogFn(promptItem)
}

const executePrompt = async () => {
  if (!selectedPrompt.value) return

  // 验证必填参数
  const requiredArgs = selectedPrompt.value.prompt.arguments?.filter(arg => arg.required) || []
  for (const arg of requiredArgs) {
    if (!promptArguments.value[arg.name]?.trim()) {
      showWarning(t('mcp.prompts.requiredArg', { arg: arg.name }))
      return
    }
  }

  callingPrompt.value = true
  try {
    const serverId = (selectedPrompt.value.server as { id?: string }).id
    const promptName = (selectedPrompt.value.prompt as { name?: string }).name
    if (!serverId || !promptName) {
      showError(t('mcpMCPPromptManager.invalidServerOrPrompt'))
      return
    }
    const response = await callMCPPrompt(serverId, promptName, promptArguments.value)

    if (response.code === 200 && response.success) {
      promptResult.value = response.data || ''
      showSuccess(t('mcp.prompts.executeSuccess'))
    } else {
      showError(response.message || t('mcp.prompts.executeFailed'))
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : t('mcp.prompts.executeFailed')
    showError(errorMessage)
  } finally {
    callingPrompt.value = false
  }
}

const copyResult = async () => {
  if (!promptResult.value) return
  try {
    await navigator.clipboard.writeText(promptResult.value)
    showSuccess(t('common.copySuccess'))
  } catch (_error) {
    showError(t('common.copyFailed'))
  }
}

const downloadResult = () => {
  if (!promptResult.value) return
  const blob = new Blob([promptResult.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedPrompt.value?.prompt.name || 'prompt'}-result.txt`
  a.click()
  URL.revokeObjectURL(url)
  showSuccess(t('mcp.prompts.downloadStarted'))
}

onMounted(async () => {
  try { await refreshPrompts() } catch (e) { console.error(e) }
})
</script>

<style scoped lang="scss">
.mcp-prompt-manager {
  .prompt-card {
    margin-bottom: 16px;
    cursor: pointer;
    transition: transform 0.3s, box-shadow 0.3s;

    &:hover {
      
      box-shadow: none;
    }

    .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      h4 {
        margin: 0;
        font-size: 16px;
      }
    }

    .prompt-description {
      color: var(--el-text-color-secondary);
      font-size: 14px;
      margin: 8px 0;
      min-height: 40px;
    }

    .prompt-arguments {
      margin: 8px 0;

      .required-mark {
        color: var(--el-color-danger);
        margin-left: 2px;
      }
    }

    .prompt-actions {
      margin-top: 12px;
    }
  }

  .prompt-arguments-form {
    margin-top: 16px;
  }

  .prompt-result {
    margin-top: 16px;

    .result-actions {
      margin-top: 12px;
      display: flex;
      gap: 8px;
    }
  }
}
</style>
