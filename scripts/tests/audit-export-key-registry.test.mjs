// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 86G-2 §22c 镜像测试(方向锁,不是第二份判据)。
//
// 三件事只有这里能钉住,且都是"失效表现永远是安静"那一型:
// - **装车证明**:登记表与被拆出来的验签实现必须在**生产面**被调用。本仓最高频的缺陷不是
//   写错判据,而是"造好了没接线"(同守门 64/70/81/115)。测试里调得动、生产面零调用方,
//   账面上看是一次成功交付。
// - **反向回归锁**:被 86G-2 消灭的那句 `payload.keyId !== expectedKeyId`(只认当前一把)
//   不得被"顺手优化"回来。这类收窄一旦漂回去,没有任何编译期症状,只有下一次密钥轮换
//   会让一批旧证据永久验不过 —— 而那一天通常已经过去几个月。
// - **三态不得被压成一态**:`unknown_key` 与 `signature_invalid` 两个字面量必须都还在出口里。
//   把"没登记"合并进"验不过"是本票唯一真正的失败模式,而它在 diff 里长得像清理代码。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const REGISTRY = join(REPO, 'apps/api/src/services/audit-export-key-registry.ts')
const EXPORTER = join(REPO, 'apps/api/src/services/siem-exporter.ts')
const ROUTES = join(REPO, 'apps/api/src/routes/audit-evidence-export.ts')
const SELFTEST = join(REPO, 'apps/api/tests/audit-export-key-registry.selftest.ts')
const VITEST = join(REPO, 'apps/api/tests/audit-export-key-registry.test.ts')
const RUNNER = join(REPO, 'scripts/guardian-runner.mjs')
const JOB = join(REPO, 'apps/api/src/jobs/audit-evidence-retention.ts')

const registry = readFileSync(REGISTRY, 'utf8')
const exporter = readFileSync(EXPORTER, 'utf8')
const routes = readFileSync(ROUTES, 'utf8')

/** 取一个顶层函数/常量的源码块(大括号配平)。找不到 ⇒ 直接判死,不返回空串装绿。 */
function blockOf(source, anchor) {
  const at = source.indexOf(anchor)
  assert.ok(at >= 0, `锚点缺失:${anchor}(判据失明,不是"没问题")`)
  const open = source.indexOf('{', at)
  assert.ok(open >= 0, `锚点后没有函数体:${anchor}`)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  assert.fail(`大括号不配平:${anchor}`)
}

