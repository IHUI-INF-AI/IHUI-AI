// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// T7(票 G-1058652):「本轮扫谁」与「在位性按哪张面判」必须是两个集合。
// 这条锁的存在理由:该门在 --staged 档曾把 `git diff --cached` 的**改动子集**当成"面"去判在位性,
// 于是"被 import 的目标本次没改动"被读成"不在被审面上" —— 而它实测在 HEAD 上。
// 后果是**假红**:blocking 档下,任何人新增任何一个 import 既有模块的 .py 都会被挡。
// 它长期假绿的原因也写在这里:HEAD 档的清单恰好等于全集,两个集合相等时塌缩看不出来。
//
// 为什么用**独立临时仓**而不是共享工作树:本仓共享索引,`git add` 会碰别人的在飞暂存窗口
// (硬性纪律:禁止 git add / git reset)。整仓搬到 scratch 下自建,index 与本仓无关。
test('T7 --staged 档:新增 .py import 已入库模块必须绿(在位性按面全集,不是按改动子集)', () => {
  const s = mkScratch('pyland-universe')
  try {
    const repo = join(s, 'repo')
    mkdirSync(repo, { recursive: true })
    execFileSync(GIT, ['-C', s, 'init', '-q', 'repo'], {
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // 基线:被 import 的目标**真的在 HEAD 上**(台账要求"别猜",这里坐实)
    const appDir = join(repo, 'apps', 'ai-service', 'app')
    mkdirSync(join(appDir, 'core'), { recursive: true })
    writeFileSync(join(appDir, '__init__.py'), '', 'utf8')
    writeFileSync(join(appDir, 'core', '__init__.py'), '', 'utf8')
    writeFileSync(join(appDir, 'core', 'context_compaction.py'), 'THRESHOLD = 1\n', 'utf8')
    copyScriptClosure(GATE, join(repo, 'scripts', 'check-python-import-landed.mjs'))
    const gc = (args) =>
      execFileSync(
        GIT,
        [
          '-C',
          repo,
          '-c',
          'user.name=t',
          '-c',
          'user.email=t@t',
          '-c',
          'core.autocrlf=false',
          ...args,
        ],
        {
          encoding: 'utf8',
          timeout: GIT_TIMEOUT_MS,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
    gc(['add', '-A'])
    gc(['commit', '-q', '-m', 'baseline'])

    const runStaged = (extra = []) => {
      const r = spawnSync(
        process.execPath,
        [join(repo, 'scripts', 'check-python-import-landed.mjs'), '--staged', ...extra],
        {
          encoding: 'utf8',
          timeout: 180000,
          cwd: repo,
          windowsHide: true,
          maxBuffer: 1 << 26,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
      const out = String(r.stdout ?? '') + String(r.stderr ?? '')
      assert.doesNotMatch(
        out,
        /ERR_MODULE_NOT_FOUND|SyntaxError|Cannot find module/,
        '夹具崩溃会伪装成判据结论(退出码同样是 1):\n' + out.slice(0, 500),
      )
      return { status: r.status, out }
    }

    // 正例:新增 .py,import 一个**本次没被改动**的已入库模块 ⇒ 必须绿。
    // 这条在改前是 rc=1(假红),因为目标模块不在 diff 子集里。
    mkdirSync(join(repo, 'apps', 'ai-service', 'tests'), { recursive: true })
    writeFileSync(
      join(repo, 'apps', 'ai-service', 'tests', 'test_new.py'),
      'from app.core.context_compaction import THRESHOLD\n',
      'utf8',
    )
    gc(['add', 'apps/ai-service/tests/test_new.py'])
    const good = runStaged()
    assert.equal(
      good.status,
      0,
      `import 已入库模块的新增 .py 必须绿(在位性按面全集判);实得 ${String(good.status)}:\n${good.out.slice(0, 600)}`,
    )
    assert.doesNotMatch(
      good.out,
      /context_compaction/,
      '在位的模块不得被点名成缺失(那正是本票的假红)',
    )

    // 反例:同形态但 import 一个**不存在**的模块 ⇒ 必须红。
    // 反向锁:修红不得顺手削判据 —— 真破口必须仍然红。
    writeFileSync(
      join(repo, 'apps', 'ai-service', 'tests', 'test_broken.py'),
      'from app.core.does_not_exist import Y\n',
      'utf8',
    )
    gc(['add', 'apps/ai-service/tests/test_broken.py'])
    const bad = runStaged()
    assert.equal(
      bad.status,
      1,
      `import 不存在的模块必须红;实得 ${String(bad.status)}:\n${bad.out.slice(0, 600)}`,
    )
    assert.match(bad.out, /does_not_exist/, '必须点名那个真缺失的模块')
    assert.doesNotMatch(bad.out, /context_compaction/, '在位模块不得被连坐')

    // 三态互斥:新增文件没有 HEAD 自身锚点是**定义后果**(cap=0、方向取最严),
    // 归「棘轮基线」一档,**不许**落进「未判定」—— 否则同一条 import 挂两个互斥结论。
    const j = JSON.parse(runStaged(['--json']).out)
    assert.equal(j.violations.length, 1, '只应一条判红(那个真缺失的)')
    assert.equal(j.undetermined.length, 0, '新增文件的锚点缺项归棘轮基线,不是未判定(两档必须互斥)')
    assert.equal(j.anchorBaseline.length, 1, '棘轮基线仍须大声报名(不许吞声)')
  } finally {
    rmSync(s, { recursive: true, force: true })
  }
})

test('T7b --staged 遇到新增但未 git add 的 .py 必须单独报名,不得与"本次没有 Python"并成一句', () => {
  const s = mkScratch('pyland-unstaged')
  try {
    const repo = join(s, 'repo')
    mkdirSync(repo, { recursive: true })
    execFileSync(GIT, ['-C', s, 'init', '-q', 'repo'], {
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const appDir = join(repo, 'apps', 'ai-service', 'app')
    mkdirSync(appDir, { recursive: true })
    writeFileSync(join(appDir, '__init__.py'), '', 'utf8')
    copyScriptClosure(GATE, join(repo, 'scripts', 'check-python-import-landed.mjs'))
    const gc = (args) =>
      execFileSync(
        GIT,
        [
          '-C',
          repo,
          '-c',
          'user.name=t',
          '-c',
          'user.email=t@t',
          '-c',
          'core.autocrlf=false',
          ...args,
        ],
        {
          encoding: 'utf8',
          timeout: GIT_TIMEOUT_MS,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
    gc(['add', '-A'])
    gc(['commit', '-q', '-m', 'baseline'])

    // 写一个**不 git add** 的 .py ⇒ 索引面上没有它。
    writeFileSync(join(repo, 'apps', 'ai-service', 'forgotten.py'), 'X = 1\n', 'utf8')

    const r = spawnSync(
      process.execPath,
      [join(repo, 'scripts', 'check-python-import-landed.mjs'), '--staged'],
      {
        encoding: 'utf8',
        timeout: 180000,
        cwd: repo,
        windowsHide: true,
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const out = String(r.stdout ?? '') + String(r.stderr ?? '')
    assert.doesNotMatch(
      out,
      /ERR_MODULE_NOT_FOUND|SyntaxError|Cannot find module/,
      '崩溃不是判据结论:\n' + out.slice(0, 400),
    )
    assert.match(
      out,
      /未 git add/,
      '漏 git add 是真实风险(那份 .py 不会随本次提交入库),必须单独报名:\n' + out.slice(0, 600),
    )
    assert.equal(
      r.status,
      0,
      '报名不等于判红:共享工作树里常年有别人在飞的未跟踪 .py,判红就是恒红门(§12e)',
    )
  } finally {
    rmSync(s, { recursive: true, force: true })
  }
})

// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 `scripts/check-python-import-landed.mjs` 的 §22c 镜像测试。
 *
 * 为什么必须有它:该门判的是"HEAD 里有人 import 一个从未入库的 Python 模块"这一型
 * (干净检出/CI 必 ModuleNotFoundError,而本机在跑的进程把它掩盖了)。它当前**刻意不在提交链**,
 * 所以"门在、判据对、无人调度"与"判据根本没跑"在账面上长得一样 —— 只有源码级反向锁能分开。
 *
 * 七条各钉一件事:
 *  T1 方向锁:未接 runner 时头注必须自称"尚未接提交链";若被接进 runner,必须成套(blocking + skipEnv)。
 *  T2 取材面形状锁:内容必须走 face-reader,不得留磁盘读 / 自拼 git 取正文 / cwd 定根。
 *  T3 判据有牙(纯函数构造面):缺失报 / __init__.py 与同名模块放过 / 注释不判 / 第三方不判。
 *  T4 端到端双向锁(临时 git 仓 + 整条 lib 闭包):注入必红并点名,补齐必转绿。
 *  T5 --staged 本次无射程内 .py 时必须回退 HEAD 全量且 rc=0(恒挡 = 逼人 --no-verify)。
 *  T6 覆盖面自证:HEAD 全量必须真扫到成百个 .py,扫到 0 不记通过。
 * T7 「本轮扫谁」≠「在位性按哪张面判」(票 G-1058652 的反向锁):临时仓里新增一个 import
 *    **已入库**模块的 .py 并 staged ⇒ 必须绿;同形态 import **不存在**的模块 ⇒ 必须红,
 *    且"缺失/未判定"两档互斥(新增文件没有 HEAD 自身锚点是定义后果,归棘轮基线,不是未判定)。
 *    另钉:`--staged` 遇到**新增但未 git add** 的 .py 必须单独报名,不许与"本次没有 Python"并成一句。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch } from '../lib/scratch-dir.mjs'
import * as gate from '../check-python-import-landed.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GATE = join(ROOT, 'scripts', 'check-python-import-landed.mjs')
const GIT = process.env.IHUI_GIT_BIN ?? 'git'
const GIT_TIMEOUT_MS = 60000

const headRunner = () => {
  try {
    return execFileSync(GIT, ['-C', ROOT, 'show', 'HEAD:scripts/guardian-runner.mjs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 26,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    })
  } catch {
    return readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  }
}

/** 把门脚本**连它 import 的整条 lib 闭包**拷进夹具(按名字手列依赖必然随每一次 lib 演进再漂一遍)。 */
function copyScriptClosure(srcFile, dstFile) {
  const scriptsRoot = dirname(srcFile)
  const queue = [srcFile]
  const seen = new Set()
  while (queue.length) {
    const f = resolve(queue.shift())
    if (seen.has(f) || !existsSync(f)) continue
    seen.add(f)
    const target =
      f === resolve(srcFile) ? dstFile : join(dirname(dstFile), relative(scriptsRoot, f))
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(f, target)
    for (const m of readFileSync(f, 'utf8').matchAll(/from\s+['"](\.[^'"]+\.mjs)['"]/g)) {
      queue.push(resolve(dirname(f), m[1]))
    }
  }
}

test('T1 未接提交链时头注必须自称"尚未接";接了就必须成套(blocking + skipEnv)', () => {
  const src = readFileSync(GATE, 'utf8')
  const runner = headRunner()
  const wired = /check-python-import-landed\.mjs/.test(runner)
  if (!wired) {
    assert.match(
      src,
      /尚未接提交链|刻意尚未接/,
      '门未接线却不自称未接 ⇒ 文档撒谎会被守门 89 R2 每次提交判红(恒红门)',
    )
    return
  }
  const entry = runner.match(/check-python-import-landed\.mjs[\s\S]{0,600}/)?.[0] ?? ''
  assert.match(entry, /mode:\s*'blocking'/, '接进提交链却不 blocking ⇒ 判对了也不拦')
  assert.match(
    entry,
    /skipEnv:\s*'HUSKY_SKIP_PYTHON_IMPORT_LANDED'/,
    'blocking 门必须声明应急出口(名字须与门体头注一致,否则守门 172 判假逃生舱)',
  )
})

test('T2 取材面纪律:内容走 face-reader,禁磁盘读 / 禁 cwd 定根', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '引了层却不用读取入口 = 半接线(守门 118 判的那一型)')
  assert.doesNotMatch(src, /process\.cwd\(\)/, '扫哪棵树不得由调用者站在哪决定')
  assert.doesNotMatch(
    src,
    /readFileSync\(\s*(join|resolve)\(\s*ROOT/,
    '被审内容不得按磁盘读(共享工作树常年滞后 HEAD)',
  )
})

test('T3 判据有牙:缺失报 / 同名模块与 __init__.py 放过 / 注释与第三方不判', () => {
  const set = new Set([
    'apps/ai-service/app/services/ok.py',
    'apps/ai-service/app/services/pkg/__init__.py',
  ])
  const miss = gate.scanFile(
    'apps/ai-service/app/routers/x.py',
    'from app.services.ghost import Y\n',
    set,
  )
  assert.equal(miss.missing.length, 1, 'import 一个没入库的模块必须报缺失')
  assert.match(JSON.stringify(miss.missing), /ghost/, '要点名模块,不能只给个数')
  assert.equal(
    gate.scanFile('apps/ai-service/app/routers/x.py', 'from app.services.ok import Y\n', set)
      .missing.length,
    0,
    '同名模块在位不得判红',
  )
  assert.equal(
    gate.scanFile('apps/ai-service/app/routers/x.py', 'from app.services.pkg import Y\n', set)
      .missing.length,
    0,
    '__init__.py 视为包在位',
  )
  assert.equal(
    gate.scanFile('apps/ai-service/app/routers/x.py', '# from app.services.ghost import Y\n', set)
      .missing.length,
    0,
    '注释里的 import 不判',
  )
  assert.equal(
    gate.scanFile(
      'apps/ai-service/app/routers/x.py',
      'import httpx\nfrom fastapi import APIRouter\n',
      set,
    ).missing.length,
    0,
    '第三方/标准库既不判红也不落未判定(名单必然腐烂)',
  )
  // cand 的键形与清单面同形(带 PY_ROOT 前缀)—— 这条不是细节而是判据的一部分:
  // 取错键形会让"在位"被读成"缺失",反过来也会让"缺失"被读成"在位"。
  assert.equal(gate.modulePresent(set, 'apps/ai-service/app/services/ok'), true)
  assert.equal(gate.modulePresent(set, 'apps/ai-service/app/services/pkg'), true)
  assert.equal(gate.modulePresent(set, 'apps/ai-service/app/services/nope'), false)
  assert.equal(
    gate.PY_ROOT,
    'apps/ai-service',
    '内置根必须是 ai-service(D-P2 之后它是**下限**,面上声明的根只加不减)',
  )
  assert.deepEqual(
    gate.BUILTIN_ROOT_PACKAGES.map((r) => r.root),
    ['apps/ai-service'],
    '内置根清单只此一条 ⇒ 任何新增射程必须来自**被审面上的 pyproject 事实**,不得回头改常量(§0.6)',
  )
})

test('T4 端到端双向锁:注入未入库模块必红并点名,补齐文件后必转绿', () => {
  const s = mkScratch('pyland-e2e')
  try {
    const repo = join(s, 'repo')
    execFileSync(GIT, ['-C', s, 'init', '-q', 'repo'], {
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const gatePath = join(repo, 'scripts', 'check-python-import-landed.mjs')
    copyScriptClosure(GATE, gatePath)
    const run = () =>
      spawnSync(process.execPath, [gatePath, '--worktree'], {
        encoding: 'utf8',
        timeout: 180000,
        cwd: repo,
        windowsHide: true,
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    const appDir = join(repo, 'apps', 'ai-service', 'app')
    mkdirSync(appDir, { recursive: true })
    writeFileSync(join(appDir, '__init__.py'), '', 'utf8')
    writeFileSync(join(appDir, 'routers_x.py'), 'from app.services.ghost import Y\n', 'utf8')

    const bad = run()
    const badOut = String(bad.stdout ?? '') + String(bad.stderr ?? '')
    assert.doesNotMatch(
      badOut,
      /SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module/,
      '夹具缺件会伪装成判据结论(闭包没拷全 = 收集期崩,而退出码同样是 1):\n' + badOut.slice(0, 500),
    )
    assert.equal(
      bad.status,
      1,
      `注入未入库模块必须 rc=1,实得 ${String(bad.status)}:\n${badOut.slice(0, 500)}`,
    )
    assert.match(badOut, /ghost/, '必须点名那个模块')

    mkdirSync(join(appDir, 'services'), { recursive: true })
    writeFileSync(join(appDir, 'services', '__init__.py'), '', 'utf8')
    writeFileSync(join(appDir, 'services', 'ghost.py'), 'Y = 1\n', 'utf8')
    const good = run()
    const goodOut = String(good.stdout ?? '') + String(good.stderr ?? '')
    assert.equal(
      good.status,
      0,
      `补齐后必须转绿(否则红的成因不是"没入库"):\n${goodOut.slice(0, 500)}`,
    )
  } finally {
    rmSync(s, { recursive: true, force: true })
  }
})

test('T5 --staged 本次无 ai-service 的 .py 时必须回退 HEAD 全量且 rc=0', () => {
  const r = spawnSync(process.execPath, [GATE, '--staged'], {
    encoding: 'utf8',
    timeout: 300000,
    windowsHide: true,
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const out = String(r.stdout ?? '') + String(r.stderr ?? '')
  assert.doesNotMatch(
    out,
    /SyntaxError|Cannot find module|ERR_MODULE_NOT_FOUND/,
    '崩溃不是判据结论:\n' + out.slice(0, 300),
  )
  if (/回退 HEAD 全量/.test(out)) {
    assert.equal(r.status, 0, '回退档不得判死(恒挡 = 逼人 --no-verify,门 135/46/157 同一课)')
  } else {
    assert.ok(
      r.status === 0 || r.status === 1,
      `共享索引此刻确有 .py 时只应 0/1,实得 ${String(r.status)}:\n${out.slice(0, 300)}`,
    )
  }
})

test('T6 覆盖面自证:HEAD 全量必须真扫到成百个 .py,扫到 0 不记通过', () => {
  const r = spawnSync(process.execPath, [GATE, '--json'], {
    encoding: 'utf8',
    timeout: 300000,
    windowsHide: true,
    maxBuffer: 1 << 27,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.doesNotMatch(String(r.stderr ?? ''), /SyntaxError|Cannot find module/)
  assert.equal(r.status, 0, `默认档只报存量 ⇒ rc 应 0(实得 ${String(r.status)})`)
  const j = JSON.parse(String(r.stdout ?? '{}'))
  assert.ok(
    Number(j.scanned ?? 0) > 500,
    `HEAD 面扫到的 .py 必须成百,实得 ${String(j.scanned)} —— 0 命中先怀疑尺子`,
  )
  assert.equal(j.face, 'head', '缺省档必须判 HEAD blob,不是索引也不是磁盘')
})

// ═══════════════════════════════════════════════════════════════════════════
// T8–T12(2026-10-29 立,票面:"被 import 的模块根本没入库,而全部门照绿"):
// 每一格都是**成对**夹具 —— 造出坏 import ⇒ 判红;把新增的那一段判据摘掉 ⇒ 必须翻绿。
// 摘法用"改夹具里那份门脚本的源码"而不是口头保证;每条都先锁"要改的那一行原文还在",
// 否则 replace 打空 = 摘了个寂寞,反向锁会假过(本仓记过多次"绿行覆盖的面比读它的人以为的小")。
// ═══════════════════════════════════════════════════════════════════════════

/** 独立临时仓(共享索引不许碰:本仓多会话并发,git add/reset 会吞别人在飞暂存窗口)。 */
function mkRepo(tag) {
  const s = mkScratch(tag)
  const repo = join(s, 'repo')
  mkdirSync(repo, { recursive: true })
  execFileSync(GIT, ['-C', s, 'init', '-q', 'repo'], {
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const gc = (args) =>
    execFileSync(
      GIT,
      [
        '-C',
        repo,
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t',
        '-c',
        'core.autocrlf=false',
        ...args,
      ],
      {
        encoding: 'utf8',
        timeout: GIT_TIMEOUT_MS,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 1 << 26,
      },
    )
  const gatePath = join(repo, 'scripts', 'check-python-import-landed.mjs')
  copyScriptClosure(GATE, gatePath)
  const run = (args = [], opts = {}) => {
    const r = spawnSync(process.execPath, [gatePath, ...args], {
      encoding: 'utf8',
      timeout: 300000,
      cwd: repo,
      windowsHide: true,
      maxBuffer: 1 << 27,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = String(r.stdout ?? '') + String(r.stderr ?? '')
    assert.doesNotMatch(
      out,
      /ERR_MODULE_NOT_FOUND|SyntaxError|Cannot find module/,
      '夹具崩溃会伪装成判据结论(退出码同样是 1):\n' + out.slice(0, 600),
    )
    if (opts.expectSource)
      assert.match(
        out,
        opts.expectSource,
        `输出必须点名被判红的那一条(实得:\n${out.slice(0, 600)})`,
      )
    return { status: r.status, out }
  }
  /** 把夹具里那份门脚本按 from…to 改写(反向锁的"摘掉这一维");原文不在 ⇒ 当场失败。 */
  const patchGate = (from, to) => {
    const src = readFileSync(gatePath, 'utf8')
    assert.ok(src.includes(from), `反向锁要打空了:门体里找不到原文\n  ${from}`)
    writeFileSync(gatePath, src.replace(from, to), 'utf8')
  }
  return { s, repo, gc, gatePath, run, patchGate }
}

test('T8 旁路落地通道(全量档=落地后复跑那一档)必红;摘掉 D-P1 的父提交锚点 ⇒ 翻绿', () => {
  const t = mkRepo('pyland-landing')
  try {
    const app = join(t.repo, 'apps', 'ai-service', 'app')
    mkdirSync(join(app, 'core'), { recursive: true })
    writeFileSync(join(app, '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', 'ok.py'), 'V = 1\n', 'utf8')
    t.gc(['add', '-A'])
    t.gc(['commit', '-q', '-m', 'baseline'])

    // 造出坏 import:绝对形态与相对形态各一枚,独立可点名。
    writeFileSync(join(app, 'break_abs.py'), 'from app.core.never_landed import W\n', 'utf8')
    writeFileSync(join(app, 'break_rel.py'), 'from .ghost_sibling import Z\n', 'utf8')
    t.gc(['add', '-A'])
    // 旁路落地:commit-tree + update-ref(结构上不跑钩子)—— 与 object-space-land / union-converge 同形
    const tree = t.gc(['write-tree']).trim()
    const parent = t.gc(['rev-parse', 'HEAD']).trim()
    const landed = t.gc(['commit-tree', tree, '-p', parent, '-m', 'chore(auto): 收编在飞件']).trim()
    t.gc(['update-ref', 'HEAD', landed])
    t.gc(['reset', '-q', '--hard', landed])

    // 正向:按注册条目 args=[] 复跑(= land-gate-rerun 落地后那一臂)⇒ 必须红,并点名两型。
    const red = t.run([])
    assert.equal(
      red.status,
      1,
      `落地把坏 import 送进 HEAD ⇒ 全量档必须红;实得 ${red.status}:\n${red.out.slice(0, 700)}`,
    )
    assert.match(red.out, /never_landed/, '绝对导入那一型必须点名')
    assert.match(red.out, /ghost_sibling/, '相对导入那一型必须点名(与绝对形态独立)')

    // 反向成对:摘掉 D-P1(锚点退回被审面自身自比)⇒ 同一枚 HEAD 必须翻绿 ——
    // 证明红的是"父提交锚点"这一行,不是别的什么顺带效应。
    t.patchGate(`if (face === 'head') return 'HEAD^'`, `if (face === 'head') return 'HEAD'`)
    const green = t.run([])
    assert.equal(
      green.status,
      0,
      `摘掉父提交锚点后必须翻绿(这就是改前的失明形态);实得 ${green.status}:\n${green.out.slice(0, 700)}`,
    )
    assert.match(green.out, /存量 2 处/, '翻绿不等于看不见:同一批缺失必须仍按存量报名')
  } finally {
    rmSync(t.s, { recursive: true, force: true })
  }
})

test('T9 --rev/--anchor/--root 契约:树对象没锚点⇒未判定;落地前审树⇒红;两面旗同给⇒未判定', () => {
  const t = mkRepo('pyland-rev')
  try {
    const app = join(t.repo, 'apps', 'ai-service', 'app')
    mkdirSync(join(app, 'core'), { recursive: true })
    writeFileSync(join(app, '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', '__init__.py'), '', 'utf8')
    t.gc(['add', '-A'])
    t.gc(['commit', '-q', '-m', 'baseline'])

    // 落地器形态:树还没提交就审(= object-space-land 的 onTree 通道)。
    writeFileSync(join(app, 'pre_land.py'), 'from app.core.not_in_this_tree import W\n', 'utf8')
    t.gc(['add', '-A'])
    const tree = t.gc(['write-tree']).trim()

    const noAnchor = t.run(['--rev', tree])
    assert.equal(
      noAnchor.status,
      2,
      `树对象无锚点 ⇒ 未判定(不记绿也不冒红);实得 ${noAnchor.status}`,
    )
    assert.match(noAnchor.out, /树对象,没有父提交/)

    const withAnchor = t.run(['--rev', tree, '--anchor', 'HEAD'])
    assert.equal(
      withAnchor.status,
      1,
      `审这棵树相对 HEAD 必须红;实得 ${withAnchor.status}:\n${withAnchor.out.slice(0, 600)}`,
    )
    assert.match(withAnchor.out, /not_in_this_tree/)

    // 被审面取不到 ⇒ 未判定;绝不回落到另一个面冒充"审过了"。
    const bogus = t.run(['--rev', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'])
    assert.equal(bogus.status, 2, '不存在的 --rev ⇒ 未判定')
    assert.match(bogus.out, /既不是提交也不是树对象/)

    const twoFaces = t.run(['--rev', tree, '--staged'])
    assert.equal(twoFaces.status, 2, '--rev 与 --staged 同给 ⇒ 面只能有一个')
    const twoFlags = t.run(['--staged', '--worktree'])
    assert.equal(twoFlags.status, 2, '两面旗同给 ⇒ 未判定(既有契约,不许被新档松掉)')

    // --root:坏值一律未判定,不静默回落到脚本位置自推导。
    assert.equal(
      t.run(['--root', join(t.s, 'nope-not-here')]).status,
      2,
      '--root 指向不存在的目录 ⇒ 未判定',
    )
    assert.equal(t.run(['--root']).status, 2, '--root 给了旗标没给值 ⇒ 未判定')
    const okRoot = t.run(['--rev', tree, '--anchor', 'HEAD', '--root', t.repo])
    assert.equal(
      okRoot.status,
      1,
      `显式 --root 指向被审仓时必须照判红;实得 ${okRoot.status}:\n${okRoot.out.slice(0, 500)}`,
    )
  } finally {
    rmSync(t.s, { recursive: true, force: true })
  }
})

test('T10 删除承载模块方向:consumer 一行没动、承载模块被删 ⇒ 必红;锚点改用被审面全集 ⇒ 翻绿', () => {
  const t = mkRepo('pyland-delete')
  try {
    const app = join(t.repo, 'apps', 'ai-service', 'app')
    mkdirSync(join(app, 'core'), { recursive: true })
    writeFileSync(join(app, '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', 'carrier.py'), 'V = 1\n', 'utf8')
    writeFileSync(join(app, 'consumer.py'), 'from app.core.carrier import V\n', 'utf8')
    t.gc(['add', '-A'])
    t.gc(['commit', '-q', '-m', 'baseline'])

    // 第二枚提交只删承载模块,consumer 逐字节没动 ⇒ 旧口径 cap 与 mine 相等 ⇒ 结构上不红。
    t.gc(['rm', '-q', 'apps/ai-service/app/core/carrier.py'])
    t.gc(['commit', '-q', '-m', 'chore: 删掉承载模块'])

    const red = t.run([])
    assert.equal(
      red.status,
      1,
      `删掉承载模块必须红(consumer 未改≠没坏);实得 ${red.status}:\n${red.out.slice(0, 700)}`,
    )
    assert.match(red.out, /core\/carrier/, '要点名那个被删的模块')

    // 反向成对:把"锚点面的缺失按锚点面自己的全集数"摘掉(退回被审面全集)⇒ 必须翻绿。
    t.patchGate(
      'cap = scanFile(file, a, anchor.index, anchor.ctx).missing.length',
      'cap = scanFile(file, a, audited.index, audited.ctx).missing.length',
    )
    const green = t.run([])
    assert.equal(
      green.status,
      0,
      `摘掉锚点面全集后必须翻绿;实得 ${green.status}:\n${green.out.slice(0, 700)}`,
    )
  } finally {
    rmSync(t.s, { recursive: true, force: true })
  }
})

test('T11 面上声明的第二分发包(SETUPTOLS find):坏 import 必红;摘掉 pyproject 声明根采集 ⇒ 翻绿', () => {
  const t = mkRepo('pyland-sdk')
  try {
    const ai = join(t.repo, 'apps', 'ai-service', 'app')
    mkdirSync(ai, { recursive: true })
    writeFileSync(join(ai, '__init__.py'), '', 'utf8')
    const sdk = join(t.repo, 'packages', 'sdk', 'python', 'ihui_ai')
    mkdirSync(sdk, { recursive: true })
    writeFileSync(
      join(t.repo, 'packages', 'sdk', 'python', 'pyproject.toml'),
      '[tool.setuptools.packages.find]\nwhere = ["."]\ninclude = ["ihui_ai*"]\n',
      'utf8',
    )
    writeFileSync(join(sdk, '__init__.py'), '', 'utf8')
    writeFileSync(join(sdk, 'base.py'), 'B = 1\n', 'utf8')
    t.gc(['add', '-A'])
    t.gc(['commit', '-q', '-m', 'baseline'])

    // 绝对 + 相对两型都在**第二个根**下(旧口径 parts[0]!=='app' ⇒ 整片静默放过)。
    writeFileSync(
      join(sdk, 'client.py'),
      'from ihui_ai.ghost import X\nfrom .missing_sibling import Y\n',
      'utf8',
    )
    t.gc(['add', '-A'])
    const red = t.run(['--staged'])
    assert.equal(
      red.status,
      1,
      `第二分发包里的坏 import 必须红;实得 ${red.status}:\n${red.out.slice(0, 700)}`,
    )
    assert.match(red.out, /ihui_ai\/ghost/, '绝对形态要点名')
    assert.match(red.out, /missing_sibling/, '相对形态要点名')

    // 反向成对:摘掉 pyproject 声明根的采集 ⇒ 这一族整片退出射程 ⇒ 必须翻绿(证明红的是那一格)。
    t.patchGate('const parsed = parsePyprojectPackages(p, text)', 'const parsed = null')
    const green = t.run(['--staged'])
    assert.equal(
      green.status,
      0,
      `摘掉声明根采集后必须翻绿;实得 ${green.status}:\n${green.out.slice(0, 700)}`,
    )
  } finally {
    rmSync(t.s, { recursive: true, force: true })
  }
})

test('T12 面上事实的顶层目录(scripts./tests./bench.):坏 import 必红;摘掉 topsUnderRoot ⇒ 翻绿', () => {
  const t = mkRepo('pyland-face-tops')
  try {
    const ai = join(t.repo, 'apps', 'ai-service')
    mkdirSync(join(ai, 'app'), { recursive: true })
    mkdirSync(join(ai, 'scripts'), { recursive: true })
    writeFileSync(join(ai, 'app', '__init__.py'), '', 'utf8')
    writeFileSync(join(ai, 'scripts', 'real_tool.py'), 'R = 1\n', 'utf8')
    t.gc(['add', '-A'])
    t.gc(['commit', '-q', '-m', 'baseline'])

    writeFileSync(
      join(ai, 'app', 'user.py'),
      'from scripts.real_tool import R\nfrom scripts.ghost_tool import G\n',
      'utf8',
    )
    t.gc(['add', '-A'])
    const red = t.run(['--staged'])
    assert.equal(
      red.status,
      1,
      `面上真实存在的 scripts 包里的坏 import 必须红;实得 ${red.status}:\n${red.out.slice(0, 700)}`,
    )
    assert.match(red.out, /scripts\/ghost_tool/, '要点名缺的那一枚')
    assert.doesNotMatch(
      red.out,
      /scripts\/real_tool/,
      '在位的同包模块不得被连坐(假红就是逼 --no-verify)',
    )

    // 反向成对:摘掉"根下含 .py 的直接子目录也算本仓顶层名"⇒ 这一型静默放过 ⇒ 必须翻绿。
    t.patchGate(
      'for (const top of topsUnderRoot(pyPaths ?? [], spec.root)) add(spec.root, top)',
      'for (const top of []) add(spec.root, top)',
    )
    const green = t.run(['--staged'])
    assert.equal(
      green.status,
      0,
      `摘掉面上事实那一维后必须翻绿;实得 ${green.status}:\n${green.out.slice(0, 700)}`,
    )
  } finally {
    rmSync(t.s, { recursive: true, force: true })
  }
})

test('T13 形状锁:七处反向锁要摘的原文必须还在门体里(摘不到就打空,打空就是假过的反向锁)', () => {
  const src = readFileSync(GATE, 'utf8')
  for (const literal of [
    `if (face === 'head') return 'HEAD^'`,
    'cap = scanFile(file, a, anchor.index, anchor.ctx).missing.length',
    'const parsed = parsePyprojectPackages(p, text)',
    'for (const top of topsUnderRoot(pyPaths ?? [], spec.root)) add(spec.root, top)',
    'const rev = revFlag.value ?? null',
    "return { kind: 'abs', base: bases[0], bases, parts, star }",
    "      kind: 'rel',",
  ])
    assert.ok(src.includes(literal), `门体里找不到这一行原文 ⇒ 对应反向锁会静默打空:\n  ${literal}`)
})

test('T14 --rev 档成对:落地前审那棵树必红;摘掉 --rev 档(整档不接被审树)⇒ 翻绿', () => {
  const t = mkRepo('pyland-rev-mutate')
  try {
    const app = join(t.repo, 'apps', 'ai-service', 'app')
    mkdirSync(join(app, 'core'), { recursive: true })
    writeFileSync(join(app, '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', '__init__.py'), '', 'utf8')
    t.gc(['add', '-A'])
    t.gc(['commit', '-q', '-m', 'baseline'])
    writeFileSync(join(app, 'pre_land.py'), 'from app.core.not_in_this_tree import W\n', 'utf8')
    t.gc(['add', '-A'])
    const tree = t.gc(['write-tree']).trim()

    const red = t.run(['--rev', tree, '--anchor', 'HEAD'])
    assert.equal(
      red.status,
      1,
      `落地前审这棵树必须红;实得 ${red.status}:\n${red.out.slice(0, 600)}`,
    )
    assert.match(red.out, /not_in_this_tree/)

    // 摘掉 --rev 档(整档不接被审树 ⇒ 退回判 HEAD 自身)⇒ 必须翻绿:证明红的是"审那棵树"这一格,
    // 不是别处顺带效应 —— 落地器在 commit-tree 之前问一次的那条通道就是这么被摘没的。
    t.patchGate('const rev = revFlag.value ?? null', 'const rev = null')
    const green = t.run(['--rev', tree, '--anchor', 'HEAD'])
    assert.equal(
      green.status,
      0,
      `摘掉 --rev 档后必须翻绿;实得 ${green.status}:\n${green.out.slice(0, 600)}`,
    )
    assert.match(green.out, /判定面=head:/, '摘掉后应回落到 HEAD 自身(未提交的那棵树不再被审)')
  } finally {
    rmSync(t.s, { recursive: true, force: true })
  }
})

// 绝对形态与相对形态**各自独立成对**(票面要求):把对应那一支的分类摘掉 ⇒ 只有那一型翻绿。
test('T15 绝对导入形态独立成对:只坏绝对 ⇒ 红;摘掉 abs 分类 ⇒ 翻绿', () => {
  const t = mkRepo('pyland-abs-pair')
  try {
    const app = join(t.repo, 'apps', 'ai-service', 'app')
    mkdirSync(join(app, 'core'), { recursive: true })
    writeFileSync(join(app, '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', 'ok.py'), 'V = 1\n', 'utf8')
    t.gc(['add', '-A'])
    t.gc(['commit', '-q', '-m', 'baseline'])
    writeFileSync(
      join(app, 'only_abs.py'),
      'from app.core.ok import V\nfrom app.services.never_abs import W\n',
      'utf8',
    )
    t.gc(['add', '-A'])
    const red = t.run(['--staged'])
    assert.equal(red.status, 1, `坏绝对导入必须红;实得 ${red.status}:\n${red.out.slice(0, 600)}`)
    assert.match(red.out, /never_abs/)
    assert.doesNotMatch(red.out, /core\/ok/, '在位的绝对模块不得被连坐')

    t.patchGate(
      `return { kind: 'abs', base: bases[0], bases, parts, star }`,
      `return { kind: 'other', mod, star }`,
    )
    const green = t.run(['--staged'])
    assert.equal(
      green.status,
      0,
      `摘掉 abs 分类后必须翻绿;实得 ${green.status}:\n${green.out.slice(0, 600)}`,
    )
  } finally {
    rmSync(t.s, { recursive: true, force: true })
  }
})

test('T16 相对导入形态独立成对:只坏相对 ⇒ 红;摘掉 rel 分类 ⇒ 翻绿', () => {
  const t = mkRepo('pyland-rel-pair')
  try {
    const app = join(t.repo, 'apps', 'ai-service', 'app')
    mkdirSync(join(app, 'core'), { recursive: true })
    writeFileSync(join(app, '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', '__init__.py'), '', 'utf8')
    writeFileSync(join(app, 'core', 'ok.py'), 'V = 1\n', 'utf8')
    t.gc(['add', '-A'])
    t.gc(['commit', '-q', '-m', 'baseline'])
    writeFileSync(
      join(app, 'core', 'only_rel.py'),
      'from .ok import V\nfrom .never_rel import W\n',
      'utf8',
    )
    t.gc(['add', '-A'])
    const red = t.run(['--staged'])
    assert.equal(
      red.status,
      1,
      `坏相对导入必须红(点数决定上溯层数,同级 .ok 不得连坐);实得 ${red.status}:\n${red.out.slice(0, 600)}`,
    )
    assert.match(red.out, /never_rel/)
    assert.doesNotMatch(red.out, /core\/ok/, '在位的同级模块不得被连坐')

    t.patchGate(
      `return {
      kind: 'rel',`,
      `return {
      kind: 'other',`,
    )
    const green = t.run(['--staged'])
    assert.equal(
      green.status,
      0,
      `摘掉 rel 分类后必须翻绿;实得 ${green.status}:\n${green.out.slice(0, 600)}`,
    )
  } finally {
    rmSync(t.s, { recursive: true, force: true })
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
