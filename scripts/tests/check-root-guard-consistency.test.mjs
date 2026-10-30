// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:判据一律 import 门体的 __test__,本文件不复制第二份尺子(§22c)。
// 立因:root-guard --check 只在运行时比工作树,「清单落后于已入库内容」能顺利进 HEAD,
// 而三处签出(本机/生产/远端)的部署环会同时 fail-closed(2026-10-29/30 一夜复发两次的同一型)。
// 本锁钉住:①一致判绿 ②改一字节即点名到 id ③取不到判未判定(不折绿也不折红)
// ④必备目标缩水判红 ⑤未判定优先于红 ⑥零自写尺子 ⑦注册成套 ⑧两面旗同给退 2
// ⑨自检器真跑通 ⑩门体带可解码水印。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { __test__ as GATE } from '../check-root-guard-consistency.mjs'

/** 用门体自己的夹具造被审面内容与封条,readFile 走内存 ⇒ 不依赖真仓瞬时状态(不脆)。 */
const ROOT_FAKE = '/fixture'
/** hashTarget 按**绝对路径**回调 readFile(实测钉出),故这里把绝对路径折回相对键。 */
const readerFor = (contents) => (abs) => {
  // Windows 上 resolve('/fixture', rel) 会带盘符(G:/fixture/...),故按 /fixture/ 切尾而非前缀锚。
  const norm = String(abs).replace(/\\/g, '/')
  const rel = norm.includes('/fixture/') ? norm.split('/fixture/').pop() : norm
  return rel in contents ? contents[rel] : null
}

const harness = ({ entryOverrides = {}, targets, missing = [], blind = false } = {}) => {
  const contents = GATE.fixtureFiles(entryOverrides)
  const manifest = JSON.parse(GATE.manifestDoc(targets ?? GATE.baseManifestEntries()))
  const read = readerFor(contents)
  // blind ⇒ 面上什么都取不到;missing=[后缀] ⇒ 只让命中的那份取不到(造"未判定与红并存")
  const readFile = blind
    ? () => null
    : (abs) => (missing.some((m) => String(abs).replace(/\\/g, '/').endsWith(m)) ? null : read(abs))
  return GATE.evaluateTargets({ manifest, readFile, root: ROOT_FAKE })
}

const runCli = (args) =>
  spawnSync(process.execPath, ['scripts/check-root-guard-consistency.mjs', ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })

describe('守门 267:根护栏清单 ↔ 被审面内容对账', () => {
  it('① 清单与目标逐一对上 ⇒ exit 0 / code=consistent', () => {
    const r = harness()
    assert.equal(r.exit, GATE.EXIT_OK, JSON.stringify(r.rows))
    assert.equal(r.code, 'consistent')
    assert.ok(r.rows.every((x) => x.state === 'pass'), `不该有非 pass 行:${JSON.stringify(r.rows)}`)
    assert.deepEqual(r.missingRequired, [])
  })

  it('② 任一目标内容改一字节 ⇒ 判红,且点名的是那一枚 id(不得只报总数)', () => {
    const entry = GATE.baseManifestEntries().find((t) => t.id === 'guardian-runner')
    const r = harness({
      entryOverrides: { 'scripts/guardian-runner.mjs': '// baseline runner X\n' },
    })
    assert.equal(r.exit, GATE.EXIT_BREACH)
    assert.equal(r.code, 'stale-manifest')
    const bad = r.rows.filter((x) => x.state === 'fail')
    assert.equal(bad.length, 1, `只该点名被改那一枚:${JSON.stringify(r.rows)}`)
    assert.equal(bad[0].id, entry.id)
    assert.notEqual(bad[0].actual, bad[0].expected)
  })

  it('③ 目标取不到 ⇒ 判未判定(exit 2),绝不折成绿也不折成红(§0.3)', () => {
    const r = harness({ blind: true })
    assert.equal(r.exit, GATE.EXIT_UNDETERMINED)
    assert.equal(r.code, 'unjudged')
    assert.ok(r.rows.every((x) => x.state === 'unknown'), JSON.stringify(r.rows))
    // 反向牙:空串哈希曾把"取不到"染成"清单落后"那种红 ⇒ 这里必须看不到 fail
    assert.equal(r.rows.filter((x) => x.state === 'fail').length, 0)
  })

  it('④ 必备目标在清单里缺席 ⇒ 射程缩水判红,并逐枚点名缺失 id', () => {
    const keep = GATE.REQUIRED_TARGET_IDS[0]
    const r = harness({ targets: GATE.baseManifestEntries().filter((t) => t.id === keep) })
    assert.equal(r.exit, GATE.EXIT_BREACH)
    assert.equal(r.code, 'target-missing')
    assert.deepEqual(
      r.missingRequired.slice().sort(),
      GATE.REQUIRED_TARGET_IDS.filter((id) => id !== keep).slice().sort(),
    )
  })

  it('⑤ 判序:未判定与红并存 ⇒ 必须先出未判定(把"没判成"读成裁决是禁型)', () => {
    const r = harness({
      entryOverrides: { 'scripts/lib/judgement-libs.json': '{"libs":["tampered"]}\n' },
      missing: ['AGENTS.md'],
    })
    const states = r.rows.map((x) => `${x.id}:${x.state}`)
    assert.ok(states.some((s) => s.endsWith(':fail')), `夹具没造出红:${states}`)
    assert.ok(states.some((s) => s.endsWith(':unknown')), `夹具没造出未判定:${states}`)
    assert.equal(r.exit, GATE.EXIT_UNDETERMINED, `未判定必须优先于红:${states}`)
  })

  it('⑥ 零自写尺子:门体不出现 createHash,取值走 root-guard 的 hashTarget 单源', () => {
    const src = readFileSync('scripts/check-root-guard-consistency.mjs', 'utf8')
    assert.ok(!/createHash/.test(src), '门体内不得出现第二份哈希实现(§0.6)')
    assert.match(
      src,
      /import\s*\{[^}]*\bhashTarget\b[^}]*\}\s*from\s*'\.\/root-guard\.mjs'/s,
      '取值必须从 root-guard 单源 import hashTarget',
    )
    assert.match(src, /REQUIRED_TARGET_IDS/, '必备目标集必须来自 root-guard 那一份,不在本门另立名单')
  })

  it('⑦ 注册成套:267 恰一枚、档位在册、skipEnv 成套、射程覆盖清单与每个被登记目标', () => {
    const runner = readFileSync('scripts/guardian-runner.mjs', 'utf8')
    const ids = [...runner.matchAll(/^\s*id:\s*(['"`])(.*?)\1/gm)].map((m) => m[2])
    assert.equal(ids.filter((x) => x === '267').length, 1, 'id 267 应恰出现 1 次(R5/R13 型)')
    const at = runner.search(/script:\s*(['"])check-root-guard-consistency\.mjs\1/)
    assert.ok(at > 0, '新门没进注册表 = 造好没装车(§0.9)')
    const block = runner.slice(Math.max(0, at - 900), at + 1500)
    // 档位:warn 是立档当天的既定起点(AGENTS 三面不一致窗口),升 blocking 是既定路线 ⇒
    // 这里只锁"在册且是这两个合法档之一",不把升档动作判成红。
    assert.match(block, /mode: '(warn|blocking)'/, '档位必须显式登记为 warn 或 blocking')
    assert.ok(block.includes(`skipEnv: '${GATE.SELF_SKIP}'`), 'skipEnv 必须与门体常量同字成套')
    const trig = block.match(/stagedTriggers:\s*\[([\s\S]*?)\]/)
    assert.ok(trig, '缺 stagedTriggers ⇒ 提交通道与落地通道两义(守门 253)')
    const listed = [...trig[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
    assert.ok(listed.includes(GATE.MANIFEST_REL), `射程必须含清单本体,现有:${listed}`)
    for (const t of GATE.baseManifestEntries()) {
      assert.ok(
        listed.some((x) => t.path === x || t.path.startsWith(x) || x.startsWith(t.path)),
        `射程漏了被登记目标 ${t.id}:${t.path} —— 漏一个就是给那一路开后门`,
      )
    }
  })

  it('⑧ 两面旗同给 ⇒ exit 2(不回落另一个面,§0.4)', () => {
    const r = runCli(['--staged', '--worktree'])
    assert.equal(r.status, GATE.EXIT_UNDETERMINED, r.stdout + r.stderr)
  })

  it('⑨ 自检器真跑通过(例数以本行现读为准)', () => {
    const r = runCli(['--self-test'])
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.doesNotMatch(r.stdout, /^FAIL\b/m, r.stdout)
    assert.match(r.stdout, /self-test[\s\S]{0,80}\d+\/\d+ 通过/, r.stdout)
  })

  it('⑩ 门体带可解码溯源水印(新建源文件必注水印)', () => {
    const r = spawnSync(
      process.execPath,
      ['scripts/watermark.mjs', 'verify', 'scripts/check-root-guard-consistency.mjs'],
      { encoding: 'utf8' },
    )
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
