<template>
  <div class="search-bar-module">
    <el-input
      v-model="keyword"
      :placeholder="placeholder"
      clearable
      size="large"
      @keyup.enter="handleSearch"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
      <template #append>
        <el-button type="primary" @click="handleSearch">{{ t('common.search') }}</el-button>
      </template>
    </el-input>
    <div v-if="hotWords && hotWords.length" class="hot-words">
      <span class="hot-label">{{ t('common.hot') }}:</span>
      <span
        v-for="(w, i) in hotWords"
        :key="i"
        class="hot-word"
        :class="{ active: Number(i) < 3 }"
        @click="handleHotClick(w)"
      >{{ w }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from '@element-plus/icons-vue'

const { t } = useI18n()

const props = defineProps<{ modelValue?: string; placeholder?: string; hotWords?: string[] }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'search', v: string): void
  (e: 'hot', v: string): void
}>()

const keyword = ref(props.modelValue || '')
watch(() => props.modelValue, v => (keyword.value = v || ''))
watch(keyword, v => emit('update:modelValue', v))

const handleSearch = () => emit('search', keyword.value)
const handleHotClick = (w: string) => {
  keyword.value = w
  emit('hot', w)
}
</script>

<style scoped lang="scss">
:where(.search-bar-module) {
  .hot-words {
    margin-top: 8px;
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  }

  .hot-label {
    font-size: 13px; color: var(--el-text-color-secondary);
  }

  .hot-word {
    font-size: 13px; color: var(--el-text-color-regular);
    cursor: pointer;
    transition: color 0.2s;
    &:hover, &.active { color: var(--el-color-primary); }
  }
}
</style>
