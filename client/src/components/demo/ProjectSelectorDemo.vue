<template>
  <div class="project-selector-demo">
    <DemoNavigation />
    <h2>{{ t('hardcoded.project.selector.demo.项目选择器组件演示') }}</h2>

    <!-- 登录页横幅样式的项目选择器 -->
    <div class="demo-section">
      <h3>{{ t('hardcoded.project.selector.demo.登录页横幅样式') }}</h3>
      <ProjectSelectorBanner
        :available-projects="demoProjects"
        :selected-project="selectedProject"
        select-text="选择项目平台"
        @select="handleProjectSelect"
      />
    </div>

    <!-- Header样式的项目选择器 -->
    <div class="demo-section">
      <h3>{{ t('hardcoded.project.selector.demo.Header样式移动') }}</h3>
      <div class="mobile-preview">
        <ProjectSelector />
      </div>
    </div>

    <!-- 当前选择的项目信息 -->
    <div class="demo-section">
      <h3>{{ t('hardcoded.project.selector.demo.当前选择') }}</h3>
      <div class="selected-info">
        <p>
          <strong>{{ t('hardcoded.project.selector.demo.选中项目') }}</strong>
          {{ selectedProjectInfo?.name || '未选择' }}
        </p>
        <p>
          <strong>{{ t('hardcoded.project.selector.demo.项目Key') }}</strong>
          {{ selectedProject || '无' }}
        </p>
        <p>
          <strong>{{ t('hardcoded.project.selector.demo.项目URL') }}</strong>
          {{ selectedProjectInfo?.url || '无' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { ref, computed } from 'vue'
import ProjectSelectorBanner from '@/components/login/ProjectSelectorBanner.vue'
import ProjectSelector from '@/components/header/ProjectSelector.vue'
import DemoNavigation from '@/components/demo/DemoNavigation.vue'
import { logger } from '@/utils/logger'

// 演示数据
const demoProjects = ref([
  {
    key: 'admin',
    name: t('data.project_selector_demo.总管理端'),
    url: 'http://localhost:81',
  },
  {
    key: 'edu-web',
    name: t('data.project_selector_demo.智汇AI教育平台1'),
    url: 'http://localhost:8100',
  },
  {
    key: 'edu-admin',
    name: t('data.project_selector_demo.教育管理后台2'),
    url: 'http://localhost:8200',
  },
])

const selectedProject = ref<string>('admin')

const selectedProjectInfo = computed(() => {
  return demoProjects.value.find(p => p.key === selectedProject.value)
})

const handleProjectSelect = (projectKey: string) => {
  selectedProject.value = projectKey
  logger.info('[ProjectSelectorDemo] Selected project', { projectKey })
}
</script>

<style scoped lang="scss">
.project-selector-demo {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.demo-section {
  margin-bottom: 32px;

  h3 {
    margin-bottom: 16px;
    color: var(--el-text-color-primary);
    font-size: 18px;
    font-weight: 600;
  }
}

.mobile-preview {
  width: 375px;
  height: 60px;
  border: 2px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  position: relative;
  background: var(--el-bg-color);
  overflow: hidden;
}

.selected-info {
  padding: 16px;
  background: var(--el-bg-color-page);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  p {
    margin: 8px 0;
    color: var(--el-text-color-regular);

    strong {
      color: var(--el-text-color-primary);
    }
  }
}

h2 {
  text-align: center;
  margin-bottom: 32px;
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-weight: 700;
}
</style>
