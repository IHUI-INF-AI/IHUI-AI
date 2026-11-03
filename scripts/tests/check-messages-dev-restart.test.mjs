// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, dirname } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'
// §22c:判据(端口号 / "dev server 是否在跑"的裁定)一律从门体经 __test__ 取,
// 禁止在本文件再抄一份 —— 两份真相必漂移。能这样 import 的前提是门体补上了 §22d
// 入口守卫(G-1058651):改前顶层是裸 `main()`,import 期就会真的跑 existsSync +
// `git diff --cached` + netstat 并打印(实测 1 行输出),所以测试当时只能整族黑盒 spawn。
import { __test__ as gate } from '../check-messages-dev-restart.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-messages-dev-restart.mjs')
const WEB_PORT = gate.WEB_PORT

// ─── dev server 分支前置条件(裁定取自门体,不再本文件自算端口占用) ───
// 门体用 netstat/lsof 现取 8801 是否 LISTENING;本机真有 dev server 在跑时,依赖
// "未在跑"分支的用例必须跳过 —— 这条裁定只有门体那一份,测试不再写第二份。
// ⚠ 必须在**模块加载期同步**求值:`node:test` 在 `test()` 登记时就把 `{ skip }` 读走了,
//   把它放进 `before(async …)` 里赋值永远赶不上。改前那版自抄的 `checkPortFree` +
//   `before()` 就是这么把 9/10/11 三例**无条件**跳掉的(现跑取证:本机 8801 空闲
//   —— 连绑 5 次全 FREE、netstat 无一行 —— 读数仍稳定 skipped 3)。
const webDevServerRunning = gate.isWebDevServerRunning()

function bindPort(port) {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(null))
    srv.once('listening', () => resolve(srv))
    srv.listen(port)
  })
}

function closeServer(srv) {
  return new Promise((resolve) => srv.close(() => resolve()))
}


// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkScratch('ihui-msg-restart-')
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY(§12g);windowsHide 同批补齐(§5b/§20)
  const opt = { cwd: dir, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['init', '-b', 'main'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['config', 'user.name', 'Test'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['add', 'README.md'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['commit', '-q', '-m', 'init'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  return dir
}

// ─── 辅助:创建文件并 stage(不 commit) ────────────────────
function stageFiles(dir, files) {
  for (const f of files) {
    const fullPath = join(dir, f)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, `content for ${f}\n`)
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync(`git add "${f}"`, { cwd: dir, stdio: 'ignore', windowsHide: true })
  }
}

// ─── 辅助:创建 apps/web/messages 目录(使 existsSync 通过) ─
function ensureMessagesDir(dir) {
  mkdirSync(join(dir, 'apps/web/messages'), { recursive: true })
}

// ─── 辅助:运行 check-messages-dev-restart.mjs ─────────────
// 脚本用 console.log → 输出走 stdout;stderr 应为空
function runScript(opts = {}) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// ═══════════════════════════════════════════════════════════
// messages 目录不存在分支(existsSync 检查)
// ═══════════════════════════════════════════════════════════

// ─── 1. 非 git: 非 git 仓库 + messages 目录不存在 → exit 0(目录不存在,跳过) ──
test('非 git: 非 git 仓库 + messages 目录不存在 → exit 0(目录不存在,跳过)', () => {
  const dir = mkScratch('ihui-nongit-')
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /目录不存在/)
    assert.match(r.stdout, /跳过/)
    assert.ok(!r.stdout.includes('检测到'), '目录不存在时不应检测 staged')
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. 非 git: 非 git 仓库 + messages 目录存在 → exit 0(无 messages 改动,跳过) ──
// getStagedMessagesFiles 在非 git 目录执行 git diff 抛错 → catch 返回 []
test('非 git: 非 git 仓库 + messages 目录存在 → exit 0(无 messages 改动,跳过)', () => {
  const dir = mkScratch('ihui-nongit-')
  try {
    ensureMessagesDir(dir)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 3. git: git 仓库无 messages 目录 → exit 0(目录不存在,跳过) ──────────────
test('git: git 仓库无 messages 目录 → exit 0(目录不存在,跳过)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /目录不存在/)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 无 messages JSON 改动分支(staged.length === 0)
// ═══════════════════════════════════════════════════════════

// ─── 4. git: git 仓库有 messages 目录,无 staged 文件 → exit 0(无改动,跳过) ──
test('git: git 仓库有 messages 目录,无 staged 文件 → exit 0(无改动,跳过)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.match(r.stdout, /跳过/)
    assert.ok(!r.stdout.includes('检测到'), '无 staged 不应触发检测')
  } finally {
    rmScratch(dir)
  }
})

// ─── 5. git: staged 非 messages 文件 → exit 0(无 messages 改动,跳过) ──────────
test('git: staged 非 messages 文件(apps/web/src/foo.ts)→ exit 0(无 messages 改动,跳过)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/src/foo.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.ok(!r.stdout.includes('检测到'), '非 messages 文件不应触发检测')
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 边界:路径过滤规则(startsWith('apps/web/messages/') + endsWith('.json'))
// ═══════════════════════════════════════════════════════════

// ─── 6. 边界: staged .json 但不在 messages 目录 → exit 0(无 messages 改动) ────
test('边界: staged apps/web/other.json(不在 messages 目录)→ exit 0(无 messages 改动)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/other.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.ok(!r.stdout.includes('检测到'), '非 messages 目录的 .json 不应触发')
  } finally {
    rmScratch(dir)
  }
})

// ─── 7. 边界: staged 在 messages 目录但非 .json → exit 0(无 messages 改动) ─────
test('边界: staged apps/web/messages/zh-CN.ts(非 .json)→ exit 0(无 messages 改动)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/zh-CN.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.ok(!r.stdout.includes('检测到'), '非 .json 文件不应触发')
  } finally {
    rmScratch(dir)
  }
})

// ─── 8. 边界: staged apps/web/messages-other/foo.json(前缀不匹配)→ exit 0 ──
// startsWith('apps/web/messages/') 不匹配 'apps/web/messages-other/'(无尾斜杠)
test('边界: staged apps/web/messages-other/foo.json(前缀不匹配)→ exit 0(无 messages 改动)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages-other/foo.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.ok(!r.stdout.includes('检测到'), 'messages-other 不应匹配 messages/')
  } finally {
    rmScratch(dir)
  }
})

// ─── 9. 边界: staged apps/web/messages/sub/foo.json(子目录,startsWith 匹配)→ 触发检测 ──
// startsWith('apps/web/messages/') 匹配子目录路径(脚本实际行为)
test('边界: staged apps/web/messages/sub/foo.json(子目录,startsWith 匹配)→ 触发检测', {
  skip: webDevServerRunning ? 'port 8801 上确有 dev server 在跑(门体自判),"未在跑"分支不可达,跳过' : false,
}, () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/sub/foo.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /检测到 1 个 messages JSON 改动/)
    assert.match(r.stdout, /apps\/web\/messages\/sub\/foo\.json/)
    // 子目录文件也被检测到(startsWith 行为)
    assert.match(r.stdout, /dev server 未在跑|需要重启加载新翻译/)
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// 有 messages JSON 改动 + dev server 未在跑(pass 路径)
// ═══════════════════════════════════════════════════════════

// ─── 10. git: staged 1 个 messages JSON(dev server 未跑)→ exit 0 + 检测到 1 个 + 无需重启 ──
test('git: staged 1 个 messages JSON(dev server 未跑)→ exit 0 + 检测到 1 个 + 无需重启', {
  skip: webDevServerRunning ? 'port 8801 上确有 dev server 在跑(门体自判),"未在跑"分支不可达,跳过' : false,
}, () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/zh-CN.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /检测到 1 个 messages JSON 改动/)
    assert.match(r.stdout, /apps\/web\/messages\/zh-CN\.json/)
    assert.match(r.stdout, /dev server 未在跑/)
    assert.match(r.stdout, /无需重启/)
    assert.ok(!r.stdout.includes('需要重启加载新翻译'), 'dev server 未跑不应输出重启警告')
  } finally {
    rmScratch(dir)
  }
})

// ─── 11. git: staged 3 个 messages JSON(dev server 未跑)→ exit 0 + 检测到 3 个 + 列出文件 ──
test('git: staged 3 个 messages JSON(dev server 未跑)→ exit 0 + 检测到 3 个 + 列出文件', {
  skip: webDevServerRunning ? 'port 8801 上确有 dev server 在跑(门体自判),"未在跑"分支不可达,跳过' : false,
}, () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, [
      'apps/web/messages/zh-CN.json',
      'apps/web/messages/en.json',
      'apps/web/messages/ja.json',
    ])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /检测到 3 个 messages JSON 改动/)
    assert.match(r.stdout, /apps\/web\/messages\/zh-CN\.json/)
    assert.match(r.stdout, /apps\/web\/messages\/en\.json/)
    assert.match(r.stdout, /apps\/web\/messages\/ja\.json/)
    assert.match(r.stdout, /dev server 未在跑/)
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════
// dev server 在跑分支(warn-only,不阻塞 commit)
// ═══════════════════════════════════════════════════════════

