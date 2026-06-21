<template>
  <div class="banner" v-loading="loading">
    <el-carousel
      v-if="carousel.length"
      :interval="5000"
      arrow="always"
      indicator-position="outside"
      height="280px"
    >
      <el-carousel-item v-for="(item, i) in carousel" :key="i">
        <a v-if="item.link" :href="item.link" target="_blank" class="banner-link">
          <img :src="item.image" :alt="item.title" width="1240" height="280" loading="lazy" />
        </a>
        <img v-else :src="item.image" :alt="item.title" width="1240" height="280" loading="lazy" />
      </el-carousel-item>
    </el-carousel>
    <div v-else class="banner-empty">
      <el-empty description="暂无轮播" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    carousel?: any[]
    loading?: boolean
  }>(),
  { carousel: () => [], loading: false }
)
</script>

<style lang="scss" scoped>
:where(.banner) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
}

:where(.banner-link) {
  display: block;
  width: 100%;
  height: 100%;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: var(--global-border-radius);
  }
}

:where(.banner-empty) {
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}
</style>
