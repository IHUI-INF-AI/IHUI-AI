<template>
  <div class="version-diff">
    <div class="diff-header">
      <div class="version-select">
        <el-select v-model="fromVersion" :placeholder="$t('file.diff.from') || '源版本'" style="width: 200px">
          <el-option
            v-for="v in versions"
            :key="v.version_id"
            :label="`v${v.version_number}`"
            :value="v.version_id"
          />
        </el-select>
        <span class="arrow">→</span>
        <el-select v-model="toVersion" :placeholder="$t('file.diff.to') || '目标版本'" style="width: 200px">
          <el-option
            v-for="v in versions"
            :key="v.version_id"
            :label="`v${v.version_number}`"
            :value="v.version_id"
          />
        </el-select>
        <el-button type="primary" @click="compareVersions" :loading="loading">
          {{ $t('file.diff.compare') || '对比' }}
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ $t('common.loading') || '加载中...' }}</span>
    </div>

    <div v-else-if="diffResult" class="diff-content">
      <div class="diff-stats">
        <el-tag type="success">+{{ diffResult.additions }} {{ $t('file.diff.additions') || '新增' }}</el-tag>
        <el-tag type="danger">-{{ diffResult.deletions }} {{ $t('file.diff.deletions') || '删除' }}</el-tag>
        <el-tag type="info">{{ diffResult.changes }} {{ $t('file.diff.changes') || '修改' }}</el-tag>
        <el-tag v-if="diffResult.similarity !== undefined" type="warning">
           {{ $t('file.diff.similarity') || '相似度' }}: {{ diffResult.similarity }}%
         </el-tag>
      </div>

      <div class="diff-view">
        <div class="diff-panel">
          <div class="panel-header">
            {{ $t('file.diff.from') || '源版本' }}: v{{ getFromVersionNumber() }}
          </div>
          <div class="panel-content">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <pre v-html="sanitizeHtml(diffResult.fromContent)"></pre>
          </div>
        </div>
        <div class="diff-panel">
          <div class="panel-header">
            {{ $t('file.diff.to') || '目标版本' }}: v{{ getToVersionNumber() }}
          </div>
          <div class="panel-content">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <pre v-html="sanitizeHtml(diffResult.toContent)"></pre>
          </div>
        </div>
      </div>

      <div v-if="diffResult.changesList && diffResult.changesList.length > 0" class="changes-list">
        <h4>{{ $t('file.diff.changeDetails') || '变更详情' }}</h4>
        <el-timeline>
          <el-timeline-item
            v-for="(change, index) in diffResult.changesList"
            :key="index"
            :type="getChangeType(change.type)"
          >
            <div class="change-item">
              <span class="change-type">{{ change.type }}</span>
              <span class="change-line">{{ $t('file.diff.line') || '行' }} {{ change.line }}</span>
              <code class="change-content">{{ change.content }}</code>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>

    <div v-else class="empty-state">
      {{ $t('file.diff.selectVersions') || '请选择要对比的版本' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useFileVersion } from '@/utils/fileVersion'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { logger } from '@/utils/logger'

const { t } = useI18n()

interface Version {
  version_id: string
  version_number: number
  file_size: number
  created_at: string
  change_summary?: string
}

interface DiffResult {
  additions: number
  deletions: number
  changes: number
  fromContent: string
  toContent: string
  fromContentHtml: string
  toContentHtml: string
  changesList: Array<{
    type: string
    line: number
    content: string
  }>
  similarity?: number
}

interface _CompareResult {
  additions: number
  deletions: number
  changes: number
  fromContent: string
  toContent: string
  changesList: Array<{
    type: string
    line: number
    content: string
  }>
  similarity: number
}

const props = defineProps<{
  fileId: string
  versions: Version[]
}>()

const { compareVersions: apiCompareVersions } = useFileVersion()

const fromVersion = ref('')
const toVersion = ref('')
const loading = ref(false)
const diffResult = ref<DiffResult | null>(null)

watch(() => props.versions, (newVersions) => {
  if (newVersions && newVersions.length >= 2) {
    fromVersion.value = newVersions[newVersions.length - 2].version_id
    toVersion.value = newVersions[newVersions.length - 1].version_id
  }
}, { immediate: true })

function getFromVersionNumber(): number {
  const v = props.versions.find((v: { version_id: string }) => v.version_id === fromVersion.value)
  return v?.version_number || 0
}

function getToVersionNumber(): number {
  const v = props.versions.find((v: { version_id: string }) => v.version_id === toVersion.value)
  return v?.version_number || 0
}

function getChangeType(type: string): string {
  const typeMap: Record<string, string> = {
    'add': 'success',
    'delete': 'danger',
    'modify': 'warning'
  }
  return typeMap[type] || 'info'
}

async function compareVersions() {
  if (!fromVersion.value || !toVersion.value) {
    ElMessage.warning(t('cmpVersionDiff.selectVersionToCompare'))
    return
  }

  if (fromVersion.value === toVersion.value) {
    ElMessage.warning(t('cmpVersionDiff.selectDiffVersion'))
    return
  }

  loading.value = true
  try {
    const fromV = props.versions.find((v: Version) => v.version_id === fromVersion.value)
    const toV = props.versions.find((v: Version) => v.version_id === toVersion.value)
    
    if (!fromV || !toV) {
      ElMessage.error(t('cmpVersionDiff.getVersionFailed'))
      return
    }

    const result = await apiCompareVersions(props.fileId, fromV.version_number, toV.version_number)
    diffResult.value = {
      additions: result.diff?.additions || 0,
      deletions: result.diff?.deletions || 0,
      changes: result.diff?.changes || 0,
      fromContent: result.diff?.from_content || '',
      toContent: result.diff?.to_content || '',
      fromContentHtml: result.diff?.from_content_html || '',
      toContentHtml: result.diff?.to_content_html || '',
      changesList: result.diff?.changes_list || [],
      similarity: result.similarity
    }
  } catch (err) {
    logger.error('Version comparison failed:', err)
    ElMessage.error(t('cmpVersionDiff.compareFailed'))
    diffResult.value = null
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.version-diff {
  padding: 16px;
}

.diff-header {
  margin-bottom: 20px;
}

.version-select {
  display: flex;
  align-items: center;
  gap: 12px;
}

.arrow {
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.diff-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.diff-stats {
  display: flex;
  gap: 12px;
}

.diff-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.diff-panel {
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.panel-header {
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  font-weight: 500;
  border-bottom: var(--unified-border-bottom);
}

.panel-content {
  padding: 16px;
  max-height: 400px;
  overflow: auto;
}

.panel-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
}

.changes-list {
  margin-top: 20px;
}

.changes-list h4 {
  margin-bottom: 16px;
}

.change-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.change-type {
  font-weight: 500;
}

.change-line {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.change-content {
  padding: 8px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--el-text-color-secondary);
}

@media (width <= 768px) {
  .diff-view {
    grid-template-columns: 1fr;
  }

  .version-select {
    flex-wrap: wrap;
  }
}
</style>
