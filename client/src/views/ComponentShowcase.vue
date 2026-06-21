<template>
  <div class="component-showcase">
    <header class="showcase-header">
      <h1 class="showcase-title">{{ t('showcase.title') }}</h1>
      <p class="showcase-subtitle">{{ t('showcase.subtitle') }}</p>
    </header>

    <el-tabs v-model="activeTab" class="showcase-tabs">
      <el-tab-pane :label="t('showcase.tab.buttons')" name="buttons">
        <el-card class="showcase-card" shadow="hover">
          <template #header>
            <span>{{ t('showcase.buttons.title') }}</span>
          </template>
          <div class="demo-row">
            <el-button type="primary">{{ t('showcase.buttons.primary') }}</el-button>
            <el-button type="success">{{ t('showcase.buttons.success') }}</el-button>
            <el-button type="warning">{{ t('showcase.buttons.warning') }}</el-button>
            <el-button type="danger">{{ t('showcase.buttons.danger') }}</el-button>
            <el-button type="info">{{ t('showcase.buttons.info') }}</el-button>
          </div>
          <el-divider />
          <div class="demo-row">
            <el-button type="primary" :loading="loadingState.btnLoading" @click="onClick('btn')">
              {{ t('showcase.buttons.loading') }}
            </el-button>
            <el-button type="primary" disabled>{{ t('showcase.buttons.disabled') }}</el-button>
            <el-button type="primary" round>{{ t('showcase.buttons.round') }}</el-button>
            <el-button type="primary" circle icon="Plus" />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('showcase.tab.forms')" name="forms">
        <el-card class="showcase-card" shadow="hover">
          <template #header>
            <span>{{ t('showcase.forms.title') }}</span>
          </template>
          <el-form :model="formData" label-width="100px" class="demo-form">
            <el-form-item :label="t('showcase.forms.input')">
              <el-input v-model="formData.input" :placeholder="t('showcase.forms.inputPlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('showcase.forms.textarea')">
              <el-input v-model="formData.textarea" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item :label="t('showcase.forms.select')">
              <el-select v-model="formData.select" :placeholder="t('showcase.forms.selectPlaceholder')">
                <el-option :label="t('showcase.forms.optionA')" value="a" />
                <el-option :label="t('showcase.forms.optionB')" value="b" />
                <el-option :label="t('showcase.forms.optionC')" value="c" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('showcase.forms.switch')">
              <el-switch v-model="formData.switchVal" />
            </el-form-item>
            <el-form-item :label="t('showcase.forms.checkbox')">
              <el-checkbox-group v-model="formData.checkboxVal">
                <el-checkbox value="vue">{{ t('showcase.forms.vue') }}</el-checkbox>
                <el-checkbox value="react">{{ t('showcase.forms.react') }}</el-checkbox>
                <el-checkbox value="ai">{{ t('showcase.forms.ai') }}</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item :label="t('showcase.forms.radio')">
              <el-radio-group v-model="formData.radioVal">
                <el-radio value="m">{{ t('showcase.forms.male') }}</el-radio>
                <el-radio value="f">{{ t('showcase.forms.female') }}</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item :label="t('showcase.forms.date')">
              <el-date-picker v-model="formData.date" type="date" :placeholder="t('showcase.forms.datePlaceholder')" />
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('showcase.tab.feedback')" name="feedback">
        <el-card class="showcase-card" shadow="hover">
          <template #header>
            <span>{{ t('showcase.feedback.title') }}</span>
          </template>
          <div class="demo-row">
            <el-alert :title="t('showcase.feedback.successAlert')" type="success" :closable="false" />
            <el-alert :title="t('showcase.feedback.warningAlert')" type="warning" :closable="false" />
            <el-alert :title="t('showcase.feedback.errorAlert')" type="error" :closable="false" />
          </div>
          <el-divider />
          <div class="demo-row">
            <el-tag type="success">{{ t('showcase.feedback.tagSuccess') }}</el-tag>
            <el-tag type="info">{{ t('showcase.feedback.tagInfo') }}</el-tag>
            <el-tag type="warning">{{ t('showcase.feedback.tagWarning') }}</el-tag>
            <el-tag type="danger">{{ t('showcase.feedback.tagDanger') }}</el-tag>
          </div>
          <el-divider />
          <div class="demo-row">
            <el-progress :percentage="progressValue" :stroke-width="14" />
            <el-slider v-model="progressValue" :min="0" :max="100" />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('showcase.tab.data')" name="data">
        <el-card class="showcase-card" shadow="hover">
          <template #header>
            <span>{{ t('showcase.data.title') }}</span>
          </template>
          <el-table :data="tableData" stripe>
            <el-table-column prop="name" :label="t('showcase.data.columnName')" />
            <el-table-column prop="category" :label="t('showcase.data.columnCategory')" />
            <el-table-column prop="status" :label="t('showcase.data.columnStatus')">
              <template #default="{ row }">
                <el-tag :type="row.statusType">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            class="demo-pagination"
            layout="prev, pager, next, total"
            :total="50"
            :page-size="10"
            :current-page="1"
          />
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('showcase.tab.navigation')" name="navigation">
        <el-card class="showcase-card" shadow="hover">
          <template #header>
            <span>{{ t('showcase.navigation.title') }}</span>
          </template>
          <el-menu mode="horizontal" class="demo-menu" :default-active="'home'">
            <el-menu-item index="home">{{ t('showcase.navigation.menuHome') }}</el-menu-item>
            <el-menu-item index="agents">{{ t('showcase.navigation.menuAgents') }}</el-menu-item>
            <el-menu-item index="docs">{{ t('showcase.navigation.menuDocs') }}</el-menu-item>
            <el-menu-item index="about">{{ t('showcase.navigation.menuAbout') }}</el-menu-item>
          </el-menu>
          <el-divider />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>{{ t('showcase.navigation.breadcrumbHome') }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ t('showcase.navigation.breadcrumbDocs') }}</el-breadcrumb-item>
            <el-breadcrumb-item>{{ t('showcase.navigation.breadcrumbCurrent') }}</el-breadcrumb-item>
          </el-breadcrumb>
          <el-divider />
          <el-steps :active="stepValue" finish-status="success" class="demo-steps">
            <el-step :title="t('showcase.navigation.step1')" />
            <el-step :title="t('showcase.navigation.step2')" />
            <el-step :title="t('showcase.navigation.step3')" />
          </el-steps>
          <el-button-group class="demo-row">
            <el-button @click="stepValue = Math.max(1, stepValue - 1)">
              {{ t('showcase.navigation.prev') }}
            </el-button>
            <el-button @click="stepValue = Math.min(3, stepValue + 1)">
              {{ t('showcase.navigation.next') }}
            </el-button>
          </el-button-group>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()
