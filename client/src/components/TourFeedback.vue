<template>
  <el-dialog
    v-model="visible"
    :title="t('tourFeedback.title')"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @close="handleClose"
  >
    <div class="feedback-content">
      <div class="rating-section">
        <p class="rating-label">{{ t('tourFeedback.ratingLabel') }}</p>
        <div class="rating-stars">
          <el-icon
            v-for="star in 5"
            :key="star"
            class="star-icon"
            :class="{ active: star <= rating }"
            @click="rating = star"
          >
            <StarFilled />
          </el-icon>
        </div>
        <p class="rating-text">{{ getRatingText(rating) }}</p>
      </div>

      <div class="tags-section">
        <p class="tags-label">{{ t('tourFeedback.tagsLabel') }}</p>
        <div class="tags-container">
          <el-tag
            v-for="tag in availableTags"
            :key="tag.value"
            :type="selectedTags.includes(tag.value) ? 'primary' : 'info'"
            class="feedback-tag"
            @click="toggleTag(tag.value)"
          >
            {{ tag.label }}
          </el-tag>
        </div>
      </div>

      <div class="comment-section">
        <p class="comment-label">{{ t('tourFeedback.commentLabel') }}</p>
        <el-input
          v-model="comment"
          type="textarea"
          :rows="3"
          :placeholder="t('tourFeedback.commentPlaceholder')"
          maxlength="200"
          show-word-limit
        />
      </div>
    </div>

    <template #footer>
      <el-button @click="handleSkip">{{ t('tourFeedback.skip') }}</el-button>
      <el-button type="primary" @click="handleSubmit" :disabled="rating === 0">
        {{ t('tourFeedback.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { StarFilled } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { StorageManager } from '@/utils/storage'

interface TourFeedback {
  tourId: string
  rating: number
  tags: string[]
  comment: string
  timestamp: number
}

const props = defineProps<{
  modelValue: boolean
  tourId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submitted', feedback: TourFeedback): void
  (e: 'skipped'): void
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const rating = ref(0)
const selectedTags = ref<string[]>([])
const comment = ref('')

const availableTags = computed(() => [
  { value: 'helpful', label: t('tourFeedback.tags.helpful') },
  { value: 'clear', label: t('tourFeedback.tags.clear') },
  { value: 'easy', label: t('tourFeedback.tags.easy') },
  { value: 'fast', label: t('tourFeedback.tags.fast') },
  { value: 'confusing', label: t('tourFeedback.tags.confusing') },
  { value: 'long', label: t('tourFeedback.tags.long') },
])

const getRatingText = (value: number): string => {
  const texts: Record<number, string> = {
    1: t('tourFeedback.rating.1'),
    2: t('tourFeedback.rating.2'),
    3: t('tourFeedback.rating.3'),
    4: t('tourFeedback.rating.4'),
    5: t('tourFeedback.rating.5'),
  }
  return texts[value] || ''
}

const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag)
  if (index === -1) {
    selectedTags.value.push(tag)
  } else {
    selectedTags.value.splice(index, 1)
  }
}

const handleSubmit = () => {
  if (rating.value === 0) {
    ElMessage.warning(t('tourFeedback.pleaseRate'))
    return
  }

  const feedback: TourFeedback = {
    tourId: props.tourId,
    rating: rating.value,
    tags: [...selectedTags.value],
    comment: comment.value.trim(),
    timestamp: Date.now(),
  }

  saveFeedback(feedback)
  emit('submitted', feedback)
  ElMessage.success(t('tourFeedback.thankYou'))
  resetForm()
  visible.value = false
}

const handleSkip = () => {
  emit('skipped')
  resetForm()
  visible.value = false
}

const handleClose = () => {
  handleSkip()
}

const resetForm = () => {
  rating.value = 0
  selectedTags.value = []
  comment.value = ''
}

const saveFeedback = (feedback: TourFeedback) => {
  const allFeedback = StorageManager.getItem<Record<string, TourFeedback[]>>('tour_feedback') || {}
  if (!allFeedback[feedback.tourId]) {
    allFeedback[feedback.tourId] = []
  }
  allFeedback[feedback.tourId].push(feedback)
  StorageManager.setItem('tour_feedback', allFeedback)
}
</script>

<style scoped lang="scss">
.feedback-content {
  .rating-section {
    text-align: center;
    margin-bottom: 24px;

    .rating-label {
      margin-bottom: 12px;
      font-size: 14px;
      color: var(--el-text-color-regular);
    }

    .rating-stars {
      display: flex;
      justify-content: center;
      gap: 8px;

      .star-icon {
        font-size: 32px;
        color: var(--el-text-color-disabled);
        cursor: pointer;
        transition: transform 0.2s, color 0.2s;

        &:hover {
          transform: scale(1.1);
        }

        &.active {
          color: var(--color-warning-gold);
        }
      }
    }

    .rating-text {
      margin-top: 8px;
      font-size: 14px;
      color: var(--el-text-color-primary);
    }
  }

  .tags-section {
    margin-bottom: 20px;

    .tags-label {
      margin-bottom: 12px;
      font-size: 14px;
      color: var(--el-text-color-regular);
    }

    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .feedback-tag {
        cursor: pointer;
        transition: opacity 0.2s;

        &:hover {
          opacity: 0.8;
        }
      }
    }
  }

  .comment-section {
    .comment-label {
      margin-bottom: 12px;
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }
}
</style>
