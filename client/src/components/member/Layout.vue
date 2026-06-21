<template>
  <div class="member-layout">
    <MemberMenu :active="active" />
    <div class="member-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import MemberMenu from './Menu.vue'

withDefaults(
  defineProps<{
    active?: string
  }>(),
  { active: 'personal' }
)
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
