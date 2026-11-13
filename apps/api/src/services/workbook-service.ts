// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作簿读写服务(2026-11-02 立,goal-b45 F 席)。
 *
 * 对标取证:`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T8-sidecar-native-surface.md` §B
 * —— 对照件 `xlsx-sidecar.exe`(Rust 原生,15,168 函数)把「工作簿」做成面向 agent 的
 * 命令协议(`handshake/open/read_range/…/save_archive/recalc_cells/convert_workbook`),
 * 写回 + 公式重算在册(引擎 = vendored calamine 分叉 + ironcalc_base 0.7.1)。
 *
 * 本仓这一格只做 **open / read_range / write_cells / save / close** 五条命令,
 * 并刻意与对照件分道:
 *
 * 1. **非破坏式保存**:保存一律落**新** storage 文件,绝不原地覆盖用户原档。
 *    (对照件的 `save_archive` 是条目级写回;本层结构上不具备覆盖能力 —— 见 `saveWorkbook`
 *    的三重自证:目标 id ≠ 原档 id 且目标不存在、保存前/后各复验一次原档 sha256。)
 * 2. **公式不重算**:exceljs 没有计算引擎,xlsx 里公式单元格带的是**上次存盘时的缓存值**。
 *    因此 `readRange` 读到公式单元格时**不回值**,只回 `state='formula-uncomputed'` + 公式原文
 *    (AGENTS §0.3 在产品数据上的等价形态:取不到真值 ⇒ 不得拿旧值冒充当前值)。
 *    本次改动波及任何公式格 ⇒ 结果显式带 `recalcUnsupported: true` + 点名到格。
 * 3. **不许把公式换成静态值来"消问题"**:写目标格若本身是公式格,整批**拒写**
 *    (错误码 `WORKBOOK_FORMULA_OVERWRITE`),不做部分写,不做静默降级。
 *
 * 身份纪律(AGENTS §5「认证不等于授权」):`subjectId` 由承载层(路由的 `request.userId`)
 * 显式入参传进来,本模块**从不**从工作簿内容 / 文件元数据反推主体,也不信客户端自报;
 * 会话句柄绑定主体,跨主体用句柄 ⇒ `WORKBOOK_FORBIDDEN_OWNER` 且零副作用。
 *
 * 依赖纪律:只用 `apps/api` 已声明的 `exceljs`(package.json 现读)与既有 `storage-service`,
 * **不新增任何 npm 依赖**;`convert_workbook` 与 `recalc_cells` 两格本席**未做**(见交付报告)。
 */

import { createHash, randomBytes } from 'node:crypto'
import { extname } from 'node:path'
import ExcelJS from 'exceljs'
import { deleteFile, generateFileId, getFileInfo, readFile, saveFile } from './storage-service.js'
import * as storageService from './storage-service.js'

// =============================================================================
// 协议常量与错误码
// =============================================================================

/** 协议版本(握手用;与对照件 `version` + `unsupported_version` 同语义)。 */
export const WORKBOOK_PROTOCOL_VERSION = 1

/** 单会话空闲超时(毫秒):过期句柄一律判「未判定」,不猜它当时是什么状态。 */
const SESSION_IDLE_TTL_MS = 30 * 60 * 1000
/**
 * 单主体同时存活的会话上限(F-414)。
 *
 * 逐出只在**本主体**的会话桶内发生:旧实现是全局 64 条按 lastUsedAt 淘汰,
 * 一个人循环 POST /open 就能把别人的未保存会话挤出表(对方拿到 410、改动丢失)。
 */
export const MAX_SESSIONS_PER_SUBJECT = 3
/** 单份工作簿 open 的体积上限(F-414):超限在读取前拒,不把整本读进内存。 */
export const MAX_WORKBOOK_OPEN_BYTES = 20 * 1024 * 1024
/** open 接受的扩展名:只认 exceljs 能解析的 OOXML 工作簿(legacy .xls 不在列)。 */
export const WORKBOOK_ALLOWED_EXTENSIONS = ['.xlsx', '.xlsm'] as const
/**
 * 单会话成功保存的次数上限(F-415)。
 *
 * 同一 handle 反复 /save 会反复序列化整本工作簿并落盘;只保留一个版本槽位之后,
 * 仍要挡住"同一本大档反复重写"这类持续占用,故次数与字节都设硬上限。
 */
export const MAX_SAVES_PER_SESSION = 10
/** 单会话成功写出的累计字节上限(F-415):按**写出量**计,不是占盘量。 */
export const MAX_SAVED_BYTES_PER_SESSION = 64 * 1024 * 1024
/** 单次读取区域的最大单元格数(对照件有同类响应尺寸闸,见取证册 §2.1)。 */
const MAX_RANGE_CELLS = 20_000
/** 单次写入的最大单元格数。 */
const MAX_WRITE_CELLS = 500
/**
 * 会话累计改动格的去重记录上限(F-265)。
 *
 * 记录只服务两件事:同一格不重复判、后续写入不重扫历史格。每个新格在写入当次就与
 * 全部公式格比过,命中结果已折叠进 `staleFormulaHits`,因此到顶后按 FIFO 淘汰最旧记录
 * **不丢任何已判定的受影响公式**(公式格索引在 open 时建成,写值不会把非公式格变成
 * 公式格、也不允许覆盖公式格 ⇒ 本会话内依赖集不变)。
 * 5 万 ≈ 100 次满批(MAX_WRITE_CELLS=500);单条记录 ~40 字符,内存上限约 2MB/会话。
 */
const MAX_TOUCHED_CELLS = 50_000
/** 依赖扫描的公式格上限;超限 ⇒ 判「没扫完」,保守带 recalc 标记(不是"没影响")。 */
const MAX_FORMULA_SCAN_CELLS = 20_000
/** 单表扫描的格子上限;超过则该表整表判「扫不动」⇒ 保守 unjudged。 */
const MAX_SHEET_CELLS = 400_000

