<template>
  <div class="study-bar">
    <div class="bar-container">
      <button
        v-for="(item, index) in barList"
        :key="index"
        :class="['bar-item', { active: selectIndex === index }]"
        @click="selectBar(item, index)"
      >
        {{ item.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineOptions({
  name: 'StudyBar'
})

withDefaults(
  defineProps<{
    barList?: Array<{ name: string; id?: string | number }>
  }>(),
  {
    barList: () => [],
  }
)

const emit = defineEmits<{
  (e: 'change', item: { name: string; id?: string | number }): void
}>()

const selectIndex = ref(0)

function selectBar(item: { name: string; id?: string | number }, index: number) {
  selectIndex.value = index
  emit('change', item)
}
</script>

<style scoped>
.study-bar {
  width: 100%;
  margin-bottom: 18px;
}

.bar-container {
  width: 100%;
  background-color: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  height: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px;
  border: var(--unified-border);
}

.bar-item {
  flex: 1;
  margin: 0 3px;
  height: 36px;
  border-radius: var(--global-border-radius);
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  font-weight: normal;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bar-item.active {
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  font-weight: bold;
  box-shadow: var(--global-box-shadow);
}

.bar-item:hover:not(.active) {
  color: var(--el-text-color-regular);
  background: var(--el-fill-color);
}
</style>
