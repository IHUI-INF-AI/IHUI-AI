<template>
  <div class="p19-page">
    <h2 class="p19-title">{{ t('p19PaymentMethods.title') }}</h2>
    <el-row :gutter="16" v-loading="loading">
      <el-col v-for="m in methods" :key="m.code" :span="6">
        <el-card shadow="hover" class="p19-method">
          <div class="p19-method-name">{{ m.name }}</div>
          <div class="p19-method-fee">{{ t('p19PaymentMethods.fee') }} {{ (m.fee_rate * 100).toFixed(2) }}%</div>
          <el-tag :type="m.enabled ? 'success' : 'info'" size="small">
            {{ m.enabled ? '已启用' : '已禁用' }}
          </el-tag>
        </el-card>
      </el-col>
    </el-row>
    <el-card class="p19-margin">
      <h3>{{ t('p19PaymentMethods.accountBalance') }}</h3>
      <div class="p19-balance">¥{{ balance.toFixed(2) }} CNY</div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getWalletInfo } from '@/api/wallet'

const { t } = useI18n()
const loading = ref(false)
// v1 无支付方式列表 API, 使用静态演示数据 (P19 演示页面)
const methods = ref<Array<{ code: string; name: string; fee_rate: number; enabled: boolean }>>([
  { code: 'alipay', name: '支付宝', fee_rate: 0.006, enabled: true },
  { code: 'wechat', name: '微信支付', fee_rate: 0.006, enabled: true },
  { code: 'bank', name: '银行卡', fee_rate: 0.01, enabled: false },
])
const balance = ref(0)

async function load() {
  loading.value = true
  try {
    const r = await getWalletInfo() as unknown as { data?: { balance?: number } }
    balance.value = r.data?.balance || 0
  } catch (e: unknown) {
    const err = e as { message?: string }
    ElMessage.error(t('common.errors.loadBalanceFailed') + ': ' + (err?.message || e))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.p19-page {
  padding: 24px;
}

.p19-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
}

.p19-method {
  margin-bottom: 16px;
  text-align: center;
}

.p19-method-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.p19-method-fee {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.p19-margin {
  margin-top: 16px;
}

.p19-balance {
  font-size: 32px;
  font-weight: 700;
  color: var(--el-color-success);
}
</style>
