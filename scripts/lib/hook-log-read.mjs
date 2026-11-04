// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * Hook 日志汇总读取器。
 *
 * 为什么需要它(与 scripts/hook-run-hidden.vbs 的并发治本同一笔):
 * 该包装器现在**每进程先写自己的文件** `<hook-logs>/<logname>/wsh-<stamp>-<attempt>-<rand>.log`,
 * 再在 mkdir 锁内 `type ... >> <logname>.log` 合回 canonical。极端情况下(锁超时 12s /
 * 磁盘故障)合回流会失败 —— 此时 run 文件**不删**,整轮内容仍完整落盘。若读取方只认
 * canonical,这一轮就"消失"了,正好复刻旧病("钩子失败但无痕")。本读取器把
 * **canonical 轮转族 + 未合并 run 文件**按时间顺序拼起来,是那类失败的可读出口。
 *
 * 顺序判据:
 *   ① canonical:`<name>.log.N`(N 越大越旧)→ `<name>.log`,即旧到新;
 *   ② 未合并 run 文件:`wsh-<固定宽度 stamp>-<attempt>-<rand>.log`,按文件名升序
 *      (stamp 定宽 ⇒ 字典序 = 时间序);它们一定晚于已合并内容,故排在 canonical 之后。
 *   ③ 只读:不写、不改、不删任何文件。合并成功后 run 文件由写方删除;读取时若正撞上
 *      "已合回但还没删"的微窗口,内容可能重复一次 —— 这是有意的取舍(宁可重复,不可丢失)。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const HOOK_LOG_REL = '.ihui-agent/state/hook-logs'

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** canonical 轮转族,旧 → 新。`.log.N` 的 N 越大越旧。 */
export function listCanonicalLogs(dir, name) {
  if (!existsSync(dir)) return []
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const re = new RegExp(`^${escapeRe(name)}.log(?:.(\\d+))?$`)
  const hit = []
  for (const n of names) {
    const m = re.exec(n)
    if (!m) continue
    hit.push({ path: join(dir, n), gen: m[1] ? Number(m[1]) : 0 })
  }
  return hit.sort((a, b) => b.gen - a.gen).map((x) => x.path)
}

/** 未合并的每进程 run 文件,旧 → 新(文件名定宽时间戳 ⇒ 字典序成立)。 */
export function listPendingRuns(dir, name) {
  const runDir = join(dir, name)
  if (!existsSync(runDir)) return []
  let names
  try {
    names = readdirSync(runDir).filter((f) => /^wsh-.*\.log$/.test(f))
  } catch {
    return []
  }
  return names.sort().map((f) => join(runDir, f))
}

/**
 * 日志族清单(旧 → 新)。`ok=false` 只在目录不可读时出现;目录不存在返回
 * `state:'missing'` 且 `files:[]`,不冒充"读到了空日志"。
 */
export function listHookLogFamily(root, name) {
  const dir = resolve(root, HOOK_LOG_REL)
  if (!existsSync(dir)) return { ok: false, state: 'missing', why: `${dir} 不存在`, files: [] }
  let files
  try {
    files = [
      ...listCanonicalLogs(dir, name).map((p) => ({ path: p, source: 'canonical' })),
      ...listPendingRuns(dir, name).map((p) => ({ path: p, source: 'pending' })),
    ]
  } catch (e) {
    return { ok: false, state: 'unreadable', why: String(e?.message ?? e).slice(0, 160), files: [] }
  }
  return { ok: true, state: files.length ? 'read' : 'empty', why: '', files }
}

/** 全量拼接(旧 → 新)。读不到的单份不静默:整份读取失败返回 ok=false 并点名。 */
export function readHookLogText(root, name) {
  const fam = listHookLogFamily(root, name)
  if (!fam.ok) return { ok: false, state: fam.state, why: fam.why, text: '', files: [] }
  let text = ''
  const used = []
  for (const f of fam.files) {
    try {
      const part = readFileSync(f.path, 'utf8')
      // 仅在前一份没以换行收尾时补一个分隔符,避免在多份文件之间凭空造出空行。
      if (text !== '' && !text.endsWith('\n')) text += '\n'
      text += part
      used.push(f)
    } catch (e) {
      return {
        ok: false,
        state: 'unreadable',
        why: `${f.path}: ${String(e?.message ?? e).slice(0, 160)}`,
        text: '',
        files: used,
      }
    }
  }
  return { ok: true, state: fam.state, why: '', text, files: used }
}

/** 末尾 n 行(跨轮转边界拼接后再切;n<=0 ⇒ 空)。 */
export function tailHookLog(root, name, n) {
  if (!(n > 0)) return ''
  const r = readHookLogText(root, name)
  if (!r.ok) return ''
  const lines = r.text.split(/\r?\n/)
  // join('\n') 后文件末尾若带换行,最后会多一个空元素;去掉它,保证"末 n 行"是 n 行。
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines.slice(-n).join('\n')
}
