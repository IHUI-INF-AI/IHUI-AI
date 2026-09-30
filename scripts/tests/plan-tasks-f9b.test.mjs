// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 · 守门 130 新增维 **F9b「畸形登记号」** 与它的生产者侧防线(立项票 G-606)。
//
// 这一档要钉的是三件事,缺一不可:
//  ① 判据吃的是**真仓真实形态**(逐字取自 HEAD 面的畸形行,现读不自造)—— 只用自造夹具的判据
//     会在下一次书写形态变化时整族隐身(本仓记过两次:装饰档 ✅(日期) / 租约一开始就不被判到);
//  ② 反向用例必须齐 —— 叙述里引用一个畸形号**不得**被误拒。假阳比漏报更贵:它让每一次正常落地
//     都红,唯一结局是逼人绕开本器(AGENTS §12e);
//  ③ 判据**只能有一份实现**。生产侧(live-doc-edit 的取号令牌)与判据侧(F9b 维 / 收敛落地闸)
//     各写一遍"什么算畸形号",漂开的两个方向账面都是绿的。
//
// 变异档(⑤)按 §22c 做真变异:复制件里把判据改恒 null ⇒ 正例翻红;改恒真 ⇒ 反例翻红;
// 把生产侧那道闸摘掉 ⇒ 手加前缀那一行**当场落进 HEAD**。生产文件全程一个字节不动(§12)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import * as LIB from '../lib/plan-task-index.mjs'
import * as LDE from '../live-doc-edit.mjs'
import { malformedLine } from '../plan-tasks.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const CLI_LDE = path.join(ROOT, 'scripts', 'live-doc-edit.mjs')
const LIB_PATH = path.join(ROOT, 'scripts', 'lib', 'plan-task-index.mjs')

/** 真仓 HEAD 面(现读一次,用例内不复刻)。取面失败即抛 —— 绝不退化成"改用自造夹具继续跑"。 */
const HEAD_FACE = execFileSync(GIT, ['-c', 'safe.directory=*', 'show', 'HEAD:PROJECT_PLAN.md'], {
  cwd: ROOT,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 300000,
  maxBuffer: 1 << 28,
})

/** 按**标题**定位真仓的一行(选样动作与被判据解耦:不许用待验的尺子去挑自己的样本)。 */
function realRow(marker) {
  const hit = HEAD_FACE.split(/\r?\n/).find((l) => l.includes(marker))
  assert.ok(
    hit !== undefined,
    `真仓 HEAD 面找不到「${marker}」⇒ 该行已被清偿/搬走。本例输入必须是现读真实行,请重新采集,不得改成自造夹具。`,
  )
  return hit
}

const REAL_PLAIN = realRow('G-G-431 同型未普查的一格')
const REAL_DECORATED = realRow('G-G-419 守门 108')

