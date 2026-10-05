// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998157:扫描条目复合键(ScanItem.key)构造/解析成对导出的靶心测试。
 *
 * 三段断言:
 * 1) 成对往返:对一批样本 x,parse(build(x)) === x(拼与拆是同一个协议,不是两处约定);
 * 2) 四条反例写死:空段 / 无冒号 / 段数超 / 未知前缀 一律 null(绝不空串、绝不 'x');
 * 3) 调用侧已切到这一对:github-client 走 build、orchestrator 走 parse。
 */
import { describe, it, expect } from 'vitest'

import {
  buildScanItemKey,
  parseScanItemKey,
  SCAN_ITEM_KEY_SOURCES,
  SCAN_ITEM_KEY_FORMAT,
  branchNameFor,
  createGitHubClient,
  type FetchLike,
  type ScanItem,
  type ScanSource,
} from '../src/services/automations/index.js'

// ---------------------------------------------------------------------------
// 1) 成对往返
// ---------------------------------------------------------------------------

const SAMPLES: Array<{ source: ScanSource; seq: number }> = [
  { source: 'issue', seq: 1 },
  { source: 'issue', seq: 42 },
  { source: 'issue', seq: 999999 },
  { source: 'code-scanning', seq: 3 },
  { source: 'code-scanning', seq: 45 },
  { source: 'workflow-run', seq: 6789 },
  { source: 'workflow-run', seq: 100 },
  // workflow-run 段位:run id 可能远超安全整数 —— 键按字符串原样往返,不被数值化截断
  { source: 'workflow-run', seq: 9007199254740993 },
]

describe('G-998157 复合键构造/解析成对往返', () => {
  it('parse(build(x)) === x —— 一批样本逐条断言', () => {
    for (const s of SAMPLES) {
      const key = buildScanItemKey(s.source, s.seq)
      expect(key).toBe(`${s.source}:${s.seq}`)
      const parsed = parseScanItemKey(key)
      expect(parsed, `样本 ${key} 必须能解回`).not.toBeNull()
      expect(parsed).toEqual({ source: s.source, seq: String(s.seq) })
    }
  })

  it('字符串序号入参同样往返(build 不做数值化,避免大 id 精度丢失)', () => {
    const key = buildScanItemKey('workflow-run', '9007199254740993')
    expect(parseScanItemKey(key)).toEqual({ source: 'workflow-run', seq: '9007199254740993' })
  })

  it('前缀全集与 ScanSource 一致,SCAN_ITEM_KEY_FORMAT 描述的三源对得上', () => {
    expect([...SCAN_ITEM_KEY_SOURCES]).toEqual(['issue', 'code-scanning', 'workflow-run'])
    for (const source of SCAN_ITEM_KEY_SOURCES) {
      expect(SCAN_ITEM_KEY_FORMAT).toContain(source)
      // 文档里写的格式必须真的能拼出合法键 —— 文档与实现不得各说一套
      expect(parseScanItemKey(buildScanItemKey(source, 7))).toEqual({ source, seq: '7' })
    }
  })
})

// ---------------------------------------------------------------------------
// 2) 反例断言(靶心):四种坏键一律 null
// ---------------------------------------------------------------------------

