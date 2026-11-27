// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具面经济学：把"延迟装载策略省了多少"量成字节，并钉成棘轮。
 *
 * 立因:`defer-policy.ts` 的 23 条模式每条都写了理由，但**没有人量过收益**。没有读数
 * 的策略有两个失效方向都不会被发现:
 *   ① 该延的没延(前缀被低频族撑爆，每轮都在为不用的工具付 token);
 *   ② 延过头(高频族被延，每任务多几次 tool_search 往返，往返本身也要 token)。
 *
 * 本用例只测**静态面字节**(全常驻 vs 默认切分的 schema + 目录)，不测真实模型的缓存
 * 命中与往返次数——那需要带模型的 eval harness，这里不做假。所以断言只钉"结构不变量"
 * 与"尺子本身可信"，不钉绝对节省比例(比例会随工具数变化，钉死会变成假红源)。
 *
 * 读法:`npm test -- tool-surface-economics` 的输出里有 `[tool-surface]` 一行，
 * 就是当前的全常驻字节 / 默认面字节 / 延迟枚数 / 节省比例。
 *
 * **口径边界(必须说清)**：本用例注册的是 `setupAgentTools` 里**无条件**的 16 个族
 * (实测 102 枚)。条件族(HR / RELAY / API 桥 / AI 桥 / clipboard / PTC run_code 等)
 * 要 auth、settings、env 才会注册，这里不假装覆盖它们;所以 102 ≠ 全量 129，读数只代表
 * "常规会话的工具面"。要量全量面，得在真实 setup 路径下测(带环境的 eval harness 才做得到)。
 */
import { describe, expect, it } from 'vitest'

// 必须先触发 index.js 完整加载(tools/index ↔ lsp 循环依赖，见 tool-family 用例头注)。
import '../src/tools/index.js'
import { listTools, registerTools } from '../src/tools/index.js'
import { buildToolSurface, renderToolSchema } from '../src/tools/tool-surface.js'
import { BUILTIN_TOOLS } from '../src/tools/builtins.js'
import { GIT_TOOLS } from '../src/tools/git.js'
import { GIT_ADVANCED_TOOLS } from '../src/tools/git-advanced.js'
import { GITHUB_PR_TOOLS } from '../src/tools/github-pr.js'
import { FETCH_TOOLS } from '../src/tools/fetch-url.js'
import { WEB_SEARCH_TOOLS } from '../src/tools/web-search.js'
import { TEST_TOOLS } from '../src/tools/run-tests.js'
import { DIAGNOSTIC_TOOLS } from '../src/tools/diagnostics.js'
import { DEBUG_TOOLS } from '../src/tools/debug.js'
import { CODEGRAPH_TOOLS } from '../src/tools/codegraph.js'
import { SKILL_TOOLS } from '../src/tools/skill-tool.js'
import { LSP_TOOLS } from '../src/tools/lsp.js'
import { MEMORY_TOOLS } from '../src/tools/memory.js'
import { BROWSER_TOOLS } from '../src/tools/browser.js'
import { BROWSER_PAGE_TOOLS } from '../src/tools/browser-page.js'
import { WORKTREE_TOOLS } from '../src/tools/worktree.js'

/** 与 `commands/agent.ts::setupAgentTools` 同一批族(顺序也一致，便于对照)。 */
const FAMILIES = [
  BUILTIN_TOOLS,
  GIT_TOOLS,
  GIT_ADVANCED_TOOLS,
  GITHUB_PR_TOOLS,
  FETCH_TOOLS,
  WEB_SEARCH_TOOLS,
  TEST_TOOLS,
  DIAGNOSTIC_TOOLS,
  DEBUG_TOOLS,
  CODEGRAPH_TOOLS,
  SKILL_TOOLS,
  LSP_TOOLS,
  MEMORY_TOOLS,
  BROWSER_TOOLS,
  BROWSER_PAGE_TOOLS,
  WORKTREE_TOOLS,
]

/** 一次把全部族注册进空表，得到"真实工具面"的快照。 */
function snapshotRegistry() {
  registerTools(FAMILIES.flat())
  return listTools()
}

