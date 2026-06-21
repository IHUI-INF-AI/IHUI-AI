<template>
  <div class="learn-nav-menu">
    <div class="nav-menu-main">
      <div class="nav-menu-box">
        <router-link
          v-for="item in items"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          {{ item.label }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const items = [
  { path: '/learn', label: '课程首页' },
  { path: '/learn/list', label: '全部课程' },
  { path: '/learn/topic', label: '专题课程' },
  { path: '/learn/map', label: '学习地图' },
]

function isActive(path: string): boolean {
  if (path === '/learn') return route.path === '/learn'
  return route.path.startsWith(path)
}
</script>

<style lang="scss" scoped>
:where(.learn-nav-menu) {
  position: sticky;
  top: 0;
  z-index: calc(var(--z-base) + 49);
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
}

:where(.nav-menu-main) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 12px;
}

:where(.nav-menu-box) {
  display: flex;
  gap: 32px;
  height: 48px;
  align-items: center;
}

:where(.nav-item) {
  font-size: 14px;
  color: var(--el-text-color-regular);
  text-decoration: none;
  position: relative;
  height: 100%;
  display: inline-flex;
  align-items: center;

  &:hover {
    color: var(--el-color-primary);
  }

  &.active {
    color: var(--el-color-primary);
    font-weight: 500;

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background: var(--el-color-primary);
    }
  }
}
</style>
