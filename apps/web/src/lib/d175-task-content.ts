// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D175 任务内容聚合(2026-09-30 立,对标竞品 `chatSession.highlights.group/emptyGroup`)。
 *
 * 竞品把整个任务全程产出的**文件 / 网页 / 来源**持续汇总成三组清单。本文件只做一件事:
 * 从**既有的**会话数据里把这三组抽出来 —— 不新增采集链、不落第二份存储、不发请求。
 *
 * 数据来源(全部为既有真相源,逐条给得出出处):
 *  - 产出:`ChatMessage.toolCalls[]` 里写类文件工具的路径对象。判定走共享层
 *    `describeToolCall().writesFile`(唯一白名单 = `@ihui/shared/chat` 的 `FILE_WRITE_TOOLS`),
 *    路径取同一函数算好的 `subject`(其 `SUBJECT_KEYS.path` 已覆盖 path/file_path/filePath/
 *    file/filename/target_file/dir/directory);另收 `summarize_artifacts` 工具回包的
 *    `summary_data.artifacts[].path`(web `ToolCall.summary_data` 既有字段)与媒体产物字段
 *    `image_url|video_url|audio_url`(SSE tool-result 顶层扁平化契约,BaseToolCall 既有字段)。
 *  - 网页查阅:`describeToolCall().subjectKind === 'url'` 的调用(已登记的 fetch_url/crawl_site/
 *    web_ui_navigate… 与未登记但 args 带 url 的 browser_* 都归到这里,后者由共享层
 *    `guessKind()` 兜底识别),不在本文件另立浏览器工具名单。
 *  - 来源:消息级 `ChatMessage.citations`(#11 Citations 全链路,SSE citations 事件写入,
 *    `CitationBar` 用的同一份)+ `summary_data.sources[]`。
 *
 * **禁止第二份映射**:工具名→类目已有两处单一真相源 —— `progress-sections/tool-category.ts`
 * 的 `resolveToolCategory()`(18 类目计数)与共享层 `tool-display.ts` 的 `describeToolCall()`
 * (对象类型 / 写类判定)。本票取后者,因为聚合要的是"这次调用产出的对象是什么",不是类目计数。
 *
 * 纯函数:不订阅 store、不读 i18n、不碰 DOM;组内按首次出现顺序保留时序,同一对象重复出现
 * 只留一条并累计 `count`(计数呈现由渲染层负责,文案不进本文件)。
 */

import { describeToolCall } from '@ihui/shared/chat'

/** 三组标识,与竞品键位同名:`group.artifact` / `group.browser` / (我方补的第三组标题位) `group.source` */
export type TaskContentGroupKey = 'artifact' | 'browser' | 'source'

/** 组序(逐字对齐票面顺序:产出 → 网页查阅 → 来源) */
export const TASK_CONTENT_GROUPS: readonly TaskContentGroupKey[] = ['artifact', 'browser', 'source']

/** 聚合输出的一条内容(三组共用同一形状,渲染层按组给标题) */
export interface TaskContentItem {
  /** 所属组 */
  group: TaskContentGroupKey
  /** 组内去重键(产出=归一后的路径或媒体 URL,网页=URL,来源=`source|url|label`) */
  key: string
  /** 主展示文本(路径 / URL / 引用标签) */
  label: string
  /** 可跳转链接(网页、带 URL 的来源与媒体产出才有;普通文件路径给 null) */
  href: string | null
  /** 产出/网页条目的本地化功能名键(taskStatus 命名空间,来自 `describeToolCall().nameKey`);无则 null */
  originNameKey: string | null
  /** 出处码名(没有本地化功能名时给渲染层兜底:原始工具码名 / `citations` / `artifacts` / `sources`) */
  originCode: string
  /** 同一对象在本次任务里出现的次数(>1 才由渲染层显示计数) */
  count: number
}

export interface TaskContentGroups {
  artifact: TaskContentItem[]
  browser: TaskContentItem[]
  source: TaskContentItem[]
}

/** 输入形状:结构最小化,既吃 web `ChatMessage[]`,也便于纯函数单测造样本 */
export interface TaskContentSummaryData {
  sources?: ReadonlyArray<{ type?: string; ref?: string; accessed_at?: string }>
  artifacts?: ReadonlyArray<{ type?: string; path?: string; created_at?: string }>
}

export interface TaskContentToolCallLike {
  toolName: string
  args?: Record<string, unknown> | null
  result?: unknown
  status?: string
  image_url?: string
  video_url?: string
  audio_url?: string
  /** summarize_artifacts 工具回包(web ToolCall 既有字段) */
  summary_data?: TaskContentSummaryData | null
}

export interface TaskContentCitationLike {
  source?: string
  label?: string
  url?: string
}

export interface TaskContentMessageLike {
  role?: string
  toolCalls?: readonly TaskContentToolCallLike[] | null
  citations?: readonly TaskContentCitationLike[] | null
}

const URL_RE = /^https?:\/\//i

/** 产出键归一:反斜杠不参与去重(同一文件在 Windows/macOS 下写法不同),两端空白与尾部斜杠去掉 */
function normalizeArtifactKey(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/+$/, '')
}

