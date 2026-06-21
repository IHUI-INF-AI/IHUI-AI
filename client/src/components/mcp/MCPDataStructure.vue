<template>
  <div class="mcp-data-structure">
    <el-tree :data="treeData" :props="treeProps" default-expand-all :expand-on-click-node="false">
      <template #default="{ data }">
        <div class="tree-node">
          <span class="node-key">{{ data.label }}</span>
          <span class="node-type">{{ data.type }}</span>
          <span v-if="data.value !== undefined" class="node-value">
            {{ formatValue(data.value) }}
          </span>
        </div>
      </template>
    </el-tree>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  data: any
}

const props = defineProps<Props>()
const { t: _t } = useI18n()

const treeProps = {
  children: 'children',
  label: 'label',
}

const treeData = computed(() => {
  return buildTreeData(props.data, 'root')
})

function buildTreeData(data: any, key: string): Record<string, unknown> {
  const type = getType(data)

  if (type === 'object' && !Array.isArray(data)) {
    // 断言 data 是一个对象类型，允许使用索引访问
    const dataObj = data as Record<string, unknown>
    const children = Object.keys(dataObj).map(k => buildTreeData(dataObj[k], k))
    return {
      label: key,
      type: 'object',
      children,
    }
  } else if (type === 'array') {
    const dataArray = Array.isArray(data) ? data : []
    const children = dataArray
      .slice(0, 10)
      .map((item: any, index: number) => buildTreeData(item, `[${index}]`))
    return {
      label: key,
      type: `array[${dataArray.length}]`,
      children,
      value: dataArray.length > 10 ? `... (${dataArray.length} items)` : undefined,
    }
  } else {
    return {
      label: key,
      type,
      value: data,
    }
  }
}

function getType(value: any): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function formatValue(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') {
    return value.length > 50 ? value.substring(0, 50) + '...' : value
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).substring(0, 50) + '...'
  }
  return String(value)
}
</script>

<style scoped lang="scss">
.mcp-data-structure {
  .tree-node {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;

    .node-key {
      font-weight: 600;
      color: var(--el-color-primary);
    }

    .node-type {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      background: var(--el-bg-color-page);
      padding: 2px 6px;
      border-radius: var(--global-border-radius);
    }

    .node-value {
      font-size: 12px;
      color: var(--el-text-color-regular);
      font-family: monospace;
      margin-left: auto;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
