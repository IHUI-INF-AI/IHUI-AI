// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端镜像「标记写入」纪律的**单源**(AGENTS §0.6:同一把尺子只许有一份实现)。
//
// 为什么单独一件:仓库里有三处要写「// 镜像 <共享屏路径>」这行 ——
//   ① scripts/auto-register-cross-end.mjs(给已存在的小程序页补声明)
//   ② scripts/repair-cross-end-mirror.mjs(台账说有、代码没写 ⇒ 补回)
//   ③ scripts/gen-miniapp-mirror.mjs(新造页时直接带上)
// 三处各抄一份 ⇒ 标记形态改一次就静默分叉,而门 128 只认其中一种形态 ⇒
// 漏的那份写出去的标记,门 128 读不到 ⇒ 登记了却没镜像(门 128 R1 当场造红)。
// 形态与插入点在这里定一份,三处都 import 它。
//
// 插入点口径(为什么不是"文件第一行"):文件头 3 行是版权/溯源横幅(AGENTS §5c),
// 标记必须排在横幅之后;横幅与正文之间若有空行,标记排在空行之后(与
// packages/app 侧首例 pkg-about/about/agreement 的实际排布同形)。

/** 标记行前缀(与门 128 的 MARK_RE 认的形态配套)。 */
export const MIRROR_MARK_PREFIX = '// 镜像 '

/** 共享屏 spec 的形态:packages/app/src/features/<domain>/<Name>Screen.tsx */
const SPEC_RE = /^packages\/app\/src\/features\/[A-Za-z0-9_-]+\/[A-Za-z0-9_]+Screen\.tsx$/

/** 标记行字面。 */
export function mirrorMarkerLine(spec) {
  return `${MIRROR_MARK_PREFIX}${spec}`
}

/** spec 形态是否合法(不合格的 spec 写出去的标记,门 128 读不到 ⇒ 等于没写)。 */
export function isSharedSpec(spec) {
  return typeof spec === 'string' && SPEC_RE.test(spec)
}

/** 该文本里有没有**任何**共享屏的镜像标记(用于"这页已被别席声明"的判断)。 */
export function hasMirrorMarker(text) {
  return /packages\/app\/src\/features\/[A-Za-z0-9_-]+\/[A-Za-z0-9_]+Screen\.tsx/.test(String(text || ''))
}

/** 该文本是否已有**指定**共享屏的镜像标记。 */
export function hasMirrorMarkerFor(text, spec) {
  return String(text || '').includes(mirrorMarkerLine(spec))
}

/**
 * 纯函数:把标记行插进文本。
 * 幂等:已有该标记 ⇒ done=false(不重复插)。
 * 已被**别**的共享屏声明 ⇒ 拒(不覆盖别席的处置权;覆盖了就等于把别人的声明改写成我的)。
 * @param {string} text 原文本(通常取 HEAD blob,见调用方的取材面纪律)
 * @param {string} spec 共享屏 spec
 * @returns {{done: boolean, why: string, text: string, line: string|null}}
 */
export function insertMirrorMarker(text, spec) {
  if (!isSharedSpec(spec)) return { done: false, why: `spec 形态不合法:${String(spec)}`, text, line: null }
  if (hasMirrorMarkerFor(text, spec)) return { done: false, why: '已有该标记', text, line: null }
  const other = String(text || '').match(/packages\/app\/src\/features\/[A-Za-z0-9_-]+\/[A-Za-z0-9_]+Screen\.tsx/g)
  if (other && other.length > 0)
    return { done: false, why: `该页已声明别屏(${other[0]}),不覆盖别席处置权`, text, line: null }
  const lines = String(text || '').split('\n')
  let at = 0
  while (at < lines.length && (lines[at].startsWith('//') || lines[at].startsWith('#!'))) at++
  // 横幅后的空行:标记排到空行之后(与首例实际排布同形),没有空行就直接接横幅。
  if (at < lines.length && lines[at].trim() === '') at++
  const line = mirrorMarkerLine(spec)
  lines.splice(at, 0, line)
  return { done: true, why: '已插入标记行', text: lines.join('\n'), line }
}

/** §22c 三步之①:源脚本导出 __test__,镜像测试直接用生产判据(测试里不复制第二份实现)。 */
export const __test__ = {
  MIRROR_MARK_PREFIX,
  mirrorMarkerLine,
  isSharedSpec,
  hasMirrorMarker,
  hasMirrorMarkerFor,
  insertMirrorMarker,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
