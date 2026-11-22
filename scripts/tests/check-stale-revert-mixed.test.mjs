// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 84 R1s「混合陈旧底稿」镜像测试(P86,§22c:直接 import 源模块的 `__test__`,不复制判据)。
 *
 * 票面现场:枚 `6534b09698` 吞掉他人已入库的 55 枚行,已由 `4710182cc9` 回补。当时 R1(整 blob
 * 逐字节等祖先)看不见 —— 暂存内容是 `陈旧底稿 ⊕ 本次新增`,逐字节不等于任何祖先;R1r 也看不见
 * —— 被吞的行**不在**暂存内容里,R1r 只数"暂存有而 HEAD 无"的复活行。
 *
 * 用例成对设计(M2/M3 是同一夹具的一红一绿):
 *  M1 纯陈旧(整文件逐字节等祖先)仍归 R1:不许因为新判据上线而把 R1 的结论吞掉。
 *  M2 混合体无理由 ⇒ R1s 判红、点名路径并给出可直接复用的删除指纹;同时 R1 必须不响(证明这是新格)。
 *  M3 同一夹具带 `intentional-delete:` 逐行指纹 ⇒ 放行(理由通道真的接上了,不是恒红)。
 *  M4 同一夹具走具名台账 `scripts/data/intentional-deletions.jsonl` ⇒ 放行(第二条通道)。
 *  M5 差值棘轮:同一形态删 2 行(≤ HEAD 侧存量)只报数、删 6 行(> 存量)判红(极限与对照)。
 *  M6 理由面坏(台账 JSON 解不开)⇒ exit 2 未判定,不得记绿也不得冒红。
 *  M7 形状锁:理由短语与行级差集只能引 lib 那一份实现,门体不得自抄字面量。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../check-stale-revert.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const SRC = join(import.meta.dirname, '..', 'check-stale-revert.mjs')

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function repo() {
  const dir = mkScratch('stale-revert-mixed-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false')
  return { dir, run }
}

/** 长于 RESURRECT_MIN_LINE_LEN(12)的稳定行 —— 骨架行不计证据,夹具必须用"有证据"的行。 */
const row = (n) => `- [ ] task row ${String(n).padStart(4, '0')} · pending · owner=alice-2026`
const rows = (from, to) => Array.from({ length: to - from }, (_, i) => row(from + i))
const OLD_BLOCK = ['old block 1111 keep-or-drop', 'old block 2222 keep-or-drop']
const NEW_LINE = '- [ ] my own brand new row 9999 · pending'

/**
 * 四枚提交的链(锚点必须非零,否则"差值棘轮"这一维根本量不到):
 *   A: rows 0..5
 *   B: A + OLD_BLOCK
 *   C: B + rows 6..9        ← HEAD^
 *   D: A + rows 6..9 + `}`  ← HEAD(把 OLD_BLOCK 两行删掉:HEAD 侧自身存量 = 2)
 * `}` 这一行是为了让"骨架行不计证据但必须报数"那一支有夹具(去空白后 < 12 字)。
 */
function buildChain(dir, run) {
  const A = rows(0, 6)
  const SIX_NINE = rows(6, 10)
  put(dir, 'doc.txt', [...A].join('\n') + '\n')
  run('add', '-A')
  run('commit', '-qm', 'A: 底稿')
  put(dir, 'doc.txt', [...A, ...OLD_BLOCK].join('\n') + '\n')
  run('commit', '-qam', 'B: 加一块旧块')
  put(dir, 'doc.txt', [...A, ...OLD_BLOCK, ...SIX_NINE].join('\n') + '\n')
  run('commit', '-qam', 'C: 别人加了 4 行')
  put(dir, 'doc.txt', [...A, ...SIX_NINE, '}'].join('\n') + '\n')
  run('commit', '-qam', 'D: 删掉旧块两行')
  return { A, SIX_NINE }
}

