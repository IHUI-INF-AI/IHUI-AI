// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 未签名本地打包豁免(DESKTOP_ALLOW_UNSIGNED)的回归测试。
//
// 三件事必须被钉住:
//   1. 默认(env 未设)判据一字未松 —— 缺 .sig 照样 exit 1,文案照旧(反向对照)。
//   2. 显式豁免只放行"缺当前签名"**这一项**,其余违规(缺当前包/其他版本残留)照旧判红,
//      而且"清理其他版本安装包"这一半门必须在豁免下照样执行。
//   3. desktop-build-saas 未设 env 时命令行与改版前**逐字一致**(发版/CI 零影响)。
//
// 判据分堆为什么放在纯函数层测:钩子只有一条红路径(见下方 partitionViolations 用例的注释),
// "多包共存"在钩子里的执行方式是**删除旧包**而不是判红,所以"其他判据仍判红"只能在
// 判据层用**真判据**(scripts/lib/desktop-artifact-invariant.mjs,非复制字符串)取证。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as hook } from '../desktop-artifact-single.mjs'
import { __test__ as saas } from '../desktop-build-saas.mjs'

const HOOK = fileURLToPath(new URL('../desktop-artifact-single.mjs', import.meta.url))
const ENV_KEY = 'DESKTOP_ALLOW_UNSIGNED'
const CUR = '智汇AI_0.1.44_x64-setup.exe'
const OLD = '智汇AI_0.1.45_x64-setup.exe'
const OLD2 = '智汇AI_0.1.46_x64-setup.exe'

/** 显式构造 env:先删掉同名键,保证"未设"用例不受外层 shell 环境污染 */
const envFor = (over) => {
  const e = { ...process.env }
  delete e[ENV_KEY]
  return over ? { ...e, ...over } : e
}

const runHook = (dir, expect, over) =>
  spawnSync(process.execPath, [HOOK, '--dir', dir, '--expect', expect], {
    encoding: 'utf8',
    windowsHide: true,
    env: envFor(over),
  })

const seed = (dir, names) => {
  for (const n of names) writeFileSync(path.join(dir, n), 'x')
}

// ── 1. 默认路径:缺 sig 必须红(反向对照) ──────────────────────────────────

