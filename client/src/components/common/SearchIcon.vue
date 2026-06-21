<template>
  <div class="search-icon-wrapper" :class="{ small: size === 'small' }">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
      fill="none"
      class="search-icon-svg"
    >
      <circle r="8" cy="11" cx="11" />
      <line y2="16.65" y1="22" x2="16.65" x1="22" />
    </svg>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'default' | 'small'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default'
})

const iconSize = props.size === 'small' ? 14 : 16
</script>

<style scoped lang="scss">
.search-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;

  &.small {
    width: 14px;
    height: 14px;
  }

  .search-icon-svg {
    stroke: currentcolor;
    flex-shrink: 0;
  }
}
</style>
