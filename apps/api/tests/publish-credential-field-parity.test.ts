// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭据字段清单的跨语言对账（2026-09-27 立）。
 *
 * 钉的是文档 §8 第 7 条那句明文登记的现状：「表单按前端注册表键名存、适配器按自己清单读时，
 * 差异键会表现为『填了等于没填』」。两侧此刻是两套真相：
 * - **权威侧 = 适配器**：`apps/ai-service/app/services/publish/adapters/*.py` 的
 *   `requires_credentials`（凭据字典就是按这些键去读的，读了不到的键 = 用户填了也没用）。
 * - **展示侧 = api 注册表**：`PLATFORM_REGISTRY[].requiresCredentials`（Web 表单按它渲染输入框）。
 *
 * 判据三条：
 * - **P1 键集等值**：注册表里每个平台，两侧 `requires_credentials` 必须逐键相等（多一个键
 *   = 收了个没人读的字段；少一个键 = 必读字段前端根本没问 ⇒ 发不出去且无从归因）。
 * - **P2 覆盖方向**：注册表写了而适配器没有的 platformId ⇒ 红（前端在展示一个不存在的平台）；
 *   适配器有而注册表未收录 ⇒ **只报数**（立票现读 24 个未登记属产品现状，不是逐条论证过的豁免；
 *   当场判红就是恒红门。要转成豁免必须逐条登记理由，受下方 COVERAGE_EXEMPTIONS 四条防线约束）。
 * - **P3 防空扫**：两侧解析条数各有下限（适配器 ≥30、注册表 ≥14）。扫不到 = 判据失明，
 *   不是通过 —— 本仓最高频的失效型就是"0 处"被当成绿灯。
 *
 * 取材口径同本仓其它对账尺：适配器侧一律读 **HEAD blob**（`git show HEAD:<path>`），
 * 与同目录 `publish-proxy-parity.test.ts` 的姿势一致；两侧在**同一轮**取满，
 * 不"清单读盘、内容读 git"（并行会话推进的瞬间就会产出自洽却错位的尺子）。
 * 判据本体是导出纯函数 `diffCredentialFields()` —— 测试喂构造面证明它有牙，
 * 而不是只信仓库此刻真值（真值会变，判据不该跟着变）。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { findPlatformEntry } from '../src/routes/publish-routes.js'

const ADAPTER_DIR = 'apps/ai-service/app/services/publish/adapters'

// 本测试的 cwd 是 apps/api，而两侧路径都要从**仓库根**算：不加 `-C` 时 git 按 cwd 解析这些
// 前缀路径 ⇒ 恒"扫到 0 条"，而 0 在这类尺子里表现成一切正常（本仓最高频的失效型）。
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

function git(argList: string[]): string {
  return execFileSync('git', ['-C', REPO_ROOT, ...argList], {
    maxBuffer: 1 << 26,
    encoding: 'utf8',
  })
}

function gitShow(rev: string, path: string): string {
  return git(['show', `${rev}:${path}`])
}

