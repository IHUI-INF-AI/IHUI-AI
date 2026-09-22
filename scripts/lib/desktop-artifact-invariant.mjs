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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
