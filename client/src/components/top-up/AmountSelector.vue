<template>
  <div class="amount-selector">
    <div class="amount-list">
      <div
        v-for="amount in amountOptions"
        :key="amount.value"
        class="amount-item"
        :class="{ active: selectedAmount === amount.value }"
        @click="selectAmount(amount.value)"
      >
        <el-icon v-if="selectedAmount === amount.value" class="amount-icon"><Check /></el-icon>
        <span class="amount-value">¥{{ amount.value }}</span>
      </div>
    </div>
    <div class="custom-amount">
      <el-input
        v-model="customAmount"
        type="number"
        :placeholder="t('topUp.customAmount')"
        :min="1"
        @input="handleCustomAmount"
      >
        <template #prepend>¥</template>
      </el-input>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check } from '@/lib/lucide-fallback'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: number
  minAmount?: number
  maxAmount?: number
}

const props = withDefaults(defineProps<Props>(), {
  minAmount: 1,
  maxAmount: 10000,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const amountOptions = [
  { value: 10 },
  { value: 50 },
  { value: 100 },
  { value: 200 },
  { value: 500 },
  { value: 1000 },
]

const selectedAmount = ref(props.modelValue)
const customAmount = ref('')

const selectAmount = (amount: number) => {
  selectedAmount.value = amount
  customAmount.value = ''
  emit('update:modelValue', amount)
}

const handleCustomAmount = () => {
  const amount = Number(customAmount.value)
  if (amount >= props.minAmount && amount <= props.maxAmount) {
    selectedAmount.value = amount
    emit('update:modelValue', amount)
  }
}

watch(
  () => props.modelValue,
  newValue => {
    if (newValue !== selectedAmount.value) {
      selectedAmount.value = newValue
      if (!amountOptions.find(opt => opt.value === newValue)) {
        customAmount.value = String(newValue)
      } else {
        customAmount.value = ''
      }
    }
  }
)
</script>

<style scoped lang="scss">
.amount-selector {
  padding: 20px;
  background-color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
}

.amount-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.amount-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 8px;

  &:hover {
    background-color: var(--el-bg-color-hover);
  }

  &.active {
    background-color: var(--el-color-primary);
    color: var(--app-button-text-on-primary);
  }
}

.amount-icon {
  font-size: 20px;
}

.amount-value {
  font-size: 16px;
  font-weight: 600;
}

.custom-amount {
  margin-top: 16px;
}
</style>
