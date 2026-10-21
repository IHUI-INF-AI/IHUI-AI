// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:next-plan-id.mjs(第二发号出口)的远端那一维。
 *
 * 背景(G-313 硬前置,2026-09-30):取号出口有两处 —— live-doc-edit.mjs(令牌展开)与本器(手动
 * CLI)。此前只有前者看了远端;本器按本地宽面给号,对面"已推未并"的登记结构上永远看不见,
 * G-978062 那组撞号正是两批各按旧基准取号造出来的。翻新后本器与第一出口**共用同一把尺**
 * (import readRemoteIdBasis + idBasisGate,不抄第二份)。
 *
 *  T1  源码形状锁:必须 import 第一出口的那两个出口(抄第二份必漂);本器自身不得出现
 *      ls-remote/fetch 派生(传输面只住在 live-doc-edit.mjs 那一份)。
 *  T2  闸门必须真的强制在发号路径上:gate.block ⇒ exit 1,且字样里写明拒绝理由;应急 env
 *      必须被读取(IHUI_PLAN_ID_ALLOW_UNALIGNED)。
 *  T3  --check 不发号 ⇒ 源码形状上它必须在远端读取之前分岔(不问远端,stdout/stderr 契约不变)。
 *  T4  真仓只读冒烟:--next-only 恒一行号且 exit 0;完整报告 exit 0(不断言具体号 —— 号是现读的,
 *      把它断死等于给并发会话造一台恒红)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = resolve(ROOT, 'scripts', 'next-plan-id.mjs')
const TOOL_SRC = readFileSync(CLI, 'utf8')

