// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-declared-outbound-routes.mjs(§22c 模式 —— 测试**直接 import 源脚本的
 * `__test__`**,不在这里复制第二份判据;判据本体住在 scripts/lib/outbound-route-{facts,registrations}.mjs)。
 *
 * 与 --self-test 的分工:自检打构造面与真语料(纯内存 + 只读),本文件打**CLI 契约**与**取材面**——
 * 临时 git 仓里造"索引 ≠ HEAD ≠ 磁盘"的三面现场,证明默认档真在判 HEAD blob、--staged 真在判索引 blob,
 * 以及"两面旗同给 / 无提交"都判死而不是记绿。
 *
 * 一条方向性对照(T1)钉住"接线必须成套":本门已由主会话接进 guardian-runner,
 * 所以它要求 `mode: 'blocking'` 与 `skipEnv` 同时在场 —— 只接一半(比如漏 skipEnv)比不接更危险,
 * 因为判据红的时候没有人能正当脱身,唯一结局是各会话跳门并连带废掉全部守门。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

import { GIT_BIN, runGate, writeRepo } from './helpers/outbound-routes-fixtures.mjs'

test('T1 接线成套性:未接则放过,已接则必须 blocking + skipEnv 齐备', () => {
  const runner = readFileSync(new URL('../guardian-runner.mjs', import.meta.url), 'utf8')
  const wired = runner.includes('check-declared-outbound-routes.mjs')
  if (!wired) return
  // 一旦被接线(主会话的权限),必须同时是 blocking 且有应急跳过通道 —— 缺一即红。
  // 注:runner 的定级字段是 `mode: 'blocking'`,不是 `blocking: true` —— 按 runner 的真实 schema 判,
  // 否则这条断言会在**已正确接线**的提交上恒红(判据错 ≠ 交付缺陷)。
  const block = /check-declared-outbound-routes\.mjs[\s\S]{0,600}?mode:\s*'blocking'/.test(runner)
  const skip = runner.includes('HUSKY_SKIP_DECLARED_OUTBOUND_ROUTES')
  if (!block || !skip)
    throw new Error(`接线不完整: blocking=${block} skipEnv=${skip}(半接线比不接更危险)`)
})

