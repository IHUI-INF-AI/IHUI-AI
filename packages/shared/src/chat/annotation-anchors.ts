// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D91 四类文档批注锚点分型(G-124,2026-09-24 立;扩展 D87 回复批注)
//
// **自证结论(改本文件前先读)**:D87 `ReplyAnnotationLayer`
// (apps/web/src/components/ai/reply-annotation.tsx)已落的是 **AI 回复文本选区**批注
// (anchorText 指纹锚定,valid/invalid 两态),与文档坐标无关;D22 事件族
// `ihui:add-text-reference` 只承载纯文本引用。四类文档坐标 ——
// PDF 页 / PPTX 张+元素 / DOCX 页 / XLSX 表+选区 —— **全仓没有任何锚点形状**,
// 也没有「添加到任务」的统一动作载体,本模块补的正是这一层。
//
// 本模块是四类坐标与锚点生命周期的**唯一真相源**,与 D71 `turn-status` / D72
// `worktree-lifecycle` 同范式:常量 + 纯函数 + 穷尽 switch 零 default + `assertNever`。
//
// **单一状态机(本票硬约束)**:四类共用同一套 `ANNOTATION_ANCHOR_STATES` +
// `applyAnchorAction`,状态机对 `kind` **无感** —— 禁止为四类各写一套批注状态机,
// 禁止在端内另建第二套锚点状态判定;新增 kind 只扩 `ANNOTATION_ANCHOR_KINDS`
// 与 `anchorLabel` 的 switch 分支,生命周期零改动。
//
// 坐标文案与任务原文逐字对齐(词包 `ai.pane.annotationAnchors.label`):
//   PDF  : `PDF 第 {page} 页`
//   PPTX : `第 {slide} 张 · {element}` + 次标签 `批注 {element}`
//   DOCX : `文档第 {page} 页`
//   XLSX : `{sheet} · {range}` + 次标签 `已选择 {range}`
// 统一动作是「描述希望 Agent 修改或检查的内容」→ `添加到任务`,并支持 取消/删除。

/** 四类文档批注锚点分型(取值即词包 `ai.pane.annotationAnchors.label` 的坐标分型) */
export const ANNOTATION_ANCHOR_KINDS = ['pdf', 'pptx', 'docx', 'xlsx'] as const
export type AnnotationAnchorKind = (typeof ANNOTATION_ANCHOR_KINDS)[number]

/** 四类共用的锚点坐标(PDF/DOCX 用 page,PPTX 用 slide+element,XLSX 用 sheet+range) */
export interface AnnotationAnchor {
  readonly kind: AnnotationAnchorKind
  /** PDF / DOCX 页码(1 起) */
  readonly page?: number
  /** PPTX 张号(1 起) */
  readonly slide?: number
  /** PPTX 元素名(文本框 / 图形 / 表格…) */
  readonly element?: string
  /** XLSX 工作表名 */
  readonly sheet?: string
  /** XLSX 选区(如 `A1:C9`) */
  readonly range?: string
}

/**
 * 锚点生命周期五态 —— **四类共用这一套,绝不按 kind 分叉**:
 *   idle      尚未记录坐标(入口可见、还没圈选)
 *   labeled   已记录坐标,可填写备注并「添加到任务」
 *   added     已添加到任务(经统一动作「描述希望 Agent 修改或检查的内容」提交)
 *   cancelled 已取消(可重新标注 —— 与 deleted 的本质区别)
 *   deleted   已删除(**唯一终态**,不可再回到任何态)
 */
export const ANNOTATION_ANCHOR_STATES = [
  'idle',
  'labeled',
  'added',
  'cancelled',
  'deleted',
] as const
export type AnnotationAnchorState = (typeof ANNOTATION_ANCHOR_STATES)[number]

/**
 * 锚点动作族:
 *   label    记录/改记坐标(idle / cancelled / labeled ⇒ labeled;added 已入任务不退回)
 *   add      添加到任务(统一动作的提交;仅 labeled ⇒ added,重复 add 幂等)
 *   cancel   取消(labeled / added ⇒ cancelled;added 撤下后仍可重新标注)
 *   delete   删除(labeled / added / cancelled ⇒ deleted;**删除是终态**)
 *   relabel  取消后重新标注(cancelled / labeled ⇒ labeled;deleted 不可)
 */
