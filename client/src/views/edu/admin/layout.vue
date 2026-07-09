<template>
  <div class="edu-admin-layout">
    <el-affix :offset="0">
      <div class="admin-nav-bar">
        <div class="nav-brand">
          <School class="h-5 w-5" />
          <span class="brand-text">{{ t('edu.admin.title') }}</span>
        </div>
        <el-scrollbar class="nav-scroll">
          <div class="nav-links">
            <router-link
              v-for="m in navModules"
              :key="m.path"
              :to="m.path"
              class="nav-link"
              active-class="active"
            >
              <component :is="m.icon" class="h-4 w-4" />
              <span>{{ t(m.labelKey) }}</span>
            </router-link>
          </div>
        </el-scrollbar>
      </div>
    </el-affix>
    <div class="admin-content">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  School, HomeFilled, User, Setting, Reading, EditPen,
  VideoCamera, FolderOpened, Coin, ChatDotRound, Search,
  Bell, OfficeBuilding
} from '@/lib/lucide-fallback'

const { t } = useI18n()

const navModules = [
  { path: '/admin/edu', labelKey: 'edu.admin.menu.dashboard', icon: markRaw(HomeFilled) },
  { path: '/admin/edu/home', labelKey: 'edu.admin.menu.home', icon: markRaw(School) },
  { path: '/admin/edu/member', labelKey: 'edu.admin.menu.member', icon: markRaw(User) },
  { path: '/admin/edu/setting', labelKey: 'edu.admin.menu.setting', icon: markRaw(Setting) },
  { path: '/admin/edu/news', labelKey: 'edu.admin.menu.news', icon: markRaw(Reading) },
  { path: '/admin/edu/learn', labelKey: 'edu.admin.menu.learn', icon: markRaw(EditPen) },
  { path: '/admin/edu/exam', labelKey: 'edu.admin.menu.exam', icon: markRaw(EditPen) },
  { path: '/admin/edu/live', labelKey: 'edu.admin.menu.live', icon: markRaw(VideoCamera) },
  { path: '/admin/edu/resource', labelKey: 'edu.admin.menu.resource', icon: markRaw(FolderOpened) },
  { path: '/admin/edu/point', labelKey: 'edu.admin.menu.point', icon: markRaw(Coin) },
  { path: '/admin/edu/message', labelKey: 'edu.admin.menu.message', icon: markRaw(ChatDotRound) },
  { path: '/admin/edu/search', labelKey: 'edu.admin.menu.search', icon: markRaw(Search) },
  { path: '/admin/edu/organizational', labelKey: 'edu.admin.menu.organizational', icon: markRaw(OfficeBuilding) },
]
</script>

<style scoped lang="scss">
.edu-admin-layout {
  min-height: 100vh;
  background: hsl(var(--background));
}

.admin-nav-bar {
  display: flex;
  align-items: center;
  height: 52px;
  background: hsl(var(--background));
  border-bottom: 1px solid var(--border-unified-color);
  padding: 0 20px;
  gap: 20px;
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
  flex-shrink: 0;
}

.brand-text {
  line-height: 1;
}

.nav-scroll {
  flex: 1;
  overflow-x: auto;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 52px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  border-radius: var(--global-border-radius, 8px);
  font-size: 14px;
  color: hsl(var(--foreground));
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;

  &:hover {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
  }

  &.active {
    background: hsl(var(--primary));
    color: var(--app-button-text-on-primary);
  }
}

.admin-content {
  padding: 0;
}
</style>
