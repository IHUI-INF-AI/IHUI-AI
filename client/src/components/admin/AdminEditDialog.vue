<template>
  <ElDialog v-model="visibleModel" :title="dialogTitle" :width="width" :close-on-click-modal="false" @closed="onClosed">
    <ElForm ref="formRef" :model="formData" :rules="rules" :label-width="labelWidth" v-loading="submitting">
      <ElFormItem v-for="field in fields" :key="field.prop" :label="field.label" :prop="field.prop">
        <!-- 下拉选择 -->
        <ElSelect v-if="field.type === 'select'" v-model="formData[field.prop]" :placeholder="field.placeholder || ''" :style="{ width: field.width || '100%' }">
          <ElOption v-for="opt in field.options || []" :key="opt.value" :label="opt.label" :value="opt.value" />
        </ElSelect>
        <!-- 数字输入 -->
        <ElInputNumber v-else-if="field.type === 'number'" v-model="formData[field.prop]" :min="field.min" :max="field.max" :step="field.step || 1" :style="{ width: field.width || '100%' }" />
        <!-- 富文本编辑器 -->
        <Editor v-else-if="field.type === 'richtext'" :value="formData[field.prop] || ''" :min-height="field.minHeight || 200" @input="(val: string) => formData[field.prop] = val" />
        <!-- 文本域 -->
        <ElInput v-else-if="field.type === 'textarea'" v-model="formData[field.prop]" type="textarea" :rows="field.rows || 3" :placeholder="field.placeholder || ''" />
        <!-- 开关 -->
        <ElSwitch v-else-if="field.type === 'switch'" v-model="formData[field.prop]" :active-text="field.activeText" :inactive-text="field.inactiveText" />
        <!-- cron 表达式编辑器 -->
        <CrontabField v-else-if="field.type === 'cron'" v-model="formData[field.prop]" :placeholder="field.placeholder || ''" />
        <!-- 默认: 文本输入 (input/email/url/phone 共用) -->
        <ElInput v-else v-model="formData[field.prop]" :placeholder="field.placeholder || ''" :style="{ width: field.width || '100%' }" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <slot name="footer-extra" />
      <ElButton @click="visibleModel = false">{{ t('common.cancel') }}</ElButton>
      <ElButton type="success" :loading="submitting" @click="onSubmitContinue">{{ t('adminEditDialog.saveAndContinue') }}</ElButton>
      <ElButton type="primary" :loading="submitting" @click="onSubmit">{{ t('common.save') }}</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
/**
 * P21.2: Admin 通用编辑/新增弹窗组件
 * 配合 useAdminTable + useAdminCrud 使用
 *
 * 用法:
 *   <AdminEditDialog
 *     v-model:visible="dialogVisible"
 *     :mode="dialogMode"
 *     :fields="formFields"
 *     :form-data="formData"
 *     :submitting="submitting"
 *     @submit="onSubmit"
 *   />
 */
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElDialog, ElForm, ElFormItem, ElInput, ElInputNumber, ElSelect, ElOption, ElSwitch, ElButton, type FormInstance, type FormRules, type FormItemRule } from 'element-plus'
import Editor from '@/components/Editor/index.vue'
import CrontabField from '@/components/CrontabField.vue'

const { t } = useI18n()

export interface FormFieldOption {
  label: string
  value: string | number
}

