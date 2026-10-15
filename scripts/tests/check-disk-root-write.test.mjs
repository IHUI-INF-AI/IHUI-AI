// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file check-disk-root-write.test.mjs 集成测试
 * @description 端到端覆盖 scripts/check-disk-root-write.mjs 的核心规则 (AGENTS.md §15/§15b):
 *   - 纯判据(judgeSource):收窄集放行 / 非收窄立 W1 / 只读 W2 / exec 程序位豁免 /
 *     Path 链式写立 W1 / PS1 写 cmdlet 与赋值 / sh 重定向
 *   - decide():差值棘轮(只拦新增) + 台账豁免 + 到期回红
 *   - wiringState():注册条目 blocking + skipEnv 成套(接线四件套之 runner 件)
 *   - CLI 端到端:--staged 新增盘根写入 → exit 1;收窄集 → exit 0;--self-test 全绿
 *   - 判据材料全部从门体 __test__ 取(§22c:测试不得另抄一份)
 *
 *   夹具用 mkScratch(不污染项目,AGENTS.md §23);Node 内置 test runner,无第三方依赖;
 *   路径推导用 import.meta.url(AGENTS.md §15)。
 */
import { test, describe } from 'node:test'
import assert_ from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// §22c/§22d:直接调门体导出的生产判据,不在测试里重述判据材料。
import { __test__ as gate } from '../check-disk-root-write.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-disk-root-write.mjs')
const RUNNER_PATH = join(__dirname, '..', 'guardian-runner.mjs')

const J = (rel, src) => gate.judgeSource(rel, src)

function initGitRepo(root) {
  // 不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git init -b main', { cwd: root, stdio: 'ignore' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'ignore' })
  execSync('git config user.name test', { cwd: root, stdio: 'ignore' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'ignore' })
  execSync('git commit --allow-empty -m init', { cwd: root, stdio: 'ignore' })
}

function writeAndStage(root, relPath, content) {
  const absPath = join(root, relPath)
  mkdirSync(dirname(absPath), { recursive: true })
  writeFileSync(absPath, content, 'utf8')
  execSync(`git add "${relPath}"`, { cwd: root, stdio: 'ignore' })
}

function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

describe('check-disk-root-write.mjs — 判据单元(§22c:材料取自门体 __test__)', () => {
  test('收窄集(首段 IHUI-AI / DevEnv)不立 W1', () => {
    const j = J('a.mjs', "const a = join('D:\\\\', 'DevEnv', 'x')\nconst b = join('g:/', 'ihui-ai', 'y')\n")
    assert_.equal(j.w1.length, 0)
    assert_.equal(j.narrowed.length, 2)
  })

  test('收窄是精确匹配非前缀:IHUI-AI-wt-x 照旧立 W1', () => {
    assert_.equal(J('a.mjs', "join('G:\\\\', 'IHUI-AI-wt-b674', 'x')\n").w1.length, 1)
  })

  test('非收窄首段(G:\\backups)立 W1', () => {
    assert_.equal(J('a.mjs', "join('G:\\\\backups', 'x')\n").w1.length, 1)
  })

  test('只读上下文(existsSync)⇒ W2 不判红', () => {
    const j = J('a.mjs', "if (existsSync(join('G:\\\\backups', 'x'))) {}\n")
    assert_.equal(j.w1.length, 0)
    assert_.equal(j.w2.length, 1)
  })

  test('exec 程序位豁免(字面量与 compose 拼出)', () => {
    assert_.equal(J('a.mjs', "execFileSync('C:/Windows/System32/nssm.exe', ['get', 'x'])\n").w1.length, 0)
    assert_.equal(J('a.mjs', "execFileSync(join('C:\\\\', 'Windows', 'System32', 'nssm.exe'), ['get'])\n").w1.length, 0)
  })

  test('exec 命令串中段 literal 立 W1', () => {
    assert_.equal(J('a.mjs', "execSync('git bundle create D:\\\\x.bundle')\n").w1.length, 1)
  })

  test('Python:open 写模式立 W1 / 默认读 W2 / os.path.join 首参 W1', () => {
    assert_.equal(J('a.py', "open('D:\\\\x', 'w')\n").w1.length, 1)
    assert_.equal(J('a.py', "open('D:\\\\x')\n").w1.length, 0)
    assert_.equal(J('a.py', "os.path.join('G:\\\\', 'probe')\n").w1.length, 1)
  })

  test('Python:Path 探针 ⇒ W2;链式写 Path(..).write_text ⇒ W1(接收体路径位)', () => {
    const probe = J('a.py', "p = Path('C:\\\\Program Files\\\\x\\\\chrome.exe')\n")
    assert_.equal(probe.w1.length, 0)
    assert_.equal(probe.w2.length, 1)
    // 2026-10-15 回归:recv 归一化修复前此链落 other,修复后判 W1
    assert_.equal(J('a.py', "Path('D:\\\\x').write_text('y')\n").w1.length, 1)
  })

  test('PS1:写 cmdlet / 简单赋值立 W1;只读 cmdlet W2;内容位不判', () => {
    assert_.equal(J('a.ps1', "$target = 'G:\\backups\\pg-second-copy'\n").w1.length, 1)
    assert_.equal(J('a.ps1', "$x = 'D:\\DevEnv\\foo'\n").w1.length, 0)
    assert_.equal(J('a.ps1', 'New-Item -ItemType Directory -Force -Path "D:\\foo"\n').w1.length, 1)
    assert_.equal(J('a.ps1', 'Test-Path "G:\\backups\\x"\n').w2.length, 1)
    assert_.equal(J('a.ps1', 'Set-Content -Path $x -Value "D:\\y"\n').w1.length, 0)
  })

  test('注释里的 literal 不算', () => {
    assert_.equal(J('a.mjs', "// writeFileSync('G:\\\\a', d)\n").w1.length, 0)
    assert_.equal(J('a.ps1', "# $x = 'G:\\y'\n").w1.length, 0)
    assert_.equal(J('a.py', "# open('D:\\\\x', 'w')\n").w1.length, 0)
  })
})

