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

      <div class="recharge-amount">
        <label class="amount-label" for="recharge-amount-input">{{ t('rechargeDialog.amountLabel') }}</label>
        <div class="amount-input-wrap">
          <span class="amount-symbol" aria-hidden="true">¥</span>
          <input
            id="recharge-amount-input"
            v-model.number="amountYuan"
            type="number"
            class="amount-input"
            placeholder="0.00"
            min="1"
            max="100000"
            step="0.01"
            :aria-label="t('rechargeDialog.amountAriaLabel')"
            :aria-invalid="!isValid"
            aria-describedby="recharge-amount-help"
          />
          <span id="recharge-amount-help" class="sr-only">
            {{ t('rechargeDialog.amountRange') }}
          </span>
        </div>
      </div>

      <div
        class="recharge-presets"
        role="group"
        :aria-label="t('rechargeDialog.presetsLabel')"
      >
        <button
          v-for="preset in presets"
          :key="preset"
          type="button"
          :aria-pressed="amountYuan === preset"
          :aria-label="t('rechargeDialog.selectAmount', { n: preset })"
          :class="['preset-btn', { active: amountYuan === preset }]"
          @click="amountYuan = preset"
        >
          ¥{{ preset }}
        </button>
      </div>

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

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  userId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success', data: { amount: number; txId: string }): void
}>()

const presets = [10, 50, 100, 200, 500, 1000]
const amountYuan = ref<number>(100)
const channel = ref<string>('alipay')
const submitting = ref(false)

const channels = computed(() => [
  { value: 'alipay', name: t('rechargeDialog.alipay'), icon: '支' },
  { value: 'wechat', name: t('rechargeDialog.wechat'), icon: '微' },
  { value: 'bank', name: t('rechargeDialog.bankCard'), icon: '银' },
])

const isValid = computed(() => amountYuan.value >= 1 && amountYuan.value <= 100000)

// 弹窗打开后：聚焦金额输入框 + 屏幕阅读器播报
function onOpened() {
  nextTick(() => {
    const input = document.getElementById('recharge-amount-input') as HTMLInputElement | null
    input?.focus()
    const live = document.getElementById('a11y-live-polite')
    if (live) live.textContent = t('rechargeDialog.openedA11y')
  })
}

async function onSubmit() {
  if (!isValid.value) return
  submitting.value = true
  try {
    const res: any = await fetch('/api/v1/wallet/transactions', {
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
    color: var(--el-bg-color);
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
      border-color: var(--el-text-color-primary);
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
    transition: background-color 0.2s, color 0.2s, border-color 0.2s;

    &.active {
      background: var(--el-text-color-primary);
      color: var(--el-bg-color);
      border-color: var(--el-text-color-primary);
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
    transition: border-color 0.2s, background-color 0.2s;

    &.active {
      border-color: var(--el-text-color-primary);
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
      background: var(--el-fill-color-light);
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
  transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;

  &.primary {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color);
    border-color: var(--el-text-color-primary);
    min-width: 180px;

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
