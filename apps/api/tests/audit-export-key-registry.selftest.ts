// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 86G-2 判据取证 A(`--self-test`):验签公钥登记表的构造面成对正反例。
 *
 * 为什么这是一份"可被 node 直接跑"的自检而不是 vitest 用例:判据要能被**提交链之外**的人
 * 单独问责(`node <本文件> --self-test` 一条命令给出现读数),而它判的全是**表自身**的
 * 结构结论 —— 不需要 DB、不需要密钥配置、不需要 Fastify 装配。密码学端到端(换钥后旧信封
 * 仍可验 / 未知 kid 与签名被改给出不同结论)在 `audit-export-key-registry.test.ts`,
 * 装车与反向锁在 `scripts/tests/audit-export-key-registry.test.mjs`,三把尺子不互相顶。
 *
 * 三条不可动摇的写法:
 * - **每条判据一对**:该红的红 + 不该红的不红。只留前者,判据就会变成"逢登记即红"的恒红门。
 * - **两条【变异对照】用例**:把"按 kid 查表"退回"只认当前那一把",它们必红(本文件第一、
 *   二条 ① 组断言),所以这条行为不是靠注释保证的。
 * - 真实文件形态必须由真实文件喂(§22c):抽取器那组用例读的就是被审的那份源文件本身。
 */
import { createPublicKey, generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT,
  ENVELOPE_RETENTION_ENV,
  ENV_PUBLIC_KEY_INLINE,
  AUDIT_EXPORT_KEY_REGISTRY,
  type AuditExportKeyRegistryError,
  auditExportKeyRegistryIssues,
  bootstrapAuditExportKeyEntry,
  buildAuditExportKeyTable,
  checkAuditExportKeyRegistry,
  deriveAuditExportKeyId,
  envelopeRetentionDays,
  extractRegistryBlocks,
  normalizeAuditExportPublicKey,
  parseAuditExportKeyEntry,
  registryArrayText,
  resolveAuditExportKeyForKid,
  type AuditExportKeyEntry,
  type AuditExportKeyIssueCode,
  type AuditExportKeyRegistryContext,
  type AuditExportKeyRegistryReport,
} from '../src/services/audit-export-key-registry.ts'

export interface SelfTestCase {
  name: string
  ok: boolean
  detail?: string
}

interface SelfTestFixtures {
  pemA: string
  pemB: string
  kidA: string
  kidB: string
  pemAAsBase64Der: string
  privatePem: string
}