test('T1 装车证明:验签入口必须真的走登记表(而不是只有测试在调)', () => {
  assert.match(
    exporter,
    /from '\.\/audit-export-key-registry\.js'/,
    '登记表被摘线:siem-exporter 不再 import 它',
  )
  assert.ok(
    exporter.includes('AUDIT_EXPORT_KEY_REGISTRY'),
    '登记表常量在生产面零消费 ⇒ "受版本控制的表"是张死表',
  )
  const shell = blockOf(exporter, 'export function verifySignedAuditExport(')
  assert.match(shell, /currentKeyTable\(\)/, '生产入口没取生效表 ⇒ 表被绕过')
  assert.match(
    shell,
    /verifySignedAuditExportWithKeys\(/,
    '生产入口没把结论委托给唯一实现 ⇒ 会漂出第二份真相',
  )
  const impl = blockOf(exporter, 'export function verifySignedAuditExportWithKeys(')
  assert.match(impl, /resolveAuditExportKeyForKid\(/, '验签没有按 kid 查表(= 86G-2 撤销)')
  // 按 status 过滤后再查表 = 把"只认当前那一把"换了个写法塞回来(本条由变异取证:先滤掉
  // 非 bootstrap 行,旧信封依旧验不过,而"有没有调 resolve"这条照旧绿)。该函数本来不需要
  // 任何过滤 ⇒ 出现 `.filter(` 就是这一型,直接判死,不做形状匹配式的宽松判据。
  assert.ok(!impl.includes('.filter('), '验签路径上出现了过滤(极可能按 status 排除了 retired 行)')
  const tableFn = blockOf(exporter, 'function currentKeyTable(')
  assert.match(
    tableFn,
    /readEnvironmentCurrentKey\(/,
    '生效表没并入环境变量那把 ⇒ 现有部署会整体判未知',
  )
})

test('T2 反向回归锁:"只认当前那一把公钥"的旧形态不得回来', () => {
  const impl = blockOf(exporter, 'export function verifySignedAuditExportWithKeys(')
  assert.ok(
    !impl.includes('payload.keyId !== expectedKeyId'),
    '旧口径复现:对 kid 不匹配直接判拒绝 = 轮换后旧信封永久验不过(本票立票理由)',
  )
  assert.ok(
    !/const expectedKeyId = keyIdForPublicKey/.test(exporter),
    '验签路径里又出现了"拿当前公钥反推 kid 比对"这一型',
  )
})

test('T3 三态不得被压成一态:未知密钥与签名被改必须都是出口结论', () => {
  const impl = blockOf(exporter, 'export function verifySignedAuditExportWithKeys(')
  for (const status of [
    'unknown_key',
    'signature_invalid',
    'content_inconsistent',
    'malformed_envelope',
    'verified',
  ]) {
    assert.ok(impl.includes(`'${status}'`), `结论分类少了 ${status}`)
  }
  // "未知密钥"必须把 kid 点名 —— 否则运维拿到的还是一句没法执行的话
  assert.match(impl, /kid=\$\{kid\}/, '未知密钥没有点名信封声称的 kid')
  assert.match(impl, /当前可用的是/, '未知密钥没有列出表里现有成员(分不清"没登记"与"删了行")')
})

test('T4 登记表判据两向齐全:退而被删与清单腐烂都必须有判据', () => {
  const judge = blockOf(registry, 'export function auditExportKeyRegistryIssues(')
  for (const code of [
    'R1_DUPLICATE_KID',
    'R2_MISSING_REASON',
    'R4_RETIRED_ROW_DELETED',
    'R5_ENTRY_PAST_RETENTION',
    'R6_RETIRED_WITHOUT_DEATH',
    'R7_UNUSABLE_KEY_MATERIAL',
    'R8_KID_NOT_DERIVABLE',
  ]) {
    assert.ok(judge.includes(code), `判据 ${code} 不见了`)
  }
  assert.match(judge, /undetermined\.push\(/, 'R4 判不动时必须落未判定,不得静默算通过')
  assert.match(judge, /轮换能力未启用/, '空表必须喊出来,不得报"0 违规 ⇒ 通过"')
})

test('T5 表与判据不得各写一份 kid 推导', () => {
  assert.match(
    exporter,
    /return deriveAuditExportKeyId\(publicKeyPem\)/,
    '签名侧自己算 kid ⇒ 与登记表口径分叉',
  )
  assert.ok(
    !/ihui-audit-export-\$\{sha256Hex/.test(exporter),
    'siem-exporter 里出现了第二份 kid 推导实现(两处必漂移)',
  )
})

test('T6 私钥材料必须被拒收,而不是"看不见"', () => {
  assert.match(registry, /private_key_material_forbidden/, '私钥守卫被摘线')
  assert.match(registry, /BEGIN \[A-Z \]\*PRIVATE KEY/, '私钥识别形态漂了')
})

test('T7 自检连跑两次同结论(只能跑一次的取证等于没取证)', () => {
  const run = () =>
    execFileSync(process.execPath, [SELFTEST], {
      encoding: 'utf8',
      cwd: REPO,
      timeout: 120_000,
      windowsHide: true,
    })
  const first = run()
  const second = run()
  assert.equal(first, second, '两次自检输出不一致(有状态残留)')
  const m = /通过 (\d+) \/ 共 (\d+) 条/.exec(second.trim())
  assert.ok(m, `自检没给出末行读数:${second.trim().split('\n').slice(-1)[0]}`)
  assert.equal(m[1], m[2], '自检有红项')
  assert.ok(Number(m[2]) >= 30, `自检只剩 ${m[2]} 条,判据被掏空`)
})

test('T8 登记表与取证文件不得被 .gitignore 吞掉(§23 那一型:git status 全看不见)', () => {
  // 判据不是"必须已在 HEAD 里"(本枚提交前它们当然还没入库),而是"必须**能**入库":
  // 被忽略的"受版本控制的表"是机器-local 巧合,不是证据 —— 换机/干净检出上直接消失。
  const targets = [REGISTRY, SELFTEST, VITEST, fileURLToPath(import.meta.url)]
  for (const file of targets) {
    let matched = null
    try {
      matched = execFileSync('git', ['-c', 'safe.directory=*', 'check-ignore', '-v', file], {
        encoding: 'utf8',
        cwd: REPO,
        timeout: 30_000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch (e) {
      // 退出码 1 = 没被忽略(我们要的结论);其它码 = 判不动,必须喊出来而不是当成通过
      if (e && e.status === 1) continue
      assert.fail(`check-ignore 对 ${file} 既没报"未忽略"也没正常退出:${String(e && e.status)}`)
    }
    assert.fail(`登记表/取证文件被 gitignore 命中:${file} ← ${String(matched).trim()}`)
  }
})

test('T9 接线成套性:本判据当前刻意不进提交链;若被接线,必须同时带 skipEnv', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const wired = runner.includes('audit-export-key-registry')
  if (!wired) {
    // 现状:未注册。这条断言只保证"我们知道它没接线",不阻塞主会话日后接线。
    assert.equal(wired, false)
    return
  }
  const entry = blockOf(runner, "script: 'apps/api/src/services/audit-export-key-registry.ts'")
  assert.match(entry, /mode: 'blocking'/, '接线却没定级')
  assert.match(
    entry,
    /skipEnv: 'HUSKY_SKIP_[A-Z_]+'/,
    'blocking 却没给应急出口 ⇒ 恒红门会废掉全部守门',
  )
})

test('T10 出口自证与两条公钥面共用同一份结论(路由没另写一套判定)', () => {
  const handler = blockOf(routes, 'async (request, reply) => {')
  assert.match(handler, /verifySignedAuditExport\(envelope\)/, '出口自证被摘线')
  assert.ok(!/createVerify\(/.test(routes), '路由里自己拼了一份验签 ⇒ 第二份真相')
  assert.match(handler, /status: selfCheck\.status/, '自检失败没把三态之一带进日志')
})

test('T11 保留期同源:判"能不能删行"的天数只允许有一处真相', () => {
  // 方向锁:登记表的 R5(超保留期才谈得上收行)与保留作业的 structDays 读同一个默认值 +
  // 同一个变量名。作业退回字面量 `180`/硬编码变量名时,两边会在换 env 的那天悄悄分叉 ——
  // 而分叉的表现是"旧信封再也验不过"或"该删的没删",都不是编译期症状。
  const job = readFileSync(JOB, 'utf8')
  assert.match(
    job,
    /from '\.\.\/services\/audit-export-key-registry\.js'/,
    '保留作业不再引登记表 ⇒ 保留期出现第二份真相',
  )
  assert.match(job, /AUDIT_ENVELOPE_RETENTION_DAYS_DEFAULT/, '默认值引用被摘线')
  assert.match(job, /ENVELOPE_RETENTION_ENV/, 'env 变量名引用被摘线')
  assert.ok(
    !/AUDIT_EVIDENCE_STRUCT_RETENTION_DAYS/.test(job),
    '作业里又出现了变量名字面量 ⇒ 同源断裂(登记表改名的那天它不会跟着改)',
  )
  assert.ok(!/, 180\)/.test(job), 'structDays 退回硬编码 180 ⇒ 与登记表各说各话')
})