export interface FormField {
  /** 字段名 */
  prop: string
  /** 标签 */
  label: string
  /** 类型: input(默认) / textarea / number / select / switch / email / url / phone / richtext / cron */
  type?: 'input' | 'textarea' | 'number' | 'select' | 'switch' | 'email' | 'url' | 'phone' | 'richtext' | 'cron'
  /** 占位符 */
  placeholder?: string
  /** 宽度 */
  width?: string
  /** select 选项 */
  options?: FormFieldOption[]
  /** number 最小值 */
  min?: number
  /** number 最大值 */
  max?: number
  /** number 步长 */
  step?: number
  /** textarea 行数 */
  rows?: number
  /** richtext 最小高度 (px) */
  minHeight?: number
  /** switch 激活文本 */
  activeText?: string
  /** switch 非激活文本 */
  inactiveText?: string
  /** 是否必填 */
  required?: boolean
  /** P22.2: 最小长度 (input/textarea) */
  minLength?: number
  /** P22.2: 最大长度 (input/textarea) */
  maxLength?: number
  /** P22.2: 正则校验模式 (input) */
  pattern?: string
  /** P22.2: 正则校验失败提示 */
  patternMessage?: string
  /** P22.2: 自定义校验消息 (覆盖默认) */
  validatorMessage?: string
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    mode: 'add' | 'edit'
    fields: FormField[]
    formData: Record<string, unknown>
    submitting?: boolean
    width?: string
    labelWidth?: string
  }>(),
  {
    submitting: false,
    width: '500px',
    labelWidth: '100px',
  }
)

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'submit-continue', data: Record<string, unknown>): void
}>()

const formRef = ref<FormInstance>()
const visibleModel = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
})

const dialogTitle = computed(() => props.mode === 'add' ? t('common.add') : t('common.edit'))

const rules = computed<FormRules>(() => {
  const r: FormRules = {}
  for (const f of props.fields) {
    const rulesArr: FormItemRule[] = []
    // 必填校验
    if (f.required) {
      rulesArr.push({
        required: true,
        message: f.validatorMessage || t('common.validate.required', { label: f.label }),
        trigger: f.type === 'select' ? 'change' : 'blur',
      })
    }
    // P22.2: 长度校验 (input/textarea)
    if (f.minLength !== undefined || f.maxLength !== undefined) {
      const min = f.minLength ?? 0
      const max = f.maxLength ?? 9999
      const msg = f.maxLength !== undefined && f.minLength !== undefined
        ? t('common.validate.lengthRange', { label: f.label, min, max })
        : f.maxLength !== undefined
          ? t('common.validate.maxLength', { label: f.label, max })
          : t('common.validate.minLength', { label: f.label, min })
      rulesArr.push({ min, max, message: msg, trigger: 'blur' })
    }
    // P22.2: 正则校验 (input)
    if (f.pattern) {
      rulesArr.push({
        pattern: new RegExp(f.pattern),
        message: f.patternMessage || t('common.validate.pattern', { label: f.label }),
        trigger: 'blur',
      })
    }
    // P22.2: 数字范围校验 (number)
    if (f.type === 'number' && (f.min !== undefined || f.max !== undefined)) {
      const min = f.min ?? -Infinity
      const max = f.max ?? Infinity
      const msg = f.min !== undefined && f.max !== undefined
        ? t('common.validate.numberRange', { label: f.label, min, max })
        : f.min !== undefined
          ? t('common.validate.minValue', { label: f.label, min })
          : t('common.validate.maxValue', { label: f.label, max })
      rulesArr.push({ type: 'number', min, max, message: msg, trigger: 'blur' })
    }
    // P22.2: 邮箱格式校验
    if (f.type === 'email') {
      rulesArr.push({ type: 'email', message: t('common.validate.email'), trigger: 'blur' })
    }
    // P22.2: URL 格式校验
    if (f.type === 'url') {
      rulesArr.push({ type: 'url', message: t('common.validate.url'), trigger: 'blur' })
    }
    // P22.2: 手机号校验 (中国大陆 1[3-9]xxxxxxxxx)
    if (f.type === 'phone') {
      rulesArr.push({ pattern: /^1[3-9]\d{9}$/, message: t('common.validate.phone'), trigger: 'blur' })
    }
    if (rulesArr.length > 0) {
      r[f.prop] = rulesArr
    }
  }
  return r
})

const onSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    emit('submit', { ...props.formData })
  } catch {
    // 校验失败
  }
}

const onSubmitContinue = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    emit('submit-continue', { ...props.formData })
  } catch {
    // 校验失败
  }
}

const onClosed = () => {
  formRef.value?.resetFields()
}

// 弹窗打开时自动清空校验
watch(() => props.visible, (v) => {
  if (v) {
    nextTick(() => formRef.value?.clearValidate())
  }
})
</script>
