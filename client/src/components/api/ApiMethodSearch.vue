<template>
  <div class="api-method-search">
    <el-input
      v-model="searchKeyword"
      :placeholder="t('apiMethodSearch.searchPlaceholder')"
      clearable
      class="search-input"
    >
      <template #prefix>
        <SearchIcon />
      </template>
    </el-input>

    <div v-if="filteredMethods.length > 0" class="methods-list">
      <el-table :data="filteredMethods" border size="small" max-height="400">
        <el-table-column prop="name" :label="t('apiMethodSearch.methodName')" width="200" />
        <el-table-column prop="path" :label="t('apiMethodSearch.apiPath')" min-width="250">
          <template #default="{ row }">
            <code>{{ row.method }} {{ row.path }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="summary" :label="t('apiMethodSearch.description')" />
        <el-table-column :label="t('apiMethodSearch.actions')" width="120">
          <template #default="{ row }">
            <el-button size="small" @click="copyMethod(row.name)">
              {{ t('apiMethodSearch.copyMethodName') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-empty v-else :description="t('apiMethodSearch.noMatch')" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const cleanup = useCleanup()

interface ApiMethod {
  name: string
  path: string
  method: string
  summary?: string
}

const searchKeyword = ref('')
const allMethods = ref<ApiMethod[]>([])

let abortController: AbortController | null = null
cleanup.add(() => abortController?.abort())

// 过滤方法
const filteredMethods = computed(() => {
  if (!searchKeyword.value) {
    return allMethods.value.slice(0, 50) // 默认显示前 50 个
  }

  const keyword = searchKeyword.value.toLowerCase()
  return allMethods.value.filter(method => {
    return (
      method.name.toLowerCase().includes(keyword) ||
      method.path.toLowerCase().includes(keyword) ||
      method.summary?.toLowerCase().includes(keyword)
    )
  })
})

// 复制方法名
const copyMethod = async (methodName: string) => {
  try {
    await navigator.clipboard.writeText(`apiClient.${methodName}()`)
    ElMessage.success(t('apiMethodSearch.copied', { method: methodName }))
  } catch (_error) {
    ElMessage.error(t('apiMethodSearch.copyFailed'))
  }
}

// 加载方法列表
const loadMethods = async () => {
  try {
    abortController = new AbortController()
    const response = await fetch('/swagger-ai-program.json', { signal: abortController.signal })
    if (!response.ok) {
      throw new Error(t('errors.cannotLoadSwaggerDocs'))
    }

    const spec = await response.json() as { paths?: Record<string, Record<string, { operationId?: string; summary?: string }>> }
    const methods: ApiMethod[] = []

    Object.entries(spec.paths || {}).forEach(([path, pathMethods]) => {
      Object.entries(pathMethods).forEach(([method, operation]: [string, { operationId?: string; summary?: string }]) => {
        if (method !== 'parameters') {
          // 生成方法名（与生成器逻辑一致）
          const methodName = generateMethodName(path, method, operation.operationId)
          methods.push({
            name: methodName,
            path,
            method: method.toUpperCase(),
            summary: operation.summary,
          })
        }
      })
    })

    allMethods.value = methods.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    logger.error('Failed to load method list:', error)
    ElMessage.error(t('apiMethodSearch.loadFailed'))
  }
}

// 生成方法名
function generateMethodName(path: string, method: string, operationId?: string): string {
  if (operationId) {
    return operationId
      .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
      .replace(/^./, c => c.toLowerCase())
  }

  const parts = path.split('/').filter(p => p && !p.startsWith('{'))
  const methodPrefix = {
    get: 'get',
    post: 'create',
    put: 'update',
    delete: 'delete',
    patch: 'patch',
  }[method] || method

  if (parts.length === 0) {
    return `${methodPrefix}Root`
  }

  const resourceName = parts[parts.length - 1]
  const camelResource = resourceName
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, c => c.toLowerCase())

  return `${methodPrefix}${camelResource.charAt(0).toUpperCase() + camelResource.slice(1)}`
}

onMounted(() => {
  loadMethods()
})
</script>

<style scoped lang="scss">
.api-method-search {
  .search-input {
    margin-bottom: 16px;
  }

  .methods-list {
    margin-top: 16px;
  }

  code {
    font-family: var(--font-family-mono);
    font-size: 13px;
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: var(--global-border-radius);
  }
}
</style>
