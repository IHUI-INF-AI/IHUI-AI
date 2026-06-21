<template>
  <video
    class="learn-video"
    :src="src"
    :poster="poster"
    :controls="controls"
    :autoplay="autoplay"
    preload="metadata"
    @timeupdate="handleTimeUpdate"
    @ended="emit('ended')"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    src: string
    poster?: string
    controls?: boolean
    autoplay?: boolean
  }>(),
  { controls: true, autoplay: false }
)

const emit = defineEmits<{
  timeupdate: [currentTime: number]
  ended: []
}>()

function handleTimeUpdate(e: Event) {
  const t = e.target as HTMLVideoElement
  emit('timeupdate', t.currentTime)
}
</script>

<style lang="scss" scoped>
:where(.learn-video) {
  display: block;
  width: 100%;
  max-width: 100%;
  background: var(--color-video-bg);
  border-radius: var(--global-border-radius);
}
</style>
