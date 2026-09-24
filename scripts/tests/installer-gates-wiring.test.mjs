// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面安装器双门禁「已接入 pre-commit」回归自检。
// 跑法:node --test scripts/tests/installer-gates-wiring.test.mjs
//
// 为什么需要:check-installer-assets.mjs 与 desktop-nsis-template.mjs --check 两道判据
//   自写下后只被手动跑过(在 guardian-runner / .husky / .github 零命中),等于「记得跑才有
//   保护」。2026-09-22 把它们正式挂进 pre-commit。本用例锁住两件事:
//   ① 注册表里这两项确实存在且是 blocking + 有条件触发 + 有应急变量与修复提示(防被误删/降级);
//   ② 判据本身仍能拦住「引用了位图却没登记 File 打包行」这一静默失败(用注入位图副本实测,
//      不写任何被 git 跟踪的文件)。
// 注:断言只读注册表源码文本,不复制 runner 的匹配逻辑(§22c 禁镜像实现)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUNNER_SRC = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const NSI_REL = 'apps/desktop/src-tauri/windows/ihui-ui.nsi'

/** 抠出注册表里指定 id 的对象字面量文本(id 行 → 最近的 `\n  },`)。 */
function itemBlock(id) {
  const start = RUNNER_SRC.indexOf(`id: '${id}',`)
  assert.notEqual(start, -1, `注册表缺少 id ${id}`)
  const end = RUNNER_SRC.indexOf('\n  },', start)
  assert.notEqual(end, -1, `id ${id} 的对象字面量未正常闭合`)
  return RUNNER_SRC.slice(start, end)
}

