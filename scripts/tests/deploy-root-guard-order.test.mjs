// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 静态顺序钉:根护栏闸必须判"ff 之后的那一面",且只判这一处(§22c 单面单判据)。
 *
 * 立因(2026-11-01,票面锚点「根护栏前置闸读的是换流之前那一面」):
 *   旧布局 = `ihui-deploy-loop.ps1` 1b) 跑 `root-guard.mjs --check`,而 ff 在 `ihui-deploy.ps1`
 *   里才做 ⇒ 闸看的是**换流前那面旧 HEAD**,清单绑的也是旧 HEAD 里的哈希,而"把清单修对的那枚
 *   提交"只在远端那一面 ⇒ 门越守越锁(本日实测连续 44 轮 FAIL)。
 *   修法②=把闸后移到 ff 成功之后、备份/构建/切流之前。此缺陷**只可能以"位置错了"的形式复发**,
 *   所以只有顺序断言能防回潮:判据对不红(它俩各自都自洽),红的是"它们相对于 ff 的位置"。
 *
 * 同时钉住两条来之不易的现场事实(写在这两枚 ps1 的注释里,别让后人当噪声删掉):
 *   ① 闸**不得**改判 origin/main —— 生产机上这个嵌套 remote-tracking ref 会被宿主清理层吞掉、
 *      永不更新(deploy/win/ihui-deploy.ps1 头注与 fetch 段两条实证:2026-09-13 / 2026-09-28),
 *      ff 用的是 fetch 当场定格成显式 sha 的 $remoteTip,根本不是它。
 *   ② loop 1b) 里那段 `$guardNode`(node 绝对路径兜底)必须留着 —— 成本熔断还要用它。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEPLOY = join(ROOT, 'deploy', 'win', 'ihui-deploy.ps1')
const LOOP = join(ROOT, 'deploy', 'win', 'ihui-deploy-loop.ps1')

/**
 * 剥离 PowerShell 注释(块注释 `<# … #>` 与行注释 `#…`)。
 * 粗粒度是**刻意**的:这里只判"某一行是否还在真调用",不判字符串内容;把字符串里带 `#`
 * 的行一并少判几列,也不会让"真调用"这一行消失(它本身不含 `#`)。
 * 注意块注释的起止片段由字符类拼出,免得本注释自己提前收尾。
 */
function stripPsComments(src) {
  const blockOpen = '<' + '#'
  const blockClose = '#' + '>'
  const noBlock = String(src)
    .split(blockOpen)
    .reduce((acc, part, i) => {
      if (i === 0) return part
      const end = part.indexOf(blockClose)
      // 未闭合的块注释:剩下的全算注释(失效方向是"看不见",而不是"看得见"——见下方断言口径)
      return acc + (end < 0 ? '' : part.slice(end + blockClose.length))
    }, '')
  return noBlock
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|\s)#[^\n]*$/, (m, p1) => p1))
    .join('\n')
}

const rawDeploy = readFileSync(DEPLOY, 'utf8')
const rawLoop = readFileSync(LOOP, 'utf8')
const deployLines = rawDeploy.split(/\r?\n/)
const codeDeploy = stripPsComments(rawDeploy).split(/\r?\n/)
const codeLoop = stripPsComments(rawLoop).split(/\r?\n/)

/** 1-based 行号(与编辑器/`sed -n` 一致);找不到 = -1。 */
const lineOf = (re, lines) => {
  const i = lines.findIndex((l) => re.test(l))
  return i < 0 ? -1 : i + 1
}

