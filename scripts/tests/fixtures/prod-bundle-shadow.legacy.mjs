// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ⚠ 冻结快照 —— scripts/check-prod-bundle-shadow.mjs 在 **加 E1(目录枚举判据)之前**
 * 的实现原文(取自 commit 5cf842bdf7,即 G-405 立项当日的 HEAD;sha1/isTracked/isIgnored/audit
 * 四段代码内容未动 —— 仅允许经与主文件同一次 prettier 归一,2026-09-28 已机检:两侧分别
 * prettier --write 后核心段逐字节相等;除此之外**禁止演进、禁止顺手修**)。**禁止演进** ——
 * 它的唯一用途是镜像测试 T7 的旧版 A/B 对照:
 * 证明"未登记的 stray.ps1 躺在盲区目录"在旧实现下**不可见**(旧实现 readdirSync 出现 0 次,
 * 只比登记表里的对)。一旦这份快照被同步上新功能,"旧版必盲"就变成"旧版也看得见",
 * T7 就从证据退化成复读机(§22c"镜像测试只复读实现就是复读机"同型)。
 * 出处可复核:本文件剥离头尾后的核心段,与
 *   git show 5cf842bdf7:scripts/check-prod-bundle-shadow.mjs 的对应段落
 *   **各跑一次 prettier --write 后**逐字节相等(差异只允许是格式归一,不允许是语义)。
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitBinary } from '../../lib/face-reader.mjs'

const GIT = gitBinary()

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

/**
 * 三态:跟踪 / 未跟踪 / null = git 自己出错(无法判定)。
 * 旧实现把"任何异常"都当成"未跟踪",于是 git 抖动会产出与真实状态相反的 S1 红。
 */
function isTracked(root, rel) {
  try {
    execFileSync(GIT, ['-C', root, 'ls-files', '--error-unmatch', '--', rel], {
      stdio: 'ignore',
      timeout: 20000,
      windowsHide: true,
    })
    return true
  } catch (e) {
    return e.status === 1 ? false : null // 1 = 确实未跟踪;其余 = 无法判定
  }
}

/**
 * 三态:被忽略 / 未被忽略 / null = 无法判定。
 * ⚠ 这里曾有一处判据失效:`catch` 里写的是 `return e.status === 1`,而 check-ignore 的
 * 退出码 0=被忽略、1=未被忽略 —— 抛进 catch 的恰恰是 1,于是本函数对"未被忽略"也返回
 * true,S2 自上线起从未生效(镜像测试 T5 用 git add -f 把运行副本纳入版本树才逼出来)。
 * 教训同守门 77/98:**判据必须覆盖门自己产出的形态**,恒绿的门比没有门更坏。
 */
function isIgnored(root, rel) {
  try {
    execFileSync(GIT, ['-C', root, 'check-ignore', '-q', '--', rel], {
      stdio: 'pipe',
      timeout: 20000,
      windowsHide: true,
    })
    return true
  } catch (e) {
    return e.status === 1 ? false : null // 1 = 确实未被忽略;其余 = 无法判定
  }
}

/**
 * 返回 { ok, undetermined, unverifiable, lines } —— 不在判据内直接 exit,便于 self-test 复用
 *
 * 两个"未判定"计数器**必须分开**,因为它们对应两件不同的事:
 *   undetermined  = 机器态(运行副本不在本机)⇒ 不改退出码,只如实打印
 *   unverifiable  = 问不到 git / 读不到文件   ⇒ exit 2,既不记绿也不冒充判据红
 * 把它们合成一个数,就等于在"非部署机"和"git 坏了"之间选一个错法:前者会让每次提交被拦,
 * 后者会让一道门在什么都没看到时宣布通过。
 */
export function audit(root, pairs) {
  const lines = []
  let ok = true
  let undetermined = 0
  let unverifiable = 0
  for (const p of pairs) {
    const tAbs = join(root, p.tracked)
    const rAbs = join(root, p.runner)
    // 入库源不在 = 内容态真缺陷(它是跟踪文件,任何机器上检出都该在)⇒ 照判红,
    // 绝不折进"未判定" —— 那正是"把登记表里的空条目读成已通过"的那一型。
    if (!existsSync(tAbs)) {
      lines.push(`  ❌ S0 入库源 ${p.tracked} 不存在 —— 登记表有配对而仓内没有源,对账无从成立`)
      ok = false
      continue
    }
    // 运行副本不在 = 这台机不是部署机 ⇒ 未判定。把"整目录不在"与"目录在而这一份缺"
    // 分开说,因为后者在部署机上恰恰意味着"备份/部署脚本被人删了",读的人需要知道。
    if (!existsSync(rAbs)) {
      const bundleDir = existsSync(join(root, 'deploy', 'prod-bundle'))
      lines.push(
        `  ⚠ 未判定 ${p.runner} 不在本机 —— ` +
          (bundleDir
            ? 'deploy/prod-bundle/ 在而这一份缺(部署机上出现此形态 = 运行副本被删过,须人工核)'
            : 'deploy/prod-bundle/ 整目录不在 ⇒ 非部署机 / CI / 干净检出') +
          `;入库源侧 ${p.tracked} 未参与本轮比对`,
      )
      undetermined += 1
      continue
    }
    let tb
    let rb
    try {
      tb = readFileSync(tAbs)
      rb = readFileSync(rAbs)
    } catch (e) {
      lines.push(`  ⚠ 无法判定 ${p.tracked}:读取失败(${e.message})`)
      unverifiable += 1
      ok = false
      continue
    }
    const tracked = isTracked(root, p.tracked)
    const ignored = isIgnored(root, p.runner)
    if (tracked === null || ignored === null) {
      const which = tracked === null ? `ls-files ${p.tracked}` : `check-ignore ${p.runner}`
      lines.push(`  ⚠ 无法判定 ${p.tracked} ↔ ${p.runner}:git 判定失败(${which})`)
      unverifiable += 1
      ok = false
      continue
    }
    if (!tracked) {
      lines.push(`  ❌ S1 ${p.tracked} 未被 git 跟踪 —— 入库源不成立,对账没有意义`)
      ok = false
      continue
    }
    if (!ignored) {
      lines.push(`  ❌ S2 ${p.runner} 竟在版本树里 —— 登记表过期,请删掉这条登记`)
      ok = false
      continue
    }
    if (sha1(tb) !== sha1(rb)) {
      const tl = tb.toString('utf8').split('\n')
      const rl = rb.toString('utf8').split('\n')
      let diff = 0
      for (let i = 0; i < Math.max(tl.length, rl.length); i += 1) if (tl[i] !== rl[i]) diff += 1
      lines.push(`  ❌ S3 影子漂移 ${p.runner}(${diff} 行与入库源不同)`)
      lines.push(`        入库源: ${p.tracked}`)
      lines.push(`        生产跑的是被忽略的那一份 ⇒ 二者不一致时,线上行为与仓内代码无关`)
      ok = false
      continue
    }
    lines.push(`  ✅ ${p.runner} == ${p.tracked}(逐字节,${tb.length} 字节)`)
  }
  return { ok, undetermined, unverifiable, lines }
}

export const __legacy__ = { audit, isTracked, isIgnored, sha1 }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
