<template>
  <section class="course-progress-list">
    <header class="section-header">
      <h3 class="section-title">{{ t('edu.profile.courseProgress') }}</h3>
    </header>

    <el-empty v-if="!courses.length" :description="t('edu.profile.empty')" />

    <el-table
      v-else
      :data="courses"
      style="width: 100%"
      row-key="course.id"
    >
      <el-table-column :label="t('edu.profile.courseTitle')" min-width="200">
        <template #default="{ row }">
          <div class="course-title-cell">
            <span class="course-title-text">{{ row.course?.title || '-' }}</span>
            <span v-if="row.course?.subtitle" class="course-subtitle">{{ row.course.subtitle }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.difficulty')" width="120">
        <template #default="{ row }">
          <el-tag
            :type="getDifficultyType(row.course?.difficulty)"
            size="small"
            effect="light"
          >
            {{ getDifficultyLabel(row.course?.difficulty) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.lessonCount')" width="100" align="center">
        <template #default="{ row }">
          {{ row.course?.lesson_count ?? 0 }}
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.progress')" min-width="220">
        <template #default="{ row }">
          <el-progress
            :percentage="getCompletion(row.completion)"
            :status="getProgressStatus(row.completion)"
            :stroke-width="10"
          />
        </template>
      </el-table-column>

      <el-table-column :label="t('edu.profile.status')" width="110" align="center">
        <template #default="{ row }">
          <el-tag
            :type="getStatusType(row.completion)"
            size="small"
            effect="dark"
          >
            {{ getStatusLabel(row.completion) }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EduCourse } from '@/api/edu'

const { t } = useI18n()

interface CourseProgressItem {
  course: EduCourse
  completion: number
  progress: unknown[]
}

const props = defineProps<{
  courses: CourseProgressItem[]
}>()

const totalCount = computed(() => props.courses.length)

function getCompletion(value: number): number {
  if (!Number.isFinite(value)) return 0
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return clamped
}

function getProgressStatus(value: number): '' | 'success' | 'exception' {
  const v = getCompletion(value)
  if (v >= 100) return 'success'
  return ''
}

function getStatusType(value: number): 'success' | 'warning' | 'info' {
  const v = getCompletion(value)
  if (v >= 100) return 'success'
  if (v > 0) return 'warning'
  return 'info'
}

function getStatusLabel(value: number): string {
  const v = getCompletion(value)
  if (v >= 100) return t('edu.profile.statusCompleted')
  if (v > 0) return t('edu.profile.statusInProgress')
  return t('edu.profile.statusNotStarted')
}

function getDifficultyType(difficulty?: string): 'info' | 'success' | 'warning' | 'danger' {
  switch (difficulty) {
    case 'beginner':
    case 'easy':
      return 'success'
    case 'intermediate':
    case 'medium':
      return 'warning'
    case 'advanced':
    case 'hard':
      return 'danger'
    default:
      return 'info'
  }
}

function getDifficultyLabel(difficulty?: string): string {
  switch (difficulty) {
    case 'beginner':
    case 'easy':
      return t('edu.profile.difficultyBeginner')
    case 'intermediate':
    case 'medium':
      return t('edu.profile.difficultyIntermediate')
    case 'advanced':
    case 'hard':
      return t('edu.profile.difficultyAdvanced')
    default:
      return difficulty || t('edu.profile.difficultyUnknown')
  }
}

defineExpose({ totalCount })
</script>

<style lang="scss" scoped>
:where(.course-progress-list) {
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

:where(.course-title-cell) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:where(.course-title-text) {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

:where(.course-subtitle) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.course-progress-list) :deep(.el-table) {
  border-radius: 8px;
  border: 1px solid var(--color-white-30);
}

:where(.course-progress-list) :deep(.el-table th.el-table__cell) {
  background: var(--el-fill-color-light);
}
</style>
