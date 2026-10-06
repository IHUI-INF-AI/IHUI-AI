// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-portal-fixed.mjs`(createPortal 定位守门,2026-09-07 立)。
 *
 * 本文件**不写任何判据**:被审对象的形态(定位类名、inline position 写法、style 引用外部变量的
 * 降级条件、扩展名清单)全部由门体导出的 `gate` 裁定(AGENTS.md §22c 红线 + 守门 191
 * `check-test-judge-not-replicated.mjs` 的 F1/F2)。测试只提供**面**与**结论断言**。
 *
 * 断言输入逐字取自真仓 HEAD(经 `scripts/lib/face-reader.mjs` 的 `catBatch` 现取 HEAD blob),
 * 不用自造夹具当主证 —— 否则镜像测试只是在复读实现(§22c「回声机」教训)。需要"命中/不命中"两面
 * 而 HEAD 面只有一面时,用**内存构造面**(把 HEAD 文本在内存里改一行)证明有牙,绝不改盘上门体;
 * 需要落盘时一律落 `scripts/lib/scratch-dir.mjs`(§26 唯一落点),不往仓库树里写夹具。
 *
 * 用例清单:
 *  T1 真仓 HEAD 判红面(portal-panel.tsx 的 createPortal 块)+ 反向对照:补 inline position ⇒ 放行;
 *     改回原行 ⇒ 又判红。证明这条断言不是恒真。
 *  T2 真仓 HEAD 合规两面(add-menu-popover 走 inline position / context-usage-ring 走定位类)⇒ 各 0 处。
 *  T3 style 引用外部变量 ⇒ 降级 WARN(级别本身就是判据);类名补定位 ⇒ WARN 也消失。
 *  T4 两条入口同判:同一 HEAD blob 走 `gate.scanFile`(读盘)与走 `gate.checkPortalElement`(内存面)
 *     结论必须逐字一致;另含 createPortal(<变量>, …) 的放过臂。
 *  T5 `gate.walk` / `gate.SCAN_EXTS`:扩展名口径、排除目录、缺目录空返,全由门体裁定。
 *  T6 装车证明(全量档):把 HEAD 面的 apps/web/src 整体铺进 scratch,以它为工作树跑门体 CLI,
 *     CLI 报出的站点集合必须等于 `gate` 对同一面的读数 ⇒ 那一处判红是**既有存量**,不是新债,
 *     也不得为变绿去改门体或删站点。
 *  T7 装车证明(--staged 档):临时 git 仓里 staged 一枚违规面 ⇒ exit 1,staged 合规面 ⇒ exit 0。
 *  T8 共享 index 实况:pre-commit 档读的是**别的会话此刻 staged 的东西**,加载期量能力探测,
 *     探测不过整条跳过 —— 跳过不等于通过,测试名里写明"这一维此刻不判"。
 *
 * 派生一律 `windowsHide: true` + `stdio: ['ignore','pipe','pipe']`(AGENTS.md §12g)。
 * 本机 Node v24.19 的 `node:test` 没有 `it.skipIf`(实测 `typeof it.skipIf === 'undefined'`),
 * 等价形状是 `it(name, { skip: <原因字符串 | false> }, fn)`,下面按这一形状写。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-portal-fixed.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_CLI = join(REPO, 'scripts', 'check-portal-fixed.mjs')
const WEB_SRC_REL = 'apps/web/src'

/** 真仓 HEAD 在册路径(逐字取自 `git ls-tree -r HEAD` / `git grep HEAD` 的实测输出)。 */
const DEBT_REL = 'apps/web/src/components/feedback/portal-panel.tsx'
const INLINE_OK_REL = 'apps/web/src/components/chat/add-menu-popover.tsx'
const CLASS_OK_REL = 'apps/web/src/components/ai/context-usage-ring.tsx'
const NON_SOURCE_REL = 'apps/web/app/globals.css'

const HEAD_BLOBS = catBatch(REPO, [DEBT_REL, INLINE_OK_REL, CLASS_OK_REL, NON_SOURCE_REL].map((p) => `HEAD:${p}`))

function head(rel) {
  const text = HEAD_BLOBS.get(`HEAD:${rel}`)
  assert.equal(typeof text, 'string', `HEAD 面取不到 ${rel} —— 判不了就点名,绝不回落成自造夹具`)
  return text
}

