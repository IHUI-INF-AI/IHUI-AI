#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:prod-bundle 影子副本对账(2026-09-24 立)
 *
 * 堵的是 §5e 那条口径的另一半:`deploy/prod-bundle/` 被 .gitignore 整目录忽略,
 * 落在里面的运维脚本**可以完全没有入库源** —— 对跟踪文件做的 grep/审计对它零覆盖,
 * "生产到底在跑哪份代码"无人可查。当天实测到的正是数据库备份这一对:
 * 服务 IHUI-PG-BACKUP 的 AppParameters 指向 deploy/prod-bundle/pg-backup-scheduler.ps1,
 * 而全仓没有任何跟踪文件写着它的逻辑。
 *
 * 采用的形态是**入库源 + 逐字节等值断言**(不是转发壳):
 * 转发壳要改生产实际执行的文件,而当天一次改道试跑里 pg_dump 出现 3.5 分钟零输出挂死
 * (旧 runner 每天 03:00 用 34 秒跑完),在解释清楚之前不把生产备份改道。
 * 所以这里只钉一件事:**两份必须逐字节相同**;谁改了其中一份忘了另一份,当场判红。
 *
 * 判据:
 *   S0 入库源必须在本机存在(登记表里有配对而仓内没源 —— 内容态真缺陷)
 *   S1 入库源必须被 git 跟踪(否则对账没有意义)
 *   S2 运行副本必须确实被忽略(否则登记过期 —— 它已在版本树里,不需要本门)
 *   S3 两侧 sha1 必须全等;不等即红并给出 diff 行数
 *   E1 (G-405,2026-09-28)**目录枚举闭合性**:递归枚举 deploy/prod-bundle/ 的实际内容,
 *      每个"脚本类"运行副本(.ps1/.cmd/.bat/.cjs/.mjs/.js/.vbs/.py/.sh/.bash)都必须在
 *      PAIRS 里有对应条目;未登记 ⇒ 新增一态 `unlisted`。
 *      **定级纪律(票面原文:要抬的是枚举面,不是把判红搬到提交链)**:默认档 `unlisted`
 *      只报数并在人读面逐条报名,不改退出码;`--strict` 才判红(exit 1)。理由:本门是
 *      blocking 且接在提交链上,而真实部署机上该目录里现存着从未登记的脚本族
 *      (deploy.ps1 / health-check.ps1 / gen-secrets.* 等,见 2026-09-28 现读)——
 *      把 unlisted 直接搬进提交链 = 部署机上每台每次提交都被拦的恒红门,唯一结局是
 *      逼人 `--no-verify` 连带废掉全部守门(§12e 与头注 S2 分流是同一条禁令)。
 *      整目录不在(非部署机 / CI / 干净检出)或枚举没跑完(截断/不可读)⇒ **未判定**并
 *      点名,不得静默读成"全部已登记"。
 *
 * 附带能力(G-405 同批,上游同族做法的本地可测部分;均为**信息面,不参与退出码**):
 *   · 目录摘要 —— 对 deploy/prod-bundle/ 内每个文件求 sha256,按路径排序聚合成一个目录
 *     摘要(排除自身 integrity 侧车 `INTEGRITY.sha256`,大小写不敏感 —— 摘要文件若参与
 *     自身哈希会自引用不收敛)。它是盲区目录的"变更指纹",供人工比对与留档;
 *   · reviewRequired —— 登记表旁的人工过目清单(REVIEW_REQUIRED),非空时在输出里
 *     逐条大声点名(带原因与提出日期)。它**不判红** —— 要人看不是违规;但账面
 *     绝不允许把它读成"已看过"。
 *
 * 2026-09-25 扩面:compose 链的 deploy.sh / health-check.sh 整份运行副本此前全仓零入库源
 * (与蓝绿链同名不同物),按本门既定形态补了入库源并登记;同时把已在
 * deploy/tests/prod-bundle-diagnose.test.mjs 里逐字节等值、却没进本门表的
 * deploy-diagnose.sh / ai-diagnose.mjs 一并登记 —— 登记表腐烂正是"门在但看不见"的成因。
 *
 * 退出码语义(2026-09-25 定,本门已进提交链 ⇒ 这一档决定它会不会变成恒红门;
 * 2026-09-28 G-405 补 --strict 一档):
 *   0 = 可判定的登记对全部等值,**或**只剩"运行副本不在本机"这一类未判定,
 *       **或**(默认档)只剩 E1 的 unlisted —— 只报数不拦提交
 *   1 = 内容态缺陷(S0 / S1 / S2 / S3)—— 在所有机器上都该判红;
 *       `--strict` 下另含 E1 unlisted(只在该档判红,默认档与提交链不判)
 *   2 = 无法判定(git 判定失败 / 文件读取失败)—— 既不记绿,也不冒充判据红
 *
 * ⚠ 为什么"运行副本不在本机"必须是 0 而不是 1(接进提交链的前提,不得回退):
 *   `deploy/prod-bundle/` 整目录被 .gitignore 忽略 ⇒ **它只存在于部署机上**。若在
 *   别的机器 / 干净 clone / CI 上因"对账对象不在"判红,后果是每一次提交都被拦,而
 *   恒红的门唯一结局是逼人 `--no-verify`,连带把其余 130+ 道守门一起作废(AGENTS §4 /
 *   §12e / 守门 77·78 各记过一次同型)。所以按**机器态 vs 内容态**分流:机器态缺失只
 *   如实打印、不改退出码;内容态缺失照判红。未判定**绝不允许静默**——原因与落点必须
 *   出现在输出里,否则这道门在非部署机上看起来"通过",而它其实什么都没看。
 *
 * 用法:node scripts/check-prod-bundle-shadow.mjs [--self-test] [--strict]
 *   --strict = 把 E1 的 unlisted 从"只报数"升级为判红(exit 1),供部署机手动问责 / CI 用;
 *   提交链上的注册块(runner id 现值,`args: []`)**刻意不带它** —— 见上方定级纪律。
 * 接线(2026-09-25 起):guardian-runner 提交链(blocking)+ 根 package.json `check:all`。
 *   刻意**不挂 stagedTriggers**:漂移的那一侧是被忽略的运行副本,它永远不会出现在
 *   暂存区里,按 staged 收窄等于把本门立门的那一型整个放过。
 * 镜像测试:node --test scripts/tests/check-prod-bundle-shadow.test.mjs
 * 紧急跳过:HUSKY_SKIP_PROD_BUNDLE_SHADOW=1
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitBinary } from './lib/face-reader.mjs'

