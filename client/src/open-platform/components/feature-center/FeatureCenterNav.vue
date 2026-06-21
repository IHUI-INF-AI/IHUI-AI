<template>
  <div class="feature-center-nav">
    <el-menu
      :default-active="activeMenu"
      class="nav-menu"
      @select="handleMenuSelect"
    >
      <el-menu-item index="dashboard">
        <el-icon><FeatureIcons.Dashboard /></el-icon>
        <span>{{ t('openPlatform.nav.dashboard') }}</span>
      </el-menu-item>
      <el-menu-item index="sdks">
        <el-icon><FeatureIcons.SDKs /></el-icon>
        <span>{{ t('openPlatform.nav.sdks') }}</span>
      </el-menu-item>
      <el-menu-item index="models">
        <el-icon><FeatureIcons.Models /></el-icon>
        <span>{{ t('openPlatform.nav.models') }}</span>
      </el-menu-item>
      <el-menu-item index="agents">
        <el-icon><FeatureIcons.Agents /></el-icon>
        <span>{{ t('openPlatform.nav.agents') }}</span>
      </el-menu-item>
      <el-menu-item index="apis">
        <el-icon><FeatureIcons.APIs /></el-icon>
        <span>{{ t('openPlatform.nav.apis') }}</span>
      </el-menu-item>
      <el-menu-item index="documents">
        <el-icon><FeatureIcons.Documents /></el-icon>
        <span>{{ t('openPlatform.nav.documents') }}</span>
      </el-menu-item>
    </el-menu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { FeatureIcons } from '../../constants/icons'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

// 当前激活的菜单
const activeMenu = computed(() => {
  const path = route.path
  if (path.includes('/open/dashboard')) return 'dashboard'
  if (path.includes('/open/sdks')) return 'sdks'
  if (path.includes('/open/models')) return 'models'
  if (path.includes('/open/agents')) return 'agents'
  if (path.includes('/open/apis')) return 'apis'
  if (path.includes('/open/documents')) return 'documents'
  return 'dashboard'
})

// 菜单选择
const handleMenuSelect = (key: string) => {
  const routeMap: Record<string, string> = {
    dashboard: '/open/dashboard',
    sdks: '/open/sdks',
    models: '/open/models',
    agents: '/open/agents',
    apis: '/open/apis',
    documents: '/open/documents',
  }

  if (routeMap[key]) {
    router.push(routeMap[key])
  }
}
</script>

<style scoped lang="scss">
.feature-center-nav {
  width: 100%;

  .nav-menu {
    border-right: none;
    background: transparent;

    :deep(.el-menu-item) {
      height: 48px;
      line-height: 48px;
      margin-bottom: 4px;
      border-radius: var(--global-border-radius);

      &.is-active {
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
      }

      &:hover {
        background: var(--el-color-primary-light-9);
      }
    }
  }
}
</style>
