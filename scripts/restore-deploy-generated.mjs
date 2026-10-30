// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ff-only 前置:把"构建在自己树上重生成的派生态"与"上游已跟踪而同路径本地是未跟踪副本"这两型
// 让位动作机械化(2026-10-19 立)。
//
// 立因(当天现读):生产签出 D:\DevEnv\ihui-prod 落后 origin/main 57 枚、部署环每 60s 撞
// `git merge --ff-only` 失败,判据把它写成"有未提交文件挡住 ff(不代提交不删除)"并每 4h 寄一封。
// 而那批"未提交文件"里没有一份是人在写的:PROJECT_PLAN 的回灌旧账(行级 union 落进生产树)、
// 4 枚上游已同名跟踪的 Grafana 派生大屏、sw.js / dashboard-config.generated.ts / next-env.d.ts
// 这些构建每轮自己重写的被跟踪文件。既有自愈层只治"幻影漂移"(盘上内容==该路径**某祖先版本**),
// 生成物是"比 HEAD 更新的内容",结构上永远不满足那条判据 ⇒ 这一格是全仓盲区:
// 只要构建还在自己树上落生成物,下一次 ff 就还会被同一枚文件挡死(=永久停摆,不是偶发)。
//
// 纪律(与 §12e/§5e-2 同一条):
//   · 只处理**登记过**的路径(封闭清单 scripts/data/deploy-generated-paths.json),不猜、不放宽到全树;
//     唯一例外是"内容与 tip 同一枚 blob"的未跟踪影子(2026-10-19 立):零信息损失才免登记,
//     内容不同的影子照旧要逐条授权 —— 免的是"谁来登记"这一格,不是判据本身;
//   · 每一种都先逐字节备份到批准目录,再动盘;备份失败 ⇒ 该项不动并点名;
//   · 只在这两项同时成立时复原被跟踪文件:索引==HEAD(不是别人暂存的活) ∧ 盘上≠HEAD;
//   · 未跟踪副本只在"上游 tip 已跟踪同名路径"时才让位(否则那是别人在飞的源码,一律 HANDS-OFF);
//   · 默认 dry-run,`--apply` 才写;合并进行中整轮让路。
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY = join(ROOT, 'scripts', 'data', 'deploy-generated-paths.json')
const BACKUP_ROOT = process.env.IHUI_DEPLOY_GENERATED_BACKUP || 'D:\\DevEnv\\backups\\deploy-generated'

const git = (args, cwd, allowFail = false) => {
  try {
    // 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + quotepath + 显式 stdio 由 gitRaw 同源提供。
    return gitRaw(args, cwd, { maxBuffer: 1 << 26 })
  } catch (e) {
    if (allowFail) return `__FAIL__:${String(e?.message ?? e).slice(0, 160)}`
    throw e
  }
}