test(`默认(env 未设):目录里只有安装包、缺 .sig → exit 1 且文案照旧`, () => {
  const dir = mkScratch('ihui-artifact-sig-default-')
  try {
    seed(dir, [CUR])
    const r = runHook(dir, CUR)
    assert.equal(r.status, 1, `默认必须判红,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.ok(r.stderr.includes('单一产物不变量被破坏'), r.stderr)
    assert.ok(r.stderr.includes(`缺少当前签名 ${CUR}.sig`), r.stderr)
    assert.ok(!`${r.stdout}${r.stderr}`.includes('未签名产物'), '默认路径不得出现任何豁免提示')
    assert.deepEqual(readdirSync(dir), [CUR], '判红时不许动目录里的文件')
  } finally {
    rmScratch(dir)
  }
})

test(`env=${ENV_KEY}=0 不算豁免(只认字面 '1')`, () => {
  const dir = mkScratch('ihui-artifact-sig-zero-')
  try {
    seed(dir, [CUR])
    const r = runHook(dir, CUR, { [ENV_KEY]: '0' })
    assert.equal(r.status, 1, `0 不是豁免值,应仍判红`)
    assert.ok(r.stderr.includes('单一产物不变量被破坏'), r.stderr)
  } finally {
    rmScratch(dir)
  }
})

// ── 2. 显式豁免:缺 sig 放行 + 必须吼出来 ─────────────────────────────────

test(`${ENV_KEY}=1:缺 .sig 放行,但必须打印"未签名产物:不得进更新源/不得发版"`, () => {
  const dir = mkScratch('ihui-artifact-sig-exempt-')
  try {
    seed(dir, [CUR])
    const r = runHook(dir, CUR, { [ENV_KEY]: '1' })
    assert.equal(r.status, 0, `豁免下应放行,实际: ${r.status}\n${r.stdout}\n${r.stderr}`)
    const out = `${r.stdout}${r.stderr}`
    assert.ok(out.includes('未签名产物'), out)
    assert.ok(out.includes('不得进更新源'), out)
    assert.ok(out.includes('不得发版'), out)
    assert.ok(out.includes(ENV_KEY), `提示里必须点名是哪个开关放行的,实际: ${out}`)
    assert.ok(out.includes(`缺少当前签名 ${CUR}.sig`), `放行的是哪一条判据要可审计,实际: ${out}`)
  } finally {
    rmScratch(dir)
  }
})

test(`${ENV_KEY}=1 且签名齐全:走原有绿灯文案,不出豁免提示`, () => {
  const dir = mkScratch('ihui-artifact-signed-ok-')
  try {
    seed(dir, [CUR, `${CUR}.sig`])
    const r = runHook(dir, CUR, { [ENV_KEY]: '1' })
    assert.equal(r.status, 0, r.stderr)
    assert.ok(!`${r.stdout}${r.stderr}`.includes('未签名产物'), '已签名产物不该被标成未签名')
    assert.deepEqual(readdirSync(dir).sort(), [CUR, `${CUR}.sig`].sort())
  } finally {
    rmScratch(dir)
  }
})

// ── 3. 豁免只放行 sig 这一项,不得把整道门关掉 ─────────────────────────────

test(`${ENV_KEY}=1 + 目录里多包共存:旧包**照删**(清理这一半门没被豁免掉)`, () => {
  const dir = mkScratch('ihui-artifact-multi-exempt-')
  try {
    seed(dir, [CUR, OLD, `${OLD}.sig`, OLD2, `${OLD2}.sig`])
    const r = runHook(dir, CUR, { [ENV_KEY]: '1' })
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(readdirSync(dir), [CUR], `其他版本包/签名必须仍被清理,实际: ${readdirSync(dir)}`)
    assert.ok(r.stdout.includes(`清理旧产物: ${OLD}`), r.stdout)
    assert.ok(r.stdout.includes('未签名产物'), '同时仍要吼未签名')
  } finally {
    rmScratch(dir)
  }
})

test(`未豁免时同样多包共存:旧包被删之后缺 sig 仍判红(门的两半都在跑)`, () => {
  const dir = mkScratch('ihui-artifact-multi-default-')
  try {
    seed(dir, [CUR, OLD, `${OLD}.sig`])
    const r = runHook(dir, CUR)
    assert.equal(r.status, 1)
    assert.deepEqual(readdirSync(dir), [CUR], '旧包已删,红的是缺签名')
    assert.ok(r.stderr.includes(`缺少当前签名 ${CUR}.sig`), r.stderr)
  } finally {
    rmScratch(dir)
  }
})

test(`${ENV_KEY}=1 不得扩大"不产 nsis 时一个文件都不许删"条款`, () => {
  const dir = mkScratch('ihui-artifact-noop-exempt-')
  const others = [OLD, `${OLD}.sig`]
  try {
    seed(dir, others)
    const r = runHook(dir, CUR, { [ENV_KEY]: '1' })
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(readdirSync(dir).sort(), others.sort(), '不属于本次构建的目录必须原样保留')
    assert.ok(!`${r.stdout}${r.stderr}`.includes('未签名产物'), '压根没产 nsis ⇒ 与签名无关,不该报豁免')
  } finally {
    rmScratch(dir)
  }
})

// 纯判据层取证:把当前签名假想补齐后仍有任何违规,就必须留在 blocking。
// 输入直接用**真判据**能产出的那些形态(缺当前包 / 其他版本残留 / 缺签名),不复制文案常量。
test('判据分堆:缺当前包(目录里躺着其他版本安装包)在豁免下仍判红', () => {
  const { partitionViolations } = hook
  const cases = [[OLD], [OLD, `${OLD}.sig`], [OLD, `${OLD}.sig`, OLD2, `${OLD2}.sig`]]
  for (const files of cases) {
    const r = partitionViolations(files, CUR, true)
    assert.equal(r.excused.length, 0, `不得放行任何一条: ${files.join(', ')}`)
    assert.ok(r.blocking.length > 0, `其他版本包在场而当前包缺席 ⇒ 必须判红: ${files.join(', ')}`)
    assert.ok(
      r.blocking.some((v) => v === `缺少当前包 ${CUR}`),
      `blocking 必须含"缺当前包"这一条(签名缺失不得被单独挑出来放行),实际: ${r.blocking.join(';')}`,
    )
  }
})

test('判据分堆:豁免只认"仅缺当前签名"一种形态', () => {
  const { partitionViolations } = hook
  const onlyMissingSig = partitionViolations([CUR], CUR, true)
  assert.deepEqual(onlyMissingSig.blocking, [])
  assert.equal(onlyMissingSig.excused.length, 1)

  assert.deepEqual(partitionViolations([CUR, `${CUR}.sig`], CUR, true), { blocking: [], excused: [] })
  // 同一份输入,开关关掉 ⇒ 违规原样退回 blocking(默认零放松)
  const strict = partitionViolations([CUR], CUR, false)
  assert.equal(strict.excused.length, 0)
  assert.equal(strict.blocking.length, 1)
})

test('开关判据:仅字面 "1" 生效', () => {
  const { allowUnsignedFrom } = hook
  for (const v of [{}, { DESKTOP_ALLOW_UNSIGNED: '' }, { DESKTOP_ALLOW_UNSIGNED: '0' }, { DESKTOP_ALLOW_UNSIGNED: 'true' }, { DESKTOP_ALLOW_UNSIGNED: '1 ' }]) {
    assert.equal(allowUnsignedFrom(v), false, JSON.stringify(v))
  }
  assert.equal(allowUnsignedFrom({ DESKTOP_ALLOW_UNSIGNED: '1' }), true)
  assert.equal(hook.allowUnsignedFrom(undefined), false)
})

// ── 4. desktop-build-saas 命令行组装 ─────────────────────────────────────

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

test(`未设 ${ENV_KEY} 时命令行与改版前逐字一致`, () => {
  const viaPnpm = saas.buildPlan({ npmExecpath: '/x/pnpm.cjs', execPath: '/node', root: REPO, allowUnsigned: false })
  assert.deepEqual(viaPnpm.args, ['/x/pnpm.cjs', '--filter', '@ihui/desktop', 'build'])
  assert.equal(viaPnpm.cmd, '/node')
  assert.equal(viaPnpm.shell, false)
  assert.equal(viaPnpm.configPath, null)
  assert.equal(viaPnpm.tail, null)

  const bare = saas.buildPlan({ execPath: '/node', root: REPO, allowUnsigned: false })
  assert.equal(bare.cmd, 'pnpm')
  assert.deepEqual(bare.args, ['--filter', '@ihui/desktop', 'build'])
  assert.equal(bare.shell, true)
  assert.ok(!bare.args.includes('--config'), '默认路径不得注入任何 --config')
})

test(`${ENV_KEY}=1:向 tauri 传绝对路径 --config,并显式补跑尾部收敛脚本`, () => {
  const plan = saas.buildPlan({ npmExecpath: '/x/pnpm.cjs', execPath: '/node', root: REPO, allowUnsigned: true })
  const i = plan.args.indexOf('--config')
  assert.ok(i >= 0, plan.args.join(' '))
  const cfg = plan.args[i + 1]
  assert.equal(cfg, plan.configPath)
  assert.ok(path.isAbsolute(cfg), `tauri 的 --config 必须是绝对路径(相对路径按 src-tauri 解析): ${cfg}`)
  assert.ok(!/[*?]/.test(cfg), '不得是通配形态')
  assert.ok(cfg.startsWith(path.join(REPO, '.ihui-agent', 'tmp') + path.sep), `临时文件必须落在仓库内: ${cfg}`)
  assert.deepEqual(plan.tail, { cmd: '/node', args: [path.join(REPO, 'scripts', 'desktop-artifact-single.mjs')] })
  assert.deepEqual(plan.args.slice(0, 5), ['/x/pnpm.cjs', '--filter', '@ihui/desktop', 'exec', 'tauri'])
  assert.deepEqual(plan.args.slice(5, 7), ['build', '--config'])
})

test('临时 config 只关 createUpdaterArtifacts,不碰其他任何发版形态字段', () => {
  const parsed = JSON.parse(saas.UNSIGNED_CONFIG_CONTENT)
  assert.deepEqual(Object.keys(parsed), ['bundle'])
  assert.deepEqual(Object.keys(parsed.bundle), ['createUpdaterArtifacts'])
  assert.equal(parsed.bundle.createUpdaterArtifacts, false)
  const raw = saas.unsignedConfigPath(REPO)
  assert.ok(path.isAbsolute(raw) && raw.startsWith(REPO), raw)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