/** 面内定位:第一个包含 needle 的行下标(0 基),找不到返回 -1。 */
function lineIdx(lines, needle, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i
  }
  return -1
}

/** 造一面:把第 idx 行换成 repl(只动内存副本,盘上面一个字都不改)。 */
function replaceLine(lines, idx, repl) {
  assert.ok(idx >= 0 && idx < lines.length, `构造面下标越界:${idx}`)
  return lines.map((l, i) => (i === idx ? repl : l))
}

function judge(lines, startIdx, rel) {
  const findings = []
  gate.checkPortalElement(lines, startIdx, rel, findings)
  return findings
}

function toFwd(p) {
  return String(p).split(sep).join('/')
}

/** 生产扫描面口径:扩展名清单现取 gate.SCAN_EXTS,不在测试里重述。 */
function inScanScope(rel) {
  return gate.SCAN_EXTS.some((e) => rel.endsWith(e))
}

/** 走门体的两条真门:walk 出文件集,scanFile 出结论。 */
function judgeFiles(pairs) {
  const findings = []
  for (const { abs, rel } of pairs) gate.scanFile(abs, rel, findings)
  return findings
}

function gitRead(args, cwd = REPO) {
  return spawnSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', cwd, ...args],
    {
      encoding: 'utf8',
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 1 << 26,
    },
  )
}

function runCli(args, cwd) {
  const r = spawnSync(process.execPath, [GATE_CLI, ...args], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300_000,
    maxBuffer: 1 << 26,
  })
  return { rc: r.status, out: String(r.stdout ?? ''), err: String(r.stderr ?? '') }
}

/** 门体 CLI 点名的站点行,形如 `  <file>:<line> — <msg>`(WARN 与 FAIL 同形,按站点集合比对)。 */
function reportedSites(stdout) {
  const out = []
  for (const rawLine of stdout.split('\n')) {
    if (!rawLine.startsWith('  ')) continue
    const body = rawLine.slice(2)
    const dash = body.indexOf(' — ')
    if (dash < 0) continue
    const colon = body.indexOf(':')
    if (colon <= 0 || colon > dash) continue
    const file = body.slice(0, colon)
    const num = Number(body.slice(colon + 1, dash))
    if (file && Number.isInteger(num)) out.push(`${file}:${num}`)
  }
  return out.sort()
}

// ── 加载期一次性把 HEAD 面铺成可比对的数据(供 T6/T7 复用)──────────────
const HEAD_SCOPE_LIST = (() => {
  const r = gitRead(['ls-tree', '-r', '--name-only', 'HEAD', '--', WEB_SRC_REL])
  if (r.status !== 0) return { ok: false, reason: `HEAD 清单枚举失败(exit=${r.status})`, files: [], blobs: null }
  const files = String(r.stdout || '').split('\n').filter(Boolean).filter(inScanScope)
  const blobs = catBatch(REPO, files.map((p) => `HEAD:${p}`))
  const unreadable = files.filter((p) => typeof blobs.get(`HEAD:${p}`) !== 'string')
  if (unreadable.length > 0) {
    return { ok: false, reason: `HEAD 面 ${unreadable.length} 个文件取不到,首个:${unreadable[0]}`, files, blobs }
  }
  return { ok: true, reason: '', files, blobs }
})()

/**
 * 加载期同步量出的能力探测(T8 用):pre-commit 档读的是**共享 index 的瞬时状态**,
 * 只有当暂存面里没有生产扫描口径的文件时,结论才与别的会话无关。探测不过 ⇒ 整条跳过并点名。
 */
