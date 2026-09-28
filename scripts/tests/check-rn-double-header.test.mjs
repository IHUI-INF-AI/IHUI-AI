// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 守门 `check-rn-double-header.mjs` 的 §22c 镜像测试。
//
// 为什么每例都必须存在(不写例数,例数以 `node --test` 末行为准):
//  本门管的是"两条页头叠在一起"这种**没有任何编译期症状**的界面缺陷 —— typecheck、lint、
//  单测、`pnpm build` 全都照常绿。而它失效的三种形态也全都是安静的:注册块被并发会话按旧
//  副本写回(门在、判据对、无人调度)、取材面退回滞后的共享工作树(同一份 HEAD 代码在恒红
//  与假绿之间来回跳)、遮罩被"顺手"接错面(注释里的形态又被判成违规)。所以这里既有行为
//  对照,也有源码形状锁 —— 形状锁防的正是"加断言会跟着一起漂绿"那一类。
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

import { __test__ as gate } from '../check-rn-double-header.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SRC = join(REPO, 'scripts', 'check-rn-double-header.mjs')
const EXPIRY = join(REPO, 'scripts', 'check-exemption-expiry.mjs')
const LEDGER = join(REPO, 'scripts', 'rn-double-header-baseline.json')
const GIT_BIN = resolveGitBin() || 'git'
const SCRIPT = 'check-rn-double-header.mjs'

function gitAt(args, opts = {}) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', REPO, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 1 << 28,
    ...opts,
  }).trim()
}

/** 存在性问法:git 报错就是"没有",不当成测试故障(execFileSync 对失败是抛,不是返回码)。 */
function gitOk(args) {
  try {
    gitAt(args)
    return true
  } catch {
    return false
  }
}

function runNode(args, opts = {}) {
  return execFileSync(process.execPath, args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout: 600000,
    ...opts,
  })
}

/**
 * 从注册表里**按大括号配对**取出本门那一条注册项。
 * 刻意不取"脚本名前后各 N 字符"当条目范围 —— 守门 136 记过那一版:窗口会跨进邻门的注册块,
 * 于是"别人有 blocking"被算成"我有 blocking",这条断言对任何错误注册都恒绿。
 */