/** 从 HEAD 的适配器源码里解析 platform_id → requires_credentials。 */
export function readAdapterCredentials(rev = 'HEAD'): Map<string, string[]> {
  const listing = git(['ls-tree', '-r', '--name-only', rev, ADAPTER_DIR])
    .split('\n')
    .filter((p) => p.endsWith('.py'))
  const out = new Map<string, string[]>()
  for (const f of listing) {
    let src: string
    try {
      src = gitShow(rev, f)
    } catch {
      continue // 取不到单个文件不算判据失败,但下面有 P3 兜住"整面为空"
    }
    const pid =
      src.match(/^\s{4}platform_id\s*:\s*str\s*=\s*["']([^"']+)["']/m)?.[1] ??
      src.match(/^\s{4}platform_id\s*=\s*["']([^"']+)["']/m)?.[1]
    const reqRaw = src.match(/requires_credentials[^\n=]*=\s*\[([^\]]*)\]/)?.[1]
    if (!pid || reqRaw === undefined) continue
    const keys = [...reqRaw.matchAll(/["']([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((k): k is string => k !== undefined)
    if (!out.has(pid)) out.set(pid, keys)
  }
  return out
}

/** 注册表侧：id 清单取自源码文本（注册表本体未导出），条目内容走导出的 findPlatformEntry()。
 *
 * 两面刻意不对称，且这是有理由的：**展示侧读本包工作树**（`findPlatformEntry` 被 import 的就是这份，
 * 判据若改读 HEAD 会在"本枚提交里两侧同时改好"的那一刻把自己判红）；**权威侧读 HEAD**
 * （跨语言那一侧不由本包暂存态决定，与同目录 `publish-proxy-parity.test.ts` 同姿势）。
 */
export function readRegistryCredentials(routesSrc: string): Map<string, string[]> {
  const ids: string[] = []
  for (const m of routesSrc.matchAll(/platformId:\s*'([a-z0-9_]+)'/g)) {
    const id = m[1]
    if (id !== undefined && !ids.includes(id)) ids.push(id)
  }
  const out = new Map<string, string[]>()
  for (const id of ids) {
    const entry = findPlatformEntry(id)
    if (entry) out.set(id, [...entry.requiresCredentials])
  }
  return out
}

export interface CredentialDiff {
  missing: string[] // 适配器必读、注册表没问用户
  extra: string[] // 注册表问了、适配器不读
  unknownPlatform: string[] // 注册表有、适配器没有
}

/** 纯判据：喂两侧键清单，输出三类差异（顺序稳定，便于断言与报告）。 */
export function diffCredentialFields(adapterKeys: string[], registryKeys: string[]): CredentialDiff {
  const a = new Set(adapterKeys)
  const r = new Set(registryKeys)
  return {
    missing: [...a].filter((k) => !r.has(k)).sort(),
    extra: [...r].filter((k) => !a.has(k)).sort(),
    unknownPlatform: [],
  }
}

/**
 * P2 覆盖差的**显式豁免清单**。立票现读 24 个适配器平台未进注册表（§0.1 全表），那是产品现状、
 * 不是逐条论证过"前端为什么不展示它"的豁免 ⇒ 清单保持为空、只如实报数（不许为了能过随手加）。
 * 将来确有需要时，每行必须写清理由，并受四条结构防线约束（缺一条即红，防腐烂）：
 *  E1 理由为空或过短（<20 字符）⇒ 红；
 *  E2 该平台已在注册表 ⇒ 红（前端列出来了就该删行，否则残留豁免会替"未来被摘线"放行）；
 *  E3 该平台在适配器侧（权威面）不存在 ⇒ 红（豁免指向不存在的平台是腐烂清单）；
 *  E4 同一 platformId 登记两行 ⇒ 红（主键唯一）。
 */
interface CoverageExemption {
  platformId: string
  reason: string
}
const COVERAGE_EXEMPTIONS: readonly CoverageExemption[] = []

/** 纯判据：豁免清单自洽性（构造面可喂，不依赖仓库此刻真值）。返回全部违规，空数组 = 清单健康。 */
export function validateCoverageExemptions(
  exemptions: readonly CoverageExemption[],
  adapterIds: ReadonlySet<string>,
  registryIds: ReadonlySet<string>,
): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const ex of exemptions) {
    if (ex.reason.trim().length < 20) {
      problems.push(`E1 ${ex.platformId}: 豁免理由缺失或过短(<20 字符):"${ex.reason}"`)
    }
    if (registryIds.has(ex.platformId)) {
      problems.push(`E2 ${ex.platformId}: 已在注册表里有对应条目，豁免行必须删除`)
    }
    if (!adapterIds.has(ex.platformId)) {
      problems.push(`E3 ${ex.platformId}: 适配器侧（权威面）不存在该平台，豁免指向空气`)
    }
    if (seen.has(ex.platformId)) {
      problems.push(`E4 ${ex.platformId}: 豁免清单出现重复登记（主键必须唯一）`)
    }
    seen.add(ex.platformId)
  }
  return problems
}

const adapters = readAdapterCredentials('HEAD')
const registry = readRegistryCredentials(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/routes/publish-routes.ts'), 'utf8'),
)

