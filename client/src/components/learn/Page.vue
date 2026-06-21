<template>
  <div class="learn-pagination">
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[12, 24, 48]"
      :background="true"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="handleSizeChange"
      @current-change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    total: number
    page?: number
    size?: number
  }>(),
  { page: 1, size: 12 }
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:size': [size: number]
  change: [{ page: number; size: number }]
}>()

const currentPage = ref(props.page)
const pageSize = ref(props.size)

watch(
  () => props.page,
  (v) => (currentPage.value = v)
)
watch(
  () => props.size,
  (v) => (pageSize.value = v)
)

function handlePageChange(p: number) {
  emit('update:page', p)
  emit('change', { page: p, size: pageSize.value })
}

function handleSizeChange(s: number) {
  emit('update:size', s)
  emit('change', { page: currentPage.value, size: s })
}
</script>

<style lang="scss" scoped>
:where(.learn-pagination) {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
</style>
