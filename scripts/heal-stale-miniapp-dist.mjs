// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * heal-stale-miniapp-dist.mjs — 小程序 weapp 产物陈旧 ⇒ 自动重建(2026-10-28 立)。
 *
 * 立因(现读):`apps/miniapp-taro/dist` 停在 2026-10-26 11:25,而端内源码 2026-10-28 仍在改
 * (app.css 19:50)⇒ `check-miniapp-css-landing.mjs` 的 C0 结构性判据只能落"未判定"(exit 2),
 * 于是 C1 覆盖率尺**恒瞎**:既不算过、也不算红,「小程序样式是否真落地」这一格没有任何判据在真跑
 * (§0.3 最贵的那一型:把"没判"读成"没问题")。全仓此前只有清理器物(clean-miniapp-taro-dist)
 * 与检查器物,没有一条腿负责把产物重新造出来 —— 与 §0.9「造好没装车 = 没有」同型。
 *
 * 为什么可以无人值守:dist 被 `apps/miniapp-taro/.gitignore` 忽略且**零跟踪**
 * (`git check-ignore` 命中、`git ls-files apps/miniapp-taro/dist` = 0 件,实测)⇒ 重建只写机器态,
 * 不动仓、不落 HEAD、不推,零协作面副作用;与 heal-stale-dist.mjs(workspace 包 dist)同性质。
 *
 * 判据单源(§0.6):新鲜度谓词与判词**全部来自那把尺子本身** —— 先跑
 * `check-miniapp-css-landing.mjs --min-coverage 0`(观测档,不让 pct 干扰),只读它 stdout 里的
 * `C0 产物新鲜度:` 一行。判词解析不出 ⇒ `undetermined`,绝不回落"自己量 mtime"那第二份判据
 * (两处各算一次必漂移,而漂移方向会让尺子与重建腿互相打架)。
 *
 * 动作只有一条:`pnpm --filter @ihui/miniapp-taro build:weapp`(该 npm script 末尾自带一次
 * `--min-coverage 0.5` 复量;spawn 形态复用 lib/npm-execpath 的唯一判据,见 heal-stale-dist 头注:
 * Windows 上 `execFileSync('pnpm.cmd')` 会 EINVAL)。
 *
 * 三态:`fresh` 零写零建;`stale`/`undetermined` 且 `--apply` ⇒ 构建后复跑尺子给 `healed` 或 `still`;
 * 不带 `--apply` ⇒ `would-heal`(只报数)。结论行 = 末行 JSON(与 heal-stale-dist 同契约)。
 *
 * 用法:
 *   node scripts/heal-stale-miniapp-dist.mjs              # 预演(只判,不构建)
 *   node scripts/heal-stale-miniapp-dist.mjs --apply      # 真构建并复量
 *   node scripts/heal-stale-miniapp-dist.mjs --json       # 末行 JSON(守护腿消费)
 *   node scripts/heal-stale-miniapp-dist.mjs --self-test  # 判词分类自检(不读仓库)
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { pnpmSpawnPlan } from './heal-stale-dist.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GATE = join(ROOT, 'scripts', 'check-miniapp-css-landing.mjs')
const DIST = join(ROOT, 'apps', 'miniapp-taro', 'dist')
const PKG = '@ihui/miniapp-taro'
const BUILD_SCRIPT = 'build:weapp'
const GATE_TIMEOUT_MS = Number(process.env.IHUI_MINIAPP_DIST_GATE_TIMEOUT_MS || 8 * 60 * 1000)
const BUILD_TIMEOUT_MS = Number(process.env.IHUI_MINIAPP_DIST_BUILD_TIMEOUT_MS || 25 * 60 * 1000)

/**
 * 尺子 stdout 里的 C0 判词 → 三态。**判不出就返回 null**,由上层落 `undetermined`。
 * 词表与 `check-miniapp-css-landing.mjs` 第 2162-2170 行同源(该门的 P80/P82 自检锁住了这些字样),
 * 本函数只做归类,不重算新鲜度。
 */
export function c0Verdict(stdout) {
  const m = String(stdout ?? '').match(/C0 产物新鲜度[:：]([^\n]*)/)
  if (!m) return null
  const line = m[1]
  if (line.includes('旧产物') || line.includes('比产物新')) return 'stale'
  if (line.includes('未判定') || line.includes('判不出')) return 'undetermined'
  if (line.includes('新鲜')) return 'fresh'
  return null
}

function runGate() {
  try {
    const out = execFileSync(process.execPath, [GATE, '--min-coverage', '0'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
      timeout: GATE_TIMEOUT_MS,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'], // 守门 193:git/子进程派生一律显式接管 stdio
    })
    return { code: 0, stdout: String(out ?? ''), stderr: '' }
  } catch (e) {
    // exit 1 = 判红、exit 2 = 未判定;两种都不是"尺子坏了",结论整份在 stdout。
    return {
      code: typeof e?.status === 'number' ? e.status : null,
      stdout: String(e?.stdout ?? ''),
      stderr: String(e?.stderr ?? e?.message ?? '').slice(0, 240),
    }
  }
}

