<template>
  <div class="state-card">
    <!-- 待发布/审核中 状态 (status 0, 1, 4, 5) -->
    <div v-if="status === '0' || status === '1' || status === '4' || status === '5'" class="card-top">
      <div class="base-info">
        <div class="avatar">
          <img :src="datas.agent_avatar" :alt="datas.agent_name" loading="lazy" />
        </div>
        <div class="info-main">
          <div class="agent-name">{{ datas.agent_name }}</div>
          <div class="info-row">
            <div class="agent-desc">{{ datas.prologue }}</div>
            <div v-if="status === '0' || status === '1'" class="status-action" :class="{ 'has-border': showFooter }">
              <div v-if="status === '0'" class="action-btn" @click.stop="toDevEdit('edit')">
                <img class="action-btn-bg" src="https://file.aizhs.top/sys-mini/xtk/model_card_btn_bg.png" alt="btn" loading="lazy" />
                <span class="action-btn-text">{{ t('devStateCard.settings') }}</span>
              </div>
              <div v-if="status === '1'" class="review-text">{{ t('devStateCard.reviewing') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 已发布状态 (status 2) -->
    <div v-if="status === '2'" class="card-published">
      <div class="base-info">
        <div class="avatar">
          <img :src="datas.agent_avatar" :alt="datas.agent_name" loading="lazy" />
        </div>
        <div class="info-main">
          <div class="agent-name">{{ datas.agent_name }}</div>
          <div class="agent-desc">{{ datas.prologue || '' }}</div>
        </div>
        <div class="unpublish-btn" @click="showConfirm">{{ t('devStateCard.unpublish') }}</div>
      </div>

      <div class="detail-list">
        <div class="detail-item">{{ t('devStateCard.category') }}{{ getMainType }}</div>
        <div class="detail-item">{{ getTypes }}</div>
        <div class="detail-item">{{ t('devStateCard.sellType') }}{{ payTypes[datas.category_info?.type] || '-' }}</div>
        <div class="detail-item">{{ t('devStateCard.targetGroup') }}{{ datas.group === '1' ? t('devStateCard.member') : t('devStateCard.allUsers') }}</div>
        <div class="detail-item">
          {{ t('devStateCard.price') }}{{ formatPrice(datas.category_info?.account) }} {{ t('devStateCard.yuan') }} / {{ typeChilds[datas.category_info?.type_child] || t('devStateCard.month') }}（{{ t('devStateCard.limitFreeNote') }}）
        </div>
        <div class="detail-item">{{ t('devStateCard.discount') }}{{ discount[datas.category_info?.discount_month] || t('devStateCard.none') }}</div>
        <div class="detail-divider"></div>
        <div class="detail-footer">
          <div>
            <div class="detail-item">{{ t('devStateCard.publishTime') }}{{ getTime.start }}</div>
            <div v-if="datas.category_info?.type === '2'" class="detail-item">
              {{ t('devStateCard.limitFreeTime') }}<span class="time-range">{{ getTime.start }}-{{ getTime.end }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 确认下架弹窗 -->
    <el-dialog v-model="confirmVisible" width="360px" :show-close="false" center>
      <div class="confirm-dialog">
        <div class="confirm-icon">
          <img src="https://file.aizhs.top/sys-mini/xtk/my_model_delete.png" alt="delete" />
        </div>
        <div class="confirm-text">{{ t('devStateCard.confirmOffline') }}</div>
        <div class="confirm-actions">
          <el-button @click="confirmVisible = false">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="handleDelete">{{ t('common.ok') }}</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTime, formatMoney } from '@/utils/format'

const { t } = useI18n()

const formatDate = (date: Date) => formatTime(date, 'YYYY-MM-DD')

interface CategoryInfo {
  type: string
  type_child: string
  account: number
  discount_month: string
  agent_main_category: string
  agent_category: string
  limit_free: number | string
}

interface AgentData {
  agent_avatar: string
  agent_name: string
  prologue: string
  agent_id: string
  group: string
  start_time: string
  category_info?: CategoryInfo
  [key: string]: any
}

interface ModelType {
  code: string
  showName: string
}

const props = defineProps<{
  datas: AgentData
  status?: string
  modelTypes?: ModelType[]
}>()

const emit = defineEmits<{
  (e: 'toDevEdit', data: AgentData, type: string): void
  (e: 'deleteZntCharge', agentId: string): void
}>()

const showFooter = ref(false)
const confirmVisible = ref(false)

const payTypes = computed<Record<string, string>>(() => ({
  '1': t('devStateCard.free'),
  '2': t('devStateCard.limitedFree'),
  '3': t('devStateCard.paid'),
}))

const modelFileType = computed<Record<string, string>>(() => ({
  '1': t('devStateCard.text'),
  '2': t('devStateCard.image'),
  '3': t('devStateCard.video'),
}))

const discount = computed<Record<string, string>>(() => ({
  '1': t('devStateCard.discount6m80'),
  '2': t('devStateCard.discount9m70'),
  '3': t('devStateCard.discount1y50'),
}))

const typeChilds = computed<Record<string, string>>(() => ({
  '1': t('devStateCard.month'),
  '2': t('devStateCard.year'),
  '3': t('devStateCard.permanent'),
}))

const getMainType = computed(() => {
  if (!props.datas.category_info) return t('devStateCard.none')
  return props.datas.category_info.agent_main_category
    .split(',')
    .map((item: string) => modelFileType.value[item] || item)
    .join()
})

const getTypes = computed(() => {
  if (!props.datas.category_info) return t('devStateCard.none')
  return props.datas.category_info.agent_category
    .split(',')
    .map((item: string) => {
      const found = (props.modelTypes || []).find((val: any) => val.code === item)
      return found ? found.showName : ''
    })
    .join()
})

const getTime = computed(() => {
  if (!props.datas.category_info) {
    return { start: '-', end: '-' }
  }
  const now = props.datas.start_time.slice(0, 10)
  const date = new Date(now)
  date.setMonth(date.getMonth() + Number(props.datas.category_info.limit_free))
  return {
    start: now,
    end: formatDate(date),
  }
})

function formatPrice(amount?: number): string {
  if (amount === undefined || amount === null) return '0.00'
  return formatMoney(amount / 100)
}

function showConfirm() {
  confirmVisible.value = true
}

function toDevEdit(type: string) {
  emit('toDevEdit', props.datas, type)
}

function handleDelete() {
  emit('deleteZntCharge', props.datas.agent_id)
  confirmVisible.value = false
}
</script>

<style scoped>
.state-card {
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-top: 9px;
  overflow: hidden;
}

.card-top {
  padding: 10px 10px 0;
}

.base-info {
  display: flex;
}

.avatar {
  margin-right: 9px;
  flex-shrink: 0;
}

.avatar img {
  width: 92px;
  height: 92px;
  border-radius: var(--global-border-radius);
  object-fit: cover;
}

.info-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.agent-name {
  font-size: 16px;
  color: var(--color-blue-517bff);
  margin-bottom: 4px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  flex: 1;
}

.agent-desc {
  font-size: 12px;
  color: var(--color-gray-414141);
  max-height: 91px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
  text-overflow: ellipsis;
  flex: 1;
}

.status-action {
  display: flex;
  flex-direction: row-reverse;
  margin-left: 9px;
}

.status-action.has-border {
  border-top: var(--unified-border);
  padding-top: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  position: relative;
  cursor: pointer;
}

.action-btn-bg {
  width: 70px;
  height: 30px;
}

.action-btn-text {
  position: absolute;
  right: 8px;
  font-size: 15px;
}

.review-text {
  font-size: 15px;
  color: var(--color-gray-3d);
  margin: 0 9px 9px 0;
}

.card-published {
  padding: 11px;
}

.unpublish-btn {
  font-size: 15px;
  color: var(--color-purple-7b61ff);
  border-bottom: var(--unified-border-bottom);
  height: 15px;
  cursor: pointer;
  margin-left: 9px;
  flex-shrink: 0;
}

.detail-list {
  padding-top: 9px;
}

.detail-item {
  font-size: 12px;
  color: var(--color-gray-3d);
  margin-bottom: 9px;
}

.detail-divider {
  height: 1px;
  background-color: var(--color-gray-d8d8d8);
  margin-bottom: 9px;
}

.detail-footer {
  display: flex;
  justify-content: space-between;
}

.time-range {
  color: var(--color-gray-979797);
}

.confirm-dialog {
  text-align: center;
  padding: 10px 0;
}

.confirm-icon {
  width: 63px;
  height: 63px;
  border-radius: 50%;
  background: var(--color-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.confirm-icon img {
  width: 29px;
  height: 28px;
}

.confirm-text {
  font-size: 12px;
  color: var(--color--b0aefa);
  text-transform: uppercase;
  letter-spacing: 0.3em;
  margin-bottom: 20px;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
}
</style>
