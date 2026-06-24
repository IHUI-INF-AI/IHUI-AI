<template>
  <div class="edu-home">
    <el-container>
      <el-aside width="240px" class="edu-sidebar">
        <el-menu
          :default-active="$route.path"
          router
          class="edu-menu"
          background-color="#001529"
          text-color="#ffffff"
          active-text-color="#1890ff"
        >
          <el-menu-item index="/edu">
            <el-icon><Reading /></el-icon>
            <span>{{ t('edu.nav.home') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/learn">
            <el-icon><Notebook /></el-icon>
            <span>{{ t('edu.nav.learn') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/exam">
            <el-icon><EditPen /></el-icon>
            <span>{{ t('edu.nav.exam') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/ask">
            <el-icon><ChatLineRound /></el-icon>
            <span>{{ t('edu.nav.ask') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/circle">
            <el-icon><Connection /></el-icon>
            <span>{{ t('edu.nav.circle') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/live">
            <el-icon><VideoCamera /></el-icon>
            <span>{{ t('edu.nav.live') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/member">
            <el-icon><User /></el-icon>
            <span>{{ t('edu.nav.member') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/point">
            <el-icon><Coin /></el-icon>
            <span>{{ t('edu.nav.point') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/order">
            <el-icon><List /></el-icon>
            <span>{{ t('edu.nav.order') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/message">
            <el-icon><ChatDotRound /></el-icon>
            <span>{{ t('edu.nav.message') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/resource">
            <el-icon><Folder /></el-icon>
            <span>{{ t('edu.nav.resource') }}</span>
          </el-menu-item>
          <el-menu-item index="/edu/search">
            <el-icon><Search /></el-icon>
            <span>{{ t('edu.nav.search') }}</span>
          </el-menu-item>
          <el-menu-item v-if="isAdmin" index="/admin/edu">
            <el-icon><Setting /></el-icon>
            <span>{{ t('edu.nav.admin') }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="edu-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Reading, Notebook, EditPen, ChatLineRound, Connection,
  VideoCamera, User, Coin, List, ChatDotRound, Folder, Search, Setting
} from '@element-plus/icons-vue'

const { t } = useI18n()

const isAdmin = computed(() => {
  // TODO: read from useAuthStore once integrated
  try {
    const raw = localStorage.getItem('auth.user')
    if (raw) {
      const user = JSON.parse(raw)
      return user.roles?.includes('admin') || user.roles?.includes('ADMIN') || false
    }
  } catch {
    /* ignore */
  }
  return false
})
</script>

<style scoped lang="scss">
.edu-home {
  min-height: calc(100vh - 64px);
}
.edu-sidebar {
  background: #001529;
}
.edu-menu {
  border-right: 0;
  height: 100%;
}
.edu-main {
  padding: 24px;
  background: #f5f7fa;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>