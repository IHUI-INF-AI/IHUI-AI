// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-alpha-usage.test.mjs — §22c/§22d 镜像测试:生成器与守门 R6 必须共用一份判据,
 * 且它对**真仓 HEAD**产出的表必须逐字节等于在库的表。
 *
 * 与源脚本 `--self-test` 的分工:self-test 用内存夹具证明判据的**分支**(注释剥不剥、动态拼接归哪、
 * 表外字节动没动),本文件证明三件 self-test 结构上证不了的事:
 *  1. **装车**:源脚本确实 export 了 `__test__`、本文件确实 import 它(§22c 三阶段),
 *     以及 `isDirectRun` 真的挡住了 import 期的写盘副作用(§22d)。
 *  2. **端到端不回归**:真仓三端语料导出的表 == HEAD 里那张人工维护的表(逐字节)。
 *     这一步是"自动生成没把既有表改坏"的唯一机械证明。
 *  3. **判据有牙且非真空**:注释假用量这条必须用真文件证明 —— `bg-muted/40` 今天仍然**只**存在于
 *     packages/app 的注释里,它既不在表里、又会在全不剥注释的扫描里出现。夹具能造这个反例,
 *     但只有真仓能证明"这个坑在本仓确实还在,而判据确实跨过了它"。
 *
 * 全程只读:不写任何仓库文件(写盘路径只在 CLI 直接执行且内容真的变了才触发)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as S } from '../sync-alpha-usage.mjs'
import { __test__ as GATE } from '../check-cross-end-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const absTarget = (rel) => resolve(ROOT, rel)

/** 取真仓 HEAD blob(与生成器同一口径,绝不在测试里读工作树来做基准)。 */
function headBlob(rel) {
  return execFileSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
}

