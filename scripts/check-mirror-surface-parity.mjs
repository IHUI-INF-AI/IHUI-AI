#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 跨包「镜像结构」字段对账门禁(2026-11-13 立)。
 *
 * 立门因由(实测,不是假想):
 *   `packages/api-client` 是**零运行时依赖**包(不 import @ihui/shared),为此它把若干
 *   共享层结构复制了一份镜像,并在注释里声明「规则漂移由两侧测试拦下」。
 *   2026-11-13 实测到这条声明**不成立**:`SendAdmissionReceipt.ahead` 在共享层
 *   `send-admission.ts:77` 早已定义(注释还写明「0 表示下一位。缺席表示没量到,不得当成 0」),
 *   而 api-client 镜像 `client.ts` 里**连字段都没有**、解析也不带。
 *   两侧各自的测试都是绿的 —— 因为它们各测各的形状,**没有一条比较两侧**。
 *   下游后果:queued 回执永远读不到排队位次,用户只看到一句"已排队"。
 *
 * 判据(只做静态可判、且能真正咬住漂移的那一层):
 *   ① 两侧同名类型的**字段名集合逐字相等**(多一个 / 少一个都红);
 *   ② 每个字段的**可选性一致**(`x?:` vs `x:`)—— 可选性漂移会让"缺席"在一侧合法、
 *      在另一侧被当成必填,与字段丢失同害;
 *   ③ 声明为对账对象的枚举,两侧**取值集合逐字相等**。
 *
 * 不做的事(如实标注,不冒充判过):
 *   解析函数体的行为等价无法静态判定,本门**不判**;那一层由两侧各自的单测覆盖。
 *   本门的价值在于"结构面永不静默漂开",而不是替代行为测试。
 *
 * CLI 用法:
 *   node scripts/check-mirror-surface-parity.mjs [--self-test] [--json] [--help]
 *
 * 退出码:0 绿 / 1 红 / 2 未判定(取材失败,不记绿也不冒红)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '..')

/** 对账对象清单。每条都必须指明两侧的真实落点(路径 + 类型名 / 常量名)。 */
export const MIRROR_PAIRS = [
  {
    id: 'SendAdmissionReceipt',
    why: 'api-client 为零运行时依赖镜像共享层(见 client.ts 该类型的注释);2026-11-13 因 ahead 漏字段实测出事故',
    shared: {
      file: 'packages/shared/src/chat/send-admission.ts',
      type: 'SendAdmissionReceipt',
    },
    mirror: {
      file: 'packages/api-client/src/client.ts',
      type: 'SendAdmissionReceipt',
    },
  },
  {
    id: 'ContextLedger',
    why: 'client.ts:1817 自述「权威定义在 @ihui/shared 的 sse/contract.ts ContextLedger(本包零依赖,故本地镜像)」;两侧类型名带 Snapshot 后缀差异,故显式登记映射',
    shared: { file: 'packages/shared/src/sse/contract.ts', type: 'ContextLedger' },
    mirror: { file: 'packages/api-client/src/client.ts', type: 'ContextLedgerSnapshot' },
  },
  {
    id: 'ContextLedgerCategoryUsage',
    why: 'ContextLedger.categories 的元素类型,两侧同样带 Snapshot 后缀差异',
    shared: { file: 'packages/shared/src/sse/contract.ts', type: 'ContextLedgerCategoryUsage' },
    mirror: {
      file: 'packages/api-client/src/client.ts',
      type: 'ContextLedgerCategoryUsageSnapshot',
    },
  },
]

/** 枚举对账对象:两侧同名常量的取值集合必须逐字相等。 */
export const MIRROR_ENUM_PAIRS = [
  {
    id: 'ADMISSION_DISPOSITIONS',
    why: '四档处置码是回执判据的闭集,两侧漂开会让一档在某侧变成"未知码"',
    shared: { file: 'packages/shared/src/chat/send-admission.ts', name: 'ADMISSION_DISPOSITIONS' },
    mirror: { file: 'packages/api-client/src/client.ts', name: 'ADMISSION_DISPOSITIONS' },
  },
]