function buildOnce() {
  const sp = pnpmSpawnPlan(PKG, BUILD_SCRIPT)
  const t0 = Date.now()
  try {
    const out = execFileSync(sp.cmd, sp.args, {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      shell: sp.shell,
      timeout: BUILD_TIMEOUT_MS,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, ms: Date.now() - t0, tail: String(out ?? '').slice(-200) }
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - t0,
      tail: String(e?.stdout ?? '').slice(-200),
      why: String(e?.stderr ?? e?.message ?? e).slice(0, 240),
    }
  }
}

/** 判词分类的纯函数自检(不读仓库):正向 / 反向成对,判不出必须返回 null 而不是猜一个。 */
export function selfTest() {
  const cases = [
    ['旧产物', 'C0 产物新鲜度:**旧产物** —— dist 最新写入 X,而盘上源码在 Y 仍有改动', 'stale'],
    ['比产物新', 'C0 产物新鲜度:盘上源码比产物新 1500 ms ⇒ 本次对账的改动不可能在这份产物里', 'stale'],
    ['未判定', 'C0 产物新鲜度:**未判定** —— dist 或 src 任一侧量不到', 'undetermined'],
    ['判不出', 'C0 产物新鲜度:判不出 —— 目录不存在', 'undetermined'],
    ['新鲜', 'C0 产物新鲜度:新鲜(相差 7 ms)', 'fresh'],
    ['无判词', '(尺子没打这一行)', null],
    ['空输入', '', null],
  ]
  const fails = []
  for (const [name, text, want] of cases) {
    const got = c0Verdict(text)
    if (got !== want) fails.push(`${name}: want=${String(want)} got=${String(got)}`)
  }
  return { total: cases.length, fails }
}

function emit(res, jsonMode) {
  if (jsonMode) console.log(JSON.stringify(res))
  const human = `[heal-stale-miniapp-dist] state=${res.state}${res.c0 ? ` c0=${res.c0}` : ''}${
    res.after ? ` after=${res.after}` : ''
  }${res.buildMs != null ? ` build=${Math.round(res.buildMs / 1000)}s` : ''}${
    res.why ? ` —— ${res.why}` : ''
  }`
  console.log(human)
  return res
}

function main(argv) {
  if (argv.includes('--self-test')) {
    const r = selfTest()
    if (r.fails.length) {
      console.error(`❌ c0Verdict 自检失败 ${r.fails.length}/${r.total}:\n${r.fails.join('\n')}`)
      return 1
    }
    console.log(`✅ c0Verdict 自检 ${r.total}/${r.total} 通过`)
    return 0
  }
  const jsonMode = argv.includes('--json')
  const apply = argv.includes('--apply')
  if (!existsSync(GATE)) {
    emit(
      { state: 'undetermined', why: '尺子不在位(scripts/check-miniapp-css-landing.mjs)' },
      jsonMode,
    )
    return 2
  }
  const g1 = runGate()
  const c0 = c0Verdict(g1.stdout)
  if (c0 === 'fresh') {
    emit({ state: 'fresh', c0, gateCode: g1.code }, jsonMode)
    return 0
  }
  if (c0 === null) {
    emit(
      {
        state: 'undetermined',
        why: `C0 判词解析不出(gateCode=${g1.code ?? '?'};sample=${g1.stdout
          .split('\n')
          .filter((l) => l.includes('C0'))
          .join('|')
          .slice(0, 160) || '(没有含 C0 的行)'})`,
      },
      jsonMode,
    )
    return 2
  }
  if (!apply) {
    emit(
      { state: 'would-heal', c0, why: '产物陈旧或量不到;带 --apply 才会重建' },
      jsonMode,
    )
    return 0
  }
  const build = buildOnce()
  if (!build.ok) {
    emit(
      { state: 'still', c0, buildMs: build.ms, why: `构建失败:${build.why}` },
      jsonMode,
    )
    return 2
  }
  const g2 = runGate()
  const after = c0Verdict(g2.stdout)
  const state = after === 'fresh' ? 'healed' : 'still'
  if (jsonMode) console.log(JSON.stringify({ state, c0, after, buildMs: build.ms, gateCode: g2.code }))
  console.log(
    `[heal-stale-miniapp-dist] state=${state} c0=${c0} after=${String(after)} build=${Math.round(
      build.ms / 1000,
    )}s${state === 'still' ? ' —— 构建后仍不新鲜,下轮会再试(产物未变说明源码面还在动或构建被掐)' : ''}`,
  )
  return state === 'healed' ? 0 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
