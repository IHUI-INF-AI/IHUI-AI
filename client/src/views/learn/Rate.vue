<template>
  <div class="learn-rate-page" v-loading="loading">
    <div class="rate-summary">
      <div class="rate-score">
        <div class="score-num">{{ avgRating.toFixed(1) }}</div>
        <el-rate v-model="avgRating" disabled :show-text="false" />
        <div class="score-count">{{ total }} {{ t('learnRate.reviews') }}</div>
      </div>
      <div class="rate-action">
        <el-button type="primary" @click="dialogVisible = true">{{ t('learnRate.writeReview') }}</el-button>
      </div>
    </div>

    <div class="rate-list">
      <el-empty v-if="!list.length" description="暂无评价" />
      <div v-for="c in list" :key="c.id" class="rate-item">
        <div class="rate-head">
          <span class="rate-user">{{ c.userName }}</span>
          <el-rate :model-value="c.rating" disabled :show-text="false" />
          <span class="rate-time">{{ c.createTime }}</span>
        </div>
        <p class="rate-content">{{ c.content }}</p>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="写评价" width="500px">
      <el-form>
        <el-form-item label="评分">
          <el-rate v-model="form.rating" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.submit') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ElMessage } from 'element-plus'
import { learnApi } from '@/api/learn'

const props = defineProps<{ lessonId: string }>()

const list = ref<any[]>([])
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const form = ref({ rating: 5, content: '' })

const total = computed(() => list.value.length)
const avgRating = computed(() => {
  if (!list.value.length) return 0
  const sum = list.value.reduce((s, c) => s + (c.rating || 0), 0)
  return sum / list.value.length
})

async function load() {
  loading.value = true
  try {
    const res: any = await learnApi.commentList(props.lessonId)
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!form.value.content.trim()) {
    ElMessage.warning('请输入评价内容')
    return
  }
  submitting.value = true
  try {
    await learnApi.commentSubmit({
      lessonId: props.lessonId,
      content: form.value.content,
      rating: form.value.rating,
    })
    ElMessage.success('评价成功')
    dialogVisible.value = false
    form.value = { rating: 5, content: '' }
    load()
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.learn-rate-page) {
  width: 100%;
}

:where(.rate-summary) {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: var(--unified-border-bottom);
}

:where(.rate-score) {
  flex: 1;
}

:where(.score-num) {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-warning);
}

:where(.score-count) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

:where(.rate-list) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:where(.rate-item) {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.rate-head) {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

:where(.rate-user) {
  font-size: 13px;
  font-weight: 500;
}

:where(.rate-time) {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.rate-content) {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
</style>
