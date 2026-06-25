<template>
  <div class="media-viewer" :class="{ 'is-audio': isAudio }">
    <div class="media-container">
      <video
        v-if="!isAudio"
        ref="mediaRef"
        :src="src"
        class="video-player"
        :poster="poster"
        controls
        preload="none"
        @loadedmetadata="onLoaded"
        @error="onError"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
      >
        {{ t('mediaViewer.videoNotSupported') }}
      </video>
      
      <div v-else class="audio-wrapper">
        <div class="audio-cover">
          <div class="audio-icon">🎵</div>
          <div class="audio-visualizer" :class="{ playing: isPlaying }">
            <span v-for="i in 20" :key="i" class="bar" :style="{ animationDelay: `${i * 0.05}s` }"></span>
          </div>
        </div>
        <audio
          ref="mediaRef"
          :src="src"
          class="audio-player"
          controls
          @loadedmetadata="onLoaded"
          @error="onError"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @play="isPlaying = true"
          @pause="isPlaying = false"
        >
          {{ t('mediaViewer.audioNotSupported') }}
        </audio>
      </div>
    </div>
    
    <div class="media-toolbar">
      <div class="media-info">
        <span class="media-title">{{ title || t('mediaViewer.mediaFile') }}</span>
        <span v-if="duration" class="media-duration">{{ formatTime(duration) }}</span>
      </div>
      <div class="media-actions">
        <button class="action-btn" @click="togglePlaybackRate" :title="t('viewerMediaViewer.playSpeed')">
          {{ playbackRate }}x
        </button>
        <button class="action-btn" @click="toggleLoop" :class="{ active: isLooping }" :title="t('viewerMediaViewer.loop')" :aria-label="t('viewerMediaViewer.loop')">
          🔁
        </button>
        <button class="action-btn" @click="toggleMute" :title="t('viewerMediaViewer.mute')" :aria-label="t('viewerMediaViewer.mute')">
          {{ isMuted ? '🔇' : '🔊' }}
        </button>
        <a :href="src" download class="action-btn download-btn" :title="t('viewerMediaViewer.download')">⬇</a>
      </div>
    </div>
    
    <div v-if="error" class="error-overlay">
      <span class="error-icon">⚠️</span>
      <span>{{ t('viewerMediaViewer.mediaLoadFailed') }}</span>
      <a :href="src" download class="download-link">{{ t('mediaViewer.downloadView') }}</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { getFileType } from '@/utils/fileTypes'

const { t } = useI18n()
const props = defineProps<{
  src: string
  title?: string
  poster?: string
}>()

const emit = defineEmits<{
  (e: 'loaded', duration: number): void
  (e: 'error', error: Error): void
  (e: 'ended'): void
}>()

const mediaRef = ref<HTMLVideoElement | HTMLAudioElement | null>(null)
const error = ref(false)
const duration = ref(0)
const currentTime = ref(0)
const isPlaying = ref(false)
const isMuted = ref(false)
const isLooping = ref(false)
const playbackRate = ref(1)

const isAudio = computed(() => {
  const fileType = getFileType(props.src)
  return fileType.category === 'audio'
})

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const onLoaded = () => {
  if (mediaRef.value) {
    duration.value = mediaRef.value.duration
    emit('loaded', duration.value)
  }
}

const onError = () => {
  error.value = true
  emit('error', new Error('媒体加载失败'))
}

const onTimeUpdate = () => {
  if (mediaRef.value) {
    currentTime.value = mediaRef.value.currentTime
  }
}

const onEnded = () => {
  isPlaying.value = false
  emit('ended')
}

const togglePlaybackRate = () => {
  const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
  const currentIndex = rates.indexOf(playbackRate.value)
  const nextIndex = (currentIndex + 1) % rates.length
  playbackRate.value = rates[nextIndex]
  
  if (mediaRef.value) {
    mediaRef.value.playbackRate = playbackRate.value
  }
}

const toggleLoop = () => {
  isLooping.value = !isLooping.value
  if (mediaRef.value) {
    mediaRef.value.loop = isLooping.value
  }
}

const toggleMute = () => {
  isMuted.value = !isMuted.value
  if (mediaRef.value) {
    mediaRef.value.muted = isMuted.value
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!mediaRef.value) return
  
  switch (e.key) {
    case ' ':
      e.preventDefault()
      if (mediaRef.value.paused) {
        mediaRef.value.play()
      } else {
        mediaRef.value.pause()
      }
      break
    case 'ArrowLeft':
      mediaRef.value.currentTime -= 5
      break
    case 'ArrowRight':
      mediaRef.value.currentTime += 5
      break
    case 'ArrowUp':
      mediaRef.value.volume = Math.min(1, mediaRef.value.volume + 0.1)
      break
    case 'ArrowDown':
      mediaRef.value.volume = Math.max(0, mediaRef.value.volume - 0.1)
      break
    case 'm':
    case 'M':
      toggleMute()
      break
    case 'l':
    case 'L':
      toggleLoop()
      break
  }
}

const cleanup = useCleanup()

onMounted(() => {
  cleanup.addEventListener(document, 'keydown', handleKeydown)
})
</script>

<style scoped>
.media-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-text-color-primary);
  position: relative;
}

.media-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.video-player {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.audio-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 40px;
}

.audio-cover {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--el-text-color-primary) 0%, var(--el-text-color-primary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  }

.audio-icon {
  font-size: 64px;
}

.audio-visualizer {
  position: absolute;
  bottom: -40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 40px;
}

.audio-visualizer .bar {
  width: 4px;
  height: 10px;
  background: linear-gradient(to top, var(--el-text-color-primary), var(--el-text-color-primary));
  border-radius: var(--global-border-radius);
}

.audio-visualizer.playing .bar {
  animation: audioBar 0.5s ease-in-out infinite alternate;
}

@keyframes audioBar {
  0% { height: 10px; }
  100% { height: 40px; }
}

.audio-player {
  width: 100%;
  max-width: 400px;
}

.media-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-black-80);
}

.media-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.media-title {
  color: var(--el-bg-color);
  font-size: 14px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-duration {
  color: var(--color-white-60);
  font-size: 12px;
}

.media-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border: none;
  background: var(--color-white-10);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  color: var(--el-bg-color);
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--color-white-20);
}

.action-btn.active {
  background: var(--color-brand-blue-2);
}

.download-btn {
  text-decoration: none;
}

.error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--color-black-90);
  color: var(--el-bg-color);
}

.error-icon {
  font-size: 48px;
}

.download-link {
  padding: 10px 24px;
  background: var(--color-brand-blue-2);
  border-radius: var(--global-border-radius);
  color: var(--el-bg-color);
  text-decoration: none;
  font-size: 14px;
  transition: background 0.2s;
}

.download-link:hover {
  background: var(--color-blue-245bdb);
}

.is-audio .media-container {
  background: linear-gradient(135deg, var(--color-dark-1a1a2e) 0%, var(--el-text-color-primary) 100%);
}

@media (width <= 768px) {
  .audio-cover {
    width: 150px;
    height: 150px;
  }
  
  .audio-icon {
    font-size: 48px;
  }
  
  .media-toolbar {
    flex-direction: column;
    gap: 12px;
  }
  
  .media-info {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