describe('G-998157 坏键必须显式失败(parse 返回 null,不给占位符)', () => {
  it('反例1 空段:"issue:" ⇒ null', () => {
    expect(parseScanItemKey('issue:')).toBeNull()
  })

  it('反例2 无冒号:"issue" ⇒ null', () => {
    expect(parseScanItemKey('issue')).toBeNull()
  })

  it('反例3 段数超:"a:b:c" ⇒ null', () => {
    expect(parseScanItemKey('a:b:c')).toBeNull()
  })

  it('反例4 未知前缀:"foo:1" ⇒ null', () => {
    expect(parseScanItemKey('foo:1')).toBeNull()
  })

  it("四条反例逐条钉死返回值是严格 null(绝不为空串、绝不 'x')", () => {
    const bad: Array<[string, string]> = [
      ['空段', 'issue:'],
      ['无冒号', 'issue'],
      ['段数超', 'a:b:c'],
      ['未知前缀', 'foo:1'],
    ]
    for (const [label, key] of bad) {
      const got = parseScanItemKey(key)
      expect(got, `${label} ⇒ ${key} 必须为 null`).toBeNull()
      expect(got === null, `${label} 必须是严格 null`).toBe(true)
    }
  })

  it('邻接坏形态一并拒掉(段数超的其余形态 / 空串 / 空白序号 / 非数字序号)', () => {
    expect(parseScanItemKey('')).toBeNull()
    expect(parseScanItemKey(':')).toBeNull()
    expect(parseScanItemKey('issue:1:')).toBeNull()
    expect(parseScanItemKey('issue::1')).toBeNull()
    expect(parseScanItemKey('issue: 1')).toBeNull()
    expect(parseScanItemKey('issue:abc')).toBeNull()
    expect(parseScanItemKey('issue:1.5')).toBeNull()
    expect(parseScanItemKey('Issue:1')).toBeNull() // 前缀大小写敏感
    expect(parseScanItemKey('issue :1')).toBeNull()
  })

  it('构造侧对称地把坏序号挡在写入点之前(抛错,而不是拼出坏键)', () => {
    expect(() => buildScanItemKey('issue', '')).toThrow()
    expect(() => buildScanItemKey('issue', 'abc')).toThrow()
    expect(() => buildScanItemKey('issue', '1:2')).toThrow()
    expect(() => buildScanItemKey('issue', Number.NaN)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// 3) 调用侧已切到这一对(拼与拆不再各写各的)
// ---------------------------------------------------------------------------

function item(key: string, source: ScanSource = 'issue'): ScanItem {
  return { key, source, title: 't', detail: 'd', url: null, issueNumber: null }
}

const NOW = new Date('2026-10-05T01:02:03.000Z')
const STAMP = '20261005010203'

describe('G-998157 调用侧已统一到协议层', () => {
  it('orchestrator.branchNameFor 用解析结果取序号', () => {
    expect(branchNameFor(item('issue:42'), NOW)).toBe(`automations/fix-issue-42-${STAMP}`)
    expect(branchNameFor(item('code-scanning:45', 'code-scanning'), NOW)).toBe(
      `automations/fix-code-scanning-45-${STAMP}`,
    )
    expect(branchNameFor(item('workflow-run:6789', 'workflow-run'), NOW)).toBe(
      `automations/fix-workflow-run-6789-${STAMP}`,
    )
  })

  it('键坏时 branchNameFor 显式抛错(旧形态会静默生成 ...-x- 分支名,两个坏键撞同名)', () => {
    for (const bad of ['issue:', 'issue', 'a:b:c', 'foo:1']) {
      expect(() => branchNameFor(item(bad), NOW)).toThrow()
    }
  })

  it('github-client 三源产物都能被 parse 收回(拼侧与拆侧同源)', async () => {
    const rows = [
      JSON.stringify([{ number: 11, title: 'boom' }]),
      JSON.stringify([{ number: 22, rule: { id: 'r1' } }]),
      JSON.stringify({ workflow_runs: [{ id: 33, name: 'ci' }] }),
    ]
    let i = 0
    const transport: FetchLike = async () => {
      const body = rows[i++] ?? '[]'
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const gh = createGitHubClient({ pat: 'x', repo: 'o/r', transport })

    const issues = await gh.scanIssues('bug')
    const alerts = await gh.scanCodeScanningAlerts()
    const runs = await gh.scanFailedRuns(5)

    expect(parseScanItemKey(issues[0]!.key)).toEqual({ source: 'issue', seq: '11' })
    expect(parseScanItemKey(alerts[0]!.key)).toEqual({ source: 'code-scanning', seq: '22' })
    expect(parseScanItemKey(runs[0]!.key)).toEqual({ source: 'workflow-run', seq: '33' })
  })
})
