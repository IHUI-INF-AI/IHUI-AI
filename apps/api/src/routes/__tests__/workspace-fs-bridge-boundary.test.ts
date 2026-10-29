// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件桥的工作区边界锁(2026-10-27 加固配套)。
 *
 * 立因:此前 `workspacePath` 全程是客户端自报字符串,`resolvePath` 对绝对路径直接放行,
 * 于是"文件必须落在工作区内"这条判据可以自我成立 —— 传 `workspacePath="C:\"` 之后整台
 * 生产机都在"工作区内"。现判据住在 utils/workspace-roots.ts,由服务端 env 白名单裁定。
 *
 * 夹具纪律:全部断言只读仓库内既有路径,不新建目录、不写盘(§15b 的临时夹具出口是给
 * scripts 侧用的;这里连只读都不需要额外落点)。符号链接逃逸一档不做 —— Windows 上
 * 创建 symlink 需要特权,且判据已走 realpath,构造该形态的收益抵不上把测试挂在权限上。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getRegisteredWorkspaceRoots,
  isInsideRoot,
  assertWithinRegisteredRoots,
  isWithinAnyRegisteredRoot,
  WORKSPACE_ROOTS_ENV,
} from '../../utils/workspace-roots.js'
import { fsBridge } from '../../services/workspace-ai-service.js'

const HERE = dirname(fileURLToPath(import.meta.url))
/** apps/api —— 充当"已登记的工作区根"(__tests__ → routes → src → api) */
const PKG_ROOT = resolve(HERE, '../../..')
/** 仓库根 —— 在 PKG_ROOT 之外,充当越界目标 */
const REPO_ROOT = resolve(PKG_ROOT, '..')
const INSIDE_FILE = join(PKG_ROOT, 'package.json')
const OUTSIDE_FILE = join(REPO_ROOT, 'README.md')

function setRoots(value: string | undefined): void {
  if (value === undefined) delete process.env[WORKSPACE_ROOTS_ENV]
  else process.env[WORKSPACE_ROOTS_ENV] = value
}

afterEach(() => {
  setRoots(undefined)
})

describe('工作区登记根判据(utils/workspace-roots)', () => {
  it('env 未配置 ⇒ 根集合为空,任何路径一律拒绝(fail-closed,不是"什么都不约束")', () => {
    setRoots(undefined)
    expect(getRegisteredWorkspaceRoots()).toEqual([])
    expect(isWithinAnyRegisteredRoot(INSIDE_FILE)).toBe(false)
    expect(() => assertWithinRegisteredRoots(INSIDE_FILE)).toThrow(/未启用/)
  })

  it('登记 PKG_ROOT ⇒ 根内放行、根外拒绝', () => {
    setRoots(PKG_ROOT)
    expect(assertWithinRegisteredRoots(INSIDE_FILE)).toBeTruthy()
    expect(() => assertWithinRegisteredRoots(OUTSIDE_FILE)).toThrow(/未在服务端登记/)
  })

  it('env 里指向不存在的目录 ⇒ 不抛,按 resolve 参与比较(登记动作不该被磁盘状态卡住)', () => {
    setRoots(join(PKG_ROOT, 'no-such-dir-for-test'))
    expect(getRegisteredWorkspaceRoots().length).toBe(1)
  })

  it('isInsideRoot 三档边界:同路径算内、直接父目录算外、`..` 回跳算外', () => {
    const root = resolve('A', 'B', 'C')
    expect(isInsideRoot(root, root)).toBe(true)
    expect(isInsideRoot(join(root, 'x', 'y'), root)).toBe(true)
    expect(isInsideRoot(resolve(root, '..'), root)).toBe(false)
    expect(isInsideRoot(resolve(root, '..', '..', 'other'), root)).toBe(false)
    // 兄弟目录名以 root 名为前缀时不得被误判为"在内"(这是 startsWith 写法的经典漏口)
    expect(isInsideRoot(resolve(root, '..') + 'C', root)).toBe(false)
  })
})

describe('fsBridge 的 read/grep/browse 边界', () => {
  it('未登记任何根 ⇒ read 直接拒绝,连文件是否存在都不去判断', () => {
    setRoots(undefined)
    expect(() => fsBridge.read({ path: 'package.json', workspacePath: PKG_ROOT })).toThrow(/未启用/)
  })

  it('登记后读根内文件成功(正向对照:收紧不该把合法用法一并打死)', () => {
    setRoots(PKG_ROOT)
    const r = fsBridge.read({ path: 'package.json', workspacePath: PKG_ROOT, endLine: 3 })
    expect(r.content).toContain('name')
  })

  it('相对路径 `..` 回跳到父目录 ⇒ 越界拒绝(修前:workspacePath 自报即可绕过)', () => {
    setRoots(PKG_ROOT)
    expect(() => fsBridge.read({ path: '../README.md', workspacePath: PKG_ROOT })).toThrow(/越界/)
  })

  it('客户端把 workspacePath 本身填成仓库根(未登记的父目录)⇒ 拒绝', () => {
    setRoots(PKG_ROOT)
    expect(() => fsBridge.read({ path: 'README.md', workspacePath: REPO_ROOT })).toThrow(
      /未在服务端登记/,
    )
  })

  it('grep 同样受闸:此前它只走 resolvePath 而不做越界校验', () => {
    setRoots(PKG_ROOT)
    expect(() =>
      fsBridge.grep({ path: REPO_ROOT, workspacePath: PKG_ROOT, pattern: 'IHUI' }),
    ).toThrow(/未在服务端登记|越界/)
  })

  it('browse 无 path 时只返回登记根(修前:Windows 下枚举 A:\\~Z:\\ 全部盘符)', () => {
    setRoots(PKG_ROOT)
    const list = fsBridge.browse()
    expect(list.length).toBe(1)
    const first = list[0]
    if (!first) throw new Error('browse() 未返回条目 —— 断言无从谈起')
    expect(first.path).toBe(assertWithinRegisteredRoots(PKG_ROOT))
    for (const e of list) {
      expect(e.path).not.toMatch(/^[A-Za-z]:\\$/)
    }
  })

  it('browse 未登记任何根 ⇒ 拒绝;浏览登记根之外的目录 ⇒ 越界', () => {
    setRoots(undefined)
    expect(() => fsBridge.browse()).toThrow(/未启用/)
    setRoots(PKG_ROOT)
    expect(() => fsBridge.browse(REPO_ROOT)).toThrow(/越界/)
    expect(fsBridge.browse(PKG_ROOT).length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
