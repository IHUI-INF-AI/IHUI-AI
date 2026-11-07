// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面安装包"单一产物"不变量的纯判据(无 IO、无副作用,供发版脚本与测试共用一份真相)。
//
// 背景:tauri-bundler 按版本号命名输出且**从不清理旧版**,所有版本堆在同一个
// target/release/bundle/nsis/ 里。目录一旦同时躺着 0.1.44 / 0.1.45 / 0.1.46,
// 任何"取目录里那个 setup.exe"的写法(脚本 glob `filter(...)[0]`、人肉双击、
// CI 通配)都会让"装哪一个"退化成**由文件名字母序决定**。2026-09-22 本机做
// updater 端到端验证时就在同一目录连建两个测试包,真实踩到了这个歧义。
//
// 所以发版脚本必须:① 删掉非当前版本的包与签名;② 断言清理后目录里
// **有且仅有当前版本这一个包**,多一个就立即失败,不给下游留歧义。

const IS_EXE = (f) => f.endsWith('-setup.exe')
const IS_SIG = (f) => f.endsWith('-setup.exe.sig')
// 必须是"带具体版本号"的真实产物名。⚠️ 只判 endsWith('-setup.exe') 是**假护栏**:
// 通配串 `*-setup.exe` 本身就以该后缀结尾,照样通过 —— 单测当场抓出(见
// scripts/tests/desktop-artifact-invariant.test.mjs 的"glob 猜包"用例)。
// 故额外要求:① 含 x.y.z 版本段;② 不含任何 glob 元字符。
const GLOB_METACHARS = /[*?[\]{}]/
const HAS_VERSION = /\d+\.\d+\.\d+/

/**
 * @param {string[]} files 目录内的文件名列表
 * @param {string} exeName 本次构建应产出的包名(由版本号拼出,不得靠 glob 猜)
 * @returns {{ keep: string[], stale: string[], violations: string[] }}
 */
export function planArtifactInvariant(files, exeName) {
  if (
    typeof exeName !== 'string' ||
    !IS_EXE(exeName) ||
    GLOB_METACHARS.test(exeName) ||
    !HAS_VERSION.test(exeName)
  ) {
    throw new TypeError(
      `exeName 必须是带具体版本号的 *-setup.exe 文件名(不得为通配/目录形态),收到: ${String(exeName)}`,
    )
  }
  const sigName = `${exeName}.sig`
  const artifacts = files.filter((f) => IS_EXE(f) || IS_SIG(f))
  const stale = artifacts.filter((f) => f !== exeName && f !== sigName)
  const keep = artifacts.filter((f) => f === exeName || f === sigName)
  // 违规 = 清理后仍不满足"恰好 exe + sig 一对"
  const violations = []
  if (!keep.includes(exeName)) violations.push(`缺少当前包 ${exeName}`)
  if (!keep.includes(sigName)) violations.push(`缺少当前签名 ${sigName}`)
  const exeCount = keep.filter(IS_EXE).length
  if (exeCount > 1) violations.push(`残留 ${exeCount} 个 setup 包`)
  return { keep, stale, violations }
}

const INSTALLER_ARCH = /_((?:x64|arm64|ia32))-setup\.exe$/
const SHA256_HEX = /^[a-f0-9]{64}$/

/** 从安装包文件名取出架构。取不到就返回 null,调用方不得把 null 写成某一档。 */
export function archFromInstallerName(name) {
  if (typeof name !== 'string') return null
  const hit = INSTALLER_ARCH.exec(name)
  return hit ? hit[1] : null
}

/**
 * 安装内容清单裁决。
 * 对方清单的 files 是路径字符串,哈希和体积都没有,判不出内容是否被换。
 * measured[path] === null 表示该路径读不到:这是未判定,不是「文件不在」。
 * 路径不在 measured 里,才是清单声明了但目录里没有。
 *
 * @param {object | null} manifest
 * @param {Record<string, { sha256: string, bytes: number } | null> | null} measured
 */
export function judgeContentManifest(manifest, measured) {
  const unjudged = (reason) => ({ disposition: 'unjudged', reason, mismatches: [] })
  if (
    manifest === null ||
    manifest === undefined ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest)
  ) {
    return unjudged('manifest-unmeasured')
  }
  if (
    measured === null ||
    measured === undefined ||
    typeof measured !== 'object' ||
    Array.isArray(measured)
  ) {
    return unjudged('measurement-unmeasured')
  }
  const files = manifest.files
  if (!Array.isArray(files)) return unjudged('files-unmeasured')
  if (files.length === 0) return unjudged('files-empty')
  if (files.some((entry) => typeof entry === 'string')) {
    return { disposition: 'path-only', reason: 'paths-cannot-prove-content', mismatches: [] }
  }
  if (typeof manifest.fileCount === 'number' && manifest.fileCount !== files.length) {
    return { disposition: 'incomplete', reason: 'file-count-mismatch', mismatches: [] }
  }
  const mismatches = []
  for (const entry of files) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return unjudged('entry-invalid')
    const rel = entry.path
    const sha256 = entry.sha256
    const bytes = entry.bytes
    const arch = entry.arch
    if (
      typeof rel !== 'string' ||
      rel.length === 0 ||
      typeof sha256 !== 'string' ||
      !SHA256_HEX.test(sha256) ||
      !Number.isInteger(bytes) ||
      bytes < 0 ||
      typeof arch !== 'string' ||
      arch.length === 0
    ) {
      return unjudged('entry-invalid')
    }
    if (!Object.prototype.hasOwnProperty.call(measured, rel)) {
      mismatches.push({ path: rel, kind: 'absent' })
      continue
    }
    const got = measured[rel]
    if (got === null || got === undefined) return unjudged('content-unmeasured')
    if (got.sha256 !== sha256 || got.bytes !== bytes) {
      mismatches.push({ path: rel, kind: 'content' })
    }
  }
  if (mismatches.length > 0) {
    return { disposition: 'incomplete', reason: 'content-or-absence', mismatches }
  }
  return { disposition: 'intact', reason: 'measured-match', mismatches: [] }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
