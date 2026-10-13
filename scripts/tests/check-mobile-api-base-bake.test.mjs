// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 守门「移动端 release 打包的 API 基址是否真被内联」(check-mobile-api-base-bake.mjs)的镜像测试。
 *
 * 本门拦的是"基址没被内联进产物":变量只挂在 `expo prebuild` 那一步的 env 上时,真正求值
 * 并内联 `process.env.EXPO_PUBLIC_*` 的打包步(gradle 的 createBundleReleaseJsAndAssets /
 * xcodebuild 的 Bundle React Native)看不到它 ⇒ 产物内联 config.ts 的回退值
 * `http://localhost:8802` ⇒ 线上 App 每一个请求都失败(2026-10-13 装机实测:登录页恒
 * 「网络连接异常」,真机走查四项全部无法开验)。
 *
 * 危险形态全部安静:① 门没注册(判据对、无人调度);② 判据在 runner 里抄了第二份
 * (onFailHint 提到打包器名字不等于判据在那儿);③ "取不到面"被折成通过;
 * ④ 只判磁盘不判索引(提交带走了旧工作流而门读的是修好的盘上面)。每臂都配反向对照。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO = resolve(SCRIPTS_DIR, '..')
const GATE_REL = 'check-mobile-api-base-bake.mjs'
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const GIT = process.env.GIT_BIN || 'git'
const EXP = 'https://api.aizhs.top'

const gitIn = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

function runGate(dir, args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const readText = (p) =>
  execFileSync(
    process.execPath,
    ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(p)},'utf8'))`],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )

// 合法形态:job 级 env(打包步与 prebuild 步同读一份)
const WF_GOOD = `name: Build Android APK
jobs:
  apk:
    runs-on: ubuntu-latest
    env:
      EXPO_PUBLIC_API_BASE_URL: ${EXP}
    steps:
      - name: Generate Android project (expo prebuild)
        run: npx expo prebuild --platform android --no-install
      - name: Build release APK
        run: ./gradlew assembleRelease --no-daemon
`
// 回潮形态:2026-10-13 事故原状 —— 变量只挂在 prebuild 步
const WF_BAD = `name: Build Android APK
jobs:
  apk:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Android project (expo prebuild)
        env:
          EXPO_PUBLIC_API_BASE_URL: ${EXP}
        run: npx expo prebuild --platform android --no-install
      - name: Build release APK
        run: ./gradlew assembleRelease --no-daemon
`
const EAS = JSON.stringify(
  {
    build: {
      production: { env: { EXPO_PUBLIC_API_BASE_URL: EXP, EXPO_PUBLIC_WEB_URL: 'https://aizhs.top' } },
    },
  },
  null,
  2,
)
const CONFIG_TS = `const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8802'\n`

function makeRepo(dir, { wf = WF_GOOD, trackWf = true } = {}) {
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/face-reader.mjs'])
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
  writeFileSync(join(dir, '.github', 'workflows', 'mobile-apk-build.yml'), wf, 'utf8')
  mkdirSync(join(dir, 'apps', 'mobile-rn', 'src', 'lib'), { recursive: true })
  writeFileSync(join(dir, 'apps', 'mobile-rn', 'eas.json'), EAS, 'utf8')
  writeFileSync(join(dir, 'apps', 'mobile-rn', 'src', 'lib', 'config.ts'), CONFIG_TS, 'utf8')
  gitIn(dir, ['init', '-q', '.'])
  gitIn(dir, ['config', 'user.email', 't@example.invalid'])
  gitIn(dir, ['config', 'user.name', 'mirror test'])
  gitIn(dir, ['add', '-A', '--'])
  if (trackWf) gitIn(dir, ['commit', '-q', '-m', 'base'])
}

/* ---------------------------- 装车证明与唯一实现 ---------------------------- */

