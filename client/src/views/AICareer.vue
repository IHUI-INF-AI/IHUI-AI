<template>
  <div class="ai-career-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><GraduationCap /></el-icon>
        {{ t('aiCareer.title') }}
      </h1>
      <p class="page-subtitle">{{ t('aiCareer.subtitle') }}</p>
    </div>

    <!-- 表单区域 -->
    <div class="form-section radius-auto">
      <el-form :model="formData" label-width="150px">
        <!-- 问题1：孩子目前就读的学校 -->
        <el-form-item :label="t('aiCareer.questions.school')" required>
          <el-radio-group v-model="formData.school">
            <el-radio :value="t('aiCareer.options.school.public')">{{
              t('aiCareer.options.school.public')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.school.private')">{{
              t('aiCareer.options.school.private')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.school.key')">{{
              t('aiCareer.options.school.key')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 问题2：孩子班级整体水平 -->
        <el-form-item :label="t('aiCareer.questions.classLevel')" required>
          <el-radio-group v-model="formData.classLevel">
            <el-radio :value="t('aiCareer.options.classLevel.normal')">{{
              t('aiCareer.options.classLevel.normal')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.classLevel.advanced')">{{
              t('aiCareer.options.classLevel.advanced')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 问题3：语文和英语考试分数范围 -->
        <el-form-item :label="t('aiCareer.questions.scoreRange')" required>
          <el-input
            v-model="formData.scoreRange"
            :placeholder="t('aiCareer.options.scoreRangePlaceholder')"
            maxlength="100"
          />
        </el-form-item>

        <!-- 问题4：语文和英语学习困难 -->
        <el-form-item :label="t('aiCareer.questions.languageDifficulty')" required>
          <el-radio-group v-model="formData.languageDifficulty">
            <el-radio :value="t('aiCareer.options.languageDifficulty.readingSpeed')">{{
              t('aiCareer.options.languageDifficulty.readingSpeed')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.languageDifficulty.comprehension')">{{
              t('aiCareer.options.languageDifficulty.comprehension')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.languageDifficulty.vocabulary')">{{
              t('aiCareer.options.languageDifficulty.vocabulary')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.languageDifficulty.writing')">{{
              t('aiCareer.options.languageDifficulty.writing')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 问题5：理科方面特点 -->
        <el-form-item :label="t('aiCareer.questions.scienceCharacteristics')">
          <el-input
            v-model="formData.scienceCharacteristics"
            type="textarea"
            :rows="4"
            :placeholder="t('aiCareer.options.scienceCharacteristicsPlaceholder')"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <!-- 问题6：影响学习的因素 -->
        <el-form-item :label="t('aiCareer.questions.learningObstacle')" required>
          <el-radio-group v-model="formData.learningObstacle">
            <el-radio :value="t('aiCareer.options.learningObstacle.gameAddiction')">{{
              t('aiCareer.options.learningObstacle.gameAddiction')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.learningObstacle.daydreaming')">{{
              t('aiCareer.options.learningObstacle.daydreaming')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.learningObstacle.procrastination')">{{
              t('aiCareer.options.learningObstacle.procrastination')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.learningObstacle.lowEfficiency')">{{
              t('aiCareer.options.learningObstacle.lowEfficiency')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 问题7：兴趣爱好 -->
        <el-form-item :label="t('aiCareer.questions.hobbies')">
          <el-input
            v-model="formData.hobbies"
            type="textarea"
            :rows="4"
            :placeholder="t('aiCareer.options.hobbiesPlaceholder')"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <!-- 问题8：人际关系和性格 -->
        <el-form-item :label="t('aiCareer.questions.personality')" required>
          <el-radio-group v-model="formData.personality">
            <el-radio :value="t('aiCareer.options.personality.introverted')">{{
              t('aiCareer.options.personality.introverted')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.personality.extroverted')">{{
              t('aiCareer.options.personality.extroverted')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.personality.problemSolver')">{{
              t('aiCareer.options.personality.problemSolver')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.personality.cannotHandleFailure')">{{
              t('aiCareer.options.personality.cannotHandleFailure')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 问题9：课外学习余力 -->
        <el-form-item :label="t('aiCareer.questions.extraTime')" required>
          <el-radio-group v-model="formData.extraTime">
            <el-radio :value="t('aiCareer.options.extraTime.heavy')">{{
              t('aiCareer.options.extraTime.heavy')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.extraTime.plenty')">{{
              t('aiCareer.options.extraTime.plenty')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 问题10：压力承受度 -->
        <el-form-item :label="t('aiCareer.questions.pressureTolerance')" required>
          <el-radio-group v-model="formData.pressureTolerance">
            <el-radio :value="t('aiCareer.options.pressureTolerance.light')">{{
              t('aiCareer.options.pressureTolerance.light')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.pressureTolerance.challenging')">{{
              t('aiCareer.options.pressureTolerance.challenging')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.pressureTolerance.moderate')">{{
              t('aiCareer.options.pressureTolerance.moderate')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 问题11：学习目标期待 -->
        <el-form-item :label="t('aiCareer.questions.learningGoal')" required>
          <el-radio-group v-model="formData.learningGoal">
            <el-radio :value="t('aiCareer.options.learningGoal.1')">{{
              t('aiCareer.options.learningGoal.1')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.learningGoal.2')">{{
              t('aiCareer.options.learningGoal.2')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.learningGoal.3')">{{
              t('aiCareer.options.learningGoal.3')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.learningGoal.4')">{{
              t('aiCareer.options.learningGoal.4')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.learningGoal.5')">{{
              t('aiCareer.options.learningGoal.5')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 性格测试1 -->
        <el-form-item :label="t('aiCareer.personalityTests.test1')" required>
          <el-radio-group v-model="formData.personalityTest1">
            <el-radio :value="t('aiCareer.options.personalityTest1.social')">{{
              t('aiCareer.options.personalityTest1.social')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.personalityTest1.quiet')">{{
              t('aiCareer.options.personalityTest1.quiet')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 性格测试2 -->
        <el-form-item :label="t('aiCareer.personalityTests.test2')" required>
          <el-radio-group v-model="formData.personalityTest2">
            <el-radio :value="t('aiCareer.options.personalityTest2.concrete')">{{
              t('aiCareer.options.personalityTest2.concrete')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.personalityTest2.abstract')">{{
              t('aiCareer.options.personalityTest2.abstract')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 性格测试3 -->
        <el-form-item :label="t('aiCareer.personalityTests.test3')" required>
          <el-radio-group v-model="formData.personalityTest3">
            <el-radio :value="t('aiCareer.options.personalityTest3.logical')">{{
              t('aiCareer.options.personalityTest3.logical')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.personalityTest3.emotional')">{{
              t('aiCareer.options.personalityTest3.emotional')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 性格测试4 -->
        <el-form-item :label="t('aiCareer.personalityTests.test4')" required>
          <el-radio-group v-model="formData.personalityTest4">
            <el-radio :value="t('aiCareer.options.personalityTest4.planned')">{{
              t('aiCareer.options.personalityTest4.planned')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.personalityTest4.spontaneous')">{{
              t('aiCareer.options.personalityTest4.spontaneous')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 性格测试5 -->
        <el-form-item :label="t('aiCareer.personalityTests.test5')" required>
          <el-radio-group v-model="formData.personalityTest5">
            <el-radio :value="t('aiCareer.options.personalityTest5.socialRelax')">{{
              t('aiCareer.options.personalityTest5.socialRelax')
            }}</el-radio>
            <el-radio :value="t('aiCareer.options.personalityTest5.quietRelax')">{{
              t('aiCareer.options.personalityTest5.quietRelax')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <div class="form-actions">
        <el-button type="primary" size="large" @click="submitForm" :loading="submitting">
          {{ t('aiCareer.submit') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { GraduationCap } from '@/lib/lucide-fallback'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { submitAICareerForm, type AICareerFormData } from '@/api/ai-career'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()

const submitting = ref(false)

const formData = ref<AICareerFormData>({
  school: '',
  classLevel: '',
  scoreRange: '',
  languageDifficulty: '',
  scienceCharacteristics: '',
  learningObstacle: '',
  hobbies: '',
  personality: '',
  extraTime: '',
  pressureTolerance: '',
  learningGoal: '',
  personalityTest1: '',
  personalityTest2: '',
  personalityTest3: '',
  personalityTest4: '',
  personalityTest5: '',
})

// 提交表单
const submitForm = async () => {
  // 验证必填项
  const requiredFields = [
    { field: 'school', name: t('aiCareer.validation.school') },
    { field: 'classLevel', name: t('aiCareer.validation.classLevel') },
    { field: 'scoreRange', name: t('aiCareer.validation.scoreRange') },
    { field: 'languageDifficulty', name: t('aiCareer.validation.languageDifficulty') },
    { field: 'learningObstacle', name: t('aiCareer.validation.learningObstacle') },
    { field: 'personality', name: t('aiCareer.validation.personality') },
    { field: 'extraTime', name: t('aiCareer.validation.extraTime') },
    { field: 'pressureTolerance', name: t('aiCareer.validation.pressureTolerance') },
    { field: 'learningGoal', name: t('aiCareer.validation.learningGoal') },
    { field: 'personalityTest1', name: t('aiCareer.validation.personalityTest1') },
    { field: 'personalityTest2', name: t('aiCareer.validation.personalityTest2') },
    { field: 'personalityTest3', name: t('aiCareer.validation.personalityTest3') },
    { field: 'personalityTest4', name: t('aiCareer.validation.personalityTest4') },
    { field: 'personalityTest5', name: t('aiCareer.validation.personalityTest5') },
  ]

  for (const item of requiredFields) {
    if (!formData.value[item.field]) {
      showError(t('aiCareer.validation.required', { field: item.name }))
      return
    }
  }

  try {
    submitting.value = true
    const response = await submitAICareerForm(formData.value)
    if (response.success) {
      showSuccess(response.data?.message || t('aiCareer.messages.submitSuccess'))
    } else {
      showError(response.message || t('aiCareer.messages.submitFailed'))
    }
  } catch (error) {
    logger.error('[AICareer] Form submission failed:', error)
    showError(t('aiCareer.messages.submitFailed'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.ai-career-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;

  @media (width <= $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 18px;
  }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.form-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.form-actions {
  margin-top: 32px;
  text-align: center;
}
</style>
