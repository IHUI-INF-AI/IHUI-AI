<template>
  <div class="introduction">
    <div class="text">{{ content }}</div>
    <div v-if="aiList.length" class="ai-list">
      <div v-for="item in aiList" :key="item.id" class="ai-item" @click="toAiList(item)">
        <span class="ai-text">{{ item.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

defineOptions({ name: 'Introduction' })

const props = defineProps<{
  videoList?: any[]
  content?: string
  agentMap?: Record<string, string>
}>()

const aiList = ref<any[]>([])

watch(() => props.agentMap, (n) => {
  if (n) {
    aiList.value = Object.entries(n).map(([id, name]) => ({ id, name }))
  }
}, { immediate: true })

function toAiList(obj: any) {
  window.dispatchEvent(new CustomEvent('courseToAiList', { detail: obj.id }))
}
</script>

<style scoped>
.introduction {
  width: 100%;
  margin-top: 12px;
  padding-top: 16px;
  border-top: var(--unified-border);
}

.text {
  font-size: 15px;
  color: var(--color-gray-757575);
  margin-bottom: 10px;
}

.ai-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-item {
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  padding: 2px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ai-text {
  font-size: 12px;
  color: var(--color-blue-768dff);
}
</style>
