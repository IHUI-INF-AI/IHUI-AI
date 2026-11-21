// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 取源"钉已推送基线"的形状锁(2026-11-21 第 106 项)
// =============================================================================
// 病灶(实测 22:52-22:53 那一轮):origin fetch 25 秒超时 ⇒ 走本机 gitdir 取源 ⇒
// fetch 到的是另一会话**未推送**的本机 main ⇒ prod 按它 merge、根护栏按它通过、随后切流。
// 后果是生产跑"远端不存在、随时会被 rebase 掉"的提交,告警与回滚记录对着一个幻影 sha。
//
// 这一档只钉"结构性不可回到旧形态"的三件事(判据本体在 deploy/win/ihui-deploy.ps1):
//   ① 离线源必须先解析 refs/remotes/origin/main,拿不到就跳过该源(不许退化成 main);
//   ② 取源成功时把已推送基线定格进 $forcedRemoteTip(而不是靠 FETCH_HEAD);
//   ③ 下游在 $forcedRemoteTip 非空时**不读 FETCH_HEAD**。
// **不在这里重写判定**:任何"本机 main 是否领先"的算式都只许留在 ps1 里一份。
//
// 跑法:node --test deploy/tests/fetch-source-pinning.test.mjs
// =============================================================================
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'deploy', 'win', 'ihui-deploy.ps1')
const src = readFileSync(SCRIPT, 'utf8')

// 取源段 = 从"本机取源"标记到 behind 计算之前。判据只看这一段的相对顺序,
// 不受文件其它段落改动影响。
const sourceSection = (() => {
  const start = src.indexOf('origin fetch 失败,改从本机工作区 gitdir 取源')
  const end = src.indexOf('$behindRaw = ')
  assert.ok(start > 0, '取源段起点标记消失(脚本被大改?先在 ps1 里找回这一段的定位锚)')
  assert.ok(end > start, '取源段终点(behind 计算)不在起点之后 ⇒ 分段失败')
  return src.slice(start, end)
})()

test('106-① 离线源只认 refs/remotes/origin/main,拿不到就跳过该源', () => {
  assert.match(
    sourceSection,
    /\$pushedRef = 'refs\/remotes\/origin\/main'/,
    '离线源不再解析 refs/remotes/origin/main ⇒ 会退回跟随未推送的本机 main(2026-11-21 幻影部署正是这一型)',
  )
  const skipped = /if \(\$pushedTip -notmatch '[^']*'\) \{\s*Log "跳过本机取源[^"]*"(\s*\n\s*continue)?/m.exec(sourceSection)
  assert.ok(skipped, '解析不到"基线取不到就跳过"的分支')
  assert.match(skipped[0], /continue/, '基线取不到时必须 continue 到下一个源,不得落回 main')
})

test('106-② 成功时把已推送基线定格进 $forcedRemoteTip', () => {
  assert.match(
    sourceSection,
    /\$forcedRemoteTip = \$pushedTip/,
    '取源成功却没把已推送基线定格 ⇒ 下游仍会去读 FETCH_HEAD(那值是未推送的 main)',
  )
})

test('106-③ 下游 tip 由 $forcedRemoteTip 决定,此时不读 FETCH_HEAD', () => {
  const forced = sourceSection.indexOf('if ($forcedRemoteTip) {')
  const fetchHead = sourceSection.indexOf('rev-parse FETCH_HEAD')
  assert.ok(forced > 0, '下游没有 $forcedRemoteTip 分支')
  assert.ok(fetchHead > forced, 'FETCH_HEAD 读取出现在 $forcedRemoteTip 分支之前 ⇒ 顺序反了,离线源仍会被未推送 main 覆盖')
  // 读 FETCH_HEAD 必须落在 else 分支里:扣掉 if/else 的骨架后,两者之间必须恰好出现 `} else {`
  const between = sourceSection.slice(forced, fetchHead)
  assert.match(between, /\}\s*else\s*\{/, '$forcedRemoteTip 与 FETCH_HEAD 读取之间没有 else 分界 ⇒ 两条路径都会执行')
})

test('106-④ 基线对象不在本地对象库时 fail-closed,不猜', () => {
  const forced = sourceSection.indexOf('if ($forcedRemoteTip) {')
  const block = sourceSection.slice(forced, sourceSection.indexOf('rev-parse FETCH_HEAD'))
  assert.match(block, /cat-file -e "\$remoteTip\^\{commit\}"/, '离线路径没验对象在不在 ⇒ 下游 rev-list/merge 会崩在调用栈里而不是给结论')
  assert.match(block, /Fail "离线取源的已推送基线对象不在本地对象库/, '对象缺失时没有显式 Fail')
})

test('106-⑤ 本机 main 领先基线时点名报数,但结论仍是"只跟基线"', () => {
  assert.match(
    sourceSection,
    /领先已推送基线[^"]*未推送[^"]*枚\)?;离线取源只跟已推送基线/,
    '没有"本机 main 领先多少枚未推送"的点名日志 ⇒ 幻影部署发生时现场无人能一眼看出',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
