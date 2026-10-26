#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:`.ps1` / `.psm1` 必须以 UTF-8 with BOM(EF BB BF)写入。
 *
 * 立因(2026-10-26,实证不是假想):
 * `AGENTS.md:319` 早就规定「`.ps1` 用 UTF-8 with BOM 写」,但**全仓没有任何一道尺子校验它** ——
 * 规则只活在文档里,于是 76 个 `.ps1` 里 40 个没有 BOM,而没人知道。真害在
 * `deploy/win/deploy-window-common.ps1`(对侧新增件):满篇中文、无 BOM ⇒ Windows 自带的
 * 5.1 引擎按系统代码页(zh-CN = GBK)解码,当场报「表达式或语句中包含意外的标记」并连累
 * 整个模块「缺少右 }」;对侧自带的 `deploy-window-harness` T2 专门断言「5.1 也要能加载」,
 * 因此在 main 上恒红。那不是排版问题:该模块被 `alert-dedup.ps1` 与 `ihui-monitor.ps1`
 * dot-source,prod 上只要走一次 5.1,部署窗口控制与告警去重整条功能就是坏的。
 *
 * 为什么是**差值棘轮**而不是 blocking 全量(§0.2 / §0.5):
 * 存量 40 枚缺 BOM 是既成事实,直接判全量红 = 恒红门 ⇒ 逼人 `--no-verify` ⇒ 一次绕过等于
 * 全部守门对该提交作废。所以锚点取「该文件在 HEAD 自身的状态」:
 *   · HEAD 也没有 ⇒ **存量**,只报数,不判红;
 *   · HEAD 有、工作树没有 ⇒ 本次改动**把 BOM 弄掉了**(编辑器改写 / 生成器覆盖 / `>` 重定向
 *     都会),判红 —— 这一格可自愈,补 3 字节即可;
 *   · HEAD 里根本没有 ⇒ **新增文件**,必须带 BOM,判红。
 * 判据只判「本次改动新增的违规」;存量归零是另一件事,末行照实报数。
 *
 * CLI:
 *   node scripts/check-ps1-bom.mjs                 # 工作树面(默认)
 *   node scripts/check-ps1-bom.mjs --staged        # 索引面(pre-commit 用;与其它门同形)
 *   node scripts/check-ps1-bom.mjs --json          # 机器可读
 *   node scripts/check-ps1-bom.mjs --list-existing # 逐条列存量(修存量时用)
 *   node scripts/check-ps1-bom.mjs --strict        # 全量档:存量也判红(只在存量归零后才有意义)
 *   node scripts/check-ps1-bom.mjs --self-test     # 回归自检:判据六例 + 端到端三例,红绿两向都真跑
 *
 * 退出码:0 = 新增违规 0;1 = 有新增违规(或 --strict 下有存量);2 = 判不了(未判定,不冒充通过)。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const BOM = Buffer.from([0xef, 0xbb, 0xbf])
const ROOT = resolve(import.meta.dirname, '..')

function git(args, { cwd = ROOT, allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd, maxBuffer: 512 * 1024 * 1024, encoding: 'buffer', windowsHide: true })
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

function listTrackedScripts(cwd) {
  const buf = git(['ls-files', '-z', '*.ps1', '*.psm1'], { cwd })
  if (!buf) return []
  return buf
    .toString('utf8')
    .split('\u0000')
    .filter((s) => s.length > 0)
}

function hasBom(buf) {
  return buf.length >= 3 && buf[0] === BOM[0] && buf[1] === BOM[1] && buf[2] === BOM[2]
}

function firstBytes(buf) {
  return Buffer.from(buf.subarray(0, Math.min(3, buf.length))).toString('hex') || '(空)'
}

/** 读某一面(工作树 / 索引)的文件内容;读不到返回 null —— 不静默当成"没有 BOM" */
function readSurface(cwd, rel, surface) {
  try {
    if (surface === 'staged') return git(['cat-file', 'blob', `:${rel}`], { cwd, allowFail: true })
    return readFileSync(join(cwd, rel))
  } catch {
    return null
  }
}

