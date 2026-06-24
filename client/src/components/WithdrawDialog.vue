<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="t('withdrawDialog.title')"
    width="480"
    :align-center="true"
    :show-close="true"
    class="withdraw-dialog"
  >
    <div class="withdraw">
      <div class="withdraw-balance">
        <span class="balance-label">{{ t('withdrawDialog.availableBalance') }}</span>
        <span class="balance-value">¥{{ availableYuan.toFixed(2) }}</span>
      </div>

      <div class="withdraw-amount">
        <span class="amount-label">{{ t('withdrawDialog.amount') }}</span>
        <div class="amount-input-wrap">
          <span class="amount-symbol">¥</span>
          <input
            v-model.number="amountYuan"
            type="number"
            class="amount-input"
            :placeholder="`最高 ${availableYuan.toFixed(2)}`"
            :min="minWithdraw"
            :max="availableYuan"
            step="0.01"
          />
        </div>
        <div v-if="errorMsg" class="amount-error">{{ errorMsg }}</div>
        <div v-else class="amount-hint">
          单笔最低 ¥{{ minWithdraw }}, 24 小时内到账
        </div>
      </div>

      <div class="withdraw-bank">
        <span class="bank-label">{{ t('withdrawDialog.bankCard') }}</span>
        <div v-if="!bankAccount" class="bank-empty">
          <span>{{ t('withdrawDialog.noBankCard') }}</span>
          <button class="link-btn" @click="onAddBank">{{ t('withdrawDialog.bindNow') }}</button>
        </div>
        <div v-else class="bank-card">
          <div class="bank-icon">{{ bankAccount.bankIcon }}</div>
          <div class="bank-info">
            <div class="bank-name">{{ bankAccount.bankName }}</div>
            <div class="bank-tail mono">{{ bankAccount.tail }}</div>
          </div>
          <button class="change-btn" @click="onAddBank">{{ t('withdrawDialog.change') }}</button>
        </div>
      </div>

      <div class="withdraw-terms">
        <label class="terms-label">
          <input v-model="agreed" type="checkbox" class="terms-checkbox" />
          <span>{{ t('withdrawDialog.agreePrefix') }} <a href="#" class="terms-link">{{ t('withdrawDialog.termsTitle') }}</a></span>
        </label>
      </div>
    </div>

    <template #footer>
      <div class="withdraw-actions">
        <button class="wd-btn secondary" @click="onClose">{{ t('common.cancel') }}</button>
        <button class="wd-btn primary" :disabled="!canSubmit || submitting" @click="onSubmit">
          <span v-if="!submitting">{{ t('withdrawDialog.submit') }}</span>
          <span v-else>{{ t('withdrawDialog.submitting') }}</span>
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  userId: string
  availableCents: number
  bankAccount?: { bankName: string; bankIcon: string; tail: string } | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success', data: { amount: number; txId: string }): void
  (e: 'addBank'): void
}>()

const minWithdraw = 1
const amountYuan = ref<number>(0)
const agreed = ref(false)
const submitting = ref(false)

const availableYuan = computed(() => (props.availableCents || 0) / 100)

const errorMsg = computed(() => {
  if (amountYuan.value <= 0) return null
  if (amountYuan.value < minWithdraw) return `最低 ¥${minWithdraw}`
  if (amountYuan.value > availableYuan.value) return '超过可提现余额'
  return null
})

const canSubmit = computed(() => {
  return amountYuan.value >= minWithdraw &&
    amountYuan.value <= availableYuan.value &&
    agreed.value &&
    !!props.bankAccount
})

async function onSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const res: any = await fetch('/api/v1/wallet/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: props.userId,
        tx_type: 'withdraw',
        amount: Math.round(amountYuan.value * 100),
        description: `提现 ¥${amountYuan.value.toFixed(2)} 到 ${props.bankAccount?.bankName || '银行卡'}`,
      }),
    }).then(r => r.json())
    const codeNum = typeof res?.code === 'string' ? parseInt(res.code, 10) : res?.code
    if (codeNum === 0) {
      emit('success', { amount: amountYuan.value, txId: res.data?.transaction?.id || '' })
      onClose()
    }
  } catch (_e) {
    // 忽略
  } finally {
    submitting.value = false
  }
}

function onAddBank() {
  emit('addBank')
}

function onClose() {
  amountYuan.value = 0
  agreed.value = false
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as v;

.withdraw-dialog {
  :deep(.el-dialog__body) {
    padding: 8px 24px 16px;
  }
}

.withdraw {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.withdraw-balance {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: linear-gradient(135deg, var(--el-text-color-primary) 0%, var(--el-text-color-regular) 100%);
  color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  .balance-label {
    font-size: 13px;
    color: var(--color-white-70);
  }

  .balance-value {
    font-size: 22px;
    font-weight: 700;
  }
}

.withdraw-amount {
  display: flex;
  flex-direction: column;
  gap: 6px;

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
      font-size: 22px;
      font-weight: 700;
      color: v.$text-secondary;
      margin-right: 8px;
    }

    .amount-input {
      flex: 1;
      height: 50px;
      font-size: 24px;
      font-weight: 700;
      color: v.$text-primary;
      border: none;
      outline: none;
      background: transparent;
    }
  }

  .amount-error {
    font-size: 12px;
    color: var(--el-color-danger);
  }

  .amount-hint {
    font-size: 12px;
    color: v.$text-secondary;
  }
}

.withdraw-bank {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .bank-label {
    font-size: 13px;
    color: v.$text-secondary;
  }

  .bank-empty {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border: 1px dashed var(--el-border-color);
    border-radius: var(--global-border-radius);
    font-size: 13px;
    color: v.$text-secondary;
  }

  .bank-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);

    .bank-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--color-gray-light);
      font-size: 14px;
      font-weight: 700;
    }

    .bank-info {
      flex: 1;
    }

    .bank-name {
      font-size: 14px;
      color: v.$text-primary;
      font-weight: 600;
    }

    .bank-tail {
      font-size: 12px;
      color: v.$text-secondary;
      font-family: 'JetBrains Mono', Consolas, monospace;
    }

    .change-btn {
      background: transparent;
      border: none;
      color: v.$primary-color;
      font-size: 13px;
      cursor: pointer;
    }
  }

  .link-btn {
    background: transparent;
    border: none;
    color: v.$primary-color;
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
  }
}

.withdraw-terms {
  .terms-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: v.$text-secondary;
    cursor: pointer;
  }

  .terms-checkbox {
    margin: 0;
  }

  .terms-link {
    color: v.$primary-color;
    text-decoration: none;
  }
}

.withdraw-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.wd-btn {
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
    background: var(--el-text-color-primary);
    color: var(--el-bg-color);
    border-color: var(--el-text-color-primary);
    min-width: 140px;

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