/**
 * 从一个 TS 源码里抽某个 `interface` / `type ... = {...}` 的字段表。
 *
 * 只认对象字面量形态的成员行:`name?: type` / `name: type`。
 * 方法签名、索引签名、注释行一律跳过 —— 它们的"字段名"不是数据面。
 *
 * @returns {{name: string, optional: boolean}[] | null} null = 找不到该类型(交给调用方判未判定)
 */
export function extractFields(source, typeName) {
  const src = String(source ?? '')
  // 形态一:interface X { ... }
  // 形态二:type X = { ... }
  const patterns = [
    new RegExp(`\\binterface\\s+${typeName}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`, 'm'),
    new RegExp(`\\btype\\s+${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'),
  ]
  let body = null
  for (const re of patterns) {
    const m = src.match(re)
    if (m) {
      body = m[1]
      break
    }
  }
  if (body === null) return null

  const fields = []
  for (const rawLine of body.split('\n')) {
    // 剥行注释与块注释残留(块注释可能跨行,这里只处理单行内的 /* */ 与 //)
    const line = rawLine
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/, '')
      .trim()
    if (!line) continue
    // 数据成员:`name?: Type` 或 `name: Type`(允许 readonly 前缀)
    const m = line.match(/^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\??)\s*:/)
    if (!m) continue
    fields.push({ name: m[1], optional: m[2] === '?' })
  }
  return fields
}

/** 从一个 TS 源码里抽 `export const NAME = ['a','b'] as const` 的取值集合。 */
export function extractEnumValues(source, constName) {
  const src = String(source ?? '')
  const re = new RegExp(`\\b${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm')
  const m = src.match(re)
  if (!m) return null
  const values = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
  return values.length > 0 ? values : null
}

/**
 * 纯判据:比较两份字段表。
 * @returns {string[]} 违规清单(空 = 对账通过)
 */
export function compareFields(sharedFields, mirrorFields, label = '') {
  const errors = []
  const tag = label ? `${label}: ` : ''
  const sMap = new Map(sharedFields.map((f) => [f.name, f.optional]))
  const mMap = new Map(mirrorFields.map((f) => [f.name, f.optional]))

  const missing = [...sMap.keys()].filter((k) => !mMap.has(k))
  const extra = [...mMap.keys()].filter((k) => !sMap.has(k))
  if (missing.length > 0) {
    errors.push(
      `${tag}镜像缺字段 ${missing.join(', ')} —— 共享层有而镜像没有,下游将永远读不到它(ahead 就是这样漏的)`,
    )
  }
  if (extra.length > 0) {
    errors.push(`${tag}镜像多字段 ${extra.join(', ')} —— 共享层没有,镜像自己发明了字段(下游会读到一个不存在的约定)`)
  }
  for (const [name, sOpt] of sMap) {
    if (!mMap.has(name)) continue
    const mOpt = mMap.get(name)
    if (sOpt !== mOpt) {
      errors.push(
        `${tag}字段 ${name} 可选性漂移:共享层 ${sOpt ? '可选(?)' : '必填'},镜像 ${mOpt ? '可选(?)' : '必填'}`,
      )
    }
  }
  return errors
}

/** 纯判据:比较两个枚举取值集合(顺序无关,多重集也要一致)。 */
export function compareEnums(sharedValues, mirrorValues, label = '') {
  const tag = label ? `${label}: ` : ''
  const s = new Set(sharedValues ?? [])
  const m = new Set(mirrorValues ?? [])
  const missing = [...s].filter((v) => !m.has(v))
  const extra = [...m].filter((v) => !s.has(v))
  const errors = []
  if (missing.length > 0) errors.push(`${tag}镜像缺取值 ${missing.join(', ')}`)
  if (extra.length > 0) errors.push(`${tag}镜像多取值 ${extra.join(', ')}`)
  if ((sharedValues?.length ?? 0) !== s.size) errors.push(`${tag}共享层取值表自身有重复项`)
  if ((mirrorValues?.length ?? 0) !== m.size) errors.push(`${tag}镜像取值表自身有重复项`)
  return errors
}

/** 读文件;读不到返回 null(调用方判未判定,不猜) */
export function readSource(file, root = ROOT) {
  try {
    return readFileSync(join(root, file), 'utf8')
  } catch {
    return null
  }
}

/** 主判据:返回 { ok, errors, undetermined } */
export function inspect(root = ROOT) {
  const errors = []
  const undetermined = []

  for (const pair of MIRROR_PAIRS) {
    const sharedSrc = readSource(pair.shared.file, root)
    const mirrorSrc = readSource(pair.mirror.file, root)
    if (sharedSrc === null) {
      undetermined.push(`${pair.id}: 共享层 ${pair.shared.file} 读不到`)
      continue
    }
    if (mirrorSrc === null) {
      undetermined.push(`${pair.id}: 镜像 ${pair.mirror.file} 读不到`)
      continue
    }
    const sFields = extractFields(sharedSrc, pair.shared.type)
    const mFields = extractFields(mirrorSrc, pair.mirror.type)
    if (sFields === null) {
      undetermined.push(`${pair.id}: 共享层找不到类型 ${pair.shared.type}`)
      continue
    }
    if (mFields === null) {
      undetermined.push(`${pair.id}: 镜像找不到类型 ${pair.mirror.type}`)
      continue
    }
    errors.push(...compareFields(sFields, mFields, pair.id))
  }

  for (const pair of MIRROR_ENUM_PAIRS) {
    const sharedSrc = readSource(pair.shared.file, root)
    const mirrorSrc = readSource(pair.mirror.file, root)
    if (sharedSrc === null || mirrorSrc === null) {
      undetermined.push(`${pair.id}: 枚举对账取材失败(一侧文件读不到)`)
      continue
    }
    const sVals = extractEnumValues(sharedSrc, pair.shared.name)
    const mVals = extractEnumValues(mirrorSrc, pair.mirror.name)
    if (sVals === null) {
      undetermined.push(`${pair.id}: 共享层找不到常量 ${pair.shared.name}`)
      continue
    }
    if (mVals === null) {
      undetermined.push(`${pair.id}: 镜像找不到常量 ${pair.mirror.name}`)
      continue
    }
    errors.push(...compareEnums(sVals, mVals, pair.id))
  }

  return { ok: errors.length === 0 && undetermined.length === 0, errors, undetermined }
}

/** 自检:内存夹具,含反向锁(删字段必须咬住) */
export function selfTest() {
  const cases = []
  const sharedSrc = `
export type DemoReceipt = {
  readonly inputId: string
  readonly disposition: string
  readonly ahead?: number
  readonly reason?: string
}
`
  const mirrorOk = `
export interface DemoReceipt {
  readonly inputId: string
  readonly disposition: string
  readonly ahead?: number
  readonly reason?: string
}
`
  cases.push([
    '正例:两侧字段集与可选性一致 ⇒ 无违规',
    compareFields(
      extractFields(sharedSrc, 'DemoReceipt'),
      extractFields(mirrorOk, 'DemoReceipt'),
    ).length === 0,
  ])

  const mirrorMissing = `
export interface DemoReceipt {
  readonly inputId: string
  readonly disposition: string
  readonly reason?: string
}
`
  const missingErrs = compareFields(
    extractFields(sharedSrc, 'DemoReceipt'),
    extractFields(mirrorMissing, 'DemoReceipt'),
  )
  cases.push([
    '反演(核心):镜像缺 ahead ⇒ 必须判红并点名(ahead 事故原形)',
    missingErrs.length === 1 && missingErrs[0].includes('ahead') && missingErrs[0].includes('缺字段'),
  ])

  const mirrorExtra = `
export interface DemoReceipt {
  readonly inputId: string
  readonly disposition: string
  readonly ahead?: number
  readonly reason?: string
  readonly invented?: string
}
`
  const extraErrs = compareFields(
    extractFields(sharedSrc, 'DemoReceipt'),
    extractFields(mirrorExtra, 'DemoReceipt'),
  )
  cases.push([
    '反演:镜像自造字段 ⇒ 必须判红(下游会读到一个不存在的约定)',
    extraErrs.length === 1 && extraErrs[0].includes('invented'),
  ])

  const mirrorOptionalDrift = `
export interface DemoReceipt {
  readonly inputId: string
  readonly disposition: string
  readonly ahead: number
  readonly reason?: string
}
`
  const optErrs = compareFields(
    extractFields(sharedSrc, 'DemoReceipt'),
    extractFields(mirrorOptionalDrift, 'DemoReceipt'),
  )
  cases.push([
    '反演:可选性漂移(ahead? → ahead) ⇒ 必须判红',
    optErrs.length === 1 && optErrs[0].includes('可选性漂移'),
  ])

  cases.push([
    '解析:interface 与 type 两种形态都能抽(两侧写法不同也要能对账)',
    (extractFields(sharedSrc, 'DemoReceipt')?.length ?? 0) === 4 &&
      (extractFields(mirrorOk, 'DemoReceipt')?.length ?? 0) === 4,
  ])

  cases.push([
    '解析:类型不存在 ⇒ 返回 null(交给调用方判未判定,不静默当"零字段通过")',
    extractFields(sharedSrc, 'NoSuchType') === null,
  ])

  cases.push([
    '解析:注释里的伪字段不得被算进去',
    (() => {
      const withComment = `
export interface DemoReceipt {
  readonly inputId: string
  /** readonly ghost?: number 这是注释 */
  readonly disposition: string
}
`
      const f = extractFields(withComment, 'DemoReceipt')
      return f !== null && f.length === 2 && !f.some((x) => x.name === 'ghost')
    })(),
  ])

  // 枚举对账
  cases.push([
    '正例:枚举取值集合一致 ⇒ 无违规',
    compareEnums(['a', 'b'], ['a', 'b'], 'E').length === 0,
  ])
  cases.push([
    '反演:镜像缺一个取值 ⇒ 必须判红',
    compareEnums(['a', 'b', 'c'], ['a', 'b'], 'E').some((e) => e.includes('缺取值')),
  ])
  cases.push([
    '反演:镜像多一个取值 ⇒ 必须判红',
    compareEnums(['a'], ['a', 'z'], 'E').some((e) => e.includes('多取值')),
  ])
  cases.push([
    '解析:as const 数组取值能抽出来',
    extractEnumValues("export const E = ['x','y'] as const", 'E')?.join(',') === 'x,y',
  ])

  let failed = 0
  for (const [name, pass] of cases) {
    console.log(`${pass ? '✅' : '❌'} ${name}`)
    if (!pass) failed += 1
  }
  console.log(`\n[self-test] ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0
}

function printHelp() {
  console.log(`
check-mirror-surface-parity.mjs — 跨包镜像结构字段对账门禁

用法:
  node scripts/check-mirror-surface-parity.mjs [--self-test] [--json] [--help]

判据:
  ① 两侧同名类型的字段名集合逐字相等(多一个 / 少一个都红)
  ② 每个字段的可选性一致(? 与必填不混用)
  ③ 登记为对账对象的枚举,两侧取值集合逐字相等

不判:解析函数体的行为等价(静态不可判),那一层由两侧单测各自覆盖。

退出码: 0 绿 / 1 红 / 2 未判定
`)
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    return 0
  }
  if (argv.includes('--self-test')) return selfTest() ? 0 : 1

  const r = inspect()
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    return r.ok ? 0 : r.undetermined.length > 0 && r.errors.length === 0 ? 2 : 1
  }
  if (r.undetermined.length > 0) {
    console.log('⏭ 未判定(取材失败,不记绿也不冒红):')
    for (const u of r.undetermined) console.log(`   · ${u}`)
    return 2
  }
  if (r.errors.length > 0) {
    console.log(`❌ 跨包镜像对账失败 ${r.errors.length} 项:`)
    for (const e of r.errors) console.log(`   · ${e}`)
    return 1
  }
  console.log(
    `✅ 跨包镜像对账通过(结构 ${MIRROR_PAIRS.length} 项 / 枚举 ${MIRROR_ENUM_PAIRS.length} 项)`,
  )
  return 0
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`[check-mirror-surface-parity] 异常: ${e?.stack ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  ROOT,
  MIRROR_PAIRS,
  MIRROR_ENUM_PAIRS,
  extractFields,
  extractEnumValues,
  compareFields,
  compareEnums,
  readSource,
  inspect,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
