<template>
  <div class="row-tabs">
    <TabsBar
      :item="{ name: item.name, id: item.id }"
      :tags="subCategories"
      :more-link="`/learn/list?cid=${item.id}`"
    />
    <div v-loading="loading" class="row-content">
      <el-empty v-if="!list.length" :description="t('common.noData')" />
      <Rectangle
        v-for="item in list"
        :key="item.id"
        :item="item"
        link="/learn/detail"
        class="row-item"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import TabsBar from './TabsBar.vue'
import Rectangle from './Rectangle.vue'

const { t } = useI18n()

defineProps<{
  item: { id: string | number; name: string; tags?: any[] }
  list: any[]
  subCategories?: any[]
  loading?: boolean
}>()
</script>

<style lang="scss" scoped>
:where(.row-tabs) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto 24px;
  padding: 0 12px;
}

:where(.row-content) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

:where(.row-item) {
  min-width: 0;
}
</style>
