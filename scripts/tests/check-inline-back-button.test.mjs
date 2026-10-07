// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 46(check-inline-back-button.mjs)的 §22c 镜像测试。
 *
 * 立票(台账"机器可见的欠账清单 B"):旧版把扫描面写死 `apps/web/src`,而 web 页面全在
 * `apps/web/app/**` ⇒ 该门对它立项要防的那一型**当前拦零**(16 处 / 9 文件全在 app/ 下,
 * 而它一路打印 `✅ 通过(1259 个文件,0 处私接)`)。所以本文件最重要的两条是:
 *  T4 覆盖面锁 —— 两个目录都必须真被枚举(缺一个 = 该型静默回来);
 *  T6 端到端注入锁 —— 往私有索引塞一处新私接,`--staged` 必须红并点名该文件;
 *      并把"本次没有射程内文件 ⇒ 回退全量而不是判死"钉住(恒挡门等于逼人跳门,§12e)。
 * 判据一律 import 源文件导出的 `__test__`,测试里不得再抄一份(§22c)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as gate } from '../check-inline-back-button.mjs'
import { maskComments } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-inline-back-button.mjs')
const GIT = 'C:/Program Files/Git/cmd/git.exe'
const SRC_DIR = 'apps/web/src'

const run = (args, env = {}) =>
  spawnSync(process.execPath, [GATE, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    // 2026-10-05:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 300_000,
    maxBuffer: 1 << 26,
    windowsHide: true,
    env: { ...process.env, ...env },
  })

