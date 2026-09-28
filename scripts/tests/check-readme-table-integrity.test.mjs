// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门「活文档 Markdown 结构对账」(check-readme-table-integrity.mjs)的 §22c 镜像测试。
//
// 为什么每例都存在:本门拦的是"活文档被改写坏"这一型 —— 它没有任何编译期症状(typecheck/lint
// 全绿),症状是 README/AGENTS 在 GitHub 上渲染碎掉、下一个会话对着碎表读台账。而 2026-09-28 起
// 它还是**提交链上唯一的 Markdown 结构闸**(那条写回式 prettier 通道已从 lint-staged 摘掉,因为
// 它会把提交者没碰的行一起改写),所以"判据在、却没人调度"从"少一道闸"升级成"这一族零看守"。
// 门自身有四种"看起来正常其实失明"的方式,全部只会表现为一路报绿:
//  ① 注册块被并发旧基线整文件回写摘掉(门在、判据对、无人调度 —— 守门 136/140 同日实录);
//  ② 判据扩了而 stagedTriggers 没扩 ⇒ 对新增那半文档永不调用(T9 就是这一格);
//  ③ 豁免族没进守门 108 存活期表(豁免只有出生没有死亡,且登记行会被旧副本无声抹掉 —— 门 134
//     的 M15 就是这么逮到一次回写);
//  ④ 修复出口只是文档里的一句漂亮话(本仓记过多次"写了个跑不通的出路")。
// 判据本体(TI1/TI2/TI3/FE1/TI4 与棘轮、退回档、diff 解析三态)由门自己的 --self-test 端到端
// 证明(T7 跑它),这里不复读 —— 但 T11 独立跑一次"暂存删除 ⇒ exit 2",因为**接线之后**的
// "取不到判无法判定"与内部函数是否还认这一格,是两件事。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SRC_NAME = 'check-readme-table-integrity.mjs'
const SRC = join(REPO, 'scripts', SRC_NAME)
const EXPIRY = join(REPO, 'scripts', 'check-exemption-expiry.mjs')
const BASELINE = join(REPO, 'scripts', 'readme-table-integrity-baseline.json')
const UNWRAP = join(REPO, 'scripts', 'readme-table-unwrap.mjs')

function runNode(args, timeout = 600000) {
  return execFileSync(process.execPath, args, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 临时仓里派生 git:一律绝对路径 git + 参数数组 + windowsHide + timeout(守门 80 口径)。 */
function gitIn(root, args) {
  return gitRaw(args, root, { timeout: 120000 })
}

/**
 * 从注册表全文里按**大括号配对**取出本门那一条注册项(守门 136 的 T2 同课:
 * 用"脚本名前后各 N 字符"当条目范围会跨进邻门 —— 别人有 blocking 就算我有)。
 * @returns {{text:string,id:string|null}|null} 找不到本门的 script 行 ⇒ null(未接线)
 */
function extractEntry(runnerText, scriptName) {
  const needle = `script: '${scriptName}',`
  const at = runnerText.indexOf(needle)
  if (at < 0) return null
  const open = runnerText.lastIndexOf('{', at)
  let depth = 0
  let end = -1
  for (let i = open; i < runnerText.length; i++) {
    const ch = runnerText[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) return null
  const block = runnerText.slice(open, end)
  const idm = /^\s*id:\s*(['"])(.*?)\1\s*,?\s*$/m.exec(block)
  return { text: block, id: idm ? idm[2] : null }
}

test('T1 装车证明:HEAD 面 runner 必须真有本门注册,blocking + skipEnv + stagedTriggers 齐备', () => {
  // 读 HEAD blob 而不是磁盘 —— 注册由 gate-registry-insert 走 commit-tree 落地,共享工作树
  // 副本可能滞后(§12d 第三层);"接完门必须在 HEAD 面复现 grep 计数"是守门 136 的原文教训。
  const runner = gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], REPO)
  const entry = extractEntry(runner, SRC_NAME)
  assert.ok(entry, `${SRC_NAME} 不在 HEAD 的注册表里 —— 门存在但没人调度 = 没有(§22c 反复记过)`)
  assert.match(entry.text, /mode:\s*'blocking'/, '本门必须 blocking(存量已冻基线,不会恒红)')
  assert.match(entry.text, /skipEnv:\s*'HUSKY_SKIP_README_TABLE_INTEGRITY'/, '缺 skipEnv 就没有应急出口')
  assert.match(entry.text, /stagedTriggers:\s*\[[^\]]*'README\.md'/, 'stagedTriggers 必须含 README.md,否则提交链上根本不唤起')
  assert.ok(entry.id, '注册块里解不出 id')
  const idCount = runner.split(`id: '${entry.id}'`).length - 1
  assert.equal(idCount, 1, `本门编号 ${entry.id} 在 runner 中出现 ${idCount} 次,必须恰好一次(撞号会把 skipEnv/失败归属串到别人门上)`)
})

test('T9 触发面必须真的覆盖 AGENTS.md(扩了判据却没扩触发 = 对那一半文档零判据)', () => {
  // 门体现在审两份活文档(README + AGENTS)。stagedTriggers 仍只写 README.md 的话,一枚"只改
  // AGENTS.md"的提交根本不唤起本门 —— 判据存在而永不调用,账面与"没有这道门"逐字同形
  // (守门 81 的 stagedTriggers 教训、70/76/81 同族)。这条就是那半格的"未装车"反向锁。
  const runner = gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], REPO)
  const entry = extractEntry(runner, SRC_NAME)
  assert.ok(entry, '本门未注册,T9 无从谈起(先让 T1 红,再谈触发面)')
  const trigBlock = /stagedTriggers:\s*\[([^\]]*)\]/.exec(entry.text)
  assert.ok(trigBlock, '注册块里没有 stagedTriggers 这一行')
  const triggers = trigBlock[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
  assert.ok(triggers.includes('README.md'), '触发面丢了 README.md ⇒ 本门在 README 提交上失明')
  assert.ok(triggers.includes('AGENTS.md'), '触发面缺 AGENTS.md ⇒ FE1/TI4 对 AGENTS 永不调度(= 没有判据)')
  // 反向对照:把 AGENTS 那条摘掉之后,本判据必须认不出它 —— 否则 T9 只是条恒真断言。
  const stripped = entry.text.replace(/'AGENTS\.md',?\s*/, '')
  const t2 = /stagedTriggers:\s*\[([^\]]*)\]/.exec(stripped)
  const list2 = (t2 ? t2[1] : '').split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
  assert.ok(!list2.includes('AGENTS.md'), '摘掉 AGENTS.md 后仍能读出它 ⇒ T9 的解析是假的')
})