export type WorkbookErrorCode =
  | 'WORKBOOK_INVALID_INPUT'
  | 'WORKBOOK_FILE_NOT_FOUND'
  | 'WORKBOOK_HANDLE_UNDETERMINED'
  | 'WORKBOOK_FORBIDDEN_OWNER'
  | 'WORKBOOK_FORMAT_UNSUPPORTED'
  | 'WORKBOOK_FORMULA_OVERWRITE'
  | 'WORKBOOK_RANGE_TOO_LARGE'
  | 'WORKBOOK_FILE_TOO_LARGE'
  | 'WORKBOOK_SOURCE_CHANGED'
  | 'WORKBOOK_SAVE_LIMIT_EXCEEDED'
  | 'WORKBOOK_SAVE_BYTES_EXCEEDED'
  | 'WORKBOOK_UNJUDGED'

/** 统一结果信封:成功 ok=true;失败 ok=false + 具名错误码。 */
export type WorkbookResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: WorkbookErrorCode; message: string; detail?: Record<string, unknown> }

const fail = (
  errorCode: WorkbookErrorCode,
  message: string,
  detail?: Record<string, unknown>,
): WorkbookResult<never> => ({ ok: false, errorCode, message, detail })

// =============================================================================
// 类型
// =============================================================================

/** 读到的单元格:公式/合并从格/错误三类**不回值**。 */
export interface WorkbookCellRead {
  address: string
  kind: 'value' | 'empty' | 'formula' | 'error' | 'merged'
  /** 仅 kind='value' 有值;其余恒为 null(不拿缓存值/从格冒充当前值)。 */
  value: string | number | boolean | null
  /** kind='formula':公式原文(不含前导 =)。 */
  formula?: string
  /** kind='formula':明写「未重算」。 */
  state?: 'formula-uncomputed'
  /** kind='formula':缓存值被扣住这件事本身也要说出来。 */
  cachedValueWithheld?: true
  /** kind='error':错误串原文(只报,不当值返回)。 */
  errorText?: string
  /** kind='merged':主格地址(从格不自造值)。 */
  masterAddress?: string
}

/** 含公式工作簿被本次改动波及的公式格。 */
export interface StaleFormulaCell {
  sheet: string
  address: string
  formula: string
  /** 判据来源:单格引用 / 区间 / 整列 / 扫不动的形态(保守算受影响)。 */
  via: 'cell-ref' | 'range-ref' | 'col-ref' | 'unjudged-pattern'
}

export interface WriteCellInput {
  address: string
  value: string | number | boolean | null
}

interface FormulaRef {
  sheet: string | null
  fromRow: number
  toRow: number
  fromCol: number
  toCol: number
}

interface FormulaCellIndex {
  sheet: string
  address: string
  formula: string
  refs: FormulaRef[]
  colRefs: Array<{ sheet: string | null; fromCol: number; toCol: number }>
  /** 引用形态扫不动(R1C1、命名区域、跨簿):保守按"可能受影响"。 */
  unjudged: boolean
}

interface WorkbookSession {
  handle: string
  /** 归属主体(承载层注入;句柄级授权判据)。 */
  subjectId: string
  sourceFileId: string
  sourceName: string
  /** 打开时原档 sha256(保存前后各复验一次)。 */
  sourceSha256: string
  workbook: ExcelJS.Workbook
  formulaCells: FormulaCellIndex[]
  /** 公式扫描是否没扫完(超大表 / 超上限)。 */
  scanTruncated: boolean
  /**
   * 本会话累计写入的格子(去重键,见 `touchedKeyOf`;只用于"判过就不再判")。
   * Set 保留插入顺序 ⇒ 到顶后天然按 FIFO 淘汰。F-265。
   */
  touched: Set<string>
  /**
   * 已判定受影响的公式格(键 = `formulaCells` 下标,只增不改 ⇒ 同一公式保留"首次命中"的 via,
   * 与逐批全量比较的结果逐字一致)。F-265:比较改为增量,不再 formulaCells × 全部 touched。
   */
  staleFormulaHits: Map<number, StaleFormulaCell>
  lastUsedAt: number
  savedFileIds: string[]
  /**
   * 当前保存槽位(F-415):同会话后一次保存覆盖前一次 —— 新档落定后删掉旧槽位文件,
   * 会话存活期间磁盘上最多只有一份输出。TTL 到期时由 sweep 一并删除。
   */
  savedSlotFileId: string | null
  /** 本会话成功保存次数(F-415 配额)。 */
  saveCount: number
  /** 本会话累计成功写出的字节(F-415 配额:按写出量计,覆盖写也计数)。 */
  savedBytes: number
}

/** 会话表(进程内;重启即空,句柄随之判「未判定」,不假装能续)。 */
const _sessions = new Map<string, WorkbookSession>()
/** 主体 → 该主体名下的句柄集合:逐出只在本桶内发生(F-414)。 */
const _handlesBySubject = new Map<string, Set<string>>()

// =============================================================================
// 地址与区域解析
// =============================================================================

const USER_ID_RE = /^[0-9a-fA-F-]{16,64}$/
const CELL_RE = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]{0,6})$/