describe('check-disk-root-write.mjs — decide() 棘轮与台账', () => {
  const ledgerOf = (arr) => gate.readLedger(JSON.stringify(arr))

  test('差值棘轮:新增>HEAD 才红,只改不增为存量', () => {
    const judged = [{ rel: 'x.mjs', w1: [{ line: 1 }, { line: 2 }], error: null }]
    const up = gate.decide({ judged, anchor: new Map([['x.mjs', 1]]), ledger: ledgerOf([]), today: '2026-10-15', face: 'staged' })
    assert_.equal(up.violations.length, 1)
    const same = gate.decide({ judged, anchor: new Map([['x.mjs', 2]]), ledger: ledgerOf([]), today: '2026-10-15', face: 'staged' })
    assert_.equal(same.violations.length, 0)
    assert_.equal(same.stock.length, 1)
  })

  test('HEAD 面按构造恒存量(不判新增)', () => {
    const judged = [{ rel: 'x.mjs', w1: [{ line: 1 }], error: null }]
    const r = gate.decide({ judged, anchor: new Map(), ledger: ledgerOf([]), today: '2026-10-15', face: 'head' })
    assert_.equal(r.violations.length, 0)
    assert_.equal(r.stock.length, 1)
  })

  test('台账命中且未到期 ⇒ 豁免;到期 ⇒ 回队列判红', () => {
    const judged = [{ rel: 'y.mjs', w1: [{ line: 1 }], error: null }]
    const ok = gate.decide({
      judged, anchor: new Map(), face: 'staged', today: '2026-10-15',
      ledger: ledgerOf([{ file: 'y.mjs', reason: 'r', ticket: 'T', until: '2026-11-15' }]),
    })
    assert_.equal(ok.exempted.length, 1)
    assert_.equal(ok.violations.length, 0)
    const stale = gate.decide({
      judged, anchor: new Map(), face: 'staged', today: '2026-10-15',
      ledger: ledgerOf([{ file: 'y.mjs', reason: 'r', ticket: 'T', until: '2026-10-01' }]),
    })
    assert_.equal(stale.expired.length, 1)
  })

  test('台账坏日期 ⇒ 该条判坏(不静默放过)', () => {
    const l = gate.readLedger(JSON.stringify([{ file: 'z.mjs', reason: 'r', ticket: 'T', until: '不是日期' }]))
    assert_.ok(l.entries.some((e) => e.broken))
  })

  test('台账整份非数组 ⇒ broken 报出', () => {
    assert_.ok(gate.readLedger('{"a":1}').broken)
  })
})

describe('check-disk-root-write.mjs — 接线四件套(runner 件)', () => {
  test('guardian-runner 已注册本门:blocking + skipEnv 成套', () => {
    const w = gate.wiringState(readFileSync(RUNNER_PATH, 'utf8'))
    assert_.equal(w.wired, true, `未接线:${w.reason || ''}`)
    assert_.equal(w.mode, 'blocking')
    assert_.equal(w.skipEnv, 'HUSKY_SKIP_DISK_ROOT_WRITE')
    assert_.equal(w.missing.length, 0, `缺失:${w.missing.join(',')}`)
  })
})

describe('check-disk-root-write.mjs — CLI 端到端', () => {
  test('--staged:新增盘根写入(G:\\probe-x)⇒ exit 1 且点名', () => {
    const root = mkScratch('ihui-drw-')
    try {
      initGitRepo(root)
      writeAndStage(root, 'scripts/probe.mjs', "const p = join('G:\\\\', 'probe-x')\nconsole.log(p)\n")
      const r = runScript(['--staged', '--root', root], { cwd: root })
      assert_.equal(r.status, 1, `应 exit 1,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
      assert_.match(r.stdout + r.stderr, /probe\.mjs|新增/)
    } finally {
      rmScratch(root)
    }
  })

  test('--staged:收窄集(DevEnv)新增 ⇒ exit 0', () => {
    const root = mkScratch('ihui-drw-')
    try {
      initGitRepo(root)
      writeAndStage(root, 'scripts/ok.mjs', "const p = join('D:\\\\', 'DevEnv', 'Temp', 'x')\nconsole.log(p)\n")
      const r = runScript(['--staged', '--root', root], { cwd: root })
      assert_.equal(r.status, 0, `收窄集应 exit 0,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    } finally {
      rmScratch(root)
    }
  })

  test('--self-test 全绿', () => {
    const r = runScript(['--self-test'])
    assert_.equal(r.status, 0)
    const m = /通过\s*(\d+)\s*失败\s*(\d+)/.exec(r.stdout)
    assert_.ok(m, `自检输出异常:${r.stdout}`)
    assert_.equal(m[2], '0', `自检有失败:${r.stdout}`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