export const ANNOTATION_ANCHOR_ACTIONS = ['label', 'add', 'cancel', 'delete', 'relabel'] as const
export type AnnotationAnchorAction = (typeof ANNOTATION_ANCHOR_ACTIONS)[number]

/**
 * 动作 → 下一态的**唯一**派发点(穷尽 switch **无 default**)。
 *
 * 非法转移返回原状态(不臆断、不抛错):调用方据返回值是否变化即可感知合法性。
 * 漏改任一动作 ⇒ `action` 无法收窄为 `never`,`assertNeverAction` 处编译失败。
 */
export function applyAnchorAction(
  state: AnnotationAnchorState,
  action: AnnotationAnchorAction,
): AnnotationAnchorState {
  switch (action) {
    case 'label':
      // added 已入任务,label 不能把它打回(须先 cancel 撤下);deleted 是终态
      return state === 'idle' || state === 'cancelled' || state === 'labeled' ? 'labeled' : state
    case 'add':
      // 仅 labeled 可添加;重复 add 幂等;idle 无坐标、cancelled 须先 relabel
      return state === 'labeled' || state === 'added' ? 'added' : state
    case 'cancel':
      // added 的取消 = 撤下,回到可重新标注的 cancelled(与 deleted 不同形)
      return state === 'labeled' || state === 'added' ? 'cancelled' : state
    case 'delete':
      // 删除是终态:三个非终态都可直达 deleted;deleted 保持
      return state === 'labeled' || state === 'added' || state === 'cancelled'
        ? 'deleted'
        : state
    case 'relabel':
      // cancelled 重新标注回 labeled;labeled 改坐标仍是 labeled;deleted 不可
      return state === 'cancelled' || state === 'labeled' ? 'labeled' : state
  }
  return assertNeverAction(action)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverAction(action: never): never {
  throw new Error(`unhandled anchor action: ${String(action)}`)
}

/** 终态判定:唯一终态是 deleted(与 D87 valid/invalid 的"失效可恢复"不同形) */
export function isTerminalAnchorState(state: AnnotationAnchorState): boolean {
  return state === 'deleted'
}

/**
 * 可重新标注判据:
 *   - `deleted` 终态 ⇒ 不可(删除是终态);
 *   - `added` 已入任务 ⇒ 不可直接重标(须先 cancel 撤下);
 *   - `idle` / `labeled` / `cancelled` ⇒ 可。
 */
export function canRelabel(state: AnnotationAnchorState): boolean {
  return state !== 'deleted' && state !== 'added'
}

/** 词包命名空间(web 侧 `useTranslations('ai.pane.annotationAnchors')`) */
export const ANNOTATION_ANCHORS_NAMESPACE = 'ai.pane.annotationAnchors' as const

/** 标签 id:四类坐标主标签 + PPTX/XLSX 的次标签(批注 {element} / 已选择 {range})+ 退化形 */
export const ANNOTATION_ANCHOR_LABEL_IDS = [
  'pdf',
  'docx',
  'pptx',
  'pptxSlide',
  'pptxComment',
  'xlsx',
  'xlsxSheet',
  'xlsxSelected',
] as const
export type AnnotationAnchorLabelId = (typeof ANNOTATION_ANCHOR_LABEL_IDS)[number]

export type AnchorLabelI18nKey = `label.${AnnotationAnchorLabelId}`

/** 标签 id → i18n 键名(`ai.pane.annotationAnchors.label.<id>`) */
export function annotationAnchorLabelKey(id: AnnotationAnchorLabelId): AnchorLabelI18nKey {
  return `label.${id}`
}

export interface AnchorLabelPart {
  /** 词包内完整键,如 `label.pdf` */
  readonly key: AnchorLabelI18nKey
  /** 键的 id 部分(渲染件按 id 建穷尽映射,规避动态 t() 键的类型失配) */
  readonly id: AnnotationAnchorLabelId
  /** 插值(page / slide / element / sheet / range) */
  readonly values: Readonly<Record<string, string | number | undefined>>
}

export interface AnchorLabel {
  /** 坐标主标签(四类各自的 `PDF 第 {page} 页` 等) */
  readonly key: AnchorLabelI18nKey
  readonly id: AnnotationAnchorLabelId
  readonly values: Readonly<Record<string, string | number | undefined>>
  /** 次标签:PPTX 有 element ⇒ `批注 {element}`;XLSX 有 range ⇒ `已选择 {range}` */
  readonly secondary?: AnchorLabelPart
}

/**
 * 锚点 → 标签键与插值的**唯一**派发点。
 *
 * switch 穷尽四类、**无 default**:漏改任一类 ⇒ `anchor.kind` 无法收窄为 `never`,
 * `assertNeverKind` 处编译失败。文案与任务原文逐字对齐;PPTX 无 element / XLSX 无
 * range 时退化为原文前缀形(`第 {slide} 张` / `{sheet}`),不自创措辞。
 */
export function anchorLabel(anchor: AnnotationAnchor): AnchorLabel {
  switch (anchor.kind) {
    case 'pdf':
      // 原文:PDF 第 {page} 页
      return {
        key: annotationAnchorLabelKey('pdf'),
        id: 'pdf',
        values: { page: anchor.page },
      }
    case 'pptx':
      // 原文:第 {slide} 张 · {element};次标签:批注 {element}
      if (anchor.element) {
        return {
          key: annotationAnchorLabelKey('pptx'),
          id: 'pptx',
          values: { slide: anchor.slide, element: anchor.element },
          secondary: {
            key: annotationAnchorLabelKey('pptxComment'),
            id: 'pptxComment',
            values: { element: anchor.element },
          },
        }
      }
      return {
        key: annotationAnchorLabelKey('pptxSlide'),
        id: 'pptxSlide',
        values: { slide: anchor.slide },
      }
    case 'docx':
      // 原文:文档第 {page} 页
      return {
        key: annotationAnchorLabelKey('docx'),
        id: 'docx',
        values: { page: anchor.page },
      }
    case 'xlsx':
      // 原文:{sheet} · {range};次标签:已选择 {range}
      if (anchor.range) {
        return {
          key: annotationAnchorLabelKey('xlsx'),
          id: 'xlsx',
          values: { sheet: anchor.sheet, range: anchor.range },
          secondary: {
            key: annotationAnchorLabelKey('xlsxSelected'),
            id: 'xlsxSelected',
            values: { range: anchor.range },
          },
        }
      }
      return {
        key: annotationAnchorLabelKey('xlsxSheet'),
        id: 'xlsxSheet',
        values: { sheet: anchor.sheet },
      }
  }
  return assertNeverKind(anchor.kind)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverKind(kind: never): never {
  throw new Error(`unhandled anchor kind: ${String(kind)}`)
}

/**
 * 回流:锚点 + 备注 → 任务输入文本(统一动作「描述希望 Agent 修改或检查的内容」的载体)。
 *
 * `label` 由渲染层用 `anchorLabel` + 词包翻译好后传入(判定层不掺和翻译);
 * `label` 缺省/为空时回退到机器可读坐标 `fallbackAnchorCoords`(诊断用,非用户文案);
 * 备注为空 ⇒ 返回 null(不可凭空添加到任务)。格式:`[{坐标标签}] {备注}`。
 */
export function toTaskInput(
  anchor: AnnotationAnchor,
  note: string,
  label: string,
): string | null {
  const trimmed = note.trim()
  if (!trimmed) return null
  return `[${label.trim() || fallbackAnchorCoords(anchor)}] ${trimmed}`
}

/** 机器可读坐标(诊断/日志用,**不是**用户文案):label 缺省时 toTaskInput 的回退前缀 */
function fallbackAnchorCoords(anchor: AnnotationAnchor): string {
  switch (anchor.kind) {
    case 'pdf':
      return `pdf:p${anchor.page ?? '?'}`
    case 'pptx':
      return `pptx:s${anchor.slide ?? '?'}${anchor.element ? `:${anchor.element}` : ''}`
    case 'docx':
      return `docx:p${anchor.page ?? '?'}`
    case 'xlsx':
      return `xlsx:${anchor.sheet ?? '?'}!${anchor.range ?? '?'}`
  }
  return assertNeverKind(anchor.kind)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