test('T2 默认档判 HEAD blob:索引与磁盘都被别人改脏也不得跟着走', () => {
  const dir = mkScratch('outbound-face-')
  try {
    writeRepo(dir)
    // 索引里把声明删掉、盘上再改成另一条 —— 两面都与 HEAD 不同
    writeFileSync(
      `${dir}/apps/ai-service/app/services/hub.py`,
      'x = 1  # 别人把声明删了\n',
      'utf8',
    )
    execFileSync(GIT_BIN, ['-C', dir, 'add', 'apps/ai-service/app/services/hub.py'], {
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    writeFileSync(`${dir}/apps/ai-service/app/services/hub.py`, 'y = 2  # 盘上又是另一份\n', 'utf8')
    const head = runGate(dir, [])
    const staged = runGate(dir, ['--staged'])
    if (head.code !== 0) throw new Error(`HEAD 面默认档应 exit 0,实得 ${head.code}:${head.out}`)
    if (!/未匹配 1/.test(head.out)) throw new Error(`HEAD 面必须仍报那 1 条未匹配:${head.out}`)
    if (!/未匹配 0/.test(staged.out)) throw new Error(`--staged 应看到索引里声明已被删 ⇒ 0:${staged.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T3 两面旗同给 ⇒ exit 2(不得任选一面冒充判定)', () => {
  const dir = mkScratch('outbound-flags-')
  try {
    writeRepo(dir)
    const r = runGate(dir, ['--staged', '--worktree'])
    if (r.code !== 2) throw new Error(`期望 exit 2,实得 ${r.code}:${r.out}`)
    if (!/无法判定/.test(r.out)) throw new Error(`必须喊"无法判定"而不是静默挑一面:${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T4 无提交可判 ⇒ exit 2,不得记成"没有违规"', () => {
  const dir = mkScratch('outbound-empty-')
  try {
    // 装好门与夹具文件,但**不提交** ⇒ HEAD 面取不到。此时候选声明一条都读不到,
    // 那是"判不了"不是"没有违规";记绿会让这道门在 CI 上永远绿灯。
    writeRepo(dir, { commit: false })
    const r = runGate(dir, [])
    if (r.code !== 2) throw new Error(`空仓上必须判死,实得 ${r.code}:${r.out}`)
    if (!/无法判定/.test(r.out)) throw new Error(`必须喊"无法判定":${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T5 strict 才有退出码 1:默认档判同一批但不拦提交(防恒红门)', () => {
  const dir = mkScratch('outbound-strict-')
  try {
    writeRepo(dir)
    const loose = runGate(dir, [])
    const strict = runGate(dir, ['--strict'])
    if (loose.code !== 0) throw new Error(`默认档应 0,实得 ${loose.code}`)
    if (strict.code !== 1) throw new Error(`--strict 应 1,实得 ${strict.code}:${strict.out}`)
    if (!/hub\.py/.test(strict.out)) throw new Error(`--strict 必须点名文件与行号:${strict.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T6 取材面纪律形状锁:必须引 face-reader 且真用 catBatch 读内容(门 118 的半接线型)', () => {
  const src = readFileSync(new URL('../check-declared-outbound-routes.mjs', import.meta.url), 'utf8')
  if (!/from '\.\/lib\/face-reader\.mjs'/.test(src)) throw new Error('未引 face-reader')
  if (!/catBatch\(/.test(src)) throw new Error('未走层的读取入口 catBatch ⇒ 属半接线')
  if (/execFileSync\(\s*['"]git['"]/.test(src) || /git show/.test(src))
    throw new Error('守门脚本里不得自己派生 git 读内容')
})

/* ------------------------------------------------------------------ *
 * T7–T11:--files 的旗标吞噬与空声明集(2026-09-28 假绿灯收口票)。
 * 缺陷原文:`--files` 无条件把紧邻的下一个 token 当清单,而 runner 给每道门追加 `--staged`,
 * 于是 `--files --staged` 把清单收成"一个叫 --staged 的文件" ⇒ 声明 0 / 未匹配 0 且
 * **--strict 也 exit 0**(真仓实测,2026-09-28)。那是账面全绿的空扫:判据失效的表现是安静。
 * 方向必须成对:T7/T9 证"假绿被关掉",T8/T10 证"没把它写成一台恒红门"。
 * ------------------------------------------------------------------ */
const DECL_FILE = 'apps/ai-service/app/services/hub.py'

test('T7 (a) --files --staged ⇒ 非零退出且点名收到的 token(假绿灯被关掉)', () => {
  const dir = mkScratch('outbound-filesflag-')
  try {
    writeRepo(dir)
    for (const extra of [[], ['--strict']]) {
      const r = runGate(dir, ['--files', ...extra])
      if (r.code === 0) throw new Error(`--files 后面没有值却 exit 0 = 又一次空扫(附加 ${extra}):${r.out}`)
      if (r.code !== 2) throw new Error(`必须走「无法判定」档 exit 2,实得 ${r.code}:${r.out}`)
      if (!/无法判定/.test(r.out)) throw new Error(`必须喊"无法判定"而不是静默退回全量:${r.out}`)
    }
    // runner 的实际追加形态:--files 的值位上就是 --staged
    const swallow = runGate(dir, ['--files', '--staged'])
    if (swallow.code !== 2) throw new Error(`--files --staged 必须 exit 2,实得 ${swallow.code}:${swallow.out}`)
    if (!/--staged/.test(swallow.out)) throw new Error(`必须点名收到的那个 token --staged,好让人一眼看出是旗标被吞:${swallow.out}`)
    const wt = runGate(dir, ['--files', '--worktree'])
    if (wt.code !== 2 || !/--worktree/.test(wt.out)) throw new Error(`同一判据必须覆盖 --worktree:${wt.code} ${wt.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T8 (b) --files <真有声明的文件> ⇒ 正常判定,新判据不得误伤(正向对照)', () => {
  const dir = mkScratch('outbound-filesok-')
  try {
    writeRepo(dir)
    const loose = runGate(dir, ['--files', DECL_FILE])
    if (loose.code !== 0) throw new Error(`默认档合法收窄应 exit 0,实得 ${loose.code}:${loose.out}`)
    if (/无法判定/.test(loose.out)) throw new Error(`合法清单被新判据误伤(值校验写死成"永远拒"就是这一型):${loose.out}`)
    if (!/声明 2/.test(loose.out) || !/未匹配 1/.test(loose.out))
      throw new Error(`合法收窄必须仍报那 2 条声明 / 1 条未匹配:${loose.out}`)
    const strict = runGate(dir, ['--files', DECL_FILE, '--strict'])
    if (strict.code !== 1) throw new Error(`--strict 下真未匹配必须判红 exit 1(不是被空扫吞掉),实得 ${strict.code}:${strict.out}`)
    if (!/hub\.py/.test(strict.out)) throw new Error(`判红必须点名文件:${strict.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T9 (c) 显式 --files 而清单里一条声明都解析不到 ⇒ 未判定,--strict 也不得出合格证', () => {
  const dir = mkScratch('outbound-filesempty-')
  try {
    writeRepo(dir)
    for (const extra of [[], ['--strict'], ['--staged']]) {
      const r = runGate(dir, ['--files', 'apps/api/src/routes/nope.py', ...extra])
      if (r.code !== 2) throw new Error(`附加 ${extra}:0 条声明必须 exit 2(无法判定),实得 ${r.code}:${r.out}`)
      if (!/无法判定/.test(r.out)) throw new Error(`必须喊"无法判定"而不是"声明 0 / 未匹配 0":${r.out}`)
      if (/声明 0 \/ 注册/.test(r.out)) throw new Error(`不得再打出一行读起来像"扫过了、零漂移"的结论:${r.out}`)
    }
    // 只由空白/逗号组成的值同样不构成清单(否则又是一次静默全扫)
    const blank = runGate(dir, ['--files', ' , '])
    if (blank.code !== 2) throw new Error(`--files 的值拆出 0 个路径名必须 exit 2,实得 ${blank.code}:${blank.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T10 (d) 本次提交不涉及射程(没给 --files 而声明侧 0 条)⇒ 照旧放行,不得判红', () => {
  const dir = mkScratch('outbound-outscope-')
  try {
    writeRepo(dir)
    // 把唯一的声明源从索引里摘掉(= 这一份面上结构上没有本门的输入)
    writeFileSync(`${dir}/${DECL_FILE}`, 'x = 1  # 本次提交不碰任何出站点\n', 'utf8')
    execFileSync(GIT_BIN, ['-C', dir, 'add', DECL_FILE], {
      windowsHide: true,
      timeout: 120_000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    for (const extra of [[], ['--strict']]) {
      const r = runGate(dir, ['--staged', ...extra])
      if (r.code !== 0)
        throw new Error(
          `没给 --files 的 0 声明必须按原语义放行(判红就是一台与任何提交无关的恒红门,唯一结局是逼人 --no-verify 连带废掉全部守门 §12e) —— 附加 ${extra} 实得 ${r.code}:${r.out}`,
        )
      if (/无法判定/.test(r.out)) throw new Error(`这一态不得喊无法判定(它与 ② 的区别就在有没有显式 --files):${r.out}`)
      if (!/声明 0/.test(r.out)) throw new Error(`结论行必须如实报"声明 0",不得掩饰:${r.out}`)
    }
    // 阳性对照:注册面没瞎,且 HEAD 面仍能读出那 2 条声明(0 来自索引、不来自判据失明)
    const head = runGate(dir, [])
    if (!/声明 2/.test(head.out) || !/未匹配 1/.test(head.out))
      throw new Error(`HEAD 面必须仍报 声明 2 / 未匹配 1,否则 T10 的 0 就说明判据根本没在读:${head.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T11 (e) 源码级反向锁:--files 不得再是裸 argv[indexOf()+1],且两态必须各有出口', () => {
  const src = readFileSync(new URL('../check-declared-outbound-routes.mjs', import.meta.url), 'utf8')
  /**
   * **缺席类断言一律判在"剥掉注释与字符串"的代码面上**(`lib/code-mask.mjs` 是全仓唯一那份遮罩实现,
   * 本测试引它而不是再抄一份 —— 守门 135/131 同一条规矩)。理由实测:本门头注里为了说明旧缺陷
   * **逐字引用了旧写法**,按原文判"不得出现"会产出一台**红在正确代码上**的门 —— 与 §守门速查里
   * `stripJsonc` 那次"说明性文字也带执行性字符"同型。存在类断言判原文(引用无害)。
   */
  const code = maskCommentsAndStrings(src)
  if (/argv\[\s*argv\.indexOf\(/.test(code))
    throw new Error('退回了裸取紧邻下一个 token 的旧形态 argv[argv.indexOf(…) + 1] —— 旗标吞噬那一型会原样复发')
  if (!/export function parseFilesFlag/.test(src)) throw new Error('取值判据必须是可导入的一份实现(§22c:测试不得再抄)')
  // 值校验三态缺一不可:不存在 / 以 - 开头 / 拆出 0 个路径名
  if (!/startsWith\('-'\)/.test(src)) throw new Error('缺"以 - 开头不算值"的判据(口径来自 scan-hardcoded-zh 的 flagValue)')
  if (!/typeof raw !== 'string'/.test(src)) throw new Error('缺"值必须存在"的判据')
  if (!/files\.length === 0/.test(src)) throw new Error('缺"值拆出 0 个路径名"的判据')
  // 必须走既有的「无法判定」通道,而不是静默退回
  if (!/无法判定: \$\{filesFlag\.error\}/.test(src)) throw new Error('--files 报错没接进既有的无法判定 + return 2 通道')
  // 空声明集判据必须**只在显式 --files 时**触发 —— 去掉这个条件就是把 (d) 那一态判红
  if (!/opts\.onlyFilesGiven && candidates\.length === 0/.test(src))
    throw new Error('缺"显式 --files 收窄到 0 条声明 ⇒ 未判定"那一支(或它不再区分 given,两态已被合并)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
