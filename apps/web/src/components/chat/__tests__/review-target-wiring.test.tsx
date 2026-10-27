// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// @vitest-environment jsdom
//
// D06 结构化代码审查 —— 审查对象选择器**装车证明 + 选择→正文映射 + 真实 diff 验收**(2026-10-27)。
//
// 这张票被回滚过一次,回滚理由原文是「review-target-selector.tsx 与 review-context.ts
// 生产面零引用(仅测试引用,头注 TODO 待挂 message-input),票面「审查对象选择器」格未装车」。
// 所以本文件的①是**挂载判据**(读被判文件剥注释后的代码面),摘掉 message-input 里那句 JSX
// 或那句 `planReviewSend(...)` 调用,①必红 —— 这是反向对照的靶心,不是"看起来有"。
//
// ②③ 是选择 → 本轮正文的逐档映射(含反向:未选/未 ready/非法 ref ⇒ 正文逐字不变);
// ④ 用**仓内真实 git diff 采样**(fixtures/real-diff-message-input.diff,由
// `git diff HEAD -- apps/web/src/components/chat/message-input.tsx` 原样落盘)验收"对真实 diff 跑一轮"
// 里可离线验证的部分:真实 diff 进 prompt/进内联块后仍带着 `文件` 与 `新文件行号` 锚点,
// 且端上按 P1 → P2 → Nit 三档分组、每条 finding 定位到 `文件:行`。
//
// **仍需真服务/E2E 的部分**(共享机禁起服务,如实标注):模型的真实产出(三档分级的质量本身)、
// SSE `review-finding` 帧的真实下发、以及点击后 CodeEditor 真正滚动到该行 —— 这三格必须有
// ai-service + 模型 key + 真浏览器才能验,本文件只钉住"链路两端与渲染判据"。

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ReviewFindingsCard,
  type ReviewFinding,
} from '@/components/chat/message-list/review-findings-card'
import { isReviewSelectionReady, toReviewSlashText } from '@/components/chat/review-context'
import { planReviewSend } from '@/components/chat/review-target-send'
import { buildReviewTargetPrompt, parseReviewTargetArgs } from '@/hooks/use-chat/slash-commands'
import { useIDEWorkspace } from '@/stores/ide-workspace'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MESSAGE_INPUT_SRC = path.resolve(HERE, '..', 'message-input.tsx')
const SELECTOR_SRC = path.resolve(HERE, '..', 'review-target-selector.tsx')
const REAL_DIFF = fs.readFileSync(
  path.resolve(HERE, 'fixtures', 'real-diff-message-input.diff'),
  'utf8',
)

/** 剥掉行注释与块注释(串字面量不剥 —— 挂载判据看的正是引号里的模块说明符)。 */
function codeFace(src: string): string {
  const out: string[] = []
  let inBlock = false
  for (const line of src.split(/\r?\n/)) {
    let text = ''
    for (let i = 0; i < line.length; i += 1) {
      const two = line.slice(i, i + 2)
      if (inBlock) {
        if (two === '*/') {
          inBlock = false
          i += 1
        }
        continue
      }
      if (two === '//') break
      if (two === '/*') {
        inBlock = true
        i += 1
        continue
      }
      text += line[i]
    }
    out.push(text)
  }
  return out.join('\n')
}

/**
 * 从**真实 diff** 取锚点(`+++ b/<path>` 给文件,`@@ -x,y +n,m @@` 给新文件行号)。
 * 这一段是测试侧对"模型该给出的锚点"的确定性替身 —— 真实模型产出的质量由 E2E 验;
 * 这里要钉的是:真实 diff 本来就带着可解析的 文件 + 行号,链路两端不会把它丢掉。
 */
function diffAnchors(diff: string): Array<{ file: string; line: number }> {
  const file = /^\+\+\+ b\/(.+)$/m.exec(diff)?.[1] ?? ''
  const anchors: Array<{ file: string; line: number }> = []
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/gm)) {
    anchors.push({ file, line: Number(m[1]) })
  }
  return anchors
}

const ANCHORS = diffAnchors(REAL_DIFF)
const REAL_FILE = 'apps/web/src/components/chat/message-input.tsx'