// ─── 12. dev server 在跑: 绑定 8801 + staged messages JSON → exit 0 + 重启警告 ──
test('dev server 在跑: 绑定 8801 + staged messages JSON → exit 0 + 重启警告', async () => {
  const srv = await bindPort(WEB_PORT)
  if (!srv) {
    // port 8801 已被占用且无法绑定,跳过(不依赖外部占用者的状态)
    return
  }
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/zh-CN.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, 'warn-only 始终 exit 0')
    assert.match(r.stdout, /检测到 1 个 messages JSON 改动/)
    assert.match(r.stdout, /需要重启加载新翻译/)
    assert.ok(!r.stdout.includes('dev server 未在跑'), 'dev server 在跑时不应输出"未在跑"')
  } finally {
    rmScratch(dir)
    await closeServer(srv)
  }
})

// ─── 13. dev server 警告内容: 绑定 8801 + staged messages JSON → 验证警告关键词 ──
test('dev server 警告内容: 绑定 8801 + staged messages JSON → 验证警告关键词', async () => {
  const srv = await bindPort(WEB_PORT)
  if (!srv) {
    return
  }
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/en.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = r.stdout
    // 验证警告关键内容
    assert.match(out, /warn-only/, '应标明 warn-only')
    assert.match(out, /pnpm --filter @ihui\/web dev/, '应给出重启命令')
    assert.match(out, /历史教训/, '应提及历史教训')
    assert.match(out, /Ctrl\+C/, '应提示 Ctrl+C 杀进程')
    assert.match(out, /HMR 不会重新编译/, '应解释根因')
    assert.match(out, /不阻塞 commit/, '应声明不阻塞 commit')
  } finally {
    rmScratch(dir)
    await closeServer(srv)
  }
})

// ═══════════════════════════════════════════════════════════
// §22d 双形态入口守卫(G-1058651)
// ═══════════════════════════════════════════════════════════

// ─── 14. 裸 import 门体必须零输出 + rc 0(守卫装上后本文件顶部 import 才成立) ──
// 钉的是"门体可导入",不是"门体会打印":上面 1-13 例全是黑盒 CLI 面(退出码 + 输出),
// 那是这道 warn-only 门的正当形态;本文件唯一缺的那格是 import 面 —— 改前门体顶层裸
// `main()`,import 期就会真的跑 existsSync + git diff --cached + netstat 并打印,
// 于是判据只能在本文件里再抄一份(现已被 gate.WEB_PORT / gate.isWebDevServerRunning 取代)。
test('§22d: 裸 import 门体零副作用(rc 0 + 零输出 + 零 stderr),CLI 直跑仍真的执行 main()', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/zh-CN.json'])
    // 夹具本身要让"若守卫缺失则必然打印"成立:该目录下门体直跑一定能打出内容(见下)
    const imp = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(SCRIPT_PATH).href)})`],
      {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    assert.equal(imp.status, 0, `import 门体不得带走宿主进程,实得 exit ${imp.status}\n${imp.stderr}`)
    assert.equal(imp.stdout, '', `import 门体必须零输出,实得 ${imp.stdout.split('\n').length} 行:\n${imp.stdout}`)
    assert.equal(imp.stderr, '', `import 门体不得写 stderr,实得:\n${imp.stderr}`)

    // 同一门体 CLI 直跑必须真的执行 main()(守卫不能把 CLI 面一起掐掉 = 静默失控)
    const cli = runScript({ cwd: dir })
    assert.equal(cli.status, 0, `warn-only 直跑应 exit 0,实得 ${cli.status}\n${cli.stderr}`)
    assert.match(
      cli.stdout,
      /检测到 1 个 messages JSON 改动/,
      'CLI 直跑未执行 main() ⇒ 守卫把主流程也掐了(门在接线点上静默失效)',
    )
    assert.match(cli.stdout, /dev server 未在跑|需要重启加载新翻译/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