function colToNumber(col: string): number {
  let n = 0
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function numberToCol(n: number): string {
  let s = ''
  let v = n
  while (v > 0) {
    const rem = (v - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    v = Math.floor((v - 1) / 26)
  }
  return s
}

/** 解析 `A1` / `$A$1` 形态单元格地址;非法返回 null。 */
function parseCellRef(ref: string): { row: number; column: number } | null {
  const m = CELL_RE.exec(String(ref ?? '').trim())
  if (!m) return null
  const colRaw = m[1]
  if (!colRaw) return null
  const column = colToNumber(colRaw)
  // F-541:xlsx 规格上限是 16384 列(XFD) × 1048576 行,超出会产出 Excel 判损坏的工作簿。
  if (!Number.isFinite(column) || column < 1 || column > 16384) return null
  const row = Number(m[2])
  if (row > 1048576) return null
  return { row, column }
}

/** 解析 `A1:C10` 或单格 `B7` 形态区域;非法返回 null。 */
function parseRangeRef(
  range: string,
): { fromRow: number; fromCol: number; toRow: number; toCol: number } | null {
  const raw = String(range ?? '').trim()
  const one = parseCellRef(raw)
  if (one) return { fromRow: one.row, fromCol: one.column, toRow: one.row, toCol: one.column }
  const parts = raw.split(':')
  if (parts.length !== 2) return null
  const [leftRef, rightRef] = parts
  if (!leftRef || !rightRef) return null
  const a = parseCellRef(leftRef)
  const b = parseCellRef(rightRef)
  if (!a || !b) return null
  return {
    fromRow: Math.min(a.row, b.row),
    toRow: Math.max(a.row, b.row),
    fromCol: Math.min(a.column, b.column),
    toCol: Math.max(a.column, b.column),
  }
}

function addressOf(row: number, col: number): string {
  return `${numberToCol(col)}${row}`
}

// =============================================================================
// 公式引用抽取(判据单源:上层与测试都只认这一份)
// =============================================================================

const SHEET_QUAL = String.raw`(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_.]*))!`

/**
 * 公式引用抽取(保守档)。
 *
 * 先剥字符串字面量,再依次识别:
 *  ① 整列 `A:A` / `Sheet2!B:C`(先摘,免得被区间档误读成单格)
 *  ② 单格与区间 `A1` / `$A$1` / `Sheet1!A1` / `'My Sheet'!A1:B9`
 * 剩下疑似 R1C1(`RC[-1]`)与跨簿引用(`[book.xlsx]`)⇒ 标 `unjudged`,交给"多要一次说明"
 * 的失效方向(AGENTS §0.10),**绝不判成"肯定不影响"**。
 */
function parseFormulaRefs(formula: string): {
  refs: FormulaRef[]
  colRefs: Array<{ sheet: string | null; fromCol: number; toCol: number }>
  unjudged: boolean
} {
  const stripped = String(formula).replace(/"(?:[^"\\]|\\.)*"/g, ' ')
  const refs: FormulaRef[] = []
  const colRefs: Array<{ sheet: string | null; fromCol: number; toCol: number }> = []
  const unjudged = /R\d*C\d*|RC\[-?\d+\]|\[[^\]]+\]/i.test(stripped)
  let rest = stripped

  const colRe = new RegExp(String.raw`(?:${SHEET_QUAL})?\$?([A-Z]{1,3}):\$?([A-Z]{1,3})`, 'gi')
  let cm: RegExpExecArray | null
  while ((cm = colRe.exec(rest)) !== null) {
    const spanFrom = cm[3]
    const spanTo = cm[4]
    if (!spanFrom || !spanTo) continue
    const fromCol = colToNumber(spanFrom)
    const toCol = colToNumber(spanTo)
    if (!Number.isFinite(fromCol) || !Number.isFinite(toCol)) continue
    colRefs.push({ sheet: cm[1] ?? cm[2] ?? null, fromCol, toCol })
    // 摘掉已消费的整列引用,后续单格档不会再把它读成两个单格
    rest = `${rest.slice(0, cm.index)}${' '.repeat(cm[0].length)}${rest.slice(cm.index + cm[0].length)}`
    colRe.lastIndex = cm.index + cm[0].length
  }

  const refRe = new RegExp(
    String.raw`(?:${SHEET_QUAL})?\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6})(?::\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6}))?`,
    'gi',
  )
  let m: RegExpExecArray | null
  while ((m = refRe.exec(rest)) !== null) {
    const startCol = m[3]
    if (!startCol) continue
    const fromCol = colToNumber(startCol)
    const toCol = m[5] ? colToNumber(m[5]) : fromCol
    const fromRow = Number(m[4])
    const toRow = m[6] ? Number(m[6]) : fromRow
    if (!Number.isFinite(fromCol) || !Number.isFinite(toCol)) continue
    refs.push({
      sheet: m[1] ?? m[2] ?? null,
      fromRow: Math.min(fromRow, toRow),
      toRow: Math.max(fromRow, toRow),
      fromCol: Math.min(fromCol, toCol),
      toCol: Math.max(fromCol, toCol),
    })
  }
  return { refs, colRefs, unjudged }
}

/** 取公式原文(普通式 + 共享式);非公式格返回 null。 */
function formulaOf(cell: ExcelJS.Cell): string | null {
  const v = cell.value as unknown
  if (v && typeof v === 'object') {
    const o = v as { formula?: unknown; sharedFormula?: unknown }
    const raw = typeof o.formula === 'string' && o.formula ? o.formula : o.sharedFormula
    if (typeof raw === 'string' && raw.length > 0) return raw.replace(/^=/, '')
  }
  if (cell.type === ExcelJS.ValueType.Formula) {
    const f = cell.formula
    if (typeof f === 'string' && f.length > 0) return f.replace(/^=/, '')
  }
  return null
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function loadWorkbook(bytes: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  // exceljs 的 index.d.ts 顶部写了 `declare interface Buffer extends ArrayBuffer {}`,
  // 与 @types/node 的全局 Buffer 合并后 load() 参数类型不兼容 ⇒ 同 excel-export-service.ts
  // 的既有处置:经宽松签名调用(取用形态同源,不另立判据)。
  const loader = wb.xlsx as unknown as {
    load: (data: Uint8Array | ArrayBuffer | Buffer) => Promise<ExcelJS.Workbook>
  }
  return loader.load(bytes)
}

/** 遍历全簿公式格;超大表/超上限 ⇒ truncated=true(判"没扫完",不是"没有公式")。 */
function indexFormulaCells(wb: ExcelJS.Workbook): {
  cells: FormulaCellIndex[]
  truncated: boolean
} {
  const cells: FormulaCellIndex[] = []
  let truncated = false
  outer: for (const ws of wb.worksheets) {
    const maxRow = ws.rowCount || 0
    const maxCol = ws.columnCount || 0
    if (maxRow * maxCol > MAX_SHEET_CELLS) {
      truncated = true
      continue
    }
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const cell = ws.getCell(r, c)
        const formula = formulaOf(cell)
        if (formula === null) continue
        if (cells.length >= MAX_FORMULA_SCAN_CELLS) {
          truncated = true
          break outer
        }
        const { refs, colRefs, unjudged } = parseFormulaRefs(formula)
        cells.push({
          sheet: ws.name,
          address: addressOf(r, c),
          formula,
          refs,
          colRefs,
          unjudged,
        })
      }
    }
  }
  return { cells, truncated }
}