test('① ihui-deploy.ps1:根护栏闸在 `merge --ff-only` 之后、备份(.rollback)之前', () => {
  // 实际写法是 `& git -C $Root merge --ff-only $remoteTip`,故只锚 `merge --ff-only $remoteTip`。
  const ffLine = lineOf(/merge\s+--ff-only\s+\$remoteTip/, codeDeploy)
  const guardLine = lineOf(/root-guard\.mjs/, codeDeploy)
  const backupLine = lineOf(/^#\s*1\)\s*备份当前 web 构建/, deployLines)
  const rollbackCopyLine = lineOf(/Copy-Item\s+\$curNext\s+\$rb/, deployLines)

  assert.ok(ffLine > 0, '找不到 `git merge --ff-only $remoteTip`:ff 的写法变了,本顺序断言会失明')
  assert.ok(
    guardLine > 0,
    'ihui-deploy.ps1 里找不到 root-guard.mjs 调用 —— 闸被删了?删闸 = 削判据,一律不许',
  )
  assert.ok(backupLine > 0, '找不到备份起手注释 `# 1) 备份当前 web 构建`:本断言的前提变了')
  assert.ok(rollbackCopyLine > 0, '找不到 `.rollback` 复制行:备份段的写法变了,本断言会失明')

  assert.ok(
    guardLine > ffLine,
    `根护栏闸(第 ${guardLine} 行)必须排在 ff(第 ${ffLine} 行)**之后** —— ` +
      '排在前面就是"判换流前那面旧 HEAD",正是本票要根治的 44 轮自锁',
  )
  assert.ok(
    guardLine < backupLine,
    `根护栏闸(第 ${guardLine} 行)必须排在备份起手(第 ${backupLine} 行)之前 —— ` +
      '排在后面就是"已经动过回滚点了才判红",停手不再零影响',
  )
  assert.ok(
    guardLine < rollbackCopyLine,
    `根护栏闸(第 ${guardLine} 行)必须排在 .rollback 复制(第 ${rollbackCopyLine} 行)之前`,
  )
})

test('② ihui-deploy.ps1:根护栏只判一处(两处各判一面 = §22c 违例),且 rc≠0 一律 fail-closed', () => {
  const callLines = codeDeploy
    .map((l, i) => ({ l, n: i + 1 }))
    .filter((x) => /root-guard\.mjs/.test(x.l))
  assert.equal(
    callLines.length,
    1,
    `ihui-deploy.ps1 里 root-guard.mjs 的调用点有 ${callLines.length} 处(第 ${callLines
      .map((x) => x.n)
      .join('/')} 行)⇒ 判据面会分叉,只许一处`,
  )
  const guardLine = callLines[0].n
  assert.ok(/--check/.test(callLines[0].l), '根护栏调用必须带 --check(不带就是别的子命令,不是闸)')

  // 闸必须 fail-closed:rc≠0 ⇒ Fail(不许"取不到就放行")
  const block = codeDeploy.slice(guardLine - 1, guardLine + 8).join('\n')
  assert.ok(/\$rgRc\s*-ne\s*0/.test(block), '闸块里找不到 rc≠0 判定 ⇒ 这一格不再 fail-closed')
  assert.ok(/Fail\s+"/.test(block), '闸块里 rc≠0 没有 Fail ⇒ 判红也只是打日志,构建照跑')
  // 闸面必须是 HEAD 端(ff 之后的那一面):不许把 ref 名硬塞回去读 origin/*
  assert.ok(
    !/origin\/(main|master)/.test(block),
    '闸块里出现了 origin/* 引用 —— 生产上那个嵌套 ref 被宿主清理层吞掉,读它就是读旧面',
  )
})

test('③ ihui-deploy-loop.ps1:1b) 不再有 root-guard 的 --check 调用(注释剔除后判定)', () => {
  const offenders = codeLoop.map((l, i) => ({ l, n: i + 1 })).filter((x) => /root-guard/i.test(x.l))
  assert.deepEqual(
    offenders.map((x) => x.n),
    [],
    `deploy-loop 里仍有 root-guard 调用/引用:第 ${offenders.map((x) => x.n).join('/')} 行 —— ` +
      '根护栏已后移到 ihui-deploy.ps1 的 ff 之后,这里再判就是"两处各判一面"(§22c)',
  )

  // 原位必须留下"为什么挪走"的说明(删闸不删理由 = 下一个人会好心挪回来)。
  // 取"根护栏为什么必须挪走"那一段注释起手后 12 行:理由是一段,不是一行 —— 按单行找会漏。
  const loopLines = rawLoop.split(/\r?\n/)
  const noteStart = loopLines.findIndex((l) => /根护栏为什么必须挪走/.test(l))
  assert.ok(noteStart >= 0, 'deploy-loop 里找不到"根护栏为什么必须挪走"那段理由注释')
  const noteBlock = loopLines.slice(noteStart, noteStart + 12).join('\n')
  assert.ok(
    /后移/.test(noteBlock),
    'deploy-loop 里没有"根护栏已后移"的说明注释 —— 回潮前没人拦得住',
  )
  assert.ok(
    /origin\/main/.test(noteBlock),
    'deploy-loop 的说明里没有点名 origin/main 不可信 —— 上一席就是在这里选了那条死路',
  )
})

test('④ ihui-deploy-loop.ps1:成本熔断与 $guardNode 兜底必须都还在(别把整段 1b) 一起删)', () => {
  const cbLines = codeLoop.filter((l) => /cost-breaker\.mjs/.test(l))
  assert.ok(cbLines.length >= 1, '成本熔断调用不见了 —— 删闸时把 1b) 整段删掉了?')
  assert.ok(
    /^\s*\$guardNode\s*=/m.test(stripPsComments(rawLoop)),
    '$guardNode(node 绝对路径兜底)不见了 —— 成本熔断在服务上下文(LocalSystem)会取不到 node',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