/** HEAD 面:文件不在 HEAD 里返回 undefined(新增件),区别于"在但没有 BOM"(false) */
function readHead(cwd, rel) {
  const exists = git(['cat-file', '-e', `HEAD:${rel}`], { cwd, allowFail: true })
  if (!exists) return undefined
  const blob = git(['cat-file', 'blob', `HEAD:${rel}`], { cwd, allowFail: true })
  if (!blob) return undefined
  return hasBom(blob)
}

/**
 * 纯判据:给定两面读数,返回该文件的结论。
 * 抽成纯函数是为了 --self-test 能直接喂用例,不依赖真仓库状态。
 */
export function classify({ worktreeBom, headBom }) {
  if (worktreeBom === null) return 'undetermined'
  if (worktreeBom) return 'ok'
  if (headBom === undefined) return 'new-violation' // 新增件必须带 BOM
  if (headBom === false) return 'existing' // 存量:HEAD 也没有,棘轮只报数
  return 'regressed' // HEAD 有、现在没了
}

function scan({ cwd = ROOT, surface = 'worktree' } = {}) {
  const rows = []
  for (const rel of listTrackedScripts(cwd)) {
    const buf = readSurface(cwd, rel, surface)
    const worktreeBom = buf === null ? null : hasBom(buf)
    // 性能:只在这份文件**缺 BOM 或读不到**时才去问 HEAD —— 带 BOM 的文件结论恒为 ok,
    // 问 HEAD 只是白起一个子进程。全仓 76 个 .ps1 全部带 BOM 时本门零子进程开销(实测 ~50ms),
    // 否则每提交要白跑 150+ 次 git。
    const headBom = worktreeBom === true ? undefined : readHead(cwd, rel)
    rows.push({
      path: rel,
      verdict: classify({ worktreeBom, headBom }),
      first3: buf === null ? '(读不到)' : firstBytes(buf),
    })
  }
  return rows
}

function report(rows, { json = false, strict = false, listExisting = false, quiet = false } = {}) {
  const by = (v) => rows.filter((r) => r.verdict === v)
  const ok = by('ok')
  const existing = by('existing')
  const regressed = by('regressed')
  const added = by('new-violation')
  const undetermined = by('undetermined')
  const newViolations = [...regressed, ...added]

  const say = quiet ? () => {} : (s) => console.log(s)

  if (json && !quiet) {
    console.log(
      JSON.stringify(
        {
          scanned: rows.length,
          ok: ok.length,
          existingCount: existing.length,
          existing: existing.map((r) => r.path),
          regressed: regressed.map((r) => ({ path: r.path, first3: r.first3 })),
          added: added.map((r) => ({ path: r.path, first3: r.first3 })),
          undetermined: undetermined.map((r) => r.path),
        },
        null,
        2,
      ),
    )
  } else {
    if (existing.length > 0) {
      say(
        `ℹ️  [ps1-bom] 存量缺 BOM(HEAD 也没有,棘轮只报数、不判红)共 ${existing.length} 枚` +
          (listExisting ? ':' : '(要逐条列加 --list-existing)'),
      )
      if (listExisting) for (const r of existing) say(`     ${r.first3}  ${r.path}`)
    }
    if (regressed.length > 0) {
      say(`❌ [ps1-bom] 本次改动把 BOM 弄掉了(HEAD 有、现在没有),共 ${regressed.length} 枚:`)
      for (const r of regressed) say(`     ${r.first3}  ${r.path}`)
    }
    if (added.length > 0) {
      say(`❌ [ps1-bom] 新增 .ps1 没有 BOM,共 ${added.length} 枚:`)
      for (const r of added) say(`     ${r.first3}  ${r.path}`)
    }
    if (undetermined.length > 0) {
      say(`⚠️  [ps1-bom] 读不到内容、判不了(未判定,不冒充通过)共 ${undetermined.length} 枚:`)
      for (const r of undetermined) say(`     ${r.path}`)
    }
    if (newViolations.length > 0) {
      say('修复:给这些文件补 3 字节 UTF-8 BOM 前缀(正文一字节都不用动):')
      say("  node scripts/lib/ps1-add-bom.mjs <文件...>   # 见本门旁的实现,幂等、已有 BOM 不动")
    }
  }

  const red = newViolations.length > 0 || (strict && existing.length > 0)
  const exit = red ? 1 : undetermined.length > 0 ? 2 : 0
  console.log(
    `[ps1-bom] 末行:面=${json ? 'json' : 'text'} 扫描=${rows.length} 带BOM=${ok.length} 存量缺=${existing.length} 新增缺=${newViolations.length} 未判定=${undetermined.length} 档=${strict ? 'strict' : 'ratchet'} exit=${exit}`,
  )
  return exit
}

