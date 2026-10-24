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
 *  T7  G-955(2026-10-22):--check 对台账存量重号**点名报告但不顶死入口**(exit 0),两档读数
 *      (逐字孪生 / 纯系列小节)措辞在场。
 *  T8  G-14(2026-10-22)「同号占用不发」:发号路径必须吃全文件正则扫出的号集(scanFamilyIds 单一实现形状锁 +
 *      夹具单元 + 真仓端到端:--next-only 给的号在 HEAD 台账 ⊕ 工作树副本上必须零命中)。
 *  T9  G-955「新增撞号仍须红」:登记行声明位同号多行 ⇒ judgeRowIdDuplicates 判红,且 --check 分支
 *      以 exit 1 收场;括注内被引号(指针行)不算声明(G-955 病根的反证)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { judgeRowIdDuplicates } from '../lib/plan-id-duplicates.mjs'
import { smallestFreeId } from '../lib/plan-id-lease.mjs'
import { maskComments } from '../lib/code-mask.mjs'
import { scanFamilyIds } from '../lib/plan-id-face.mjs'
import { git } from '../lib/bypass-git.mjs'

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

/**
 * T7 —— G-955(2026-10-22)票面出路②③:台账存量重号(现读 7 组 O 族标题同 id)必须
 * **点名报告但不以 exit 1 顶死独立取号入口**。断言只锁行为契约,不锁组数/组名 ——
 * 存量归并线随时可能折掉某组,把它断死等于给并发会话造一台恒红(T4 同一条纪律)。
 */
test('T7 --check 对存量重号点名不顶死:exit 0 + 两档读数措辞在场(G-955)', () => {
  const r = spawnSync(process.execPath, [CLI, '--check'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
  })
  assert.equal(r.status, 0, `--check 不得被存量重号顶死(独立取号入口必须可用):\n${r.stdout}\n${r.stderr}`)
  assert.match(String(r.stdout), /无登记行重号/, '绿行必须说清判的是登记行声明位')
  const m = /历史小节标题同 id (\d+) 组/.exec(String(r.stdout))
  if (m) {
    // 存量组在场时:必须点名(组列表非空)且写明两档处置口径
    assert.match(String(r.stdout), /含逐字孪生副本 \d+ 组\((?!无)[^)]*\)/, '逐字孪生副本组必须点名,不得只报数')
    assert.match(String(r.stdout), /纯系列小节 \d+ 组/, '纯系列小节一档必须在场')
    assert.match(String(r.stdout), /两档只报数不判红/, '存量重号不得冒充判红')
  }
})

/**
 * T8 —— G-14(2026-10-22)「同号占用不发」回归。扫描那把尺只有一份实现
 * (`lib/plan-id-face.mjs` 的 `scanFamilyIds`,与 live-doc-edit 的令牌展开共用)⇒ 本测试直接 import
 * 它,不在测试里抄第二份判据(§22c)。
 *  a) 形状锁:发号路径必须吃 liveUsed(标题 ∪ 行声明 ∪ 全文件扫描 HEAD 宽面 ∪ 工作树副本),
 *     且建议号算术不得再按旧窄面给号;本器源码里不得再出现第二份扫描正则;
 *  b) 夹具单元:只活在正文引用里的号(`见 O777`)与行声明号 O778 都必须被扫描顶掉;
 *  c) 真仓端到端:--next-only 发出的号,在 HEAD 台账 ⊕ 工作树副本上必须**零命中**(撞号正病的直接反证)。
 */
function fullScanIds(text) {
  return scanFamilyIds(text, 'O')
}

