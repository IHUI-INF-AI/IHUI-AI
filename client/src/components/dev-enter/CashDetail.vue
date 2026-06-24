<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'
import { getUserToken } from '@/utils/request'

async function authFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
  const token = getUserToken()
  return fetch(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

const { t } = useI18n()

interface CashItem {
  query_time?: string
  reviewer_time?: string
  payment_time?: string
  status: string | number
  amount?: number
  time?: string
  num?: string
}

const props = defineProps<{
  userInfo?: Record<string, unknown>
}>()

const cleanup = useCleanup()

const barList = ref([
  { text: '7天' },
  { text: '一个月' },
  { text: '近一年' },
  { text: '全部' },
])

const dataList = ref<CashItem[]>([])

let abortController: AbortController | null = null
cleanup.add(() => abortController?.abort())

const statusVal: Record<string, string> = {
  '0': '审核中',
  '1': '已处理',
  '2': '已到账',
  '3': '失败',
  '4': '未通过',
}

const statusColor: Record<string, string> = {
  '0': 'var(--color-blue-517bff)',
  '1': 'var(--color-black)',
  '2': 'var(--color-wechat-07c160)',
  '3': 'var(--color-black)',
  '4': 'var(--color-red)',
}

const activeTab = ref(0)

function formatFullTimeFn(num: number | string): string {
  if (!num) return ''
  const date = new Date(typeof num === 'number' ? num * 1000 : num)
  return `${date.getFullYear()} ${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

onMounted(async () => {
  try {
    const userId = (props.userInfo as Record<string, unknown>)?.uuid
    abortController = new AbortController()
    const response = await authFetch(`/api/mxList?type=1&user_id=${userId}&page=1&page_size=10`, { signal: abortController.signal })
    const res = await response.json()
    if (res.data) {
      dataList.value = res.data
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    dataList.value = []
  }
})
</script>

<template>
  <div class="cash-detail">
    <div class="top-bar">
      <button
        v-for="(item, index) in barList"
        :key="index"
        class="top-bar-item"
        :class="{ active: activeTab === index }"
        @click="activeTab = index"
      >
        {{ item.text }}
      </button>
    </div>
    <div class="scroll-body">
      <div v-for="(item, index) in dataList" :key="index" class="cash-item">
        <div class="content">
          <img class="cash-image" src="https://file.aizhs.top/sys-mini/xtk/cash.png" alt="cash" />
          <div class="center">
            <div class="title">{{ t('devEnterCashDetail.withdraw') }}</div>
            <div v-if="item.query_time" class="time">{{ t('devCashDetail.withdrawTime') }}{{ formatFullTimeFn(item.query_time) }}</div>
            <div v-if="item.reviewer_time" class="time">{{ t('devCashDetail.processTime') }}{{ formatFullTimeFn(item.reviewer_time) }}</div>
            <div v-if="item.payment_time" class="time">{{ t('devCashDetail.arrivalTime') }}{{ formatFullTimeFn(item.payment_time) }}</div>
          </div>
          <div style="padding-top: auto">
            <div class="status">
              <span :style="{ color: statusColor[item.status] }">{{ statusVal[item.status] }}</span>
            </div>
            <div v-if="item.amount" class="money">
              <span>+</span>
              <span>{{ (item.amount / 100).toFixed(2) }}</span>
            </div>
          </div>
        </div>
        <div class="line" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cash-detail {
  width: 100%;
}

.top-bar {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-bottom: var(--unified-border-bottom);
}

.top-bar-item {
  padding: 6px 16px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background: var(--color-white);
  cursor: pointer;
  font-size: 14px;

  &.active {
    background: var(--color-blue-517bff);
    color: var(--color-white);
    border-color: var(--color-blue-517bff);
  }
}

.scroll-body {
  width: 100%;
  height: calc(100vh - 170px);
  padding: 17px;
  overflow-y: auto;
}

.cash-item {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .content {
    display: flex;
    width: 100%;

    .cash-image {
      width: 43px;
      height: 43px;
    }

    .center {
      flex: 1;

      .title {
        font-size: 15px;
        font-weight: normal;
        color: var(--color-black);
      }

      .time {
        font-size: 10px;
        font-weight: normal;
        color: var(--color-gray-979797);
      }
    }

    .status {
      font-size: 12px;
      font-weight: 500;
    }

    .money {
      display: flex;
      font-size: 15px;
      font-weight: 500;
      color: var(--color-black);
    }
  }

  .line {
    width: 100%;
    height: 1px;
    background: var(--color-gray-eee);
    margin-top: 12px;
  }
}
</style>