test('T1 源码形状锁:远端尺必须 import 自 live-doc-edit.mjs,本器不得自带第二份传输面', () => {
  assert.match(
    TOOL_SRC,
    /import\s*\{\s*readRemoteIdBasis,\s*idBasisGate\s*\}\s*from\s*'\.\/live-doc-edit\.mjs'/,
    '远端基准与闸门必须与第一发号出口同一份实现(抄第二份必漂,AGENTS §3)',
  )
  assert.doesNotMatch(TOOL_SRC, /ls-remote/, '本器不得自带 ls-remote 派生(传输面只有一份,在 live-doc-edit.mjs)')
  assert.doesNotMatch(TOOL_SRC, /'fetch'/, '本器不得自带 fetch(自补救住在共享 transport 里)')
  assert.doesNotMatch(TOOL_SRC, /\bexecFileSync\(/, 'git 派生纪律只许住在 lib 层(守门 52/80 口径)')
})

test('T2 闸门必须强制在发号路径上:block ⇒ exit 1;应急 env 必须被读取', () => {
  const gateCall = TOOL_SRC.indexOf('idBasisGate({')
  assert.ok(gateCall > 0, 'idBasisGate 没有调用点 ⇒ 闸门没装车(造好没装车那一型)')
  const gateSection = TOOL_SRC.slice(gateCall, gateCall + 800)
  assert.match(gateSection, /IHUI_PLAN_ID_ALLOW_UNALIGNED/, '应急旗必须接到闸门的 allowUnaligned')
  assert.match(gateSection, /process\.exit\(1\)/, 'block 必须以非零退出收场(警告照样能提交就是本票要堵的原病)')
  assert.match(TOOL_SRC, /拒绝发号/, '拒绝措辞必须在场(出路要写明白,不得只喊不行)')
})

test('T3 --check 不问远端:发号维必须在 --check 分岔之后', () => {
  const checkBranch = TOOL_SRC.indexOf("flags.has('--check')")
  const remoteRead = TOOL_SRC.indexOf('readRemoteIdBasis({')
  assert.ok(checkBranch > 0 && remoteRead > checkBranch, '--check 分岔必须在远端读取之前(不发号就不问远端,契约逐字不变)')
  assert.match(TOOL_SRC, /SOURCE === 'HEAD'/, '--source 显式指面时不得重复问远端(那一面本来就是被指的面)')
})

test('T4 真仓只读冒烟:--next-only 恒一行号;完整报告正常退出(不断言具体号,号是现读的)', () => {
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  const r1 = spawnSync(process.execPath, [CLI, '--next-only'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT, encoding: 'utf8', timeout: 180_000 })
  assert.equal(r1.status, 0, `--next-only 必须 exit 0(真仓此刻远端可问/离线都该走得到发号):\n${r1.stderr}`)
  assert.match(String(r1.stdout).trim(), /^O\d+$/, `--next-only 的 stdout 恒为一行号,实得:${r1.stdout}`)
  const r2 = spawnSync(process.execPath, [CLI], { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT, encoding: 'utf8', timeout: 180_000 })
  assert.equal(r2.status, 0, `完整报告必须 exit 0:\n${r2.stderr}`)
  assert.match(String(r2.stdout), /下一个号 = O\d+/)
})

/**
 * T5/T6 —— G-927(2026-10-21)的系列小节形态锁。
 * 判据本体只住在 CLI 源码里那一份 HEADING:这里**从源码把那条正则取出来再用**,不复制第二份
 * 正则字面量(§22c —— 抄一份判据进测试,测试就会永远跟着旧形状绿)。
 */
function headingReFromSource() {
  const m = /^const HEADING = (\/.*\/gm)$/m.exec(TOOL_SRC)
  assert.ok(m, 'HEADING 必须是源码里那一条 /…/gm 字面量(取不到即判据被拆走,镜像测试失去意义)')
  return new RegExp(m[1].slice(1, m[1].lastIndexOf('/')), 'gm')
}

test('T5 系列小节不得被并成重号:同号不同后缀必须各算一条;同后缀逐字重复仍判重(G-927)', () => {
  const re = headingReFromSource()
  const src = [
    '## O82续四 第二批',
    '## O82补 登记正文重登',
    '### O62 附:补跑守门链量到的两件事',
    '### O62 附⑥:把 R6 收到真消费端',
    '### O62 附⑫:构建漂移的根因',
    '### O62 附⑬:dev 同样受持久缓存影响',
    '## O86附⑧ 收口三件',
    '## O86附⑧ 收口三件',
    '## O45 凭据巡检根因收口',
    '## O45 凭据巡检根因收口',
  ].join('\n')
  const keys = [...src.matchAll(re)].map((m) => m[1].replace(/[ \t]+/g, ''))
  const counts = new Map()
  for (const k of keys) counts.set(k, (counts.get(k) || 0) + 1)
  // 六支不同小节 ⇒ O62 族三个 key 各 1 次(附 / 附⑥ / 附⑫ / 附⑬),绝不许合成 "O62×4"
  assert.equal(counts.get('O62'), undefined, '带后缀的系列小节不得记到裸号 O62 名下(那就是把正当形态误报成重号的原病)')
  for (const k of ['O62附', 'O62附⑥', 'O62附⑫', 'O62附⑬', 'O82续四', 'O82补']) {
    assert.equal(counts.get(k), 1, `${k} 应各算一条独立小节,实得 ${counts.get(k)}`)
  }
  // 反证:同键真重复必须仍然数得出来(判据不能为了消红把真重号也放掉)
  assert.equal(counts.get('O86附⑧'), 2, '同后缀逐字重复的标题必须仍判重')
  assert.equal(counts.get('O45'), 2, '同号同题(无后缀)必须仍判重')
})

test('T6 数字段提取必须走 key 而不是整串:带后缀的 key 不得把 max 算成 NaN(G-927 自伤反证)', () => {
  assert.match(TOOL_SRC, /const headingNum = /, '必须有一份 headingNum 出口(旧写法 Number(k.slice(1)) 遇到 O62附⑥ 得 NaN,会把 maxLedger 算成 NaN 并顶掉整个发号路径)')
  assert.doesNotMatch(TOOL_SRC, /Number\((?:k|m\[1\])\.slice\(1\)\)/, '不得再出现 Number(key.slice(1)) 那一族写法(key 现在可能带后缀)')
  const re = headingReFromSource()
  const withSuffix = [...'### O62 附⑫:构建漂移'.matchAll(re)][0][1].replace(/[ \t]+/g, '')
  const numSrc = /const headingNum = \(key\) => Number\(\/\^O\(\\d\+\)\/\.exec\(key\)\[1\]\)/.test(TOOL_SRC)
  assert.ok(numSrc, 'headingNum 的实现必须是"取 ^O(\\d+) 的数字段"这一份(改成整串 Number 必得 NaN)')
  assert.equal(Number(/^O(\d+)/.exec(withSuffix)[1]), 62, `数字段提取实得 ${withSuffix} → ${Number(/^O(\d+)/.exec(withSuffix)[1])}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
