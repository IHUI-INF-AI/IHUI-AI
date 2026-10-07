// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// ════════════════════════════════════════════════════════════════════════════
// psql 客户端定位 —— 全仓唯一一份实现(G-815987,2026-10-07)。
// 消费者:check-migration-bookkeeping.mjs 与 check-migration-from-zero.mjs 两道守门。
// 此前两门各写一份候选表,必然漂开:bookkeeping 的候选表缺"C 盘 Program Files 自动探测"
// 那一档,本机 PostgreSQL 18 客户端明明在位(C:/Program Files/PostgreSQL/18/bin/psql.exe,
// 服务 postgresql-x64-18 Running)却以 `spawnSync psql ENOENT` 收场,而下游把那句话
// 当成"本机没有 PostgreSQL"的存在性结论(危害不是少判几维,是把"没判"读成"判过了")。
//
// 本层只负责**机器态的目录探测**,不碰任何门的取材面与判定面(from-zero 按门 118 现读
// 是 loose-fs,共用的只是"客户端在哪"这一格)。
//
// 候选序(以票面为准):
//   ① $IHUI_PSQL(显式指路,最高优先)
//   ② $PG_CLIENT_DIR/psql.exe(部署环境注入)
//   ③ 自动探测 C:/Program Files/PostgreSQL/<版本>/bin/psql.exe(版本号数值取最大在位者)
//   ④ D:\DevEnv\runtimes\pgsql\bin\psql.exe(本仓历史约定档)
//   ⑤ PATH 上的 psql(最后回退;以 `psql --version` 实探,探不中不再假装命中 ——
//     旧写法无条件把裸 'psql' 当命中,ENOENT 被推迟到真正的查询里才炸出来)
//
// 全落空时的结论句由 psqlLocateMissText() 出:**未找到 psql 客户端(不代表本机没有
// PostgreSQL 服务)** —— 定位失败与服务缺席是两回事,措辞必须把这两者分开。
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_PG_PROGRAM_FILES = 'C:/Program Files/PostgreSQL'
const LEGACY_DEVENV_PSQL = 'D:\\DevEnv\\runtimes\\pgsql\\bin\\psql.exe'

/**
 * 枚举探测根下的 PostgreSQL 版本目录(目录名形如 `18` / `9.6`),按版本号**数值**降序排。
 * 为什么用数值而不是字符串比:`'9.6' > '18'` 按字典序成立,会把 18 的安装位让给 9.6。
 * 根不可读(readdirSync 抛错)按"没有版本目录"处理 —— 探测层不抛异常,结论交给 tried 清单说话。
 */
function pgVersionDirsDesc(root) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && /^\d+(\.\d+)*$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const pa = a.split('.').map(Number)
      const pb = b.split('.').map(Number)
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0)
        if (d) return -d
      }
      return 0
    })
}

/** PATH 档的实探:与两门后续 spawnSync 的解析方式同族(libuv 查 PATH),探得中才算命中。 */
function psqlOnPath() {
  const r = spawnSync('psql', ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r.status === 0
}

/**
 * 纯度边界:输入显式给出(env / opts),所以候选序、版本取最大、全落空清单都能用
 * 构造面证明(fixture 目录造假 bin 结构),不必赌本机此刻装没装 PG(§22c 同族)。
 * 返回 { psql, tried }:psql = 命中路径(或裸 'psql' 表示 PATH 档),全落空为 null;
 * tried = 逐条"候选(来源,结果)"的诊断清单,命中与落空都留痕。
 */
export function locatePsqlClient(env = process.env, opts = {}) {
  const pgRoot = opts.programFilesRoot ?? DEFAULT_PG_PROGRAM_FILES
  const legacyPath = opts.legacyPath ?? LEGACY_DEVENV_PSQL
  const probePath = opts.pathProbe ?? psqlOnPath
  const tried = []

  if (env.IHUI_PSQL) {
    if (existsSync(env.IHUI_PSQL)) {
      tried.push(`${env.IHUI_PSQL}($IHUI_PSQL,在位)`)
      return { psql: env.IHUI_PSQL, tried }
    }
    tried.push(`${env.IHUI_PSQL}($IHUI_PSQL,缺)`)
  }
  if (env.PG_CLIENT_DIR) {
    const candidate = join(env.PG_CLIENT_DIR, 'psql.exe')
    if (existsSync(candidate)) {
      tried.push(`${candidate}($PG_CLIENT_DIR,在位)`)
      return { psql: candidate, tried }
    }
    tried.push(`${candidate}($PG_CLIENT_DIR,缺)`)
  }
  const versions = pgVersionDirsDesc(pgRoot)
  const best = versions.length ? join(pgRoot, versions[0], 'bin', 'psql.exe') : null
  if (best && existsSync(best)) {
    tried.push(`${best}(自动探测,在位)`)
    return { psql: best, tried }
  }
  tried.push(`${join(pgRoot, '<版本>', 'bin', 'psql.exe')}(自动探测,缺)`)

  if (existsSync(legacyPath)) {
    tried.push(`${legacyPath}(约定档,在位)`)
    return { psql: legacyPath, tried }
  }
  tried.push(`${legacyPath}(约定档,缺)`)

  if (probePath()) {
    tried.push(`psql(PATH,在位)`)
    return { psql: 'psql', tried }
  }
  tried.push(`psql(PATH,探不中)`)
  return { psql: null, tried }
}

/**
 * 全落空时的结论句(唯一一份,两门的 miss 分支共用,镜像测试按它逐字锁)。
 * 「不代表本机没有 PostgreSQL 服务」必须逐字在场:G-815987 的危害正是那句 ENOENT
 * 被下游读成服务缺席的存在性结论。
 */
export function psqlLocateMissText(tried) {
  return `未找到 psql 客户端(不代表本机没有 PostgreSQL 服务),试过的候选 = ${(tried || []).join(' | ')}(可用 IHUI_PSQL / PG_CLIENT_DIR 指真身)`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