/** 陈旧底稿形态:基于 A(而非 HEAD)再施加自己的新增 ⇒ 别人的 4 行被静默吞掉。 */
function stageMixed(dir, run, A, extra = NEW_LINE) {
  put(dir, 'doc.txt', [...A, extra].join('\n') + '\n')
  run('add', '--', 'doc.txt')
}

test('M1 纯陈旧(整文件逐字节等于祖先)仍归 R1 —— 新判据不得吞掉旧结论', () => {
  const { dir, run } = repo()
  try {
    buildChain(dir, run)
    // 把 C(HEAD^)那一版原样写回暂存区:R1 的老形态(整 blob 等祖先)。
    put(dir, 'doc.txt', [...rows(0, 6), ...OLD_BLOCK, ...rows(6, 10)].join('\n') + '\n')
    run('add', '--', 'doc.txt')
    const r = G.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 1, '纯陈旧必须仍是红(exit 1)')
    assert.match(out, /暂存内容等于其\*\*历史提交版本\*\*/)
    assert.match(out, /- doc\.txt {2}== {2}[0-9a-f]{9}/, 'R1 必须逐枚点名路径与回到的版本')
  } finally {
    rmScratch(dir)
  }
})

test('M2 混合体无理由 ⇒ R1s 判红并点名(同一枚 R1 反而不响,证明这是新格)', () => {
  const { dir, run } = repo()
  try {
    const { A } = buildChain(dir, run)
    stageMixed(dir, run, A)
    const r = G.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 1, '混合体吞行必须判红')
    assert.match(out, /\[R1s\]/, '红块必须带 R1s 标记')
    assert.match(out, /❌ \[R1s\] 检出 1 个路径/, '必须报出被吞的路径数')
    assert.match(
      out,
      /- doc\.txt {2}无理由删掉 4 行\(HEAD 侧自身存量 2 行\)/,
      '红行必须点名路径/本次量/存量',
    )
    assert.match(out, /↳ [0-9a-f]{12} {2}- \[ \] task row 0006/, '必须给出可直接复用的删除指纹')
    assert.doesNotMatch(
      out,
      /暂存内容等于其\*\*历史提交版本\*\*/,
      '混合体不等于任何祖先 ⇒ R1 结构上看不见',
    )
    assert.match(out, /另有 1 行骨架\/样板行/, '骨架行必须单独报数(不许静默折掉)')
  } finally {
    rmScratch(dir)
  }
})

test('M3 同一夹具带 `intentional-delete:` 逐行指纹 ⇒ 放行(理由通道真的接上,不是恒红)', () => {
  const { dir, run } = repo()
  try {
    const { A, SIX_NINE } = buildChain(dir, run)
    stageMixed(dir, run, A)
    const lines = [row(6), row(7), row(8), row(9)]
      .map((l) => `  ${G.deletionReasonHint(l)}`)
      .join('\n')
    const message = `refactor: 有意清掉 four rows\n\nintentional-delete:\n${lines}\n`
    assert.equal(SIX_NINE.length, 4)
    const r = G.audit(dir, { staged: true, message })
    const out = r.lines.join('\n')
    assert.equal(r.code, 0, `带逐行理由必须放行,实际:${out}`)
    assert.doesNotMatch(out, /❌ \[R1s\]/)
    assert.match(out, /✅ 反回退守门通过/)
  } finally {
    rmScratch(dir)
  }
})

test('M4 同一夹具走具名台账(sha256 前缀 + 出处)⇒ 放行;台账不存正文', () => {
  const { dir, run } = repo()
  try {
    const { A, SIX_NINE } = buildChain(dir, run)
    stageMixed(dir, run, A)
    const body = SIX_NINE.map((l) =>
      JSON.stringify({
        sha256: G.lineFingerprint(l).slice(0, 12),
        path: 'doc.txt',
        reason: '这四行是测试夹具里被有意清掉的,逐行核对过',
      }),
    ).join('\n')
    put(dir, G.INTENTIONAL_DELETIONS_FILE, `// 说明行可以存在\n${body}\n`)
    const r = G.audit(dir, { staged: true })
    assert.equal(r.code, 0, `台账逐行登记必须放行,实际:${r.lines.join('\n')}`)
    assert.doesNotMatch(r.lines.join('\n'), /❌ \[R1s\]/)
    // 红线:台账只住摘要,任何一行都不得含被删行正文
    const ledger = readFileSync(join(dir, G.INTENTIONAL_DELETIONS_FILE), 'utf8')
    assert.ok(!ledger.includes(SIX_NINE[0]), '台账里出现了被删行正文(违规)')
  } finally {
    rmScratch(dir)
  }
})