test('T1 装车证明:runner 里必须有这道门,且 blocking + 自己的 skipEnv(读 HEAD 面,不读磁盘)', () => {
  const runner = execFileSync(
    GIT,
    ['-c', 'safe.directory=*', 'show', 'HEAD:scripts/guardian-runner.mjs'],
    {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 1 << 26,
      // 2026-10-05:不吃的子进程必须给 stdio
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const i = runner.indexOf("script: 'check-inline-back-button.mjs'")
  assert.ok(i > 0, '门未在 runner 注册 = 判据存在而无人调度(守门 70/76/81 同型)')
  const entry = runner.slice(Math.max(0, i - 400), i + 900)
  assert.match(entry, /mode:\s*'blocking'/)
  assert.match(
    entry,
    /skipEnv:\s*'HUSKY_SKIP_INLINE_BACK_GUARD'/,
    '文档承诺的应急出路必须由条目声明,否则是假逃生舱',
  )
})

test('T2 摘线方向锁:测试不得在门未注册时给出"已装车"结论', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(
    !/^\s*(export )?function (scanContent|judge)\s*\(/m.test(src.replace(/\/\/[^\n]*/g, '')),
    '测试里出现第二份判据 = 漂移从防线变成掩体(§22c)',
  )
})

test('T3 判据本体:app/ 与 src/ 同形认,注释行与三处唯一实现不判', () => {
  assert.equal(gate.scanContent('apps/web/app/x/PageClient.tsx', 'router.back()\n').length, 1)
  assert.equal(gate.scanContent(`${SRC_DIR}/x.tsx`, 'history.back()\n').length, 1)
  assert.equal(gate.scanContent('apps/web/app/x.tsx', '// router.back()\n').length, 0)
  for (const a of gate.ALLOWLIST) assert.equal(gate.inScope(a), false, `${a} 应被白名单摘掉`)
})

test('T4 覆盖面锁(本票立因):SCAN_DIRS 必须同时含 app 与 src,且 HEAD 清单两个目录都有份', () => {
  assert.deepEqual(
    [...gate.SCAN_DIRS].sort(),
    ['apps/web/app', 'apps/web/src'].sort(),
    '漏掉 apps/web/app ⇒ 本票立项那一型(页面整面失明)原样回来',
  )
  const r = run(['--self-test'])
  assert.equal(r.status, 0, `自检必须绿(含覆盖面自证):${r.stdout}${r.stderr}`)
  assert.match(r.stdout, /apps\/web\/app=\d{2,}/, '覆盖面自证必须量到 app 目录的两位数以上文件')
})

test('T5 取材面形状锁:必须走 face-reader,禁止 cwd 定根 / 禁止 execSync 拼路径', () => {
  // 判据面**只遮注释、保留字符串**:要判的 `from './lib/face-reader.mjs'` 本身就住在字符串里,
  // 连字符串一起抹会让这条锁对着空面说话(守门 131/134 同一课)。而本门头注逐字写着旧版的
  // `process.cwd()` 与 `execSync(` —— 不遮注释就是"解释自己修了什么"的散文被判成违规。
  const src = maskComments(readFileSync(GATE, 'utf8'))
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '内容必须经层读取,否则工作树滞后会让结论来回跳(守门 118)')
  assert.ok(
    !/process\.cwd\(\)/.test(src),
    'ROOT 必须由脚本自身位置推导(靠 cwd 定位的调用结构上失效,守门 70 那一型)',
  )
  assert.ok(
    !/execSync\(/.test(src),
    '禁止 execSync 拼字符串取目录/内容(路径注入 + 无 timeout,守门 80 判的那一型)',
  )
})

test('T6 端到端双向锁:注入一处新私接必红;本次无射程内文件必须回退全量而不是判死', () => {
  const target = 'apps/web/app/(main)/asks/[id]/PageClient.tsx'
  const head = execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `HEAD:${target}`], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  // 私有索引:把该文件替换为"HEAD 内容 + 一行新私接",其余路径一律摘出索引
  const idx = join(REPO, '.ihui-agent/tmp', `idx-46-${process.pid}`)
  const env = { GIT_INDEX_FILE: idx }
  const g = (args) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
  try {
    g(['read-tree', 'HEAD'])
    const blob = g(['hash-object', '-w', '--stdin']).trim()
    const injected = execFileSync(GIT, ['-c', 'safe.directory=*', 'hash-object', '-w', '--stdin'], {
      cwd: REPO,
      // stdin 喂 input 的调用 stdio[0] 必须是 'pipe':显式 'ignore' 会压过 input 选项,
      // 喂进去的内容被静默丢弃(hash-object 拿到空串)⇒ 注入变空 blob,门读 0 命中(2026-10-07 T6 实测)。
      stdio: ['pipe', 'pipe', 'pipe'],
      input: `${head}\nfunction __probe46(){ router.back() }\n`,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    }).trim()
    assert.ok(blob && injected, 'hash-object 未出 blob')
    g(['update-index', '--add', '--cacheinfo', `100644,${injected},${target}`])
    const red = run(['--staged'], env)
    assert.equal(red.status, 1, `注入新私接必须判红,不是判"无法判定":${red.stdout}${red.stderr}`)
    assert.match(red.stdout + red.stderr, /PageClient\.tsx/, '必须点名到具体文件,否则人找不到站点')
    assert.ok(
      !/ERR_MODULE_NOT_FOUND|Cannot find module/.test(red.stderr),
      `门在 import 期崩(退出码同为 1)不得被当成判红:${red.stderr.slice(0, 200)}`,
    )
    // 反臂:索引里没有任何射程内文件 ⇒ 回退全量、只报存量、exit 0(恒挡 = 逼人跳门)
    g(['read-tree', 'HEAD'])
    g(['rm', '--cached', '-r', '--force', '--', 'apps/web'])
    const skip = run(['--staged'], env)
    assert.equal(
      skip.status,
      0,
      `无射程内文件时被替每一次无关提交挡路:${skip.stdout}${skip.stderr}`,
    )
    assert.match(skip.stdout, /回退 HEAD 全量/)
  } finally {
    try {
      execFileSync('node', ['-e', `require('fs').rmSync(${JSON.stringify(idx)},{force:true})`], {
        windowsHide: true,
        timeout: 30_000,
        stdio: 'ignore',
      })
    } catch {
      /* 夹具清理失败不影响结论 */
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