export function planGeneratedYield(repoRoot, registryText, { nowMs = Date.now(), ref = 'origin/main' } = {}) {
  const reg = JSON.parse(registryText)
  const paths = (reg.paths || []).map((p) => String(p.path))
  if (paths.length === 0) return { fatal: '清单为空 ⇒ 本器物无事可做(枚举到 0 判死不记绿,§0.3)' }
  if (git(['rev-parse', '--git-dir'], repoRoot, true).startsWith('__FAIL__')) return { fatal: `${repoRoot} 不是 git 仓 ⇒ 未判定` }
  if (existsSync(join(repoRoot, '.git', 'MERGE_HEAD'))) return { fatal: '合并进行中 ⇒ 整轮让路' }

  const tipTree = new Set(
    git(['ls-tree', '-r', '--name-only', ref], repoRoot, true).startsWith('__FAIL__')
      ? []
      : git(['ls-tree', '-r', '--name-only', ref], repoRoot).split(/\r?\n/).filter(Boolean),
  )
  const porcelain = git(['status', '--porcelain=v1', '-uall'], repoRoot).split(/\r?\n/).filter(Boolean)
  const stagedBlobs = new Map(
    git(['ls-files', '-s'], repoRoot, true)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [meta, ...rest] = l.split('\t')
        return [rest.join('\t').trim(), meta.trim().split(/\s+/)[1]]
      }),
  )
  const backupDir = join(BACKUP_ROOT, new Date(nowMs).toISOString().replace(/[:.]/g, '-'))
  const actions = []
  let blocked = false

  for (const line of porcelain) {
    const xy = line.slice(0, 2)
    let rel = line.slice(3).trim()
    if (rel.includes(' -> ')) rel = rel.split(' -> ')[1].trim()
    const norm = rel.replace(/\\/g, '/')

    if (xy.includes('?')) {
      // 未跟踪:只有"上游 tip 已跟踪同名"才是 ff 的阻塞项(否则是他人在飞,绝不碰)
      if (!tipTree.has(norm)) {
        actions.push({ rel: norm, tier: 'untracked-unique', action: 'HANDS-OFF' })
        continue
      }
      const src = join(repoRoot, rel)
      if (!existsSync(src)) {
        actions.push({ rel: norm, tier: 'untracked-collides-tip', action: '盘上已无此文件(无需让位)' })
        continue
      }
      // 内容同一性优先于逐条授权(2026-10-19 立):**盘上影子与 tip 是同一枚 blob** 时,让位
      // 不丢任何一个字节 —— 装的本来就是即将合进来的那份。这一格必须与清单无关,否则每新增一枚
      // 上游文件都要先有人想到去登记才能解停摆(现读实测:生产签出被两枚 `packages/shared/src/sse/*`
      // 的未跟踪影子挡死 ff,内容与 tip 逐字节相同,而清单里没有它们 ⇒ 停摆 3 小时、每 4h 一封)。
      // 内容**不同**的影子仍然走逐条授权 —— 那才是"可能是人在写的",判据不许猜。
      // 比字节不比标签:`hash-object`(盘上)↔ `rev-parse tip:path`(库里),两个 oid 相等才算同内容。
      const diskOid = git(['hash-object', '--', src], repoRoot, true).trim()
      const tipOid = git(['rev-parse', `${ref}:${norm}`], repoRoot, true).trim()
      if (!diskOid.startsWith('__FAIL__') && !tipOid.startsWith('__FAIL__') && diskOid === tipOid) {
        const dst = join(backupDir, 'untracked__' + norm.replace(/[\\/]/g, '__'))
        actions.push({
          rel: norm,
          tier: 'untracked-collides-tip',
          action: '备份后让位(内容与 tip 同一枚 blob)',
          backup: dst,
          reason: `未跟踪影子与 ${ref} 的该路径逐字节相同(hash-object↔rev-parse 两 oid 相等)⇒ 让位零信息损失`,
        })
        continue
      }
      // 授权是**逐条**的:只有清单里显式写了 untrackedCollide 的路径(或目录前缀)才允许让位
      const grant = reg.paths.find(
        (p) => p.untrackedCollide === true && (norm === String(p.path).replace(/\\/g, '/') || norm.startsWith(String(p.path).replace(/\\/g, '/') + '/')),
      )
      if (!grant) {
        actions.push({ rel: norm, tier: 'untracked-collides-tip', action: '不动(清单未授予 untrackedCollide ⇒ 交人工)' })
        blocked = true
        continue
      }
      const dst = join(backupDir, 'untracked__' + norm.replace(/[\\/]/g, '__'))
      actions.push({ rel: norm, tier: 'untracked-collides-tip', action: '备份后让位', backup: dst, reason: grant.reason })
      continue
    }

    const listed = reg.paths.find((p) => String(p.path).replace(/\\/g, '/') === norm)
    if (!listed) {
      actions.push({ rel: norm, tier: 'tracked-dirty-unlisted', action: '不动(不在封闭清单 ⇒ 可能是真人在写)' })
      blocked = true
      continue
    }
    const headBlob = git(['rev-parse', `HEAD:${norm}`], repoRoot, true)
    const idxBlob = stagedBlobs.get(rel) || stagedBlobs.get(norm)
    const indexClean =
      !headBlob.startsWith('__FAIL__') && Boolean(idxBlob) && idxBlob === headBlob.trim()
    if (!listed.trackedYield) {
      actions.push({ rel: norm, tier: 'tracked-dirty-listed-noyield', action: '不动(该条只授予 untrackedCollide,未授予 trackedYield)' })
      blocked = true
      continue
    }
    if (!indexClean) {
      actions.push({ rel: norm, tier: 'tracked-generated', action: '不动(索引≠HEAD ⇒ 暂存的是别人/别的轮的活)' })
      blocked = true
      continue
    }
    const dst = join(backupDir, 'tracked__' + norm.replace(/[\\/]/g, '__'))
    actions.push({ rel: norm, tier: 'tracked-generated', action: '备份后复原到 HEAD', backup: dst, reason: listed.reason })
  }
  return { backupDir, actions, blocked }
}

export function applyGeneratedYield(repoRoot, plan) {
  if (plan.fatal) return { skipped: plan.fatal }
  mkdirSync(plan.backupDir, { recursive: true })
  const done = []
  for (const a of plan.actions) {
    if (!a.action.startsWith('备份后')) {
      done.push({ rel: a.rel, result: a.action })
      continue
    }
    const src = join(repoRoot, a.rel)
    if (!existsSync(src)) {
      done.push({ rel: a.rel, result: '盘上已无此文件(无需让位)' })
      continue
    }
    try {
      if (a.tier === 'untracked-collides-tip') {
        copyFileSync(src, a.backup)
        rmSync(src, { force: true })
        done.push({ rel: a.rel, result: '已备份并移除' })
      } else {
        writeFileSync(a.backup, readFileSync(src))
        git(['checkout', '--', a.rel], repoRoot)
        done.push({ rel: a.rel, result: '已备份并复原到 HEAD' })
      }
    } catch (e) {
      // 备份失败绝不继续删 —— 宁可下一轮继续红,也不能让别人的活没有退路
      done.push({ rel: a.rel, result: `失败(未动盘):${String(e.message).slice(0, 120)}` })
    }
  }
  return { done }
}

function main() {
  const apply = process.argv.includes('--apply')
  const repo = process.argv.includes('--repo') ? process.argv[process.argv.indexOf('--repo') + 1] : ROOT
  const plan = planGeneratedYield(repo, readFileSync(REGISTRY, 'utf8'))
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY-RUN', repo, ...plan }, null, 1))
  if (apply && !plan.fatal) console.log(JSON.stringify({ applied: applyGeneratedYield(repo, plan) }, null, 1))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { planGeneratedYield, applyGeneratedYield }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