/** 取 stagedTriggers 数组里的路径前缀字符串。 */
function stagedTriggersOf(block) {
  const m = block.match(/stagedTriggers:\s*\[([\s\S]*?)\]/)
  assert.ok(m, '该项必须声明 stagedTriggers(只在安装器相关文件进暂存区时才跑)')
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

test('id 61 已注册为 blocking,并带条件触发 / 应急变量 / 修复提示', () => {
  const block = itemBlock('61')
  assert.match(block, /script:\s*'check-installer-assets\.mjs'/)
  assert.match(block, /mode:\s*'blocking'/)
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_INSTALLER_ASSETS_GUARD'/)
  assert.match(block, /onFailHint:/)
  assert.match(block, /IHUI_EXTRACTPAGESETS_SET/, '修复提示必须指向补 File 行的位置')
  assert.match(block, /desktop-installer-assets\.mjs/, '修复提示必须指向 5 档资产重新导出')
  assert.deepEqual(stagedTriggersOf(block), [
    'apps/desktop/src-tauri/windows/',
    'scripts/desktop-installer-assets.mjs',
  ])
})

test('id 62 已注册为 blocking,触发含模板脚本与侧车补丁 JSON', () => {
  const block = itemBlock('62')
  assert.match(block, /script:\s*'desktop-nsis-template\.mjs'/)
  assert.match(block, /args:\s*\['--check'\]/, '必须以 --check 形态挂载')
  assert.match(block, /mode:\s*'blocking'/)
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_NSIS_TEMPLATE_GUARD'/)
  assert.match(block, /onFailHint:/)
  assert.match(block, /--emit-patches/, '修复提示①:直接手改要重跑登记')
  assert.deepEqual(stagedTriggersOf(block), [
    'apps/desktop/src-tauri/windows/installer.nsi',
    'scripts/desktop-nsis-template.mjs',
    'scripts/desktop-nsis-ihui-patches.json',
  ])
})

test('runner 执行循环确实消费 stagedTriggers(声明未生效=假绿)', () => {
  assert.match(RUNNER_SRC, /function stagedPathsTouch\(/)
  assert.match(RUNNER_SRC, /check\.stagedTriggers && passStaged && !stagedPathsTouch/)
})

test('注册表 id 全局唯一(防 61/62 与后续条目撞号)', () => {
  const ids = [...RUNNER_SRC.matchAll(/^\s{4}id: '([^']+)',$/gm)].map((m) => m[1])
  assert.ok(ids.length >= 90, `解析到 ${ids.length} 项,数量异常(解析口径可能已漂移)`)
  assert.equal(
    new Set(ids).size,
    ids.length,
    `存在重复 id:${ids.filter((x, i) => ids.indexOf(x) !== i)}`,
  )
})

test('注入违规实测:删掉 File 打包行 → 门禁必须 exit 1(临时副本,不碰仓库文件)', async () => {
  const src = readFileSync(join(ROOT, NSI_REL), 'utf8')
  const lines = src.split('\n')
  const packedRe = /File\s+"\/oname=\$PLUGINSDIR\\([\w.-]+\.bmp)"/
  // 只做取样(挑出所有打包行),判定完全交给被测脚本:逐个删一行,直到某次被判红。
  // 逐个试是因为 refs 只统计真正被加载的位图(splash.bmp 由 AdvSplash 以别的写法引用,
  // 删它的 File 行不构成"引用未打包"),只要存在一条删了不拦的位图 = 判据失效。
  const candidates = [...src.matchAll(new RegExp(packedRe.source, 'g'))].map((m) => m[1])
  assert.ok(candidates.length > 0, `${NSI_REL} 解析不到 File 打包行,取样失败`)
  // 夹具落点 = 仓库外 scratch(§26 临时物唯一落点)。此前用 `os.tmpdir()`,而活进程的 TEMP
  // 仍可能钉在 C 盘(§26 实测的"身份/进程不刷新"型漂移),于是 `C:\Users\…\Temp\ihui-installer-gate-*`
  // 会一直攒(2026-09-25 实扫 7 个、每个 1 份 .nsi 副本)。
  const dir = mkScratch('installer-gate-')
  try {
    let blocked = null
    for (const name of candidates) {
      const dropAt = lines.findIndex((l) => packedRe.test(l) && l.includes(name))
      if (dropAt < 0) continue
      const fixture = join(dir, 'ihui-ui.injected.nsi')
      writeFileSync(
        fixture,
        [...lines.slice(0, dropAt), ...lines.slice(dropAt + 1)].join('\n'),
        'utf8',
      )
      const { status: code, out, hitTimeout } = await runGate(
        join(ROOT, 'scripts', 'check-installer-assets.mjs'),
        [],
        { ...process.env, IHUI_NSI_PATH: fixture },
      )
      // 阳性对照只问一件事:"这一刀有没有被拦"。取不到退出码时,门禁自己打印的
      // 「引用了但未打包」就是它拦住的那句话;两者都没有 ⇒ 这一条判不了,换下一条试,
      // 而不是把"没等到"当成"没拦住"(那会把一个仍然有效的判据报成失效)。
      const 被拦 = /引用了但未打包/.test(out)
      if (hitTimeout && !被拦) continue
      if (被拦 || code !== 0) {
        blocked = { name, out }
        break
      }
    }
    assert.ok(
      blocked,
      `删掉 ${candidates.length} 条 File 打包行里的任意一条,门禁全部 exit 0 → 判据已失效`,
    )
    assert.match(blocked.out, /引用了但未打包/)
    assert.match(blocked.out, new RegExp(blocked.name.replace('.', '\\.')))
  } finally {
    rmScratch(dir)
  }
})

/**
 * 异步 spawn + 短超时 + 限次重试 —— 本文件两处门禁调用共用的**等待形态**(2026-09-25)。
 *
 * 为什么不用 `execFileSync` 捕获式同步等待:实测它会**间歇性永不返回**,而子进程早就把
 * 完整结论写进了 stdout(按 240s 硬超时掐掉那次,`e.stdout` 正是
 * `OK:仓库模板 == 当前 Tauri CLI 内置模板 + 36 处 IHUI 补丁`)。
 *
 * 量到的事实(同一台机、同一份数据、同一子进程):
 *  - 子进程 stdout/stderr 走**管道**时:连跑 6 次,4 次在 10s 内没等到 'exit'/'close',
 *    而这 4 次都已完整收到 94 字节结论行;
 *  - 同一门在 `bash` 里直跑(输出重定向到文件)8 次全部 0.10~0.12s 返回;
 *  - `node --test` 里连跑 5 轮,每轮都要 1~2 次重试才拿到结论(单次上限 20s)。
 * 至于是"子进程不再退出"还是"退出了但 'exit'/'close' 没投递给父进程",**未取证**,不下结论。
 * 但仓库对这一型早有口径:守门 80 立项原因就是"`execSync('git ls-files')` 挂住 80 分钟而
 * CPU 只用 2.84s" —— 结论都是**每次等待必须带上限**,而不是去削门禁判据。
 *
 * 所以这里严格只动"怎么等":
 * ① 单次上限 20s(正常 0.14s,已是 140 倍余量)⇒ 不再把整个 `pnpm test:scripts`
 *    拖成"没有结论"(CI 口径:解析不到 pass/fail 计数就按失败计);
 * ② 只重试**超时**(没拿到结论),绝不重试**判红** —— 判红是门的结论,重试它等于削判据;
 * ③ 三次都拿不到结论才红,且失败文案写明"红的是等待形态,不是门禁判据";
 * ④ 3 次是量出来的(单次停顿率 >50%),不是拍的。
 */
const GATE_TIMEOUT_MS = 20_000
const GATE_STALL_ATTEMPTS = 3

function runGateOnce(scriptPath, args, env) {
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let hitTimeout = false
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })
    const timer = setTimeout(() => {
      hitTimeout = true
      child.kill('SIGTERM')
    }, GATE_TIMEOUT_MS)
    child.on('error', (e) => {
      clearTimeout(timer)
      rej(e)
    })
    child.on('close', (status) => {
      clearTimeout(timer)
      // `out` 刻意是 stdout+stderr 合并:旧写法走 execFileSync 的抛错分支,取的是
      // `e.stdout + e.stderr`,而门 61 那句「引用了但未打包」结论打在 stderr 上 ——
      // 只回传 stdout 会让断言在判据仍然有效的门上红掉(本次改造踩过一次,记录在此)。
      res({ status, stdout, stderr, out: stdout + stderr, hitTimeout })
    })
  })
}