test('T10 判据不得留第二份实现:围栏解析只许 maskMarkdownStructure 一处,竖线形状只许 classifyCluster 一处', () => {
  // FE1 读的是 mask 多带出来的 unclosedFenceAt,TI4 读的是 classifyCluster 多带出来的 shortRows。
  // 两处各写第二份"数 ```"/"数 2 竖线"迟早与 TI1 漂开(本仓记过最多次的失效型)。
  const src = readFileSync(SRC, 'utf8')
  const fenceOpens = src.match(/\^ \{0,3\}\(`\{3,\}\|~\{3,\}\)/g) ?? []
  assert.equal(fenceOpens.length, 1, `开栏正则出现 ${fenceOpens.length} 次 —— 围栏语义只许 maskMarkdownStructure 那一份`)
  const shape = src.match(/r\.pipes === 2/g) ?? []
  assert.equal(shape.length, 1, '2 竖线形状判据出现多次 ⇒ TI1 与 TI4 会各自漂移')
  assert.match(src, /unclosedFenceAt:\s*fence \? fence\.line : null/, 'FE1 的输入必须由 mask 那一份扫描产出,不得另扫一遍')
  assert.match(src, /for \(const s of p\.cls\.shortRows\)/, 'auditText 必须原样转递 classifyCluster 的形状行(不得自己再挑一次)')
  assert.match(src, /changedSet\.has\(s\.line\)/, 'TI4 必须按"改动行集"筛形状行,而不是整档判(整档判会追溯存量 ⇒ 恒红门)')
})

test('T11 取不到判"无法判定":在临时仓里把在审文档暂存删除 ⇒ exit 2,不回落 HEAD 也不记绿', () => {
  // 这条与门体自检的"索引取不到"一证一锁:自检证明**行为**,本条锁住**接线后的端到端**形状 ——
  // 有人把"未判定"顺手改成"跳过"时,门体自检仍可能绿(它测的是内部函数),这里红。
  let scratch = null
  try {
    scratch = mkScratch('readme-table-mirror-')
    gitIn(scratch, ['init', '-q', '.'])
    gitIn(scratch, ['config', 'user.email', 'gate@local'])
    gitIn(scratch, ['config', 'user.name', 'gate'])
    writeFileSync(join(scratch, 'README.md'), ['| a | b | c |', '| - | - | - |', '| 1 | 2 | 3 |', ''].join('\n'), { encoding: 'utf8' })
    mkdirSync(join(scratch, 'scripts'), { recursive: true })
    writeFileSync(join(scratch, 'scripts', 'readme-table-integrity-baseline.json'), '{"taCounts":{"README.md":0}}\n', { encoding: 'utf8' })
    gitIn(scratch, ['add', 'README.md', 'scripts/readme-table-integrity-baseline.json'])
    gitIn(scratch, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'seed'])
    gitIn(scratch, ['rm', '--cached', '-q', '--', 'README.md'])
    let code = 0
    let out = ''
    try {
      out = execFileSync(process.execPath, [SRC, '--staged', '--json', '--root', scratch], {
        cwd: scratch,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 180000,
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      code = typeof e.status === 'number' ? e.status : 2
      out = String(e.stdout ?? '')
    }
    assert.equal(code, 2, `暂存删除该判"无法判定"(exit 2),实得 ${code};回落 HEAD 就是把"没判"写成"判过了"`)
    const j = JSON.parse(out)
    assert.ok(j.undetermined.some((u) => u.file === 'README.md'), '未判定必须点名是哪个文件')
    assert.equal(j.exit, 2)
  } finally {
    if (scratch) rmScratch(scratch)
  }
})

test('T2 摘线不得被读成已装车:把 script 行删掉的构造文本必须解不出条目', () => {
  const runner = gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], REPO)
  const stripped = runner.replace(`script: '${SRC_NAME}',`, "script: 'someone-elses-gate.mjs',")
  assert.equal(extractEntry(stripped, SRC_NAME), null, '摘了线仍被判定"已装车" = T1 的锚点根本没看 script 行')
})

test('T3 豁免族必须登记进守门 108 存活期表且取 30 天(待偿债务,不是结构性定性)', () => {
  const src = gitRaw(['show', 'HEAD:scripts/check-exemption-expiry.mjs'], REPO)
  // 工作树副本此刻与 HEAD 同形(登记前逐字节核过);为防"登记在飞"的时序,再按磁盘兜一次读,
  // 两读**任一**命中才算在位 —— 但磁盘命中必须同时能在工作树里 grep 到(不猜)。
  let hay = src
  if (!/'table-cell-exempt':\s*30\b/.test(hay)) {
    hay = readFileSync(EXPIRY, 'utf8')
    assert.ok(
      /'table-cell-exempt':\s*30\b/.test(hay),
      'table-cell-exempt 未挂 30 天到期档 —— 被旧基线整文件回写抹掉的登记正是这一格(守门 134 M15 同课)',
    )
  }
})

test('T4 取材面形状锁:内容必须走 face-reader 读取入口,不得散写 git / 磁盘直读被审面', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '本门必须走 face-reader(全量判 HEAD blob)')
  assert.match(src, /catBatch\(/, '没调用层的读取入口 = 半接线(守门 118 对这一型提交档判红)')
  assert.ok(!/readFileSync\(\s*join\(\s*ROOT/.test(src), '被审内容不得按 ROOT 拼磁盘路径直读(共享工作树滞后 HEAD 会换结论)')
  assert.ok(!/process\.cwd\(\)/.test(src), '不得用 process.cwd() 定根(守门 70 镜像 13/14 恒红那一型)')
  assert.ok(!/execSync\(/.test(src), '不得 execSync 拼字符串派生 git(§5b:绝对路径 + 参数数组才有 windowsHide/timeout 可言)')
})

test('T5 修复出口是真可跑的命令:门报出的 fixHint 逐字可跑,unwrap 在位、语法过、对 README --dry-run 零写盘', () => {
  const j = JSON.parse(runNode([SRC, '--json']))
  assert.equal(
    j.fixHint,
    'node scripts/readme-table-unwrap.mjs --file README.md --dry-run',
    '失败提示里的修复出口必须逐字可跑(本仓记过多次"文档写了一个跑不通的出路")',
  )
  runNode(['--check', UNWRAP])
  const before = createHash('sha1').update(readFileSync(join(REPO, 'README.md'))).digest('hex')
  const out = runNode([UNWRAP, '--file', 'README.md', '--dry-run'])
  const after = createHash('sha1').update(readFileSync(join(REPO, 'README.md'))).digest('hex')
  assert.match(out, /readme-table-unwrap/, `dry-run 无本工具签名输出:${out.slice(0, 200)}`)
  assert.equal(after, before, '--dry-run 动了 README(零写盘是它的默认承诺)')
})

test('T6 基线必须已在位且含 README 键(缺失 ⇒ cap=0 ⇒ 存量恒红 ⇒ 全队跳门)', () => {
  const j = JSON.parse(readFileSync(BASELINE, 'utf8'))
  assert.ok(j && typeof j === 'object' && j.taCounts && 'README.md' in j.taCounts, '基线缺 README 键')
  assert.ok(Number.isInteger(j.taCounts['README.md']) && j.taCounts['README.md'] >= 0, 'T-A 额度必须是非负整数')
})

test('T7 判据端到端:门自身 --self-test 全绿(TI1/TI2/TI3/棘轮四向/阳性对照都由它证明)', () => {
  const out = runNode([SRC, '--self-test'])
  assert.match(out, /--self-test: 全部通过/)
})

test('T8 --json 只含 JSON(说明性文字混进 stdout 会让 runner 之外的取证全部失真)', () => {
  const out = runNode([SRC, '--json'])
  const j = JSON.parse(out)
  assert.equal(j.gate, 'readme-table-integrity')
  assert.ok(Array.isArray(j.perFile))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
