// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据 import 源脚本的 __test__,本文件不复制第二份。
// 本票锁四件事:① 装车证明(注册条目 blocking + skipEnv + 触发面收窄,读 HEAD 面 runner);
// ② 真面现读零块(复原当刻的凭据,也是"下次再被灌回就红"的活尺);
// ③ 复原必须零丢失:被剥的每一行都逐字存在于归档面 ⇒ 判据不许靠"看着像"删内容;
// ④ 门槛两侧都钉(11 行不报 / 12 行报)与横幅反证(样板逐字重合不得算回灌)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-live-doc-archive-reinflation.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-live-doc-archive-reinflation.mjs')
const stdio = ['ignore', 'pipe', 'pipe']
const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28, stdio }).stdout
const run = (args = []) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28, stdio })

test('装车证明:注册条目 blocking + skipEnv + 触发面收窄(读 HEAD 面 runner,不读工作区)', () => {
  const head = git(['show', 'HEAD:scripts/guardian-runner.mjs'])
  const i = head.indexOf("'check-live-doc-archive-reinflation.mjs'")
  assert.ok(i > -1, '门体未接进提交链注册表')
  const block = head.slice(Math.max(0, i - 500), i + 900)
  assert.match(block, /mode:\s*'blocking'/)
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_LIVE_DOC_REINFLATION'/)
  assert.match(block, /stagedTriggers:/, '必须按输入面收窄触发(不给无关提交造恒红,§12e)')
})

test('真面:HEAD 的 AGENTS.md 与 README.md 现读零回灌块', () => {
  const r = run([])
  assert.equal(r.status, 0, `HEAD 面应无回灌块,实得:\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /✅ 没有连续 ≥\d+ 行逐字命中归档面的块/)
})

test('零丢失自证:紧凑版之后的本地新行,一条都不许被剥掉', () => {
  const archFiles = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', gate.ARCHIVE_PREFIX]).split('\n').filter((f) => /(^|\/)AGENTS[^/]*\.md$/.test(f))
  assert.ok(archFiles.length >= 1, '归档面枚举为空 ⇒ 本臂前提不成立')
  const A = gate.buildArchiveFace(Object.fromEntries(archFiles.map((f) => [f, git(['show', `HEAD:${f}`])])))
  const compact = git(['show', '443adacdff:AGENTS.md']).split('\n')
  const C = new Set(compact)
  const headNow = git(['show', 'HEAD:AGENTS.md']).split('\n')
  const headSet = new Set(headNow)
  // 紧凑版仍在 HEAD 里的行 = 复原后必须全部还在(它们是本仓在生效的规则面)
  const stillInHead = compact.filter((l) => C.has(l) && headSet.has(l))
  assert.ok(stillInHead.length > 200, `紧凑版留存行数异常(${stillInHead.length})⇒ 复原可能吃掉了规则行`)
  // 反向:被剥掉的行必须逐行有归档件落点
  const stripped = compact.filter((l) => !headSet.has(l))
  for (const l of stripped) {
    if (l.trim() === '') continue
    assert.ok(A.has(l) || C.has(l), `被剥又不在归档面的行 = 真丢失:${l.slice(0, 60)}`)
  }
})

test('门槛两侧 + 横幅反证:11 行不报 / 12 行报 / 跨文件同款横幅不算回灌', () => {
  const LONG = Array.from({ length: 20 }, (_, i) => `归档正文第 ${i + 1} 行，长度足够跨过有信息量门槛，用来构造整区级回灌样本。`)
  const set = gate.buildArchiveFace({ 'x.md': LONG.join('\n') })
  assert.equal(gate.findReinflatedBlocks([...LONG.slice(0, 11), '本地新规则行，它不在归档面里，用来把块切断，长度也够。'], set).length, 0)
  assert.equal(gate.findReinflatedBlocks([...LONG.slice(0, 12), '本地新规则行，它不在归档面里，用来把块切断，长度也够。'], set).length, 1)
  const banner = ['<!--', '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top', 'Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。', '-->']
  assert.equal(gate.findReinflatedBlocks(banner, gate.buildArchiveFace({ 'y.md': banner.join('\n') })).length, 0)
  assert.equal(gate.MIN_RUN, 12, '门槛改动必须同步自测两侧(改数字不改臂 = 尺子空转)')
})

test('口径:两面同给 ⇒ exit 2；归档面枚举为 0 ⇒ 未判定不冒绿', () => {
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, both.stdout + both.stderr)
  assert.match(both.stdout, /未判定/)
  const src = git(['show', 'HEAD:scripts/check-live-doc-archive-reinflation.mjs'])
  assert.match(src, /枚举到 0 份 AGENTS\* 归档件/, '归档面为 0 必须走未判定分支')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