function selfTest() {
  let fail = 0
  const cases = [
    ['带 BOM,HEAD 也有 ⇒ 绿', true, true, 'ok'],
    ['带 BOM,新增件 ⇒ 绿', true, undefined, 'ok'],
    ['无 BOM,HEAD 也没有 ⇒ 存量只报数', false, false, 'existing'],
    ['无 BOM,新增件 ⇒ 红(新增缺)', false, undefined, 'new-violation'],
    ['无 BOM,HEAD 有 ⇒ 红(本次把 BOM 弄掉了)', false, true, 'regressed'],
    ['读不到 ⇒ 未判定(不冒充通过)', null, true, 'undetermined'],
  ]
  for (const [why, worktreeBom, headBom, want] of cases) {
    const got = classify({ worktreeBom, headBom })
    const pass = got === want
    if (!pass) fail++
    console.log(`${pass ? 'PASS' : 'FAIL'}  判据:${why}  want=${want} got=${got}`)
  }

  // 端到端:临时仓里真跑扫描,红/绿两向都必须真的出现(不然就是恒绿装饰)
  const tmp = mkdtempSync(join(tmpdir(), 'ps1bom-'))
  try {
    const run = (args) => execFileSync('git', args, { cwd: tmp, encoding: 'utf8', windowsHide: true })
    run(['init', '-q'])
    run(['config', 'user.email', 't@t'])
    run(['config', 'user.name', 't'])
    mkdirSync(join(tmp, 'd'), { recursive: true })
    const bom = Buffer.from([0xef, 0xbb, 0xbf])
    writeFileSync(join(tmp, 'd/legacy.ps1'), 'Write-Output 1\n')
    writeFileSync(join(tmp, 'd/good.ps1'), Buffer.concat([bom, Buffer.from('Write-Output 2\n')]))
    run(['add', '-A'])
    run(['commit', '-q', '-m', 'base'])

    // ① 只改内容、不碰 BOM ⇒ 必须绿(存量不算新增)
    writeFileSync(join(tmp, 'd/legacy.ps1'), 'Write-Output 11\n')
    writeFileSync(join(tmp, 'd/good.ps1'), Buffer.concat([bom, Buffer.from('Write-Output 22\n')]))
    const g1 = report(scan({ cwd: tmp }), { json: true, quiet: true })
    console.log(`${g1 === 0 ? 'PASS' : 'FAIL'}  端到端①:改内容不动 BOM ⇒ 绿(exit=${g1})`)
    if (g1 !== 0) fail++

    // ② 新增一个无 BOM 文件 ⇒ 必须红
    writeFileSync(join(tmp, 'd/newbie.ps1'), 'Write-Output 3\n')
    run(['add', '-A'])
    const g2 = report(scan({ cwd: tmp }), { json: true, quiet: true })
    console.log(`${g2 === 1 ? 'PASS' : 'FAIL'}  端到端②:新增无 BOM ⇒ 红(exit=${g2})`)
    if (g2 !== 1) fail++

    // ③ 把有 BOM 的文件的 BOM 弄掉 ⇒ 必须红(regressed 那一格)
    writeFileSync(join(tmp, 'd/good.ps1'), 'Write-Output 222\n')
    const g3 = report(scan({ cwd: tmp }), { json: true, quiet: true })
    console.log(`${g3 === 1 ? 'PASS' : 'FAIL'}  端到端③:原带 BOM 的文件被弄掉 BOM ⇒ 红(exit=${g3})`)
    if (g3 !== 1) fail++
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  console.log(fail === 0 ? '\n自检通过(判据六例 + 端到端三例,正反两向都真跑)' : `\n自检失败:${fail} 例不符`)
  return fail === 0 ? 0 : 1
}

const argv = process.argv.slice(2)
if (argv.includes('--self-test')) process.exit(selfTest())
const surface = argv.includes('--staged') ? 'staged' : 'worktree'
process.exit(
  report(scan({ surface }), {
    json: argv.includes('--json'),
    strict: argv.includes('--strict'),
    listExisting: argv.includes('--list-existing'),
  }),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
