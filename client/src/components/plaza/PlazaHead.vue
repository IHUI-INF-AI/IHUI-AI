<template>
  <div class="plaza-head">
    <div style="height: 30px;"></div>
    <div class="head-content">
      <img class="back-btn" src="https://file.aizhs.top/sys-mini/default/back.svg" @click="goBack" />
      <img class="menu-btn" src="https://file.aizhs.top/sys-mini/backf2.png" @click="menu" />
      <div class="title">{ t('plazaPlazaHead.plazaPublish') }</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'PlazaHead' })


const emit = defineEmits<{
  (e: 'goBack'): void
}>()

function goBack() { emit('goBack') }
function menu() {}
</script>

<style scoped>
.plaza-head {
  width: 100%; height: 54px; box-sizing: border-box;
}

.head-content {
  display: flex; align-items: center;
}
.back-btn { width: 16px; height: 12px; margin-left: 16px; cursor: pointer; }
.menu-btn { width: 18px; height: 18px; margin-left: 12px; cursor: pointer; }

.title {
  flex: 1; font-size: 20px; font-weight: normal; color: var(--color-black);
  display: flex; align-items: center; justify-content: center;
}
</style>
