<template>
  <div class="project-selector-banner">
    <div class="selector-content">
      <img src="/images/common/qiehuanpingtai.svg" :alt="t('login.switchPlatform')" class="selector-icon" />
      <span class="selector-title">{{ selectorProps.selectText }}</span>
      <div class="project-options">
        <button
          v-for="project in selectorProps.availableProjects"
          :key="project.key"
          :class="[
            'project-option-btn',
            {
              active: project.key === selectorProps.selectedProject,
            },
          ]"
          @click="handleProjectSelect(project.key)"
        >
          {{ project.name }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface ProjectSelectorBannerProps {
  availableProjects: Array<{
    key: string
    name: string
  }>
  selectedProject: string
  selectText: string
}

const props = defineProps<ProjectSelectorBannerProps>()

const emit = defineEmits<{
  select: [projectKey: string]
}>()

const selectorProps = props

const handleProjectSelect = (projectKey: string) => {
  emit('select', projectKey)
}
</script>

<style scoped lang="scss">
/* 项目选择器横幅 - 使用 CSS 变量，使用 CSS 变量控制 */
.project-selector-banner {
  --banner-bg: var(--el-bg-color-page);
  
  width: 100%;
  background: var(--banner-bg);
  padding: 16px;
  border-radius: var(--global-border-radius);
  margin-bottom: 24px;
  border: var(--unified-border);
}

.selector-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.selector-icon {
  width: 24px;
  height: 24px;
  filter: brightness(0) invert(1);
}

/* 选择器标题 - 使用 CSS 变量，使用 CSS 变量控制 */
.selector-title {
  --title-color: var(--el-text-color-primary);
  
  color: var(--title-color);
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
}

.project-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

.project-option-btn {
  padding: 8px 16px;
  border: var(--unified-border);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: border-color 0.3s ease;
  font-size: 14px;
  font-weight: 500;

  &:hover {
    background: var(--el-color-primary-light-9);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    
  }

  &.active {
    background: var(--el-color-primary);
    color: var(--el-bg-color-page);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
  }
}

// 响应式设计
@media (width <= 768px) {
  .selector-content {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .project-options {
    margin-left: 0;
    justify-content: center;
  }

  .project-option-btn {
    flex: 1;
    min-width: 120px;
  }
}
</style>