/** 值归一:只回标量,复杂形态(richText/hyperlink/日期)归一为字符串。 */
function scalarOf(cell: ExcelJS.Cell): string | number | boolean | null {
  const v = cell.value as unknown
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return o.richText
        .map((t) =>
          t && typeof t === 'object' ? String((t as { text?: unknown }).text ?? '') : '',
        )
        .join('')
    }
    if ('hyperlink' in o && typeof o.text === 'string') return o.text
    if ('text' in o && typeof o.text === 'string') return o.text
  }
  return String(v)
}

function readCell(cell: ExcelJS.Cell): WorkbookCellRead {
  const address = cell.address
  const formula = formulaOf(cell)
  if (formula !== null) {
    // 红线 1:缓存值绝不冒充当前值 ⇒ 回公式原文 + 明写未重算
    return {
      address,
      kind: 'formula',
      value: null,
      formula,
      state: 'formula-uncomputed',
      cachedValueWithheld: true,
    }
  }
  const v = cell.value as unknown
  if (v && typeof v === 'object' && 'error' in v) {
    return {
      address,
      kind: 'error',
      value: null,
      errorText: String((v as { error?: unknown }).error),
    }
  }
  if (cell.isMerged && cell.master && cell.master.address !== address) {
    return { address, kind: 'merged', value: null, masterAddress: cell.master.address }
  }
  if (v === null || v === undefined || v === '') {
    return { address, kind: 'empty', value: null }
  }
  return { address, kind: 'value', value: scalarOf(cell) }
}

// =============================================================================
// 会话生命周期
// =============================================================================

function removeSession(handle: string): void {
  const s = _sessions.get(handle)
  if (!s) return
  _sessions.delete(handle)
  const bucket = _handlesBySubject.get(s.subjectId)
  if (!bucket) return
  bucket.delete(handle)
  if (bucket.size === 0) _handlesBySubject.delete(s.subjectId)
}

/**
 * 丢弃会话名下的输出文件(F-415):会话 TTL 到期后,保存产物随之回收。
 * 删除失败只说明盘上残留,不能反过来把会话留在表里冒充"还活着"。
 */
function discardSessionSavedFiles(s: WorkbookSession): void {
  const ids = [s.savedSlotFileId, ...s.savedFileIds].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )
  for (const id of new Set(ids)) {
    try {
      deleteFile(id)
    } catch {
      // 删不掉不影响会话清理结论(会话本身已过期,不做补偿)
    }
  }
  s.savedSlotFileId = null
  s.savedFileIds = []
}

/**
 * 过期清理(TTL):删掉空闲超时的会话,并回收其保存产物。不碰原档文件。
 * 返回清理条数(测试/运维可直接调用;open / 取句柄时也会惰性调用)。
 */
export function sweepExpiredWorkbookSessions(now: number = Date.now()): number {
  let removed = 0
  for (const [handle, s] of _sessions) {
    if (now - s.lastUsedAt > SESSION_IDLE_TTL_MS) {
      discardSessionSavedFiles(s)
      removeSession(handle)
      removed++
    }
  }
  return removed
}

function pruneSessions(now: number): void {
  sweepExpiredWorkbookSessions(now)
}

/**
 * 超额逐出:只在 `subjectId` 自己的会话桶里按 lastUsedAt 淘汰最旧者(F-414)。
 * 这里**没有**任何全局 FIFO —— 跨主体逐出会让单用户挤掉他人未保存的会话。
 */
function evictWithinSubject(subjectId: string): void {
  const bucket = _handlesBySubject.get(subjectId)
  if (!bucket) return
  while (bucket.size > MAX_SESSIONS_PER_SUBJECT) {
    let oldestHandle: string | null = null
    let oldest = Infinity
    for (const handle of bucket) {
      const s = _sessions.get(handle)
      if (!s) continue
      if (s.lastUsedAt < oldest) {
        oldest = s.lastUsedAt
        oldestHandle = handle
      }
    }
    if (oldestHandle === null) break
    removeSession(oldestHandle)
  }
}

type SessionTake =
  { ok: true; session: WorkbookSession } | { ok: false; error: WorkbookResult<never> }

/** 句柄取回:不存在/已过期/已被淘汰 ⇒ 显式未判定(不猜它是什么);跨主体 ⇒ 拒且零副作用。 */
function takeSession(handle: string, subjectId: string): SessionTake {
  pruneSessions(Date.now())
  const s = _sessions.get(String(handle ?? ''))
  if (!s) {
    return {
      ok: false,
      error: fail(
        'WORKBOOK_HANDLE_UNDETERMINED',
        '句柄不存在或已失效:无法判定它当时打开的是哪份工作簿、有没有未保存的改动 ⇒ 未判定(需重新 open)',
        { handle, protocolVersion: WORKBOOK_PROTOCOL_VERSION },
      ),
    }
  }
  if (s.subjectId !== subjectId) {
    // 句柄属别人:零副作用直接拒,连"它是哪份工作簿"都不透露
    return {
      ok: false,
      error: fail('WORKBOOK_FORBIDDEN_OWNER', '该会话不属于当前主体', {
        protocolVersion: WORKBOOK_PROTOCOL_VERSION,
      }),
    }
  }
  s.lastUsedAt = Date.now()
  return { ok: true, session: s }
}

