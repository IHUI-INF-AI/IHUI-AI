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
      // 加入 admin 房间 (后端 sio.enter_room), join 事件会校验 room 名
      // 命名规范: notify:admin (群组) / notify:<user_uuid> (单点)
      _socket?.emit('join', { room: 'notify:admin' })
    })
    _socket.on('joined', (data: { room?: string }) => {
      // 加入成功, 调试用 (生产可关)
      if (data?.room) {
         
        console.debug('[notify] joined room:', data.room)
      }
    })
    _socket.on('notify:new', (payload: { id: string; level?: string; title?: string; body?: string }) => {
      // 收到推送: 立即 +1 (后端已写入 DB, 下一轮轮询会校正)
      if (payload && typeof payload.id === 'string') {
        _unreadCount.value = _unreadCount.value + 1
        // error 级别实时弹窗 (P1 增强: 让运维立即看到严重告警, 无需切到通知中心)
        if (payload.level === 'error') {
          _showErrorToast(payload)
        }
      }
    })
    _socket.on('connect_error', () => {
      // 静默: 轮询兜底
    })
    _socket.on('disconnect', (_reason: string) => {
      // P1 增强: socket 断开立即拉一次, 避免漏掉最后几条推送
      // 场景: 推送事件刚好在断线时发出, client 永远不会收到, 必须靠轮询兜底
      void _fetch()
    })
    _socket.on('error', (err: { code?: number; msg?: string }) => {
      // 静默: 轮询兜底
       
      console.warn('[notify] socket error:', err?.msg ?? err)
    })
  } catch {
    // 静默: 轮询兜底
  }
}

/** error 级别实时弹窗 (动态 import ElMessage 避免循环依赖). */
function _showErrorToast(payload: { title?: string; body?: string }) {
  try {
    // 动态 import: useNotifyBadge 可能在 Element Plus 加载前被调用
    void import('element-plus').then((m) => {
      // ElMessage 5.x: error(msg, options?) 接受 {duration, showClose, ...}
      const mod = m as {
        ElMessage?: {
          error: (s: string, opts?: { duration?: number; showClose?: boolean; grouping?: boolean }) => void
        }
      }
      const ElMessage = mod.ElMessage
      if (ElMessage && typeof ElMessage.error === 'function') {
        const title = payload.title || '严重告警'
        const body = payload.body ? `\n${payload.body}` : ''
        // P1 增强: duration: 0 = 不自动关闭, showClose: true = 显示 X 按钮
        // grouping: false = 多个 error 不合并, 避免重要告警被新消息覆盖
        ElMessage.error(`${title}${body}`, {
          duration: 0,
          showClose: true,
          grouping: false,
        })
      }
    })
  } catch {
    // ignore
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
