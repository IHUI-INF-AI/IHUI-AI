// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端 tauri build 之后的收敛钩子:保证 bundle/nsis 目录里**不存在多个版本**的安装包。

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { planArtifactInvariant } from './lib/desktop-artifact-invariant.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONF = path.join(ROOT, 'apps/desktop/src-tauri/tauri.conf.json')

/**
 * 未签名本地打包的**显式**豁免开关(2026-09-24 立)。
 * 背景:`bundle.createUpdaterArtifacts=true` + 钉死 minisign pubkey,而签名私钥
 * `~/.tauri/ihui-updater.key` 只存在于发版机/CI。本机没有私钥时 makensis **已经产出**
 * setup.exe,tauri 却在随后的签名步报 `A public key has been found, but no private key.`
 * → 整条链路恒红,本地连自测包都拿不到。默认(不设该 env)判据一字不改。
 * 严格只认 '1' —— `0`/空/任意其他值一律按"未豁免"处理,避免误开。
 */
const ALLOW_UNSIGNED_ENV = 'DESKTOP_ALLOW_UNSIGNED'
const allowUnsignedFrom = (env) => env?.[ALLOW_UNSIGNED_ENV] === '1'

/**
 * 违规分堆:`blocking`(照旧判红)与 `excused`(仅在显式豁免下放行)。
 *
 * 豁免面**只有**"仅缺当前签名"这一种形态,而且判据不是文案匹配:把当前签名**假想补齐**
 * 后再跑一遍同一份纯判据 —— 补上就完全干净 ⇒ 唯一缺的就是签名;补上后仍有违规
 * (缺当前安装包、目录里残留其他版本产物……)⇒ 一律留在 blocking。
 * 所以这道豁免放行的只有"sig 这一项",不是把整扇门关掉。
 *
 * @param {string[]} files 目录内的文件名列表
 * @param {string} exeName 本次构建应产出的包名(由版本号拼出,不得靠 glob 猜)
 * @param {boolean} allowUnsigned 显式豁免开关(见 ALLOW_UNSIGNED_ENV)
 * @returns {{ blocking: string[], excused: string[] }}
 */
function partitionViolations(files, exeName, allowUnsigned) {
  const { violations } = planArtifactInvariant(files, exeName)
  if (violations.length === 0) return { blocking: [], excused: [] }
  if (!allowUnsigned) return { blocking: violations, excused: [] }
  const sigName = `${exeName}.sig`
  const withPretendSig = planArtifactInvariant([...files, sigName], exeName)
  return withPretendSig.violations.length === 0
    ? { blocking: [], excused: violations }
    : { blocking: violations, excused: [] }
}

async function main() {
  const argv = process.argv.slice(2)
  const flag = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  // --dir / --expect 只为把判据放进临时目录做负向对照;默认走真实构建产物目录。
  const nsisDir = flag('--dir') ?? path.join(ROOT, 'apps/desktop/src-tauri/target/release/bundle/nsis')
  const expected = flag('--expect')
  const allowUnsigned = allowUnsignedFrom(process.env)

  if (!existsSync(nsisDir)) return 0

  const version = expected ? undefined : JSON.parse(readFileSync(CONF, 'utf8')).version
  const exeName = expected ?? `智汇AI_${version}_x64-setup.exe`

  const { keep, stale } = planArtifactInvariant(readdirSync(nsisDir), exeName)

  // 当前包**不在**目录里 = 这次构建压根没产 nsis(例如 --bundles app/msi)。
  // 此时目录里的东西属于别的构建目标,不删也不报错 —— 本钩子只管"多版本共存"这一件事,
  // "该有的包必须存在"由发版脚本 scripts/release-desktop-local.mjs 自己严格断言。
  // 豁免开关**不**改变这一条:它不产 nsis 的判断与签名无关。
  if (!keep.includes(exeName)) {
    if (stale.length > 0) {
      console.log(`[artifact-single] 目录内无 ${exeName},按不产 nsis 处理,保留现有 ${stale.length} 项`)
    }
    return 0
  }

  // 旧版本包/签名一律先清理 —— "多包共存"这一判据的执行体就是这段删除,
  // 它不属于豁免面:开了豁免也照删,否则下游"取目录里那个 setup.exe"又退化成字母序猜包。
  for (const f of stale) {
    rmSync(path.join(nsisDir, f), { force: true })
    console.log(`[artifact-single] 清理旧产物: ${f}`)
  }

  const files = readdirSync(nsisDir)
  const { keep: surviving } = planArtifactInvariant(files, exeName)
  const { blocking, excused } = partitionViolations(files, exeName, allowUnsigned)
  if (blocking.length > 0) {
    console.error(
      `[artifact-single] 单一产物不变量被破坏 —— ${blocking.join(';')}\n` +
        `  目录 ${nsisDir} 现存产物: ${surviving.join(', ') || '(空)'}`,
    )
    return 1
  }
  if (excused.length > 0) {
    console.log(
      `[artifact-single] !! 已按 ${ALLOW_UNSIGNED_ENV}=1 放行「${excused.join(';')}」\n` +
        `  !! 未签名产物:**不得进更新源、不得发版、不得上传任何下载/更新 CDN**,只能本地自测。\n` +
        `  !! 发版一律走持有 minisign 私钥的通道;其余判据(单一安装包、旧版本清理)未因本豁免放松。`,
    )
    console.log(`[artifact-single] ✅ ${exeName} 为目录内唯一安装包(未签名)`)
    return 0
  }
  console.log(`[artifact-single] ✅ ${exeName} 为目录内唯一安装包`)
  return 0
}

const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 不 catch:main() 自身抛错(tauri.conf 读不到等)走 Node 默认"未处理拒绝"→ 打印堆栈 + exit 1,
  // 与改版前同步抛错的退出码一致。
  main().then((code) => {
    if (code !== 0) process.exit(code)
  })
}

export const __test__ = { partitionViolations, allowUnsignedFrom, ALLOW_UNSIGNED_ENV }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
