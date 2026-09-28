// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §15b 备份落点的**非导入出口**:给那些"按层序不得 import repo-tooling"的调用方一个可复制的路径。
 *
 * 为什么要有这个文件(而不是让调用方直接 import `gitArchiveDir()`):
 * 架构契约表(`config/architecture-policy.yaml`)的层序是
 * `contract(10) ← platform(20,含 packages/database) ← composite(30,含 shared) ← product(40) ← tooling(90)`,
 * 规则是"rank 小的可被 rank 大的依赖,反向即违规"。`packages/database/seed/migrate-overseas-images.ts`
 * 要写一份事前备份,它既不得 import 本层(守门 103 实测判 D1/D2/D3 红),也不得自己硬编码盘符
 * (§15b 明令禁止,本机已因此吃过"备份解析到不存在路径 ⇒ git-guardian 的 backupOk:false 静默失效")。
 * 所以落点由这里交出去、由调用方作为**入参**接收 —— 与本仓 §5d 的
 * `node scripts/secret-path.mjs <子目录> <文件名>` 是同一条设计(非导入上下文的唯一出口)。
 *
 * 用法:
 *   node scripts/archive-dir.mjs                  # 打印 <backups>/sql/image-source-migration
 *   node scripts/archive-dir.mjs --kind git        # 打印 <backups>/git(gitdir 现场归档落点)
 *   node scripts/archive-dir.mjs --kind pg         # 打印 <backups>/pg
 * stdout 恒为**一行路径或空**,诊断只写 stderr ⇒ 调用方可以 `X="$(node scripts/archive-dir.mjs)"`。
 * 退出码:0 交出落点 / 1 解析不到(盘符推导失败,属"要先修环境")/ 2 参数或工具自身异常(**无法判定**,不得读成"没有落点")。
 * 本工具**不建目录、不写文件** —— 建目录是调用方的事(mkdirSync recursive),这里只答"该落在哪"。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { gitArchiveDir } from './lib/gitdir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** kind → backups 根下的子路径。只登记**已被真实写入方使用**的,不得先建表再等人用。 */
const KINDS = {
  'image-source-migration': ['sql', 'image-source-migration'],
  sql: ['sql'],
  git: ['git'],
  pg: ['pg'],
  deploy: ['deploy'],
  env: ['env'],
}

export function archiveDirFor(kind, worktree = ROOT) {
  const sub = KINDS[kind]
  if (!sub) {
    // cause 分两档:参数错是"调用方写错了"(改调用),交不出根是"环境不可达"(先修环境)。
    // 混成一档会让人把"问错了"读成"没有落点"。
    return {
      path: null,
      cause: 'bad-arg',
      reason: `未知 kind:${kind}(在表里的:${Object.keys(KINDS).join(', ')})`,
    }
  }
  const gitArch = gitArchiveDir(worktree)
  if (!gitArch) {
    return {
      path: null,
      cause: 'unresolved',
      reason: 'gitArchiveDir() 未交出备份根(工作树所在盘不可达或仓库根解析失败)',
    }
  }
  // <X>/DevEnv/backups/git → <X>/DevEnv/backups,再拼目标子路径
  const backupsRoot = gitArch.replace(/\\/g, '/').replace(/\/+$/, '').replace(/\/git$/, '')
  return { path: [backupsRoot, ...sub].join('/'), cause: null, reason: null }
}

function main() {
  const args = process.argv.slice(2)
  const ki = args.indexOf('--kind')
  const kind = ki >= 0 ? args[ki + 1] : 'image-source-migration'
  if (ki >= 0 && !kind) {
    console.error('用法:--kind <image-source-migration|sql|git|pg|deploy|env>(缺省 image-source-migration)')
    process.exit(2)
  }
  let res
  try {
    res = archiveDirFor(kind, resolve(ROOT))
  } catch (e) {
    console.error('无法判定:' + String((e && e.message) || e).slice(0, 200))
    process.exit(2)
  }
  if (!res.path) {
    console.error(
      (res.cause === 'bad-arg' ? '参数错误:' : '判不出落点:') +
        res.reason +
        ' —— 不得据此回退到仓库内或网盘(§15b)',
    )
    process.exit(res.cause === 'bad-arg' ? 2 : 1)
  }
  process.stdout.write(res.path + '\n')
}

// §22d:被 import 时不得跑 main(它按结论 process.exit,会把调用方的进程一起带走)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { archiveDirFor, KINDS, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
