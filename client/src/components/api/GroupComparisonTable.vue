<template>
  <div class="group-comparison-table">
    <el-table :data="comparisonData" border stripe class="comparison-table">
      <el-table-column prop="feature" :label="t('apiService.groups.comparison.feature')" width="200" fixed="left" />
      <el-table-column
        v-for="group in groups"
        :key="group.id"
        :label="group.name"
        align="center"
        min-width="150"
      >
        <template #default="{ row }">
          <div class="feature-value">
            <span v-if="typeof row[group.id] === 'boolean'">
              <el-icon v-if="row[group.id]" color="var(--color-success)" :size="20">
                <Check />
              </el-icon>
              <el-icon v-else color="var(--el-text-color-primary)" :size="20">
                <Close />
              </el-icon>
            </span>
            <span v-else-if="typeof row[group.id] === 'string'">
              {{ row[group.id] }}
            </span>
            <span v-else>
              {{ formatValue(row[group.id]) }}
            </span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 适用场景说明 -->
    <el-card class="scenarios-card" shadow="never">
      <template #header>
        <span>{{ t('apiService.groups.comparison.scenarios') }}</span>
      </template>
      <el-row :gutter="20">
        <el-col
          v-for="group in groups"
          :key="group.id"
          :xs="24"
          :sm="12"
          :md="8"
        >
          <div class="scenario-item">
            <h4>{{ group.name }}</h4>
            <p>{{ group.scenario }}</p>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 选择建议 -->
    <el-alert
      :title="t('apiService.groups.comparison.recommendation')"
      type="info"
      :closable="false"
      show-icon
      class="recommendation-alert"
    >
      <p>{{ t('apiService.groups.comparison.recommendationText') }}</p>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
// computed 未使用，已移除
import { useI18n } from 'vue-i18n'
import { Check, Close } from '@element-plus/icons-vue'

defineOptions({
  name: 'GroupComparisonTable',
  inheritAttrs: false,
})

const { t } = useI18n()

interface Group {
  id: string
  name: string
  scenario: string
}

interface ComparisonRow {
  feature: string
  [key: string]: string | number | boolean
}

const _props = defineProps<{
  groups: Group[]
  comparisonData: ComparisonRow[]
}>()

const formatValue = (value: string | number | boolean) => {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return String(value)
}
</script>

<style scoped lang="scss">
.group-comparison-table {
  .comparison-table {
    margin-bottom: 24px;

    :deep(.el-table__cell) {
      padding: 12px;
    }

    .feature-value {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 32px;
    }
  }

  .scenarios-card {
    margin-bottom: 24px;
    border-radius: var(--global-border-radius);

    .scenario-item {
      padding: 16px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      margin-bottom: 16px;

      h4 {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 8px;
        color: var(--el-text-color-primary);
      }

      p {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        line-height: 1.6;
        margin: 0;
      }
    }
  }

  .recommendation-alert {
    border-radius: var(--global-border-radius);

    p {
      margin: 8px 0 0;
      line-height: 1.6;
    }
  }
}
</style>