function probeStagedFace() {
  const r = gitRead(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  if (r.status !== 0) return { ok: false, reason: `暂存面枚举失败(git exit=${r.status})` }
  const staged = String(r.stdout || '').split('\n').filter(Boolean).map(toFwd)
  const inScope = staged.filter(inScanScope)
  return inScope.length === 0
    ? { ok: true, reason: '' }
    : { ok: false, reason: `暂存面里有 ${inScope.length} 个扫描口径文件(首个:${inScope[0]}),结论由他人决定` }
}
const STAGED_PROBE = probeStagedFace()

function layFace(dir, pairs) {
  for (const { rel, text } of pairs) {
    const abs = join(dir, ...rel.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
}

describe('check-portal-fixed · §22c 镜像测试(判据一律走门体导出的 gate)', () => {
  it('T1 真仓 HEAD 逐字面判红 + 补 inline position 的反向对照(有牙证明,内存构造面)', () => {
    const lines = head(DEBT_REL).split('\n')
    const startIdx = lineIdx(lines, 'createPortal(')
    assert.ok(startIdx >= 0, 'HEAD 面里应能找到 createPortal 调用行(找不到 = 面变了,先怀疑尺子)')
    const findings = judge(lines, startIdx, DEBT_REL)
    assert.equal(findings.length, 1, `真实存量面应判出 1 处,实得 ${JSON.stringify(findings)}`)
    const f = findings[0]
    assert.equal(f.level, 'FAIL')
    assert.equal(f.file, DEBT_REL)
    const divIdx = lineIdx(lines, '<div', startIdx)
    assert.ok(divIdx >= 0, 'HEAD 面里 createPortal 之后应有容器元素行')
    assert.equal(f.line, divIdx + 1, '报的行号必须落在容器元素那一行')
    assert.ok(lines[f.line - 1].includes('<div'), '同一判据反过来钉住"行号指向容器行"这一读法')

    const styleIdx = lineIdx(lines, 'style={{')
    assert.ok(styleIdx >= 0, 'HEAD 面里应有一行 style={{ … }}')
    const fixed = replaceLine(lines, styleIdx, "      style={{ position: 'fixed', top: 0, left: 0 }}")
    assert.deepEqual(judge(fixed, startIdx, DEBT_REL), [], '补上 inline position 后仍判红 = 判据没牙')
    assert.equal(
      judge(replaceLine(fixed, styleIdx, lines[styleIdx]), startIdx, DEBT_REL).length,
      1,
      '改回 HEAD 原行后必须重新判红(否则上一句的放行是断言恒真,不是判据生效)',
    )
  })

  it('T2 真仓 HEAD 合规两面(inline position / 定位类)⇒ 各 0 处,尺子不冤枉真代码', () => {
    for (const rel of [INLINE_OK_REL, CLASS_OK_REL]) {
      const lines = head(rel).split('\n')
      const startIdx = lineIdx(lines, 'createPortal(')
      assert.ok(startIdx >= 0, `${rel} 的 HEAD 面里应有 createPortal 调用行`)
      assert.deepEqual(judge(lines, startIdx, rel), [], `${rel} 在 HEAD 上已合规,判红就是尺子漂开`)
    }
  })

  it('T3 style 引用外部变量 ⇒ 降级 WARN;类名补定位 ⇒ WARN 也消失(级别与两支都由 gate 裁)', () => {
    const lines = head(DEBT_REL).split('\n')
    const startIdx = lineIdx(lines, 'createPortal(')
    const styleIdx = lineIdx(lines, 'style={{')
    const classIdx = lineIdx(lines, 'className={')
    const warnFace = replaceLine(lines, styleIdx, '      style={panelStyleExtern}')
    const findings = judge(warnFace, startIdx, DEBT_REL)
    assert.equal(findings.length, 1)
    assert.equal(findings[0].level, 'WARN', '引用外部变量的容器应降级 WARN 而不是阻塞')
    const okFace = replaceLine(
      replaceLine(lines, styleIdx, '      style={panelStyleExtern}'),
      classIdx,
      '      className="fixed z-popover"',
    )
    assert.deepEqual(judge(okFace, startIdx, DEBT_REL), [], '定位写进类名后仍报警 = 类名那一臂没牙')
  })

  it('T4 两条入口同判:同一 HEAD blob 走 gate.scanFile(读盘)与 gate.checkPortalElement(内存面)结论逐字一致', () => {
    const scratch = mkScratch('ihui-portal-fixed-t4-')
    try {
      const rels = [DEBT_REL, INLINE_OK_REL, CLASS_OK_REL]
      layFace(scratch, rels.map((rel) => ({ rel, text: head(rel) })))
      for (const rel of rels) {
        const abs = join(scratch, ...rel.split('/'))
        const disk = []
        gate.scanFile(abs, rel, disk)
        const lines = head(rel).split('\n')
        const startIdx = lineIdx(lines, 'createPortal(')
        const mem = startIdx >= 0 ? judge(lines, startIdx, rel) : []
        assert.deepEqual(disk, mem, `${rel}:同一面两条入口给出不同结论 = 门体内两条真相`)
      }

      // 放过臂(构造面,不落仓库树):第一参写成变量引用时静态不可追 ⇒ 整行不判
      const lines = head(DEBT_REL).split('\n')
      const varFace = replaceLine(
        lines,
        lineIdx(lines, 'createPortal('),
        '  return createPortal(panelElement, document.body)',
      )
      const varRel = `${WEB_SRC_REL}/constructed-var-face.tsx`
      layFace(scratch, [{ rel: varRel, text: varFace.join('\n') }])
      const findings = []
      gate.scanFile(join(scratch, ...varRel.split('/')), varRel, findings)
      assert.deepEqual(findings, [], 'createPortal(<变量>, …) 那一臂应放过(门体注释写明静态不可追)')

      // 反向对照:同一构造面只把变量换成容器元素 ⇒ 判据必须立刻有反应
      const hitFace = replaceLine(varFace, lineIdx(varFace, 'createPortal('), '  return createPortal(<div role="menu" />, document.body)')
      const hitRel = `${WEB_SRC_REL}/constructed-hit-face.tsx`
      layFace(scratch, [{ rel: hitRel, text: hitFace.join('\n') }])
      const hit = []
      gate.scanFile(join(scratch, ...hitRel.split('/')), hitRel, hit)
      assert.equal(hit.length, 1, '构造面里容器缺定位却没判 = 放过臂宽到了不该宽的地方')
    } finally {
      rmScratch(scratch, { bestEffort: true })
    }
  })

  it('T5 gate.walk / gate.SCAN_EXTS:扩展名口径、排除目录、缺目录空返都由门体裁定', () => {
    const scratch = mkScratch('ihui-portal-fixed-t5-')
    try {
      const root = join(scratch, 'apps', 'web', 'src')
      const text = head(DEBT_REL)
      const layout = [
        ['keep/a.tsx', text],
        ['keep/b.jsx', text],
        ['keep/c.ts', 'export const x = 1'],
        ['keep/d.md', '# 说明'],
        ['node_modules/e.tsx', text],
        ['.turbo/f.tsx', text],
      ]
      layFace(root, layout.map(([relp, body]) => ({ rel: relp, text: body })))
      const found = gate.walk(root).map(toFwd)
      assert.ok(found.some((p) => p.endsWith('keep/a.tsx')), 'walk 应收 .tsx')
      assert.ok(found.some((p) => p.endsWith('keep/b.jsx')), 'walk 应收 .jsx')
      assert.ok(!found.some((p) => p.endsWith('keep/c.ts')), 'walk 不该收 .ts')
      assert.ok(!found.some((p) => p.endsWith('keep/d.md')), 'walk 不该收 .md')
      assert.ok(!found.some((p) => p.includes('node_modules')), 'walk 必须跳过依赖目录')
      assert.ok(!found.some((p) => p.includes('.turbo')), 'walk 必须跳过构建产物目录')
      assert.deepEqual(gate.walk(join(scratch, 'does-not-exist')), [], '目录不存在必须空返而不是抛')

      // 扩展名清单由真仓在册路径裁定:源码面进、样式面不进(不在测试里重述清单)
      assert.ok(inScanScope(DEBT_REL), '真仓 portal-panel.tsx 应被生产清单收进扫描面')
      assert.ok(inScanScope(INLINE_OK_REL), '真仓 add-menu-popover.tsx 同样应被收进扫描面')
      assert.ok(!inScanScope(NON_SOURCE_REL), '真仓 globals.css 不属这套扫描面(收进去就是判据漂开)')
      assert.ok(inScanScope('x.jsx'), '门体清单里 jsx 与 tsx 同权(构造面才走得进 T4 的 hit 臂)')
    } finally {
      rmScratch(scratch, { bestEffort: true })
    }
  })

  it(
    'T6 装车证明(全量档):HEAD 面整体铺进 scratch 后,CLI 读数必须等于 gate 对同一面的读数',
    {
      skip: HEAD_SCOPE_LIST.ok
        ? false
        : `能力探测未过:${HEAD_SCOPE_LIST.reason} —— HEAD 面取不齐就不下结论,不回落成自造夹具`,
    },
    () => {
      const scratch = mkScratch('ihui-portal-fixed-t6-')
      try {
        const rels = HEAD_SCOPE_LIST.files
        layFace(scratch, rels.map((rel) => ({ rel, text: HEAD_SCOPE_LIST.blobs.get(`HEAD:${rel}`) })))
        const walked = gate.walk(join(scratch, ...WEB_SRC_REL.split('/'))).map(toFwd)
        assert.equal(walked.length, rels.length, 'walk 在铺好的 HEAD 面上必须收齐(漏收=扫描面自己漂开)')

        const findings = judgeFiles(rels.map((rel) => ({ rel, abs: join(scratch, ...rel.split('/')) })))
        const fails = findings.filter((f) => f.level === 'FAIL')
        const { rc, out } = runCli([], scratch)
        assert.equal(typeof rc, 'number', 'CLI 没有退出码 = 没跑成,不记绿')
        assert.deepEqual(
          reportedSites(out),
          findings.map((f) => `${f.file}:${f.line}`).sort(),
          'CLI 点名的站点集合与 gate 对同一面的读数不等价(两面同料必须同判)',
        )
        assert.equal(rc, fails.length > 0 ? 1 : 0, `FAIL ${fails.length} 处时退出码应为 ${fails.length > 0 ? 1 : 0},实得 ${rc}`)
        assert.equal(fails.length, 1, `HEAD 面读数应恰有 1 处 FAIL(实得 ${JSON.stringify(fails)})`)
        assert.equal(fails[0].file, DEBT_REL, '那一处必须就是 portal-panel 的既有存量,不是别处新长出来的')
      } finally {
        rmScratch(scratch, { bestEffort: true })
      }
    },
  )

  it(
    'T7 装车证明(--staged 档):临时 git 仓里 staged 违规面 ⇒ exit 1,staged 合规面 ⇒ exit 0',
    () => {
      const cases = [
        { name: '违规面', rel: DEBT_REL, expectRc: 1 },
        { name: '合规面', rel: INLINE_OK_REL, expectRc: 0 },
      ]
      for (const c of cases) {
        const repo = mkScratch('ihui-portal-fixed-t7-')
        try {
          assert.equal(gitRead(['init', '--quiet'], repo).status, 0, '临时仓 init 失败')
          assert.equal(gitRead(['config', 'user.email', 'gate-test@example.invalid'], repo).status, 0)
          assert.equal(gitRead(['config', 'user.name', 'gate-test'], repo).status, 0)
          layFace(repo, [{ rel: c.rel, text: head(c.rel) }])
          assert.equal(gitRead(['add', '--', c.rel], repo).status, 0, '临时仓 add 失败')
          const { rc, out } = runCli(['--staged'], repo)
          assert.equal(rc, c.expectRc, `${c.name}:--staged 档退出码应为 ${c.expectRc},实得 ${rc} / 输出 ${out.slice(0, 200)}`)
          if (c.expectRc === 1) {
            assert.deepEqual(reportedSites(out), [`${c.rel}:${lineIdx(head(c.rel).split('\n'), '<div', lineIdx(head(c.rel).split('\n'), 'createPortal(')) + 1}`])
          }
        } finally {
          rmScratch(repo, { bestEffort: true })
        }
      }
    },
  )

  it(
    'T8 共享 index 实况档:pre-commit 读的是别的会话此刻 staged 的东西(扫描面内有 staged 文件时,这一维此刻不判)',
    {
      skip: STAGED_PROBE.ok
        ? false
        : `能力探测未过:${STAGED_PROBE.reason} —— 扫的是别人正在飞的暂存面,跳过不等于通过`,
    },
    () => {
      const { rc, out } = runCli(['--staged'], REPO)
      assert.equal(typeof rc, 'number', 'CLI 没有退出码 = 没跑成,不记绿')
      assert.equal(rc, 0, `扫描面内没有 staged 源码时 --staged 档应放行,实得 rc=${rc} / ${out.slice(0, 240)}`)
      assert.deepEqual(reportedSites(out), [], '无暂存源码却有站点被点名 = 档读错了面')
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
