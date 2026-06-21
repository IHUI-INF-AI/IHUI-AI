<template>
  <div class="ai-platform-provider">
    <slot />
    
    <ShortcutsHelpPanel v-if="enableShortcuts" />
    
    <QueueMonitorPanel v-if="enableQueueMonitor && showQueueMonitor" />
    
    <div class="ai-notification-container" />
  </div>
</template>

<script setup lang="ts">
import { provide, ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import { useGenerationQueue } from '@/services/GenerationQueueService'
import { useNotificationCenter } from '@/composables/useNotificationCenter'
import ShortcutsHelpPanel from './ShortcutsHelpPanel.vue'
import QueueMonitorPanel from './QueueMonitorPanel.vue'

const { t } = useI18n()

// ============================================================================

const props = withDefaults(defineProps<{
  enableShortcuts?: boolean
  enableQueueMonitor?: boolean
  enableNotifications?: boolean
  maxConcurrent?: number
  autoRestoreQueue?: boolean
}>(), {
  enableShortcuts: true,
  enableQueueMonitor: true,
  enableNotifications: true,
  maxConcurrent: 2,
  autoRestoreQueue: true,
})

const shortcuts = useGlobalShortcuts()

const queue = useGenerationQueue({
  maxConcurrent: props.maxConcurrent,
  autoRetryOnFailure: true,
  saveProgress: props.autoRestoreQueue,
})

const notifications = useNotificationCenter()

const showQueueMonitor = ref(true)

provide('globalShortcuts', shortcuts)

provide('generationQueue', queue)

provide('notificationCenter', notifications)

provide('aiPlatformConfig', {
  enableShortcuts: props.enableShortcuts,
  enableQueueMonitor: props.enableQueueMonitor,
  enableNotifications: props.enableNotifications,
})

onMounted(() => {
  if (props.enableShortcuts) {
    shortcuts.registerShortcut({
      id: 'platform-toggle-queue',
      key: 'q',
      modifiers: { ctrl: true },
      description: t('messages.toggleQueueMonitor'),
      category: 'general',
      scope: 'global',
      handler: () => {
        showQueueMonitor.value = !showQueueMonitor.value
      },
    })
    
    shortcuts.registerShortcut({
      id: 'platform-pause-queue',
      key: 'q',
      modifiers: { ctrl: true, shift: true },
      description: t('messages.pauseResumeQueue'),
      category: 'general',
      scope: 'global',
      handler: () => {
        if (queue.stats.value.processing > 0) {
          queue.pause()
          notifications.showInfo(t('messages.queuePaused'))
        } else {
          queue.resume()
          notifications.showInfo(t('messages.queueResumed'))
        }
      },
    })
  }
})

watch(() => queue.stats.value, (stats) => {
  if (stats.completed > 0 && stats.processing === 0 && stats.pending === 0) {
    if (stats.failed === 0) {
      notifications.showSuccess(t('messages.allTasksCompleted', { count: stats.completed }))
    } else {
      notifications.showWarning(t('messages.tasksCompletedWithFailures', { completed: stats.completed, failed: stats.failed }))
    }
  }
}, { deep: true })

onUnmounted(() => {
  if (props.enableShortcuts) {
    shortcuts.unregisterShortcut('platform-toggle-queue')
    shortcuts.unregisterShortcut('platform-pause-queue')
  }
})

defineExpose({
  shortcuts,
  queue,
  notifications,
  toggleQueueMonitor: () => {
    showQueueMonitor.value = !showQueueMonitor.value
  },
})
</script>

<style scoped lang="scss">
.ai-platform-provider {
  position: relative;
  width: 100%;
  height: 100%;
}

.ai-notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: var(--z-notification);
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  
  > * {
    pointer-events: auto;
  }
}
</style>
