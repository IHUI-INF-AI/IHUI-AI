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

/**
 * 显式豁免的**非档位哨兵值**(共字段不同语义)。
 *
 * 'unset' 不是权限档,而是"该工作区从未配置过权限"的哨兵 —— 它复用了 checkWorkspace
 * 返回体里的 mode 字段(本身是设计缺陷,已登记为 G-164:"mode 字段应为 PermissionMode,
 * 未配置走独立布尔/枚举字段")。豁免写成数据而不是放宽正则:下一个人在这里加条目
 * 时必须写 why,否则就是又一次把判据磨钝。
 */
const MODE_FIELD_SENTINELS = { unset: 'checkWorkspace 的"未配置"哨兵,非档位(G-164 待消除)' }

/**
 * 消费点档案:**逐文件**声明"权限档存在哪个变量名里"。
 *
 * 为什么不用一条通用正则:实测 `mode == "debate"`(MoA 聚合档)、
 * `mode == 'plan'`(计划文本)都会被"mode 比较"误抓 —— 判据一宽就必然误伤,
 * 宁可显式登记每个消费点用什么变量名。canonical = 该处比较的是**已归一的存储值**
 * (只许规范成员);wire = 该处比较/声明的是**对外拼写**(kebab 等别名合法)。
 */
const CONSUMER_PROFILES = [
  { file: 'apps/ai-service/app/services/agent_loop_v2.py', vars: ['permission_mode'], kind: 'canonical' },
  { file: 'apps/ai-service/app/routers/agent_runtime.py', vars: ['mode'], kind: 'canonical' },
  { file: 'apps/ai-service/app/routers/agents.py', vars: ['permission_mode'], kind: 'wire' },
  { file: 'apps/api/src/routes/workspace-permissions.ts', vars: ['mode'], kind: 'wire' },
  { file: 'apps/api/src/routes/workspace.ts', vars: ['mode'], kind: 'wire' },
  { file: 'apps/api/src/routes/v1-ai-core.ts', vars: ['permissionMode'], kind: 'wire' },
  // G-163:授权门内部一律拿归一后的规范档比较(permMode),入参拼写不参与判断
  { file: 'apps/api/src/services/workspace-ai-service.ts', vars: ['permMode'], kind: 'canonical' },
  {
    file: 'apps/api/src/routes/workspace-ai.ts',
    vars: ['mode'],
    kind: 'wire',
    sentinels: MODE_FIELD_SENTINELS,
  },
  { file: 'apps/cli/src/tools/permissions.ts', vars: ['permissionMode', 'mode'], kind: 'canonical' },
  { file: 'apps/cli/src/commands/settings.ts', vars: ['permissionMode'], kind: 'canonical' },
  { file: 'apps/cli/src/commands/repl.ts', vars: ['permissionMode'], kind: 'canonical' },
  { file: 'apps/cli/src/commands/status-cmd.ts', vars: ['permissionMode'], kind: 'canonical' },
  { file: 'apps/cli/src/commands/agent.ts', vars: ['permissionMode'], kind: 'canonical' },
]

/** R3/R4 扫描面 = 档案内文件 + 声明类文件(类型联合/zod) + 对外文档。 */
const KNOWN_CONSUMERS = [
  ...CONSUMER_PROFILES.map((p) => p.file),
  // 无比较位但可能有"清单副本"的文件,也要进 R4 视野
  'apps/cli/src/commands/config-cmd.ts',
  'apps/ai-service/app/routers/agents.py',
  'packages/types/src/workspace.ts',
  'packages/types/src/agent-runtime.ts',
  'packages/api-client/src/endpoints/workspace.ts',
  'docs/developer/api/agents.md',
]

