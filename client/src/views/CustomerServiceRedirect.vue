<template>
  <div class="customer-service-redirect" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { DEFAULT_CUSTOMER_SERVICE_FAQ } from '@/data/customer-service-faq'

const router = useRouter()

onMounted(() => {
  const win = window as Window & {
    openFloatingChat?: (options: {
      theme?: 'default' | 'custom-service'
      quickFaqList?: Array<{ id: number; question: string; answer: string }>
      showTicketsEntry?: boolean
      mode?: string
    }) => void
  }
  if (win.openFloatingChat) {
    win.openFloatingChat({
      theme: 'custom-service',
      quickFaqList: DEFAULT_CUSTOMER_SERVICE_FAQ,
      showTicketsEntry: true,
      mode: 'agent',
    })
  }
  router.replace('/').catch(() => { /* 导航失败静默处理，用户已在客服页面 */ })
})
</script>

<style scoped>
.customer-service-redirect {
  min-height: 100vh;
}
</style>