/** 改动格的去重键:sheet 名可含空格/中文/冒号,用 NUL 分隔,避免拼接歧义。 */
function touchedKeyOf(sheet: string, row: number, column: number): string {
  return `${sheet}\u0000${row}:${column}`
}

/** 单格对单个公式格的判据(优先级与原全量实现一致:unjudged → 整列 → 单格/区间)。 */
function hitVia(
  f: FormulaCellIndex,
  t: { sheet: string; row: number; column: number },
): StaleFormulaCell['via'] | null {
  if (f.unjudged) return f.sheet === t.sheet ? 'unjudged-pattern' : null
  for (const cr of f.colRefs) {
    const sheet = cr.sheet ?? f.sheet
    if (sheet === t.sheet && t.column >= cr.fromCol && t.column <= cr.toCol) return 'col-ref'
  }
  for (const r of f.refs) {
    const sheet = r.sheet ?? f.sheet
    if (sheet !== t.sheet) continue
    if (t.row >= r.fromRow && t.row <= r.toRow && t.column >= r.fromCol && t.column <= r.toCol) {
      return r.fromRow === r.toRow && r.fromCol === r.toCol ? 'cell-ref' : 'range-ref'
    }
  }
  return null
}

/**
 * 记录本批写入格(F-265):同一格只判一次,且只与「本批新增」格比对 ——
 * 单个新格对公式格是一次 O(formulaCells) 的**单层**扫描,已判定过的公式格不再重扫。
 *
 * 输出等价性:旧实现是"每个公式格 × 全部 touched 取最早命中";这里按写入顺序逐格补判、
 * 命中即归档且不覆盖,得到的公式集合与 via 与旧实现逐字相同,只是复杂度从
 * O(formulaCells × touched 总量) 降为 O(formulaCells × 本批新增数)。
 */
function recordTouched(s: WorkbookSession, sheet: string, row: number, column: number): void {
  const key = touchedKeyOf(sheet, row, column)
  if (s.touched.has(key)) return
  s.touched.add(key)
  for (let i = 0; i < s.formulaCells.length; i++) {
    if (s.staleFormulaHits.has(i)) continue
    const f = s.formulaCells[i]
    if (!f) continue
    const via = hitVia(f, { sheet, row, column })
    if (via) s.staleFormulaHits.set(i, { sheet: f.sheet, address: f.address, formula: f.formula, via })
  }
  // FIFO 淘汰最旧记录。命中结果已在写入当次折叠进 staleFormulaHits ⇒ 淘汰只放弃
  // "去重凭证",不影响受影响公式判定,无需退化全量重扫(F-265)。
  while (s.touched.size > MAX_TOUCHED_CELLS) {
    const oldest = s.touched.values().next()
    if (oldest.done) break
    s.touched.delete(oldest.value)
  }
}

/** 已判定结果按 formulaCells 下标排序回放(与旧实现"按公式格顺序输出"逐字一致)。 */
function affectedFormulaCells(s: WorkbookSession): {
  stale: StaleFormulaCell[]
  scanTruncated: boolean
} {
  const stale: StaleFormulaCell[] = []
  for (const i of [...s.staleFormulaHits.keys()].sort((a, b) => a - b)) {
    const hit = s.staleFormulaHits.get(i)
    if (hit) stale.push(hit)
  }
  return {
    stale,
    scanTruncated: s.scanTruncated || s.formulaCells.length >= MAX_FORMULA_SCAN_CELLS,
  }
}

function recalcView(s: WorkbookSession): {
  hasFormulas: boolean
  recalcUnsupported: boolean
  staleFormulaCells: StaleFormulaCell[]
  formulaScanTruncated: boolean
} {
  const { stale, scanTruncated } = affectedFormulaCells(s)
  return {
    hasFormulas: s.formulaCells.length > 0 || scanTruncated,
    // 波及到任何公式格 ⇒ 明写"未重算";扫描没做完只体现在 scanTruncated 维,不冒充"无影响"
    recalcUnsupported: stale.length > 0,
    staleFormulaCells: stale,
    formulaScanTruncated: scanTruncated,
  }
}

// =============================================================================
// 命令面(open / read_range / write_cells / save / close)
// =============================================================================

export interface OpenWorkbookData {
  handle: string
  fileId: string
  name: string
  sha256: string
  sheets: Array<{ name: string; rowCount: number; columnCount: number }>
  formulaCellCount: number
  hasFormulas: boolean
  formulaScanTruncated: boolean
  protocolVersion: number
}

/**
 * 异步读取工作簿字节(F-414):open 不再同步整文件读入,避免大档卡住事件循环。
 * 服务层单测的 storage 桩可能只提供同步 `readFile`(既有用例形态);用 `in` 探测能力,
 * 不直接读缺失的导出(桩在缺键属性访问时会抛错),生产实现恒走异步 I/O。
 */
async function readWorkbookBytes(fileId: string): Promise<Buffer | null> {
  if ('readFileAsync' in storageService) return storageService.readFileAsync(fileId)
  return readFile(fileId)
}

