// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— `next-plan-id.mjs --check` 的**差值棘轮**(2026-10-25 立,承票 G-955 收口)。
 *
 * 病形(票面):独立取号入口曾被台账里的 O 族重号顶死(exit 1 ⇒ 登记只能改走第一出口)。
 * G-927 把判红维收窄到"登记行声明位",G-955 又把括注指针从声明位里剔出去;但判红仍是**绝对值**
 * —— 台账里只要还留着历史重号(并发批次带旧底稿并入就会带回),入口就再次恒红(§12e)。
 * 正解是 §0.5 的棘轮口径:**锚点 = 基线面(被审面的父提交)该号自身的行数**,只拦"本次把违规带进来"。
 *
 *  D1 判据单元(全部 import 生产实现 `__test__`,不复制"什么算存量/新增"):
 *     存量 → legacy 且 fresh 为空;新增 → fresh;行数增长 → fresh;行数回落 → legacy;已清零 → cleared;
 *     两档输入任一取不到 ⇒ ok:false(未判定不得读成"全是新增"或"全是存量")。
 *  D2 正证①(存量):真 git 夹具仓 —— 父提交就有 O7×2,子提交只加新活 ⇒ CLI `--check` exit 0,
 *     stdout 点名"存量登记行重号 1 组"并写明"只报数不判红"。
 *  D3 阳性对照②(新增):父提交干净、子提交引入 O7×2 ⇒ CLI `--check` **exit 1**,stdout 点名"新增"。
 *  D4 取号零交集③(可复跑):连跑两次 `--next-only`,两枚号都必须在**调用前**的全仓占用面
 *     (HEAD 台账 ⊕ 归档件 ⊕ 工作树副本)上零命中,且落在号池 1..LEASE_POOL_MAX 内
 *     (七位号事故的反证:发号器绝不发池外号)。
 *  D5 未判定:基线面取不到(根提交)⇒ exit 1 且 stdout 明写"未判定",不得静默当存量放行。
 *
 * 夹具落点一律 `scripts/lib/scratch-dir.mjs`(§15b),不写 os.tmpdir()、不落仓库树内;
 * 夹具仓用 GIT_DIR/GIT_WORK_TREE 驱动真 CLI,零触碰真仓的 HEAD / 索引 / 工作树。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as DUP } from '../lib/plan-id-duplicates.mjs'
import { collectIdFace, scanFamilyIds } from '../lib/plan-id-face.mjs'
import { LEASE_POOL_MAX } from '../lib/plan-id-lease.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = resolve(ROOT, 'scripts', 'next-plan-id.mjs')
const TOOL_SRC = readFileSync(CLI, 'utf8')
const { judgeRowIdDuplicatesDelta } = DUP