const activeTab = ref('buttons')

const loadingState = reactive({ btnLoading: false })
const progressValue = ref(66)
const stepValue = ref(1)

const cleanup = useCleanup()

const formData = reactive({
  input: '',
  textarea: '',
  select: 'a',
  switchVal: true,
  checkboxVal: ['vue'],
  radioVal: 'm',
  date: '',
})

const tableData = [
  { name: '智能客服', category: '对话', status: '已上线', statusType: 'success' },
  { name: '图像生成', category: '生成', status: '测试中', statusType: 'warning' },
  { name: '代码助手', category: '辅助', status: '已上线', statusType: 'success' },
  { name: '数据分析', category: '分析', status: '已下线', statusType: 'danger' },
]

const onClick = (key: string) => {
  if (key === 'btn') {
    loadingState.btnLoading = true
    cleanup.addTimer(() => { loadingState.btnLoading = false }, 1200)
  }
}
</script>

<style scoped lang="scss">
.component-showcase {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.showcase-header {
  text-align: center;
  margin-bottom: 32px;
}

.showcase-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
}

.showcase-subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.showcase-tabs {
  background: var(--el-bg-color);
}

.showcase-card {
  margin-bottom: 16px;
}

.demo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.demo-form {
  max-width: 640px;
}

.demo-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.demo-menu {
  border-bottom: var(--unified-border-bottom);
}

.demo-steps {
  margin-bottom: 16px;
}
</style>