if (process.env.HUSKY_SKIP_PROD_BUNDLE_SHADOW === '1') {
  console.log('⏭  HUSKY_SKIP_PROD_BUNDLE_SHADOW=1 — 跳过 prod-bundle 影子副本对账')
  process.exit(0)
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// §5b:git 调用一律绝对路径 —— 裸 'git' 依赖 PATH,而服务账户(LocalSystem)与交互账户的 PATH
// 不相通,钩子/计划任务里派生就会静默失败(本门的失败形态是"取不到 ⇒ 无法判定",更容易被误读成
// "两侧都没部署")。绝对路径出口只有一处:`lib/face-reader.mjs` 的 gitBinary()。
const GIT = gitBinary()

/**
 * 登记对:tracked = 入库源(必须跟踪),runner = 生产实际执行的那份(被忽略)
 *
 * 入库源落点规则(2026-09-25 收口,不得自创第二套):
 *   · runner 在 `deploy/prod-bundle/<name>` 且 `<name>` 与既有入库源同名不同物时
 *     (蓝绿链 `deploy/scripts/deploy.sh` ≠ compose 链 `deploy/prod-bundle/deploy.sh`),
 *     入库源写 `deploy/scripts/prod-bundle/<name>` —— 镜像运行副本的目录名,
 *     于是 basename 保持 1:1,grep 一个名字就能同时命中两侧。
 *   · 不冲突时直接复用既有入库源路径(如 deploy-diagnose.sh / ai-diagnose.mjs)。
 * 新增运行副本必须同时在这里登记一行:镜像测试
 * `scripts/tests/check-prod-bundle-shadow.test.mjs` 会反查"prod-bundle 里存在逐字节
 * 相同的跟踪文件却没登记"这一型(登记表腐烂正是本门此前漏掉 deploy-diagnose.sh 的成因)。
 */
export const PAIRS = [
  {
    tracked: 'deploy/win/ihui-pg-backup.ps1',
    runner: 'deploy/prod-bundle/pg-backup.ps1',
    why: '服务 IHUI-PG-BACKUP 每天 03:00 跑的 pg_dump 全库备份',
  },
  {
    tracked: 'deploy/win/ihui-pg-backup-scheduler.ps1',
    runner: 'deploy/prod-bundle/pg-backup-scheduler.ps1',
    why: '同服务的轮询壳(启动即备份 + 每日 03:00 + WAL 归档清理)',
  },
  {
    tracked: 'deploy/scripts/prod-bundle/deploy.sh',
    runner: 'deploy/prod-bundle/deploy.sh',
    why: 'compose 链一键部署(Linux/macOS);与蓝绿链 deploy/scripts/deploy.sh 是两个不同脚本',
  },
  {
    tracked: 'deploy/scripts/prod-bundle/health-check.sh',
    runner: 'deploy/prod-bundle/health-check.sh',
    why: 'compose 链部署后健康检查(带 --json,是 deploy-diagnose 的输入)',
  },
  {
    tracked: 'deploy/scripts/deploy-diagnose.sh',
    runner: 'deploy/prod-bundle/deploy-diagnose.sh',
    why: 'P2-13 诊断采集库,被 bundle deploy.sh source;此前只在 deploy/tests 自检里等值,门看不到',
  },
  {
    tracked: 'deploy/scripts/ai-diagnose.mjs',
    runner: 'deploy/prod-bundle/ai-diagnose.mjs',
    why: '部署失败时的 AI 诊断调用器(同上,与 deploy-diagnose.sh 同批接线)',
  },
  // 三个 nssm 服务的实际执行体(AppParameters 指向 deploy/prod-bundle/svc/run-*.ps1)。
  // 2026-09-26 实测 `git ls-files deploy/prod-bundle/svc/` = 0 行 ⇒ 在服务却在跑、日志在写,
  // 而全仓 grep 对它零覆盖 —— 正是 §5e 那句"等于写进盲区"的原始形态。入库源按本文件
  // 头注的落点规则镜像目录名(svc/),basename 保持 1:1。
  {
    tracked: 'deploy/scripts/prod-bundle/svc/run-api.ps1',
    runner: 'deploy/prod-bundle/svc/run-api.ps1',
    why: '服务 IHUI-API 的执行体(tsx 直跑 apps/api/src/index.ts —— 工作区源码就是线上代码)',
  },
  {
    tracked: 'deploy/scripts/prod-bundle/svc/run-web.ps1',
    runner: 'deploy/prod-bundle/svc/run-web.ps1',
    why: '服务 IHUI-WEB 的执行体(8801)',
  },
  {
    tracked: 'deploy/scripts/prod-bundle/svc/run-ai.ps1',
    runner: 'deploy/prod-bundle/svc/run-ai.ps1',
    why: '服务 IHUI-AI-SERVICE 的执行体(8803)',
  },
]

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// ── E1 / 目录摘要 / reviewRequired 的常量(G-405)─────────────────────────────
// 盲区目录的被审侧根路径(与 PAIRS 里 runner 的前缀逐字同源,T2 已钉"runner 必须落在这里")。
export const BUNDLE_REL = 'deploy/prod-bundle'
// "脚本类"扩展名 —— 按该目录 2026-09-28 的现存内容定(登记侧已含 .ps1/.sh/.mjs;
// 未登记侧现读还有 .cmd/.bat/.vbs/.py 这类同族形态可能在长)。无扩展名(cloudflared 等
// 二进制)刻意**不**进 E1 射程 —— 判"是不是运维脚本"要靠扩展名,按名字猜会把别人的
// 数据文件判成违规;它们只进目录摘要(信息面)。
export const SCRIPT_EXTS = new Set([
  '.ps1',
  '.cmd',
  '.bat',
  '.cjs',
  '.mjs',
  '.js',
  '.vbs',
  '.py',
  '.sh',
  '.bash',
])
// 目录摘要排除的自身侧车(大小写不敏感按 basename 比)。摘要若把自己的落件也算进去,
// 就得到"写摘要 ⇒ 摘要变 ⇒ 摘要文件又该更新"的自引用,永不收敛。
export const INTEGRITY_BASENAME = 'integrity.sha256'
// 人工过目清单:条目形状 { file, reason, raised }。**非空时在输出里大声点名,但不判红** ——
// "要人看"不是提交者可满足的内容态,拿它判红就是又一台恒红门(§12e);它的价值恰恰是
// 让人读面没法把"门是绿的"读成"这条已被人核过"。
export const REVIEW_REQUIRED = []

const BUNDLE_WALK_LIMITS = { maxDepth: 8, maxFiles: 2000 }

/**
 * 扩展名提取:无点(dotfile / cloudflared)与首字符即点的都不算脚本扩展。
 * 单独抽出来是因为 enumerateBundle 与"信息面"统计都判这一次,两处各写必漂移。
 */
function scriptExt(rel) {
  const base = rel.split('/').pop()
  const i = base.lastIndexOf('.')
  return i <= 0 ? '' : base.slice(i).toLowerCase()
}

/**
 * E1:递归枚举 deploy/prod-bundle/ 的**实际内容**,把每个脚本类运行副本对登记表核一遍。
 * 立票理由(2026-09-28 现读):旧实现 `readdirSync` 出现 **0 次** —— 它只比登记表里
 * 配对的两份,一个没登记的脚本躺在盲区目录时本门结构上全盲;镜像 T4 也只在"存在逐字节
 * 相同的跟踪文件"时才发现漏登记,而"运行副本压根没有入库源"这一型(T4 的反查要求
 * sha 命中某个跟踪 blob)永远不成立 —— 两把尺子互相指认,那一格无人看守。
 *
 * 三条守卫(§26 junction 穿透事故 + 守门 114"空扫=覆盖归零"同族):
 *  · 重解析点(符号链接 / junction)**不跟随也不点名**,只计数 —— 穿过链接去枚举/操作
 *    真实目标等于替别的落点做决定;
 *  · 深度 / 文件数超预算 ⇒ truncated=true,调用方必须把它当**未判定**,不得据此出
 *    "全部已登记"的结论(枚举截断的目录里"没发现"与"没有"同形);
 *  · 子目录不可读 ⇒ 记入 unreadable 并同样落未判定。
 *
 * 返回 { present, unlisted:[完整相对路径], scriptFiles, registeredOnDisk,
 *        skippedReparse, unreadable, truncated }
 */
export function enumerateBundle(root, pairs) {
  const bundleAbs = join(root, ...BUNDLE_REL.split('/'))
  const out = {
    present: existsSync(bundleAbs),
    unlisted: [],
    scriptFiles: 0,
    registeredOnDisk: 0,
    skippedReparse: 0,
    unreadable: [],
    truncated: false,
  }
  if (!out.present) return out
  const registered = new Set(pairs.map((p) => p.runner))
  const files = []
  const walk = (dirAbs, dirRel, depth) => {
    let ents
    try {
      ents = readdirSync(dirAbs, { withFileTypes: true })
    } catch (e) {
      out.unreadable.push(`${dirRel || BUNDLE_REL} :: ${(e && e.code) || e}`)
      return
    }
    for (const d of ents) {
      const rel = dirRel ? `${dirRel}/${d.name}` : d.name
      const abs = join(dirAbs, d.name)
      // isSymbolicLink() 对 Windows junction 同样报 true(§26 实测),不跟随。
      if (d.isSymbolicLink()) {
        out.skippedReparse += 1
        continue
      }
      if (d.isDirectory()) {
        if (depth + 1 > BUNDLE_WALK_LIMITS.maxDepth) {
          out.truncated = true
          continue
        }
        if (files.length >= BUNDLE_WALK_LIMITS.maxFiles) {
          out.truncated = true
          return
        }
        walk(abs, rel, depth + 1)
        continue
      }
      if (!d.isFile()) continue
      files.push(rel)
    }
  }
  walk(bundleAbs, '', 0)
  if (files.length >= BUNDLE_WALK_LIMITS.maxFiles) out.truncated = true
  for (const rel of files) {
    if (!SCRIPT_EXTS.has(scriptExt(rel))) continue
    out.scriptFiles += 1
    const fullRel = `${BUNDLE_REL}/${rel}`
    if (registered.has(fullRel)) out.registeredOnDisk += 1
    else out.unlisted.push(fullRel)
  }
  out.unlisted.sort()
  return out
}

/**
 * 整目录内容摘要(信息面):每个文件 sha256,按路径排序聚合成目录摘要;排除自身
 * 侧车 INTEGRITY_BASENAME。任何文件读不到 / 枚举截断 ⇒ digest=null 并如实报状态,
 * 绝不拿"半个集合"出一个看起来完整的哈希。
 */
export function bundleDigest(root) {
  const bundleAbs = join(root, ...BUNDLE_REL.split('/'))
  const r = {
    present: existsSync(bundleAbs),
    digest: null,
    fileCount: 0,
    excludedIntegrity: 0,
    skippedReparse: 0,
    unreadable: [],
    truncated: false,
  }
  if (!r.present) return r
  const files = []
  const walk = (dirAbs, dirRel, depth) => {
    let ents
    try {
      ents = readdirSync(dirAbs, { withFileTypes: true })
    } catch (e) {
      r.unreadable.push(`${dirRel || BUNDLE_REL} :: ${(e && e.code) || e}`)
      return
    }
    for (const d of ents) {
      const rel = dirRel ? `${dirRel}/${d.name}` : d.name
      const abs = join(dirAbs, d.name)
      if (d.isSymbolicLink()) {
        r.skippedReparse += 1
        continue
      }
      if (d.isDirectory()) {
        if (depth + 1 > BUNDLE_WALK_LIMITS.maxDepth) {
          r.truncated = true
          continue
        }
        if (files.length >= BUNDLE_WALK_LIMITS.maxFiles) {
          r.truncated = true
          return
        }
        walk(abs, rel, depth + 1)
        continue
      }
      if (!d.isFile()) continue
      if (d.name.toLowerCase() === INTEGRITY_BASENAME) {
        r.excludedIntegrity += 1
        continue
      }
      files.push({ rel, abs })
    }
  }
  walk(bundleAbs, '', 0)
  if (files.length >= BUNDLE_WALK_LIMITS.maxFiles) r.truncated = true
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  const manifest = []
  for (const f of files) {
    try {
      manifest.push(`${f.rel}\t${sha256(readFileSync(f.abs))}\n`)
    } catch (e) {
      r.unreadable.push(`${f.rel} :: ${(e && e.code) || e}`)
    }
  }
  r.fileCount = files.length
  if (r.unreadable.length > 0 || r.truncated) return r // 集合不完整 ⇒ 不出摘要
  r.digest = sha256(Buffer.from(manifest.join(''), 'utf8'))
  return r
}

/** reviewRequired 的点名行(纯函数:判据与自检共用同一份输出形态,不各写一遍)。 */
export function reviewLines(items) {
  return items.map(
    (it) =>
      `  👁 reviewRequired ${it.file}: ${it.reason}(提出 ${it.raised ?? '日期未记'})` +
      ' —— 这条要**人工过目**;本门不代判红,但账面不得把它读成"已看过"。',
  )
}

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
      // 2026-10-04 改(修一条把本门整体打成"无法判定"的真缺陷):
      // 原值 `'pipe'` **三个位置都是 'pipe'** —— 而本机派生 git 的既有判据是
      // 「**stdin 管道由谁建**:Node 建的必挂 EBUSY,OS 句柄直传的没事」。
      // `check-ignore -q` 不吃 stdin ⇒ 正确写法是 `['ignore','pipe','pipe']`。
      //
      // 症状链(实测 2026-10-04 复跑,门输出逐字):
      //   EBUSY ⇒ catch ⇒ `e.status === 1` 不成立(e.status 是 null 而非 1)
      //   ⇒ 返回 null(无法判定)⇒ 9 对运行副本全部"无法判定"
      //   ⇒ 门末"❌ 有 9 对无法判定 —— 不记为通过" ⇒ 本门在提交链上恒红。
      // 而真因是**派生通道**,与"入库源↔运行副本是否等值"毫无关系 ——
      // 读输出的人只会去查那 9 个脚本,方向从第一步就错了。
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20000,
      windowsHide: true,
    })
    return true
  } catch (e) {
    return e.status === 1 ? false : null // 1 = 确实未被忽略;其余 = 无法判定
  }
}

