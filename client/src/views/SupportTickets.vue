<template>
  <div class="support-tickets" v-loading="loading">
    <h2>{{ t('supportTickets.title') }}</h2>
    <p>{{ t('supportTickets.merged') }}</p>

    <div v-if="error" class="error-banner">
      <el-alert :title="error" type="error" :closable="false" show-icon />
    </div>

    <div v-else-if="tickets.length" class="ticket-list">
      <TicketCard
        v-for="ticket in tickets"
        :key="ticket.id"
        :ticket="ticket"
        @view="onView"
        @close="onClose"
        @reopen="onReopen"
      />
    </div>

    <div v-else-if="!loading" class="empty-state">
      <NativeEmpty :description="t('supportTickets.empty', '暂无工单')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getTickets } from '@/api/customer-service'
import type { Ticket } from '@/api/tickets'
import type { Ticket as CsTicket } from '@/api/customer-service'
import TicketCard from '@/components/api/TicketCard.vue'

defineOptions({ name: 'SupportTickets' })

const { t } = useI18n()

const tickets = ref<Ticket[]>([])
const loading = ref(false)
const error = ref('')

// 适配层：customer-service 的 Ticket 字段命名（type/createTime/updateTime）
// 与 @/api/tickets 的 Ticket（category/createdAt/updatedAt）存在差异，
// 此处统一映射为 TicketCard 所需的数据形状，保证渲染完整不缺字段。
const CATEGORY_MAP: Record<CsTicket['type'], Ticket['category']> = {
  technical: 'technical',
  billing: 'billing',
  account: 'other',
  feature: 'feature',
  bug: 'technical',
  other: 'other',
}

const toTicket = (cs: CsTicket): Ticket => ({
  id: cs.id,
  title: cs.title,
  description: cs.description,
  category: CATEGORY_MAP[cs.type],
  status: cs.status,
  priority: cs.priority,
  createdAt: cs.createTime,
  updatedAt: cs.updateTime,
  resolvedAt: cs.resolveTime,
  userId: cs.userId,
  replies: (cs.replies ?? []).map((r) => ({
    id: r.id,
    ticketId: r.ticketId,
    content: r.content,
    userId: r.senderId,
    isAdmin: r.senderType === 'staff',
    createdAt: r.createTime,
    attachments: r.attachments?.map((a) => a.url),
  })),
  attachments: cs.attachments?.map((a) => a.url),
})

const loadTickets = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getTickets()
    if (res.success && res.data) {
      tickets.value = (res.data.list || []).map(toTicket)
    } else {
      error.value = res.message || t('supportTickets.loadFailed', '加载工单失败')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const onView = (ticket: Ticket) => {
  ElMessage.info(`${t('common.view')}: ${ticket.title}`)
}

const onClose = (ticket: Ticket) => {
  ElMessage.info(`${t('apiService.tickets.close')}: ${ticket.title}`)
}

const onReopen = (ticket: Ticket) => {
  ElMessage.info(`${t('apiService.tickets.reopen')}: ${ticket.title}`)
}

onMounted(loadTickets)
</script>

<style scoped lang="scss">
.support-tickets {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.ticket-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
}

.error-banner {
  margin-top: 16px;
}

.empty-state {
  padding: 60px 0;
}
</style>
