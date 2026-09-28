// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 守门「README 表格完整性对账」(check-readme-table-integrity.mjs)的 §22c 镜像测试。
//
// 为什么每例都存在:本门拦的是"活文档表格被 prettier 重排打断"这一型 —— 它没有任何编译期
// 症状(typecheck/lint 全绿),症状是 README 在 GitHub 上渲染碎掉、下一个会话对着碎表读台账。
// 而门自身有三种"看起来正常其实失明"的方式,全部只会表现为一路报绿:
//  ① 注册块被并发旧基线整文件回写摘掉(门在、判据对、无人调度 —— 守门 136/140 同日实录);
//  ② 豁免族没进守门 108 存活期表(豁免只有出生没有死亡,且登记行会被旧副本无声抹掉 —— 门 134
//     的 M15 就是这么逮到一次回写);
//  ③ 修复出口只是文档里的一句漂亮话(本仓记过多次"写了个跑不通的出路")。
// 判据本体(TI1/TI2/TI3 与棘轮)由门自己的 --self-test 端到端证明(T7 跑它),这里不复读。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { gitRaw } from '../lib/face-reader.mjs'

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
