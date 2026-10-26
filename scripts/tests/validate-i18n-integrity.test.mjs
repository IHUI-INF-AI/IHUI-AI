// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`validate-i18n-integrity.mjs`(runner 现读 id 30,blocking)。
 *
 * 纪律(本文件的立身之本):
 *  - 判据**一律 import 门体的 `__test__`** 直接用生产实现,测试内不写第二份阈、第二份正则、
 *    第二把量行数的尺(守门 191 拦这一型);需要数字就从 `gate.MIN_DECREASE_LINES` /
 *    `gate.TRUNCATION_RATIO` 推导,这样阈值哪天被改,本文件跟着翻面而不是假绿。
 *  - 夹具落 `mkScratch()`(§15b,工作区外 + 退出结构性回收),**绝不在仓库树内 `git init`**
 *    (守门 208 的立项由因);真 git 面是本门的输入面,不写真仓、也不 mock 掉。
 *  - 三态各成组:判通过(0)/ 判出缺口(1)/ 取不到输入(2「未判定」),外加变异自证 ——
 *    摘掉某条判据分支后对应夹具**必须翻面**,否则那条夹具是恒过的假证。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../validate-i18n-integrity.mjs'

// ─── 由生产常量推导的夹具规模(测试内不出现任何判据字面量) ───
const HEAD_LINES = gate.MIN_DECREASE_LINES * 4 // 基线厚度
const RED_LINES = Math.ceil(HEAD_LINES * gate.TRUNCATION_RATIO * 0.5) // 比值已破 + 减量已破
const RATIO_HELD_LINES = HEAD_LINES - (gate.MIN_DECREASE_LINES + gate.MIN_DECREASE_LINES / 2) // 减量先破,靠比值闸放过
const SMALL_EDIT_LINES = HEAD_LINES - gate.MIN_DECREASE_LINES / 2 // 两条闸都放过(正常编辑)
const HEAD_SMALL = gate.MIN_DECREASE_LINES * 2 - 20 // 比值已破、只有减量闸在守的那一格
const DECREASE_HELD_LINES = HEAD_SMALL - gate.MIN_DECREASE_LINES // 减量恰 = 阈(阈是 >,故放过)

const boxes = []
function repo() {
  const d = mkScratch('validate-i18n-integrity-')
  boxes.push(d)
  return d
}
const gitAddAll = (dir) => gitRaw(['add', '-A'], dir)
const gitCommitAll = (dir) => gitRaw(['commit', '-qm', 'fixture-baseline'], dir)

after(() => {
  for (const d of boxes) {
    try {
      rmScratch(d, { bestEffort: true })
    } catch {
      /* 清理失败不得改写结论 —— 判据的红留在断言里 */
    }
  }
})

test('T1 §22c 出口形状:__test__ 把生产判据全部递出来(缺一枚即假接线)', () => {
  const required = [
    'I18N_MESSAGES_PREFIX',
    'TRUNCATION_RATIO',
    'MIN_DECREASE_LINES',
    'countLines',
    'countStagedLines',
    'countHeadLines',
    'isI18nJsonFile',
    'getStagedFiles',
    'detectTruncations',
    'runI18nIntegrity',
    'printResult',
    'jsonLines',
    'SELF_PATH',
  ]
  const missing = required.filter((k) => gate[k] === undefined)
  assert.deepEqual(missing, [], `__test__ 缺:${missing.join(', ')}`)
  for (const fn of [
    'countLines',
    'isI18nJsonFile',
    'detectTruncations',
    'runI18nIntegrity',
    'getStagedFiles',
    'printResult',
  ]) {
    assert.equal(typeof gate[fn], 'function', `${fn} 必须是生产函数本体`)
  }
})

