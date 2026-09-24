// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 98「HEAD 悬空具名导入对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 重点钉三件"本地全绿也发现不了"的事:
 *  1. 判据必须真读 HEAD blob(工作区滞后 HEAD 是本仓常态);
 *  2. 棘轮锚点必须是该文件 HEAD 自身的违规数 —— 否则存量会把每次提交都判红,逼人 --no-verify;
 *  3. 必须装车(guardian-runner 里 id 98 存在、blocking、skipEnv 对得上)。
 */
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditFile, parseExports, parseImports } from '../check-dangling-local-imports.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(ROOT, 'scripts/check-dangling-local-imports.mjs')

test('源模块导出三个可单测的纯函数(§22c 前置条件)', () => {
  for (const fn of [parseImports, parseExports, auditFile]) assert.equal(typeof fn, 'function')
})

test('D1 正反成对:导入不存在的名字必拦,存在必放行', () => {
  const files = {
    'x/i.ts': "import { Ghost } from './b'",
    'x/b.ts': 'export const Real = 1',
  }
  const read = (p) => files[p] ?? null
  const has = (p) => p in files
  assert.equal(auditFile('x/i.ts', read, has).filter((v) => v.rule === 'D1').length, 1)
  files['x/b.ts'] = 'export const Real = 1\nexport const Ghost = 2'
  assert.equal(auditFile('x/i.ts', read, has).filter((v) => v.rule === 'D1').length, 0)
})

test('目录不得被当成模块读(首版把 ui-react 17 处具名导入全判成悬空)', () => {
  const files = { 'x/i.ts': "import { A } from './bar'", 'x/bar/index.ts': 'export const A = 1' }
  const read = (p) => files[p] ?? null
  // 目录 `x/bar` 在磁盘上"存在"但读不出内容 —— 必须走 index.ts 而不是把目录当目标
  const v = auditFile('x/i.ts', read, (p) => p in files || p === 'x/bar')
  assert.equal(v.length, 0, `应经 index.ts 解析,实际:${JSON.stringify(v)}`)
})

test('装车证明:guardian-runner 里 id 98 必须存在、blocking、只出现一次', () => {
  const src = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const hits = [...src.matchAll(/id: '98'/g)]
  assert.equal(hits.length, 1, `id 98 出现 ${hits.length} 次(重复登记即撞号)`)
  const block = src.slice(hits[0].index, hits[0].index + 900)
  assert.match(block, /script: 'check-dangling-local-imports\.mjs'/)
  assert.match(block, /mode: 'blocking'/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_DANGLING_IMPORTS'/)
})

test('真仓 HEAD 零容忍:悬空必须为 0(存量已于 2026-09-24 清零,任何回归都是合并把修复吞了)', () => {
  let out
  try {
    out = execFileSync(process.execPath, [GUARD], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 128 << 20,
      timeout: 420000,
    })
  } catch (e) {
    //  exit 1 时也要把"到底是哪几处"报出来 —— 只说"失败了"等于没有哨兵
    const back = [...((e.stdout || '').toString().matchAll(/^   (\S+):\d+ \[(D\d)\] (.+?)  →/gm))]
    assert.fail(
      `HEAD 上出现 ${back.length} 处悬空具名导入(本门零容忍):\n` +
        back.map(([, f, r, raw]) => `     ${f} [${r}] ${raw}`).join('\n'),
    )
  }
  assert.match(out, /内容口径:HEAD 内容/)
  assert.match(out, /新增 0 文件/)
  assert.match(out, /悬空 0 处/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
