<template>
  <div class="big-row-tabs">
    <TabsBar
      :item="{ name: item.name, id: item.id }"
      :tags="subCategories"
      :more-link="`/learn/list?cid=${item.id}`"
    />
    <div v-loading="loading" class="big-row-content">
      <el-empty v-if="!list.length" description="暂无课程" />
      <BigRectangle
        v-for="b in list"
        :key="b.id"
        :item="b"
        link="/learn/detail"
        class="big-row-item"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import TabsBar from './TabsBar.vue'
import BigRectangle from './BigRectangle.vue'

defineProps<{
  item: { id: string | number; name: string; tags?: any[] }
  list: any[]
  subCategories?: any[]
  loading?: boolean
}>()
</script>

<style lang="scss" scoped>
:where(.big-row-tabs) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto 24px;
  padding: 0 12px;
}

:where(.big-row-content) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

:where(.big-row-item) {
  min-width: 0;
}
</style>
