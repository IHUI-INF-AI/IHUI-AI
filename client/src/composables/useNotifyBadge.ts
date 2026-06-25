// 站内信未读红点 composable
// - 模块级单例 ref: 跨组件共享, 菜单红点 + 通知中心共享同一份状态
// - 自动启停: 首个调用 start() 的组件挂载时启动轮询, 全部 unmount 后停止
// - 错误静默: 网络错误不抛, 沿用上次值, 避免污染 UI
// - 暴露 setUnread: 通知中心标记已读时可立即覆盖, 不必等下次轮询
// - Socket.IO 实时推送: 收到 notify:new 事件立即 +1 (省去 30s 轮询延迟)

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import http from '@/utils/request'
import { io, type Socket } from 'socket.io-client'

const POLL_INTERVAL_MS = 30_000

// 全局单例状态, 跨组件共享 (菜单红点 + 通知中心使用同一引用)
const _unreadCount: Ref<number> = ref(0)
const _polling = ref(false)
let _timer: number | null = null
let _refCount = 0
let _socket: Socket | null = null

/** 计算 socket.io 连接 URL (与 useTaskWebSocket 保持一致). */
function _socketUrl(): string {
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.host}`
  } else if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL.replace(/^ws/, 'http')
  }
  return 'http://localhost:8888'
}

async function _fetch(): Promise<void> {
  try {
    const resp = await http.get<{ code: number; data: { unread_count: number }; msg: string }>(
      '/api/admin/migration/notify/unread-count',
    )
    // 2026-06-24 修正: response 是 AxiosResponse, body 在 resp.data; body 内部还有一层 data 包装
    const n = resp?.data?.data?.unread_count
    if (typeof n === 'number' && n >= 0) {
      _unreadCount.value = n
    }
  } catch {
    // 静默: 沿用旧值, 避免污染菜单
  }
}

/** 本地覆盖未读数 (供通知中心标记已读/全部已读时立即更新). */
function _setUnread(n: number): void {
  if (typeof n === 'number' && n >= 0) {
    _unreadCount.value = n
  }
}

function _start(): void {
  if (_timer !== null) return
  _polling.value = true
  void _fetch()
  _timer = window.setInterval(() => {
    void _fetch()
  }, POLL_INTERVAL_MS)
  // 启动 Socket.IO 监听 (用于实时推送)
  _startSocket()
}

function _stop(): void {
  if (_timer !== null) {
    clearInterval(_timer)
    _timer = null
  }
  _polling.value = false
  // 关闭 Socket.IO 监听 (避免资源泄漏)
  _stopSocket()
}

/** 启动 Socket.IO 订阅 notify:new 事件. */
function _startSocket(): void {
  if (_socket) return
  try {
    _socket = io(_socketUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    })
    _socket.on('connect', () => {
      // 可选: 加入 admin 房间 (后端若支持)
      _socket?.emit('join', { room: 'notify:admin' })
    })
    _socket.on('notify:new', (payload: { id: string; level?: string }) => {
      // 收到推送: 立即 +1 (后端已写入 DB, 下一轮轮询会校正)
      if (payload && typeof payload.id === 'string') {
        _unreadCount.value = _unreadCount.value + 1
      }
    })
    _socket.on('connect_error', () => {
      // 静默: 轮询兜底
    })
  } catch {
    // 静默: 轮询兜底
  }
}

/** 关闭 Socket.IO 监听. */
function _stopSocket(): void {
  if (_socket) {
    try {
      _socket.disconnect()
    } catch {
      // ignore
    }
    _socket = null
  }
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
    /** 未读总数 (模块级单例 ref, 跨组件共享同一份) */
    unreadCount: _unreadCount,
    /** 是否正在轮询 (调试用) */
    polling: _polling,
    /** 手动刷新一次 (用于点击菜单时即时拉取) */
    refresh: _fetch,
    /** 本地覆盖未读数 (供通知中心 markRead/markAllRead 立即更新, 避免轮询延迟) */
    setUnread: _setUnread,
  }
}
