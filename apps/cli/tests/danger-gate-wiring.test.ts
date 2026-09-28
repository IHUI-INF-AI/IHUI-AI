// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * danger-gate「唯一出口」接线对账 —— 钉的是"只有一个出口"这件事本身。
 *
 * 判据不是清单而是**棘轮**:对 apps/cli/src/** 每个文件统计"在调用方就地决定危险放行"
 * 的形态数,锚点 = 该文件在 **HEAD 里自身的违规数**,只拦"把旁路加回来/新增一处",
 * 不拦已登记的存量(commands/agent.ts 的 1 处存量已由 2026-09-25 L7905 收口票迁到
 * 唯一出口,见 W2/W5;commands/config-cmd.ts 的 1 处是 settings getter 形态,
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
  'commands/agent.ts',
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
    // 现值如实喊出来(供交付报告核对):L7905 收口后应只剩 config-cmd.ts 的 settings getter 1 处
    console.info(`[danger-gate-wiring] 就地旁路现值: ${remaining.join(', ') || '(全零)'}`)
    expect(offenders).toEqual([])
  }, 180_000) // 逐文件起一次 git show(src 全量数百次进程 spawn),单跑实测 35s,并行下更慢;
  // 棘轮断言本身一字未动,抬的只是进程型测试的时间预算
})

describe('W2 装车证明:四个已迁移调用方真的走唯一出口', () => {
  it('danger-gate.ts 在位且导出 createDangerGate', () => {
    const src = readFileSync(path.join(srcRoot, 'tools', 'danger-gate.ts'), 'utf-8')
    expect(src).toMatch(/export function createDangerGate\s*\(/)
  })

  // 86H 起,站点的唯一构造方式换成"带审计的包装器 createAuditedDangerGate"
  // (commands/agent.ts 再包一层 buildAgentDangerGate,是为了让"silent 只关提示不关落链"
  // 这条能被行为断言钉,而不是被文本顺序钉)。这**不是放宽**:策略出口仍是 createDangerGate,
  // 且包装器必须真调它 —— 由下面那条独立断言钉住;站点直连策略出口则当场红。
  for (const rel of MIGRATED) {
    it(`${rel}: 经带审计的包装器构造(不得直连策略出口)+ 就地旁路归零`, () => {
      const src = readFileSync(path.join(srcRoot, rel), 'utf-8')
      expect(src).toMatch(
        /import\s*\{[^}]*createAuditedDangerGate[^}]*\}\s*from\s*'[^']*danger-gate-audit\.js'/,
      )
      if (rel === 'commands/agent.ts') {
        expect(src).toMatch(/confirmDangerous:\s*buildAgentDangerGate\(\s*\{/)
        expect(src).toMatch(/createAuditedDangerGate\s*\(\s*\{/)
      } else {
        expect(src).toMatch(/confirmDangerous:\s*createAuditedDangerGate\(\s*\{/)
      }
      // 站点绕开包装器 = 决策静默不落链(86H 要终结的那一型),反向钉住
      expect(src).not.toMatch(/createDangerGate\s*\(/)
      expect(countInlineDecisions(src)).toBe(0)
    })
  }

  it('包装器必须把策略原样委托给 createDangerGate 并落链(出口可以被包,不能被换掉)', () => {
    const src = readFileSync(path.join(srcRoot, 'tools', 'danger-gate-audit.ts'), 'utf-8')
    expect(src).toMatch(/export function createAuditedDangerGate\s*\(/)
    expect(src).toMatch(/createDangerGate\s*\(\s*\{/)
    expect(src).toMatch(/reportToolApprovalDecisionToAudit\(/)
  })
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

describe('W5 L7905 收口:会话级 flag 随 ctx 下发,工具层披露可追溯', () => {
  it('commands/agent.ts: setupAgentTools 的 ctx 携带 allowDangerous,且就地旁路归零', () => {
    const src = readFileSync(path.join(srcRoot, 'commands', 'agent.ts'), 'utf-8')
    expect(src).toMatch(/const ctx: ToolContext = \{[\s\S]{0,300}?allowDangerous: opts\.allowDangerous,/)
    // 86H:构造方式换成带审计的包装器(判据本体"必须经唯一出口"一字未松,见 W2 的同名改造)
    expect(src).toMatch(/createAuditedDangerGate\s*\(\s*\{/)
    expect(countInlineDecisions(src)).toBe(0)
  })

  it('server/agent-core.ts: setupAgentTools 调用携带 allowDangerous(与 gate 同源)', () => {
    const src = readFileSync(path.join(srcRoot, 'server', 'agent-core.ts'), 'utf-8')
    expect(src).toMatch(
      /setupAgentTools\(\{[\s\S]{0,400}?allowDangerous: this\.opts\.allowDangerous,[\s\S]{0,400}?confirmDangerous: createAuditedDangerGate\(/,
    )
  })

  it('tools/subagent.ts: 子代理 ctx 同样携带(与 gate 的 flag 继承同源)', () => {
    const src = readFileSync(path.join(srcRoot, 'tools', 'subagent.ts'), 'utf-8')
    expect(src).toMatch(/allowDangerous: parentOpts\.allowDangerous,/)
  })
})
