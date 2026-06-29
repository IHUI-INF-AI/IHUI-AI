<template>
  <el-dialog
    v-model="visible"
    :title="t('distribution.realAuth.title')"
    width="500px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <div class="avatar-section">
        <el-avatar :src="avatarUrl" :size="120" />
        <p class="avatar-tip">{{ t('distribution.realAuth.avatarTip') }}</p>
      </div>

      <el-form-item :label="t('distribution.realAuth.name')" prop="name">
        <el-input v-model="form.name" :placeholder="t('distribution.realAuth.namePlaceholder')" />
      </el-form-item>

      <el-form-item :label="t('distribution.realAuth.idCard')" prop="idCard">
        <el-input
          v-model="form.idCard"
          :placeholder="t('distribution.realAuth.idCardPlaceholder')"
          maxlength="18"
        />
      </el-form-item>

      <div class="tips">
        <p>Copyright © 2025-2035 iHuiInf AGI All Rights Reserved.</p>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('distribution.realAuth.cancel') }}</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">{{
        t('distribution.realAuth.confirm')
      }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { realAuth } from '@/api/distribution'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import type { FormInstance, FormRules } from 'element-plus'
import { logger } from '@/utils/logger'

const { t } = useI18n()

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const { showSuccess, showError } = useOperationFeedback()
const authStore = useAuthStore()

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const formRef = ref<FormInstance | undefined>(undefined)
const submitting = ref(false)

const form = ref({
  name: '',
  idCard: '',
})

const avatarUrl = computed(() => {
  const user = authStore.user
  if (user && typeof user === 'object' && 'avatar' in user) {
    return (user.avatar as string) || '/images/common/userIcon.svg'
  }
  return '/images/common/userIcon.svg'
})

const rules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('distribution.realAuth.nameRequired'), trigger: 'blur' },
    { min: 2, max: 20, message: t('distribution.realAuth.nameLength'), trigger: 'blur' },
  ],
  idCard: [
    { required: true, message: t('distribution.realAuth.idCardRequired'), trigger: 'blur' },
    {
      pattern: /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/,
      message: t('distribution.realAuth.idCardInvalid'),
      trigger: 'blur',
    },
  ],
}))

const handleClose = () => {
  visible.value = false
  form.value = { name: '', idCard: '' }
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    submitting.value = true

    const user = authStore.user
    const uuid = user && typeof user === 'object' && 'uuid' in user ? (user.uuid as string) : ''

    if (!uuid) {
      showError(t('distRealAuthModal.incompleteUserInfo'))
      return
    }

    const response = await realAuth(form.value.name, form.value.idCard, uuid)

    if (response.success || response.code === 200) {
      showSuccess(t('distRealAuthModal.realAuthSuccess'))
      emit('success')
      handleClose()
    } else {
      showError(response.message || t('distRealAuthModal.realAuthFailed'))
    }
  } catch (error) {
    logger.error('[RealAuthModal] Form validation failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.avatar-tip {
  margin-top: 12px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.tips {
  margin-top: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);

  p {
    margin: 0;
  }
}
</style>