interface SurfaceBytes {
  all: number
  defaultFace: number
  catalogue: number
  resident: number
  deferred: number
  residentSchema: number
}

/** 量一次面:全常驻字节 vs 默认切分(常驻 schema + 延迟目录)。 */
function measure(): SurfaceBytes {
  const tools = snapshotRegistry()
  const allRevealed = buildToolSurface(tools, { revealed: new Set(tools.map((t) => t.name)) })
  const defaultFace = buildToolSurface(tools, { revealed: new Set<string>() })
  const all = allRevealed.promptTools.reduce((n, t) => n + renderToolSchema(t).length, 0)
  const residentSchema = defaultFace.promptTools.reduce((n, t) => n + renderToolSchema(t).length, 0)
  return {
    all,
    defaultFace: residentSchema + defaultFace.catalogueText.length,
    catalogue: defaultFace.catalogueText.length,
    resident: defaultFace.promptTools.length,
    deferred: defaultFace.deferred.length,
    residentSchema,
  }
}

describe('工具面经济学(静态字节)', () => {
  it('默认切分必须真的比全常驻小，且节省部分不是靠丢描述换来的', () => {
    const m = measure()
    // 枚举到 0 不算通过:一个工具都没有时下面每条断言都会"成立"。
    expect(m.resident).toBeGreaterThan(20)
    expect(m.deferred).toBeGreaterThan(0)
    expect(m.all).toBeGreaterThan(0)
    // 常驻面 = 常驻 schema + 延迟目录;它必须显著小于全常驻。
    expect(m.defaultFace).toBeLessThan(m.all)
    // 延迟目录只承担"要不要检索"的判断 ⇒ 它应当远小于被延掉的 schema 体量。
    expect(m.catalogue).toBeLessThan(m.all - m.residentSchema)
    // 被延掉的体量要"值得延":至少占全量的一成(低于一成说明模式表基本没命中)。
    const deferredBytes = m.all - m.residentSchema
    expect(deferredBytes / m.all).toBeGreaterThan(0.1)
    // 输出可读读数(测试里打印，供人核对;断言不依赖它)。
    const pct = (n: number) => `${((n / m.all) * 100).toFixed(1)}%`
    console.log(
      `[tool-surface] 全常驻 ${m.all}B / 默认面 ${m.defaultFace}B(${pct(m.defaultFace)})·` +
        `常驻 ${m.resident} 枚 / 延迟 ${m.deferred} 枚(共 ${m.resident + m.deferred} 枚,16 个无条件族)/ ` +
        `目录 ${m.catalogue}B / 延迟体量 ${pct(deferredBytes)}`,
    )
  })

  it('dangerous 级工具一律常驻(不允许"先检索再确认"把确认时机推后)', () => {
    const tools = snapshotRegistry()
    const face = buildToolSurface(tools, { revealed: new Set<string>() })
    const dangerous = tools.filter((t) => t.dangerLevel === 'dangerous')
    expect(dangerous.length).toBeGreaterThan(0)
    const deferredDangerous = face.deferred.filter((t) => t.dangerLevel === 'dangerous')
    expect(deferredDangerous.map((t) => t.name)).toEqual([])
  })

  it('tool_search 永远常驻(它是延迟目录的唯一开口)', () => {
    const tools = snapshotRegistry()
    const face = buildToolSurface(tools, { revealed: new Set<string>() })
    const names = face.promptTools.map((t) => t.name)
    if (tools.some((t) => t.name === 'tool_search')) {
      expect(names).toContain('tool_search')
    }
  })

  it('已揭示的工具回到常驻面(检索过一次就不再延迟)', () => {
    const tools = snapshotRegistry()
    const face = buildToolSurface(tools, { revealed: new Set<string>() })
    const firstDeferred = face.deferred[0]
    expect(firstDeferred).toBeDefined()
    const revealedFace = buildToolSurface(tools, { revealed: new Set([firstDeferred.name]) })
    expect(revealedFace.promptTools.map((t) => t.name)).toContain(firstDeferred.name)
    expect(revealedFace.deferred.map((t) => t.name)).not.toContain(firstDeferred.name)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