test('T1 §22c 装车:源必须 export __test__ 且键齐全,测试必须真 import 它', () => {
  const required = [
    'PLUGIN_REL',
    'USAGE_ANCHOR',
    'resolveFace',
    'locateObjectBody',
    'splitFormKey',
    'harvestForms',
    'sortMods',
    'buildUsageTable',
    'renderUsageBody',
    'spliceUsageBody',
    'diffTables',
    'assertTargetInSync',
    'verifyTable',
  ]
  for (const k of required) assert.equal(typeof S[k] !== 'undefined', true, `__test__ 缺键 ${k}`)
  const src = readFileSync(absTarget('scripts/sync-alpha-usage.mjs'), 'utf8')
  assert.match(src, /export const __test__ = \{/, '源脚本必须 export __test__(§22c phase B)')
  // §22d:import 不得触发 CLI 主流程 —— 没有这道守卫,本文件 import 的那一秒就在写仓库文件
  assert.match(src, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL/, '必须有 isDirectRun 守卫(§22d)')
  assert.match(src, /if \(isDirectRun\)/, 'CLI 主流程必须挂在 isDirectRun 之后')
})

test('T2 真仓端到端:HEAD 语料导出的表必须逐字节等于 HEAD 里那张人工表', async () => {
  const plugin = await GATE.loadAlphaPlugin(ROOT)
  const reg = GATE.readAlphaRegistry('head')
  const tiers = GATE.flattenColorTiers(reg.colors)
  const files = GATE.collectAlphaCorpus({ face: 'head' }).map((c) => ({ rel: c.rel, src: c.eff }))
  const h = S.harvestForms(files, { tiers, supportedKinds: Object.keys(plugin.ALPHA_UTILITY_KINDS) })
  const derived = S.buildUsageTable(h.forms, reg.usage)
  const rendered = S.spliceUsageBody(reg.faces.pluginTxt, derived)
  // 这一条是本票的核心结论:自动生成**复现**了人工登记 17 形态的既有结果 ⇒ 接上生成器不改变产物。
  // 若它红,说明表与用量已经分叉(有人加了用法没登记,或表里有死规则),出路只有一条:跑生成器。
  assert.equal(
    rendered,
    reg.faces.pluginTxt,
    'HEAD 语料导出的表 ≠ HEAD 的登记表 ⇒ 请跑 node scripts/sync-alpha-usage.mjs 后重验'
  )
  assert.deepEqual(Object.keys(derived).sort(), Object.keys(reg.usage).sort(), '档位集合不得变')
  assert.equal(derived.primary.bg.join(), '10')
  assert.equal(derived.muted.bg.join(), '[0.12]', '任意值形态必须以 [0.12] 原样登记,不是归并后的数值族')
})

test('T3 判据有牙(真仓阳性对照):bg-muted/40 只活在注释里,既不在表里也不得进表', async () => {
  const reg = GATE.readAlphaRegistry('head')
  const plugin = await GATE.loadAlphaPlugin(ROOT)
  const tiers = GATE.flattenColorTiers(reg.colors)
  const kinds = Object.keys(plugin.ALPHA_UTILITY_KINDS)
  const files = GATE.collectAlphaCorpus({ face: 'head' }).map((c) => ({ rel: c.rel, src: c.eff }))
  const masked = new Set(
    S.harvestForms(files, { tiers, supportedKinds: kinds }).forms.keys()
  )
  // 同一批文件、同一条抽取正则,唯一区别是**不**剥注释 —— 差集就是"注释假用量"的实证。
  const unmasked = new Set()
  for (const { rel, src } of files) {
    const isCss = /\.(css|scss)$/.test(rel)
    for (const t of GATE.extractAlphaUsages(src, { tiers, isCss, original: src }).tokens)
      if (t.onPresetTier && !t.exempt && kinds.includes(t.kind)) unmasked.add(`${t.kind}-${t.tier}/${t.mod}`)
  }
  const commentOnly = [...unmasked].filter((k) => !masked.has(k))
  assert.ok(commentOnly.includes('bg-muted/40'), `真仓语料里必须仍能举出注释假用量这一型,bg-muted/40 实得:${JSON.stringify(commentOnly)}`)
  assert.equal(masked.has('bg-muted/40'), false, 'bg-muted/40 不得进表(它就是当年被删的那条死规则)')
  assert.equal(
    Object.prototype.hasOwnProperty.call(reg.usage, 'muted') && (reg.usage.muted.bg || []).includes('40'),
    false,
    'HEAD 的登记表里不得有 bg-muted/40'
  )
})

test('T4 动态拼接不得成为用量、也不得被静默丢弃(真仓 + 构造面)', async () => {
  const plugin = await GATE.loadAlphaPlugin(ROOT)
  const reg = GATE.readAlphaRegistry('head')
  const tiers = GATE.flattenColorTiers(reg.colors)
  const files = GATE.collectAlphaCorpus({ face: 'head' }).map((c) => ({ rel: c.rel, src: c.eff }))
  const h = S.harvestForms(files, { tiers, supportedKinds: Object.keys(plugin.ALPHA_UTILITY_KINDS) })
  assert.ok(h.undeterminedLines > 0, '真仓有动态拼接 alpha 类名,判不出必须报数而不是静默')
  for (const u of h.undetermined) {
    assert.match(u.rel, /\.(tsx?|jsx?|css|scss)$/, '每条 undetermined 必须点名到具体源文件')
    assert.ok(Number.isInteger(u.line) && u.line > 0, '每条 undetermined 必须带行号')
    assert.ok(u.text.length > 0, '每条 undetermined 必须带原文片段供人工核对')
  }
  // 反向:undetermined 里任何一条都不得以"某档的某个数值"的形式混进表。
  // 动态形态的 mod/tier 是变量,结构上不可能等于下列真实档名 —— 这里用构造面把它钉死:
  const dyn = S.harvestForms(
    [{ rel: 'x.tsx', src: 'const a = <View className={`bg-${tier}/${mod}`} />' }],
    { tiers, supportedKinds: ['bg', 'text', 'border'] }
  )
  assert.equal(dyn.forms.size, 0, '动态拼接不得产出任何待登记形态')
  assert.equal(dyn.undeterminedLines, 1, '动态拼接必须计一行 undetermined')
})

test('T5 原位写回的字节边界:表外一字节都不许动', async () => {
  const plugin = await GATE.loadAlphaPlugin(ROOT)
  const reg = GATE.readAlphaRegistry('head')
  const tiers = GATE.flattenColorTiers(reg.colors)
  const files = GATE.collectAlphaCorpus({ face: 'head' }).map((c) => ({ rel: c.rel, src: c.eff }))
  const h = S.harvestForms(files, { tiers, supportedKinds: Object.keys(plugin.ALPHA_UTILITY_KINDS) })
  const next = S.buildUsageTable(h.forms, reg.usage)
  const out = S.spliceUsageBody(reg.faces.pluginTxt, next)
  const { bodyStart, bodyEnd } = S.locateObjectBody(reg.faces.pluginTxt)
  // 表体之外的部分必须逐字节相同(头注、ALPHA_UTILITY_KINDS、各函数体、导出、水印行)
  assert.equal(out.slice(0, bodyStart), reg.faces.pluginTxt.slice(0, bodyStart), '表体之前的字节被改写了')
  assert.equal(out.slice(bodyEnd), reg.faces.pluginTxt.slice(bodyEnd), '表体之后的字节被改写了')
  assert.equal(out, reg.faces.pluginTxt)
})

test('T6 幂等:第二次应用必须零改动(构造面 + 真仓两面)', async () => {
  const plugin = await GATE.loadAlphaPlugin(ROOT)
  const reg = GATE.readAlphaRegistry('head')
  const tiers = GATE.flattenColorTiers(reg.colors)
  const files = GATE.collectAlphaCorpus({ face: 'head' }).map((c) => ({ rel: c.rel, src: c.eff }))
  const h = S.harvestForms(files, { tiers, supportedKinds: Object.keys(plugin.ALPHA_UTILITY_KINDS) })
  const once = S.spliceUsageBody(reg.faces.pluginTxt, S.buildUsageTable(h.forms, reg.usage))
  // 第二次的"现表"必须从第一次的**产物**里读(而不是从内存对象复用)—— 幂等要证的是
  // "生成器能稳定吃掉自己上一次的输出",包括档位行序与缩进这些只有文本才有的信息。
  const priorFromOutput = GATE.parseLiteralObject(GATE.extractObjectBody(once, S.USAGE_ANCHOR))
  const again = S.spliceUsageBody(once, S.buildUsageTable(h.forms, priorFromOutput))
  assert.equal(again, once, '第二次写回必须与第一次逐字节相同')
  assert.deepEqual(priorFromOutput, reg.usage, '产物里的表必须还能被 R6 的解析器读回同一张表')
})

test('T7 与镜像测试夹具的兼容:非贪婪 \\n} 正则必须整张表捕住', async () => {
  // 兄弟测试 check-cross-end-tokens.test.mjs 用 /export const ALPHA_USAGE = \{[\s\S]*?\n\}/ 改写真文件搭夹具。
  // 生成器若把表渲染成"每档对象各占多行、闭合顶格",那条正则会截断成半张表 —— 夹具会拿着半张表去判红/判绿,
  // 而**真仓判据照旧绿**(它读的是完整文件),即"两边都不红"那一类。这里用那条正则本身验。
  const txt = headBlob(S.PLUGIN_REL)
  const hit = /export const ALPHA_USAGE = \{[\s\S]*?\n\}/.exec(txt)
  assert.ok(hit, '锚点必须能被非贪婪正则捕到')
  const parsed = GATE.parseLiteralObject(GATE.extractObjectBody(hit[0], S.USAGE_ANCHOR))
  const whole = GATE.parseLiteralObject(GATE.extractObjectBody(txt, S.USAGE_ANCHOR))
  assert.deepEqual(parsed, whole, '夹具正则捕到的内容必须等于整张表(不得截断)')
})

test('T8 取材口径:--face worktree 必须拒(不提供 R6 之外的第二套口径)', () => {
  assert.throws(() => S.resolveFace('worktree'), GATE.UndeterminedError)
  assert.throws(() => S.resolveFace('nonsense'), GATE.UndeterminedError)
  assert.equal(S.resolveFace('head'), 'head')
  assert.equal(S.resolveFace('staged'), 'staged')
})

test('T9 写回闸:表外有未提交改动必须拒绝;只有表体不同必须放行', () => {
  const host = 'export const ALPHA_USAGE = {\n  primary: { bg: ["10"] },\n}\nexport const K = 1\n'
  const tableOnly = 'export const ALPHA_USAGE = {\n  primary: { bg: ["20"] },\n}\nexport const K = 1\n'
  const outsideTouched = 'export const ALPHA_USAGE = {\n  primary: { bg: ["10"] },\n}\nexport const K = 2\n'
  assert.equal(S.assertTargetInSync({ worktreeText: tableOnly, faceText: host, rel: 'x', force: false }).ok, true, '只有表体不同必须放行(否则第一次写回就自我封锁)')
  const guard = S.assertTargetInSync({ worktreeText: outsideTouched, faceText: host, rel: 'x', force: false })
  assert.equal(guard.ok, false, '表外有未提交改动必须拒绝')
  assert.match(guard.reason, /无法判定/)
  assert.equal(S.assertTargetInSync({ worktreeText: outsideTouched, faceText: host, rel: 'x', force: true }).ok, true, '--force 只降级为警告')
})

test('T10 CLI:import 无写盘副作用,--self-test/--help 退出码正确,--face worktree 退 2', () => {
  const before = readFileSync(absTarget(S.PLUGIN_REL), 'utf8')
  const cli = (args) => {
    try {
      const out = execFileSync(process.execPath, [absTarget('scripts/sync-alpha-usage.mjs'), ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300_000,
      })
      return { code: 0, out }
    } catch (e) {
      return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }
    }
  }
  assert.equal(cli(['--self-test']).code, 0, '判据自检必须全绿')
  assert.equal(cli(['--help']).code, 0, '--help 恒 0')
  const bad = cli(['--face', 'worktree'])
  assert.equal(bad.code, 2, '--face worktree 必须按"无法判定"退 2,而不是冒 0 或冒 1')
  assert.match(bad.out, /无法判定/)
  // 只读承诺:以上四次调用(import 与 CLI --self-test/--help/--face)都不得碰目标文件
  assert.equal(readFileSync(absTarget(S.PLUGIN_REL), 'utf8'), before, '测试期间目标文件被改写 ⇒ 只读承诺破裂')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
