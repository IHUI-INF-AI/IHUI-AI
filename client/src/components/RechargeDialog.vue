<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="t('rechargeDialog.walletRecharge')"
    width="480"
    :align-center="true"
    :show-close="true"
    class="recharge-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="recharge-dialog-title"
    @opened="onOpened"
  >
    <div class="recharge">
      <p class="recharge-tip">
        <span class="tip-icon" aria-hidden="true">i</span>
        <span>{{ t('rechargeDialog.selectTip') }}</span>
      </p>

      <AmountSelector v-model="amountYuan" :max-amount="100000" />

      <fieldset class="recharge-channel">
        <legend class="channel-label">{{ t('rechargeDialog.paymentMethod') }}</legend>
        <div
          class="channel-options"
          role="radiogroup"
          :aria-label="t('rechargeDialog.paymentMethod')"
        >
          <label
            v-for="ch in channels"
            :key="ch.value"
            :class="['channel-option', { active: channel === ch.value }]"
          >
            <input
              v-model="channel"
              type="radio"
              :value="ch.value"
              class="channel-radio sr-only"
            />
            <span class="channel-icon" aria-hidden="true">{{ ch.icon }}</span>
            <span class="channel-name">{{ ch.name }}</span>
          </label>
        </div>
      </fieldset>
    </div>

    <template #footer>
      <div class="recharge-actions" role="group" :aria-label="t('rechargeDialog.actions')">
        <button type="button" class="rc-btn secondary" @click="onClose">{{ t('common.cancel') }}</button>
        <button
          type="button"
          class="rc-btn primary"
          :disabled="!isValid || submitting"
          :aria-disabled="!isValid || submitting"
          @click="onSubmit"
        >
          <span v-if="!submitting">{{ t('rechargeDialog.payNow') }} ¥{{ amountYuan.toFixed(2) }}</span>
          <span v-else>{{ t('rechargeDialog.processing') }}</span>
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import AmountSelector from '@/components/top-up/AmountSelector.vue'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  userId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success', data: { amount: number; txId: string }): void
}>()

const amountYuan = ref<number>(100)
const channel = ref<string>('alipay')
const submitting = ref(false)

const channels = computed(() => [
  { value: 'alipay', name: t('rechargeDialog.alipay'), icon: '支' },
  { value: 'wechat', name: t('rechargeDialog.wechat'), icon: '微' },
  { value: 'bank', name: t('rechargeDialog.bankCard'), icon: '银' },
])

const isValid = computed(() => amountYuan.value >= 1 && amountYuan.value <= 100000)

// 弹窗打开后：屏幕阅读器播报 (AmountSelector 自带金额输入焦点管理)
function onOpened() {
  nextTick(() => {
    const live = document.getElementById('a11y-live-polite')
    if (live) live.textContent = t('rechargeDialog.openedA11y')
  })
}

async function onSubmit() {
  if (!isValid.value) return
  submitting.value = true
  try {
    const res: { code?: number; data?: { transaction?: { id?: string } } } = await fetch('/api/v1/wallet/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: props.userId,
        tx_type: 'recharge',
        amount: Math.round(amountYuan.value * 100),
        description: t('rechargeDialog.txDescription', { amount: amountYuan.value.toFixed(2), channel: channel.value }),
        channel: channel.value,
      }),
    }).then(r => r.json())
    if (res?.code === 0) {
      emit('success', { amount: amountYuan.value, txId: res.data?.transaction?.id || '' })
      onClose()
    }
  } catch (_e) {
    // 忽略, 演示用
  } finally {
    submitting.value = false
  }
}

function onClose() {
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as v;

.recharge-dialog {
  :deep(.el-dialog__body) {
    padding: 8px 24px 16px;
  }
}

.recharge {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.recharge-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-brand-blue-06);
  border-radius: var(--global-border-radius);
  font-size: 13px;
  color: var(--color-brand-blue);

  .tip-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-brand-blue);

    // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色导致浅色背景下不可见
    color: var(--app-button-text-on-primary);
    font-size: 12px;
    font-weight: 700;
    font-style: italic;
  }
}

.recharge-amount {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .amount-label {
    font-size: 13px;
    color: v.$text-secondary;
  }

  .amount-input-wrap {
    display: flex;
    align-items: center;
    border: 2px solid var(--el-border-color);
    border-radius: var(--global-border-radius);
    padding: 0 16px;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: var(--border-unified-color-hover);
    }

    .amount-symbol {
      font-size: 24px;
      font-weight: 700;
      color: v.$text-secondary;
      margin-right: 8px;
    }

    .amount-input {
      flex: 1;
      height: 56px;
      font-size: 28px;
      font-weight: 700;
      color: v.$text-primary;
      border: none;
      outline: none;
      background: transparent;
    }
  }
}

.recharge-presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  .preset-btn {
    height: 40px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 700;
    color: v.$text-primary;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      // 2026-07-04 修复: 反相配对双模式覆盖, 原 background: var(--el-text-color-primary) + color: var(--el-bg-color) 在暗色模式下文字不可见
      /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
      background: #1a1a1a;
      color: #fff;
      /* stylelint-enable color-no-hex */

      border-color: transparent;

      html.dark & {
        /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
        background: #fff;
        color: #1a1a1a;
        /* stylelint-enable color-no-hex */

        border-color: transparent;
      }
    }

    &:hover:not(.active) {
      border-color: v.$primary-color;
      color: v.$primary-color;
    }
  }
}

.recharge-channel {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .channel-label {
    font-size: 13px;
    color: v.$text-secondary;
  }

  .channel-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .channel-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      border-color: var(--border-unified-color-hover);
      background: var(--color-black-04);
    }

    .channel-radio {
      margin: 0;
    }

    .channel-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--color-gray-light);
      font-size: 12px;
      font-weight: 700;
    }

    .channel-name {
      font-size: 13px;
      color: v.$text-primary;
    }
  }
}

.recharge-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.rc-btn {
  position: relative;
  overflow: hidden;
  height: 40px;
  padding: 0 24px;
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: var(--unified-border);
  background: transparent;
  color: v.$text-primary;
  transition: all 0.2s;

  &.primary {
    // 2026-07-04 修复: 反相配对双模式覆盖, 原 background: var(--el-text-color-primary) + color: var(--el-bg-color) 在暗色模式下文字不可见
    /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
    background: #1a1a1a;
    color: #fff;
    /* stylelint-enable color-no-hex */

    border-color: transparent;
    min-width: 180px;

    html.dark & {
      /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
      background: #fff;
      color: #1a1a1a;
      /* stylelint-enable color-no-hex */

      border-color: transparent;
    }

    &:hover:not(:disabled) {
      opacity: 0.85;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &.secondary {
    &:hover {
      border-color: v.$primary-color;
      color: v.$primary-color;
    }
  }
}
</style>
