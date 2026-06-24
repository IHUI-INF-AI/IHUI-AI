/**
 * handleDeletedFilesHMR - 解决 Vite dev server 在 HMR 收到被删除文件更新时抛错的问题
 *
 * 问题现象：Vite 通过 ws 推送 update 消息时，如果 path 包含不存在的文件或奇怪的
 * 地址（"Down.vue" / [0x... ...] 十六进制格式），会抛 "ENOENT: no such file or directory"
 *
 * 解决方式：在 ws 客户端 message 事件前置 filter，丢弃：
 *   1. 16 进制地址格式（V8 internal 抛错文本）
 *   2. 包含 "Down.vue" 的 updates（被删文件）
 */
import type { ViteDevServer } from 'vite'

export function handleDeletedFilesHMR() {
  return {
    name: 'handle-deleted-files-hmr',
    configureServer(server: ViteDevServer) {
      server.ws.on('connection', socket => {
        socket.on('message', data => {
          if (typeof data === 'string') {
            // V8 internal pointer address (e.g. "[0xc001d766b0 0xc00bddb3b0]")
            if (
              /^\[0x[0-9a-fA-F]+(\s+0x[0-9a-fA-F]+)*\]$/.test(data) ||
              /^0x[0-9a-fA-F]+(\s+0x[0-9a-fA-F]+)*$/.test(data)
            ) {
              return
            }
            try {
              const msg = JSON.parse(data)
              if (msg.type === 'update' && msg.updates) {
                msg.updates = msg.updates.filter((update: any) => {
                  if (update.path && update.path.includes('Down.vue')) {
                    return false
                  }
                  return true
                })
                if (msg.updates.length === 0) {
                  return
                }
              }
            } catch {
              // ignore non-JSON messages
            }
          }
        })
      })
    },
  }
}
