// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 84 的「巡检档」镜像测试(G-806 续,§22c:直接 import 源模块,不复制实现)。
 *
 * 票面:窗口扩容的前置是先量成本 —— 本文件钉四件事:
 *  P1 成本读数:audit 每轮输出尾行必须带机器可 grep 的 `[成本读数]` 行(耗时 / 逐路径祖先
 *     取材次数 / 祖先提交总量 / 窗口截断数)。没有它,扩容定档永远靠体感。
 *  P2 截断报名:浅窗口用尽(确证窗外还有)时仍须点名路径与窗口值(`⚠️ [窗口截断]`);但 R1 自
 *     2026-10-25 起走深档(窗口用尽回落全历史)⇒ 同一夹具的回写必须**判红**并点名,不得再喊
 *     「R1 未判定」/结论行不得带"窗口不足"尾注(深档已判过)。反向对照:浅历史路径不得虚报截断。
 *  P3 巡检档三档:`runWindowProbe`/`renderProbe` 每档读数齐全、形状可 grep、深档取到更多提交,
 *     且默认三档 = ×1/×2/×8(40/80/320)。
 *  P4 probe 只读:跑完 probe 再判,同一夹具的判定结果与未跑过完全一致,默认窗口不被改动
 *     (ANCESTOR_WINDOW 仍 40 —— 扩容定档是下一票,本票只补读数与报名)。
 *  P5 深档取材失败:删掉第二老提交的 loose object(浅窗口取不到、全历史会读到)⇒ 该路径逐条
 *     「未判定」且 code 2(不折绿也不折红),不因一枚坏对象把整轮拖垮;P6 正常仓 code 0 且
 *     输出里没有任何未判定行(防"一派未判定"恒红)。
 *  P7-P10(2026-11-05 第二轮)把同一套语义钉到**全量档**(工作树/HEAD 面,非 --staged):
 *     P7 深档取材失败 ⇒ 进程 exit 2 + 逐条点名 + 无 ✅(全量档并不因 classifyWorktree 整轮失明);
 *     P8 深档成功 + 窗口外回写 ⇒ 仍被点名(⚠️ [全量档·只报数不拦]),但退出码按 §12e 仍是 0
 *        —— 盘上副本属机器状态,提交门禁由 --staged 面按索引 blob 拦;
 *     P9 正常仓全量档 ⇒ 0 且无任何未判定行;P10 同轮混合(确定性红 + 深档未判定)⇒ 红优先 exit 1,
 *        且未判定照常逐条打出、不得被红掩盖。退出码一律取**子进程真实退出码**(audit → process.exit)。
 *
 * 跑法:node --test scripts/tests/check-stale-revert-g806.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-stale-revert.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function repo() {
  const dir = mkScratch('stale-revert-g806-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false')
  return { dir, run }
}

/** 造 depth 枚"动过 rel"的提交(每次整文件替换成单行 v<i>),与 window 镜像测试同源;
 *  返回全部提交 sha —— P2 要点名回到的 v1,P5 要精准删掉第二老那枚的 loose object。
 *  P10 传 lineOf 把行做长:复活行判据会滤掉过短的"噪声行",短行夹具会把"未判"误读成"判过"。 */
function buildDepth(dir, run, rel, depth, lineOf = (i) => `v${i}\n`) {
  put(dir, rel, lineOf(1))
  run('add', '-A')
  run('commit', '-qm', `${rel} v1`)
  const shas = [run('rev-parse', 'HEAD')]
  for (let i = 2; i <= depth; i++) {
    put(dir, rel, lineOf(i))
    run('commit', '-qam', `${rel} v${i}`)
    shas.push(run('rev-parse', 'HEAD'))
  }
  return shas
}

