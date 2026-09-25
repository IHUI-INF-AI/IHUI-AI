// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * danger-gate「唯一出口」接线对账 —— 钉的是"只有一个出口"这件事本身。
 *
 * 判据不是清单而是**棘轮**:对 apps/cli/src/** 每个文件统计"在调用方就地决定危险放行"
 * 的形态数,锚点 = 该文件在 **HEAD 里自身的违规数**,只拦"把旁路加回来/新增一处",
 * 不拦已登记的存量(实测:本票落地后 commands/agent.ts 仍留 1 处,由另一会话在飞,
 * 待其落地后另票收口;commands/config-cmd.ts 的 1 处是 settings getter 形态,
 * 与危险放行无关但两侧对称计数,不误红也不洗账)。
 *
 * 两种形态都必须覆盖(本仓老课:"门让你怎么写、门就看不见怎么写"):
 *  - 形态① if (…allowDangerous…) … return true —— flag 短路(agent.ts / 旧 acp / 旧 repl)
 *  - 形态② 不带 if 的表达式直返 —— `async () => x.allowDangerous === true`
 *    (旧 agent-core 与旧 subagent 就是这个形态;只写①的尺子对它们全盲)
 *
 * HEAD 内容一律经 `git show HEAD:<path>` 取,不按磁盘读(共享工作区滞后 HEAD);
 * 取不到时区分"路径不在 HEAD(新文件)"与"git 瞬态失败",后者大声判死,绝不静默当 0。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const cliRoot = path.resolve(here, '..')
const repoRoot = path.resolve(cliRoot, '..', '..')
const srcRoot = path.join(cliRoot, 'src')

/** 唯一策略出口自身必然出现策略形态,不参与"调用方就地旁路"计数 */
const GATE_REL = 'tools/danger-gate.ts'

/** 形态①:调用方 if 短路直返 true */
const FORM_IF = /\bif\s*\([^()]*\ballowDangerous\b[^()]*\)[\s\S]{0,200}?\breturn\s+true\b/g
/** 形态②:=> / return 之后同一语句片段内引用 allowDangerous(不带 === true 的裸直返也算) */
const FORM_EXPR = /(?:=>|\breturn\b(?![\w$]))[^\n;{]{0,80}?\ballowDangerous\b/g

/** 就地旁路计数(纯函数,正/反对照直接喂合成字符串测它) */
function countInlineDecisions(text: string): number {
  let n = 0
  for (const re of [FORM_IF, FORM_EXPR]) n += Array.from(text.matchAll(re)).length
  return n
}

const git = (args: string[]): string =>
  execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: repoRoot,
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** HEAD 面内容;'' = 该路径确不在 HEAD(新文件),git 真失败则抛(不静默当 0) */
function headOf(relPosix: string): string {
  try {
    return git(['show', `HEAD:${relPosix}`])
  } catch (showErr) {
    const ever = git(['log', '-1', '--format=%H', '--', relPosix]).trim()
    if (!ever) return ''
    throw new Error(`HEAD 取材失败(非"新文件"): ${relPosix}: ${String(showErr)}`)
  }
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (/^(tests?|__tests__)$/.test(e.name)) continue
      walkTs(abs, out)
    } else if (e.isFile() && e.name.endsWith('.ts')) {
      out.push(abs)
    }
  }
  return out
}

const MIGRATED = [
  'acp/server.ts',
  'server/agent-core.ts',
  'commands/repl.ts',
  'tools/subagent.ts',
] as const

const allFiles = walkTs(srcRoot).map((abs) => ({
  abs,
  rel: path.relative(repoRoot, abs).split(path.sep).join('/'),
  relCli: path.relative(srcRoot, abs).split(path.sep).join('/'),
}))

describe('W1 棘轮:任何 src 文件的就地旁路数不得多于该文件自身在 HEAD 的存量', () => {
  it('逐文件 worktree ≤ HEAD(锚点是 HEAD blob,不是磁盘清单;不拦存量、只拦加回来)', () => {
    const offenders: string[] = []
    const remaining: string[] = []
    for (const f of allFiles) {
      if (f.relCli === GATE_REL) continue
      const work = countInlineDecisions(readFileSync(f.abs, 'utf-8'))
      const head = countInlineDecisions(headOf(f.rel))
      if (work > 0) remaining.push(`${f.relCli}=${work}`)
      if (work > head) {
        offenders.push(`${f.relCli}: HEAD=${head} 工作树=${work}(危险放行策略只能经 createDangerGate 唯一出口,不得在调用方就地决定)`)
      }
    }
    // 现值如实喊出来(供交付报告核对):本票落地后应只剩 agent.ts 与 config-cmd.ts 各 1
    console.info(`[danger-gate-wiring] 就地旁路现值: ${remaining.join(', ') || '(全零)'}`)
    expect(offenders).toEqual([])
  })
})

describe('W2 装车证明:四个已迁移调用方真的走唯一出口', () => {
  it('danger-gate.ts 在位且导出 createDangerGate', () => {
    const src = readFileSync(path.join(srcRoot, 'tools', 'danger-gate.ts'), 'utf-8')
    expect(src).toMatch(/export function createDangerGate\s*\(/)
  })

  for (const rel of MIGRATED) {
    it(`${rel}: import 唯一出口 + 真调用 + 就地旁路归零`, () => {
      const src = readFileSync(path.join(srcRoot, rel), 'utf-8')
      expect(src).toMatch(/import\s*\{[^}]*createDangerGate[^}]*\}\s*from\s*'[^']*danger-gate\.js'/)
      expect(src).toMatch(/createDangerGate\s*\(\s*\{/)
      expect(countInlineDecisions(src)).toBe(0)
    })
  }
})

describe('W3 阳性对照:两种旁路形态必须都被同一把尺子抓到', () => {
  const formA = 'async (tool, args) => {\n  if (this.opts.allowDangerous) return true;\n  return false;\n}'
  const formB = 'const isAllowed = async () => parentOpts.allowDangerous === true'
  const formBare = 'register({ confirmDangerous: async () => opts.allowDangerous })'

  it('形态①(if 短路)被计数', () => {
    expect(countInlineDecisions(formA)).toBeGreaterThanOrEqual(1)
  })

  it('形态②(表达式直返)被计数 —— 只写形态①的尺子在这里失明', () => {
    expect(countInlineDecisions(formB)).toBeGreaterThanOrEqual(1)
    expect(countInlineDecisions(formBare)).toBeGreaterThanOrEqual(1)
    // 且证明两臂确实互补:formB 不含任何 if(…,故形态①单独对它必然判 0
    const IF_ONLY = new RegExp(FORM_IF.source)
    expect(IF_ONLY.test(formB)).toBe(false)
  })
})

describe('W4 反向对照:唯一出口的正当写法不得被误报', () => {
  it('createDangerGate 注入 prompt / 传播 allowDangerous 都不计数', () => {
    const sanctioned = [
      "const gate = createDangerGate({",
      '  allowDangerous: state.opts.allowDangerous,',
      '  silent: true,',
      '  prompt: async (tool, args) => {',
      '    return await askEditor(tool, args)',
      '  },',
      "  onDecision: ({ route, tool }) => {",
      "    if (route === 'flag') console.info('auto-allowed: ' + tool.name)",
      '  },',
      '})',
      'subagentParent: { modelId, allowDangerous: parentOpts.allowDangerous }',
    ].join('\n')
    expect(countInlineDecisions(sanctioned)).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
