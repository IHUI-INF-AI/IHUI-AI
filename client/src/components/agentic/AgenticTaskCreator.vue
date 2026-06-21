<template>
  <DesignSystemCard :title="t('aiChat.agenticTask.title')" radius="15" padding="lg">
    <form @submit.prevent="handleSubmit" class="task-creator-form">
      <div class="form-group mb-md">
        <label for="task-description" class="form-label">{{ t('aiChat.agenticTask.taskDescription') }}</label>
        <textarea
          id="task-description"
          v-model="taskDescription"
          class="form-textarea"
          rows="4"
          :placeholder="t('aiChat.agenticTask.taskDescriptionPlaceholder')"
          required
        />
      </div>

      <div class="form-group mb-md">
        <label for="coordination" class="form-label">{{ t('aiChat.agenticTask.coordination') }}</label>
        <select id="coordination" v-model="coordination" class="form-select">
          <option value="hierarchical">{{ t('aiChat.agenticTask.coordinationHierarchical') }}</option>
          <option value="peer-to-peer">{{ t('aiChat.agenticTask.coordinationPeerToPeer') }}</option>
          <option value="market-based">{{ t('aiChat.agenticTask.coordinationMarketBased') }}</option>
        </select>
      </div>

      <div class="form-group mb-md">
        <label for="max-iterations" class="form-label">{{ t('aiChat.agenticTask.maxIterations') }}</label>
        <input
          id="max-iterations"
          v-model.number="maxIterations"
          type="number"
          min="1"
          max="50"
          class="form-input"
          placeholder="10"
        />
      </div>

      <div class="form-actions">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          :loading="isLoading"
          :disabled="!taskDescription || isLoading"
        >
          {{ t('aiChat.agenticTask.createAndExecute') }}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          @click="handleReset"
          :disabled="isLoading"
        >
          {{ t('aiChat.agenticTask.reset') }}
        </Button>
      </div>

      <div v-if="error" class="error-message mt-md">
        <span class="text-danger">❌ {{ error }}</span>
      </div>

      <div v-if="successMessage" class="success-message mt-md">
        <span class="text-success">✅ {{ successMessage }}</span>
      </div>
    </form>
  </DesignSystemCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger } from '../../utils/logger'
import { useAgentic } from '@/composables/useAgentic'
import DesignSystemCard from '@/components/design-system/DesignSystemCard.vue'
import Button from '@/components/design-system/Button.vue'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()

const emit = defineEmits<{
  created: [swarmId: string]
}>()

const { createAndExecuteSwarm, isLoading, error } = useAgentic()

const taskDescription = ref('')
const coordination = ref<'hierarchical' | 'peer-to-peer' | 'market-based'>('hierarchical')
const maxIterations = ref(10)
const successMessage = ref('')

const cleanup = useCleanup()

const handleSubmit = async () => {
  if (!taskDescription.value.trim()) {
    return
  }

  successMessage.value = ''

  try {
    const { swarmId } = await createAndExecuteSwarm(taskDescription.value, {
      coordination: coordination.value,
      maxIterations: maxIterations.value,
    })

    successMessage.value = t('aiChat.agenticTask.taskCreated', { swarmId })
    emit('created', swarmId)

    // 3秒后清空成功消息
    cleanup.addTimer(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    logger.error(t('aiChat.agenticTask.createFailed'), err)
  }
}

const handleReset = () => {
  taskDescription.value = ''
  coordination.value = 'hierarchical'
  maxIterations.value = 10
  successMessage.value = ''
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

.task-creator-form {
  .form-group {
    .form-label {
      display: block;
      margin-bottom: $spacing-xs;
      font-weight: $font-weight-medium;
      color: $text-primary;
      font-size: $font-size-sm;
    }

    .form-textarea,
    .form-input,
    .form-select {
      width: 100%;
      padding: $spacing-sm $spacing-md;
      border: var(--unified-border);
      border-radius: $radius-8;
      font-size: $font-size-base;
      font-family: var(--global-font-family);
      color: $text-primary;
      background-color: var(--el-bg-color);
      transition: $transition-base;

      &:focus {
        outline: none;
        border-color: $primary-color;
        background-color: $bg-hover;
      }

      &::placeholder {
        color: $text-placeholder;
      }
    }

    .form-textarea {
      resize: vertical;
      min-height: 100px;
    }
  }

  .form-actions {
    display: flex;
    gap: $spacing-md;
    margin-top: $spacing-lg;
  }

  .error-message,
  .success-message {
    padding: $spacing-sm;
    border-radius: $radius-4;
    font-size: $font-size-sm;
  }

  .error-message {
    background-color: var(--el-bg-color);
  }

  .success-message {
    background-color: var(--el-bg-color);
  }
}
</style>
