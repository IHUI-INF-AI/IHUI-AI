// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票㉑ 第一枚:扩展端"文件族到底带不带"的闸门自证(2026-09-28)。
 *
 * 三层,缺一层都不算锁住:
 *  ① 能力探测四态(无 window / 非安全上下文 / 有 picker 无权限 API / 三项齐)——
 *     实测里 `chrome-error://` 与 `about:blank` 两种页面都是全 undefined,所以 secureContext
 *     必须独立成一维;把"页面根本没加载"读成"这个浏览器没有 FSA"是我在本次 spike 里
 *     真真切切错过一次的答案(第一版探针就是那么读的)。
 *  ② 闸门 = 能力 ∧ 有执行代理:任何一半单独成立都**不许**放开 —— 这是本票唯一的新不变量。
 *  ③ 源码级接线:`toolsForChatRequest` 必须真调 `fileToolsAllowed`(函数在而无人调 = 没有,
 *     守门 64/70/81/115 同族)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import {
  detectWorkspaceCapability,
  fileToolsAllowed,
  hasWorkspaceToolExecutor,
  registerWorkspaceToolExecutor,
  unregisterWorkspaceToolExecutor,
  type WorkspaceCapability,
} from '../lib/workspace-capability'
import { toolsForChatRequest } from '../lib/ui-control-tools'

const HERE = dirname(fileURLToPath(import.meta.url))
const FULL: WorkspaceCapability = { secureContext: true, fsaPick: true, permissionQuery: true }

afterEach(() => {
  // 执行代理是模块级状态:不收回就是给下一条用例发合格证
  unregisterWorkspaceToolExecutor('spec')
})

describe('① 能力探测四态', () => {
  it('没有 window(节点环境 / content script)⇒ 三项全 false', () => {
    expect(detectWorkspaceCapability(undefined)).toEqual({
      secureContext: false,
      fsaPick: false,
      permissionQuery: false,
    })
  })

  it('非安全上下文:picker 在位也不能算有能力', () => {
    const cap = detectWorkspaceCapability({
      isSecureContext: false,
      showDirectoryPicker: () => Promise.resolve({} as never),
      FileSystemHandle: { prototype: { queryPermission: () => {} } },
    })
    expect(cap).toEqual({ secureContext: false, fsaPick: true, permissionQuery: true })
  })

  it('缺 queryPermission ⇒ permissionQuery false(写能力无法当场验证,就不声明能写)', () => {
    const cap = detectWorkspaceCapability({
      isSecureContext: true,
      showDirectoryPicker: () => Promise.resolve({} as never),
    })
    expect(cap.permissionQuery).toBe(false)
    expect(cap.fsaPick).toBe(true)
  })

  it('三项齐 ⇒ 三项全 true(2026-09-28 实测在扩展侧栏页上的形态)', () => {
    const cap = detectWorkspaceCapability({
      isSecureContext: true,
      showDirectoryPicker: () => Promise.resolve({} as never),
      FileSystemHandle: { prototype: { queryPermission: () => {} } },
    })
    expect(cap).toEqual(FULL)
  })
})

describe('② 闸门 = 能力 ∧ 执行代理(两半各自成立都不许放开)', () => {
  it('默认关闭:未注册执行代理时,满能力也不放开', () => {
    expect(hasWorkspaceToolExecutor()).toBe(false)
    expect(fileToolsAllowed(FULL)).toBe(false)
  })

  it('注册后 + 满能力才放开', () => {
    registerWorkspaceToolExecutor('spec')
    expect(hasWorkspaceToolExecutor()).toBe(true)
    expect(fileToolsAllowed(FULL)).toBe(true)
  })

  it('注册了执行代理但能力缺任意一项 ⇒ 仍然关闭(三条各测一次)', () => {
    registerWorkspaceToolExecutor('spec')
    const broken = [
      { secureContext: false, fsaPick: true, permissionQuery: true },
      { secureContext: true, fsaPick: false, permissionQuery: true },
      { secureContext: true, fsaPick: true, permissionQuery: false },
    ]
    for (const cap of broken) {
      if (fileToolsAllowed(cap)) throw new Error(`闸门被单项缺失放开:${JSON.stringify(cap)}`)
      expect(fileToolsAllowed(cap)).toBe(false)
    }
  })

  it('注销即关(执行代理不是单向棘轮,面板卸载/句柄失效要能收回)', () => {
    registerWorkspaceToolExecutor('spec')
    expect(fileToolsAllowed(FULL)).toBe(true)
    unregisterWorkspaceToolExecutor('spec')
    expect(fileToolsAllowed(FULL)).toBe(false)
  })
})

