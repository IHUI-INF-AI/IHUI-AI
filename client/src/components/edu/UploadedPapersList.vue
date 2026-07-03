<template>
  <!--
    UploadedPapersList.vue — 试卷卡片列表（PR-E E3）
    展示学员上传的试卷，含缩略图/类型 tag/科目 tag/考试日期/分数
    支持 limit 限制显示数量 + view-all 事件（Profile 预览用）
    删除操作通过 emit 上抛给父组件处理
  -->
  <section class="uploaded-papers-list">
    <header v-if="showHeader" class="section-header">
      <h3 class="section-title">{{ t('edu.profile.paperListTitle') }}</h3>
      <span v-if="papers.length" class="paper-count">{{ papers.length }}</span>
    </header>

    <el-empty v-if="!papers.length" :description="t('edu.profile.empty')" />

    <template v-else>
      <el-row :gutter="16">
        <el-col
          v-for="paper in visiblePapers"
          :key="paper.id"
          :xs="24"
          :sm="12"
          :md="8"
        >
          <div class="paper-card">
            <div class="paper-thumb">
              <el-image
                v-if="isImageFile(paper.file_url)"
                :src="paper.file_url"
                fit="cover"
                class="thumb-image"
              >
                <template #error>
                  <div class="thumb-fallback">
                    <el-icon :size="32"><Document /></el-icon>
                  </div>
                </template>
              </el-image>
              <div v-else class="thumb-fallback">
                <el-icon :size="32"><Document /></el-icon>
              </div>
              <el-tag
                :type="getPaperTypeTagType(paper.paper_type)"
                size="small"
                effect="dark"
                class="paper-type-tag"
              >
                {{ getPaperTypeLabel(paper.paper_type) }}
              </el-tag>
            </div>

            <div class="paper-body">
              <div class="paper-card-title" :title="paper.title">{{ paper.title }}</div>
              <div class="paper-card-meta">
                <el-tag size="small" type="info" effect="plain">
                  {{ getSubjectLabel(paper.subject) }}
                </el-tag>
                <span class="meta-text">{{ formatDate(paper.exam_date) }}</span>
              </div>
              <div v-if="paper.score != null" class="paper-card-score">
                <span class="meta-label">{{ t('edu.profile.paperScoreLabel') }}:</span>
                <span class="meta-value">
                  {{ paper.score }}<template v-if="paper.full_score"> / {{ paper.full_score }}</template>
                </span>
              </div>
              <p v-if="paper.description" class="paper-card-desc" :title="paper.description">
                {{ paper.description }}
              </p>
              <div class="paper-card-actions">
                <a
                  v-if="paper.file_url"
                  :href="paper.file_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="paper-view-link"
                  :aria-label="t('edu.profile.paperView') + ' ' + paper.title"
                >
                  <el-icon><View /></el-icon>
                  <span>{{ t('edu.profile.paperView') }}</span>
                </a>
                <el-button
                  v-if="showDelete"
                  type="danger"
                  size="small"
                  text
                  :icon="Delete"
                  @click="handleDelete(paper)"
                >
                  {{ t('edu.profile.paperDelete') }}
                </el-button>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>

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
import { Document, View, Delete, ArrowRight } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { UploadedPaper, PaperType, PaperSubject } from '@/api/edu/uploaded-papers'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  papers: UploadedPaper[]
  /** 是否显示 header */
  showHeader?: boolean
  /** 是否显示删除按钮（默认 true） */
  showDelete?: boolean
  /** 限制显示数量（0 = 不限制，Profile 预览用 5） */
  limit?: number
}>(), {
  showHeader: true,
  showDelete: true,
  limit: 0,
})

const emit = defineEmits<{
  (e: 'delete', paper: UploadedPaper): void
  (e: 'view-all'): void
}>()

const visiblePapers = computed<UploadedPaper[]>(() => {
  if (!props.limit || props.limit <= 0) return props.papers
  return props.papers.slice(0, props.limit)
})

const showViewAll = computed(() => {
  if (!props.limit || props.limit <= 0) return false
  return props.papers.length > props.limit
})

function formatDate(value?: string): string {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD') : value
}

function isImageFile(url?: string): boolean {
  if (!url) return false
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
}

function getPaperTypeTagType(type: PaperType): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  switch (type) {
    case 'midterm':
      return 'primary'
    case 'final':
      return 'danger'
    case 'unit_test':
      return 'success'
    case 'mock_exam':
      return 'warning'
    case 'competition':
      return 'info'
    default:
      return 'info'
  }
}

function getPaperTypeLabel(type: PaperType): string {
  switch (type) {
    case 'unit_test':
      return t('edu.profile.paperTypeUnitTest')
    case 'midterm':
      return t('edu.profile.paperTypeMidterm')
    case 'final':
      return t('edu.profile.paperTypeFinal')
    case 'mock_exam':
      return t('edu.profile.paperTypeMockExam')
    case 'competition':
      return t('edu.profile.paperTypeCompetition')
    default:
      return t('edu.profile.paperTypeOther')
  }
}

function getSubjectLabel(subject: PaperSubject): string {
  switch (subject) {
    case 'chinese':
      return t('edu.profile.subjectChinese')
    case 'math':
      return t('edu.profile.subjectMath')
    case 'english':
      return t('edu.profile.subjectEnglish')
    case 'physics':
      return t('edu.profile.subjectPhysics')
    case 'chemistry':
      return t('edu.profile.subjectChemistry')
    case 'biology':
      return t('edu.profile.subjectBiology')
    case 'history':
      return t('edu.profile.subjectHistory')
    case 'geography':
      return t('edu.profile.subjectGeography')
    case 'politics':
      return t('edu.profile.subjectPolitics')
    default:
      return t('edu.profile.subjectOther')
  }
}

function handleDelete(paper: UploadedPaper) {
  emit('delete', paper)
}
</script>

<style lang="scss" scoped>
:where(.uploaded-papers-list) {
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

:where(.paper-count) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 10px;
}

:where(.paper-card) {
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--color-white-50);
  }
}

:where(.paper-thumb) {
  position: relative;
  width: 100%;
  height: 140px;
  background: var(--el-fill-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

:where(.thumb-image) {
  width: 100%;
  height: 100%;
}

:where(.thumb-fallback) {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
}

:where(.paper-type-tag) {
  position: absolute;
  top: 8px;
  right: 8px;
}

:where(.paper-body) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
}

:where(.paper-card-title) {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:where(.paper-card-meta) {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

:where(.meta-text) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.paper-card-score) {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

:where(.meta-label) {
  color: var(--el-text-color-secondary);
}

:where(.meta-value) {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

:where(.paper-card-desc) {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.paper-card-actions) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--color-white-30);
}

:where(.paper-view-link) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-color-primary);
  text-decoration: none;

  &:hover {
    color: var(--el-color-primary-light-3);
  }
}

:where(.view-all-bar) {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

:where(.view-all-icon) {
  margin-left: 4px;
}
</style>
