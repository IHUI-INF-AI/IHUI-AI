// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— 第五条(2026-10-24,活文档取号在"并发批次带着旧底稿并入"这一型下仍会撞号)。
 *
 * 病形(票面自述):本会话两行由取号令牌在 CAS 里按当次 HEAD 底稿现算;另一批正文**手填号**,
 * 在之后才并入 HEAD ⇒ 同一号段被两批各自认领。号在并入前哪个面都不存在,所以"只扫号"的发号器
 * 结构上看不见它;能当场看见的是**同一件事已经在册**(标题/关键词同题)。本票的最小修复:
 * 发号前对目标文件现读正文(工作树副本 ⊕ HEAD 宽面)按同题指纹查重,命中即当场拒绝发号。
 *
 *  L1 形状锁:同题指纹必须 import 守门 194 那一份实现;查重必须落在发号路径(工作树副本读取之后 /
 *     --next-only 打印之前);`--title` / `--keyword` 必须进旗标白名单,不得另写一份指纹。
 *  L2 正证(旧底稿已并入):拿现读正文里一条**已并入**的未勾登记的标题原样发号 ⇒ 当场拒绝
 *     (exit 1、stdout 一个号都不给),并点名既有号与既有行。
 *  L3 关键词档:同一条登记的关键词片段同样拦(措辞与面不同,结论相同)。
 *  L4 反证:现读正文里绝无雷同的标题照常发号(exit 0、stdout 恒一行号) —— 查重不得把新活也堵死。
 *  判据不在测试里另抄一份:标题行选取与命中判定都走 `extractTaskFingerprint`(与工具同一把尺)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { extractTaskFingerprint } from '../check-plan-task-duplicates.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = resolve(ROOT, 'scripts', 'next-plan-id.mjs')
const TOOL_SRC = readFileSync(CLI, 'utf8')
const PLAN = readFileSync(resolve(ROOT, 'PROJECT_PLAN.md'), 'utf8')

function runCli(args, env = null) {
  return spawnSync(process.execPath, [CLI, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300_000,
    env: env ? { ...process.env, ...env } : process.env,
  })
}

/** 声明号出现在行首区(复选框 + 括注之后)的未勾登记行 —— 与工具报"既有号"的口径同形。 */
const DECLARED_OPEN_ROW = /^-\s*\[ \]\s*(?:[（(〔][^）)〕]*[）)〕]\s*)*([A-Z]+-?\d+)/

/** 从**现读正文**取一条已并入、指纹可算、长度可当 argv 传的未勾登记行(旧底稿并入侧的代表)。 */
function mergedOpenRow() {
  const row = PLAN.split('\n')
    .map((l) => l.trim())
    .find(
      (l) =>
        DECLARED_OPEN_ROW.test(l) &&
        l.length <= 240 &&
        extractTaskFingerprint(l) !== null,
    )
  assert.ok(row, '现读正文里必须找得到可按指纹判定的未勾登记行(找不到 ⇒ 本测试不成立,不得当绿)')
  return row
}

test('L1 形状锁:同题指纹取守门 194 的唯一实现,查重落在发号路径上', () => {
  assert.match(
    TOOL_SRC,
    /import\s*\{\s*extractTaskFingerprint\s*\}\s*from\s*'\.\/check-plan-task-duplicates\.mjs'/,
    '同题指纹必须 import 守门 194 那一份(自抄一份"什么算同题"必漂移)',
  )
  assert.doesNotMatch(TOOL_SRC, /function\s+\w*Fingerprint\s*\(/, '本器不得自带指纹实现')
  const worktreeRead = TOOL_SRC.indexOf('worktreeText = readFileSync(resolve(ROOT, PLAN_PATH)')
  const guard = TOOL_SRC.indexOf('findSameTitleRows(f.body')
  const nextOnly = TOOL_SRC.indexOf("flags.has('--next-only')")
  assert.ok(worktreeRead > 0 && guard > worktreeRead, '查重必须在工作树副本(现读正文)读到之后')
  assert.ok(guard > 0 && guard < nextOnly, '查重必须在 --next-only 打印号之前(否则号已发出去)')
  assert.match(TOOL_SRC, /\{ label: '工作树副本\(现读\)', body: worktreeText \}/, '工作树副本必须进查重面')
  assert.match(TOOL_SRC, /body: wideText/, 'HEAD 宽面(台账 ⊕ 归档件)必须进查重面 —— 已并入的旧底稿在这一侧')
  assert.match(TOOL_SRC, /'--title',\s*'--keyword'/, '两个旗标必须进白名单(否则当场报未知参数)')
})

test('L2 正证(并发批次带旧底稿并入):同一标题已在现读正文 ⇒ 当场拒绝发号并点名既有号', () => {
  const row = mergedOpenRow()
  const existingId = DECLARED_OPEN_ROW.exec(row)[1]
  // 取号器的带值旗标口径(G-322)拒收以 `-` 开头的值 ⇒ 传"复选框之后"的正文,工具会自行补 `- [ ] `。
  const titleArg = row.replace(/^-\s*\[ \]\s*/, '')
  const r = runCli(['--next-only', '--title', titleArg])
  assert.equal(
    r.status,
    1,
    `同题已在册时必须当场拒绝发号(exit 1),实得 status=${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`,
  )
  const err = String(r.stderr)
  assert.match(err, /同题已在册/, '必须点名"同题已在册"(结论与判据同形)')
  assert.match(err, /拒绝发号/, '必须写明拒绝发号,不是只警告')
  assert.ok(
    err.includes(`既有号 ${existingId}`),
    `必须点名既有号 ${existingId}(改用既有号是唯一正解),实得:\n${err.slice(0, 800)}`,
  )
  assert.doesNotMatch(String(r.stdout), /^O\d+$/m, '拒绝档不得在 stdout 给号(给了号就等于照发)')
})

test('L3 关键词档:同题关键词片段命中同样当场拦', () => {
  const row = mergedOpenRow()
  const fp = extractTaskFingerprint(row)
  const keyword = fp.slice(0, 16)
  const r = runCli(['--next-only', '--keyword', keyword])
  assert.equal(r.status, 1, `关键词命中必须拒绝发号,实得 status=${r.status}\nstderr=${r.stderr}`)
  assert.match(String(r.stderr), /同题已在册/, '关键词档与标题档必须给同一个结论')
  assert.match(String(r.stderr), /拒绝发号/, '措辞必须写明拒绝发号')
})

test('L4 反证:现读正文绝无雷同的标题照常发号(查重不得把新活也堵死)', () => {
  const unique = '本席同题查重反证专用标题绝无雷同甲申丙午丁未'
  const localFp = extractTaskFingerprint(`- [ ] ${unique}`)
  assert.ok(localFp, '反证标题必须算得出指纹(否则它走的是"未判定"档,反证不成立)')
  const occupied = new Set(PLAN.split('\n').map((l) => extractTaskFingerprint(l)).filter(Boolean))
  assert.ok(!occupied.has(localFp), '反证标题的指纹不得已在台账里(否则它不算反证)')
  const r = runCli(['--next-only', '--title', unique])
  assert.equal(r.status, 0, `新标题必须照常发号(exit 0),实得 status=${r.status}\nstderr=${r.stderr}`)
  assert.match(String(r.stdout).trim(), /^O\d+$/, `stdout 恒一行号,实得:${JSON.stringify(r.stdout)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