/** 自检专用的一次性密钥(1024 位,毫秒级);只活在内存,不落盘、不入库。 */
function makeFixtures(): SelfTestFixtures {
  const gen = () =>
    generateKeyPairSync('rsa', {
      modulusLength: 1024,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
  const a = gen()
  const b = gen()
  // base64(DER) 形态取 **a** 的公钥:这条夹具证的正是"同一条公钥的两种形态落到同一个 kid"。
  const der = createPublicKey({ key: a.publicKey, format: 'pem', type: 'spki' }).export({
    type: 'spki',
    format: 'der',
  })
  return {
    pemA: a.publicKey,
    pemB: b.publicKey,
    kidA: deriveAuditExportKeyId(a.publicKey),
    kidB: deriveAuditExportKeyId(b.publicKey),
    pemAAsBase64Der: der.toString('base64'),
    privatePem: a.privateKey,
  }
}

function entryOf(
  kid: string,
  publicKey: string,
  over: Partial<AuditExportKeyEntry> = {},
): AuditExportKeyEntry {
  return { kid, publicKey, status: 'active', reason: '自检构造项', addedAt: '2026-01-01', ...over }
}

/** 抛错型判据的通用探测器:错误码对不上就算红(不靠"它抛了"当结论)。 */
function throwsCode(run: () => unknown, code: AuditExportKeyRegistryError['code']): boolean {
  try {
    run()
    return false
  } catch (e) {
    return (e as AuditExportKeyRegistryError).code === code
  }
}

/** 全部断言成对写:该红的红 + 不该红的不红。永远绿的断言与永远红的断言同样没用。 */
export function runAuditExportKeyRegistrySelfTest(): SelfTestCase[] {
  const fx = makeFixtures()
  const { pemA, pemB, kidA, kidB } = fx
  const today = '2026-10-01'
  const cases: SelfTestCase[] = []
  const c = (name: string, ok: boolean, detail = ''): void => {
    cases.push(ok ? { name, ok: true } : { name, ok: false, detail })
  }
  const judge = (
    entries: readonly AuditExportKeyEntry[],
    ctx: Partial<AuditExportKeyRegistryContext> = {},
  ): AuditExportKeyRegistryReport =>
    auditExportKeyRegistryIssues(entries, { today, previousEntries: [], ...ctx })
  const has = (
    r: AuditExportKeyRegistryReport,
    code: AuditExportKeyIssueCode,
    kid?: string,
  ): boolean => r.issues.some((i) => i.code === code && (kid === undefined || i.kid === kid))

  // ① 查表三态(本票的立论)
  const retiredRow = entryOf(kidA, pemA, { status: 'retired', retiredAt: '2026-09-01' })
  const retiredTable = buildAuditExportKeyTable([retiredRow], null)
  c('已知 kid 必须查得到', resolveAuditExportKeyForKid(kidA, retiredTable.entries).found === true)
  const miss = resolveAuditExportKeyForKid(kidB, retiredTable.entries)
  c('未知 kid 必须判"查不到"并原样点名 kid', !miss.found && miss.kid === kidB)
  c(
    '【变异对照】retired 行必须仍在生效表里且仍可解析 —— 把查表退回"只认当前那一把"即翻红',
    retiredTable.entries.length === 1 && retiredTable.entries[0]?.status === 'retired',
    `实得:${JSON.stringify(retiredTable.entries.map((e) => e.status))}`,
  )
  c(
    '【变异对照】bootstrap 行也不得被 status 过滤掉',
    buildAuditExportKeyTable([], { kid: kidB, publicKey: pemB }).entries.length === 1,
  )

  // ② 材料归一 / 装载校验
  c(
    'PEM 与 base64(DER) 归一到同一条 PEM(否则同钥两个 kid)',
    normalizeAuditExportPublicKey(fx.pemAAsBase64Der) === normalizeAuditExportPublicKey(pemA),
  )
  c(
    'base64 形态推出的 kid 与 PEM 形态一致',
    deriveAuditExportKeyId(normalizeAuditExportPublicKey(fx.pemAAsBase64Der)) === kidA,
  )
  c(
    '私钥材料必须被拒收而不是静默通过',
    throwsCode(
      () => normalizeAuditExportPublicKey(fx.privatePem),
      'private_key_material_forbidden',
    ),
  )
  c(
    '不可解析材料 ⇒ 显式错误,不得当成空表',
    throwsCode(() => normalizeAuditExportPublicKey('nope'), 'unusable_public_key_material'),
  )
  c(
    'status 值域在装载期即被拒(不靠 TS 类型)',
    parseAuditExportKeyEntry({
      kid: kidA,
      status: 'pending',
      publicKey: pemA,
      reason: 'x',
      addedAt: '2026-01-01',
    }).ok === false,
  )
  c(
    '同 kid 两把不同材料 ⇒ 报问题而不是猜哪个对',
    buildAuditExportKeyTable([entryOf(kidA, pemA)], { kid: kidA, publicKey: pemB }).problems
      .length === 1,
  )
  c(
    '同 kid 同一把材料 ⇒ 不报问题(不得把正常形态钉成红)',
    buildAuditExportKeyTable([entryOf(kidA, pemA)], { kid: kidA, publicKey: pemA }).problems
      .length === 0,
  )

  // ③ 表自洽判据(每条一对)
  c('R1 重复 kid 必红', has(judge([entryOf(kidA, pemA), entryOf(kidA, pemA)]), 'R1_DUPLICATE_KID'))
  c(
    'R1 两把不同钥匙不得红',
    !has(judge([entryOf(kidA, pemA), entryOf(kidB, pemB)]), 'R1_DUPLICATE_KID'),
  )
  c(
    'R2 登记行缺 reason 必红',
    has(judge([entryOf(kidA, pemA, { reason: '' })]), 'R2_MISSING_REASON'),
  )
  c('R2 带 reason 的正常行不得红', !has(judge([entryOf(kidA, pemA)]), 'R2_MISSING_REASON'))
  c(
    'R2 bootstrap 行不吃 reason 判据(理由由代码给,不该反过来拦部署)',
    !has(judge([bootstrapAuditExportKeyEntry(kidA, pemA)]), 'R2_MISSING_REASON'),
  )
  c('R7 材料不可解析必红', has(judge([entryOf(kidA, 'garbage')]), 'R7_UNUSABLE_KEY_MATERIAL'))
  c(
    'R8 手写 kid 与公钥自算值不符必红',
    has(judge([entryOf('hand-written-kid', pemA)]), 'R8_KID_NOT_DERIVABLE'),
  )
  c(
    'R8 不得把 bootstrap 行判红(env 可以显式指定 kid)',
    !has(judge([bootstrapAuditExportKeyEntry('env-override', pemA)]), 'R8_KID_NOT_DERIVABLE'),
  )
  c(
    'R10 两个 active 必红(当前钥匙不得二义)',
    has(judge([entryOf(kidA, pemA), entryOf(kidB, pemB)]), 'R10_MULTIPLE_ACTIVE'),
  )
  c(
    'R11 在用钥匙不在表里(active 说的是另一把)必红',
    has(judge([entryOf(kidB, pemB)], { signingKid: kidA }), 'R11_SIGNING_KEY_NOT_IN_TABLE'),
  )
  c(
    'R11 表与在用钥匙一致时不得红',
    !has(judge([entryOf(kidA, pemA)], { signingKid: kidA }), 'R11_SIGNING_KEY_NOT_IN_TABLE'),
  )
  c(
    'R11 表里无 active 行时不判(还没完成第一次登记,不是分叉)',
    !has(
      judge([bootstrapAuditExportKeyEntry(kidA, pemA)], { signingKid: kidA }),
      'R11_SIGNING_KEY_NOT_IN_TABLE',
    ),
  )

  // ④ 时间与"退而不删"两维(R4/R5/R6)
  c(
    'R4 retired 行被删必红',
    has(judge([], { previousEntries: [retiredRow] }), 'R4_RETIRED_ROW_DELETED'),
  )
  c(
    'R4 行仍在不得红',
    !has(judge([retiredRow], { previousEntries: [retiredRow] }), 'R4_RETIRED_ROW_DELETED'),
  )
  c(
    'R4 没有上一面快照 ⇒ 未判定而不是通过',
    judge([], { previousEntries: undefined }).undetermined.some((s) => s.includes('R4')),
  )
  c(
    'R4 上一面是 active、这一面消失 ⇒ 不属本维(只有"退而被删"才是证据被判死)',
    !has(judge([], { previousEntries: [entryOf(kidA, pemA)] }), 'R4_RETIRED_ROW_DELETED'),
  )
  const rottedRow = entryOf(kidB, pemB, { status: 'retired', retiredAt: '2025-01-01' })
  const timeReport = judge([retiredRow, rottedRow], { previousEntries: [retiredRow, rottedRow] })
  c('R5 越过"退役日 + 信封保留期"的行按腐烂红', has(timeReport, 'R5_ENTRY_PAST_RETENTION', kidB))
  c(
    'R5 保留期内的行不得红(它是旧信封唯一的出口)',
    !has(timeReport, 'R5_ENTRY_PAST_RETENTION', kidA),
  )
  c(
    'R5 的分母跟着信封保留期走(env 拉长 ⇒ 同一行不再算腐烂)',
    !has(
      judge([retiredRow, rottedRow], { envelopeRetentionDays: 3650 }),
      'R5_ENTRY_PAST_RETENTION',
    ),
  )
  c(
    'R6 retired 不带死亡时刻必红(只有出生没有死亡)',
    has(judge([entryOf(kidA, pemA, { status: 'retired' })]), 'R6_RETIRED_WITHOUT_DEATH'),
  )
  c(
    '空表必须喊"验签机制当前不可用",不得记为通过',
    judge([]).notices.some((s) => s.includes('验签机制当前不可用')),
  )
  c(
    '只有 bootstrap 行 ⇒ 点名"轮换能力未启用"',
    judge([bootstrapAuditExportKeyEntry(kidA, pemA)]).notices.some((s) =>
      s.includes('轮换能力未启用'),
    ),
  )
  c(
    'ctx.today 不可解析 ⇒ 时间维未判定',
    judge([retiredRow], { today: '昨天下午' }).undetermined.length === 1,
  )

  // ⑤ 保留期分母与 86D 同源
  c('默认档就是 86D 的 180 天', envelopeRetentionDays({}) === AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT)
  c(
    '读同一个环境变量,不另立第二份真相',
    envelopeRetentionDays({ [ENVELOPE_RETENTION_ENV]: '400' }) === 400,
  )
  c(
    '只允许向上取(把公钥窗口压到信封之下就是自造"永远验不了的那一段")',
    envelopeRetentionDays({ [ENVELOPE_RETENTION_ENV]: '7' }) ===
      AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT,
  )

  // ⑥ 上一面文本抽取:必须拿真实文件的真实形态喂(§22c「镜像输入逐字取自真实文件」)
  const ownSource = readFileSync(
    fileURLToPath(new URL('../src/services/audit-export-key-registry.ts', import.meta.url)),
    'utf-8',
  )
  c(
    '抽取器在真实源文件上必须锚定到登记数组(而不是判据里的 kid 字面量)',
    registryArrayText(ownSource).length > 0 &&
      extractRegistryBlocks(ownSource).length === AUDIT_EXPORT_KEY_REGISTRY.length,
    `实得块数:${String(extractRegistryBlocks(ownSource).length)}`,
  )
  const synthetic = [
    'const AUDIT_EXPORT_KEY_REGISTRY: readonly AuditExportKeyEntry[] = [',
    '  {',
    `    kid: '${kidA}',`,
    "    status: 'retired',",
    '  },',
    '  {',
    `    kid: '${kidB}',`,
    "    status: 'active',",
    '  },',
    ']',
  ].join('\n')
  const syntheticBlocks = extractRegistryBlocks(synthetic)
  c(
    '抽取器必须认出 retired 行',
    syntheticBlocks.some((b) => b.kid === kidA && b.status === 'retired'),
  )
  c('抽取器必须同时认出 active 行(否则 R4 会把搬家读成删除)', syntheticBlocks.length === 2)
  c(
    '抽取器不得把判据文本里的 `kid:` 字面量读成登记行',
    extractRegistryBlocks('const x = { kid: code }').length === 0,
  )
  c(
    '上一面取不到 ⇒ previousFace=unavailable 且不冒绿',
    checkAuditExportKeyRegistry({}, today, null).previousFace === 'unavailable',
  )
  c(
    '体检在"env 有公钥 + 表为空"的正常部署态不得判红',
    checkAuditExportKeyRegistry({ [ENV_PUBLIC_KEY_INLINE]: pemA }, today, []).issues.length === 0,
  )
  return cases
}

// =============================================================================
// 入口(§22d:被 import 时不得触发副作用)
// =============================================================================

function main(): number {
  const cases = runAuditExportKeyRegistrySelfTest()
  const failed = cases.filter((item) => !item.ok)
  for (const item of failed)
    console.log(`❌ ${item.name}${item.detail ? ` —— ${item.detail}` : ''}`)
  console.log(
    `audit-export-key-registry --self-test: 通过 ${String(cases.length - failed.length)} / 共 ${String(cases.length)} 条`,
  )
  return failed.length === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`audit-export-key-registry selftest 自身异常:${(e as Error).message}`)
    process.exitCode = 2
  }
}