// ── ① 正例:两条真仓真实畸形行,一档裸形、一档带 ✅(日期) 装饰 ─────────────────
test('① 真仓现读:族名在编号段出现两次的真实登记行必须被判到(裸形与装饰档同视)', () => {
  // 独立于判据的形状自证:任何人一眼能复核"这一行确实是族名两次"
  assert.match(REAL_PLAIN, /^- \[ \] G-G-431 /, `裸形样本行已变形态,实测 ${REAL_PLAIN.slice(0, 40)}`)
  assert.match(REAL_DECORATED, /^- \[x\] ✅\(2026-\d\d-\d\d\)G-G-419 /, '装饰档样本行已变形态')

  for (const [name, row] of [
    ['裸形', REAL_PLAIN],
    ['装饰档', REAL_DECORATED],
  ]) {
    const rows = LIB.findMalformedRows(row)
    assert.equal(rows.length, 1, `${name}:应恰好命中 1 行,实测 ${rows.length}`)
    assert.equal(rows[0].family, 'G', `${name}:族名必须原样给出(判据不认具体族名,只认形状)`)
    assert.equal(rows[0].raw, row, `${name}:必须逐字带回原文,不许截断后再报`)
    assert.equal(LIB.auditPlan(row).counts.malformedIds, 1, `${name}:计数档与逐行档必须同一把尺子`)
    assert.deepEqual(
      LIB.findMalformedIds(row).map((x) => x.family),
      ['G'],
      `${name}:按文本扫的那一把投影也必须命中(两处各判一次=本层存在的理由)`,
    )
  }

  // 剥前缀的出口在真实行上必须给出**取到主键**的结果(取不到就得交人工,不能悄悄落)
  for (const [row, wantKey] of [
    [REAL_PLAIN, 'G-431'],
    [REAL_DECORATED, 'G-419'],
  ]) {
    const s = LIB.stripMalformedPrefix(row)
    assert.ok(s, '命中畸形却没给出剥后形态 ⇒ 出口只能交人工,账面必须看得见')
    assert.equal(s.key, wantKey, `剥完的主键应为 ${wantKey},实测 ${s.key}`)
    assert.equal(
      row.length - s.stripped.length,
      2,
      `只能删掉那两个字符(多写的族名+分隔符),实测长度差 ${row.length - s.stripped.length}`,
    )
    assert.equal(LIB.findMalformedRows(s.stripped).length, 0, '剥完必须不再被判畸形(幂等)')
    assert.ok(s.stripped.includes(row.slice(-24)), '正文尾部必须逐字保留:这是"剥前缀"不是"重写这一行"')
  }
})

// ── ② 反向:叙述里引用畸形号不得误拒(票面点名的那一型) ────────────────────
const NARRATIVE = [
  '<!-- 历史遗留:G-G-431 这一枚号是取号竞态产出的,已由 G-606 立档 -->',
  '本条说明只是引用:历史上出现过 G-G-431 与 DD128 两种形态,不得照抄。',
  '- [x] ✅(2026-09-28) **一条归因更正**:上一轮把 G-G-431 读成了第二次登记,判据已收窄。',
  '- [ ] **G-431 正常登记行**:正当形态,一个族名都没有多写。',
  '- [ ] **D128 另一族的正当登记**:同上。',
  '',
].join('\n')

test('② 反向:注释/说明行/正文段落里引用一个畸形号一律不得被判畸形(假阳=每台必红=逼人绕开本器)', () => {
  assert.equal(LIB.findMalformedRows(NARRATIVE).length, 0, '叙述性引用必须零命中')
  assert.equal(LIB.auditPlan(NARRATIVE).counts.malformedIds, 0, '计数档也必须零命中')
  // 把真实畸形行的号搬进正文(编号位换成正当标题)⇒ 同一枚畸形串,判据必须放过
  const moved = `- [ ] **归因更正**:本条引用了 ${REAL_PLAIN.replace(/^- \[ \] /, '')}\n`
  assert.equal(LIB.findMalformedRows(moved).length, 0, '行首有正当主键而畸形串只在正文 ⇒ 不得命中')
  // 反向中的反向:整行原样进台账就必须命中(否则"放过叙述"是被写成"放过一切")
  assert.equal(LIB.findMalformedRows(REAL_PLAIN).length, 1, '同一枚真实行放在编号位必须命中')
})