function findOwnEntry(src) {
  const lines = src.split('\n')
  const at = lines.findIndex((l) => l.trim() === `script: '${SCRIPT}',`)
  if (at < 0) return null
  let start = at
  while (start >= 0 && lines[start].trim() !== '{') start--
  let depth = 0
  let end = start
  for (let i = start; i < lines.length; i++) {
    for (const c of lines[i]) {
      if (c === '{') depth++
      else if (c === '}') depth--
    }
    if (depth === 0 && i > start) {
      end = i
      break
    }
  }
  const idLine = lines.slice(start, end + 1).find((l) => /^\s*id:\s*['"]/.test(l))
  const m = /^\s*id:\s*['"]([^'"]+)['"]/.exec(idLine || '')
  return { block: lines.slice(start, end + 1).join('\n'), id: m ? m[1] : null }
}

test('T1 装车证明:runner 里真有本门那条注册,且 blocking + skipEnv + stagedTriggers 成套', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const e = findOwnEntry(src)
  assert.ok(e, `${SCRIPT} 不在 runner 注册表里 —— 门存在但没人调度 = 没有(§22c 反复记过这一型)`)
  assert.ok(e.id, '取号必须落在带 id 的注册块里')
  assert.match(
    e.block,
    /mode:\s*'blocking'/,
    '本门必须 blocking(5 处存量已冻进 HEAD 棘轮,不会恒红)',
  )
  assert.ok(
    /skipEnv:\s*'HUSKY_SKIP_RN_DOUBLE_HEADER'/.test(e.block),
    '缺应急出口 = 出事时只能改判据(本仓记过多次"文档写了跑不通的出路")',
  )
  assert.ok(
    /stagedTriggers:\s*\[\s*'apps\/mobile-rn\/'\s*\]/.test(e.block),
    '触发面必须是 apps/mobile-rn/(共享侧改页头不会新增双层,发起面只有 RN 屏)',
  )
  // 编号唯一:同一个 id 在整张注册表里只能出现一次(撞号会串 skipEnv 与失败归属,守门 89 的 R5)
  const occurrences = src
    .split('\n')
    .filter((l) => /^\s*id:\s*['"]/.test(l))
    .filter((l) => l.includes(`'${e.id}'`))
  assert.equal(
    occurrences.length,
    1,
    `本门编号 ${e.id} 在 runner 里出现 ${occurrences.length} 次(应恰好 1)`,
  )
})

test('T2 反向对照:摘掉注册块后,不得仍被读成"已装车"', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const e = findOwnEntry(src)
  assert.ok(e, '本例依赖 T1 的注册块在位')
  const stripped = src.replace(e.block + '\n', '')
  assert.notEqual(stripped, src, '夹具没能剥掉注册块(配对失效,本例就失去意义)')
  assert.equal(
    findOwnEntry(stripped),
    null,
    '剥完还找得到 ⇒ 取条方式不是"本门那一条",判据会替别人背书',
  )
})

test('T3 遮罩实现只能有一份:必须 import lib/code-mask,不得在门里留第二份状态机', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(
    /from '\.\/lib\/code-mask\.mjs'/.test(src) && /maskCommentsAndStrings\(/.test(src),
    '判据面没走唯一遮罩实现',
  )
  assert.ok(
    !/function maskCommentsAndStrings\s*\(/.test(src),
    '门里不得再抄一份遮罩实现 —— 两处实现必漂移是本仓记过最多次的失败型(守门 131/135 同条锁)',
  )
  // 判据读遮罩面、豁免读原文:接反一侧就是"注释被判定违规"或"豁免通道被自己抹掉"
  assert.match(src, /rnMasked: maskCommentsAndStrings\(/, '必须有遮罩面喂给判据(命中走这一面)')
  assert.match(src, /const rawLines = rnText\.split/, '必须另留一份原文面(豁免标记写在注释里)')
  assert.match(
    src,
    /if \(exemptReason\(l\)\) return true/,
    '豁免必须拿原文行判 —— 遮罩之后就永远匹配不到,等于自己抹掉出口',
  )
})

test('T4 取材面形状锁:内容必须经 face-reader 的 catBatch,不得按磁盘/自派生 git 读', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.ok(/from '\.\/lib\/face-reader\.mjs'/.test(src), '没引取材层')
  assert.match(src, /catBatch\(ROOT,/, '引了层却不用它读内容 = 半接线(守门 118 提交档判红的那一型)')
  assert.ok(!/process\.cwd\(\)/.test(src), '不得用 cwd 定根(守门 70 的镜像测试 13/14 恒红那一型)')
  assert.ok(!/readFileSync\(\s*join\(\s*ROOT/.test(src), '不得用 ROOT 拼磁盘路径读被审内容')
  assert.ok(
    !/gitRaw\(\[['\s,]*'show'/.test(src),
    '不得散写 git show 取内容(层已统一兜 stdio/maxBuffer)',
  )
})

test('T5 真仓 HEAD 对账 + 台账不得腐烂成第二份真相(阳性对照=真文件+内存注入,不要求真仓保持脏)', () => {
  const r = gate.analyze('head')
  assert.equal(
    r.exit,
    0,
    `全量面应绿(锚点=该文件 HEAD 自身存量);实得 ${JSON.stringify(r.red).slice(0, 240)}`,
  )
  assert.equal(r.emptyScan, false, 'head 面被判空扫 ⇒ 枚举面或仓库根错位,本门会恒判无法判定')
  assert.ok(r.scannedFiles > 150, `扫描文件数 ${r.scannedFiles} 异常偏低`)
  // 阳性对照的形态(2026-09-27 存量归零后改):刻意**不**要求"HEAD 必须还留着 ≥1 处违规"——
  // 那等于把"世界是脏的"钉成判据,清完账的门反而红。这里喂**真 HEAD 文件**的 wrapper +
  // 在内存里给真子屏注入一枚 <BackChevron/>,scan 必须量到 —— 真实形态(别名导入、
  // onBack 接线、NavBar 绑定)复刻不了,合成夹具会漂;而注入只活在内存,不要求仓库留脏。
  const WRAP = 'apps/mobile-rn/src/screens/CourseDetailScreen.tsx'
  const CHILD = 'packages/app/src/features/course-detail/CourseDetailScreen.tsx'
  const wrapText = gitAt(['show', `HEAD:${WRAP}`])
  const childClean = gitAt(['show', `HEAD:${CHILD}`])
  const auditWith = (childText) => {
    const idx = gate.buildSymbolIndex(new Map([[CHILD, childText]]))
    return gate.auditRnFile({
      file: WRAP,
      rnText: wrapText,
      rnMasked: maskCommentsAndStrings(wrapText),
      symbolIndex: idx,
    })
  }
  // 反向锁:真 HEAD 的 wrapper × 真 HEAD 的子屏 ⇒ 0 处(本票清完账后这就是当前真实形态;
  // 若有人把内置页头加回去,门在提交链判红,这条锁同时翻红点名"世界又脏了但台账没跟上")
  assert.equal(
    auditWith(childClean).hits.length,
    0,
    '真 HEAD 的 CourseDetail 组合被读成双层 ⇒ 要么有人回退了本票的收敛,要么判据假阳回流',
  )
  const MARK = '<ScrollView style={styles.container}>'
  assert.ok(
    childClean.includes(MARK),
    `注入锚点 ${MARK} 不在子屏里了 ⇒ 夹具前提漂了,换锚点,别删这条对照`,
  )
  const childInjected = childClean.replace(
    MARK,
    `${MARK}\n      <BackChevron onPress={onBack} label="返回" />`,
  )
  assert.ok(
    auditWith(childInjected).hits.some((h) => h.file === WRAP),
    '真文件形态 + 注入一枚内置页头都量不到 ⇒ 判据对"别名导入 × 真 wrapper"这一型失明(§22c 复读机防线)',
  )
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'))
  assert.ok(Array.isArray(ledger.stock), '台账 stock 必须是数组')
  // 刻意**不**再抄一份"应有哪几处文件"的名单:那份硬清单在有人清偿掉一站之后就成了
  // 第二份真相 —— 它判红的对象是"世界没按立项那天的样子留着",而不是任何缺陷。
  // 本仓对这类清单的规矩是"豁免清单必然腐烂";有牙的判据是下面两条:
  //   ① 台账点的每个文件都必须在 HEAD 真存在(台账指向不存在的文件 = 清单腐烂,判红)
  //   ② 台账必须与 HEAD 现读**逐文件等值**(有人清了账没重跑 --update-baseline ⇒ 判红)
  for (const s of ledger.stock) {
    for (const p of [s.rnFile, s.sharedFile]) {
      assert.ok(
        gitOk(['cat-file', '-e', `HEAD:${p}`]),
        `台账点名的文件不在 HEAD 里:${p}(台账已腐烂,重跑 --update-baseline 或找回文件)`,
      )
    }
  }
  const ledgerFiles = ledger.stock.map((s) => s.rnFile.split('/').pop()).sort()
  // 台账与 HEAD 实态必须对得上:对不上就是有人清了账没重跑 --update-baseline(第二份真相)
  const liveFiles = r.stock.map((h) => h.file.split('/').pop()).sort()
  assert.deepEqual(
    liveFiles,
    ledgerFiles,
    `台账 ${ledgerFiles.join(',')} ≠ HEAD 现读 ${liveFiles.join(',')} ⇒ 跑 --update-baseline 归并,别改判据`,
  )
  // 三处已用抑制通道的候选**不得**被记成违规(判据必须认调用点的抑制通道)
  for (const f of ['AgentScreen', 'NewsScreen', 'ShareScreen'])
    assert.ok(!liveFiles.includes(`${f}.tsx`), `${f} 已走抑制通道,记成违规就是假阳`)
})

test('T6 抑制通道族必须登记进守门 108 的存活期表(30 天档)', () => {
  const src = readFileSync(EXPIRY, 'utf8')
  assert.match(
    src,
    /'double-header-exempt':\s*30/,
    'double-header-exempt 未进 FAMILY_LIFETIME_DAYS ⇒ 豁免只有出生没有死亡(待偿债不得取 365)',
  )
})

test('T7 端到端双向锁(私有索引注入,绝不碰共享索引/工作树):注入违规必红,只写进注释必绿,豁免出口必须真能用', () => {
  const F = 'apps/mobile-rn/src/screens/WalletScreen.tsx' // HEAD 存量为 0 ⇒ 注入即"新增"
  const src = gitAt(['show', `HEAD:${F}`])
  const at = src.indexOf('<SharedWalletScreen')
  assert.ok(at > 0, '夹具必须真渲染共享屏,否则本例是空跑(拿空夹具证有牙 = 没证)')
  const importAt = src.indexOf('\n', src.indexOf('from ') + 1) + 1
  const IMPORT = "import { NavBar } from '../components/NavBar'\n"
  const NAV = '<NavBar title="探针" onBack={go} />'
  /** @param mode 'real' 真代码 / 'comment' 只写进注释 / 'exempt' 真代码 + 带原因豁免 / 'bare' 真代码 + 裸标记 */
  const variant = (mode) => {
    const head = src.slice(0, importAt) + IMPORT + src.slice(importAt, at)
    if (mode === 'comment')
      return head + '      {/* 早先这里写 ' + NAV + ',后来挪走了 */}\n      ' + src.slice(at)
    const suffix =
      mode === 'exempt'
        ? ' // double-header-exempt: 探针登记的待偿,另计票'
        : mode === 'bare'
          ? ' // double-header-exempt: '
          : ''
    return head + '      ' + NAV + suffix + '\n' + src.slice(at)
  }
  const dir = mkScratch('g-rndh-t7')
  try {
    const gitdir = gitAt(['rev-parse', '--absolute-git-dir'])
    const probeIndex = join(dir, 'probe-index')
    copyFileSync(join(gitdir, 'index'), probeIndex) // 复制一份再动,共享索引一字不碰
    const env = { ...process.env, GIT_INDEX_FILE: probeIndex }
    const gitEnv = (args, opts = {}) =>
      execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', REPO, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 180000,
        env,
        ...(opts.input === undefined ? {} : { input: opts.input }),
      }).trim()
    const put = (body) => {
      const blob = gitEnv(['hash-object', '-w', '--stdin'], { input: body })
      gitEnv(['update-index', '--add', '--cacheinfo', `100644,${blob},${F}`])
    }
    const runStaged = () => {
      const r = spawnSync(process.execPath, [SRC, '--staged'], {
        cwd: REPO,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 600000,
        env,
      })
      return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
    }

    // A 臂:真代码里加一条 NavBar(共享屏仍自带页头且无通道)⇒ 必红并点名本文件
    put(variant('real'))
    const a = runStaged()
    assert.equal(a.code, 1, `A 臂:新增双层页头必须 exit=1,实得 ${a.code}\n${a.out.slice(0, 300)}`)
    assert.ok(a.out.includes(F), '红的输出必须点名被注入的文件(归因铰链靠它判断能不能跳门)')

    // B 臂:同一形态只出现在注释里 ⇒ 必绿(遮罩关掉的是误报,不是判据)
    put(variant('comment'))
    const b = runStaged()
    assert.equal(b.code, 0, `B 臂:注释形态不得判红,实得 ${b.code}\n${b.out.slice(0, 300)}`)

    // C 臂:带原因的同行豁免 ⇒ 放行(出口必须真能用,否则"有出口"是假的)
    put(variant('exempt'))
    const c = runStaged()
    assert.equal(c.code, 0, `C 臂:带原因豁免不得判红,实得 ${c.code}\n${c.out.slice(0, 300)}`)

    // D 臂:裸标记(冒号后只剩空白/注释闭合符)不得放行 —— 守门 102 记过的那一型
    put(variant('bare'))
    const d = runStaged()
    assert.equal(d.code, 1, `D 臂:无原因豁免不得放行,实得 ${d.code}`)

    // 反向对照:共享屏**不**自带页头时,同一处注入不得判红(否则门退化成"逢 NavBar 即红")
    const shared = 'packages/app/src/features/wallet/WalletScreen.tsx'
    const sharedSrc = gitAt(['show', `HEAD:${shared}`])
    const stripped = sharedSrc.replace(/<BackChevron[\s\S]*?\/>/, '<Text>x</Text>')
    assert.notEqual(stripped, sharedSrc, '夹具没能剥掉共享侧页头(本例失去意义)')
    const blobS = gitEnv(['hash-object', '-w', '--stdin'], { input: stripped })
    gitEnv(['update-index', '--add', '--cacheinfo', `100644,${blobS},${shared}`])
    put(variant('real'))
    const e = runStaged()
    assert.equal(
      e.code,
      0,
      `共享侧无页头时不得判红(阴性对照),实得 ${e.code}\n${e.out.slice(0, 300)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T8 空暂存档不得判"无法判定"(与守门 135 的兜底同向),且 --strict 与存量同真假(有存量必红,归零后不得假红)', () => {
  const staged = spawnSync(process.execPath, [SRC, '--staged'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 600000,
  })
  assert.equal(
    staged.status,
    0,
    `暂存档应绿;实得 ${staged.status}\n${(staged.stdout || '') + (staged.stderr || '')}`,
  )
  const strictRun = spawnSync(process.execPath, [SRC, '--strict'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 600000,
  })
  // 2026-09-27 存量归零后:strict 与默认档的差别**只在有存量时存在** —— 判据改成
  // "strict 的状态 == (有存量 ? 红 : 绿)",而不是把"HEAD 必须还脏着"钉成断言
  // (那等于要求世界永远留着立项那天的缺陷)。strict 有牙由 T7 注入对照证明。
  const headStock = gate.analyze('head').stock.length
  assert.equal(
    strictRun.status,
    headStock > 0 ? 1 : 0,
    headStock > 0
      ? `--strict 是问责入口:存量 ${headStock} 处必须判红,否则它和默认档没有区别`
      : `存量为 0 时 --strict 应绿(红只能来自注入,T7 负责证明这一点);实得 ${strictRun.status}`,
  )
})

test('T9 --json 只输出一份可 parse 的文档(说明性文本不得混进 stdout)', () => {
  const out = runNode([SRC, '--json'])
  const j = JSON.parse(out.trim())
  assert.equal(j.face, 'head')
  assert.ok(Array.isArray(j.violations) && Array.isArray(j.undetermined))
  assert.ok(typeof j.exit === 'number')
})

test('T10 --self-test 端到端 exit 0(判据分支的构造面证明必须在提交链上真跑)', () => {
  const out = runNode([SRC, '--self-test'])
  assert.match(out, /--self-test: 全部通过/)
})