describe('③ toolsForChatRequest 的两种结果', () => {
  // 两族关键词各自独立命中(判据在 @ihui/shared/utils/app-control-intent),所以
  // "同一句话既带 UI 又带文件族"必须用一句同时含两类关键词的话来测,否则第②条断言是空转。
  const WRITE_INTENT = '帮我修改 src/a.ts 文件的代码逻辑'
  const BOTH_INTENT = '帮我点击提交按钮，并修改 src/a.ts 文件的代码逻辑'
  const UI_INTENT = '帮我点击提交按钮'

  it('闸门关(今天的状态)⇒ 写意图一个文件工具都不带', () => {
    const tools = toolsForChatRequest(WRITE_INTENT, FULL)
    expect(tools).not.toContain('write_file')
    expect(tools).not.toContain('edit_file')
    expect(tools).not.toContain('read_file')
  })

  it('闸门开 ⇒ 两族并集:UI 族不丢,文件族补上', () => {
    registerWorkspaceToolExecutor('spec')
    const tools = toolsForChatRequest(BOTH_INTENT, FULL)
    expect(tools).toContain('write_file')
    expect(tools).toContain('edit_file')
    for (const ui of toolsForChatRequest(UI_INTENT, FULL)) expect(tools).toContain(ui)
  })

  it('闸门关 ⇒ 同一句两意图话只带 UI 族(文件族那一半被闸门摘掉)', () => {
    const closed = toolsForChatRequest(BOTH_INTENT, FULL)
    const open = (registerWorkspaceToolExecutor('spec'), toolsForChatRequest(BOTH_INTENT, FULL))
    expect(closed).not.toContain('write_file')
    expect(open.filter((t) => !closed.includes(t))).toContain('write_file')
  })

  it('闸门开但这句话没有文件意图 ⇒ 不多带文件族(普通问答的轻量面不变)', () => {
    registerWorkspaceToolExecutor('spec')
    const tools = toolsForChatRequest('今天天气怎么样', FULL)
    expect(tools).not.toContain('read_file')
    expect(tools).not.toContain('write_file')
  })

  it('闸门开 + 能力缺 ⇒ 回落到不带文件族(能力探测不是装饰)', () => {
    registerWorkspaceToolExecutor('spec')
    const noFsa: WorkspaceCapability = {
      secureContext: true,
      fsaPick: false,
      permissionQuery: true,
    }
    expect(toolsForChatRequest(BOTH_INTENT, noFsa)).toEqual(
      toolsForChatRequest(BOTH_INTENT, noFsa).filter(
        (t) => t.startsWith('ext_ui_') || t.startsWith('api_'),
      ),
    )
  })
})

describe('④ 源码级接线:判据在位且真被调用', () => {
  const src = readFileSync(join(HERE, '../lib/ui-control-tools.ts'), 'utf8')
  /** 判代码形态前必须剥注释:本模块的说明文字里合法地写着 `navigator.storage.getDirectory()`
   *  —— 拿原文判"没有 navigator",门就会替说明文字发红(守门 131 同日同型)。 */
  const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('toolsForChatRequest 必须真调 fileToolsAllowed', () => {
    const flat = src.replace(/\s+/g, ' ')
    expect(flat).toMatch(/function toolsForChatRequest[\s\S]*?fileToolsAllowed\(/)
  })

  it('文件族策略仍指向共享单源,端内不得再写第二份关键词表', () => {
    expect(src).toContain("@ihui/shared/chat/file-tool-intent'")
    expect(src).not.toMatch(/FILE_(READ|WRITE)_INTENT_RE\s*=\s*\//)
  })

  it('探测入口必须收注入门面,代码面不得直读 navigator/window 判能力', () => {
    const mod = codeOnly(readFileSync(join(HERE, '../lib/workspace-capability.ts'), 'utf8'))
    expect(mod).toContain('win: PickerCapableWindow | undefined')
    expect(mod).not.toMatch(/\bnavigator\./)
    // 唯一的隐式取源只能是 globalThis.window,而且必须是默认参数(注入优先)
    expect(mod).toMatch(/globalThis[\s\S]{0,120}window/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