test('T8a 发号路径必须吃全文件扫描的实时占用面(G-14 形状锁)', () => {
  const checkBranch = TOOL_SRC.indexOf("flags.has('--check')")
  const scanDecl = TOOL_SRC.indexOf('const scanHead = scanFamilyIds(')
  assert.ok(scanDecl > checkBranch, '全文件扫描档必须在 --check 分岔之后(发号路径专属,G-955 契约不变)')
  assert.match(
    TOOL_SRC,
    /import\s*\{\s*collectIdFace,\s*scanFamilyIds\s*\}\s*from\s*'\.\/lib\/plan-id-face\.mjs'/,
    '扫描必须 import 那份唯一实现(自抄一条正则就是第二份尺子)',
  )
  assert.doesNotMatch(TOOL_SRC, /const FULLSCAN/, '本器不得自带第二份全文件扫描正则')
  assert.match(TOOL_SRC, /const scanWork = scanFamilyIds\(worktreeText, FAMILY\)/, '工作树副本也必须走同一把尺')
  assert.match(TOOL_SRC, /const liveUsed = \[\.\.\.new Set\(\[\.\.\.poolUsed, \.\.\.scanHead, \.\.\.scanWork\]\)\]/, '占用集必须是 旧口径 ∪ HEAD 宽面扫描 ∪ 工作树扫描 的并集')
  assert.match(TOOL_SRC, /smallestFreeId\(\{ usedNumbers: liveUsed/, '建议号必须按实时占用面算(还按 poolUsed 算就是没装车)')
  assert.match(TOOL_SRC, /poolFreeList\(\{ usedNumbers: liveUsed/, '空闲表必须与发号同一把尺')
  assert.match(TOOL_SRC, /readFileSync\(resolve\(ROOT, PLAN_PATH\)/, '实时面必须含工作树副本(他席未提交的登记活在右侧)')
  assert.match(TOOL_SRC, /skippedByScan/, '命中换号被顶掉的号必须点名(出路①"把跳过的号点名打印")')
})

test('T8b 夹具单元:正文引用与行声明的号都必须顶掉建议号(G-14 同号占用不发)', () => {
  const fixture = [
    '- [ ] O778 行声明位的真号',
    '正文里顺带引用了一句 见 O777 那条(旧口径看不见这一型 ⇒ 撞号正病)',
    '<!-- 已归档:O779 副本在注释里(同样算已占) -->',
    'QODER-O81 这种跨命名空间被引号也宁顶号不空段',
    'OO776 不是号(前一个字符是字母 ⇒ 不顶)',
  ].join('\n')
  const hit = fullScanIds(fixture)
  for (const n of [778, 777, 779, 81]) assert.ok(hit.has(n), `O${n} 必须被全文件扫成已占`)
  assert.ok(!hit.has(776), 'OO776 不得被误扫成 O776(形状收窄,不放宽成任意子串)')
  const next = smallestFreeId({ usedNumbers: [...hit] })
  assert.ok(!hit.has(next), `建议号 ${next} 自身必须不在占用集里(占用不发)`)
})

test('T8c 真仓端到端:--next-only 发出的号在实时面上零命中(G-14 正病反证)', () => {
  const r = spawnSync(process.execPath, [CLI, '--next-only'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
  })
  assert.equal(r.status, 0, `--next-only 必须 exit 0:\n${r.stderr}`)
  const line = String(r.stdout).trim()
  assert.match(line, /^O\d+$/, `stdout 恒一行号,实得:${JSON.stringify(r.stdout)}`)
  const n = Number(/^O(\d+)$/.exec(line)[1])
  const wt = readFileSync(resolve(ROOT, 'PROJECT_PLAN.md'), 'utf8')
  const head = git(['show', 'HEAD:PROJECT_PLAN.md'], { root: ROOT, raw: true, timeout: 120_000 })
  assert.equal(typeof head, 'string', 'HEAD 台账取不到(占用面判不出 ⇒ 这一轮端到端不成立)')
  const occupied = fullScanIds(`${head}\n${wt}`)
  assert.ok(
    !occupied.has(n),
    `${line} 在 HEAD 台账 ⊕ 工作树副本上并非零命中(全文件扫描可见 ${occupied.size} 号)⇒ 取号器又把已占号当空闲发了(G-14 正病复发)`,
  )
})

/**
 * T9 —— G-955 的另一半:「新增撞号仍须红」。判红通道 = 登记行编号声明位同号多行
 * (lib/plan-id-duplicates.mjs 一份尺);台账存量(标题口径)只报数。两型必须在同一份判据上
 * 给出相反结论,否则"不顶死"就被读成"不判红"。
 */
test('T9 新增撞号仍判红、指针被引号不算声明(G-955 判红维正反例)', () => {
  const red = judgeRowIdDuplicates({
    ledgerText: ['- [ ] O123 甲题(别席已登记)', '- [ ] O123 乙题(本席新增撞号)'].join('\n'),
    family: 'O',
  })
  assert.ok(red.ok && red.rowDups.length === 1 && red.rowDups[0][0] === 'O123' && red.rowDups[0][1] === 2, `同号多行必须判红,实得 ${JSON.stringify(red.rowDups)}`)
  const ptr = judgeRowIdDuplicates({
    ledgerText: [
      '- [ ] （待派/QODER-O81） **顺带登记一条归属纪律**',
      '- [ ] O81 跨端 UI 单一源',
    ].join('\n'),
    family: 'O',
  })
  assert.deepEqual(ptr.rowDups, [], '括注内被引号不得顶死判红维(G-955 病根:一行指针顶死整个入口)')
  assert.equal(ptr.rowDecls, 1, '声明位读数必须只数真声明')
  // CLI 接线锁:--check 分支必须真的以 exit 1 收场(判据在场 ≠ 装车)
  const checkBranch = TOOL_SRC.indexOf("flags.has('--check')")
  const branch = TOOL_SRC.slice(checkBranch, TOOL_SRC.indexOf('const headingNote', checkBranch))
  assert.match(branch, /dup\.rowDups\.length/, '--check 必须吃 rowDups 判红')
  assert.match(branch, /process\.exit\(1\)/, '新增撞号必须以 exit 1 收场(存量不顶死 ≠ 新增不红)')
})

/**
 * T10 —— 结论必须与判据同形(2026-10-23 立)。本器旧措辞把"发不出号"一律念成
 * "号池 1..999 已满 ⇒ 先归档已完成条目腾号",而现读证明真因可以是**「没有连续段容量的租约窗」**
 * (G 族:池内已占 815 / 空闲 184 / 最长可落窗游程 32 < 段容量 50)。两种成因的出路相反
 * (无窗型靠散点让位腾不出窗),归因念错 = 把台账里的票全引向无效出路(AGENTS §0.3/§0.8/§10)。
 *  ⇒ ①② 源码形状锁:拒绝行只能由 lib 那一份渲染器给、必须带机读 reason、出口代码不得再出现
 *    "已满"断言,且本器只**读**租约窗做报告(段容量/池上限一个都不自赋 = 分配语义未动);
 *    ③ 端到端:把段容量顶到 999(池内只要有一枚已占号就必然无 999 宽窗)⇒ stderr 必须念
 *    "NO_CONTIGUOUS_LEASE_WINDOW / 但无连续 999 号租约窗",且一个"已满"都不许出现。
 */
test('T10 发不出号的两种成因必须分开念(结论与判据同形,2026-10-23)', () => {
  const CODE = maskComments(TOOL_SRC)
  assert.match(
    CODE,
    /describePoolExhaustion\(leaseView\)/,
    '拒绝发号/警示行必须走 lib 的单源渲染器(出口各拼一句就是第二份口径,§0.6)',
  )
  assert.match(CODE, /reason=\$\{leaseView\.reason/, '机读 reason 必须随结论交出,调用方才分得了两档')
  assert.doesNotMatch(
    CODE,
    /已满/,
    '出口代码(遮注释后)不得再出现"已满"断言 —— 无窗型念成池已满就是假话',
  )
  assert.doesNotMatch(
    CODE,
    /leaseCursor\(\{[^}]*segmentSize/,
    '本器不得自赋段容量(改了就是动分配语义,超出本票射程)',
  )
  assert.doesNotMatch(CODE, /leaseCursor\(\{[^}]*poolMax/, '本器不得自赋池上限(同上)')
  assert.match(
    CODE,
    /leaseView\.mode === 'pool-exhausted'/,
    '两出口口径分歧必须被真判出来并喊出来(静默给号 = 读不出第一出口会拒发)',
  )
  // ③ 真跑:段容量顶到 999 ⇒ 本器按最小空闲照样发号,而租约窗尺子必须点名"无连续窗"
  const r = spawnSync(process.execPath, [CLI, '--source', 'origin/main'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300_000,
    env: { ...process.env, IHUI_LEASE_SEGMENT_SIZE: '999' },
  })
  assert.equal(r.status, 0, `结论层改动不得影响发号(本器按池内最小空闲给号):\n${r.stderr}`)
  const err = String(r.stderr)
  assert.match(
    err,
    /NO_CONTIGUOUS_LEASE_WINDOW/,
    `池内确有闲号却无 999 宽窗 ⇒ 必须点名无窗型,实得 stderr:\n${err.slice(0, 600)}`,
  )
  assert.match(err, /但无连续 999 号租约窗/, '可读行必须把"空闲 N 枚 / 无连续 M 号窗"这一对念出来')
  assert.doesNotMatch(err, /已满/, `无窗型的结论行不得念成"已满",实得:\n${err.slice(0, 600)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
