// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「生产 checkout 根」解析的唯一出口（2026-10-30 从 `check-ops-patrol.mjs` 下沉成 lib 单源，RP-90）。
 *
 * 为什么要下沉成 lib 而不是各处再拼一次：
 *   - 同一条机器事实先前有三份拼法 —— 门体 `prodCheckoutRoot`、`lib/deploy-decisions-face.mjs` 的
 *     prod 候选、`check-prod-checkout-foreign-work.mjs` 的通道 C，各自 `join(devEnvRoot(x),'ihui-prod')`；
 *     三份必然漂开（AGENTS §0.6），而漂移的固定表现是"一侧读到线上态、另一侧永远读到未判定/影子账"。
 *   - 让 `scripts/lib/` 反过来 import 门体（2600 行 `check-ops-patrol.mjs`）会把依赖方向装反，
 *     并把大模块拖进每条消费链的闭包；所以判据住 lib，门体只做薄再导出。
 *
 * 沿革（2026-10-17 从内联抽出，原话记在这里以免随重构丢失）：nssm 的 `IHUI-DEPLOYLOOP` /
 * `IHUI-WEB` 跑的是 `<DevEnv>\ihui-prod` 那一份，不是仓内这份 checkout；所以凡问"线上此刻"的判据
 * （部署环心跳台账、`.next/IHUI_BUILD_SHA` 线上构建标记、回滚点）一律从这里取根。读仓内那份 `.next`
 * 会拿到上次本地构建留下的旧 sha —— 实测仓内标记停在 10-13 10:32，而线上标记 11:36 刚写过
 * `cf3d5fc6e0`，凭据巡检据此起寄了**连续四天的"部署停摆 97.7 小时"假警报**。
 * 语义守恒：根不存在（别人那台机没有这个形态）⇒ 调用方必须落**未判定**并点名，不得折成红或绿。
 *
 * 病理（2026-10-30 实测，不是设防想象）：`devEnvRoot` 选形态的粒度是"仓内 `.DevEnv` **根目录**在不在"
 * （`seal-c-root-stray.mjs` 的双形态推导），而 G-814433 那次只把 `backups`/`Temp` 搬进仓内，
 * `ihui-prod` 仍留在盘根侧 ⇒ 根在、目标子路径不在 ⇒ 拼出来的根恒不存在 ⇒
 * `check-credential-health` 的「部署停摆」与 `check-ops-patrol` 的部署环心跳这两条"线上此刻"oracle
 * 在这类机器上**永远读未判定**（§0.9「造好没装车 = 没有」同族）；`deploy-decisions-face` 则静默
 * 回落主仓影子账（正是那条"各处各钉主仓影子账"立项要治的残留格）。
 *
 * 判据（纯函数，`exists`/`env` 可注入 ⇒ §22c 构造面可证，不赌本机此刻是什么形态）：
 *   1. 主候选 `<devEnvRoot(repoRoot)>/ihui-prod` 存在 ⇒ 用它（优先级最高，回落不得改写它）；
 *   2. 显式 `IHUI_DEVENV_ROOT` 是调用方/夹具对"哪一个根"的强声明 ⇒ 主候选不在就直接交回主候选，
 *      **绝不越权回落**（否则夹具声明"生产根不存在"会被真机另一侧找回输入，把未判定判成有读数
 *      —— `check-credential-health` T17 锁的就是这一格，实测踩过）；
 *   3. 否则回落盘根形态 `<盘根>/DevEnv/ihui-prod`，存在才取；
 *   4. 两候选都不存在 ⇒ 返回主候选，由调用方按既有语义落**未判定**并点名根路径（§0.3：既不冒红也不记绿）。
 * 出口是"并集探测"，不是放宽判据（先例口径见 `scrub-temp-fixtures.mjs`：出口只能是并集，不是放宽判据）。
 */
import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devEnvRoot } from '../seal-c-root-stray.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// ROOT 由自身位置推导（§15：共享工作区 cwd 不可靠）。
const REPO = join(HERE, '..', '..')

/** 生产 checkout 在 DevEnv 根下的目录名（唯一一份，各消费方不得自写字面量）。 */
export const PROD_CHECKOUT_BASENAME = 'ihui-prod'

export function prodCheckoutRoot(repoRoot = REPO, exists = existsSync, env = process.env) {
  const candidate = join(devEnvRoot(repoRoot), PROD_CHECKOUT_BASENAME)
  if (exists(candidate)) return candidate
  // 显式覆盖 = 强声明（判据第 2 条）；这一格不是防御性冗余，是 T17 的实测病根。
  if ((env.IHUI_DEVENV_ROOT || '').trim()) return candidate
  // 形态并集回落（判据第 3 条）：仓内 .DevEnv 在、ihui-prod 却在盘根侧的那种机器靠这一臂重见线上态。
  const fallback = join(parse(repoRoot).root, 'DevEnv', PROD_CHECKOUT_BASENAME)
  if (fallback !== candidate && exists(fallback)) return fallback
  return candidate
}

export function prodDeployLoopLog(repoRoot = REPO, exists = existsSync, env = process.env) {
  return join(prodCheckoutRoot(repoRoot, exists, env), 'deploy/win/deploy-loop.log')
}

/** web 蓝绿态状态文件(部署环每轮写),用于判「此刻哪一色在服务」。 */
export function prodWebBlueGreenStatePath(prodRoot) {
  return join(prodRoot, 'deploy', 'run', 'web-bluegreen.json')
}

/**
 * 线上 web 构建标记 `IHUI_BUILD_SHA` 的候选落点(按优先级,第一个读到非空的算)。
 *
 * 立因(2026-10-30 现读):停摆尺子原先硬读 `apps/web/.next/IHUI_BUILD_SHA`,而 web 早已是蓝绿
 * 双目录 —— 活环只写 `.next-blue` / `.next-green`,`.next` 那一份在活环形态下根本不存在 ⇒
 * 每次读空 ⇒ 把「21:43:01 刚部署成功、活跃色标记逐字等于生产 HEAD」判成
 * `level=fail 线上无构建标记` 并送进 critical 到人通道。落点是形态事实而非判据松紧,
 * 所以修在取材层,由这一处单源供给。
 *
 * 不猜色:状态文件读不到 / JSON 坏 / active 不在 blue|green 封闭词表 ⇒ 只回落 `.next/` 那一档,
 * 由调用方按「取不到 = 缺标记」处理(§0.3),绝不返回一个没有依据的色目录。
 */
export function prodWebBuildShaCandidates(prodRoot, readText) {
  const out = []
  let color = ''
  try {
    const parsed = JSON.parse(readText(prodWebBlueGreenStatePath(prodRoot)))
    if (parsed && (parsed.active === 'blue' || parsed.active === 'green')) color = parsed.active
  } catch {
    color = ''
  }
  if (color) out.push(join(prodRoot, 'apps', 'web', `.next-${color}`, 'IHUI_BUILD_SHA'))
  out.push(join(prodRoot, 'apps', 'web', '.next', 'IHUI_BUILD_SHA'))
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