/** open:打开**已存在**的工作簿(按 storage 文件 id);归属由承载层入参显式给定。 */
export async function openWorkbook(params: {
  subjectId: string
  fileId: string
}): Promise<WorkbookResult<OpenWorkbookData>> {
  const subjectId = String(params?.subjectId ?? '').trim()
  const fileId = String(params?.fileId ?? '').trim()
  if (!USER_ID_RE.test(subjectId)) return fail('WORKBOOK_INVALID_INPUT', 'subjectId 形态非法')
  if (!USER_ID_RE.test(fileId)) return fail('WORKBOOK_INVALID_INPUT', 'fileId 形态非法')

  const info = getFileInfo(fileId)
  if (!info) return fail('WORKBOOK_FILE_NOT_FOUND', '工作簿文件不存在')
  const owner = (info.metadata as { ownerId?: unknown } | undefined)?.ownerId
  if (typeof owner !== 'string' || owner !== subjectId) {
    // 归属不符 ⇒ 与"不存在"同形回话(可枚举性收口);主体只认入参,不从元数据反推
    return fail('WORKBOOK_FILE_NOT_FOUND', '工作簿文件不存在')
  }

  // F-414 ①:扩展名白名单先于读盘 —— 只认 exceljs 能解析的 OOXML 工作簿。
  const meta = (info.metadata ?? {}) as { name?: unknown }
  const declaredName = typeof meta.name === 'string' ? meta.name : ''
  const ext = extname(declaredName).toLowerCase()
  if (!(WORKBOOK_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return fail(
      'WORKBOOK_FORMAT_UNSUPPORTED',
      `扩展名不在白名单内:${ext || '(缺失)'};仅接受 ${WORKBOOK_ALLOWED_EXTENSIONS.join(' / ')}`,
      { name: declaredName || null, allowedExtensions: [...WORKBOOK_ALLOWED_EXTENSIONS] },
    )
  }

  // F-414 ②:大小闸在读取前(getFileInfo 内部 statSync)⇒ 超限不读字节、不建模。
  if (Number.isFinite(info.size) && info.size > MAX_WORKBOOK_OPEN_BYTES) {
    return fail(
      'WORKBOOK_FILE_TOO_LARGE',
      `工作簿超过上限:${info.size} > ${MAX_WORKBOOK_OPEN_BYTES} 字节`,
      { size: info.size, limit: MAX_WORKBOOK_OPEN_BYTES },
    )
  }

  const bytes = await readWorkbookBytes(fileId)
  if (!bytes) {
    return fail('WORKBOOK_UNJUDGED', '元数据在、字节读不到:不判定,请人工核文件', { fileId })
  }
  // stat 与读取之间文件可能被换大(TOCTOU)⇒ 读后再核一次,口径与首次闸相同。
  if (bytes.length > MAX_WORKBOOK_OPEN_BYTES) {
    return fail(
      'WORKBOOK_FILE_TOO_LARGE',
      `工作簿超过上限:${bytes.length} > ${MAX_WORKBOOK_OPEN_BYTES} 字节`,
      { size: bytes.length, limit: MAX_WORKBOOK_OPEN_BYTES },
    )
  }

  let workbook: ExcelJS.Workbook
  try {
    workbook = await loadWorkbook(bytes)
  } catch (e) {
    return fail('WORKBOOK_FORMAT_UNSUPPORTED', 'xlsx 解析失败(非工作簿或已损坏)', {
      reason: String((e as Error)?.message ?? e),
    })
  }

  const { cells, truncated } = indexFormulaCells(workbook)
  const handle = randomBytes(16).toString('hex')
  const session: WorkbookSession = {
    handle,
    subjectId,
    sourceFileId: fileId,
    sourceName: declaredName || `${fileId}.xlsx`,
    sourceSha256: sha256(bytes),
    workbook,
    formulaCells: cells,
    scanTruncated: truncated,
    touched: new Set<string>(),
    staleFormulaHits: new Map<number, StaleFormulaCell>(),
    lastUsedAt: Date.now(),
    savedFileIds: [],
    savedSlotFileId: null,
    saveCount: 0,
    savedBytes: 0,
  }
  _sessions.set(handle, session)
  const bucket = _handlesBySubject.get(subjectId)
  if (bucket) bucket.add(handle)
  else _handlesBySubject.set(subjectId, new Set([handle]))
  pruneSessions(Date.now())
  // F-414 ③:超配额只在**本主体**内逐出最久未用者,绝不动别人的会话。
  evictWithinSubject(subjectId)

  return {
    ok: true,
    data: {
      handle,
      fileId,
      name: session.sourceName,
      sha256: session.sourceSha256,
      sheets: workbook.worksheets.map((ws) => ({
        name: ws.name,
        rowCount: ws.rowCount || 0,
        columnCount: ws.columnCount || 0,
      })),
      formulaCellCount: cells.length,
      hasFormulas: cells.length > 0 || truncated,
      formulaScanTruncated: truncated,
      protocolVersion: WORKBOOK_PROTOCOL_VERSION,
    },
  }
}

export interface ReadRangeData {
  sheet: string
  range: string
  cellCount: number
  formulaCellCount: number
  cells: WorkbookCellRead[]
}

/** read_range:按区域回格;公式格只回公式原文 + `formula-uncomputed`,**不回缓存值**。 */
export function readRange(params: {
  subjectId: string
  handle: string
  sheet: string
  range: string
}): WorkbookResult<ReadRangeData> {
  const take = takeSession(params?.handle, params?.subjectId)
  if (!take.ok) return take.error
  const s = take.session
  const bounds = parseRangeRef(params.range)
  if (!bounds) return fail('WORKBOOK_INVALID_INPUT', 'range 形态非法(需 A1 或 A1:C10)')
  const cellCount = (bounds.toRow - bounds.fromRow + 1) * (bounds.toCol - bounds.fromCol + 1)
  if (cellCount > MAX_RANGE_CELLS) {
    return fail('WORKBOOK_RANGE_TOO_LARGE', `区域过大:${cellCount} > ${MAX_RANGE_CELLS} 格`, {
      cellCount,
      limit: MAX_RANGE_CELLS,
    })
  }
  const ws = s.workbook.getWorksheet(params.sheet)
  if (!ws) return fail('WORKBOOK_INVALID_INPUT', `工作表不存在: ${params.sheet}`)

  const cells: WorkbookCellRead[] = []
  let formulaCellCount = 0
  for (let r = bounds.fromRow; r <= bounds.toRow; r++) {
    for (let c = bounds.fromCol; c <= bounds.toCol; c++) {
      const read = readCell(ws.getCell(r, c))
      if (read.kind === 'formula') formulaCellCount++
      cells.push(read)
    }
  }
  return {
    ok: true,
    data: {
      sheet: params.sheet,
      range: params.range,
      cellCount: cells.length,
      formulaCellCount,
      cells,
    },
  }
}

export interface WriteCellsData {
  sheet: string
  writtenCells: number
  hasFormulas: boolean
  recalcUnsupported: boolean
  staleFormulaCells: StaleFormulaCell[]
  formulaScanTruncated: boolean
}

/** write_cells:改内存模型;目标格本身是公式 ⇒ 整批拒写(不静默把公式换成静态值)。 */
export function writeCells(params: {
  subjectId: string
  handle: string
  sheet: string
  cells: WriteCellInput[]
}): WorkbookResult<WriteCellsData> {
  const take = takeSession(params?.handle, params?.subjectId)
  if (!take.ok) return take.error
  const s = take.session
  const ws = s.workbook.getWorksheet(params.sheet)
  if (!ws) return fail('WORKBOOK_INVALID_INPUT', `工作表不存在: ${params.sheet}`)
  const list = Array.isArray(params.cells) ? params.cells : []
  if (list.length === 0) return fail('WORKBOOK_INVALID_INPUT', 'cells 不能为空')
  if (list.length > MAX_WRITE_CELLS) {
    return fail('WORKBOOK_INVALID_INPUT', `cells 上限 ${MAX_WRITE_CELLS} 格,本次 ${list.length}`)
  }

  // -- 先全量核验(任一不合格 ⇒ 一格都不写) --
  const planned: Array<{ row: number; column: number; value: string | number | boolean | null }> =
    []
  const formulaTargets: string[] = []
  for (const item of list) {
    const ref = parseCellRef(String(item?.address ?? ''))
    if (!ref) return fail('WORKBOOK_INVALID_INPUT', `address 形态非法: ${String(item?.address)}`)
    const cell = ws.getCell(ref.row, ref.column)
    if (formulaOf(cell) !== null) formulaTargets.push(cell.address)
    const value = item.value
    if (
      value !== null &&
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      return fail(
        'WORKBOOK_INVALID_INPUT',
        `value 只支持 string|number|boolean|null: ${cell.address}`,
      )
    }
    planned.push({ row: ref.row, column: ref.column, value })
  }
  if (formulaTargets.length > 0) {
    return fail(
      'WORKBOOK_FORMULA_OVERWRITE',
      '目标格含公式:覆盖会把公式语义换成静态值,本层不做 —— 请改判非公式格,或让人在带引擎的工具里处理',
      { sheet: params.sheet, formulaTargets },
    )
  }

  // -- 落写(整批一次,无部分写) --
  for (const p of planned) {
    ws.getCell(p.row, p.column).value = p.value
    recordTouched(s, params.sheet, p.row, p.column)
  }
  const view = recalcView(s)
  return { ok: true, data: { sheet: params.sheet, writtenCells: planned.length, ...view } }
}

export interface SaveWorkbookData {
  savedFileId: string
  name: string
  bytes: number
  sourceFileId: string
  sourceSha256Before: string
  sourceSha256After: string
  sourceUntouched: true
  hasFormulas: boolean
  recalcUnsupported: boolean
  staleFormulaCells: StaleFormulaCell[]
  formulaScanTruncated: boolean
}

/**
 * save:**非破坏式保存** —— 只写新 storage 文件,原档一字节不动。
 *
 * 三重自证:① 目标 id ≠ 原档 id 且目标当前不存在;② 落盘前复验原档 sha256 与打开时一致;
 * ③ 落盘后再读一次原档并比对 sha256。任一不成立 ⇒ 不落盘/点名,不吞。
 *
 * F-415(配额与生命周期):
 * - 同会话只保留**一份**输出 —— 新档落定后才删上一版槽位文件,写失败不会先毁掉旧版;
 * - 会话内保存次数(`MAX_SAVES_PER_SESSION`)与累计写出字节(`MAX_SAVED_BYTES_PER_SESSION`)
 *   都有硬上限,超限具名拒且在落盘前拒;
 * - 落盘失败 / 自证失败 ⇒ 先删掉这次写出的半成品再报错,不给盘上留残档;
 * - 输出文件挂在会话上,TTL 到期由 `sweepExpiredWorkbookSessions` 一并回收。
 */
export async function saveWorkbook(params: {
  subjectId: string
  handle: string
  name?: string
}): Promise<WorkbookResult<SaveWorkbookData>> {
  const take = takeSession(params?.handle, params?.subjectId)
  if (!take.ok) return take.error
  const s = take.session

  if (s.saveCount >= MAX_SAVES_PER_SESSION) {
    return fail(
      'WORKBOOK_SAVE_LIMIT_EXCEEDED',
      `本会话保存次数已达上限 ${MAX_SAVES_PER_SESSION} 次,请 close 后重新 open 再存`,
      { saveCount: s.saveCount, limit: MAX_SAVES_PER_SESSION },
    )
  }
  if (s.savedBytes >= MAX_SAVED_BYTES_PER_SESSION) {
    return fail(
      'WORKBOOK_SAVE_BYTES_EXCEEDED',
      `本会话累计保存字节已达上限 ${MAX_SAVED_BYTES_PER_SESSION},请 close 后重新 open 再存`,
      { savedBytes: s.savedBytes, limit: MAX_SAVED_BYTES_PER_SESSION },
    )
  }

  const before = readFile(s.sourceFileId)
  if (!before) {
    return fail('WORKBOOK_UNJUDGED', '原档字节读不到:无法自证未覆盖,拒绝保存', {
      sourceFileId: s.sourceFileId,
    })
  }
  const beforeSha = sha256(before)
  if (beforeSha !== s.sourceSha256) {
    return fail(
      'WORKBOOK_SOURCE_CHANGED',
      '原档在本次打开之后被别处改动:内存模型已不可信,拒绝落新档',
      {
        sourceFileId: s.sourceFileId,
        openedSha: s.sourceSha256,
        currentSha: beforeSha,
      },
    )
  }

  const buffer = Buffer.from(await s.workbook.xlsx.writeBuffer())
  if (s.savedBytes + buffer.length > MAX_SAVED_BYTES_PER_SESSION) {
    return fail(
      'WORKBOOK_SAVE_BYTES_EXCEEDED',
      `本次保存 ${buffer.length} 字节会超过本会话累计上限 ${MAX_SAVED_BYTES_PER_SESSION}`,
      { savedBytes: s.savedBytes, bytes: buffer.length, limit: MAX_SAVED_BYTES_PER_SESSION },
    )
  }

  const previousSlot = s.savedSlotFileId
  let newFileId = generateFileId()
  for (
    let guard = 0;
    newFileId === s.sourceFileId || newFileId === previousSlot || getFileInfo(newFileId);
    guard++
  ) {
    if (guard >= 8) {
      return fail('WORKBOOK_UNJUDGED', '新档落点无法确认(重试 8 次仍碰撞),拒绝保存', {
        sourceFileId: s.sourceFileId,
      })
    }
    newFileId = generateFileId()
  }

  const name = sanitizeName(params.name, s.sourceName)
  try {
    saveFile(buffer, newFileId, {
      kind: 'ihui-workbook',
      ownerId: s.subjectId,
      name,
      sourceFileId: s.sourceFileId,
      savedAt: new Date().toISOString(),
      protocolVersion: WORKBOOK_PROTOCOL_VERSION,
    })
  } catch (e) {
    // 写盘失败可能已落下半截文件 ⇒ 先清掉再报,不给下一位留残档
    try {
      deleteFile(newFileId)
    } catch {
      // 清理失败不影响"本次保存未成功"的结论
    }
    return fail('WORKBOOK_UNJUDGED', '新档落盘失败:已清理半成品,拒绝保存', {
      sourceFileId: s.sourceFileId,
      reason: String((e as Error)?.message ?? e),
    })
  }

  const after = readFile(s.sourceFileId)
  const afterSha = after ? sha256(after) : ''
  if (!after || afterSha !== s.sourceSha256) {
    // 新档已落,但原档被动过 ⇒ 本层最不该发生的事,必须点名而不是吞下;半成品先删
    try {
      deleteFile(newFileId)
    } catch {
      // 删不掉也要如实点名(见 detail.savedFileId)
    }
    return fail('WORKBOOK_SOURCE_CHANGED', '新档已落,但原档字节与打开时不一致(立即人工核)', {
      sourceFileId: s.sourceFileId,
      openedSha: s.sourceSha256,
      currentSha: afterSha,
      savedFileId: newFileId,
    })
  }

  // 覆盖上一版本:新档已确认可读,才删旧槽位 ⇒ 中途失败时旧版仍在
  if (previousSlot && previousSlot !== newFileId) {
    try {
      deleteFile(previousSlot)
    } catch {
      // 旧版删不掉不影响本次成功;新档已落,残留留给运维清理
    }
  }
  s.savedSlotFileId = newFileId
  s.savedFileIds = [newFileId]
  s.saveCount += 1
  s.savedBytes += buffer.length

  const view = recalcView(s)
  return {
    ok: true,
    data: {
      savedFileId: newFileId,
      name,
      bytes: buffer.length,
      sourceFileId: s.sourceFileId,
      sourceSha256Before: beforeSha,
      sourceSha256After: afterSha,
      sourceUntouched: true,
      ...view,
    },
  }
}

/** close:释放会话。已关闭/未知句柄再访问 ⇒ 一律「未判定」。 */
export function closeWorkbook(params: {
  subjectId: string
  handle: string
}): WorkbookResult<{ closed: true; savedFileIds: string[] }> {
  const take = takeSession(params?.handle, params?.subjectId)
  if (!take.ok) return take.error
  const s = take.session
  const savedFileIds = [...s.savedFileIds]
  removeSession(s.handle)
  return { ok: true, data: { closed: true, savedFileIds } }
}

/** 测试/运维用:清空会话表(不影响盘上文件)。 */
export function resetWorkbookSessions(): void {
  _sessions.clear()
  _handlesBySubject.clear()
}

function sanitizeName(raw: string | undefined, fallback: string): string {
  const base = String(raw ?? fallback ?? 'workbook.xlsx').trim() || 'workbook.xlsx'
  const cleaned = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 200)
  return /\.(xlsx|xlsm)$/i.test(cleaned) ? cleaned : `${cleaned}.xlsx`
}

export const __test__ = {
  parseCellRef,
  parseRangeRef,
  parseFormulaRefs,
  indexFormulaCells,
  formulaOf,
  readCell,
  sessions: _sessions,
  handlesBySubject: _handlesBySubject,
  MAX_SESSIONS_PER_SUBJECT,
  MAX_WORKBOOK_OPEN_BYTES,
  WORKBOOK_ALLOWED_EXTENSIONS,
  SESSION_IDLE_TTL_MS,
  MAX_TOUCHED_CELLS,
  MAX_WRITE_CELLS,
  MAX_SAVES_PER_SESSION,
  MAX_SAVED_BYTES_PER_SESSION,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
