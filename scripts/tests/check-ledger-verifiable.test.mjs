// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-ledger-verifiable.mjs`(只读尺子)的镜像测试。判据 import 源脚本 `__test__`,本文件零复制。
 * 两条命令级臂是本会话实犯之后补的:第一版把票数组当命令数组数,15 条绿票摆在眼前却印「绿 0」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { __test__ as v } from '../check-ledger-verifiable.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DOC = [
  '- [ ] G-1 判据 `node scripts/check-mypy.mjs --worktree`',
  '- [ ] G-2 沿用 node scripts/run-evidence.mjs(#EVIDENCE-RC 才作结论)',
  '- [ ] G-3 只点名 scripts/foo.mjs',
  '- [ ] G-4 纯叙述',
].join('\n')

test('分类:只有带旗标的 node 命令算自带判据,裸提工具名与无旗标反引号都不算', () => {
  const c = v.classify(DOC)
  assert.equal(c.v1.length, 1)
  assert.equal(c.v1[0].line, 1)
  assert.equal(c.v1[0].cmds.length, 1)
  assert.ok(!c.v1.some((x) => x.line === 2), '散文里提工具名被当成判据 ⇒ 上一轮就是这么误判 G-57 出路失效的')
})

test('分桶穷尽:V1+V2+V3 必等于未勾行数,且已勾行不进射程', () => {
  const c = v.classify(`${DOC}\n- [x] G-5 已勾 \`node scripts/z.mjs --json\``)
  assert.equal(c.v1.length + c.v2.length + c.v3.length, c.rows.length)
  assert.equal(c.rows.length, 4, '已勾行不得进未勾射程')
})

test('汇总两层计数:命令级展平、票级未判定自成一档', () => {
  const runs = [
    { line: 1, allGreen: true, anyRed: false, rs: [{ cmd: 'a', rc: 0 }] },
    { line: 2, allGreen: false, anyRed: true, rs: [{ cmd: 'b', rc: 1 }] },
    { line: 3, allGreen: false, anyRed: false, rs: [{ cmd: 'c', rc: null, note: 'skipped(会写盘或依赖共享索引态)' }] },
    { line: 4, allGreen: false, anyRed: false, rs: [{ cmd: 'd', rc: 'timeout' }] },
  ]
  const line = v.summary({ rows: runs, v1: runs, v2: [], v3: [] }, runs)
  assert.match(line, /票级 全绿 1 有红 1 未判定 2/)
  assert.match(line, /命令级 绿 1 红 1 跳过 1 未跑到 1/)
})

test('形状锁:登记行识别与跳过档都来自源脚本,测试不另写一份', () => {
  const src = readFileSync(path.join(HERE, '..', 'check-ledger-verifiable.mjs'), 'utf8')
  assert.match(src, /import \{[^}]*parseTaskRows[^}]*\} from '\.\/lib\/plan-task-index\.mjs'/, '未从单源 import parseTaskRows')
  assert.doesNotMatch(src, /^\s*const\s+\w*OPEN_ROW_RE\s*=/m, '尺子内另立了一份"什么算未勾登记行"的正则')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
