<template>
  <div class="status-filter">
    <div v-for="tab in tabs" :key="tab.value" class="tab-item" @click="change(tab.value)">
      <img class="tab-icon"
        :src="value === tab.value ? tab.activeIcon : tab.inactiveIcon" alt="" />
      <span :class="value === tab.value ? 'tab-text-active' : 'tab-text'">{{ tab.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'StatusFilter' })

const emit = defineEmits<{
  (e: 'change', value: number): void
}>()

const value = ref(2)

const tabs = [
  { value: 2, label: '待接单', activeIcon: 'https://file.aizhs.top/sys-mini/xtk/plaza_icon11.png', inactiveIcon: 'https://file.aizhs.top/sys-mini/xtk/plaza_icon01.png' },
  { value: 4, label: '开发中', activeIcon: 'https://file.aizhs.top/sys-mini/xtk/plaza_icon12.png', inactiveIcon: 'https://file.aizhs.top/sys-mini/xtk/plaza_icon02.png' },
  { value: 6, label: '已完成', activeIcon: 'https://file.aizhs.top/sys-mini/xtk/plaza_icon13.png', inactiveIcon: 'https://file.aizhs.top/sys-mini/xtk/plaza_icon03.png' },
  { value: 9, label: '我的任务', activeIcon: 'https://file.aizhs.top/sys-mini/xtk/plaza_icon14.png', inactiveIcon: 'https://file.aizhs.top/sys-mini/xtk/plaza_icon04.png' }
]

function change(val: number) {
  value.value = val
  emit('change', val)
}
</script>

<style scoped>
.status-filter {
  display: flex; align-items: center; justify-content: space-around;
  width: 100%; margin-bottom: 0;
}

.tab-item {
  display: flex; flex-direction: column; align-items: center;
  cursor: pointer;
}
.tab-icon { width: 34px; height: 30px; margin-bottom: 3px; }
.tab-text { font-size: 13px; color: var(--color--bbb); }
.tab-text-active { font-size: 13px; font-weight: bold; color: var(--color--787aff); }
</style>