beforeEach(() => {
  useIDEWorkspace.setState({
    openFile: vi.fn(),
    setActiveTopTab: vi.fn(),
    revealAt: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
})

describe('D06① 装车证明:选择器与"选择→正文"判定在生产面被引用', () => {
  it('message-input 既 import 了选择器,又真的在 JSX 里挂上(摘掉即红)', () => {
    const face = codeFace(fs.readFileSync(MESSAGE_INPUT_SRC, 'utf8'))
    expect(
      /import\s*\{[^}]*\bReviewTargetSelector\b[^}]*\}\s*from\s*['"]@\/components\/chat\/review-target-selector['"]/.test(
        face,
      ),
    ).toBe(true)
    // 渲染点 + 可见性判据(生产 = review 模式)必须同在一处,缺一都不算装车
    expect(
      /<ReviewTargetSelector\b[\s\S]{0,200}?visible=\{currentMode === 'review'\}/.test(face),
    ).toBe(true)
    // 选择值必须真的上抛/回填(state 受控),不是写死的展示件
    expect(/selection=\{reviewSelection\}/.test(face)).toBe(true)
    expect(/onChange=\{setReviewSelection\}/.test(face)).toBe(true)
  })

  it('发送面真的消费选择:submit 包装里调 planReviewSend,且空正文+已选目标可发', () => {
    const face = codeFace(fs.readFileSync(MESSAGE_INPUT_SRC, 'utf8'))
    expect(/planReviewSend\(\s*base,\s*reviewSelection,\s*reviewTargetReady\s*\)/.test(face)).toBe(
      true,
    )
    expect(
      /const canSend = \(value\.trim\(\)\.length > 0 \|\| reviewTargetReady\) && refsReady/.test(
        face,
      ),
    ).toBe(true)
  })

  it('选择条渲染三类 git 目标(票面口径)+ 两档补充', () => {
    const face = codeFace(fs.readFileSync(SELECTOR_SRC, 'utf8'))
    for (const kind of ['uncommitted', 'branch', 'commit', 'file', 'snippet']) {
      expect(face, kind).toContain(`kind: '${kind}'`)
    }
  })
})

describe('D06② 选择 → 本轮正文:五档逐条', () => {
  it('票面三目标 ⇒ 降维成已落地的 slash 命令(不另跑 git)', () => {
    expect(planReviewSend('', { kind: 'uncommitted', value: null }, true)).toEqual({
      mode: 'slash',
      text: '/review uncommitted',
      restoreDraft: '',
    })
    expect(planReviewSend('', { kind: 'branch', value: 'main' }, true)).toEqual({
      mode: 'slash',
      text: '/review branch main',
      restoreDraft: '',
    })
    expect(planReviewSend('', { kind: 'commit', value: '9cb7c5a' }, true)).toEqual({
      mode: 'slash',
      text: '/review commit 9cb7c5a',
      restoreDraft: '',
    })
  })

  it('用户已输入的草稿不随命令送出,原样带回准备回填(不静默丢稿)', () => {
    const plan = planReviewSend('重点看并发', { kind: 'uncommitted', value: null }, true)
    expect(plan.mode).toBe('slash')
    expect(plan).toMatchObject({ restoreDraft: '重点看并发' })
  })

  it('file / snippet ⇒ 内联块追加到正文尾部(只影响发给 LLM 的正文)', () => {
    const snippet = planReviewSend('  ', { kind: 'snippet', value: 'const a = 1' }, true)
    expect(snippet.mode).toBe('inline')
    expect(snippet.text).toContain('pasted snippet')
    expect(snippet.text).toContain('const a = 1')

    const file = planReviewSend('看这个', { kind: 'file', value: 'src/app.ts' }, true)
    expect(file.mode).toBe('inline')
    expect(file.text.startsWith('看这个\n\n')).toBe(true)
    expect(file.text).toContain('Review the file src/app.ts below')
  })

  it('反向:未选 / 未启用 / 非法 ref ⇒ 正文逐字不变', () => {
    expect(planReviewSend('原文', null, true)).toEqual({ mode: 'plain', text: '原文' })
    expect(planReviewSend('原文', { kind: 'uncommitted', value: null }, false)).toEqual({
      mode: 'plain',
      text: '原文',
    })
    // 分支名不允许以 - 开头(防被 git 当选项);SHA 必须是十六进制
    expect(toReviewSlashText({ kind: 'branch', value: '--upload-pack=x' })).toBeNull()
    expect(toReviewSlashText({ kind: 'commit', value: 'not-a-sha' })).toBeNull()
    expect(isReviewSelectionReady({ kind: 'branch', value: '--upload-pack=x' })).toBe(false)
    expect(planReviewSend('原文', { kind: 'branch', value: '--help' }, true)).toEqual({
      mode: 'plain',
      text: '原文',
    })
  })

  it('ready 判据与 slash 文本同源:branch/commit 必须有合法值,uncommitted 即选即用', () => {
    expect(isReviewSelectionReady({ kind: 'uncommitted', value: null })).toBe(true)
    expect(isReviewSelectionReady({ kind: 'branch', value: '  ' })).toBe(false)
    expect(isReviewSelectionReady({ kind: 'branch', value: 'feature/x' })).toBe(true)
    expect(isReviewSelectionReady({ kind: 'commit', value: '9cb7c5a' })).toBe(true)
    expect(isReviewSelectionReady({ kind: 'file', value: ' ' })).toBe(false)
  })
})

