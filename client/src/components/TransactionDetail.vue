<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="交易详情"
    width="520"
    :align-center="true"
    :show-close="true"
    class="tx-detail-dialog"
  >
    <div v-if="transaction" class="tx-detail">
      <div class="tx-amount-card" :class="amountClass">
        <div class="tx-amount-sign">{{ sign }}</div>
        <div class="tx-amount-value">¥{{ formatAmount(transaction.amount) }}</div>
        <div class="tx-amount-type">{{ typeLabel }}</div>
      </div>

      <div class="tx-fields">
        <div class="tx-field">
          <span class="tx-label">{{ t('transactionDetail.txId') }}</span>
          <span class="tx-value mono">{{ transaction.id }}</span>
        </div>
        <div class="tx-field">
          <span class="tx-label">{{ t('transactionDetail.status') }}</span>
          <span class="tx-value">
            <span :class="['status-tag', `status-${transaction.status}`]">{{ statusLabel }}</span>
          </span>
        </div>
        <div class="tx-field">
          <span class="tx-label">{{ t('transactionDetail.user') }}</span>
          <span class="tx-value">{{ transaction.user_id }}</span>
        </div>
        <div v-if="transaction.related_order_no" class="tx-field">
          <span class="tx-label">{{ t('transactionDetail.relatedOrder') }}</span>
          <span class="tx-value mono">{{ transaction.related_order_no }}</span>
        </div>
        <div class="tx-field">
          <span class="tx-label">{{ t('transactionDetail.desc') }}</span>
          <span class="tx-value">{{ transaction.description || '-' }}</span>
        </div>
        <div class="tx-field">
          <span class="tx-label">{{ t('transactionDetail.createTime') }}</span>
          <span class="tx-value">{{ formatTime(transaction.created_at) }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="tx-actions">
        <button class="tx-btn secondary" @click="onClose">{{ t('common.close') }}</button>
        <button v-if="transaction?.related_order_no" class="tx-btn primary" @click="onViewOrder">
          查看关联订单
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Transaction {
  id: string
  user_id: string
  tx_type: string
  amount: number
  status: string
  description?: string
  related_order_no?: string
  created_at: string
}

const props = defineProps<{
  modelValue: boolean
  transaction: Transaction | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'viewOrder', orderNo: string): void
}>()

const typeLabels: Record<string, string> = {
  income: '收入',
  expense: '支出',
  refund: '退款',
  recharge: '充值',
  withdraw: '提现',
}

const statusLabels: Record<string, string> = {
  success: '成功',
  pending: '处理中',
  failed: '失败',
  cancelled: '已取消',
}

const typeLabel = computed(() => typeLabels[props.transaction?.tx_type || ''] || '其他')
const statusLabel = computed(() => statusLabels[props.transaction?.status || ''] || '未知')
const sign = computed(() => {
  if (!props.transaction) return ''
  const incoming = ['income', 'refund', 'recharge']
  return incoming.includes(props.transaction.tx_type) ? '+' : '-'
})

const amountClass = computed(() => {
  if (!props.transaction) return 'neutral'
  const incoming = ['income', 'refund', 'recharge']
  return incoming.includes(props.transaction.tx_type) ? 'incoming' : 'outgoing'
})

function formatAmount(cents: number | undefined): string {
  if (cents === undefined || cents === null) return '0.00'
  return (cents / 100).toFixed(2)
}

function onClose() {
  emit('update:modelValue', false)
}

function onViewOrder() {
  if (props.transaction?.related_order_no) {
    emit('viewOrder', props.transaction.related_order_no)
  }
}
</script>

<style scoped lang="scss">
@use './../styles/variables' as v;

.tx-detail-dialog {
  :deep(.el-dialog__body) {
    padding: 0 24px 8px;
  }
}

.tx-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tx-amount-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px;
  border-radius: var(--global-border-radius);
  background: var(--color-gray-fafafa);

  &.incoming {
    background: linear-gradient(135deg, var(--el-text-color-primary) 0%, var(--el-text-color-regular) 100%);

    // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色导致浅色背景下不可见
    /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
    color: #fff;

    // 2026-07-04 修复: 反相配对双模式覆盖, 暗色模式下背景为浅色渐变需深色文字
    html.dark & {
      color: #1a1a1a;
    }
    /* stylelint-enable color-no-hex */

    .tx-amount-type {
      color: var(--color-white-70);
    }
  }

  &.outgoing {
    background: linear-gradient(135deg, var(--color-neutral-100) 0%, var(--color-neutral-200) 100%);
    color: var(--el-text-color-primary);
  }

  .tx-amount-sign {
    font-size: 24px;
    font-weight: 700;
  }

  .tx-amount-value {
    font-size: 36px;
    font-weight: 700;
    margin: 4px 0;
  }

  .tx-amount-type {
    font-size: 13px;
    color: v.$text-secondary;
  }
}

.tx-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tx-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: var(--unified-border-bottom);

  &:last-child {
    border-bottom: none;
  }

  .tx-label {
    font-size: 13px;
    color: v.$text-secondary;
  }

  .tx-value {
    font-size: 14px;
    color: v.$text-primary;
    font-weight: 500;
    text-align: right;
    max-width: 60%;

    &.mono {
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 12px;
    }
  }
}

.status-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--global-border-radius);
  font-size: 12px;
  font-weight: 700;

  &.status-success {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success);
  }

  &.status-pending {
    background: var(--el-color-primary-light-9);
    color: var(--color-blue-1890ff);
  }

  &.status-failed {
    background: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
  }

  &.status-cancelled {
    background: var(--color-black-6);
    color: var(--el-text-color-secondary);
  }
}

.tx-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.tx-btn {
  position: relative;
  overflow: hidden;
  height: 36px;
  padding: 0 20px;
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

    html.dark & {
      /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
      background: #fff;
      color: #1a1a1a;
      /* stylelint-enable color-no-hex */

      border-color: transparent;
    }

    &:hover {
      opacity: 0.85;
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