/** R4 唯一允许"自己声明档位清单"的文件(注册表本身)。 */
const REGISTRY_FILES = new Set(['packages/types/src/permission-mode.ts'])

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
export function collectConsumerLiterals(relPath, src, profile) {
  const found = []
  const lineOf = (index) => src.slice(0, index).split('\n').length
  const canonicalOnly = profile?.kind === 'canonical'
  const push = (value, index, why) =>
    found.push({ value, line: lineOf(index), why, canonicalOnly })

  // ① 比较位:只抓档案里登记的变量名 —— 通用 `mode ==` 会把 MoA 的 debate/vote/critique
  //    这类无关档位一起咬进来(上一版实测 3 处误报),判据一宽就没人信。
  for (const varName of profile?.vars ?? []) {
    for (const m of src.matchAll(new RegExp(`${varName}\\s*===?\\s*(["'])([^"']+)\\1`, 'g'))) {
      push(m[2], m.index, `${varName} 比较字面量`)
    }
  }

  // ② 声明位:zod 枚举(键名含 permission/mode)
  for (
    const m of src.matchAll(/\b(?:permission|mode)[A-Za-z_]*\s*[:=]\s*z\.enum\(\[([\s\S]*?)\]/g)
  ) {
    for (const lit of m[1].matchAll(/'([^']+)'/g)) push(lit[1], m.index, 'zod 权限枚举成员')
  }
  // ③ 声明位:TS 类型联合 export type XxxPermissionMode = 'a' | 'b'
  for (const m of src.matchAll(/export type \w*PermissionMode\s*=\s*((?:'[^']+'(?:\s*\|\s*)?)+)/g)) {
    for (const lit of m[1].matchAll(/'([^']+)'/g)) push(lit[1], m.index, 'TS 权限模式联合')
  }
  // ④ 声明位:对外文档的参数表行
  for (const m of src.matchAll(/\|\s*permissionMode\s*\|[^\n]*$/gim)) {
    for (const lit of m[0].matchAll(/`([a-zA-Z][\w-]*)`/g)) push(lit[1], m.index, '文档取值清单')
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
    const profile = CONSUMER_PROFILES.find((p) => p.file === relPath)
    const sentinels = profile?.sentinels ?? {}
    for (const hit of collectConsumerLiterals(relPath, src, profile)) {
      if (sentinels[hit.value]) continue // 显式豁免(档案里带 why),不是把正则放宽
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

/**
 * R4:禁止再抄一份"完整档位清单"。
 *
 * 只咬**覆盖了全部规范成员**的字面量联合 / 数组 / z.enum —— 那种形状就是注册表的副本
 * (新增第 6 档时它必然漏接,正是 G-161 五套拼写并存的成因)。
 * 刻意放过"子集声明":workspace 的 kebab wire 枚举是 REST 既有契约,不是副本。
 */
export function checkNoSecondList(files, registry, wireValues = []) {
  const problems = []
  const sets = [
    { name: '规范档', members: new Set(registry.members) },
    // wire(kebab)那份同样不能抄:G-164 实测 3 个路由文件里有 4 份互不同步的 kebab 清单,
    // 其中一份少 plan → GET 读 DB 时把已存的 plan 静默归 null(存进去的档被读成"没配")。
    wireValues.length > 0 ? { name: 'wire 档', members: new Set(wireValues) } : null,
  ].filter(Boolean)
  const candidates = [
    /export type \w*PermissionMode\w*\s*=\s*([^;]*?)\n/g,
    /\b(?:enumValues|VALID_MODES|PERMISSION_MODE_VALUES|PERMISSION_MODE_WIRE)\s*[:=]\s*(\[[^\]]*\])/g,
    /z\.enum\((\[[^\]]*\])\)/g,
  ]
  for (const { relPath, src } of files) {
    if (REGISTRY_FILES.has(relPath)) continue
    for (const re of candidates) {
      for (const m of src.matchAll(re)) {
        const lits = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
        if (lits.length === 0) continue
        for (const set of sets) {
          if (![...set.members].every((v) => lits.includes(v))) continue
          problems.push(
            `R4 ${relPath}:${src.slice(0, m.index).split('\n').length} 抄了第二份完整${set.name}清单 ` +
              `(${lits.join(', ')}) —— 改 import @ihui/types/permission-mode 的 ` +
              `${set.name === 'wire 档' ? 'PERMISSION_MODE_WIRE_VALUES' : 'PERMISSION_MODES'}` +
              `(新增档位时副本必漏接)`,
          )
        }
      }
    }
  }
  return problems
}

/**
 * R5:wire(kebab)清单的**跨语言镜像**对账。
 *
 * 为什么单列一条:Python 侧 `app/types/api_client.py(.pyi)` 里的
 * `PromptMode = Literal["default","plan","accept-edits","bypass-permissions"]`
 * 是我们自己的契约声明,而且 grep 全项目**没有任何运行时代码用它** ——
 * 一份"没人消费、又不在 R1 对账范围内"的清单,漂移时不会有任何信号。
 * 它不可能 import TS 注册表,所以判据只能是"值集合必须逐字相等"。
 */
const WIRE_MIRROR_FILES = [
  'apps/ai-service/app/types/api_client.py',
  'apps/ai-service/app/types/api_client.pyi',
]

export function parseTsWireValues(src) {
  const m = /export const PERMISSION_MODE_WIRE_VALUES\s*=\s*\[([\s\S]*?)\]/.exec(src)
  if (!m) throw new Error('未找到 TS PERMISSION_MODE_WIRE_VALUES 数组声明')
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

export function checkWireMirrors(read, wireValues) {
  const problems = []
  const want = [...wireValues].sort().join(',')
  for (const relPath of WIRE_MIRROR_FILES) {
    const src = read(relPath)
    const m = /PromptMode\s*=\s*Literal\[([\s\S]*?)\]/.exec(src)
    if (!m) {
      problems.push(`R5 ${relPath}: 找不到 PromptMode = Literal[...] 声明(镜像被删?`)
      continue
    }
    const got = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]).sort().join(',')
    if (got !== want) {
      problems.push(
        `R5 ${relPath}: PromptMode 镜像与 TS wire 清单不一致 期望[${want}] 实际[${got}]` +
          ' —— 改 @ihui/types/permission-mode 的 PERMISSION_MODE_WIRE_VALUES 后必须同步这里',
      )
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
  const wireValues = parseTsWireValues(read(TS_REGISTRY))
  const py = parsePyRegistry(read(PY_REGISTRY))
  const files = KNOWN_CONSUMERS.map((relPath) => ({ relPath, src: read(relPath) }))
  const problems = [
    ...checkMirror(ts, py),
    ...checkAliasClosure(ts),
    ...checkAliasClosure(py),
    ...checkConsumers(files, ts),
    ...checkNoSecondList(files, ts, wireValues),
    ...checkWireMirrors(read, wireValues),
  ]
  return {
    problems,
    members: ts.members,
    aliasCount: Object.keys(ts.aliases).length,
    wireCount: wireValues.length,
  }
}

/** 注入违规自证:证明每条规则各自真的咬得住(不靠脚本自述)。 */
function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })

  const baseTs = parseTsRegistry(readFileSync(join(ROOT, TS_REGISTRY), 'utf8'))
  const basePy = parsePyRegistry(readFileSync(join(ROOT, PY_REGISTRY), 'utf8'))
  const wireValues = parseTsWireValues(readFileSync(join(ROOT, TS_REGISTRY), 'utf8'))

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
  t(
    'R3 不吃 MoA 聚合档 debate(档案未登记该变量名)',
    checkConsumers(
      [{ relPath: 'apps/ai-service/app/routers/agents.py', src: 'if mode == "debate":\n    pass\n' }],
      baseTs,
    ).length === 0,
  )
  t(
    'R3 仍吃 agents.py 里权限档的未注册取值',
    checkConsumers(
      [
        {
          relPath: 'apps/ai-service/app/routers/agents.py',
          src: 'if permission_mode == "yolo":\n    pass\n',
        },
      ],
      baseTs,
    ).some((p) => p.includes('yolo')),
  )
  t(
    'R4 咬住第二份完整档位清单',
    checkNoSecondList(
      [
        {
          relPath: 'apps/cli/src/tools/permissions.ts',
          src: "const VALID_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'manual'];\n",
        },
      ],
      baseTs,
    ).some((p) => p.startsWith('R4')),
  )
  t(
    'R4 放过子集声明(workspace kebab wire 枚举不是副本)',
    checkNoSecondList(
      [
        {
          relPath: 'packages/types/src/workspace.ts',
          src: "export type WorkspacePermissionMode = 'default' | 'accept-edits'\n",
        },
      ],
      baseTs,
    ).length === 0,
  )
  t(
    'R3 哨兵豁免只在其登记文件生效(unset 换到别处仍拦)',
    checkConsumers(
      [
        {
          relPath: 'apps/api/src/services/workspace-ai-service.ts',
          src: 'if (permMode === "unset") return allowed\n',
        },
      ],
      baseTs,
    ).some((p) => p.includes('unset')),
  )
  t(
    'R3 哨兵在其登记文件内放过(workspace-ai 的"未配置"判断)',
    checkConsumers(
      [
        {
          relPath: 'apps/api/src/routes/workspace-ai.ts',
          src: "const code = decision.mode === 'unset' ? 401 : 403\n",
        },
      ],
      baseTs,
    ).length === 0,
  )
  t(
    'R4 咬住第二份 wire(kebab)清单副本',
    checkNoSecondList(
      [
        {
          relPath: 'apps/api/src/routes/workspace.ts',
          src: "  mode: z.enum(['default', 'plan', 'accept-edits', 'bypass-permissions']).optional(),\n",
        },
      ],
      baseTs,
      wireValues,
    ).some((p) => p.startsWith('R4') && p.includes('wire 档')),
  )
  t(
    'R4 放过引用注册表常量的写法(z.enum(PERMISSION_MODE_WIRE_VALUES))',
    checkNoSecondList(
      [
        {
          relPath: 'apps/api/src/routes/workspace.ts',
          src: '  mode: z.enum(PERMISSION_MODE_WIRE_VALUES).optional(),\n',
        },
      ],
      baseTs,
      wireValues,
    ).length === 0,
  )
  t(
    'R5 咬住 Python wire 镜像少一档(它无人消费,漂移时不会有任何其它信号)',
    checkWireMirrors(
      (rel) =>
        rel.endsWith('api_client.py')
          ? 'PromptMode = Literal["default", "plan", "accept-edits"]\n'
          : `PromptMode = Literal[${wireValues.map((v) => `"${v}"`).join(', ')}]\n`,
      wireValues,
    ).some((p) => p.startsWith('R5') && p.includes('api_client.py:')),
  )
  t(
    'R5 两侧一致时放过(不是恒红判据)',
    checkWireMirrors(
      () => `PromptMode = Literal[${wireValues.map((v) => `"${v}"`).join(', ')}]\n`,
      wireValues,
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
      `✅ 权限模式词汇对账通过:${members.length} 个规范档 / ${aliasCount} 个别名,` +
        'TS↔Python 一致,消费侧无注册表外取值,无第二份清单(含 wire),wire 跨语言镜像已对账',
    )
    return
  }
  console.error(`❌ 权限模式词汇对账发现 ${problems.length} 处问题:`)
  for (const p of problems) console.error(`   · ${p}`)
  console.error('\n唯一真源:packages/types/src/permission-mode.ts ↔ app/core/permission_mode.py')
  console.error('改法:先在两侧登记成员/别名,再改消费点;紧急跳过 HUSKY_SKIP_PERMISSION_VOCAB=1')
  process.exit(1)
}

/**
 * §22c 镜像常量防御:测试文件不得复制解析逻辑,一律从这里 import。
 * (本脚本被 import 时 **不**执行 main(),见 isDirectRun 守卫。)
 */
export const __test__ = {
  parseTsRegistry,
  parsePyRegistry,
  checkMirror,
  checkAliasClosure,
  checkConsumers,
  checkNoSecondList,
  checkWireMirrors,
  parseTsWireValues,
  collectConsumerLiterals,
  modeKey,
  runChecks,
  WIRE_MIRROR_FILES,
  KNOWN_CONSUMERS,
  TS_REGISTRY,
  PY_REGISTRY,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
