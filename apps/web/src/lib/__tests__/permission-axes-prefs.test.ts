// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 双轴本机记忆取证(2026-10-26 立)。
 *
 * 钉的是「读回只在合法域内生效、坏数据一律当没存过、写/清不抛」三条 ——
 * 任一被改坏,权限双轴就会出现「界面显示 A、刷新后实际生效 B」的静默失效。
 * 零连接、零 DOM(注入内存 storage)。
 */
import { describe, it, expect } from 'vitest'
import {
  PERMISSION_AXES_STORAGE_KEY,
  readStoredPermissionAxes,
  writeStoredPermissionAxes,
} from '../permission-axes-prefs'

function memStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
  }
}

describe('permission-axes-prefs', () => {
  it('写入后能按同一形状读回', () => {
    const storage = memStorage()
    const pair = { sandboxMode: 'workspace-write', approvalPolicy: 'on-request' } as const
    writeStoredPermissionAxes(pair, storage)
    expect(readStoredPermissionAxes(storage)).toEqual(pair)
  })

  it('未存过 ⇒ null(不得补默认档)', () => {
    expect(readStoredPermissionAxes(memStorage())).toBeNull()
  })

  it('非法 sandboxMode / approvalPolicy ⇒ 当没存过', () => {
    const storage = memStorage()
    storage.setItem(
      PERMISSION_AXES_STORAGE_KEY,
      JSON.stringify({ sandboxMode: 'yolo', approvalPolicy: 'on-request' }),
    )
    expect(readStoredPermissionAxes(storage)).toBeNull()
    storage.setItem(
      PERMISSION_AXES_STORAGE_KEY,
      JSON.stringify({ sandboxMode: 'read-only', approvalPolicy: 'always' }),
    )
    expect(readStoredPermissionAxes(storage)).toBeNull()
  })

  it('坏 JSON / 非对象 ⇒ null 且不抛', () => {
    const storage = memStorage()
    storage.setItem(PERMISSION_AXES_STORAGE_KEY, '{not-json')
    expect(readStoredPermissionAxes(storage)).toBeNull()
    storage.setItem(PERMISSION_AXES_STORAGE_KEY, '"read-only"')
    expect(readStoredPermissionAxes(storage)).toBeNull()
  })

  it('写 null = 跟随单轴 ⇒ 删键', () => {
    const storage = memStorage()
    writeStoredPermissionAxes({ sandboxMode: 'read-only', approvalPolicy: 'never' }, storage)
    expect(storage.map.has(PERMISSION_AXES_STORAGE_KEY)).toBe(true)
    writeStoredPermissionAxes(null, storage)
    expect(storage.map.has(PERMISSION_AXES_STORAGE_KEY)).toBe(false)
  })

  it('storage 抛错(隐私模式/配额满)⇒ 读返回 null、写不抛', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    expect(readStoredPermissionAxes(throwing)).toBeNull()
    expect(() =>
      writeStoredPermissionAxes({ sandboxMode: 'read-only', approvalPolicy: 'never' }, throwing),
    ).not.toThrow()
    expect(() => writeStoredPermissionAxes(null, throwing)).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