describe('D06③ 真实 diff 进链路:锚点不丢、三档可分组、逐条可定位', () => {
  it('采样夹具确是真实 diff(有 +++ 文件头与多段 @@ hunk,锚点可解析)', () => {
    expect(REAL_DIFF.startsWith('diff --git ')).toBe(true)
    expect(REAL_FILE).toBe('apps/web/src/components/chat/message-input.tsx')
    expect(ANCHORS.length).toBeGreaterThanOrEqual(3)
    for (const a of ANCHORS) {
      expect(a.file).toBe(REAL_FILE)
      expect(a.line).toBeGreaterThan(0)
    }
  })

  it('该 diff 小于单轮上限 ⇒ shell 收集腿给出的是完整 diff 而非截断件', () => {
    const spec = parseReviewTargetArgs('uncommitted')
    expect(spec).not.toBeNull()
    const prompt = buildReviewTargetPrompt(spec!, REAL_DIFF)
    expect(prompt.startsWith('Review the uncommitted changes below.')).toBe(true)
    expect(prompt).toContain('Report findings with path:line anchors.')
    expect(prompt).toContain('```diff')
    // 真实 diff 的文件头与 hunk 头逐字在内(端到端"喂给编排层的就是这段改动")
    expect(prompt).toContain('+++ b/apps/web/src/components/chat/message-input.tsx')
    expect(prompt).toContain('@@ -451,11 +464,45 @@')
    expect(prompt).not.toContain('truncated at')
  })

  it('内联档同样带走真实 diff 的 anchored 内容 + 锚点指令', () => {
    const plan = planReviewSend('', { kind: 'snippet', value: REAL_DIFF }, true)
    expect(plan.mode).toBe('inline')
    expect(plan.text).toContain('Report findings with path:line anchors.')
    expect(plan.text).toContain('+++ b/apps/web/src/components/chat/message-input.tsx')
    for (const a of ANCHORS) {
      // 每条 href 的锚点都能在整段行里找到(新文件行号来自真实 hunk 头)
      expect(REAL_DIFF).toContain(`+${a.line}`)
    }
  })

  it('三档分级与逐条定位:按真实锚点喂三档 finding ⇒ 组序 P1→P2→Nit,每条 文件:行 可跳', () => {
    const findings: ReviewFinding[] = [
      {
        type: 'review-finding',
        findingId: 'rf-1',
        index: 1,
        total: 3,
        severity: 'P2',
        file: ANCHORS[1]!.file,
        line: ANCHORS[1]!.line,
        title: '选择条未受控',
        detail: '',
        suggestion: '',
      },
      {
        type: 'review-finding',
        findingId: 'rf-2',
        index: 2,
        total: 3,
        severity: 'P1',
        file: ANCHORS[0]!.file,
        line: ANCHORS[0]!.line,
        title: '发送面绕过选择',
        detail: '',
        suggestion: '',
      },
      {
        type: 'review-finding',
        findingId: 'rf-3',
        index: 3,
        total: 3,
        severity: 'Nit',
        file: ANCHORS[2]!.file,
        line: ANCHORS[2]!.line,
        title: '注释过长',
        detail: '',
        suggestion: '',
      },
    ]
    render(<ReviewFindingsCard findings={findings} />)
    const card = screen.getByTestId('review-findings-card')
    const groups = Array.from(card.querySelectorAll('section[data-severity]'))
    expect(groups.map((g) => g.getAttribute('data-severity'))).toEqual(['P1', 'P2', 'Nit'])

    // 每条 finding 的可见定位 = 文件:行,且行号就是真实 diff 里的新文件行号
    for (const f of findings) {
      const row = screen.getByTestId(`review-finding-${f.findingId}`)
      expect(row.getAttribute('aria-label')).toBe(`${REAL_FILE}:${f.line}`)
    }

    // 点击 = 既有 IDE 出口 + 揭示到行(可跳行的判据)
    fireEvent.click(screen.getByTestId('review-finding-rf-2'))
    const store = useIDEWorkspace.getState()
    expect(store.openFile).toHaveBeenCalledWith(expect.objectContaining({ path: REAL_FILE }))
    expect(store.setActiveTopTab).toHaveBeenCalledWith('editor')
    expect(store.revealAt).toHaveBeenCalledWith(REAL_FILE, ANCHORS[0]!.line, 1)
  })
})