async function runGate(scriptPath, args = [], env = process.env) {
  let last = null
  for (let attempt = 1; attempt <= GATE_STALL_ATTEMPTS; attempt++) {
    last = await runGateOnce(scriptPath, args, env)
    if (!last.hitTimeout) return { ...last, attempts: attempt }
    if (attempt < GATE_STALL_ATTEMPTS) {
      console.log(
        `  [重试] ${scriptPath.split(/[\\/]/).pop()} 第 ${attempt} 次在 ${GATE_TIMEOUT_MS}ms 内没返回` +
          `(子进程可能早已打印结论)—— 只重等一次,不改判定`,
      )
    }
  }
  return { ...last, attempts: GATE_STALL_ATTEMPTS }
}

/**
 * 绿判定:能拿到退出码就按退出码(严格);拿不到才退回"门禁自己打印的终局结论行",
 * 并且**把降级这件事打印出来** —— 静默降级等于把门禁改成"看起来绿"。
 * 两条都判不了才红,红文案点名是等待形态问题。
 */
function assertGateGreen(res, name, verdictRe, failRe) {
  const { status, out, hitTimeout, attempts } = res
  if (!hitTimeout) {
    assert.equal(status, 0, `${name} 应绿\nstatus: ${status}\n输出: ${out}`)
    assert.match(out, verdictRe)
    return
  }
  console.log(
    `  [降级判定] ${name} 连等 ${attempts} 次(每次 ${GATE_TIMEOUT_MS}ms)没拿到退出码 —— ` +
      `子进程早已打印完整结论,改按其结论行判定,并在输出里如实留下这一行`,
  )
  assert.doesNotMatch(out, failRe, `${name} 虽未返回,但已打印失败结论 ⇒ 这是真红`)
  assert.match(
    out,
    verdictRe,
    `${name} 既没返回也没打印结论行 ⇒ 无法判定(按红算)。等待形态问题,不是判据问题`,
  )
}

test('当前仓库状态两项门禁均绿(接入不得引入既存红)', async () => {
  const a = await runGate(join(ROOT, 'scripts', 'check-installer-assets.mjs'))
  assertGateGreen(
    a,
    '门 61',
    /PASS —— 引用\/打包\/落盘三方一致/,
    /引用了但未打包|资产缺失|❌/,
  )

  // 无 @tauri-apps/cli 原生模块的环境里 --check 会打印「跳过校验」并 exit 0(既有宽松兜底),
  // 两种结局都算绿 —— 本用例只保证"不假红",不保证 CI 上真比对。
  const b = await runGate(join(ROOT, 'scripts', 'desktop-nsis-template.mjs'), ['--check'])
  assertGateGreen(
    b,
    '门 62',
    /OK:仓库模板|跳过校验/,
    /DRIFT|缺少 .*installer\.nsi|抽取模板失败|上游模板已变化/,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
