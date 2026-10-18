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
      timeout: GIT_TIMEOUT_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    // 基线:被 import 的目标**真的在 HEAD 上**(台账要求"别猜",这里坐实)
    const appDir = join(repo, 'apps', 'ai-service', 'app')
    mkdirSync(join(appDir, 'core'), { recursive: true })
    writeFileSync(join(appDir, '__init__.py'), '', 'utf8')
    writeFileSync(join(appDir, 'core', '__init__.py'), '', 'utf8')
    writeFileSync(join(appDir, 'core', 'context_compaction.py'), 'THRESHOLD = 1\n', 'utf8')
    copyScriptClosure(GATE, join(repo, 'scripts', 'check-python-import-landed.mjs'))
    const gc = (args) =>
      execFileSync(GIT, ['-C', repo, ...args], {
        encoding: 'utf8', timeout: GIT_TIMEOUT_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      })
    gc(['add', '-A'])
    gc(['commit', '-q', '-m', 'baseline'])

    const runStaged = (extra = []) => {
      const r = spawnSync(
        process.execPath,
        [join(repo, 'scripts', 'check-python-import-landed.mjs'), '--staged', ...extra],
        { encoding: 'utf8', timeout: 180000, cwd: repo, windowsHide: true,
          maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] },
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
    assert.equal(bad.status, 1, `import 不存在的模块必须红;实得 ${String(bad.status)}:\n${bad.out.slice(0, 600)}`);
    assert.match(bad.out, /does_not_exist/, '必须点名那个真缺失的模块');
    assert.doesNotMatch(bad.out, /context_compaction/, '在位模块不得被连坐');

    // 三态互斥:新增文件没有 HEAD 自身锚点是**定义后果**(cap=0、方向取最严),
    // 归「棘轮基线」一档,**不许**落进「未判定」—— 否则同一条 import 挂两个互斥结论。
    const j = JSON.parse(runStaged(['--json']).out)
    assert.equal(j.violations.length, 1, '只应一条判红(那个真缺失的)')
    assert.equal(
      j.undetermined.length,
      0,
      '新增文件的锚点缺项归棘轮基线,不是未判定(两档必须互斥)',
    )
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
      timeout: GIT_TIMEOUT_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    const appDir = join(repo, 'apps', 'ai-service', 'app')
    mkdirSync(appDir, { recursive: true })
    writeFileSync(join(appDir, '__init__.py'), '', 'utf8')
    copyScriptClosure(GATE, join(repo, 'scripts', 'check-python-import-landed.mjs'))
    const gc = (args) =>
      execFileSync(GIT, ['-C', repo, ...args], {
        encoding: 'utf8', timeout: GIT_TIMEOUT_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      })
    gc(['add', '-A'])
    gc(['commit', '-q', '-m', 'baseline'])

    // 写一个**不 git add** 的 .py ⇒ 索引面上没有它。
    writeFileSync(join(repo, 'apps', 'ai-service', 'forgotten.py'), 'X = 1\n', 'utf8')

    const r = spawnSync(
      process.execPath,
      [join(repo, 'scripts', 'check-python-import-landed.mjs'), '--staged'],
      { encoding: 'utf8', timeout: 180000, cwd: repo, windowsHide: true,
        maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const out = String(r.stdout ?? '') + String(r.stderr ?? '')
    assert.doesNotMatch(out, /ERR_MODULE_NOT_FOUND|SyntaxError|Cannot find module/, '崩溃不是判据结论:\n' + out.slice(0, 400))
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
    const target = f === resolve(srcFile) ? dstFile : join(dirname(dstFile), relative(scriptsRoot, f))
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
  assert.match(entry, /skipEnv:\s*'HUSKY_SKIP_PYTHON_IMPORT_LANDED'/, 'blocking 门必须声明应急出口(名字须与门体头注一致,否则守门 172 判假逃生舱)')
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
  const miss = gate.scanFile('apps/ai-service/app/routers/x.py', 'from app.services.ghost import Y\n', set)
  assert.equal(miss.missing.length, 1, 'import 一个没入库的模块必须报缺失')
  assert.match(JSON.stringify(miss.missing), /ghost/, '要点名模块,不能只给个数')
  assert.equal(gate.scanFile('apps/ai-service/app/routers/x.py', 'from app.services.ok import Y\n', set).missing.length, 0, '同名模块在位不得判红')
  assert.equal(gate.scanFile('apps/ai-service/app/routers/x.py', 'from app.services.pkg import Y\n', set).missing.length, 0, '__init__.py 视为包在位')
  assert.equal(gate.scanFile('apps/ai-service/app/routers/x.py', '# from app.services.ghost import Y\n', set).missing.length, 0, '注释里的 import 不判')
  assert.equal(
    gate.scanFile('apps/ai-service/app/routers/x.py', 'import httpx\nfrom fastapi import APIRouter\n', set)
      .missing.length,
    0,
    '第三方/标准库既不判红也不落未判定(名单必然腐烂)',
  )
  // cand 的键形与清单面同形(带 PY_ROOT 前缀)—— 这条不是细节而是判据的一部分:
  // 取错键形会让"在位"被读成"缺失",反过来也会让"缺失"被读成"在位"。
  assert.equal(gate.modulePresent(set, 'apps/ai-service/app/services/ok'), true)
  assert.equal(gate.modulePresent(set, 'apps/ai-service/app/services/pkg'), true)
  assert.equal(gate.modulePresent(set, 'apps/ai-service/app/services/nope'), false)
  assert.equal(gate.PY_ROOT, 'apps/ai-service', '清单面键必须带 PY_ROOT 前缀(与 facePySet 同形)')
})

test('T4 端到端双向锁:注入未入库模块必红并点名,补齐文件后必转绿', () => {
  const s = mkScratch('pyland-e2e')
  try {
    const repo = join(s, 'repo')
    execFileSync(GIT, ['-C', s, 'init', '-q', 'repo'], { timeout: GIT_TIMEOUT_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const gatePath = join(repo, 'scripts', 'check-python-import-landed.mjs')
    copyScriptClosure(GATE, gatePath)
    const run = () =>
      spawnSync(process.execPath, [gatePath, '--worktree'], {
        encoding: 'utf8',
        timeout: 180000,
        cwd: repo,
        windowsHide: true,
        maxBuffer: 1 << 26,
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
    assert.equal(bad.status, 1, `注入未入库模块必须 rc=1,实得 ${String(bad.status)}:\n${badOut.slice(0, 500)}`)
    assert.match(badOut, /ghost/, '必须点名那个模块')

    mkdirSync(join(appDir, 'services'), { recursive: true })
    writeFileSync(join(appDir, 'services', '__init__.py'), '', 'utf8')
    writeFileSync(join(appDir, 'services', 'ghost.py'), 'Y = 1\n', 'utf8')
    const good = run()
    const goodOut = String(good.stdout ?? '') + String(good.stderr ?? '')
    assert.equal(good.status, 0, `补齐后必须转绿(否则红的成因不是"没入库"):\n${goodOut.slice(0, 500)}`)
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
  })
  const out = String(r.stdout ?? '') + String(r.stderr ?? '')
  assert.doesNotMatch(out, /SyntaxError|Cannot find module|ERR_MODULE_NOT_FOUND/, '崩溃不是判据结论:\n' + out.slice(0, 300))
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
  })
  assert.doesNotMatch(String(r.stderr ?? ''), /SyntaxError|Cannot find module/)
  assert.equal(r.status, 0, `默认档只报存量 ⇒ rc 应 0(实得 ${String(r.status)})`)
  const j = JSON.parse(String(r.stdout ?? '{}'))
  assert.ok(Number(j.scanned ?? 0) > 500, `HEAD 面扫到的 .py 必须成百,实得 ${String(j.scanned)} —— 0 命中先怀疑尺子`)
  assert.equal(j.face, 'head', '缺省档必须判 HEAD blob,不是索引也不是磁盘')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
