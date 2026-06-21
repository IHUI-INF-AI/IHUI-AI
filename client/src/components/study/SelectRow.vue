<template>
  <div class="select-row">
    <div v-if="type === 'arr'" class="scroll-body">
      <div v-for="(item, index) in tabList" :key="index"
        :class="['select-item', { selected: selectList.includes(item) }]"
        @click="changeIndex(item, index)">
        {{ item.name || '' }}
      </div>
    </div>
    <div v-if="type === 'str'" class="scroll-body">
      <div v-for="(item, index) in tabList" :key="index"
        :class="['select-item', { selected: selectIndex === index }]"
        @click="changeIndex(item, index)">
        {{ item.name || '' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

defineOptions({ name: 'SelectRow' })

const props = withDefaults(defineProps<{
  tabList?: any[]
  type?: string
}>(), {
  tabList: () => [],
  type: 'arr'
})

const emit = defineEmits<{
  (e: 'change', value: any): void
}>()

const selectList = ref<any[]>([])
const selectIndex = ref(0)

watch(() => props.tabList, (n) => {
  if (n && n.length > 0) changeIndex(n[0], 0)
})

function changeIndex(item: any, index: number) {
  if (props.type === 'str') {
    selectIndex.value = index
    emit('change', item)
  } else {
    const idx = selectList.value.indexOf(item)
    if (idx >= 0) {
      selectList.value.splice(idx, 1)
    } else {
      selectList.value.push(item)
    }
    emit('change', [...selectList.value])
  }
}
</script>

<style scoped>
.select-row {
  width: 100%;
  overflow-x: auto;
}

.scroll-body {
  display: flex;
  gap: 10px;
  white-space: nowrap;
}

.select-item {
  height: 24px;
  border-radius: var(--global-border-radius);
  background: var(--color-black-5);
  font-size: 13px;
  color: var(--color-black-30);
  padding: 2px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.select-item.selected {
  background: var(--color-gradient-purple-yellow);
  box-shadow: 0 0 2px 0 var(--color-black-30);
  font-weight: bold;
  color: var(--color--564dff);
}
</style>