/** 聚合累加器:保序去重 + 计数(Map 的首次插入序即时序,更新计数不改变位置) */
class GroupAccumulator {
  private readonly order: string[] = []
  private readonly byKey = new Map<string, TaskContentItem>()

  constructor(private readonly group: TaskContentGroupKey) {}

  add(input: {
    key: string
    label: string
    href?: string | null
    originNameKey?: string | null
    originCode?: string
  }): void {
    if (input.key === '' || input.label === '') return
    const existing = this.byKey.get(input.key)
    if (existing) {
      existing.count += 1
      // 后到的同键条目若带来链接,补上(同名文件被写后再被浏览器打开时不丢跳转)
      if (!existing.href && input.href) existing.href = input.href
      return
    }
    this.byKey.set(input.key, {
      group: this.group,
      key: input.key,
      label: input.label,
      href: input.href ?? null,
      originNameKey: input.originNameKey ?? null,
      originCode: input.originCode ?? '',
      count: 1,
    })
    this.order.push(input.key)
  }

  items(): TaskContentItem[] {
    return this.order.map((k) => this.byKey.get(k)!)
  }
}

/**
 * 把整个任务的 toolCalls / citations 汇总为「产出 / 网页查阅 / 来源」三组清单。
 *
 * 时序 = 消息顺序 × 消息内工具调用顺序;跨消息的同名对象合并为一条并累计次数。
 */
export function aggregateTaskContent(
  messages: readonly TaskContentMessageLike[],
): TaskContentGroups {
  const artifact = new GroupAccumulator('artifact')
  const browser = new GroupAccumulator('browser')
  const source = new GroupAccumulator('source')

  for (const message of messages) {
    // ---- 来源①:消息级 citations(#11 全链路;CitationBar 用的同一份数据) ----
    for (const citation of message.citations ?? []) {
      const label = (citation.label ?? '').trim() || (citation.source ?? '').trim()
      const url = typeof citation.url === 'string' && URL_RE.test(citation.url) ? citation.url : null
      source.add({
        key: `${citation.source ?? ''}|${url ?? ''}|${label}`,
        label,
        href: url,
        originCode: citation.source ?? 'citations',
      })
    }

    for (const call of message.toolCalls ?? []) {
      const view = describeToolCall({
        toolName: call.toolName,
        args: call.args ?? undefined,
        result: call.result,
        status: call.status,
      })

      // ---- 产出:写类文件工具(`FILE_WRITE_TOOLS` 白名单在共享层,本处不另立名单) ----
      if (view.writesFile && view.subject !== '') {
        artifact.add({
          key: normalizeArtifactKey(view.subject),
          label: view.subject,
          originNameKey: view.nameKey,
          originCode: view.codeName,
        })
      }

      // ---- 网页查阅:对象是 URL 的调用(浏览器导航 / 抓取 / 可读页提取) ----
      // 写文件不算查阅;URL 形态由共享层 subjectKind 判定,媒体产出不在这条通道
      if (!view.writesFile && view.subjectKind === 'url' && URL_RE.test(view.subject)) {
        browser.add({
          key: view.subject,
          label: view.subject,
          href: view.subject,
          originNameKey: view.nameKey,
          originCode: view.codeName,
        })
      }

      // ---- 产出:媒体产物字段(图/视频/音频生成结果 URL) ----
      for (const media of [call.image_url, call.video_url, call.audio_url]) {
        if (typeof media !== 'string' || media === '') continue
        artifact.add({
          key: normalizeArtifactKey(media),
          label: media,
          href: URL_RE.test(media) ? media : null,
          originNameKey: view.nameKey,
          originCode: view.codeName,
        })
      }

      // ---- summarize_artifacts 回包:会话 artifacts/sources 台账(既有字段,非新采集) ----
      const summary = call.summary_data
      if (summary) {
        for (const item of summary.artifacts ?? []) {
          const path = (item.path ?? '').trim()
          if (path === '') continue
          artifact.add({
            key: normalizeArtifactKey(path),
            label: path,
            href: URL_RE.test(path) ? path : null,
            originNameKey: view.nameKey,
            originCode: item.type ? `artifacts:${item.type}` : 'artifacts',
          })
        }
        for (const item of summary.sources ?? []) {
          const ref = (item.ref ?? '').trim()
          if (ref === '') continue
          source.add({
            key: `${item.type ?? ''}|${ref}`,
            label: ref,
            href: URL_RE.test(ref) ? ref : null,
            originCode: item.type ? `sources:${item.type}` : 'sources',
          })
        }
      }
    }
  }

  return { artifact: artifact.items(), browser: browser.items(), source: source.items() }
}

/** 三组是否全空(全空才出 `empty` + `emptyDescription` 汇总空态) */
export function isTaskContentEmpty(groups: TaskContentGroups): boolean {
  return (
    groups.artifact.length === 0 && groups.browser.length === 0 && groups.source.length === 0
  )
}

/** 各组条目数(标题行计数用;不合成"总条数"这种无人要的数) */
export function taskContentGroupCounts(groups: TaskContentGroups): Record<TaskContentGroupKey, number> {
  return {
    artifact: groups.artifact.length,
    browser: groups.browser.length,
    source: groups.source.length,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
