<template>
  <!--
    AskDetail.vue — 问题详情页
    路由: EduAskDetail (/edu/ask/detail/:questionId)
    功能: 问题详情 + 回答列表(最佳答案置顶/点赞/采纳) + 底部回答输入框
  -->
  <div class="ask-detail">
    <!-- ① 页头 -->
    <header class="page-header">
      <div class="header-text">
        <el-button :icon="ArrowLeft" text @click="goBack">
          {{ t('edu.ask.title') }}
        </el-button>
        <h1 class="page-title">{{ t('edu.ask.detailTitle') }}</h1>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadAll">
          {{ t('edu.common.retry') }}
        </el-button>
      </div>
    </header>

    <!-- ② 错误提示 -->
    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <div v-loading="loading" class="detail-body">
      <!-- ③ 问题主体 -->
      <section v-if="question" class="question-section">
        <div class="question-head">
          <el-tag
            :type="question.is_resolved ? 'success' : 'warning'"
            size="small"
            effect="plain"
          >
            {{ question.is_resolved ? t('edu.ask.resolved') : t('edu.ask.unresolved') }}
          </el-tag>
          <h2 class="question-title">{{ question.title }}</h2>
        </div>
        <div class="question-content">{{ question.content }}</div>
        <div v-if="parseTags(question.tags).length" class="question-tags">
          <el-tag
            v-for="tag in parseTags(question.tags)"
            :key="tag"
            size="small"
            type="info"
            effect="plain"
            class="q-tag"
          >
            {{ tag }}
          </el-tag>
        </div>
        <div class="question-meta">
          <span class="meta-item">
            <el-icon><View /></el-icon>
            {{ question.view_count }} {{ t('edu.ask.viewCount') }}
          </span>
          <span class="meta-item">
            <el-icon><ChatDotRound /></el-icon>
            {{ question.answer_count }} {{ t('edu.ask.answerCount') }}
          </span>
          <span class="meta-item">
            <el-icon><Clock /></el-icon>
            {{ question.created_at }}
          </span>
        </div>
      </section>

      <!-- ④ 回答列表 -->
      <section class="answers-section">
        <h3 class="section-title">
          {{ t('edu.ask.answers') }}
          <span v-if="answers.length" class="count-badge">{{ answers.length }}</span>
        </h3>

        <el-empty v-if="!loading && answers.length === 0" :description="t('edu.ask.noAnswers')" />

        <div v-else class="answer-cards">
          <article
            v-for="ans in answers"
            :key="ans.id"
            class="answer-card"
            :class="{ 'is-best': ans.is_best }"
          >
            <div v-if="ans.is_best" class="best-badge">
              <el-icon><CircleCheckFilled /></el-icon>
              {{ t('edu.ask.adoptSuccess') }}
            </div>
            <div class="answer-content">{{ ans.content }}</div>
            <div class="answer-footer">
              <span class="answer-time">
                <el-icon><Clock /></el-icon>
                {{ ans.created_at }}
              </span>
              <div class="answer-actions">
                <el-button
                  :type="ans.is_best ? 'success' : 'default'"
                  size="small"
                  :icon="Pointer"
                  @click="handleLike(ans)"
                >
                  {{ t('edu.ask.like') }} {{ ans.like_count }}
                </el-button>
                <el-button
                  v-if="question && !question.is_resolved"
                  type="primary"
                  size="small"
                  plain
                  :icon="Select"
                  @click="handleAdopt(ans)"
                >
                  {{ t('edu.ask.adopt') }}
                </el-button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- ⑤ 回答输入框 -->
      <section class="answer-form">
        <h3 class="section-title">{{ t('edu.ask.yourAnswer') }}</h3>
        <el-input
          v-model="answerContent"
          type="textarea"
          :rows="4"
          :placeholder="t('edu.ask.yourAnswerPlaceholder')"
          maxlength="2000"
          show-word-limit
        />
        <div class="form-actions">
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="!answerContent.trim()"
            @click="handleSubmitAnswer"
          >
            {{ t('edu.common.submit') }}
          </el-button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, Refresh, View, ChatDotRound, Clock,
  CircleCheckFilled, Pointer, Select,
} from '@element-plus/icons-vue'
import { askApi, type EduAskQuestion, type EduAskAnswer } from '@/api/edu'

const props = defineProps<{ questionId?: string }>()

const { t } = useI18n()
const router = useRouter()

const question = ref<EduAskQuestion | null>(null)
const answers = ref<EduAskAnswer[]>([])
const loading = ref(false)
const error = ref(false)
const answerContent = ref('')
const submitting = ref(false)

const questionIdNum = computed(() => {
  const n = Number(props.questionId)
  return Number.isFinite(n) && n > 0 ? n : 0
})

function parseTags(tags?: string): string[] {
  if (!tags) return []
  return tags
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function loadQuestion() {
  if (!questionIdNum.value) return
  try {
    const res = await askApi.getQuestion(questionIdNum.value)
    question.value = res.data.data ?? null
  } catch {
    error.value = true
  }
}

async function loadAnswers() {
  if (!questionIdNum.value) return
  try {
    const res = await askApi.listAnswers(questionIdNum.value, { order_by: 'best' })
    const payload = res.data.data
    answers.value = payload?.items ?? []
  } catch {
    error.value = true
  }
}

async function loadAll() {
  loading.value = true
  error.value = false
  try {
    await Promise.all([loadQuestion(), loadAnswers()])
  } finally {
    loading.value = false
  }
}

async function handleSubmitAnswer() {
  if (!answerContent.value.trim() || !questionIdNum.value) return
  submitting.value = true
  try {
    await askApi.createAnswer(questionIdNum.value, { content: answerContent.value.trim() })
    ElMessage.success(t('edu.common.submit'))
    answerContent.value = ''
    await loadAll()
  } catch {
    ElMessage.error(t('edu.common.loadFailed'))
  } finally {
    submitting.value = false
  }
}

async function handleLike(ans: EduAskAnswer) {
  try {
    const res = await askApi.likeAnswer(ans.id)
    const count = res.data.data?.like_count
    if (typeof count === 'number') {
      ans.like_count = count
    } else {
      ans.like_count += 1
    }
  } catch {
    ElMessage.error(t('edu.common.loadFailed'))
  }
}

async function handleAdopt(ans: EduAskAnswer) {
  try {
    await ElMessageBox.confirm(t('edu.ask.adoptConfirm'), t('edu.ask.adopt'), {
      type: 'warning',
      confirmButtonText: t('edu.common.submit'),
      cancelButtonText: t('edu.common.cancel'),
    })
    await askApi.adoptAnswer(ans.id)
    ElMessage.success(t('edu.ask.adoptSuccess'))
    await loadAll()
  } catch {
    // 用户取消或操作失败
  }
}

function goBack() {
  router.push({ name: 'EduAsk' })
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.ask-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 200px;
}

.question-section {
  padding: 20px 24px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.question-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.question-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.question-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.q-tag {
  border-radius: 8px;
}

.question-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.answers-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
}

.answer-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-card {
  position: relative;
  padding: 16px 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-card.is-best {
  border-color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.best-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-success);
}

.answer-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.answer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.answer-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.answer-actions {
  display: flex;
  gap: 8px;
}

.answer-form {
  padding: 20px 24px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
