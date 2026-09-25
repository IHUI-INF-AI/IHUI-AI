// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 密钥库根目录解析 —— 按"存在即真"跨盘符探测,不信文档里写死的盘符。
 *
 * 为什么要有这一层(2026-09-24 立):AGENTS.md §5d 与两处脚本都把权威密钥库写成
 * `D:/BaiduSyncdisk/密钥/...`,而本机真实库在 **F 盘**,D 盘该路径根本不存在。
 * 路径过期的表现不是"文件不存在",而是**下游门禁恒红**:镜像活性探测读不到 gitee key,
 * 于是报"国内镜像停摆",把整条排查方向带到"key 失效"上去 —— 与"凭据/路径过期只以
 * 下游门禁失败形态出现"同族。所以解析必须容错,而不是把盘符再抄一遍。
 *
 * 候选盘序固定、不枚举 A:–Z:`existsSync` 打到未就绪的可移动盘/网络盘会阻塞数秒,
 * 而这是守护任务每轮都要走的路径。新机器若换了盘符,用环境变量显式覆盖即可。
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** 候选盘符(按本机与历史记录排序;C 放最后是"确实哪块都没有"时的兜底) */
const CANDIDATE_ROOTS = ['F:', 'D:', 'E:', 'G:', 'C:'].map((d) => `${d}/BaiduSyncdisk/密钥`)

/** 密钥库根:环境变量优先,否则取第一个真实存在的候选盘路径。全不存在时返回 null。 */
export function resolveSecretsRoot(env = process.env) {
  const fromEnv = env.IHUI_SECRETS_ROOT
  if (fromEnv) return existsSync(fromEnv) ? fromEnv.replace(/\\/g, '/') : null
  for (const root of CANDIDATE_ROOTS) if (existsSync(root)) return root
  return null
}

/**
 * 子目录(如 `模型` / `git仓库` / `微信`)。根不存在或子目录不存在时返回 null ——
 * 调用方据此把结论降级为 `unknown`,而不是把"读不到"说成"凭据无效"。
 * 行为与签名自 A19 起为 resolveKeyDirDetailed 的降格投影(只取 path),逐字等价由
 * .ihui-agent 等价对账脚本证明;需要出处(triedCandidates/winnerIndex)时调 detailed 版,
 * **禁止**在调用方再抄一份 F→D→E→G→C 候选表(§5d)。
 */
export function resolveKeyDir(sub, env = process.env) {
  return resolveKeyDirDetailed(sub, env).path
}

/**
 * resolveKeyDir 的"值携带出处"版本(A19,唯一候选序出口)。
 * 返回 { path, triedCandidates, winnerIndex }:
 * - path:命中的子目录绝对路径,否则 null(与 resolveKeyDir 同值);
 * - triedCandidates:按探查顺序排列的候选子目录全路径,到首个存在的**根**为止
 *   (根选取不看子目录,与 resolveSecretsRoot 语义一致)——"在其之前哪些候选被跳过"即此清单;
 * - winnerIndex:命中根在候选表中的下标(一个根都没命中为 -1)。
 *   三态判读:winnerIndex === -1 ⇒ 盘没挂上/根缺失(无法判定,不等于凭据失效);
 *   winnerIndex >= 0 且 path === null ⇒ 根存在但该根下无此子目录(先建目录再放口令);
 *   path 非 null ⇒ 命中。环境变量 IHUI_SECRETS_ROOT 覆盖时候选只有该一项(winnerIndex 0 或 -1)。
 */
export function resolveKeyDirDetailed(sub, env = process.env) {
  const triedCandidates = []
  const fromEnv = env.IHUI_SECRETS_ROOT
  let root = null
  let winnerIndex = -1
  if (fromEnv) {
    triedCandidates.push(join(fromEnv, sub).replace(/\\/g, '/'))
    if (existsSync(fromEnv)) {
      root = fromEnv.replace(/\\/g, '/')
      winnerIndex = 0
    }
  } else {
    for (let i = 0; i < CANDIDATE_ROOTS.length; i++) {
      const c = CANDIDATE_ROOTS[i]
      triedCandidates.push(join(c, sub).replace(/\\/g, '/'))
      if (existsSync(c)) {
        root = c
        winnerIndex = i
        break
      }
    }
  }
  if (!root) return { path: null, triedCandidates, winnerIndex: -1 }
  const dir = join(root, sub).replace(/\\/g, '/')
  return { path: existsSync(dir) ? dir : null, triedCandidates, winnerIndex }
}

/** 子目录下的具体密钥文件;任一级不存在时返回 null。 */
export function keyFile(sub, name, env = process.env) {
  const dir = resolveKeyDir(sub, env)
  if (!dir) return null
  const file = join(dir, name).replace(/\\/g, '/')
  return existsSync(file) ? file : null
}

/** 候选盘清单(只读,供 --verify/自检与文档对账用;不复制成第二份真相的来源) */
export const SECRETS_ROOT_CANDIDATES = Object.freeze([...CANDIDATE_ROOTS])

/**
 * 通用"存在即真":从候选路径里返回第一个真实存在者(全不存在 ⇒ null)。
 * 给盘符无关的落点解析用(如 `D:/DevEnv/secrets` 与它的同族候选),
 * 免得每个调用方各自抄一份候选表 —— 抄一次就多一份真相。
 */
export function firstExisting(cands) {
  for (const p of cands) if (p && existsSync(p)) return p.replace(/\\/g, '/')
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
