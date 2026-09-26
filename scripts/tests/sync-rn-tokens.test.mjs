// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/sync-rn-tokens.test.mjs — `scripts/sync-rn-tokens.mjs` 的 §22c 镜像测试。
 *
 * 与 `--self-test` 的分工:自检判**夹具上的判据**(可派生面、写回形态、拒绝分支);
 * 本文件判**真仓上的装车**——
 *  ① 真 tokens.css + 真 rn-tokens.ts 跑一次计划必须是「零写回、零拒绝、标记在位」;
 *  ② 该红的真红:把受管档改成另一个颜色,判据必须立刻点名那一档并把它改回来;
 *  ③ 不得误伤端内档:把不可派生档也一起改脏,写回后它们必须原样不动;
 *  ④ 只读档(--check / --list)不得动文件(第一版 `--list` 声称零副作用却照样落盘);
 *  ⑤ §22c 锚点 + 「取值只经一份实现」的反重复锁。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as sync } from '../sync-rn-tokens.mjs'
import { __test__ as crossEnd } from '../check-cross-end-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'sync-rn-tokens.mjs')
const RN_REL = sync.RN_TOKENS_REL
const CSS_REL = sync.TOKENS_SOURCE_REL

const run = (args, encoding = 'utf8') => {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding,
      windowsHide: true,
      timeout: 120_000,
    })
    return { code: 0, out }
  } catch (e) {
    return {
      code: e.status === undefined ? -1 : e.status,
      out: `${e.stdout ?? ''}${e.stderr ?? ''}`,
    }
  }
}

const realPlan = (text = readFileSync(join(ROOT, RN_REL), 'utf8')) => {
  const tables = sync.readTokenTables(readFileSync(join(ROOT, CSS_REL), 'utf8'))
  const plan = sync.planDerivation({ rnText: text, light: tables.light, dark: tables.dark })
  sync.assertSameLeafSets(text, plan.spansByTable)
  return plan
}

test('T1 真仓装车:零写回、零拒绝、三处受管标记都已在位', () => {
  const plan = realPlan()
  assert.equal(plan.refusals.length, 0, `拒绝项必须为 0,实得:${JSON.stringify(plan.refusals)}`)
  assert.equal(
    plan.changes.length,
    0,
    `派生面已与源一致才会写回 0 处,实得:${JSON.stringify(plan.changes)}`,
  )
  assert.equal(plan.markerInserts.length, 0, '三张表的 rn-tokens:managed 标记必须都已在位')
  assert.ok(
    plan.tables.every((t) => t.managed > 0),
    `每张表都得有可派生档,实得:${JSON.stringify(plan.tables)}`,
  )
})

test('T2 可派生面有下限且与逐档状态自洽(静默削窄即红;门扩面只会抬高,不设上限)', () => {
  const plan = realPlan()
  const derived = plan.entries.filter((e) => /^derived-/.test(e.status))
  assert.equal(
    plan.managedCount,
    derived.length,
    '合计必须等于逐档状态计数,否则有一档被重复计或漏计',
  )
  // 下限取 2026-09-25 立项实测值 87:门 MAPPINGS 若被扩,这里只会更绿不会更红。
  assert.ok(
    plan.managedCount >= 87,
    `可派生档不得少于立项实测 87,实得 ${plan.managedCount} —— 少一档就是有人把映射或推导链改断了`,
  )
  assert.ok(
    plan.unmanaged.length > 0,
    '不可派生清单必须非空且逐档带原因(全绿=面被并进了不该进的范围)',
  )
  for (const u of plan.unmanaged)
    assert.ok(
      typeof u.reason === 'string' && u.reason.length > 10,
      `不可派生档缺原因:${u.table} ${u.path}`,
    )
})

test('T3 该红的真红:受管档改脏 ⇒ 立刻点名那一档并写回源值;不可派生档同样改脏 ⇒ 一个字都不动', () => {
  const original = readFileSync(join(ROOT, RN_REL), 'utf8')
  const plan = realPlan(original)
  assert.equal(plan.changes.length, 0, '前置:真仓当前无待写回项')

  // 挑一档受管的(三张表都有 brand.cta ← --color-cta;2026-09-26 起亮 #000000 / 暗 #ffffff)
  // 与一档不可派生的(overlay.modal)各改脏。
  const dirty = original
    .replace(/cta: '#(?:000000|ffffff)'/g, "cta: '#BADBEE'")
    .replace(/modal: 'rgba\(0,0,0,0\.4\)'/g, "modal: 'rgba(9,9,9,0.9)'")
  assert.notEqual(dirty, original, '夹具必须真的改到两处')
  const p2 = realPlan(dirty)
  const hits = p2.changes.filter((c) => c.path === 'brand.cta')
  assert.equal(hits.length, 3, `三张表各有一处 brand.cta 待写回,实得:${hits.length}`)
  for (const h of hits) {
    const want = h.table === 'rnDarkTokens' ? '#ffffff' : '#000000'
    assert.equal(h.to, want, '写回值必须等于源(tokens.css 同主题 --color-cta)')
  }
  assert.ok(
    !p2.changes.some((c) => c.path === 'overlay.modal'),
    '不可派生档不得被顺手改写 —— 误伤端内档就是本门的返工条件',
  )

  const applied = sync.applyPlan(dirty, p2)
  assert.ok(applied.includes("modal: 'rgba(9,9,9,0.9)'"), '端内档必须逐字节留在原位')
  assert.ok(!applied.includes('#BADBEE'), '受管档的脏值必须已被写回覆盖')
  assert.equal(realPlan(applied).changes.length, 0, '写回后再判必须零漂移(幂等)')
  assert.equal(sync.applyPlan(applied, realPlan(applied)), applied, '第二次写回必须逐字节相同')
})

