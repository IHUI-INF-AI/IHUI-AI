<template>
  <div class="learn-breadcrumb">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item v-for="(b, i) in items" :key="i">
        <router-link v-if="b.path && Number(i) < items.length - 1" :to="b.path">{{ b.title }}</router-link>
        <span v-else>{{ b.title }}</span>
      </el-breadcrumb-item>
    </el-breadcrumb>
  </div>
</template>

<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'

defineProps<{
  items: { title: string; path?: string }[]
}>()
</script>

<style lang="scss" scoped>
:where(.learn-breadcrumb) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px 0;
}
</style>
