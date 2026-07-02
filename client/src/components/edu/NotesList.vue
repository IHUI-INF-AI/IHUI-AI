<template>
  <section class="notes-list">
    <header class="section-header">
      <h3 class="section-title">{{ t('edu.profile.myNotes') }}</h3>
    </header>

    <el-empty v-if="!notes.length" :description="t('edu.profile.empty')" />

    <template v-else>
      <div class="note-cards">
        <article
          v-for="note in visibleNotes"
          :key="note.id"
          class="note-card"
        >
          <div class="note-main">
            <div class="note-header">
              <h4 class="note-title" :title="note.title">{{ note.title || '-' }}</h4>
              <el-icon class="visibility-icon" :class="{ 'is-public': note.is_public }">
                <View v-if="note.is_public" />
                <Hide v-else />
              </el-icon>
            </div>

            <p class="note-summary">{{ summarize(note.content) }}</p>

            <div v-if="note.tags && note.tags.length" class="note-tags">
              <el-tag
                v-for="tag in note.tags"
                :key="tag"
                size="small"
                effect="plain"
                class="note-tag"
              >
                {{ tag }}
              </el-tag>
            </div>
          </div>

          <div class="note-footer">
            <span class="note-time">
              <el-icon><Clock /></el-icon>
              {{ formatTime(note.create_time) }}
            </span>
            <div class="note-footer-right">
              <span v-if="note.is_public" class="note-visibility-text is-public">
                {{ t('edu.profile.public') }}
              </span>
              <span v-else class="note-visibility-text is-private">
                {{ t('edu.profile.private') }}
              </span>
              <div class="note-actions">
                <el-button text :icon="Edit" size="small" @click.stop="emit('edit', note)" />
                <el-button text :icon="Delete" size="small" @click.stop="emit('delete', note)" />
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-if="showViewAll" class="view-all-bar">
        <el-button
          type="primary"
          plain
          size="small"
          @click="emit('view-all')"
        >
          {{ t('edu.profile.viewAll') }}
          <el-icon class="view-all-icon"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { View, Hide, Clock, ArrowRight, Edit, Delete } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { LearningNote } from '@/api/edu/notes'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  notes: LearningNote[]
  limit?: number
}>(), {
  limit: 0,
})

const emit = defineEmits<{
  (e: 'view-all'): void
  (e: 'edit', note: LearningNote): void
  (e: 'delete', note: LearningNote): void
}>()

const visibleNotes = computed<LearningNote[]>(() => {
  if (!props.limit || props.limit <= 0) return props.notes
  return props.notes.slice(0, props.limit)
})

const showViewAll = computed(() => {
  if (!props.limit || props.limit <= 0) return false
  return props.notes.length > props.limit
})

const SUMMARY_MAX = 100

function summarize(content?: string): string {
  if (!content) return ''
  const text = String(content).replace(/\s+/g, ' ').trim()
  if (text.length <= SUMMARY_MAX) return text
  return text.slice(0, SUMMARY_MAX) + '…'
}

function formatTime(value?: string): string {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : value
}
</script>

<style lang="scss" scoped>
:where(.notes-list) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

:where(.section-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:where(.section-title) {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:where(.note-cards) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:where(.note-card) {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--color-white-50);
  }
}

:where(.note-main) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:where(.note-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

:where(.note-title) {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:where(.visibility-icon) {
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);

  &.is-public {
    color: var(--el-color-primary);
  }
}

:where(.note-summary) {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.note-tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

:where(.note-tag) {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:where(.note-footer) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-white-30);
  font-size: 12px;
}

:where(.note-time) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
}

:where(.note-visibility-text) {
  font-weight: 500;

  &.is-public {
    color: var(--el-color-primary);
  }

  &.is-private {
    color: var(--el-text-color-placeholder);
  }
}

:where(.note-footer-right) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

:where(.note-actions) {
  display: flex;
  gap: 4px;

  :where(.el-button) {
    padding: 4px;
    color: var(--el-text-color-secondary);

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

:where(.view-all-bar) {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

:where(.view-all-icon) {
  margin-left: 4px;
}
</style>