/**
 * 返回 { ok, undetermined, unverifiable, unlisted, bundleUndetermined, reviewCount, lines }
 * —— 不在判据内直接 exit,便于 self-test 复用
 *
 * 两个"未判定"计数器**必须分开**,因为它们对应两件不同的事:
 *   undetermined  = 机器态(运行副本不在本机)⇒ 不改退出码,只如实打印
 *   unverifiable  = 问不到 git / 读不到文件   ⇒ exit 2,既不记绿也不冒充判据红
 * 把它们合成一个数,就等于在"非部署机"和"git 坏了"之间选一个错法:前者会让每次提交被拦,
 * 后者会让一道门在什么都没看到时宣布通过。
 *
 * opts.review 缺省取模块级 REVIEW_REQUIRED —— 自检/镜像测试可以喂构造清单证明"非空必点名",
 * 而不必往真实登记表里塞条目(登记表是有语义的,不能当测试夹具用)。
 */
export function audit(root, pairs, opts = {}) {
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
  // ── E1 目录枚举闭合性(G-405)────────────────────────────────────────────
  // 注意输出前缀刻意用 ⚠/ℹ 而不是 ✅ —— 镜像 T3 按 "✅ 行数 + undetermined == 登记对数"
  // 核账,E1 若产出 ✅ 行会把那本账顶歪(该约束由镜像形状锁 T9 钉住)。
  const en = enumerateBundle(root, pairs)
  let bundleUndetermined = 0
  if (!en.present) {
    lines.push(
      `  ⚠ E1 未判定:${BUNDLE_REL}/ 整目录不在本机 ⇒ 枚举面无从运行` +
        '(非部署机 / CI / 干净检出,属机器态,不判红)—— 这不是"全部已登记",是这台机什么都没看',
    )
    bundleUndetermined += 1
  } else if (en.truncated || en.unreadable.length > 0) {
    lines.push(
      `  ⚠ E1 未判定:${BUNDLE_REL}/ 枚举没有跑完(truncated=${en.truncated},` +
        `不可读 ${en.unreadable.length} 处:${en.unreadable.slice(0, 5).join(' | ')})` +
        ' ⇒ 不得据半个集合出"全部已登记"的结论',
    )
    bundleUndetermined += 1
  } else {
    for (const rel of en.unlisted) {
      lines.push(
        `  ⚠ E1 未登记运行副本 ${rel} —— 盲区目录里躺着脚本族而登记表无条目` +
          '(§5e 原话"只落运行副本 = 写进盲区");默认档只报数不判红,--strict 判红',
      )
    }
    if (en.unlisted.length === 0) {
      lines.push(
        `  ℹ E1 枚举闭合:${BUNDLE_REL}/ 的 ${en.scriptFiles} 个脚本类运行副本全部在登记表上` +
          `(重解析点已排除 ${en.skippedReparse} 处,不计不判)`,
      )
    }
  }
  // ── reviewRequired 点名(非空必大声,判红不得由本门代做)─────────────────
  const review = opts.review === undefined ? REVIEW_REQUIRED : opts.review
  for (const l of reviewLines(review)) lines.push(l)
  return {
    ok,
    undetermined,
    unverifiable,
    unlisted: en.unlisted,
    bundleUndetermined,
    reviewCount: review.length,
    lines,
  }
}