test('T4 写回不破坏溯源载荷(§5c):横幅行与文件尾行逐字节不变,且改动面只在受管字面量上', () => {
  const original = readFileSync(join(ROOT, RN_REL), 'utf8')
  const dirty = original.replace(/cta: '#(?:000000|ffffff)'/g, "cta: '#BADBEE'")
  const p2 = realPlan(dirty)
  const applied = sync.applyPlan(dirty, p2)
  const lines = (s) => s.split('\n')
  assert.equal(lines(applied).length, lines(dirty).length, '写回不得增删行')
  const diff = lines(applied).filter((l, i) => l !== lines(dirty)[i])
  assert.equal(diff.length, p2.changes.length, '改动行数必须恰好等于待写回档数(不牵连别处)')
  assert.equal(
    applied.split('\n').slice(0, 3).join('\n'),
    dirty.split('\n').slice(0, 3).join('\n'),
    'L1/L2 横幅不得被动',
  )
  assert.equal(
    applied.split('\n').slice(-1).join('\n'),
    dirty.split('\n').slice(-1).join('\n'),
    'L3 文件末尾不可见行不得被动',
  )
})

test('T5 只读档零副作用:--check 与 --list 都不得改动目标文件', () => {
  const before = readFileSync(join(ROOT, RN_REL), 'utf8')
  const c = run(['--check'])
  assert.equal(c.code, 0, `--check 应判一致并 exit 0,实得 ${c.code}:${c.out}`)
  const l = run(['--list'])
  assert.equal(l.code, 0, `--list 应 exit 0,实得 ${l.code}:${l.out}`)
  assert.match(l.out, /不可派生清单/, '--list 必须打印逐档台账')
  assert.equal(
    readFileSync(join(ROOT, RN_REL), 'utf8'),
    before,
    '只读档不得写盘(第一版 --list 会写)',
  )
})

