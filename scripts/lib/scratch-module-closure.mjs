// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 `scripts/` 下的某个脚本**连同它的相对 import 闭包**拷进临时演练仓。
 *
 * 为什么需要它:大量门把 `repoRoot` 由**脚本自身位置**推导
 * (`resolve(dirname(fileURLToPath(import.meta.url)), '..')`,AGENTS §15「路径不得硬编码」的结果),
 * 所以测试要跑它的 CLI 就必须把脚本放进 `<演练仓>/scripts/` 下。而脚本一旦收口进
 * `scripts/lib/face-reader.mjs`,复制面就从 1 个文件变成一整条闭包 ——
 * **手抄清单必然晚一拍**:2026-09-25 同一天连吃两次(heal 迁移后 `git-guardian-drift-align` 红、
 * `check-rn-global-css-sync` 迁移后它的 15 条夹具测试全红),症状都是
 * `ERR_MODULE_NOT_FOUND` + 子进程 exit 1 + stdout 空,而被测行为一行都没动。
 *
 * 所以闭包必须是**推导**的。并且本模块自己就是这条闭包里的一跳,任何门再经它取道共用层,
 * 夹具都不必改第二处。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'

/**
 * 从 `entryRel`(相对 scriptsDir)出发,递归收集所有**相对** import 的路径(含入口自身)。
 * 只走相对说明符 —— 裸包名(`node:fs` / `@ihui/*`)不该被拷,它们在演练仓里按原样解析。
 * 三种形态都要认:`import x from './a'`、`import './a'`(副作用)、`export * from './a'`。
 * 漏一种就是"看起来收了口、实际下一跳没拷"。
 */
export function relativeImportClosure(scriptsDir, entryRel, seen = new Set()) {
  const key = normalize(entryRel).replace(/\\/g, '/')
  if (seen.has(key)) return seen
  seen.add(key)
  let text
  try {
    text = readFileSync(join(scriptsDir, key), 'utf8')
  } catch {
    // 闭包外/取不到:就此收住。调用方的存在性断言负责把它报成红,
    // 这里绝不静默 —— 静默正是"夹具跑得通但拷错了东西"的来源。
    return seen
  }
  for (const m of text.matchAll(
    /(?:^|\n)\s*(?:import|export)\b[^'"]*?from\s*['"](\.[^']+)['"]|(?:^|\n)\s*import\s*['"](\.[^']+)['"]/g,
  )) {
    const spec = m[1] || m[2]
    if (!spec) continue
    relativeImportClosure(scriptsDir, normalize(join(dirname(key), spec)), seen)
  }
  return seen
}

/**
 * 把入口及其闭包复制到 `destScriptsDir`(通常 = `<演练仓>/scripts`),并**断言**共用层在位。
 * @returns {string[]} 实际复制的相对路径清单(排序,便于测试里做等值比对)
 */
export function copyScriptWithClosure(scriptsDir, entryRel, destScriptsDir, expect = []) {
  const abs = resolve(scriptsDir)
  const copied = [...relativeImportClosure(abs, entryRel)].sort()
  for (const rel of copied) {
    const src = join(abs, rel)
    if (!existsSync(src)) {
      throw new Error(`闭包里的 ${rel} 在 ${abs} 下不存在 —— 夹具会缺文件,先修引用再跑测试`)
    }
    const dst = join(destScriptsDir, rel)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(src, dst)
  }
  // 反向哨兵:声明"必须拷到"的每一跳都真在位。缺一条就是又一次 ERR_MODULE_NOT_FOUND 的预付款。
  for (const rel of expect) {
    if (!existsSync(join(destScriptsDir, rel))) {
      throw new Error(
        `演练仓未拷到 scripts/${rel} —— git 派生已收口到共用层,少一跳就是 ERR_MODULE_NOT_FOUND`,
      )
    }
  }
  return copied
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