test('M5 差值棘轮:同形态删 2 行 ≤ HEAD 侧存量 ⇒ 只报数;删 4 行 > 存量 ⇒ 判红', () => {
  const { dir, run } = repo()
  try {
    const { A } = buildChain(dir, run)
    // 只丢两行(8/9,底稿仍是 A)⇒ 无理由删行 2 = HEAD 侧存量 2 ⇒ 只报数,不判红
    put(dir, 'doc.txt', [...A, ...rows(6, 8), NEW_LINE].join('\n') + '\n')
    run('add', '--', 'doc.txt')
    const r = G.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 0, `存量内必须放行,实际:${out}`)
    assert.match(out, /\[R1s 只报数\] 1 个路径/)
    assert.match(out, /无理由删 2 行\(HEAD 侧存量 2 行\)/)
    assert.doesNotMatch(out, /❌ \[R1s\]/, '存量不得判红(否则恒红门)')

    // 同一夹具再多丢两行(总 4 > 存量 2)⇒ 变多即判红
    stageMixed(dir, run, A)
    const r2 = G.audit(dir, { staged: true })
    assert.equal(r2.code, 1, '删得比 HEAD 那一步多 ⇒ 必须判红')
    assert.match(r2.lines.join('\n'), /无理由删掉 4 行\(HEAD 侧自身存量 2 行\)/)
  } finally {
    rmScratch(dir)
  }
})

test('M6 理由面取不到(台账形状坏)⇒ exit 2 未判定,既不记绿也不冒红', () => {
  const { dir, run } = repo()
  try {
    const { A } = buildChain(dir, run)
    stageMixed(dir, run, A)
    put(dir, G.INTENTIONAL_DELETIONS_FILE, '{"sha256": "not json at all"\n')
    const r = G.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 2, `未判定必须 exit 2(实际 ${r.code})`)
    assert.match(out, /❓ \[R1s 未判定\] 1 个路径/)
    assert.match(out, /删除理由台账坏/)
    // 结论行即便在场,也必须带着"未判定"尾注 —— 不许被读成一份干净的合格证
    const verdict = out.split('\n').filter((l) => l.includes('反回退守门通过'))
    assert.ok(
      verdict.every((l) => /处未判定/.test(l)),
      `"没判"不得被写成"通过":${verdict.join(' | ')}`,
    )
    // 与"台账缺席"成对:取不到文件 ≠ 形状坏 —— 缺席按零条目判(此处空台账 ⇒ 走判红而不是未判定)
    put(dir, G.INTENTIONAL_DELETIONS_FILE, '')
    assert.equal(G.audit(dir, { staged: true }).code, 1, '台账为空是"零条目",不是"未判定"')
  } finally {
    rmScratch(dir)
  }
})

