<template>
  <div class="openclaw-panel-content">
    <div class="openclaw-section">
      <h4 class="openclaw-section__title">{{ t('floatingChat.openclaw.searchMemory') }}</h4>
      <div class="openclaw-search-row">
        <el-input
          v-model="searchQuery"
          :placeholder="t('floatingChat.openclaw.searchPlaceholder')"
          clearable
          size="small"
          class="openclaw-search-input"
          @keyup.enter="doSearch"
        />
        <el-button type="primary" size="small" :loading="searching" @click="doSearch">
          {{ t('common.search') }}
        </el-button>
      </div>
      <ul v-if="searchResults.length > 0" class="openclaw-list">
        <li v-for="m in searchResults" :key="m.id" class="openclaw-list__item">
          <span class="openclaw-list__content">{{ m.content }}</span>
          <span class="openclaw-list__meta">{{ m.type }} · {{ formatTime(m.createTime) }}</span>
        </li>
      </ul>
      <p v-else-if="searchDone && searchResults.length === 0" class="openclaw-empty">
        {{ t('floatingChat.openclaw.noMemory') }}
      </p>
    </div>
    <div class="openclaw-section">
      <div class="openclaw-section__head">
        <h4 class="openclaw-section__title">{{ t('floatingChat.openclaw.currentContext') }}</h4>
        <el-button link size="small" :loading="contextLoading" @click="loadContext">{{ t('common.refresh') }}</el-button>
      </div>
      <div v-if="contextLoading" class="openclaw-loading">{{ t('common.loading') }}</div>
      <template v-else-if="contextSummary">
        <p class="openclaw-context-summary">{{ contextSummary }}</p>
        <p class="openclaw-context-meta">{{ t('floatingChat.openclaw.memoriesCount', { n: contextTotal }) }}</p>
      </template>
      <p v-else class="openclaw-empty">{{ t('floatingChat.openclaw.noContext') }}</p>
    </div>
    <div class="openclaw-section">
      <h4 class="openclaw-section__title">{{ t('floatingChat.openclaw.addMemory') }}</h4>
      <div class="openclaw-form">
        <el-input
          v-model="newContent"
          type="textarea"
          :rows="2"
          :placeholder="t('floatingChat.openclaw.addMemoryPlaceholder')"
          size="small"
          class="openclaw-form__field openclaw-add-input"
        />
        <div class="openclaw-form__row">
          <el-select v-model="newType" size="small" class="openclaw-type-select">
            <el-option value="fact" :label="t('floatingChat.openclaw.typeFact')" />
            <el-option value="preference" :label="t('floatingChat.openclaw.typePreference')" />
            <el-option value="event" :label="t('floatingChat.openclaw.typeEvent')" />
          </el-select>
          <el-button type="primary" size="small" :loading="saving" :disabled="!newContent.trim()" @click="saveNew">
            {{ t('common.confirm') }}
          </el-button>
        </div>
      </div>
    </div>
    <div class="openclaw-section">
      <el-button size="small" plain class="openclaw-clear-btn" @click="clearAll">
        {{ t('floatingChat.openclaw.clearMemory') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { searchMemory, getMemoryContext, saveMemory as apiSaveMemory, clearMemory } from '@/api/tools/tools/openclaw'
import { getApiErrorMessage } from './utils'
import type { Memory, MemoryContext } from '@/api/tools/tools/openclaw'

const { t } = useI18n()

const props = defineProps<{ sessionId?: string | null }>()

const searchQuery = ref('')
const searchResults = ref<Memory[]>([])
const searching = ref(false)
const searchDone = ref(false)
const context = ref<MemoryContext | null>(null)
const contextLoading = ref(false)
const newContent = ref('')
const newType = ref('fact')
const saving = ref(false)

const contextSummary = computed(() => context.value?.summary ?? '')
const contextTotal = computed(() => context.value?.totalMemories ?? 0)

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function doSearch() {
  if (!searchQuery.value.trim()) return
  searching.value = true
  searchDone.value = true
  try {
    const res = await searchMemory(searchQuery.value.trim(), 20)
    searchResults.value = (res.data as Memory[]) ?? []
  } catch (e) {
    searchResults.value = []
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    searching.value = false
  }
}

async function loadContext() {
  contextLoading.value = true
  try {
    const res = await getMemoryContext(props.sessionId ?? undefined)
    context.value = res.data as MemoryContext
  } catch {
    context.value = null
  } finally {
    contextLoading.value = false
  }
}

async function saveNew() {
  const content = newContent.value.trim()
  if (!content) return
  saving.value = true
  try {
    await apiSaveMemory({ content, type: newType.value, sessionId: props.sessionId ?? undefined })
    ElMessage.success(t('common.saveSuccess'))
    newContent.value = ''
    loadContext()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.saveFailed')))
  } finally {
    saving.value = false
  }
}

async function clearAll() {
  try {
    await clearMemory(props.sessionId ?? undefined)
    ElMessage.success(t('floatingChat.openclaw.cleared'))
    context.value = null
    searchResults.value = []
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  }
}

const debouncedSearch = useDebounceFn(() => {
  if (searchQuery.value.trim()) doSearch()
}, 400)

watch(searchQuery, () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    searchDone.value = false
  } else {
    debouncedSearch()
  }
})

watch(() => props.sessionId, loadContext, { immediate: true })
</script>

<style lang="scss" scoped>
/* 共用样式见 styles/_openclaw-panels.scss，此处仅保留本面板专用 */
.openclaw-context-summary {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin: 0 0 4px;
  letter-spacing: 0.01em;
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}

.openclaw-context-meta {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin: 0;
  letter-spacing: 0.01em;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.openclaw-form__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.openclaw-add-input {
  display: block;
}

.openclaw-type-select {
  width: 120px;
  flex-shrink: 0;
}

.openclaw-clear-btn {
  color: var(--el-text-color-secondary);
  border-color: var(--el-border-color-lighter);
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  &:hover {
    color: var(--el-text-color-primary);
    border-color: var(--el-border-color);
  }
}
</style>
