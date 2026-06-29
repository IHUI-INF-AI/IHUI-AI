<template>
  <div class="member-layout">
    <MemberMenu :active="active" />
    <div class="member-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import MemberMenu from './Menu.vue'
import { loadModule, getCurrentLocale } from '@/locales'

withDefaults(
  defineProps<{
    active?: string
  }>(),
  { active: 'personal' }
)

// 2026-06-28 修复: member 模块翻译按需加载, 解决 17 个页面 + Menu 键名裸露
// member 在 asyncModules 列表, loadModule 有缓存, 重复挂载安全
onMounted(() => {
  loadModule(getCurrentLocale(), 'member')
})
</script>

<style lang="scss" scoped>
:where(.member-layout) {
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
  align-items: flex-start;

  @media (width <= 768px) {
    flex-direction: column;
  }
}

:where(.member-content) {
  flex: 1;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 24px;
  min-width: 0;
}
</style>