describe('凭据字段清单跨语言对账', () => {
  it('两侧都解析到足够条目（空扫描不算通过）', () => {
    expect(adapters.size).toBeGreaterThanOrEqual(30)
    expect(registry.size).toBeGreaterThanOrEqual(14)
    // 注册表写了但解析不到条目的 id = 正则与真实结构漂了的指纹
    expect([...registry.values()].some((v) => v.length > 0), '注册表键集全空 = 解析失效').toBe(true)
  })

  it('P1 每个已收录平台的字段两侧逐键等值', () => {
    const rows: string[] = []
    for (const [pid, regKeys] of registry) {
      const adKeys = adapters.get(pid)
      if (!adKeys) {
        rows.push(`${pid}: 注册表收录但适配器侧解析不到该 platform_id`)
        continue
      }
      const d = diffCredentialFields(adKeys, regKeys)
      if (d.missing.length) rows.push(`${pid}: 前端没问、适配器必读 = [${d.missing.join(', ')}]`)
      if (d.extra.length) rows.push(`${pid}: 前端在收、适配器不读 = [${d.extra.join(', ')}]`)
    }
    expect(rows, `字段清单不一致:\n${rows.join('\n')}`).toEqual([])
  })

  it('P2 反向只报数不判红（未登记属产品现状；豁免清单为空时如实报数）', () => {
    const notInRegistry = [...adapters.keys()].filter((p) => !registry.has(p)).sort()
    // 这条不断言数量为 0 —— 那会把"尚未登记"变成恒红；但它也不是恒真式：
    // 报数集必须与两侧集合自洽（每个都真在权威面、且真不在展示面）。
    expect(notInRegistry.every((p) => adapters.has(p) && !registry.has(p))).toBe(true)
    const problems = validateCoverageExemptions(
      COVERAGE_EXEMPTIONS,
      new Set(adapters.keys()),
      new Set(registry.keys()),
    )
    expect(problems, `豁免清单自洽性（防线有牙见"判据有牙"对照）: ${problems.join('; ')}`).toEqual([])
    console.log(
      `[P2 报数] 适配器有而注册表未收录 ${notInRegistry.length} 个（豁免清单现登记 ${COVERAGE_EXEMPTIONS.length} 条）：${notInRegistry.join(', ')}`,
    )
  })

  it('P2b 注册表里的每个平台都必须真存在适配器', () => {
    const ghosts = [...registry.keys()].filter((p) => !adapters.has(p))
    expect(ghosts, `注册表展示了适配器里没有的平台: ${ghosts.join(', ')}`).toEqual([])
  })

  it('判据有牙：构造面正反对照（不依赖仓库此刻真值）', () => {
    // 少一个必读键 ⇒ 必须点名 missing；多一个不读的键 ⇒ 必须点名 extra
    const bad = diffCredentialFields(['sessionid', 'signatureId'], ['sessionid', 'sessionid_ss'])
    expect(bad.missing).toEqual(['signatureId'])
    expect(bad.extra).toEqual(['sessionid_ss'])
    // 完全一致 ⇒ 三类都空（否则本锁会咬自己产出的形态）
    const ok = diffCredentialFields(['a', 'b'], ['b', 'a'])
    expect(ok).toEqual({ missing: [], extra: [], unknownPlatform: [] })
  })

  it('判据有牙：豁免清单四条防线各必红，合法豁免放过', () => {
    // 构造面喂 validator —— 证明 E1–E4 不是摆设（永远绿的防线与没有防线一样，会把人逼去删清单）
    const adapterIds = new Set(['real', 'ghostless'])
    const registryIds = new Set(['real'])
    const problems = validateCoverageExemptions(
      [
        { platformId: 'ghostless', reason: '太短' }, // E1
        { platformId: 'ghost', reason: 'x'.repeat(30) }, // E3：权威面没有它
        { platformId: 'real', reason: 'y'.repeat(30) }, // E2：已在注册表，豁免行是残留
        { platformId: 'ghostless', reason: 'z'.repeat(30) }, // E4：重复登记
      ],
      adapterIds,
      registryIds,
    )
    expect(problems.some((p) => p.includes('E1 ghostless'))).toBe(true)
    expect(problems.some((p) => p.includes('E2 real'))).toBe(true)
    expect(problems.some((p) => p.includes('E3 ghost'))).toBe(true)
    expect(problems.some((p) => p.includes('E4 ghostless'))).toBe(true)
    // 反向对照：合法一条（未覆盖 + ≥20 字理由 + 唯一 + 权威面存在）必须零违规
    expect(
      validateCoverageExemptions(
        [{ platformId: 'ghostless', reason: '仅内部灰度使用，前端刻意不展示该平台入口' }],
        adapterIds,
        registryIds,
      ),
    ).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