/**
 * 进程级退出码(不是只调导出函数):子进程 import 真实门体模块 → 调 audit(夹具仓, 档位)
 * → `process.exit(r.code)`。main() 对 `--staged`/默认档的映射正是 `process.exit(code)` 同一处
 * (源码形状见 window 测试 W5 的 `code: failed ? 1 : ...` 锁),故这里拿到的就是进程退出码;
 * 夹具仓无须整棵 scripts 镜像(cwd 不参与 repoRoot 解析,repoRoot 由本调用显式传入)。
 */
function auditProcess(dir, staged) {
  const mod = new URL('../check-stale-revert.mjs', import.meta.url).href
  try {
    const out = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const r = (await import(process.env.G84_MOD)).audit(process.env.G84_REPO, { staged: process.env.G84_STAGED === '1' }); process.stdout.write(r.lines.join('\\n')); process.exit(r.code)`,
      ],
      {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, G84_MOD: mod, G84_REPO: dir, G84_STAGED: staged ? '1' : '0' },
      },
    )
    return { code: 0, out }
  } catch (e) {
    return {
      code: typeof e.status === 'number' ? e.status : 'spawn-error',
      out: String(e.stdout ?? ''),
      err: String(e.stderr ?? ''),
    }
  }
}

/**
 * 成本读数的字段名取自**门体导出的那一份**(`COST_READOUT_FIELDS` 正是 `renderCostLine`
 * 自己拼行时用的顺序表)。§22c:测试里再写一遍字段名就是第二份真相 —— 门加/改字段那天
 * 测试照绿,而读数(给窗口扩容定档用的唯一账面)从此没人看守。
 * 字段**值的判据**仍留在本文件:抄字段名是复制判据,写"必须 ≥1"才是本测试要证的事。
 */
const readoutField = (name) => {
  assert.ok(
    gate.COST_READOUT_FIELDS.includes(name),
    `门体导出的成本读数字段清单里没有 ${name} ⇒ 读数形状已换,本锁必须跟着改而不是放过`,
  )
  return name
}

test('P1 成本读数:audit 输出必须带机器可 grep 的 [成本读数] 行(耗时/取材次数/截断数,窗口截断计 1)', () => {
  const { dir, run } = repo()
  try {
    buildDepth(dir, run, 'deep.ts', gate.ANCESTOR_WINDOW + 5)
    put(dir, 'deep.ts', 'v1\n') // 写回第 1 枚:在窗口外,必然触发窗口截断
    run('add', '--', 'deep.ts')
    const r = gate.audit(dir, { staged: true })
    const costLine = r.lines.find((l) => l.includes('[成本读数]'))
    assert.ok(costLine, `必须有成本读数行,实得:${r.lines.join(' | ').slice(0, 300)}`)
    // 字段名取自门体那一份(见文件头 readoutField);值谓词仍是本测试自己的事。
    assert.match(costLine, new RegExp(`${readoutField('mode')}=staged`), '档位必须随调用面如实报')
    assert.match(
      costLine,
      new RegExp(`${readoutField('paths')}=[1-9]`),
      '判定路径数必须 ≥1(本夹具恰 1 条)',
    )
    assert.match(
      costLine,
      new RegExp(`${readoutField('elapsed_ms')}=[\\d.]+`),
      '必须有耗时读数',
    )
    assert.match(
      costLine,
      new RegExp(`${readoutField('git_log')}=[1-9]`),
      '必须有逐路径祖先取材次数(深路径必取)',
    )
    assert.match(
      costLine,
      new RegExp(`${readoutField('ancestor_commits')}=[1-9]`),
      '必须有祖先提交总量(≈cat-file 规模)',
    )
    assert.match(
      costLine,
      new RegExp(`${readoutField('window_truncated')}=1`),
      `deep.ts 深于窗口 ⇒ 截断数必须为 1,实得:${costLine}`,
    )
    // 成本读数与截断报名必须同源:报名块点名了几条路径,读数就计几条。
    const named = r.lines.filter((l) => l.trim().startsWith('- deep.ts: 窗口'))
    assert.equal(
      named.length >= 1 && new RegExp(`${readoutField('window_truncated')}=1`).test(costLine),
      true,
      '报名块与 window_truncated 计数必须一致',
    )
  } finally {
    rmScratch(dir)
  }
})

test('P2 截断报名:浅窗口用尽但深档已回落全历史 ⇒ 回写必须判红并点名;截断报名与浅历史不虚报仍在', () => {
  const { dir, run } = repo()
  try {
    const shas = buildDepth(dir, run, 'deep.ts', gate.ANCESTOR_WINDOW + 5)
    const first9 = shas[0].slice(0, 9)
    // 先量语义前提(不是顺着输出抄):浅窗口确凿用尽;深档回落全历史后能取到最老那枚 v1。
    // 依据见 check-stale-revert.mjs 深档块(L405-418):"窗口用尽 ⇒ 回落到全历史,把'没判'变成'判过'"。
    const shallow = gate.ancestorWindow(dir, 'deep.ts')
    assert.equal(shallow.shas.length, gate.ANCESTOR_WINDOW)
    assert.equal(shallow.truncated, true, '夹具前提:该路径动过的提交必须深于浅窗口')
    const deep = gate.ancestorWindow(dir, 'deep.ts', { deep: true })
    assert.equal(deep.truncated, false, '全历史取得 ⇒ 已不是"窗口不足"')
    assert.equal(deep.shas.length, gate.ANCESTOR_WINDOW + 5)
    assert.equal(
      deep.shas[gate.ANCESTOR_WINDOW + 4].slice(0, 9),
      first9,
      '全历史必须取到最老那枚(v1)',
    )

    put(dir, 'deep.ts', 'v1\n')
    run('add', '--', 'deep.ts')
    const loss = []
    const v = gate.analyze(dir, ['deep.ts'], { windowLoss: loss })
    assert.deepEqual(v, [{ path: 'deep.ts', commit: first9 }], '深档已取证 ⇒ 必须判红并点名 v1')
    assert.deepEqual(loss, [], '深档真把它判出来了 ⇒ 不得再喊"窗口不足"')
    const r = gate.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 1, '浅窗口外的回写在深档下必须拦(旧期望 code 0 的前提已随深档失效)')
    assert.ok(
      r.lines.some((l) => l.includes('deep.ts') && l.includes(first9)),
      '必须点名路径与回到的版本',
    )
    assert.match(out, /⚠️\s*\[窗口截断\]/, 'R1r 侧仍走浅窗口:截断发生必须报名,不得静默')
    assert.ok(out.includes('deep.ts'), '必须点名路径')
    assert.ok(
      out.includes(`窗口 ${gate.ANCESTOR_WINDOW} 枚用尽`),
      `必须点名窗口值(${gate.ANCESTOR_WINDOW}),实得:${out.slice(0, 400)}`,
    )
    assert.match(out, /\[R1r 未覆盖\]/, 'R1r 的"窗口用尽/未覆盖"仍须在场(未覆盖 ≠ 通过)')
    assert.ok(
      out.includes(`祖先窗口(${gate.ANCESTOR_WINDOW} 枚)已用尽`),
      'R1r 的点名必须写清窗口枚数与该路径更早版本未取',
    )
    assert.doesNotMatch(out, /\[R1 未判定\]/, '深档已判 ⇒ 不得再挂"未判定"')
    assert.doesNotMatch(out, /窗口不足未判定\(R1\)/, '深档已判 ⇒ 结论行不得带"窗口不足"尾注')
    // 文案反向锁:旧句「深于窗口的回写判不到」在 R1 深档生效后是错的 —— 同一路径明明已判红点名。
    assert.doesNotMatch(
      out,
      /深于窗口的回写判不到/,
      'R1 已走深档 ⇒ 不得再写"判不到"这类过时表述(文案必须跟着判据走)',
    )
    assert.match(out, /R1\(整 blob 通道\).*照判红/, 'R1 侧文案必须说清"可判红"')
    assert.match(
      out,
      /R1r\(读祖先正文通道\).*未覆盖 ≠ 通过/,
      'R1r 侧文案必须说清"覆盖不到 + 未覆盖 ≠ 通过"',
    )
    // 反向对照:浅历史路径的正当编辑 ⇒ 既无截断报名块,读数行的截断数也必须为 0(点名吃证据)。
    put(dir, 'shallow.txt', 'a\n')
    run('add', '-A')
    run('commit', '-qm', 'shallow v1')
    put(dir, 'shallow.txt', 'b\n')
    run('add', '--', 'shallow.txt')
    const r2 = gate.audit(dir, { staged: true })
    const cost2 = r2.lines.find((l) => l.includes('[成本读数]'))
    assert.match(cost2, new RegExp(`${readoutField('window_truncated')}=0`), '浅历史不得虚报截断')
    assert.ok(
      !r2.lines.some((l) => l.includes('[窗口截断]')),
      '没有截断就不得喊 —— 否则报名沦为恒喊的噪音',
    )
  } finally {
    rmScratch(dir)
  }
})

test('P3 巡检档三档:默认档 = ×1/×2/×8(40/80/320);小档演练下读数齐全、可 grep、深档取到更多', () => {
  assert.deepEqual(
    gate.WINDOW_PROBE_TIERS,
    [40, 80, 320],
    '三档 = ×1/×2/×8(票面定档,probe 量的是这三档的取材耗时)',
  )
  assert.deepEqual(gate.WINDOW_PROBE_DEFAULT_PATHS, ['PROJECT_PLAN.md'], '缺省量热路径台账')
  const { dir, run } = repo()
  try {
    buildDepth(dir, run, 'deep.ts', 12)
    const results = gate.runWindowProbe(dir, ['deep.ts'], [4, 8, 12])
    assert.equal(results.length, 3, '三档各一行读数')
    assert.deepEqual(
      results.map((r) => r.window),
      [4, 8, 12],
      '档位顺序必须与传入一致',
    )
    for (const r of results) {
      assert.equal(r.path, 'deep.ts')
      assert.equal(r.error ?? null, null, `probe 不得报错:${r.error}`)
      assert.equal(typeof r.logMs, 'number', 'log 段必须有毫秒读数')
      assert.equal(typeof r.catMs, 'number', 'cat 段必须有毫秒读数')
      assert.equal(typeof r.totalMs, 'number', '必须有总耗时')
      assert.equal(typeof r.truncated, 'boolean', '窗口是否用尽必须如实报')
      assert.ok(r.fetched >= 0 && r.fetched <= r.window + 1, '探针取 window+1 枚,不得超')
    }
    assert.ok(
      results[2].fetched > results[0].fetched,
      `×8 档必须取到更多提交(取材路径真的随窗口变深),实得 ${results.map((r) => r.fetched).join('/')}`,
    )
    const out = gate.renderProbe(results).join('\n')
    assert.equal((out.match(/\[window-probe\]/g) ?? []).length, 3, '每档一行,前缀固定可 grep')
    assert.match(out, /\[window-probe 汇总\] path=deep\.ts/, '必须有三档汇总行')
    assert.match(out, /log_ms=[\d.]+ cat_ms=[\d.]+ total_ms=[\d.]+ commits=\d+/, '读数字段形状固定')
  } finally {
    rmScratch(dir)
  }
})

test('P4 probe 只读不落状态:跑完 probe 再判,同一夹具判定结果与默认窗口一字不差', () => {
  assert.equal(gate.ANCESTOR_WINDOW, 40, '默认窗口不得被本票改大(扩容定档是下一票)')
  const { dir, run } = repo()
  try {
    buildDepth(dir, run, 'notes/x.txt', 3)
    put(dir, 'notes/x.txt', 'brand-new-never-committed\n')
    run('add', '--', 'notes/x.txt')
    const before = gate.analyze(dir, ['notes/x.txt'])
    gate.runWindowProbe(dir, ['notes/x.txt'], [1, 2, 3])
    const after = gate.analyze(dir, ['notes/x.txt'])
    assert.deepEqual(after, before, 'probe 只读:判定结果不得因巡检而漂')
    assert.deepEqual(after, [], '夹具本身是真新编辑 ⇒ 两臂都必须不判红')
  } finally {
    rmScratch(dir)
  }
})

/**
 * P5(2026-11-05 立项的反向用例):深档取材失败 ⇒ **逐路径**"未判定"且 exit 2。
 *
 * 夹具双证:45 枚动过 deep.ts 的提交(浅窗口 40 装不下 ⇒ 必然回落全历史)+ 删掉**第二老**
 * 那枚提交的 loose object(浅窗口看不到它,全历史遍历必读到它)⇒ 深档 git log 抛 Undetermined。
 * 旧行为是把整轮上抛(退出码 2 但输出只有一条堆栈外围的全局说明,既不点名路径,也让同一轮里
 * 已判红的路径一起丢掉);现在要求:
 *   - analyze 不折红(没取证不定罪)⇒ 返回 [];
 *   - windowLoss 逐条点名该路径,且带可读原因(`undetermined`);
 *   - audit 整体 exit 2(不是 0 也不得是 1),输出出现 `❓ [R1 未判定]` 与失败原因;
 *   - 不得出现 ✅ 合格证(未判定与"通过"在账面上必须长得不一样)。
 */
test('P5 深档取材失败 ⇒ 逐路径未判定 + code 2(不折绿不折红,不拖垮其余路径)', () => {
  const { dir, run } = repo()
  try {
    const depth = gate.ANCESTOR_WINDOW + 5
    const shas = buildDepth(dir, run, 'deep.ts', depth)
    // 第二老(v2):它的 commit 对象是 v3 的 parent —— 浅窗口(最近 40 枚)够不到,
    // 但深档回落全历史时必然读到它 ⇒ 只有深档会失败。删掉它即制造"取材失败"。
    rmSync(join(dir, '.git', 'objects', shas[1].slice(0, 2), shas[1].slice(2)))
    put(dir, 'deep.ts', 'v1\n') // 写回最老版本:若取材成功,这必然是判红现场
    run('add', '--', 'deep.ts')

    const loss = []
    const v = gate.analyze(dir, ['deep.ts'], { windowLoss: loss })
    assert.deepEqual(v, [], '没取证不得定罪 ⇒ 不许折红')
    assert.equal(loss.length, 1, '取材失败的路径必须逐条落账')
    assert.equal(loss[0].path, 'deep.ts')
    assert.ok(
      loss[0].undetermined,
      `未判定必须带可读原因(不是空白),实得:${JSON.stringify(loss[0])}`,
    )
    assert.match(loss[0].undetermined, /git log|Could not read|取材失败|失败/, '原因必须可读')

    const r = gate.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 2, '未判定必须 exit 2(既不记绿也不冒红)')
    assert.match(out, /❓ \[R1 未判定\] 1 个路径本轮没有取得结论/, '必须逐条点名"本轮没有取得结论"')
    assert.ok(
      r.lines.some((l) => l.includes('deep.ts') && l.includes('深档全历史取材失败')),
      `必须点名路径与失败档位:${out.slice(0, 400)}`,
    )
    assert.match(out, /❓ \[未判定\] 1 个路径没有取得结论/, '结论汇总必须写明不出具合格证')
    assert.doesNotMatch(out, /✅ 反回退守门通过/, '未判定不得冒绿')
  } finally {
    rmScratch(dir)
  }
})

/**
 * P6(防恒红):正常仓(无坏对象、普通真新编辑)⇒ code 0,且输出里一条未判定行都没有。
 * 若这一格红了,说明 P5 的收口把"取到全部历史"也当成了失败 —— 那等于给全仓挂一盏恒亮的灯。
 */
test('P6 正常仓(无坏对象)⇒ code 0 且不出现任何未判定行', () => {
  const { dir, run } = repo()
  try {
    put(dir, 'normal.txt', 'hello\n')
    run('add', '--', 'normal.txt')
    run('commit', '-qm', 'normal v1')
    put(dir, 'normal.txt', 'hello\nworld\n')
    run('add', '--', 'normal.txt')
    const r = gate.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 0, `正常仓必须是绿的:${out.slice(0, 300)}`)
    assert.doesNotMatch(out, /❓ \[R1 未判定\]/, '正常仓不得出现 R1 未判定')
    assert.doesNotMatch(out, /❓ \[未判定\]/, '正常仓不得出现未判定汇总行')
    assert.match(out, /✅ 反回退守门通过/, '正常仓必须出合格证')
  } finally {
    rmScratch(dir)
  }
})

/**
 * P7(全量档,不是 --staged):工作树侧真有一条"取材失败"的路径。
 * 票面原判"全量档 = classifyWorktree ⇒ 一枚坏对象整轮失明"——实测**不成立**:
 * 全量档 R1 与 --staged 共用 `analyze(..., {source:'worktree'})`,同样逐路径落账;
 * `classifyWorktree` 只在"已有判红/警告"时给出口建议,且其深档调用必然命中 analyze 已落的
 * 窗口缓存(非截断走 limited / 截断走 full),所以它不会成为新的失败点。
 * 这一格锁住:进程 exit 2、逐条点名、无 ✅、更不许折红。
 */
test('P7 全量档 + 深档取材失败 ⇒ exit 2 + 逐条点名 + 无 ✅(不是"整轮失明")', () => {
  const { dir, run } = repo()
  try {
    const shas = buildDepth(dir, run, 'deep.ts', gate.ANCESTOR_WINDOW + 5)
    rmSync(join(dir, '.git', 'objects', shas[1].slice(0, 2), shas[1].slice(2)))
    put(dir, 'deep.ts', 'v1\n') // 工作树回写:取材失败时连红都不许折(没取证不定罪)
    const r = auditProcess(dir, false)
    assert.equal(r.code, 2, `全量档未判定必须 exit 2,实得 ${r.code}:${r.out.slice(0, 300)}`)
    assert.match(r.out, /❓ \[R1 未判定\] 1 个路径本轮没有取得结论/)
    assert.ok(
      r.out.split('\n').some((l) => l.includes('deep.ts') && l.includes('深档全历史取材失败')),
      '必须点名路径与失败档位',
    )
    assert.doesNotMatch(r.out, /✅ 反回退守门通过/, '未判定不得冒绿')
    assert.doesNotMatch(r.out, /❌/, '取材失败不得折红凑数')
    assert.equal(r.err, '', '不许把可读说明退回成堆栈')
  } finally {
    rmScratch(dir)
  }
})

/**
 * P8(全量档 + 深档成功 + 窗口外回写):必须**点名**,但不得退出 1。
 * 依据是门体自身的面纪律(§12e,与 R1r 同一条):盘上工作树副本属机器状态、不是本次提交内容;
 * 提交门禁由 --staged 面按索引 blob 拦。若把全量档的回写算成 exit 1,真仓那 40 条"工作树落后
 * HEAD"会让本门对任何共享工作区恒红 —— 那才是把门逼成噪音。所以这里锁"点名 + code 0",
 * 反向锁"不得出现 ❓"(它已判过,不是未判定)。
 */
test('P8 全量档 + 深档成功 + 窗口外回写 ⇒ 点名但不拦(code 0,§12e)', () => {
  const { dir, run } = repo()
  try {
    const shas = buildDepth(dir, run, 'deep.ts', gate.ANCESTOR_WINDOW + 5)
    const first9 = shas[0].slice(0, 9)
    put(dir, 'deep.ts', 'v1\n') // 窗口外(全历史才取到):必须由深档判出
    const r = auditProcess(dir, false)
    assert.equal(
      r.code,
      0,
      `全量档的回写属机器状态,按 §12e 只报数不拦;若这里变成 1,真仓共享工作区即恒红:${r.out.slice(0, 300)}`,
    )
    assert.match(r.out, /⚠️\s*\[全量档·只报数不拦\] 1 个路径/)
    assert.ok(
      r.out.split('\n').some((l) => l.includes('deep.ts') && l.includes(first9)),
      `必须点名路径与回到的版本 ${first9}`,
    )
    assert.doesNotMatch(r.out, /❓/, '已判过 ⇒ 不得挂未判定')
    assert.match(r.out, /✅ 反回退守门通过/)
  } finally {
    rmScratch(dir)
  }
})

/** P9(防恒红):正常仓全量档 ⇒ 0,且输出里一条 ❓ 都没有。 */
test('P9 正常仓全量档 ⇒ exit 0 且无任何未判定行', () => {
  const { dir, run } = repo()
  try {
    put(dir, 'normal.txt', 'hello\n')
    run('add', '--', 'normal.txt')
    run('commit', '-qm', 'normal v1')
    put(dir, 'normal.txt', 'hello\nworld\n')
    const r = auditProcess(dir, false)
    assert.equal(r.code, 0, `正常仓全量档必须绿:${r.out.slice(0, 300)}`)
    assert.doesNotMatch(r.out, /❓/, '正常仓不得出现任何未判定行(含 R1 与汇总)')
    assert.match(r.out, /✅ 反回退守门通过/)
  } finally {
    rmScratch(dir)
  }
})

/**
 * P10(同轮混合):确定性红(R1r/R1s,窗口内可证)+ 深档取材失败(R1 未判定)。
 *
 * 先定语义再断言(不跟着实现抄):**红优先 exit 1**。理由:
 *  - 有确定性证据时,"确实有问题"这一结论已经成立,不该被另一条路径的"没读到"降格成 2
 *    (2 的语义是"没取得结论",会把已判红的严重性读轻);
 *  - 未判定仍必须逐条打出(不得被红掩盖),否则等于用红把"没判"吞掉;
 *  - 若只有未判定、无红 ⇒ 2(见 P5/P7)。
 * 夹具用长行:"line-44-..."在 HEAD(v45)里已删、且在窗口内祖先 v44 写过 ⇒ R1r 复活行判据可判红;
 * 同时删掉第二老提交的 loose object ⇒ R1 深档全历史取材失败。短行会被复活行判据当噪声滤掉,
 * 那样这一格就变成"其实没判红",证明不了红优先。
 */
test('P10 同轮混合(确定性红 + 深档未判定)⇒ red 优先 exit 1,未判定不得被红掩盖', () => {
  const { dir, run } = repo()
  try {
    const line = (i) => `line-${i}-abcdefghijklmnop\n`
    const shas = buildDepth(dir, run, 'deep.ts', gate.ANCESTOR_WINDOW + 5, line)
    rmSync(join(dir, '.git', 'objects', shas[1].slice(0, 2), shas[1].slice(2)))
    put(dir, 'deep.ts', line(44)) // 窗口内祖先版本 ⇒ R1r/R1s 判红;R1 深档取材失败 ⇒ 未判定
    run('add', '--', 'deep.ts')
    const r = auditProcess(dir, true)
    assert.equal(
      r.code,
      1,
      `有确定性红时红优先 exit 1(未判定不得把红降格成 2),实得 ${r.code}:${r.out.slice(0, 320)}`,
    )
    assert.match(r.out, /❌ \[R1r\] 检出 1 个路径/, '确定性红必须在场')
    assert.match(r.out, /❓ \[R1 未判定\] 1 个路径本轮没有取得结论/, '未判定不得被红掩盖')
    assert.ok(
      r.out.split('\n').some((l) => l.includes('deep.ts') && l.includes('深档全历史取材失败')),
      '未判定必须逐条点名路径与原因',
    )
    assert.doesNotMatch(r.out, /✅/, '既未判绿也不出合格证')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
