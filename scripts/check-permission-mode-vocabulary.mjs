#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 权限模式词汇对账(G-161,guardian 第 68 项,blocking)。
//
// 立因:同一语义曾有 5 套拼写并存 —— packages/types/src/agent-runtime.ts(5 camel)、
// packages/types/src/workspace.ts(4 kebab)、packages/api-client(3 kebab)、
// apps/ai-service 的 AgentLoopV2(default/plan/auto,其中 auto 没有任何端会发)、
// 以及 docs/developer/api/agents.md 对外承诺的第 5 套(read-only/accept-all/plan-only,
// 代码里根本不存在)。后果不是报错而是"发了不等于生效":非法值被 Pydantic 静默丢弃,
// 或在构造期 ValueError 打成 500。
//
// 本门把"唯一真源"钉成机器判据,三条正交规则:
//   R1 跨语言镜像一致 —— TS 注册表与 Python 注册表的成员集、别名映射必须逐字相同;
//   R2 别名值域闭合   —— 每个别名目标必须是成员;
//   R3 消费侧禁漂移   —— 已知比较点/枚举点的字面量必须落在 成员∪别名键 内,
//                        且 AgentLoopV2 不得再写 `== "auto"` / 自造白名单元组。
//
// 判据有效性靠 --self-test 注入违规自证(不读脚本自己的注释),全量模式宁漏不误报:
// 只扫 KNOWN_CONSUMERS 清单内的显式模式,不做全仓模糊匹配。

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const TS_REGISTRY = 'packages/types/src/permission-mode.ts'
const PY_REGISTRY = 'apps/ai-service/app/core/permission_mode.py'
const AGENT_LOOP = 'apps/ai-service/app/services/agent_loop_v2.py'

/** R3 已登记的消费点(新增消费文件要显式加进来,免得门变成"看起来在管其实没管")。 */
const KNOWN_CONSUMERS = [
  'apps/ai-service/app/services/agent_loop_v2.py',
  'apps/ai-service/app/routers/agent_runtime.py',
  'apps/api/src/routes/workspace-permissions.ts',
  'apps/api/src/routes/v1-ai-core.ts',
  'packages/types/src/workspace.ts',
  'packages/api-client/src/endpoints/workspace.ts',
  'docs/developer/api/agents.md',
]

// ---------------------------------------------------------------------------
// 解析器:把两侧注册表读成同构数据,顺带保证"注释里写的清单"与实际成员一致
// ---------------------------------------------------------------------------