// ── ③ 判据只有一份 ────────────────────────────────────────────────────────
test('③ 单一实现锁:生产侧(live-doc-edit)再导出的必须就是 lib 那一个对象,且它自己不再写一份', () => {
  // 对象同一性(===)比"两条正则长得像"强:改一处必然两把尺子同时动
  assert.equal(LDE.MALFORMED_ID_RE, LIB.MALFORMED_ID_RE, 'MALFORMED_ID_RE 不是同一枚对象')
  assert.equal(LDE.MALFORMED_BODY_RE, LIB.MALFORMED_BODY_RE, 'MALFORMED_BODY_RE 不是同一枚对象')
  assert.equal(LDE.findMalformedRows, LIB.findMalformedRows, 'findMalformedRows 不是同一个函数')
  assert.equal(LDE.findMalformedIds, LIB.findMalformedIds, 'findMalformedIds 不是同一个函数')
  assert.equal(LDE.newMalformed, LIB.newMalformed, 'newMalformed 不是同一个函数')
  assert.equal(LDE.malformedLine, LIB.malformedLine, '点名文案出口必须是同一个函数')
  const src = readFileSync(CLI_LDE, 'utf8')
  assert.ok(
    !/const MALFORMED_(ID|BODY)_RE\s*=/.test(src),
    'live-doc-edit 里重新定义了畸形正则 ⇒ 判据变成两份(本票要根治的正是这个)',
  )
  assert.ok(!/族名 \$\{/.test(src), '点名文案不得在本器里再拼一遍(lib malformedLine 是唯一出口)')
  assert.match(src, /from '\.\/lib\/plan-task-index\.mjs'/, '生产侧必须从 lib 引,而不是自带一份')

  // 证据文本禁令(§1):行号不得进点名文案 —— 真回归过一次(打印出 `· 5` 这种裸行号)
  const line = malformedLine({ raw: REAL_PLAIN, family: 'G', line: 10552 })
  assert.ok(!/\bL\d/.test(line), `点名文案里不得出现行号,实测 ${line}`)
  assert.ok(!/^·?\s*\d+$/.test(line), `不得退化成裸行号,实测 ${line}`)
  assert.ok(line.includes('G-G-431'), `点名必须给原文片段(修复动作就是删那两个字符),实测 ${line}`)
})

/**
 * 生产者侧的端到端夹具:临时仓 + 真 CLI(只经 LIVE_ROOT 通道,绝不碰本仓工作区与共享索引)。
 */
function ldeRepo(seedLedger) {
  const dir = mkScratch('f9b-producer-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), seedLedger, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'base')
  const head = () => run('rev-parse', 'HEAD')
  const face = () => run('show', 'HEAD:PROJECT_PLAN.md')
  const go = (fileText, mode, script = CLI_LDE) => {
    const f = join(dir, '.payload.txt')
    writeFileSync(f, fileText, 'utf8')
    const env = {
      ...process.env,
      LIVE_DOC: 'PROJECT_PLAN.md',
      LIVE_MSG: 'f9b 生产者侧用例',
      LIVE_ROOT: dir,
      LIVE_ID_REMOTE: '__no_such_remote__',
    }
    if (mode === 'replace') env.LIVE_REPLACE_FILE = f
    else env.LIVE_BLOCK_FILE = f
    return spawnSync(process.execPath, [script], {
      env,
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
    })
  }
  return { dir, run, head, face, go }
}

const SEED = '# 台账\n\n- [ ] **G-360 正常登记行**:种子。\n'

// ── ④ 装车证明:拦的是**展开后的最终行文本**,不是源文本里的字面量 ────────────
// 判据若钉在"源文本里出现了 G-G-"这一串上,会发生两件都错的事:
//  · 手加前缀写成 `G-{{NEXT_ID:G}}` 时源文本里没有 `G-G-` ⇒ 漏放行(本票每天都在产的那一型);
//  · 正文里正当引用 `G-G-354` 时源文本里有 ⇒ 误拒。
// 所以这四条必须一起跑真 CLI 才算证明。
test('④ 装车:令牌展开后的落地面才是判据对象 —— 手加前缀必拒 / 裸令牌必过 / 叙述引用不误拒 / 改写档同闸', () => {
  const { dir, head, face, go } = ldeRepo(SEED)
  try {
    // (a) 手加前缀:源文本里没有 G-G-,展开后才有 ⇒ 必须拒,而且 HEAD 一分不动
    const before = head()
    const a = go('- [ ] G-{{NEXT_ID:G}} **甲议题**:一句话。\n')
    assert.equal(a.status, 1, `手加前缀必须被拒(RC=1),实测 ${a.status}\n${a.stdout}\n${a.stderr}`)
    assert.match(a.stderr, /畸形登记编号/, '拒绝必须说清是哪一维')
    assert.match(a.stderr, /G-G-\d+/, '点名必须给**展开后**的原文(源文本里根本没有这串)')
    assert.ok(
      !/\n\s+·\s*\d+\s*$/m.test(a.stderr),
      `点名不得退化成裸行号(§1:行号每次 append 都挪位),实测 ${a.stderr.slice(0, 500)}`,
    )
    assert.match(a.stderr, /本身已含族名/, '必须把成因说到位:令牌展开值已含族名,正文别再手写')
    assert.equal(head(), before, '拒绝路径上不得产生提交')
    assert.ok(!face().includes('G-G-'), '被拒的内容一分都不许进 HEAD')

    // (b) 裸令牌:必须放行,且落地的正是单前缀号
    const b = go('- [ ] {{NEXT_ID:G}} **乙议题**:一句话。\n')
    assert.equal(b.status, 0, `裸令牌必须落地(RC=0),实测 ${b.status}\n${b.stdout}\n${b.stderr}`)
    assert.match(face(), /^- \[ \] G-\d+ \*\*乙议题\*\*/m, '落地形态必须是单族名编号')
    assert.ok(!face().includes('G-G-'), '正当取号不得被判成畸形')

    // (c) 叙述里引用真实畸形号:不得误拒
    const c = go(
      '本条只是说明:历史上出现过 G-G-431 与 DD128 两种形态,不得照抄。\n- [ ] {{NEXT_ID:G}} **丙议题**:一句话。\n',
    )
    assert.equal(c.status, 0, `叙述引用不得误拒(RC=0),实测 ${c.status}\n${c.stderr}`)
    assert.match(face(), /G-G-431 与 DD128/, '叙述那一句必须照原样落进去(工具不改写人写的内容)')

    // (d) 改写档(LIVE_REPLACE_FILE)走的是同一道闸:after 带手加前缀 ⇒ 必拒
    const beforeD = head()
    const d = go(
      JSON.stringify([
        {
          before: '- [ ] **G-360 正常登记行**:种子。',
          after: '- [ ] DD900 **改写产出的畸形**:一句话。',
        },
      ]),
      'replace',
    )
    assert.equal(d.status, 1, `改写档产出畸形必须被拒(RC=1),实测 ${d.status}\n${d.stderr}`)
    assert.match(d.stderr, /DD900/, '必须点名那一行的原文')
    assert.equal(head(), beforeD, '改写档拒绝同样不得产生提交')

    // (e) 存量只报数不拦(否则 §12e 恒红门:他人的历史债钉红每一次落地)
    const legacy = ldeRepo(`${SEED}\n- [ ] G-G-111 存量畸形行(他人历史债)。\n`)
    try {
      const e = legacy.go('- [ ] {{NEXT_ID:G}} **丁议题**:一句话。\n')
      assert.equal(e.status, 0, `存量畸形号不得钉红本次落地,实测 ${e.status}\n${e.stderr}`)
      assert.match(e.stdout, /存量畸形编号 1 行/, '存量必须**报数**(不报=看不见,与"我刚造的"同形)')
      assert.match(e.stdout, /父提交里已在/, '必须说清为什么不拦:那是他人的历史债,不是本次新增')
    } finally {
      rmScratch(legacy.dir)
    }
  } finally {
    rmScratch(dir)
  }
})

// ── ⑤ 变异档:三处各摘一次,三种红都必须出现 ────────────────────────────────
test('⑤ 变异自证:判据恒 null ⇒ 正例翻红;恒真 ⇒ 反例翻红;摘掉生产者那道闸 ⇒ 畸形号当场落进 HEAD', async () => {
  const libRaw = readFileSync(LIB_PATH, 'utf8')
  const ldeRaw = readFileSync(CLI_LDE, 'utf8')
  const FN_RE = /function malformedFamilyOf\(rawLine\) \{[\s\S]*?\n\}/
  const GUARD = 'if (mal.added.length > 0) {'
  assert.ok(FN_RE.test(libRaw), '判据函数改名/改形 ⇒ 本锁须同批改')
  assert.equal(ldeRaw.split(GUARD).length - 1, 1, '生产者那道闸改形 ⇒ 本锁须同批改')

  const copyRoot = mkScratch('f9b-mut-')
  /** 把 lib 整份复制进独立目录(相对 import 仍成立),按需变异后再 import。 */
  const mutatedLib = (tag, body) => {
    const dir = join(copyRoot, tag)
    mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
    cpSync(path.join(ROOT, 'scripts', 'lib'), join(dir, 'scripts', 'lib'), {
      recursive: true,
      filter: (s) => !/[\\/]\tests?[\\/]/.test(s),
    })
    cpSync(path.join(ROOT, 'scripts', 'check-plan-line-loss.mjs'), join(dir, 'scripts', 'check-plan-line-loss.mjs'))
    const p = join(dir, 'scripts', 'lib', 'plan-task-index.mjs')
    const src = readFileSync(p, 'utf8')
    const out = src.replace(FN_RE, `function malformedFamilyOf(rawLine) {\n  ${body}\n}`)
    assert.notEqual(out, src, `变异 ${tag} 没命中 ⇒ 本锁须同批改`)
    writeFileSync(p, out, 'utf8')
    return pathToFileURL(p).href
  }
  try {
    // A) 判据恒 null(等价于"这一维没做")⇒ ① 的正例必须全灭
    const modA = await import(mutatedLib('A', 'return null'))
    assert.equal(modA.findMalformedRows(REAL_PLAIN).length, 0, '变异面必须看不见真实畸形行(否则 ① 是空断言)')
    assert.equal(modA.auditPlan(REAL_PLAIN).counts.malformedIds, 0, '计数档同样归零')
    assert.equal(modA.findMalformedRows(REAL_DECORATED).length, 0, '装饰档同样归零')

    // B) 判据恒真(等价于"把叙述引用也算畸形")⇒ ② 的反例必须翻红
    const modB = await import(mutatedLib('B', 'return "G"'))
    assert.ok(modB.findMalformedRows(NARRATIVE).length > 0, '变异面(恒真)必须把叙述引用也判成畸形 —— 否则 ② 没有牙')
    assert.ok(modB.findMalformedRows(movedRow()).length > 0, '搬进正文的那一行同样必须被误判')

    // C) 摘掉生产者侧那道闸 ⇒ 手加前缀那一发必须**当场落进 HEAD**
    const dirC = join(copyRoot, 'C', 'scripts')
    mkdirSync(dirC, { recursive: true })
    cpSync(path.join(ROOT, 'scripts', 'lib'), join(dirC, 'lib'), {
      recursive: true,
      filter: (s) => !/[\\/]\tests?[\\/]/.test(s),
    })
    cpSync(path.join(ROOT, 'scripts', 'check-plan-line-loss.mjs'), join(copyRoot, 'C', 'scripts', 'check-plan-line-loss.mjs'))
    const ldeCopy = join(dirC, 'live-doc-edit.mjs')
    writeFileSync(ldeCopy, ldeRaw.replace(GUARD, 'if (false && mal.added.length > 0) {'), 'utf8')
    const repo = ldeRepo(SEED)
    try {
      const r = repo.go('- [ ] G-{{NEXT_ID:G}} **甲议题**:一句话。\n', undefined, ldeCopy)
      assert.equal(
        r.status,
        0,
        `摘闸后本应落地的畸形行必须真的落地(否则 ④a 测的是别的东西),实测 ${r.status}\n${r.stderr}`,
      )
      assert.match(repo.face(), /G-G-\d+/, '摘闸 ⇒ 畸形号进 HEAD,这一格就是 F9b 存在的理由')
    } finally {
      rmScratch(repo.dir)
    }
  } finally {
    rmScratch(copyRoot)
    assert.equal(readFileSync(LIB_PATH, 'utf8'), libRaw, 'lib 生产文件必须逐字未动')
    assert.equal(readFileSync(CLI_LDE, 'utf8'), ldeRaw, 'live-doc-edit 生产文件必须逐字未动')
  }
})

function movedRow() {
  return `- [ ] **归因更正**:本条引用了 ${REAL_PLAIN.replace(/^- \[ \] /, '')}\n`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
