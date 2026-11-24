// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端「本机工作区句柄」适配层（2026-11-19 立）。
 *
 * 为什么需要它：仓库既有的对话侧工具执行器
 * （`packages/shared/src/chat/workspace-tool-executor.ts`）是围绕 W3C
 * `FileSystemDirectoryHandle` 写的 —— 浏览器用 `showDirectoryPicker()` 拿到真句柄，
 * 桌面端拿不到（Tauri 只给绝对路径）。于是桌面端此前**只能**把路径交给服务端白名单。
 *
 * 这一层把 `workspace_fs_*` IPC 包装成同一套句柄语义（只实现执行器真正用到的那几个
 * 方法：`values` / `getDirectoryHandle` / `getFileHandle` / `getFile` / `createWritable`
 * / `removeEntry`），执行器代码**一行不改**就能在桌面端跑在本机文件上。
 *
 * 边界：路径永远由本层在**已授权 root 内**拼出来（相对串），不接受调用方给绝对路径；
 * 超出 root 的请求由 Rust 侧 `workspace_fs_core::normalize_rel` 直接拒。
 */

import {
  workspaceFsList,
  workspaceFsRead,
  workspaceFsRemove,
  workspaceFsWrite,
  type WorkspaceFsEntry,
} from './tauri-bridge'

/** 执行器用到的最小文件句柄形态。 */
export interface ShimFileHandle {
  readonly kind: 'file'
  readonly name: string
  getFile(): Promise<File>
  createWritable(): Promise<{
    write: (data: string | BufferSource | Blob) => Promise<void>
    close: () => Promise<void>
  }>
}

/** 执行器用到的最小目录句柄形态。 */
export interface ShimDirectoryHandle {
  readonly kind: 'directory'
  readonly name: string
  values(): AsyncIterableIterator<ShimFileHandle | ShimDirectoryHandle>
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<ShimDirectoryHandle>
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<ShimFileHandle>
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>
}

function joinRel(base: string, name: string): string {
  const cleaned = name.replace(/[\\/]+/g, '').trim()
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error(`非法的文件/目录名：${name}`)
  }
  return base ? `${base}/${cleaned}` : cleaned
}

async function writeText(data: string | BufferSource | Blob): Promise<string> {
  if (typeof data === 'string') return data
  if (typeof Blob !== 'undefined' && data instanceof Blob) return await data.text()
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data))
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    return new TextDecoder().decode(bytes)
  }
  return String(data)
}

function makeFileHandle(rel: string, name: string): ShimFileHandle {
  return {
    kind: 'file',
    name,
    async getFile() {
      const reply = await workspaceFsRead(rel)
      if (reply.state !== 'ok') throw new Error(reply.reason || `读取被拒(${reply.kind})`)
      const text = reply.content ?? ''
      return new File([text], name, {
        type: 'text/plain',
        lastModified: (reply.modified ?? 0) * 1000,
      })
    },
    async createWritable() {
      let buffer = ''
      return {
        async write(data: string | BufferSource | Blob) {
          buffer += await writeText(data)
        },
        async close() {
          const reply = await workspaceFsWrite(rel, buffer, { createParent: true })
          if (reply.state !== 'ok') throw new Error(reply.reason || `写入被拒(${reply.kind})`)
          buffer = ''
        },
      }
    },
  }
}

function makeDirHandle(rel: string, name: string): ShimDirectoryHandle {
  const handle: ShimDirectoryHandle = {
    kind: 'directory',
    name,
    async *values() {
      const reply = await workspaceFsList(rel)
      if (reply.state !== 'ok') throw new Error(reply.reason || `列目录被拒(${reply.kind})`)
      const entries: WorkspaceFsEntry[] = reply.entries ?? []
      for (const entry of entries) {
        if (entry.kind === 'dir') {
          yield makeDirHandle(entry.path, entry.name)
        } else if (entry.kind === 'file') {
          yield makeFileHandle(entry.path, entry.name)
        }
        // `other`（符号链接/设备等）刻意不投影：执行器看不到就不会误读写
      }
    },
    async getDirectoryHandle(childName: string, opts?: { create?: boolean }) {
      const childRel = joinRel(rel, childName)
      const stat = await workspaceFsList(childRel)
      if (stat.state !== 'ok') {
        if (opts?.create) throw new Error('本机通道暂不支持新建目录（先用写入文件自动建父目录）')
        throw new Error(stat.reason || `目录不存在(${stat.kind})`)
      }
      return makeDirHandle(childRel, childName)
    },
    async getFileHandle(childName: string, opts?: { create?: boolean }) {
      const childRel = joinRel(rel, childName)
      if (!opts?.create) {
        const stat = await workspaceFsRead(childRel, 1)
        if (stat.state === 'rejected' && stat.kind === 'io_error') {
          throw new Error(stat.reason)
        }
      }
      return makeFileHandle(childRel, childName)
    },
    async removeEntry(childName: string, opts?: { recursive?: boolean }) {
      const childRel = joinRel(rel, childName)
      const reply = await workspaceFsRemove(childRel, opts?.recursive ?? false)
      if (reply.state !== 'ok') throw new Error(reply.reason || `删除被拒(${reply.kind})`)
    },
  }
  return handle
}

/**
 * 由已授权的本机 root 造一个目录句柄（root 必须来自 `workspacePickRoot` /
 * `workspaceAuthorizeRoot` 的成功回包，本层不做任何授权动作）。
 */
export function createTauriWorkspaceHandle(root: string, name?: string): ShimDirectoryHandle {
  const trimmed = root.replace(/[\\/]+$/, '')
  const label = name ?? trimmed.split(/[\\/]/).pop() ?? trimmed
  return makeDirHandle('', label)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
