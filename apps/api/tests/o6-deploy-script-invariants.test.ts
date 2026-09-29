// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// O6 —— 生产部署脚本(deploy/win/ihui-deploy.ps1)的**静态判据自检**。
//
// 为什么写成静态判据:被测对象是 PowerShell 部署脚本,本机就是生产机,真跑一次会重启线上
// 服务(web/api/ai-service),绝不能作为回归手段;而这三条恰好都是"文本层面即可判定"的铁律,
// 用 AST/字符串断言钉死,比任何一次真实部署都更常跑到。风格照 o5-nginx-edge-ratelimit.test.ts
// (同一动机:跑不了目标程序的真实校验,就把可判定的结构约束落成测试)。
//
// 三条护栏对应 2026-09-23 的三处修复(当天部署环被冻结三次,脚本自身三个缺陷放大了它们):
//   ① 绝不允许出现销毁未提交内容的 git 写法 —— 宁可 FAIL 也不毁别人在飞的活儿;
//   ② ff-only 之前必须先做一次幻影漂移现场对齐(顺序可断言),否则共享工作树的脏文件会让
//      每轮 merge 直接 abort,线上永久滞留旧提交;
//   ③ 失败告警去重不再是固定的 12 小时静音 —— 轮询每 ~68s 重放同一失败,静音窗口内故障
//      只被通知 1 次(实测持续两天的故障仅通知过一次);改为到点周期性重发。
//
// 交付验收口径是 `node --test apps/api/tests/o6-deploy-script-invariants.test.ts`(不连 DB、不起
// Fastify)。但 apps/api 的 `vitest run` 也会按 tests/**/*.test.ts 把本文件收集进去,而 node:test
// 注册的用例 vitest 看不见 ⇒ 它会报 "No test suite found" 把整个 api 套打红。所以注册入口按宿主
// 选择:vitest 进程里用 vitest 自己的 describe/it,其余场景用 node:test。断言一律走 node:assert,
// 两边语义一致(抛出即失败)。

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface Registry {
  describe: (name: string, fn: () => unknown) => unknown
  it: (name: string, fn: () => unknown) => unknown
}
const registry: Registry = process.env.VITEST
  ? ((await import('vitest')) as unknown as Registry)
  : (nodeTest as unknown as Registry)
const { describe, it } = registry

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const DEPLOY_PS1 = resolve(REPO_ROOT, 'deploy/win/ihui-deploy.ps1')
const src = readFileSync(DEPLOY_PS1, 'utf8')

/** 取 `function <name> { ... }` 的大括号配对正文(脚本内字符串无孤立花括号)。 */
function fnBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `未找到 function ${name}(函数被改名或删除会使本护栏失明)`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error(`function ${name} 的花括号未闭合`)
}

