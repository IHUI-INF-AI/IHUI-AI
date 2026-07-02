<template>
  <div class="crontab-field">
    <ElInput
      :model-value="modelValue || ''"
      :placeholder="placeholder"
      readonly
      class="crontab-field__input"
    >
      <template #append>
        <ElButton :icon="Clock" @click="open = true">
          {{ t('adminComponents.crontabField.generate') }}
        </ElButton>
      </template>
    </ElInput>

    <ElDialog
      v-model="open"
      :title="t('adminComponents.crontabField.dialogTitle')"
      width="760px"
      :close-on-click-modal="false"
      destroy-on-close
      append-to-body
    >
      <Crontab
        :expression="modelValue || ''"
        @fill="onFill"
        @hide="open = false"
      />
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Cron 表达式编辑器包装组件
 *
 * 把 components/Crontab/index.vue (内部用 Options API) 包装成 v-model 可控的标准表单字段
 * - 触发: ElInput + 右侧"生成"按钮
 * - 弹窗: ElDialog 内嵌 Crontab, 用户在 tab(秒/分/时/日/月/周/年)中可视化配置
 * - 提交: Crontab emit('fill', cronString), 这里更新 v-model 并关闭弹窗
 *
 * 接入 AdminEditDialog:
 *   formFields: [
 *     { prop: 'cron_expression', label: 'cron 表达式', type: 'cron', required: true }
 *   ]
 */
import { ref } from 'vue'
import { ElInput, ElButton, ElDialog } from 'element-plus'
import { Clock } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import Crontab from '@/components/Crontab/index.vue'

const { t } = useI18n()

withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
  }>(),
  {
    modelValue: '',
    placeholder: '如: 0 0 2 * * ?',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)

const onFill = (val: string) => {
  emit('update:modelValue', val)
  open.value = false
}
</script>

<style scoped>
.crontab-field {
  width: 100%;
}

.crontab-field__input {
  width: 100%;
}

/* 覆盖 Crontab 组件内部 popup-main 的定位 (它在 Crontab 内是 position: relative
   而我们在 ElDialog 内已经处于定位上下文, 不需要再相对外层) */
:deep(.popup-main) {
  position: relative;
  margin: 10px auto;
}
</style>