/** 真 git 派生:显式 stdio + 数字 timeout + 剥 GIT_DIR(§12g;夹具不得被调用方 shell 的 git 环境顶掉)。 */
function gitIn(dir, args) {
  const env = { ...process.env }
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[k]
  const r = spawnSync(
    'git',
    [
      '-C',
      dir,
      '-c',
      'user.email=test@example.com',
      '-c',
      'user.name=test',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 120_000, env },
  )
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.status} ${r.stderr}`)
  return String(r.stdout ?? '')
}

/**
 * 造一个两提交的夹具仓:`commits` 逐项 = [提交信息, PROJECT_PLAN.md 正文]。
 * 落点走 mkScratch(§15b),`t.after` 回收。
 */
function makeRepo(t, commits) {
  const dir = mkScratch('plan-id-delta-')
  t.after(() => rmScratch(dir))
  gitIn(dir, ['init', '-q'])
  for (const [msg, text] of commits) {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), text)
    gitIn(dir, ['add', 'PROJECT_PLAN.md'])
    gitIn(dir, ['commit', '-q', '-m', msg])
  }
  return dir
}

/** 用 GIT_DIR/GIT_WORK_TREE 把真 CLI 指到夹具仓上 —— 判据/接线全走生产实现,只有被审面换了。 */
function runCheck(dir) {
  const env = { ...process.env, GIT_DIR: join(dir, '.git'), GIT_WORK_TREE: dir }
  return spawnSync(process.execPath, [CLI, '--check'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    env,
  })
}

function runNextOnly() {
  return spawnSync(process.execPath, [CLI, '--next-only'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
  })
}

// ── D1 判据单元(生产实现直连) ────────────────────────────────────────────────────────
test('D1 差值判据:存量/新增/增长/回落/清零五档分得开,取不到输入判未判定', () => {
  const two = ['- [ ] O7 甲', '- [ ] O7 乙', '- [ ] O8 丙'].join('\n')
  const one = ['- [ ] O7 甲', '- [ ] O8 丙'].join('\n')
  const three = ['- [ ] O7 甲', '- [ ] O7 乙', '- [ ] O7 丙'].join('\n')

  const legacy = judgeRowIdDuplicatesDelta({
    currentText: two,
    baselineText: ['- [ ] O7 甲', '- [ ] O7 乙'].join('\n'),
  })
  assert.equal(legacy.ok, true)
  assert.deepEqual(legacy.fresh, [], '基线就已同号多行 ⇒ 不是本次带进来的')
  assert.deepEqual(legacy.legacy, [['O7', 2, 2]], '存量组必须原样报出[号,当前行数,基线行数]')

  const fresh = judgeRowIdDuplicatesDelta({ currentText: two, baselineText: one })
  assert.deepEqual(fresh.fresh, [['O7', 2, 1]], '基线只有 1 行、本次变 2 行 ⇒ 新增(判红档)')
  assert.deepEqual(fresh.legacy, [])

  const grown = judgeRowIdDuplicatesDelta({
    currentText: three,
    baselineText: ['- [ ] O7 甲', '- [ ] O7 乙'].join('\n'),
  })
  assert.deepEqual(grown.fresh, [['O7', 3, 2]], '2→3 是"把违规加回来"(增长算新增,不得按集合差漏掉)')

  const shrunk = judgeRowIdDuplicatesDelta({ currentText: two, baselineText: three })
  assert.deepEqual(shrunk.legacy, [['O7', 2, 3]], '行数回落未清零 ⇒ 仍算存量,只报数')
  assert.deepEqual(shrunk.fresh, [])

  const cleared = judgeRowIdDuplicatesDelta({
    currentText: one,
    baselineText: ['- [ ] O7 甲', '- [ ] O7 乙'].join('\n'),
  })
  assert.deepEqual(cleared.cleared, [['O7', 2]], '基线有、被审面没了 ⇒ 已清偿')
  assert.deepEqual(cleared.fresh, [])

  for (const bad of ['', undefined]) {
    const r = judgeRowIdDuplicatesDelta({ currentText: two, baselineText: bad })
    assert.equal(r.ok, false, `基线取不到(${JSON.stringify(bad)})必须判未判定`)
    assert.ok(String(r.reason ?? '').includes('基线面'), '未判定原因必须点名是哪一面取不到')
  }
  const noCur = judgeRowIdDuplicatesDelta({ currentText: '', baselineText: one })
  assert.equal(noCur.ok, false, '被审面取不到同样必须判未判定(不得读成"重号已清零")')
})

// ── D2 存量:报数 + exit 0(入口可继续取号) ─────────────────────────────────────────────
test('D2 存量重号只报数:父提交就有 O7×2 ⇒ --check exit 0 且点名存量组', (t) => {
  const dir = makeRepo(t, [
    ['A 存量重号', '- [ ] O7 甲题\n\n- [ ] O7 乙题\n'],
    ['B 只加新活', '- [ ] O7 甲题\n\n- [ ] O7 乙题\n\n- [ ] O8 新活\n'],
  ])
  const r = runCheck(dir)
  assert.equal(r.status, 0, `存量重号不得顶死取号入口:\n${r.stdout}\n${r.stderr}`)
  assert.match(String(r.stdout), /无新增登记行重号/, '绿行必须说清只判"新增"那一档')
  assert.match(String(r.stdout), /存量登记行重号 1 组\(O7×2\)/, '存量组必须点名报数(不得静默)')
  assert.match(String(r.stdout), /只报数不判红/, '存量档的处置口径必须写出来')
})

// ── D3 阳性对照:新增重号必须 exit 1(牙还在) ───────────────────────────────────────────
test('D3 新增重号必须 exit 1:父提交干净、子提交引入 O7×2 ⇒ 判红并点名"新增"', (t) => {
  const dir = makeRepo(t, [
    ['A 干净面', '- [ ] O7 甲题\n\n- [ ] O8 乙题\n'],
    ['B 新增撞号', '- [ ] O7 甲题\n\n- [ ] O7 乙题\n\n- [ ] O8 其他\n'],
  ])
  const r = runCheck(dir)
  assert.equal(r.status, 1, `新增撞号必须判红(存量不顶死 ≠ 新增不红):\n${r.stdout}\n${r.stderr}`)
  assert.match(String(r.stdout), /\*\*新增\*\*登记行/, '判红行必须写明是"新增"档')
  assert.match(String(r.stdout), /O7 ×2\(基线 ×1\)/, '点名新增组时必须带基线行数(1→2,不是 0→2)')
  assert.match(String(r.stdout), /存量只报数、新增必拦/, '判红行必须把棘轮口径写出来')
})

// ── D4 取号与全仓占用面零交集(含归档件;可复跑) ────────────────────────────────────────
test('D4 取号零交集:连跑两次 --next-only,两枚号都在调用前的全仓占用面上零命中且落池内', (t) => {
  // 占用面**必须在跑 CLI 之前取**:CLI 自己是"跑的那一刻"现读 HEAD 的,而这里要证的命题是
  // "它发出来的号,在它动手之前就已经被占的号里一个都不碰"。用调用后的面去比,会把别席
  // 同刻新落账误读成"取号器发了已占号"(方向性错误);调用前的静态面才是可重放的锚点。
  const face = collectIdFace({ root: ROOT, source: 'HEAD', doc: 'PROJECT_PLAN.md' })
  if (!face.ok) {
    t.skip(`未判定:占用面判不出(${face.undetermined.join(' / ') || '未给原因'})⇒ 零交集无从判起`)
    return
  }
  const wt = readFileSync(resolve(ROOT, 'PROJECT_PLAN.md'), 'utf8')
  const occupied = new Set([...scanFamilyIds(face.text, 'O'), ...scanFamilyIds(wt, 'O')])
  const got = []
  for (let round = 1; round <= 2; round += 1) {
    const r = runNextOnly()
    if (/占用面判不出|无法判定占用/.test(String(r.stderr))) {
      t.skip(`未判定:第 ${round} 轮 CLI 占用面判不出(并发 HEAD 切换窗口)`)
      return
    }
    assert.equal(r.status, 0, `第 ${round} 轮 --next-only 必须 exit 0:\n${r.stderr}`)
    const line = String(r.stdout).trim()
    assert.match(line, /^O\d+$/, `第 ${round} 轮 stdout 恒一行号,实得 ${JSON.stringify(r.stdout)}`)
    const n = Number(/^O(\d+)$/.exec(line)[1])
    assert.ok(
      n >= 1 && n <= LEASE_POOL_MAX,
      `${line} 必须落在号池 1..${LEASE_POOL_MAX}(七位号事故:绝不发池外号)`,
    )
    assert.ok(
      !occupied.has(n),
      `${line}(第 ${round} 轮)与调用前的全仓占用面(HEAD 台账 ⊕ ${face.archiveFiles.length} 份归档件 ⊕ 工作树副本)有交集 ⇒ 取号器把已占号当空闲发`,
    )
    got.push(n)
  }
  // 可复跑断言:两轮各自独立成立(不要求两轮同号 —— 并发下池内最小空闲本就可能变)
  assert.equal(got.length, 2)
})

// ── D5 未判定:基线面取不到不得静默放行 ────────────────────────────────────────────────
test('D5 基线面取不到(根提交)⇒ --check exit 1 且明写未判定,不得当存量放行', (t) => {
  const dir = makeRepo(t, [['唯一提交(无父)', '- [ ] O7 甲题\n\n- [ ] O7 乙题\n']])
  const r = runCheck(dir)
  assert.equal(r.status, 1, `分不开存量与新增时必须判未判定:\n${r.stdout}\n${r.stderr}`)
  assert.match(String(r.stdout), /重号判据未判定/, '必须显式写"未判定"(§0.3:不记绿也不冒红)')
  assert.match(String(r.stdout), /HEAD\^/, '未判定行必须点名基线面取的是哪个 rev(出路要可执行)')
})

// ── D6 装车形状锁:判据单源 + 接线两向锁 ───────────────────────────────────────────────
test('D6 形状锁:判据只住 lib 一份,CLI 只接线;绝对值判红不得复活', () => {
  assert.match(
    TOOL_SRC,
    /import\s*\{[^}]*judgeRowIdDuplicatesDelta[^}]*\}\s*from\s*'\.\/lib\/plan-id-duplicates\.mjs'/,
    '差值判据必须 import lib 那一份(在 CLI 里再写一遍行数比较就是第二份尺子,§22c)',
  )
  assert.doesNotMatch(
    TOOL_SRC,
    /function\s+judgeRowIdDuplicatesDelta/,
    'CLI 不得自带判据实现(单一真相源)',
  )
  const checkBranch = TOOL_SRC.indexOf("flags.has('--check')")
  const branch = TOOL_SRC.slice(checkBranch, TOOL_SRC.indexOf('const headingNote', checkBranch))
  assert.match(
    branch,
    /ID_FACE_TRANSPORT\.show\(/,
    '基线面必须走占用面那一条取材实现(不自拼 git 派生)',
  )
  assert.match(branch, /delta\.fresh\.length/, '判红只认新增档')
  assert.doesNotMatch(
    branch,
    /dup\.rowDups/,
    '绝对值判红(dup.rowDups)不得在 --check 分支复活 —— 存量会把它读成恒红门',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