describe('O6 部署脚本静态判据(deploy/win/ihui-deploy.ps1)', () => {
  it('① 永不出现销毁未提交内容的 git 写法(reset --hard / clean -f* / checkout . / restore .)', () => {
    // 整份源码逐一比对:连注释里都不许出现这些字面量 —— 注释一旦写下这些命令,下一步就是有人复制执行。
    const forbidden: Array<[string, RegExp]> = [
      ['reset --hard(会连带回滚他人未提交改动)', /\breset\b[^\n]*--hard/],
      ['clean -f*(删除未跟踪文件)', /\bclean\b[^\n]*\s-[^\s]*f/],
      ['checkout . (全树检出覆盖工作区)', /\bcheckout\b[^\n]*\s(\.|--\s*\.)(\s|$)/],
      ['restore . (全树检出覆盖工作区)', /\brestore\b[^\n]*\s(\.|--\s*\.)(\s|$)/],
    ]
    for (const [label, re] of forbidden) {
      const hit = src.split(/\r?\n/).find((line) => re.test(line))
      assert.equal(hit, undefined, `部署脚本出现 ${label}:${hit?.trim()}`)
    }
    // 反向对照:合法的"逐路径还原被构建改写的已跟踪文件"必须仍被允许(否则本条判据过严)
    assert.match(
      src,
      /checkout\s+--\s+apps\/web\/next-env\.d\.ts/,
      '既有的按路径还原写法不应被误判',
    )
  })

  it('② ff-only 之前确实存在一次幻影漂移对齐(--align-drift,真对齐不是 dry-run)', () => {
    // 自愈脚本与其参数必须真的被调用(不是只写在注释里)
    assert.match(src, /heal-worktree-tracked\.mjs/, '未引用保守自愈脚本')
    const aligner = fnBody(src, 'Invoke-WorktreeAlign')
    assert.match(
      aligner,
      /['"]--align-drift['"]/,
      '对齐函数未把 --align-drift 作为实参传给自愈脚本',
    )
    // 部署路径必须是真对齐;dry-run 只报数等于没对齐(-diagnose 里让人手跑 dry-run 的提示不在此列)
    assert.ok(
      !/--dry-run/.test(aligner),
      'Invoke-WorktreeAlign 带了 --dry-run ⇒ 只报数不对齐,故障照旧',
    )
    // 顺序断言:主流程 `if ($behind -gt 0)` 块内,对齐调用必须出现在 merge --ff-only 之前
    const blockStart = src.lastIndexOf('if ($behind -gt 0) {')
    assert.notEqual(blockStart, -1, '未找到主流程 behind>0 的合并块')
    const block = src.slice(blockStart)
    const alignIdx = block.indexOf('Invoke-WorktreeAlign')
    const ffIdx = block.indexOf('merge --ff-only')
    assert.ok(alignIdx > -1, '合并块内没有现场对齐调用')
    assert.ok(ffIdx > -1, '合并块内找不到 ff-only 调用')
    assert.ok(alignIdx < ffIdx, `对齐必须早于 ff-only(实际 align=${alignIdx} > ff=${ffIdx})`)
    // 对齐后仍脏必须是"报清楚再 FAIL",不得静默继续
    assert.match(src, /BLOCKED-WIP/, '缺少 BLOCKED-WIP 成因标记')
  })

  it('③ 告警去重不是固定的 12 小时静音,而是到点周期性重发', () => {
    const body = fnBody(src, 'Invoke-FailNotify')
    assert.ok(!/\b12\b/.test(body), 'Invoke-FailNotify 里仍残留 12(小时)的静音窗口')
    assert.ok(!/12h\s*内已推过/.test(src), '旧的"12h 内已推过,跳过"文案仍在,说明又回到固定静音')
    // 存在"小时级重发周期"常量,且值是 4(不是按天/按 12 小时)
    assert.match(src, /^\$FailAlertRepeatHours\s*=\s*4\s*$/m, '缺少 4 小时级别的重发周期常量')
    // ⚠️ 锚点 2026-09-29 跟着脚本改形:判龄比较被抽进了共享出口 `deploy/win/alert-dedup.ps1`
    // 的 `Test-AlertDueByIdentity`(参数名 `-RepeatHours`),所以"比较式在 Invoke-FailNotify 体内"
    // 这个旧形状**已经不存在**,而行为一条没少。只认调用侧传参 = 传了也可能白传,
    // 因此这里把两端都钉住:调用侧必须把常量交出去 **+** 共享出口必须真的拿它去比。
    // 任一侧被改回"固定静音窗口",两条里必有一条红 —— 这比旧的一条断言更严,不是放宽。
    assert.match(
      body,
      /(?:-lt\s+\$FailAlertRepeatHours|-RepeatHours\s+\$FailAlertRepeatHours)/,
      '同签名判定未把重发周期常量交给判据(等于没有到点重发)',
    )
    const dedupSrc = readFileSync(resolve(REPO_ROOT, 'deploy/win/alert-dedup.ps1'), 'utf8')
    assert.match(
      dedupSrc,
      /\[Parameter\(Mandatory\s*=\s*\$true\)\]\[double\]\$RepeatHours/,
      '共享去重出口不再收重发周期参数 ⇒ 调用侧传了也没用',
    )
    assert.match(
      dedupSrc,
      /\$ageH\s*-lt\s+\$RepeatHours/,
      '共享去重出口没有用重发周期去比龄 ⇒ 回退成固定静音窗口(本条要防的原始缺陷)',
    )
    // 签名变化必须绕过去重直接发:去重条件里必须比对签名。
    // 同上一条的改形:比对已从调用点的 `$state.sig -eq $sig` 变成共享出口里的**按签名分槽**
    // (`Get-AlertDedupKey -Sig` ⇒ `$map.ContainsKey($key)`),所以两条都要钉:调用侧交出签名、
    // 出口侧真的按签名取槽 —— 只钉一条就会让"传了签名但整表当一个槽用"那种回潮溜过去。
    assert.match(body, /-Sig\s+\$sig/, 'Invoke-FailNotify 没把签名交给去重出口')
    assert.match(dedupSrc, /Get-AlertDedupKey\s+-Sig\s+\$Sig/, '去重出口不再按签名算键')
    // 压住也要查得清:被去重那条必须给出 window-hit 决策与"压住的是哪件事"(身份 + 摘要)。
    // 否则"这段时间压住了几件不同故障"从日志结构上判不出 —— 本仓被这条咬过一次:一次 2h39m 的
    // 生产崩溃循环被一条"这是预期现象"的无限期抑制掩成没人收信(抑制必须有理由、有终态)。
    assert.match(dedupSrc, /Decision\s*=\s*'window-hit'/, '去重不再区分"压住"与其他 ⇒ 掩盖量不到')
    assert.match(dedupSrc, /本轮跳过 \| 身份=\$key/, '被压住的告警不点名身份 ⇒ 抑制变成静默')
    assert.match(
      dedupSrc,
      /\$map\.ContainsKey\(\$key\)/,
      '去重不再按签名分槽 ⇒ 换了新故障也会被静音',
    )
    assert.match(dedupSrc, /repeatNo/, '未记录重发序号 ⇒ 正文无法说明"故障还在发生"')
  })

  it('④ 配套:健康门禁探测令牌本轮缓存,限流/不可达不得判为部署失败', () => {
    // 登录降频:令牌有本轮缓存 + 尝试上限,只有 401/403 才强制重登
    assert.match(src, /\$script:HcToken/, '探测令牌没有本轮缓存(会逐轮重登 admin)')
    assert.match(src, /\$script:HcLoginTries\s*-ge\s*\d+/, '登录缺少整轮尝试上限(失败时会逐轮重试)')
    assert.match(src, /Get-HcToken\s+-Force/, '缺少"仅令牌失效才重登"的强制刷新入口')
    // 三态判定:429 与传输不可达 → unknown,不参与"判定失败"
    const probe = fnBody(src, 'Invoke-Probe')
    assert.match(probe, /-eq\s+429/, '未把 HTTP 429 单独归类为未知')
    assert.match(probe, /Verdict\s*=\s*'unknown'/, '缺少 unknown 三态')
    const gate = fnBody(src, 'Test-HealthGate')
    assert.match(gate, /lastFails\.Count\s*-gt\s*0/, '门禁耗尽时未按"有无明确失败项"区分结论')
    assert.match(gate, /return\s+\$true/, '未知项未按放行处理(把限流当失败会造成无谓回滚)')
    // 但成功条件不得放宽:必须三项全部 pass 才算通过
    assert.match(
      gate,
      /fails\.Count\s*-\s*eq\s*0\s*-and\s*\$?unknown\.Count\s*-\s*eq\s*0/,
      '全绿判据被削弱',
    )
  })

  it('⑤ ff 失败按 git 自述原因分类;BLOCKED-WIP 只许点名"脏∩本次要改",不得拿脏文件数当成因', () => {
    // 2026-09-24 实测事故:本地 0 领先 / 24 落后以外的真分叉场景下,git 报的是
    // "Not possible to fast-forward",但旧代码只判断"树上有没有脏文件",于是把结论写成
    // "有真人在写,等对方收尾"(并列出全部 41 个无关脏文件)。排查因此被带去清扫工作树,
    // 白耗 1.5h,还寄出一封错因告警。三条断言各钉住这个缺陷的一面。
    // ⚠️ 锚点 2026-09-29 跟着"钉住远端显式 sha"那次改动更新:合并目标从 `FETCH_HEAD` 换成了
    // 本轮钉住的 `$remoteTip`(那是修一条真实竞态,不是回归),而三条断言量的东西一条没变。
    // 旧锚点写死 FETCH_HEAD ⇒ 那次正当改动一落地,本条就红成"脚本不再识别 git 的分叉原话",
    // 把**测试的锚点过期**说成**脚本的回归** —— 两种错法后果相同(下一个人去改脚本而不是改锚点),
    // 所以这里既改锚,也把"锚点找不到"与"判据消失"分成两条不同的话。
    const anchor = /&\s*git merge --ff-only\s+\$\w+|&\s*git merge --ff-only\s+FETCH_HEAD/
    const mAnchor = src.match(anchor)
    assert.ok(
      mAnchor,
      '找不到 ff-only 合并调用 ⇒ 本条锁的锚点过期(脚本改形),不是脚本回归:先看脚本,再改锚,别削断言',
    )
    const branch = src.slice(mAnchor!.index!)
    const iDiv = branch.search(/Not possible to fast-forward/)
    const iWip = branch.indexOf('Report-BlockedWip')
    assert.ok(iDiv >= 0, '部署脚本已不再识别 git 的分叉原话(误诊回归)')
    assert.ok(iWip >= 0, 'BLOCKED-WIP 归因路径消失')
    assert.ok(iDiv < iWip, '分叉判定必须排在 WIP 判定之前 —— 反序就会重演今天的误诊')

    // WIP 一支必须喂"交集",不得再喂全量脏文件
    const wipCall = branch.slice(iWip, iWip + 220)
    assert.match(wipCall, /\$blockers/, 'BLOCKED-WIP 又退回把全部脏文件列成阻塞项')
    assert.doesNotMatch(wipCall, /-Entries\s+\$stillDirty/, '把无关脏文件当成阻塞项(旧缺陷形态)')
    // 交集的两个来源都得真在算,否则 $blockers 是凭空来的
    assert.match(
      branch,
      /\$mustTouch\s*=\s*@\(&\s*git(?:\s*-C\s+\$\w+)?[\s\S]{0,120}diff --name-only HEAD\s+(?:FETCH_HEAD|\$\w+)/,
    )
    assert.match(
      branch,
      /\$blockers\s*=\s*@\(\$dirtyPaths\s*\|\s*Where-Object\s*\{\s*\$mustTouch\s*-contains\s+\$_\s*\}\)/,
    )

    // 三条出口都不得静默:未归类分支也要 Fail,且要吐出 git 原文
    const unknown = branch.slice(branch.indexOf('merge 失败成因未归类'))
    assert.ok(unknown.length > 0, '未归类分支消失(会退回"看起来全绿")')
    assert.match(unknown, /Fail\s+"git merge --ff-only[ 不]*失败/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
