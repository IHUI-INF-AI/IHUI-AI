// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * derived-copy-state.mjs —— 「盘上那份能不能覆盖」的唯一判据(派生产物写回档共用)
 *
 * 为什么要有它(2026-10-27 两条实测):
 *   ① 离线包自愈腿第一次跑就整轮 refused —— 7 份落点的盘上 oid 既 ≠ HEAD,也不在该路径 91 枚历史版本里;
 *      按"≠ 面就让路"那把旧尺,这条腿在这台机上**永不干活**(AGENTS 护栏③ 为认领牌清扫器收窄过一次,
 *      依据完全一样:**本仓旁路落地只推进 HEAD/索引、不写工作树,脏的工作树副本是常态,不是别人正在写**)。
 *   ② 四端 ui-routes 的写回档同病:守护跑一次 = 已写回 2 / 拒绝 2,被拒的两份正是工作树副本滞后那两份。
 *
 * 三档判据(全部只读):
 *   equal            盘 == 面 ⇒ 没什么可保护,也没什么可覆盖
 *   lagging-copy     盘上那份是该路径**历史上真出现过**的某个旧版 ⇒ 旁路落地留下的滞后副本,可以覆盖
 *   generated-copy   盘上那份从没入过库,但结构上就是生成器吐的(横幅 + 自述钉 / 单个 base64 载荷)
 *                    ⇒ 覆盖不丢任何信息(重跑生成器即原样再生),可以覆盖
 *   in-flight        以上都不成立 ⇒ 那是别席正写着的内容,**一行都不许动**(§12)
 *   absent-both      面与盘都没有这一份 ⇒ 不归本判据管
 * 取不到历史 / 读不回字节 ⇒ 一律保守落 in-flight:证明不了"安全"就不动手(§0.3 没判不冒进)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { catBatchOids } from './face-reader.mjs'
import { PIN_BEGIN } from './generated-input-pin.mjs'

const defaultRun = (args, root) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true, // §5b
    timeout: 120000, // 守门 80
    maxBuffer: 1 << 24,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g
  })

/** 面 → git 规格前缀(索引面 `:path`,HEAD 面 `HEAD:path`);磁盘面不走这条路 */
export const specPrefix = (face) => (face === 'staged' ? ':' : 'HEAD:')

/** 面上某路径的 blob oid(取不到 ⇒ null,由调用方折成"不动手") */
export function faceOidOf(face, rel, { root, run = defaultRun } = {}) {
  try {
    return (
      String(run(['rev-parse', '--verify', '--quiet', `${specPrefix(face)}${rel}`], root)).trim() ||
      null
    )
  } catch {
    return null
  }
}

/** 盘上某文件「按 git 过滤器入库后」的 oid(与面那份可比;取不到 ⇒ null) */
export function diskOidOf(rel, { root, run = defaultRun } = {}) {
  if (!existsSync(resolve(root, rel))) return null
  try {
    return String(run(['hash-object', '-w', '--', rel], root)).trim() || null
  } catch {
    return null
  }
}

/** 该路径最近 limit 枚提交里出现过的 blob oid(一次批量取;取不到 ⇒ null) */
export function historicBlobOids(rel, { root, run = defaultRun, limit = 200 } = {}) {
  let shas
  try {
    shas = String(run(['log', `-n${limit}`, '--format=%H', '--', rel], root))
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return null
  }
  if (shas.length === 0) return new Set()
  try {
    const m = catBatchOids(
      root,
      shas.map((s) => `${s}:${rel}`),
      { timeout: 60000 },
    )
    const out = new Set()
    for (const v of m.values()) if (v) out.add(v)
    return out
  } catch {
    return null
  }
}

/**
 * 盘上那份是不是**生成器吐出来的**?按结构特征认,不按"入过库没有"认:
 *   · `.gen.ts` / `.generated.ts` ⇒ 必须同时有「GENERATED FILE … DO NOT EDIT」横幅与自述钉块;
 *   · `.b64.txt` ⇒ 必须是单个 base64 token(没有可手编辑的语义,形态一坏就是人动过)。
 * 认识不了的形态一律 ok=false(失效方向恒为"不动手")。
 */
export function isMachineGenerated(rel, { root } = {}) {
  let text
  try {
    text = readFileSync(resolve(root, rel), 'utf8')
  } catch (e) {
    return { ok: false, why: `盘上那份读不回来(${String(e?.code ?? e.message).slice(0, 30)})` }
  }
  if (rel.endsWith('.b64.txt')) {
    return /^[A-Za-z0-9+/]+={0,2}\s*$/u.test(text)
      ? { ok: true, why: 'CDN 载荷是单个 base64 token,无人手编辑语义' }
      : { ok: false, why: '载荷形态不是单个 base64 token ⇒ 按人改处理' }
  }
  if (rel.endsWith('.ts') || rel.endsWith('.tsx')) {
    const banner = /GENERATED FILE[^\n]*DO NOT EDIT/.test(text)
    const pin = text.includes(PIN_BEGIN)
    return banner && pin
      ? { ok: true, why: '横幅 + 自述钉齐全 ⇒ 生成器输出,不是手写现场' }
      : { ok: false, why: `自称产物却缺${banner ? '' : '横幅'}${pin ? '' : '钉'}` }
  }
  return { ok: false, why: '不在本判据认识的生成物形态里' }
}

/** 三态判别(带让路理由);deps 全部可注入,镜像测试不碰真 git */
export function classifyCopyDelta({
  rel,
  face = 'head',
  root,
  run = defaultRun,
  historyOf = historicBlobOids,
  machineGenerated = isMachineGenerated,
} = {}) {
  const faceOid = faceOidOf(face, rel, { root, run })
  const disk = diskOidOf(rel, { root, run })
  const onDisk = existsSync(resolve(root, rel))
  if (faceOid === null) {
    if (!onDisk) return { kind: 'absent-both', faceOid, disk }
    return {
      kind: 'in-flight',
      faceOid,
      disk,
      why: `${face} 面取不到该路径(或派生 git 没跑成)⇒ 无从比对,保守让路`,
    }
  }
  if (disk === null)
    return {
      kind: 'in-flight',
      faceOid,
      disk,
      why: '盘上没有这一份(或哈希取不到)⇒ 无法证明不是别人现场',
    }
  if (faceOid === disk) return { kind: 'equal', faceOid, disk }
  const hist = historyOf(rel, { root, run })
  if (hist !== null && hist.has(disk))
    return { kind: 'lagging-copy', faceOid, disk, why: '盘上那份是该路径历史里出现过的旧版' }
  const mg = machineGenerated(rel, { root })
  if (mg.ok)
    return { kind: 'generated-copy', faceOid, disk, why: `${mg.why}(且不在该路径历史版本里)` }
  return {
    kind: 'in-flight',
    faceOid,
    disk,
    why:
      hist === null
        ? `历史 blob 集取不到 ⇒ 证明不了"只是滞后";${mg.why}`
        : `盘上那份不在历史里,也不是生成器形态:${mg.why}`,
  }
}

/** 这一份能不能动手(只有 in-flight 不许) */
export const mayOverwrite = (delta) =>
  delta?.kind === 'equal' || delta?.kind === 'lagging-copy' || delta?.kind === 'generated-copy'

export const __test__ = {
  specPrefix,
  faceOidOf,
  diskOidOf,
  historicBlobOids,
  isMachineGenerated,
  classifyCopyDelta,
  mayOverwrite,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
