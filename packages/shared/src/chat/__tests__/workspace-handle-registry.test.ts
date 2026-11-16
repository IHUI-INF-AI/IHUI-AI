// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 浏览器工作区句柄注册表的策略锁(2026-11-16)。
 *
 * 起因:showDirectoryPicker 只给文件夹名,不同父路径下的同名目录共用同一个键,
 * 后选的句柄会覆盖先选的 —— 用户切回 A 项目却读写 B 项目文件,且没有任何报错。
 *
 * 锁住三件事:
 *  ① 同一目录重复选择复用原键,不产生 `#2` 重复项
 *  ② 不同目录但同名必须分配新键,绝不能覆盖
 *  ③ 无句柄时授权恢复返回 'missing',而不是假装 granted
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  clearBrowserWorkspaceHandle,
  saveBrowserWorkspaceHandle,
} from '../workspace-context-loader'
import {
  requestBrowserWorkspacePermission,
  resolveBrowserWorkspaceKeyForHandle,
} from '../workspace-handle-registry'

function fakeHandle(
  name: string,
  permission: PermissionState = 'granted',
): FileSystemDirectoryHandle {
  // 用稳定 token 模拟 isSameEntry:同一对象为 true,不同对象为 false
  const token = {}
  const handle = {
    __token: token,
    name,
    isSameEntry: async (other: unknown) =>
      (other as { __token?: unknown } | null)?.__token === token,
    requestPermission: async () => permission,
  }
  return handle as unknown as FileSystemDirectoryHandle
}

const CLEANUP_KEYS = ['proj', 'proj#2', 'proj#3']

afterEach(() => {
  for (const key of CLEANUP_KEYS) clearBrowserWorkspaceHandle(key)
})

describe('resolveBrowserWorkspaceKeyForHandle', () => {
  it('同一目录重复选择 ⇒ 复用原键', async () => {
    const a = fakeHandle('proj')
    saveBrowserWorkspaceHandle('proj', a)
    expect(await resolveBrowserWorkspaceKeyForHandle(a)).toBe('proj')
  })

  it('同名但不同目录 ⇒ 分配新键,不覆盖已有句柄', async () => {
    const a = fakeHandle('proj')
    const b = fakeHandle('proj')
    saveBrowserWorkspaceHandle('proj', a)
    expect(await resolveBrowserWorkspaceKeyForHandle(b)).toBe('proj#2')
    // 再选一次 b:命中已登记的 proj#2,不继续涨号
    saveBrowserWorkspaceHandle('proj#2', b)
    expect(await resolveBrowserWorkspaceKeyForHandle(b)).toBe('proj#2')
    expect(await resolveBrowserWorkspaceKeyForHandle(a)).toBe('proj')
  })

  it('首个目录无冲突 ⇒ 直接用文件夹名', async () => {
    expect(await resolveBrowserWorkspaceKeyForHandle(fakeHandle('proj'))).toBe('proj')
  })
})

describe('requestBrowserWorkspacePermission', () => {
  it('无句柄 ⇒ missing', async () => {
    expect(await requestBrowserWorkspacePermission('proj')).toBe('missing')
  })

  it('有句柄 ⇒ 调 requestPermission 并透传结果', async () => {
    saveBrowserWorkspaceHandle('proj', fakeHandle('proj', 'granted'))
    expect(await requestBrowserWorkspacePermission('proj')).toBe('granted')
  })
})
