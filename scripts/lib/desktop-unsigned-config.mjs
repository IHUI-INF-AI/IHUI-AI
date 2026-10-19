// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端"未签名本地打包"的**唯一真相源**(AGENTS §0.6:同类判据/取值实现全仓只许一份)。
//
// ## 立因(实测,不是假想)
//   `apps/desktop/src-tauri/tauri.conf.json` 钉着 `bundle.createUpdaterArtifacts: true` + updater
//   公钥,而 minisign 私钥 `~/.tauri/ihui-updater.key` 只在发版机/CI 上。本机没有私钥时,
//   makensis 其实**已经产出** `setup.exe`,只是随后的签名步报
//   `A public key has been found, but no private key.` → **整条命令 exit 1**。
//   于是"本地产出自测包"这条路是断的:用户拿到的是一条指向签名的报错,而不是一个包。
//
// ## 为什么这不是"签名判据坏了",而是"豁免开关落不到地"
//   `scripts/desktop-artifact-single.mjs` 早就有 `DESKTOP_ALLOW_UNSIGNED=1` 豁免(缺 `.sig` 放行)。
//   但它挂在 **tauri build 之后**:tauri 先在签名步 exit 1,收敛钩子**根本跑不到**。
//   2026-10-19 实测 `DESKTOP_ALLOW_UNSIGNED=1 pnpm --filter @ihui/desktop build` 仍 exit 1,
//   就是这条"写了但跑不通的出路"(§0.8 / §12f)。
//   正解是让豁免开关**两段都生效**:① 给 tauri 传一份只关 `createUpdaterArtifacts` 的临时 config,
//   让它别去签名;② 同一时刻把该 env 透给收敛钩子,让它放行"缺 .sig"。
//
// ## 边界(不得放松)
//   唯一被覆盖的字段 = `bundle.createUpdaterArtifacts: false`。pubkey / bundle 目标 / 版本号
//   / 图标 / NSIS 模板一律不动 —— 那是发版形态。未签名产物**不得**进更新源、不得发版、
//   不得上传任何下载/更新 CDN;发版一律走持有私钥的 `scripts/release-desktop-local.mjs`。

import { mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** 与 scripts/desktop-artifact-single.mjs 共用同一个开关:一处开,签名步与 .sig 断言同时放行。 */
export const ALLOW_UNSIGNED_ENV = 'DESKTOP_ALLOW_UNSIGNED'

/**
 * @param {Record<string, string | undefined> | undefined} env
 * @returns {boolean}
 */
export function allowUnsignedFrom(env) {
  return env?.[ALLOW_UNSIGNED_ENV] === '1'
}

/**
 * 临时 config 的落点:仓库内 `.ihui-agent/tmp/<slot>/`(§15 工作区卫生),路径由脚本自身位置
 * 推导仓根后拼出,**不写死盘符**、不用 `process.cwd()`(共享工作区 cwd 不可靠)。
 *
 * `slot` 由调用方给,让不同入口各占一格 —— 同一格并发写会互相删掉对方的临时 config。
 *
 * @param {string} root 仓库根
 * @param {string} slot 该入口独占的子目录名
 * @returns {string}
 */
export function unsignedConfigPath(root, slot) {
  return path.join(root, '.ihui-agent', 'tmp', slot, 'tauri.unsigned.json')
}

/** 唯一被覆盖的字段:关掉 updater 产物(签名),不动 pubkey/bundle 目标/版本号等任何发版形态。 */
export const UNSIGNED_CONFIG_CONTENT = `${JSON.stringify({ bundle: { createUpdaterArtifacts: false } }, null, 2)}\n`

/**
 * 落地那份临时 config,返回它自己的路径。
 *
 * 幂等:已存在且内容逐字相同 ⇒ 不重写(免得在并发读它的 tauri 进程脚下改文件)。
 * 内容不同 ⇒ 覆盖并说明(那说明有别的形态在抢这一格)。
 *
 * @param {string} root
 * @param {string} slot
 * @returns {string} config 的绝对路径
 */
export function ensureUnsignedConfig(root, slot) {
  const p = unsignedConfigPath(root, slot)
  let same = false
  try {
    same = readFileSync(p, 'utf8') === UNSIGNED_CONFIG_CONTENT
  } catch {
    same = false
  }
  if (!same) {
    mkdirSync(path.dirname(p), { recursive: true })
    writeFileSync(p, UNSIGNED_CONFIG_CONTENT)
  }
  return p
}

/**
 * 收掉那份临时 config(**只在确认是我们写的那份内容时才删**)。
 *
 * 为什么加内容比对:路径是共享工作区里的固定格,别人若把同名的另一份东西放进去,
 * 无脑 `rm` 就是删掉他人的现场(§12 多会话)。内容对不上 ⇒ 原样保留并让调用方知道没收掉。
 *
 * @param {string} root
 * @param {string} slot
 * @returns {{ removed: boolean, configPath: string, reason?: string }}
 */
export function removeUnsignedConfig(root, slot) {
  const p = unsignedConfigPath(root, slot)
  try {
    if (readFileSync(p, 'utf8') !== UNSIGNED_CONFIG_CONTENT) {
      return { removed: false, configPath: p, reason: '内容与本仓写出的那份不一致(疑似他人现场),保留不删' }
    }
  } catch {
    return { removed: false, configPath: p, reason: '文件已不存在(可能已被收走),无残留' }
  }
  rmSync(p, { force: true })
  // 目录只在自己空的时候才收(rmdirSync 对非空目录抛 ENOTEMPTY),不得连带删掉别人的现场
  try {
    rmdirSync(path.dirname(p))
  } catch {
    /* 目录非空(他人正在用)⇒ 保留,不算本脚本的残留 */
  }
  return { removed: true, configPath: p }
}

export const __test__ = {
  ALLOW_UNSIGNED_ENV,
  allowUnsignedFrom,
  unsignedConfigPath,
  UNSIGNED_CONFIG_CONTENT,
  ensureUnsignedConfig,
  removeUnsignedConfig,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