test('T6 自检与 CLI 形态:--self-test 全过、--help 可用、被 import 不触发主流程', () => {
  const st = run(['--self-test'])
  assert.equal(st.code, 0, `self-test 必须全通过:${st.out.slice(-600)}`)
  assert.match(st.out, /self-test 全通过/, '自检结论行必须在')
  assert.ok(!/❌/.test(st.out), '自检不得有失败条')
  const h = run(['--help'])
  assert.equal(h.code, 0, '--help 必须可用')
  // 走到这里本身即是证明:测试 import 了源模块,而源模块的 main() 只在 isDirectRun 时执行。
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(
    src,
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL/,
    '§22d 守卫',
  )
  assert.match(src, /if \(isDirectRun\)/, '§22d 入口挂点')
  assert.match(src, /export const __test__ = \{/, '§22c phase B:必须导出 __test__')
  for (const k of [
    'planDerivation',
    'applyPlan',
    'readTokenTables',
    'assertSameLeafSets',
    'maskTs',
    'locateTable',
  ])
    assert.ok(Object.keys(sync).includes(k), `§22c phase B:__test__ 必须含键 ${k}`)
  assert.match(
    readFileSync(join(ROOT, 'scripts', 'tests', 'sync-rn-tokens.test.mjs'), 'utf8'),
    /import \{ __test__ as sync \} from '\.\.\/sync-rn-tokens\.mjs'/,
    '§22c phase C:测试必须直接 import 源实现,不得复制一份',
  )
})

test('T7 反重复锁:取值只经一份实现,可派生面只取守门的声明', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(
    src,
    /from '\.\/lib\/design-token-blocks\.mjs'/,
    '必须复用 tokens.css 取块/取值的唯一实现',
  )
  assert.match(src, /collectVars\(/, '源侧取值必须走该实现的 collectVars')
  // 本脚本不得自带第二份 CSS 变量名正则(`--[\w-]` 这一串字面量出现即说明在重抄取值逻辑)
  assert.doesNotMatch(src, /--\[\\w-\]/, '不得在源侧解析里重抄第二份 CSS 变量正则')
  assert.match(
    src,
    /from '\.\/check-cross-end-tokens\.mjs'/,
    '可派生面必须取自守门的声明,不自立第二张映射表',
  )
  assert.match(src, /crossEnd\.MAPPINGS/, '必须复用门的已声明配对')
  assert.match(
    src,
    /crossEnd\.deriveCssVarNames\(/,
    '必须复用门 R4 的同名推导,不自写第二套推导规则',
  )
  assert.match(src, /crossEnd\.colorsAgree\(/, '等值判定必须走门的 HSL 舍入容差口径')
  assert.match(src, /crossEnd\.normalizeColor\(/, '写回形态必须走门的归一实现')
  // 有牙的反重复锁:把归一/比较逻辑抄进本脚本即红(两处各写一遍 = 其中一遍必然腐烂)
  assert.doesNotMatch(
    src,
    /function (hslToHex|toRgbTriple|normalizeColor|colorsAgree|deriveCssVarNames)\(/,
    '不得在本地重抄门的归一 / 比较 / 推导逻辑',
  )
  assert.doesNotMatch(src, /const RN_TO_CSS\s*=\s*\{/, '不得自立第二张映射表')
})

test('T8 与门同面:派生器认作已同步的每一档,用门自己的 colorsAgree 复算也必须等值', () => {
  const plan = realPlan()
  const tables = sync.readTokenTables(readFileSync(join(ROOT, CSS_REL), 'utf8'))
  const derived = plan.entries.filter((e) => e.status === 'derived-in-sync')
  assert.ok(derived.length > 0, '前置:必须有受管档')
  for (const e of derived) {
    const table = e.table === 'rnDarkTokens' ? tables.dark : tables.light
    assert.ok(e.srcVar in table, `${e.table} ${e.path} 的源变量 ${e.srcVar} 不在真值表里`)
    assert.ok(
      crossEnd.colorsAgree(e.value, table[e.srcVar]),
      `派生器判已同步而门判漂移(两台尺子分叉):${e.table} ${e.path} = ${e.value} vs ${e.srcVar} = ${table[e.srcVar]}`,
    )
  }
  // 已登记分歧的三档必须仍留在不可派生清单里(门 BASE_CONFLICTS 与派生器同向,不得被抹平)
  for (const p of ['surface.light', 'warning.DEFAULT', 'danger.bright'])
    assert.ok(
      plan.unmanaged.some(
        (u) => u.table === 'rnDarkTokens' && u.path === p && /BASE_CONFLICTS/.test(u.reason),
      ),
      `rnDarkTokens.${p} 应因 BASE_CONFLICTS 登记而不被派生(被抹平即为越权)`,
    )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T9 modelType / agentName 是派生态:同名推导自动命中,改源一档三表跟着改(正向对照)', () => {
  const paths = [
    'modelType.text',
    'modelType.textBg',
    'modelType.image',
    'modelType.imageBg',
    'modelType.av',
    'modelType.avBg',
    'agentName.DEFAULT',
  ]
  const tables = ['rnTokens', 'rnLightTokens', 'rnDarkTokens']
  const plan = realPlan()
  for (const p of paths)
    for (const t of tables) {
      const e = plan.entries.find((x) => x.table === t && x.path === p)
      assert.ok(e, `${t}.${p} 必须在派生台账里(不在 = 这一档仍是手抄)`)
      assert.match(e.status, /^derived-/, `${t}.${p} 状态应为可派生,实得 ${e.status}`)
      assert.ok(
        !plan.unmanaged.some((u) => u.table === t && u.path === p),
        `${t}.${p} 不得落进不可派生清单`,
      )
    }
  // agentName 走的是「DEFAULT 折叠成父名」那条推导(仓内没有 --color-agent-name-default)
  const an = plan.entries.find((x) => x.table === 'rnTokens' && x.path === 'agentName.DEFAULT')
  assert.equal(an.srcVar, '--color-agent-name', '必须推到父名档,而不是臆造另一个变量')

  // 正向对照:改**源**的一档(内存夹具,绝不写真文件)⇒ 三张表都跟着产生写回
  const css = readFileSync(join(ROOT, CSS_REL), 'utf8')
  const changed = css.split('--color-model-type-image: #c41e7a;').join('--color-model-type-image: #ff00aa;')
  assert.ok(css !== changed, '夹具必须真的改到源(且 @theme 与 .dark 两处都改,明暗同值档成对声明)')
  const t2 = sync.readTokenTables(changed)
  const p2 = sync.planDerivation({ rnText: readFileSync(join(ROOT, RN_REL), 'utf8'), light: t2.light, dark: t2.dark })
  const hits = p2.changes.filter((c) => c.path === 'modelType.image')
  assert.equal(hits.length, 3, `三张表各一处待写回,实得 ${hits.length}`)
  for (const h of hits) assert.equal(h.to, '#ff00aa', '写回值必须等于新源值')
  assert.equal(
    p2.changes.filter((c) => /^modelType\./.test(c.path) && c.path !== 'modelType.image').length,
    0,
    '只许动被改的那一档,不得牵连兄弟键',
  )
  // 幂等:写回后再判必须零漂移
  const applied = sync.applyPlan(readFileSync(join(ROOT, RN_REL), 'utf8'), p2)
  const t3 = sync.readTokenTables(changed)
  assert.equal(
    sync.planDerivation({ rnText: applied, light: t3.light, dark: t3.dark }).changes.length,
    0,
    '按源写回后必须逐档收敛',
  )
})
