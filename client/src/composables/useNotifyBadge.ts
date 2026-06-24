// 站内信未读红点 composable
// 每 30s 轮询一次 /api/admin/migration/notify/unread-count
// - 多页面共享: 暴露全局状态 (ref) 供 menu 引用
// - 自动启停: 首个调用 start() 的组件挂载时启动轮询, 全部 unmount 后停止
// - 错误静默: 网络错误不抛, 沿用上次值, 避免污染 UI

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import http from '@/utils/request'

const POLL_INTERVAL_MS = 30_000

// 全局单例状态, 跨组件共享
const _unreadCount: Ref<number> = ref(0)
const _polling = ref(false)
let _timer: number | null = null
let _refCount = 0

async function _fetch(): Promise<void> {
  try {
    const resp = await http.get<{ code: number; data: { unread_count: number }; msg: string }>(
      '/api/admin/migration/notify/unread-count',
    )
    // 2026-06-24 修正：response 是 AxiosResponse，body 在 resp.data；body 内部还有一层 data 包装
    const n = resp?.data?.data?.unread_count
    if (typeof n === 'number' && n >= 0) {
      _unreadCount.value = n
    }
  } catch {
    // 静默: 沿用旧值, 避免污染菜单
  }
}

function _start(): void {
  if (_timer !== null) return
  _polling.value = true
  void _fetch()
  _timer = window.setInterval(() => {
    void _fetch()
  }, POLL_INTERVAL_MS)
}

function _stop(): void {
  if (_timer !== null) {
    clearInterval(_timer)
    _timer = null
  }
  _polling.value = false
}

export function useNotifyBadge() {
  onMounted(() => {
    _refCount += 1
    if (_refCount === 1) {
      _start()
    }
  })

  onBeforeUnmount(() => {
    _refCount = Math.max(0, _refCount - 1)
    if (_refCount === 0) {
      _stop()
    }
  })

  return {
    unreadCount: _unreadCount,
    polling: _polling,
    /** 手动刷新一次 (用于点击菜单时即时拉取) */
    refresh: _fetch,
  }
}