test('T2 §22d 入口守卫:import 本模块不触发 CLI,守卫是 pathToFileURL 形态', () => {
  const gateSrc = readFileSync(gate.SELF_PATH, 'utf8')
  assert.match(gateSrc, /pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(gateSrc, /if \(isDirectRun\)/)
  assert.ok(!gateSrc.includes(`'file:///' +`), '禁手拼 file:///(Windows 反斜杠永不匹配)')
  // 行为面(不只是文案):被 import 时必须一条打印都没有,否则测试宿主会被门自己打死
  const probe = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import('${pathToFileURL(gate.SELF_PATH).href}')`],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  assert.equal(probe.status, 0, String(probe.stderr).slice(0, 300))
  assert.equal(probe.stdout.trim(), '', 'import 即触发主流程 ⇒ §22d 守卫失效')
})

test('T3 countLines / jsonLines:行数以生产尺子为准,夹具基底自证', () => {
  assert.equal(gate.countLines(''), 0)
  assert.equal(gate.countLines(undefined), 0)
  assert.equal(gate.countLines('a'), 1)
  assert.equal(gate.countLines('a\nb'), 2)
  for (const n of [HEAD_LINES, RED_LINES, HEAD_SMALL, 12]) {
    assert.equal(gate.countLines(gate.jsonLines(n)), n, `jsonLines(${n}) 的行数应为 ${n}`)
  }
})

test('T4 射程前缀:只有 messages 下的 .json 进候选', () => {
  const p = gate.I18N_MESSAGES_PREFIX
  assert.equal(gate.isI18nJsonFile(`${p}en.json`), true)
  assert.equal(gate.isI18nJsonFile(`${p}nested/deep/en.json`), true, '含子目录也算射程内')
  assert.equal(gate.isI18nJsonFile(`${p}en.ts`), false, '非 .json 不进门')
  assert.equal(gate.isI18nJsonFile('packages/other/en.json'), false, '前缀外不进门')
  assert.equal(gate.isI18nJsonFile(`apps/web/${p}en.json`), false, '必须从仓库根算前缀')
})

test('T5 detectTruncations 纯函数面:双阈 + 两种跳过各归各桶(不并桶)', () => {
  const table = [
    { name: '双阈皆破', head: HEAD_LINES, staged: RED_LINES, want: 1 },
    { name: '减量先破、比值闸放过', head: HEAD_LINES, staged: RATIO_HELD_LINES, want: 0 },
    { name: '正常小编辑', head: HEAD_LINES, staged: SMALL_EDIT_LINES, want: 0 },
    { name: '比值已破、只有减量闸在守', head: HEAD_SMALL, staged: DECREASE_HELD_LINES, want: 0 },
  ]
  const got = table.map((t) => ({
    name: t.name,
    hits: gate.detectTruncations(['x.json'], {
      headLinesOf: () => t.head,
      stagedLinesOf: () => t.staged,
    }).truncations.length,
  }))
  assert.deepEqual(
    got.map((g) => g.hits),
    table.map((t) => t.want),
    `只有双阈同时破才喊红(实得 ${JSON.stringify(got)};红档比值=${(RED_LINES / HEAD_LINES).toFixed(3)} vs 阈 ${gate.TRUNCATION_RATIO})`,
  )
  // 两条跳过通道各自落桶
  const newFile = gate.detectTruncations(['x.json'], {
    headLinesOf: () => null,
    stagedLinesOf: () => 1,
  })
  assert.equal(newFile.truncations.length, 0)
  assert.deepEqual(newFile.skippedNewFile, ['x.json'])
  const unreadable = gate.detectTruncations(['y.json'], {
    headLinesOf: () => HEAD_LINES,
    stagedLinesOf: () => null,
  })
  assert.equal(unreadable.truncations.length, 0)
  assert.deepEqual(unreadable.unreadable, ['y.json'])
})

test('T6 变异自证:摘掉任一判据分支,对应夹具必须翻面(证夹具不恒过)', () => {
  const cands = ['hit.json', 'ratioHeld.json', 'smallEdit.json', 'decreaseHeld.json']
  const faces = {
    'hit.json': { head: HEAD_LINES, staged: RED_LINES },
    'ratioHeld.json': { head: HEAD_LINES, staged: RATIO_HELD_LINES },
    'smallEdit.json': { head: HEAD_LINES, staged: SMALL_EDIT_LINES },
    'decreaseHeld.json': { head: HEAD_SMALL, staged: DECREASE_HELD_LINES },
  }
  const deps = {
    headLinesOf: (p) => faces[p].head,
    stagedLinesOf: (p) => faces[p].staged,
  }
  const prod = gate.detectTruncations(cands, deps)
  assert.deepEqual(
    prod.truncations.map((x) => x.relPath),
    ['hit.json'],
    '生产阈下只有 hit 命中',
  )
  // M1 摘比值闸(阈推到正无穷 ⇒ `ratioNow >= ratio` 永假,该闸不再放过任何东西)
  const noRatio = gate.detectTruncations(cands, { ...deps, ratio: Number.POSITIVE_INFINITY })
  assert.ok(
    noRatio.truncations.some((x) => x.relPath === 'ratioHeld.json'),
    'M1:比值闸承重',
  )
  // M2 摘减量闸(阈推到负无穷 ⇒ `decrease <= minDecrease` 永假)
  const noMin = gate.detectTruncations(cands, {
    ...deps,
    minDecrease: Number.NEGATIVE_INFINITY,
  })
  assert.ok(
    noMin.truncations.some((x) => x.relPath === 'decreaseHeld.json'),
    'M2:减量闸承重',
  )
  // M3 摘 HEAD 面 ⇒ 命中集归零(红是量出来的,不是写出来的)
  const noHead = gate.detectTruncations(cands, { ...deps, headLinesOf: () => null })
  assert.equal(noHead.truncations.length, 0)
  assert.equal(noHead.skippedNewFile.length, cands.length)
  // M4 摘 staged 面 ⇒ 全部落 unreadable 桶,一枚也判不出
  const noStaged = gate.detectTruncations(cands, { ...deps, stagedLinesOf: () => null })
  assert.equal(noStaged.truncations.length, 0)
  assert.equal(noStaged.unreadable.length, cands.length)
  // 反向对照:两条闸同时摘 ⇒ 四枚全红(证明"放过"靠的是闸,不是夹具本身没造出减量)
  const loose = gate.detectTruncations(cands, {
    ...deps,
    ratio: Number.POSITIVE_INFINITY,
    minDecrease: Number.NEGATIVE_INFINITY,
  })
  assert.equal(loose.truncations.length, cands.length, '两闸同摘 ⇒ 四枚都该红')
})

test('T7 真 git 夹具面:索引 vs HEAD 两把尺都读到东西,判据与 CLI 同结论', () => {
  const d = repo()
  gate.initRepo(d)
  const rel = (n) => `${gate.I18N_MESSAGES_PREFIX}${n}.json`
  const other = 'packages/other/data.json'
  for (const n of ['en', 'sk', 'zh']) gate.writeRel(d, rel(n), gate.jsonLines(HEAD_LINES))
  gate.writeRel(d, rel('ja'), gate.jsonLines(HEAD_SMALL))
  gate.writeRel(d, other, gate.jsonLines(HEAD_LINES))
  gitAddAll(d)
  gitCommitAll(d)
  // 放过态四种:比值闸 / 减量闸 / 新增(HEAD 无此文件)/ 射程外
  gate.writeRel(d, rel('sk'), gate.jsonLines(RATIO_HELD_LINES))
  gate.writeRel(d, rel('zh'), gate.jsonLines(SMALL_EDIT_LINES))
  gate.writeRel(d, rel('ja'), gate.jsonLines(DECREASE_HELD_LINES))
  gate.writeRel(d, other, gate.jsonLines(RED_LINES)) // 腰斩,但射程外
  gate.writeRel(d, rel('ko'), gate.jsonLines(12))
  gitAddAll(d)

  const listed = gate.getStagedFiles(d)
  assert.equal(listed.error, null, '取面必须成功')
  const candidates = listed.files.filter(gate.isI18nJsonFile)
  assert.ok(
    listed.files.includes(other),
    '射程外文件确实被 staged 清单枚举到(不是靠 git 侧漏掉它蒙混过关)',
  )
  assert.ok(!candidates.includes(other), '是 isI18nJsonFile 把它挡在候选外的')
  assert.equal(candidates.length, 4, `候选应为 4(sk/zh/ja/ko),实得 ${candidates.join()}`)

  const passJudge = gate.runI18nIntegrity({ root: d })
  assert.equal(passJudge.state, 'pass')
  assert.equal(passJudge.truncations, undefined)
  assert.equal(passJudge.skipped.truncations.length, 0)
  assert.deepEqual(passJudge.skipped.skippedNewFile, [rel('ko')])
  const passCli = gate.runCli(d, [])
  assert.equal(passCli.status, 0, String(passCli.stdout))
  assert.match(passCli.stdout, /完整性正常/)

  // 把 en.json 腰斩入索引 ⇒ 同一仓、同一把尺,必须翻红
  gate.writeRel(d, rel('en'), gate.jsonLines(RED_LINES))
  gitAddAll(d)
  assert.equal(gate.countHeadLines(rel('en'), d), HEAD_LINES, 'HEAD 面仍是基线厚度')
  assert.equal(gate.countStagedLines(rel('en'), d), RED_LINES, '索引面已被削薄')
  const redJudge = gate.runI18nIntegrity({ root: d })
  assert.equal(redJudge.state, 'fail')
  assert.deepEqual(
    redJudge.truncations.map((x) => x.relPath),
    [rel('en')],
  )
  const redCli = gate.runCli(d, [])
  assert.equal(redCli.status, 1, 'CLI 与进程内判据必须同结论(否则接线是假的)')
  assert.match(redCli.stdout, /疑似被截断/)
  assert.match(redCli.stdout, /packages\/i18n\/messages\/en\.json/)
  assert.ok(!redCli.stdout.includes('sk.json'), '红档不得把放过型也点名进来')
})

test('T8 三态③取不到输入 ⇒ 未判定,不记绿也不冒红', () => {
  const d = repo()
  // 先证射程边界(门体头注 D5):同一落点不设 env 时,git 对 `diff --cached` 报**成功 + 空清单**
  // ⇒ 本门的 2 档只覆盖"git 派生抛错"那一型,不粉饰成全覆盖。
  const silentEmpty = gate.getStagedFiles(d)
  assert.equal(silentEmpty.error, null)
  assert.deepEqual(silentEmpty.files, [])

  const brokenGitDir = join(d, 'not-a-gitdir')
  const saved = process.env.GIT_DIR
  process.env.GIT_DIR = brokenGitDir
  let errored
  let judge
  try {
    errored = gate.getStagedFiles(d)
    judge = gate.runI18nIntegrity({ root: d })
  } finally {
    if (saved === undefined) delete process.env.GIT_DIR
    else process.env.GIT_DIR = saved
  }
  assert.ok(errored.error, 'git 面不可达时 getStagedFiles 必须把错误递出来,不折成空清单')
  assert.equal(errored.files.length, 0)
  assert.equal(judge.state, 'undetermined', '取不到输入 ⇒ 未判定(既非 pass 也非 fail)')
  assert.ok(judge.why, '未判定必须点名原因')
  const cli = gate.runCli(d, [], { GIT_DIR: brokenGitDir })
  assert.equal(cli.status, 2, '未判定 ⇒ exit 2')
  assert.match(cli.stdout, /未判定/)
  assert.ok(!/疑似被截断/.test(cli.stdout) && !/完整性正常/.test(cli.stdout), '不许冒红也不许记绿')
})

test('T9 printResult 四档退出码互不串档(0/0/1/2)', () => {
  const captured = []
  const saved = console.log
  try {
    console.log = (...a) => captured.push(a.join(' '))
    captured.length = 0
    assert.equal(gate.printResult({ state: 'skip', i18nStaged: [] }), 0)
    assert.match(captured.join('\n'), /跳过/)

    captured.length = 0
    assert.equal(gate.printResult({ state: 'pass', i18nStaged: [1, 2] }), 0)
    assert.match(captured.join('\n'), /完整性正常/)

    captured.length = 0
    assert.equal(
      gate.printResult({
        state: 'fail',
        i18nStaged: ['x'],
        truncations: [
          {
            relPath: 'x.json',
            headLines: HEAD_LINES,
            stagedLines: RED_LINES,
            decrease: HEAD_LINES - RED_LINES,
            decreasePercent: '50.0',
          },
        ],
      }),
      1,
    )
    assert.match(captured.join('\n'), /疑似被截断/)

    captured.length = 0
    assert.equal(gate.printResult({ state: 'undetermined', why: 'probe-原因' }), 2)
    assert.match(captured.join('\n'), /未判定/)
    assert.match(captured.join('\n'), /probe-原因/, '原因必须点名,不能只说"未判定"')
  } finally {
    console.log = saved
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
