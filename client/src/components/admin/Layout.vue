<template>
  <div class="admin-layout">
    <aside class="admin-sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="admin-logo">
        <span class="admin-logo-text">{{ t('adminLayout.educationBackend') }}</span>
      </div>
      <AdminMenu />
    </aside>
    <div class="admin-overlay" v-if="sidebarOpen" @click="sidebarOpen = false" />
    <div class="admin-main">
      <header class="admin-header">
        <el-button class="admin-hamburger" :icon="Menu" link @click="sidebarOpen = !sidebarOpen" />
        <Breadcrumb />
        <div class="admin-header-right">
          <AdminThemeToggle />
          <div class="admin-user">
            <el-avatar :size="32">{{ userInitial }}</el-avatar>
            <span class="admin-user-name">{{ t('adminLayout.administrator') }}</span>
          </div>
        </div>
      </header>
      <main class="admin-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { Menu } from '@element-plus/icons-vue'
import AdminMenu from './Menu.vue'
import AdminThemeToggle from './ThemeToggle.vue'
import Breadcrumb from '@/components/learn/Breadcrumb.vue'
const { t } = useI18n()
const userInitial = computed(() => 'A')
const sidebarOpen = ref(false)
</script>

<style scoped lang="scss">
:where(.admin-layout) {
  display: flex; min-height: 100vh;
  background: var(--el-fill-color-blank);

  .admin-sidebar {
    width: 220px; flex-shrink: 0;
    background: var(--el-color-primary-dark-2);
    color: var(--el-bg-color);
    display: flex; flex-direction: column;
  }

  .admin-logo {
    height: 60px; display: flex; align-items: center; justify-content: center;
    border-bottom: var(--unified-border-bottom);
    .admin-logo-text { font-size: 18px; font-weight: 600; color: var(--el-bg-color); letter-spacing: 1px; }
  }
  .admin-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  .admin-header {
    height: 60px; padding: 0 24px;
    background: var(--el-bg-color);
    border-bottom: var(--unified-border-bottom);
    display: flex; align-items: center; gap: 12px;
  }
  .admin-hamburger { display: none; }
  .admin-overlay { display: none; }
  .admin-user { display: flex; align-items: center; gap: 8px; .admin-user-name { font-size: 14px; color: var(--el-text-color-primary); } }
  .admin-content { flex: 1; padding: 16px; overflow: auto; }
  .fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
  .fade-enter-from, .fade-leave-to { opacity: 0; }
}

@media (width <= 768px) {
  :where(.admin-layout) {
    .admin-sidebar {
      position: fixed; top: 0; left: 0; bottom: 0; z-index: var(--z-header);
      transform: translateX(-100%);
      transition: transform 0.2s;
    }
    .admin-sidebar.sidebar-open { transform: translateX(0); }

    .admin-overlay {
      display: block; position: fixed; inset: 0;
      background: var(--color-black-50); z-index: var(--z-sticky);
    }
    .admin-hamburger { display: inline-flex; }
    .admin-header { padding: 0 12px; }
    .admin-content { padding: 8px; }
    .admin-user-name { display: none; }
  }
}
</style>