/**
 * 退出码聚合(纯函数 + 构造输入即可验,不依赖本机有没有 deploy/prod-bundle)。
 * 次序是有意的:问不到 git 时,任何"红/绿"结论都不成立 ⇒ 先 2;
 * 有内容态缺陷 ⇒ 1;只剩机器态未判定 ⇒ 0(但输出里必须已把它打印出来)。
 * opts.strict(G-405)只把 E1 的 unlisted 从"报数"升成 1 —— 默认档不升,理由写在头注
 * 定级纪律里;机器态(目录不在/枚举没跑完)即使在 --strict 下也**不**判红:strict 问责的
 * 是"内容没登记",不是"这台机没部署"。
 */
export function decide(res, opts = {}) {
  if (res.unverifiable > 0) return { code: 2, kind: 'unverifiable' }
  if (!res.ok) return { code: 1, kind: 'violation' }
  if (opts.strict && (res.unlisted ?? []).length > 0) return { code: 1, kind: 'unlisted' }
  if (res.undetermined > 0 || (res.bundleUndetermined ?? 0) > 0)
    return { code: 0, kind: 'undetermined' }
  return { code: 0, kind: 'clean' }
}

function selfTest() {
  const root = join(REPO, '.ihui-agent', 'tmp', 'prod-bundle-shadow-selftest')
  // 夹具必须跨轮次可重跑:上一轮的 E1/digest 用例会把 stray.ps1 / a.ps1 之类留在
  // bundle 目录里,第二轮的"全部登记 ⇒ 零 unlisted"会被自己的残留顶红(与 --allow-empty
  // 那条"第二次起恒 exit 2"同一型教训 —— 只能跑一次的取证等于没有取证)。
  rmSync(join(root, 'deploy', 'prod-bundle'), { recursive: true, force: true })
  mkdirSync(join(root, 'deploy/win'), { recursive: true })
  mkdirSync(join(root, 'deploy/prod-bundle'), { recursive: true })
  writeFileSync(join(root, '.gitignore'), 'deploy/prod-bundle/\n')
  const g = (...a) =>
    execFileSync(GIT, ['-C', root, '-c', 'safe.directory=*', ...a], {
      stdio: 'ignore',
      timeout: 60000,
      windowsHide: true,
    })
  // 提交步必须跨轮次可重跑:夹具目录被复用,第二次跑时内容已是上一轮终态 ⇒ git 回
  // "nothing to commit",而旧写法把它当异常抛出 ⇒ 本自检从第二次运行起恒 exit 2
  // (2026-09-25 实测:同日连跑两次即复现,一道只能跑一次的取证等于没有取证)。
  // 用 --allow-empty 而不是解析 git 文案 —— 文案随 locale / 版本变,判据不能靠猜。
  const gc = (msg) =>
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', msg)
  try {
    g('init', '-q', '-b', 'main')
  } catch {}
  const T = 'deploy/win/x.ps1'
  const R = 'deploy/prod-bundle/x.ps1'
  writeFileSync(join(root, T), "Write-Host 'one'\n")
  writeFileSync(join(root, R), "Write-Host 'one'\n")
  g('add', '-f', '--', '.gitignore', T)
  gc('init')
  const pairs = [{ tracked: T, runner: R, why: 't' }]
  let fails = 0
  const check = (name, cond) => {
    console.log(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) fails += 1
  }
  check('等值 ⇒ 通过', audit(root, pairs).ok === true)
  writeFileSync(join(root, R), "Write-Host 'two'\n")
  const drift = audit(root, pairs)
  check('漂移 ⇒ 判红且点名 S3', drift.ok === false && drift.lines.join('\n').includes('S3'))
  writeFileSync(join(root, R), "Write-Host 'one'\n")
  // 反方向变异:只改入库源、运行副本不动 ⇒ 同一条 S3 仍必须判红并点名 runner
  writeFileSync(join(root, T), "Write-Host 'three'\n")
  const drift2 = audit(root, pairs)
  const d2 = drift2.lines.join('\n')
  check(
    '只改入库源 ⇒ S3 仍判红且点名运行副本',
    drift2.ok === false && d2.includes('S3') && d2.includes(R),
  )
  writeFileSync(join(root, T), "Write-Host 'one'\n")
  // 把入库源从跟踪集里摘掉 ⇒ S1 必须判红(而不是"看不见就算过")
  g('rm', '--cached', '-q', '--', T)
  gc('untrack')
  check('入库源不再被跟踪 ⇒ S1 判红', audit(root, pairs).ok === false)
  g('add', '-f', '--', T)
  gc('retrack')
  check('恢复跟踪后回到绿', audit(root, pairs).ok === true)
  const missing = audit(root, [{ tracked: T, runner: 'deploy/prod-bundle/nope.ps1', why: 't' }])
  // 机器态:运行副本不在 ⇒ 未判定**且不得判红**(判红 = 非部署机每次提交被拦)
  check(
    '缺运行副本 ⇒ 未判定、不判红、打印原因',
    missing.ok === true &&
      missing.undetermined === 1 &&
      missing.unverifiable === 0 &&
      missing.lines.join('\n').includes('未判定'),
  )
  check('未判定的退出码是 0(不是 2)', decide(missing).code === 0)
  // 内容态:入库源不在 ⇒ 真缺陷,照判红(这一侧在所有机器上检出都该存在)
  const noSrc = audit(root, [{ tracked: 'deploy/win/nope.ps1', runner: R, why: 't' }])
  const ns = noSrc.lines.join('\n')
  check(
    '缺入库源 ⇒ S0 判红且不记成未判定',
    noSrc.ok === false &&
      noSrc.undetermined === 0 &&
      ns.includes('S0') &&
      ns.includes('deploy/win/nope.ps1'),
  )
  check('S0 的退出码是 1', decide(noSrc).code === 1)
  // decide 的三条分支各自独立成立(构造输入,不依赖本机形态)
  check(
    'decide:git 判不动 ⇒ 2 且优先于判红',
    decide({ ok: false, undetermined: 1, unverifiable: 1 }).code === 2,
  )
  check('decide:全等值 ⇒ 0', decide({ ok: true, undetermined: 0, unverifiable: 0 }).code === 0)
  // ── E1 目录枚举闭合性(G-405 新增;票面纪律:默认档只报数,--strict 才红)──────
  const e1Green = audit(root, pairs)
  check(
    'E1:全部登记 ⇒ 零 unlisted、不判红,闭合行必须报名(ℹ 而非 ✅,防顶歪镜像 T3 的核账)',
    e1Green.unlisted.length === 0 &&
      e1Green.ok === true &&
      e1Green.bundleUndetermined === 0 &&
      e1Green.lines.some((l) => l.startsWith('  ℹ E1')) &&
      !e1Green.lines.some((l) => l.startsWith('  ✅ E1')),
  )
  writeFileSync(join(root, 'deploy/prod-bundle', 'stray.ps1'), "Write-Host 'stray'\n")
  const e1 = audit(root, pairs)
  check(
    'E1:未登记的 .ps1 躺在盲区目录 ⇒ 必须点名完整路径,且默认档不判红(恒红纪律 §12e)',
    e1.unlisted.includes('deploy/prod-bundle/stray.ps1') &&
      e1.ok === true &&
      e1.lines.join('\n').includes('deploy/prod-bundle/stray.ps1') &&
      decide(e1).code === 0,
  )
  check(
    'E1:同一形态在 --strict 档判红(unlisted)且不改机器态语义',
    decide(e1, { strict: true }).code === 1,
  )
  const e1Fixed = audit(root, [
    ...pairs,
    { tracked: T, runner: 'deploy/prod-bundle/stray.ps1', why: 't' },
  ])
  check('E1:补登记后枚举重新闭合(红是可治的,不是恒红)', e1Fixed.unlisted.length === 0)
  rmSync(join(root, 'deploy/prod-bundle', 'stray.ps1'), { force: true })
  // 整目录不在 = 机器态:未判定 + 大声点名;即使 --strict 也不判红(strict 问责内容,不问责部署态)
  const root2 = join(root, 'nodeploy')
  mkdirSync(join(root2, 'deploy', 'win'), { recursive: true })
  writeFileSync(join(root2, T), "Write-Host 'one'\n")
  const noBundle = audit(root2, pairs)
  const nb = noBundle.lines.join('\n')
  check(
    'E1:整目录缺失 ⇒ 未判定且写明"这台机什么都没看",不判红、exit 0(默认与 strict 同)',
    noBundle.bundleUndetermined === 1 &&
      noBundle.ok === true &&
      nb.includes('E1 未判定') &&
      decide(noBundle).code === 0 &&
      decide(noBundle, { strict: true }).code === 0,
  )
  // ── 整目录内容摘要(信息面,不参与退出码)──────────────────────────────────
  const bd1 = bundleDigest(root)
  check(
    'digest:目录在且集合完整 ⇒ 出摘要并计件',
    bd1.present === true && bd1.digest !== null && bd1.fileCount === 1,
  )
  rmSync(join(root, 'deploy', 'prod-bundle'), { recursive: true, force: true })
  mkdirSync(join(root, 'deploy', 'prod-bundle'), { recursive: true })
  writeFileSync(join(root, 'deploy/prod-bundle', 'b.ps1'), 'B\n')
  writeFileSync(join(root, 'deploy/prod-bundle', 'a.sh'), 'A\n')
  const bd2 = bundleDigest(root)
  rmSync(join(root, 'deploy', 'prod-bundle'), { recursive: true, force: true })
  mkdirSync(join(root, 'deploy', 'prod-bundle'), { recursive: true })
  writeFileSync(join(root, 'deploy/prod-bundle', 'a.sh'), 'A\n')
  writeFileSync(join(root, 'deploy/prod-bundle', 'b.ps1'), 'B\n')
  const bd3 = bundleDigest(root)
  check(
    'digest:同一内容集合、不同创建顺序 ⇒ 摘要逐字相同(判内容不判落盘顺序)',
    bd2.digest !== null && bd2.digest === bd3.digest,
  )
  writeFileSync(join(root, 'deploy/prod-bundle', 'b.ps1'), 'B2\n')
  const bd4 = bundleDigest(root)
  check('digest:改一个文件 ⇒ 摘要必变(阳性对照,不是恒等哈希)', bd4.digest !== bd2.digest)
  writeFileSync(join(root, 'deploy/prod-bundle', 'INTEGRITY.sha256'), bd4.digest + '\n')
  const bd5 = bundleDigest(root)
  check(
    'digest:自身 integrity 侧车被排除 ⇒ 加它不改摘要(自引用不收敛的那一型由这条钉死)',
    bd5.digest === bd4.digest && bd5.excludedIntegrity === 1,
  )
  // ── reviewRequired(人工过目标记:非空必点名,不判红)───────────────────────
  const rv = audit(root, pairs, {
    review: [{ file: 'deploy/prod-bundle/b.ps1', reason: '示例:待核', raised: '2026-09-28' }],
  })
  check(
    'reviewRequired 非空 ⇒ 逐条大声点名(带原因/日期)且不判红、不改退出码',
    rv.reviewCount === 1 &&
      rv.ok === true &&
      rv.lines.some((l) => l.includes('reviewRequired') && l.includes('待核')) &&
      decide(rv).code === 0,
  )
  const rv0 = audit(root, pairs, { review: [] })
  check(
    'reviewRequired 为空 ⇒ 不产出 👁 行(报告面不得凭空造问题)',
    !rv0.lines.join('\n').includes('👁'),
  )
  console.log(fails === 0 ? 'self-test 全绿' : `self-test 失败 ${fails} 条`)
  process.exit(fails === 0 ? 0 : 1)
}