test('M1 装车证明:runner 里必须有本门注册块,且 blocking + skipEnv + stagedTriggers 逐字在位', () => {
  const src = readText(RUNNER)
  const at = src.indexOf(`script: '${GATE_REL}'`)
  assert.ok(at > 0, `runner 里没有 ${GATE_REL} 的注册块 ⇒ 门存在而无人调度,提交链上永远不跑`)
  const block = src.slice(Math.max(0, at - 1200), at + 900)
  assert.match(block, /id:\s*'202'/, '注册 id 必须是 202(现读最大值 201 的下一号)')
  assert.match(block, /mode:\s*'blocking'/, '定级必须 blocking(基址打错 = 线上全量断网,没有"只报数"的价值)')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_MOBILE_API_BASE_BAKE'/, '缺应急跳过变量 = 文档写了跑不通的出路')
  assert.match(block, /stagedTriggers:/, '缺 stagedTriggers = 改工作流时门根本不醒')
  assert.match(block, /\.github\/workflows\//, 'stagedTriggers 必须覆盖 .github/workflows/(本门审的就是工作流)')
})

test('M2 反向锁:script 行被改名后,M1 那种"已装车"结论不得成立', () => {
  const src = readText(RUNNER)
  const at = src.indexOf(`script: '${GATE_REL}'`)
  assert.ok(at > 0, '本臂的前置:runner 里得有本门(与 M1 同一条事实)')
  const renamed =
    src.slice(0, at) +
    src.slice(at).replace(`script: '${GATE_REL}'`, `script: '${GATE_REL.replace('check-', 'check-ZZ-')}'`)
  assert.ok(renamed.indexOf(`script: '${GATE_REL}'`) < 0, '替换没命中 ⇒ 这条反向锁没牙')
})

test('M3 判据只有一份:judgeWorkflow 在门脚本里唯一,runner 注册块不得自带判据', () => {
  const gate = readText(join(SCRIPTS_DIR, GATE_REL))
  const defs = gate.match(/function judgeWorkflow/g) || []
  assert.equal(defs.length, 1, `判据函数必须只有一份实现(实测 ${defs.length} 份)⇒ 两处算同一件事必漂移`)
  // runner 的提示文案提到打包器名字是正当的,但不得自带"是否可见"的判定逻辑
  const runner = readText(RUNNER)
  const at = runner.indexOf(`script: '${GATE_REL}'`)
  const block = runner.slice(Math.max(0, at - 1200), at + 1500)
  assert.ok(!/envBlockAt|scanWorkflow\(/.test(block), 'runner 注册块里不得出现判据函数(判据只许住在判据脚本里)')
})

test('M4 门内自检必须全绿(12 例,含全部反向枝)', () => {
  const r = runGate(REPO, ['--self-test'])
  assert.equal(r.code, 0, `self-test 必须全绿:\n${r.out.slice(0, 1500)}`)
  assert.match(r.out, /self-test: pass 12 \/ fail 0/, '例数漂移 ⇒ 自检被改过,逐例核')
})

/* ---------------------------- 真仓阳性对照 ---------------------------- */

test('M5 真仓阳性对照:工作树面必须绿(修复在盘上),且报数行点名 config.ts 的回退缺口', () => {
  const r = runGate(REPO, ['--worktree', '--strict'])
  assert.equal(r.code, 0, `真仓工作树面不得判红(修复在盘上):\n${r.out.slice(0, 1200)}`)
  assert.match(r.out, /mobile-apk-build\.yml/, '结论应覆盖安卓打包工作流')
  assert.match(r.out, /纵深防御缺口/, 'config.ts 的回退缺口必须报数(开发构建正当 ⇒ 只报数不判红)')
})

/* ---------------------------- 端到端双向锁 ---------------------------- */

test('M6 端到端:job 级 env 绿 / 只挂 prebuild 步红且点名那个 step', () => {
  const dir = mkScratch('mab-e2e-')
  try {
    makeRepo(dir, { wf: WF_GOOD })
    const green = runGate(dir, ['--worktree'])
    assert.equal(green.code, 0, `job 级 env 必须绿:\n${green.out}`)
    writeFileSync(join(dir, '.github', 'workflows', 'mobile-apk-build.yml'), WF_BAD, 'utf8')
    const red = runGate(dir, ['--worktree'])
    assert.equal(red.code, 1, `只挂 prebuild 步必须判红:\n${red.out}`)
    assert.ok(/expo prebuild/.test(red.out), '红必须点名那个挂错的 step(prebuild)')
    assert.ok(/assembleRelease|打包步/.test(red.out), '红必须点名打包步')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M7 面旗锁:索引注毒必红、工作树写回必绿 —— 证明判的是"这次提交带走的那一份"', () => {
  const dir = mkScratch('mab-face-')
  try {
    makeRepo(dir, { wf: WF_GOOD })
    writeFileSync(join(dir, '.github', 'workflows', 'mobile-apk-build.yml'), WF_BAD, 'utf8')
    gitIn(dir, ['add', '--', '.github/workflows/mobile-apk-build.yml'])
    const red = runGate(dir, ['--staged'])
    assert.equal(red.code, 1, `索引面注入回潮必须判红:\n${red.out}`)
    writeFileSync(join(dir, '.github', 'workflows', 'mobile-apk-build.yml'), WF_GOOD, 'utf8')
    const green = runGate(dir, ['--worktree'])
    assert.equal(green.code, 0, `工作树面(已写回合法)必须绿:\n${green.out}`)
    const stillRed = runGate(dir, ['--staged'])
    assert.equal(stillRed.code, 1, '索引没动 ⇒ --staged 必须仍然红(证明它真的在判索引)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M8 面旗矛盾判死:--staged 与 --worktree 同给 ⇒ exit 2,不得挑一面假装通过', () => {
  const dir = mkScratch('mab-conflict-')
  try {
    makeRepo(dir)
    const r = runGate(dir, ['--staged', '--worktree'])
    assert.equal(r.code, 2, `两面旗同给必须判死:\n${r.out}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M9 取材失败判"未判定":eas.json 被删 ⇒ 该面取不到就 exit 2,绝不冒绿也绝不冒红', () => {
  const dir = mkScratch('mab-miss-')
  try {
    makeRepo(dir)
    const p = join(dir, 'apps', 'mobile-rn', 'eas.json')
    execFileSync(process.execPath, ['-e', `require('fs').rmSync(${JSON.stringify(p)},{force:true})`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runGate(dir, ['--worktree'])
    assert.equal(r.code, 2, `取不到 eas.json 必须判"无法判定"(exit 2):\n${r.out}`)
    assert.ok(/无法判定/.test(r.out), '结论行必须写明是无法判定,不得静默')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