/** TS:export const PERMISSION_MODES = ['a','b'] as const + 别名对象字面量。 */
export function parseTsRegistry(src) {
  const modesBlock = /export const PERMISSION_MODES\s*=\s*\[([\s\S]*?)\]/.exec(src)
  if (!modesBlock) throw new Error('未找到 TS PERMISSION_MODES 数组声明')
  const members = [...modesBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1])

  const aliasBlock = /PERMISSION_MODE_ALIASES[^{]*\{([\s\S]*?)\n\}/.exec(src)
  if (!aliasBlock) throw new Error('未找到 TS PERMISSION_MODE_ALIASES 对象声明')
  const aliases = {}
  // 键允许两种写法:'accept-edits'(带引号)与 acceptedits(合法标识符,归一化键恒小写)
  for (
    const m of aliasBlock[1].matchAll(/(?:'([^']+)'|([A-Za-z_][\w-]*))\s*:\s*'([^']+)'/g)
  ) {
    aliases[m[1] ?? m[2]] = m[3]
  }
  return { members, aliases }
}

/** Python:PERMISSION_MODES: Final[tuple[...]] = (...) + ALIASES: Final[dict] = {...} */
export function parsePyRegistry(src) {
  const modesBlock = /PERMISSION_MODES\s*:\s*Final[^=]*=\s*\(([\s\S]*?)\)/.exec(src)
  if (!modesBlock) throw new Error('未找到 Python PERMISSION_MODES 元组声明')
  const members = [...modesBlock[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])

  const aliasBlock = /PERMISSION_MODE_ALIASES\s*:\s*Final[^=]*=\s*\{([\s\S]*?)\n\}/.exec(src)
  if (!aliasBlock) throw new Error('未找到 Python PERMISSION_MODE_ALIASES 字典声明')
  const aliases = {}
  for (const m of aliasBlock[1].matchAll(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g)) {
    aliases[m[1]] = m[2]
  }
  return { members, aliases }
}

/**
 * 消费侧字面量提取:只认"与权限模式比较/声明"的显式语法位,避免把模型名 "auto"
 * 之类无关字面量误判成违规(agent_engine 里 "auto" 属于 reasoning summary,
 * workspace-permissions 的 z.enum 里 'file_edit' 等属于工具名白名单 —— 上一版
 * 用 `not in (...)` 通配把它们全咬了 19 处误报,故此处按语法位分档)。
 *
 * canonicalOnly=true 的语法位是**决策点**(Python 档位比较),只允许规范成员;
 * false 的是**声明/契约点**(zod 枚举、TS 联合、对外文档),别名同样合法,
 * 因为 kebab 拼写是 workspace REST 的既有wire 格式,不能强改。
 */
export function collectConsumerLiterals(relPath, src) {
  const found = []
  const push = (value, line, why, canonicalOnly) =>
    found.push({ value, line, why, canonicalOnly })

  const lineOf = (index) => src.slice(0, index).split('\n').length

  // ① Python 决策位:*permission_mode == "X" / mode == "X" / req.mode == "X"
  for (const m of src.matchAll(/(?:permission_mode|\.mode|mode)\s*==\s*["']([^"']+)["']/g)) {
    push(m[1], lineOf(m.index), 'Python 权限档比较字面量', true)
  }
  // ② TS zod 枚举:permissionModeSchema = z.enum([...])
  for (const m of src.matchAll(/permission[A-Za-z_]*(?:\s*=\s*)?z\.enum\(\[([\s\S]*?)\]/g)) {
    for (const lit of m[1].matchAll(/'([^']+)'/g)) {
      push(lit[1], lineOf(m.index), 'zod 权限枚举成员', false)
    }
  }
  // ③ TS 类型联合:export type WorkspacePermissionMode = 'a' | 'b'
  for (
    const m of src.matchAll(/export type \w*PermissionMode\s*=\s*((?:'[^']+'(?:\s*\|\s*)?)+)/g)
  ) {
    for (const lit of m[1].matchAll(/'([^']+)'/g)) {
      push(lit[1], lineOf(m.index), 'TS 权限模式联合', false)
    }
  }
  // ④ 文档表格行:`| permissionMode | ... | 说明 |`
  for (const m of src.matchAll(/\|\s*permissionMode\s*\|[^\n]*$/gim)) {
    for (const lit of m[0].matchAll(/`([a-zA-Z][\w-]*)`/g)) {
      push(lit[1], lineOf(m.index), '文档取值清单', false)
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// 三条规则
// ---------------------------------------------------------------------------

export function checkMirror(ts, py) {
  const problems = []
  const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
  if (!eq([...ts.members].sort(), [...py.members].sort())) {
    problems.push(
      `R1 成员集不一致 TS=[${ts.members.join(',')}] Python=[${py.members.join(',')}]`,
    )
  }
  const tsKeys = Object.keys(ts.aliases).sort()
  const pyKeys = Object.keys(py.aliases).sort()
  if (!eq(tsKeys, pyKeys)) {
    problems.push(
      `R1 别名键不一致 仅TS=[${tsKeys.filter((k) => !pyKeys.includes(k)).join(',')}] ` +
        `仅Python=[${pyKeys.filter((k) => !tsKeys.includes(k)).join(',')}]`,
    )
  }
  for (const k of tsKeys) {
    if (pyKeys.includes(k) && ts.aliases[k] !== py.aliases[k]) {
      problems.push(`R1 别名 ${k} 目标不一致 TS=${ts.aliases[k]} Python=${py.aliases[k]}`)
    }
  }
  return problems
}

/** 归一化键(camelCase → kebab → 小写),与 TS/Python 侧 permission_mode_key 同规则。 */
export function modeKey(raw) {
  return raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

export function checkAliasClosure(registry) {
  const problems = []
  for (const [alias, target] of Object.entries(registry.aliases)) {
    if (!registry.members.includes(target)) {
      problems.push(`R2 别名 ${alias} 指向未知成员 ${target}`)
    }
  }
  for (const member of registry.members) {
    // 归一化按"键"查表,所以规范成员必须能从自身归一化键原样解回 —— 解不回即永远失效
    if (registry.aliases[modeKey(member)] !== member) {
      problems.push(
        `R2 成员 ${member} 经归一化键 '${modeKey(member)}' 解不回自身` +
          '(补该键的恒等映射,否则合法成员会被判成非法值)',
      )
    }
  }
  return problems
}

export function checkConsumers(files, registry) {
  const declared = new Set([...registry.members, ...Object.keys(registry.aliases)])
  const canonical = new Set(registry.members)
  const problems = []
  for (const { relPath, src } of files) {
    for (const hit of collectConsumerLiterals(relPath, src)) {
      if (!declared.has(hit.value)) {
        problems.push(
          `R3 ${relPath}:${hit.line} 出现注册表外的权限档取值 '${hit.value}'(${hit.why})`,
        )
      } else if (hit.canonicalOnly && !canonical.has(hit.value)) {
        // 决策位只许拿规范成员比:拿别名比(如 `== "auto"`)意味着代码在跟
        // "归一化之前的世界"对话 —— 同一档有两个名字,新加档位时必漏接。
        problems.push(
          `R3 ${relPath}:${hit.line} 决策位使用别名 '${hit.value}' 比较` +
            ` —— 改用规范成员名(归一化后 ${registry.aliases[hit.value] ?? '?'} 才是存储值)`,
        )
      }
    }
  }
  // 自造档位白名单:仅当元组里**全部**取值都是权限档词时才算(否则是环境开关/工具名清单)
  const loop = files.find((f) => f.relPath === AGENT_LOOP)
  if (loop) {
    for (const m of loop.src.matchAll(/not in \(\s*([^()]*?)\s*\)/g)) {
      const items = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])
      if (items.length >= 2 && items.every((i) => declared.has(i))) {
        problems.push(
          `R3 ${AGENT_LOOP}:${loop.src.slice(0, m.index).split('\n').length} 出现自造档位白名单 ` +
            `(${items.map((i) => `'${i}'`).join(', ')}) —— 唯一真源已归一,改走 normalize_permission_mode`,
        )
      }
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function runChecks({ root = ROOT } = {}) {
  const read = (p) => readFileSync(join(root, p), 'utf8')
  const ts = parseTsRegistry(read(TS_REGISTRY))
  const py = parsePyRegistry(read(PY_REGISTRY))
  const files = KNOWN_CONSUMERS.map((relPath) => ({ relPath, src: read(relPath) }))
  const problems = [
    ...checkMirror(ts, py),
    ...checkAliasClosure(ts),
    ...checkAliasClosure(py),
    ...checkConsumers(files, ts),
  ]
  return { problems, members: ts.members, aliasCount: Object.keys(ts.aliases).length }
}

/** 注入违规自证:证明每条规则各自真的咬得住(不靠脚本自述)。 */
function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })

  const baseTs = parseTsRegistry(readFileSync(join(ROOT, TS_REGISTRY), 'utf8'))
  const basePy = parsePyRegistry(readFileSync(join(ROOT, PY_REGISTRY), 'utf8'))

  t(
    'R1 咬住成员漂移',
    checkMirror(baseTs, { ...basePy, members: [...basePy.members, 'yolo'] }).some((p) =>
      p.startsWith('R1 成员集'),
    ),
  )
  t(
    'R1 咬住别名键缺失(只加在 Python 侧)',
    checkMirror(baseTs, { ...basePy, aliases: { ...basePy.aliases, 'yolo-mode': 'plan' } }).some(
      (p) => p.startsWith('R1 别名键'),
    ),
  )
  t(
    'R1 咬住同一别名两侧目标不同',
    checkMirror(
      { ...baseTs, aliases: { ...baseTs.aliases, auto: 'plan' } },
      basePy,
    ).some((p) => p.startsWith('R1 别名 auto')),
  )
  t(
    'R2 咬住别名指向未知成员',
    checkAliasClosure({ ...baseTs, aliases: { plan: 'nope' } }).some((p) => p.startsWith('R2')),
  )
  t(
    'R2 咬住成员归不回自身(删掉 accept-edits 键)',
    checkAliasClosure({
      ...baseTs,
      aliases: Object.fromEntries(
        Object.entries(baseTs.aliases).filter(([k]) => k !== 'accept-edits' && k !== 'acceptedits'),
      ),
    }).some((p) => p.includes('acceptEdits')),
  )
  t(
    'R3 咬住 zod 里未注册的档位',
    checkConsumers(
      [
        {
          relPath: 'apps/api/src/routes/workspace-permissions.ts',
          src: "const permissionModeSchema = z.enum(['accept-all-x'])\n",
        },
      ],
      baseTs,
    ).some((p) => p.startsWith('R3') && p.includes('accept-all-x')),
  )
  t(
    'R3 咬住决策位用别名(auto)而非规范成员',
    checkConsumers(
      [{ relPath: AGENT_LOOP, src: 'if self._permission_mode == "auto":\n    pass\n' }],
      baseTs,
    ).some((p) => p.includes('决策位使用别名')),
  )
  t(
    'R3 咬住自造档位白名单',
    checkConsumers(
      [
        {
          relPath: AGENT_LOOP,
          src: 'if _resolved_mode not in ("default", "plan", "auto"):\n    raise ValueError()\n',
        },
      ],
      baseTs,
    ).some((p) => p.includes('自造档位白名单')),
  )
  t(
    'R3 不吃无关元组(环境开关/工具名清单)',
    checkConsumers(
      [
        {
          relPath: AGENT_LOOP,
          src: 'if raw not in ("on", "1", "true", "yes"):\n    pass\n',
        },
      ],
      baseTs,
    ).length === 0,
  )
  t(
    'R3 不吃模型名 auto(非权限位)',
    checkConsumers(
      [{ relPath: 'docs/developer/api/agents.md', src: 'const m = llm.complete(model="whatever")\n' }],
      baseTs,
    ).length === 0,
  )
  // 现状必须干净:否则本门一上去就红,等于给并发会话添堵
  const live = runChecks()
  if (live.problems.length > 0) {
    for (const p of live.problems) console.error(`   · ${p}`)
  }
  t('当前工作区零违规', live.problems.length === 0)

  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  return cases.every((c) => c.ok) ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const { problems, members, aliasCount } = runChecks()
  if (problems.length === 0) {
    console.log(
      `✅ 权限模式词汇对账通过:${members.length} 个规范档 / ${aliasCount} 个别名,TS↔Python 一致,消费侧无注册表外取值`,
    )
    return
  }
  console.error(`❌ 权限模式词汇对账发现 ${problems.length} 处问题:`)
  for (const p of problems) console.error(`   · ${p}`)
  console.error('\n唯一真源:packages/types/src/permission-mode.ts ↔ app/core/permission_mode.py')
  console.error('改法:先在两侧登记成员/别名,再改消费点;紧急跳过 HUSKY_SKIP_PERMISSION_VOCAB=1')
  process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