async function main() {
  if (process.argv.includes('--self-test')) selfTest()
  const strict = process.argv.includes('--strict')
  const res = audit(REPO, PAIRS)
  console.log(`[prod-bundle-shadow] 登记对 ${PAIRS.length} 个${strict ? ' [--strict]' : ''}`)
  for (const l of res.lines) console.log(l)
  // 整目录内容摘要:盲区目录的"变更指纹",纯信息面 —— 它判的是这台机上目录此刻的全貌,
  // 属机器状态,拿它做任何红/绿结论都会重蹈"恒红门"那一型(§12e)。留给人比对与存档。
  const dg = bundleDigest(REPO)
  if (!dg.present) {
    console.log(`ℹ 目录摘要:未判定 —— ${BUNDLE_REL}/ 整目录不在本机(盲区目录只存在于部署机)`)
  } else if (dg.digest === null) {
    console.log(
      `ℹ 目录摘要:未判定 —— 枚举未跑完(truncated=${dg.truncated},不可读 ${dg.unreadable.length} 处)` +
        ' ⇒ 不出"看起来完整"的哈希',
    )
  } else {
    console.log(
      `ℹ 目录摘要 sha256=${dg.digest}` +
        `(计入 ${dg.fileCount} 个文件,排除 integrity 侧车 ${dg.excludedIntegrity}、重解析点 ${dg.skippedReparse})`,
    )
  }
  const verdict = decide(res, { strict })
  // 机器态未判定:不改退出码,但必须喊出来 —— 沉默的"未判定"与"通过"在提交链里长得一样
  if (res.undetermined > 0) {
    console.log(
      `⚠ ${res.undetermined}/${PAIRS.length} 对**未判定**(运行副本不在本机,见上)。` +
        ' 本门只存在于部署机才有对账对象(deploy/prod-bundle/ 整目录被 .gitignore 忽略),' +
        ' 因此这一型刻意不判红 —— 按现状判红会让每一次提交被拦,连带逼掉全部守门。',
    )
    console.log('   代价是:在非部署机上本门等于没看。请在部署机(或 CI 的部署镜像)上手动跑一次。')
  }
  if (res.bundleUndetermined > 0) {
    console.log(
      '⚠ E1 枚举面**未判定**(deploy/prod-bundle/ 整目录不在本机或没枚举完,原因见上)——' +
        ' 不得把这一行读成"E1 已闭合、全部已登记"。',
    )
  }
  if (res.unlisted.length > 0) {
    console.log(
      `⚠ E1 未登记运行副本 ${res.unlisted.length} 个:` +
        res.unlisted.map((r) => `\n     · ${r}`).join(''),
    )
    console.log(
      (strict
        ? '❌ --strict 档:上面这些判红(见退出码)。'
        : '   默认档**只报数不判红** —— 本门接在提交链上,而部署机该目录里历史上就躺着从未登记的脚本族;' +
          '当场判红 = 与任何提交都无关的恒红门,唯一结局是逼人 --no-verify 连带废掉全部守门(§12e)。') +
        ' 问责/清偿入口:部署机上跑 `node scripts/check-prod-bundle-shadow.mjs --strict`;' +
        ' 修复出口只有一个 —— 在 PAIRS 加一行(入库源 + 逐字节等值随 S0–S3 自动接管)。',
    )
  }
  if (res.reviewCount > 0) {
    console.log(
      `👁 reviewRequired 非空(${res.reviewCount} 条,逐条见上方 👁 行)—— 这些必须人工过目;` +
        ' 本门的绿灯**不**等于它们已被核过。',
    )
  }
  if (verdict.code === 2) {
    console.log(`❌ 有 ${res.unverifiable} 对无法判定 —— 不记为通过`)
    process.exit(2)
  }
  if (verdict.code === 1) {
    if (verdict.kind === 'unlisted') {
      console.log('❌ --strict:存在未登记的运行副本 —— 逐条点名见上(E1)')
      console.log('   处置:为每份脚本补入库源并登记 PAIRS(§5e"必须同时落一份入库源"的尺子)')
      process.exit(1)
    }
    console.log('❌ 对账未通过 —— 逐条原因见上(漂移与登记失效是两类问题,不混为一谈)')
    console.log('   同步方向:生产执行的是被忽略的那一份,改任何一侧都要把另一侧改成逐字节相同')
    process.exit(1)
  }
  console.log(
    res.undetermined > 0 || res.bundleUndetermined > 0
      ? `✅ 本机可判定的 ${PAIRS.length - res.undetermined} 对逐字节等值(另 ${res.undetermined} 对 + E1 ${res.bundleUndetermined} 项未判定)`
      : res.unlisted.length > 0
        ? `✅ 所有登记对逐字节等值(E1 未登记 ${res.unlisted.length} 个已点名,只报数)`
        : '✅ 所有登记对逐字节等值',
  )
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
// §22d:脚本自身异常一律 exit 2(无法判定),不得以 uncaught 异常冒充判据红/绿
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ 本门自身异常(不是判据结论):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

// §22c / §22d:测试直接 import 这份实现,不再抄第二份判据(镜像常量漂移即假绿)
export const __test__ = {
  PAIRS,
  audit,
  decide,
  isTracked,
  isIgnored,
  sha1,
  sha256,
  BUNDLE_REL,
  SCRIPT_EXTS,
  INTEGRITY_BASENAME,
  REVIEW_REQUIRED,
  enumerateBundle,
  bundleDigest,
  reviewLines,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