test('M7 形状锁:理由短语与行级差集只引 lib 那一份,门体不得自抄字面量', () => {
  const code = readFileSync(SRC, 'utf8')
  const lib = readFileSync(
    join(import.meta.dirname, '..', 'lib', 'intentional-deletions.mjs'),
    'utf8',
  )
  assert.match(
    lib,
    /import \{ INTENTIONAL_DELETE_MARKER, hasIntentionalMarker \} from '\.\/deletion-intent\.mjs'/,
    '理由短语必须从 lib/deletion-intent 引(与门 168 / 逐字回潮对账同源)',
  )
  assert.match(
    code,
    /INTENTIONAL_DELETIONS_FILE,\n\s*deletionLineReason,/,
    '门体必须从 lib/intentional-deletions 取理由面(不得自带第二份实现)',
  )
  assert.match(code, /lineDeltaMaps,/, '行级多重集差必须走 lib 的 lineDeltaMaps')
  assert.equal(
    (code.match(/'intentional-delete:'/g) ?? []).length,
    0,
    '门体里不得出现第二份短语字面量(注释里提可以,代码里不许)',
  )
  assert.equal(
    (lib.match(/readFileSync\s*\(/g) ?? []).length,
    1,
    '理由面读盘只许一处(门体一个都没有 —— 被审正文一律走 face-reader)',
  )
  assert.match(code, /function auditInner\(repoRoot, opts = \{\}\)/, 'audit 必须能接 message 面')
})

test('M8 纯新增文件(HEAD 侧无此路径)⇒ R1s 按定义不判,不冒红也不落未判定', () => {
  const { dir, run } = repo()
  try {
    buildChain(dir, run)
    put(dir, 'brand-new.txt', [...rows(20, 25), NEW_LINE].join('\n') + '\n')
    run('add', '--', 'brand-new.txt')
    const r = G.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 0, `纯新增必须放行,实际:${out}`)
    assert.doesNotMatch(out, /❌ \[R1s\]/, '新增文件没有"HEAD 有而暂存无"的行 ⇒ 不得判红')
    assert.doesNotMatch(out, /\[R1s 未判定\]/, '按定义不判 ≠ 没判成')
  } finally {
    rmScratch(dir)
  }
})

test('M9 纯删除整文件 ⇒ 走既有 warn 口径(rc=0),不得被 R1s 读成"丢行"', () => {
  const { dir, run } = repo()
  try {
    buildChain(dir, run)
    put(dir, 'obsolete.txt', [...rows(40, 46)].join('\n') + '\n')
    run('add', '--', 'obsolete.txt')
    run('commit', '-qm', 'E: 加一枚待删文件', '--', 'obsolete.txt')
    run('rm', '-q', '--', 'obsolete.txt')
    const r = G.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 0, `纯删除整文件是合法操作,实际:${out}`)
    assert.match(out, /本次暂存删除 1 个 HEAD 中存在的路径/, '既有的删除告警必须仍在')
    assert.doesNotMatch(out, /\[R1s/, '整文件删除不进入 R1s 的任何一桶(不是"混合底稿")')
  } finally {
    rmScratch(dir)
  }
})

test('M10 反向例:提交信息只写"具名理由"字样、无逐行证据 ⇒ 仍判红(不是文案门)', () => {
  const { dir, run } = repo()
  try {
    const { A } = buildChain(dir, run)
    stageMixed(dir, run, A)
    // 票面举例的形态:有票号、有区间、有"票已结清",但没有任何一行能被机械复核。
    const message = 'chore: PROJECT_PLAN 摘除 L12345-12400 票已结清\n'
    const r = G.audit(dir, { staged: true, message })
    const out = r.lines.join('\n')
    assert.equal(r.code, 1, `没有逐行证据的"说法"不得放行,实际:${out}`)
    assert.match(out, /❌ \[R1s\] 检出 1 个路径/)
    assert.match(out, /↳ [0-9a-f]{12}/, '必须给出可复核的指纹形态,而不是叫人去补一句理由')
  } finally {
    rmScratch(dir)
  }
})

test('M11 信息面在场但无 `intentional-delete:` 段 ⇒ 与"信息面取不到"不同,仍按无理由判红', () => {
  const { dir, run } = repo()
  try {
    const { A } = buildChain(dir, run)
    stageMixed(dir, run, A)
    const r = G.audit(dir, { staged: true, message: 'feat: 只是普通提交信息\n' })
    const out = r.lines.join('\n')
    assert.equal(r.code, 1)
    assert.match(out, /❌ \[R1s\]/)
    assert.doesNotMatch(out, /本轮\*\*提交信息面取不到\*\*/, '信息面明明在场,不得报成取不到')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
