// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui report agent-trace` 的取词词典(消费端注入)。
 *
 * 为什么词典住在 CLI 而不是语言包:AGENTS §19 要 shared 层零界面文案、取词一律注入;而
 * `packages/i18n/messages/**` 那五份 JSON 常年被他席占用(本票明令禁动)。故这里先落一个
 * 消费端自有词典,把"报告文案"与"语言包面"解耦。
 * **五语言已同批补齐**(zh-CN / zh-TW / en / ja / ko):表类型是 `Record<ReportLocale, Record<键联合, string>>`,
 * 少一语或少一键都编译期红,不靠人记。shared 层的缺键回显与"本地化欠账"区仍保留 ——
 * 那是给**未来新增键**用的兜底,不是给当前缺档遮丑。
 * 后续解锁:语言包面腾空后把这些键搬进 `messages/cli/*.json` 五语言同批,并删掉本文件(登记在交付档案残余表)。
 */
import { AGENT_REPORT_COPY_KEYS as K, type AgentReportCopyKey } from '@ihui/shared/reports'

type ReportLocale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko'

/** 缺任一键即编译期红(`Record<键联合, string>`),所以"补齐五语言"不是口头纪律 */
type CopyTable = Readonly<Record<AgentReportCopyKey, string>>

const ZH_CN: CopyTable = {
  [K.documentTitleSuffix]: '诊断报告',
  [K.sourceExportedAt]: '轨迹导出时刻',
  [K.localeLabel]: '语言',
  [K.timeZoneLabel]: '时区',
  [K.stepTotalLabel]: '步数',
  [K.kpiTitle]: '关键读数',
  [K.kpiSteps]: '调用步数',
  [K.kpiSuccess]: '成功',
  [K.kpiError]: '失败',
  [K.kpiCancelled]: '已取消',
  [K.kpiRunning]: '进行中',
  [K.kpiMeasured]: '有耗时步数',
  [K.kpiUnmeasured]: '缺耗时步数',
  [K.kpiMeasuredTotal]: '总耗时(仅已测步)',
  [K.kpiSlowest]: '最慢一步',
  [K.kpiSlowestShare]: '最慢步占比',
  [K.waterfallTitle]: '阶段瀑布',
  [K.waterfallFilter]: '按工具名过滤',
  [K.waterfallFilterClear]: '清除',
  [K.waterfallCopy]: '复制全文',
  [K.waterfallCopyDone]: '已选中,按 Ctrl+C 复制',
  [K.waterfallEmpty]: '这份轨迹没有任何步',
  [K.waterfallUnmeasuredMark]: '未量到',
  [K.waterfallHiddenCount]: '隐藏 {hidden} 步 / 显示 {shown} 步',
  [K.findingsTitle]: '自动判据(findings)',
  [K.findingsEmpty]: '本次判据阈值下没有发现问题(不等于"没有问题")',
  [K.findingSeverityHigh]: '高',
  [K.findingSeverityMedium]: '中',
  [K.findingSeverityLow]: '低',
  [K.findingFailuresPresent]: '存在失败步:失败 {errorCount} 步、取消 {cancelledCount} 步',
  [K.findingSlowestStepDominant]:
    '最慢一步 {toolName} 独占 {sharePercent}%(阈值 {thresholdPercent}%)',
  [K.findingUnmeasuredSteps]: '{unmeasuredStepCount}/{stepCount} 步量不到耗时,总耗时是**下界**不是真值',
  [K.findingEmptyTrace]: '空轨迹:只有 {stepCount} 步,任何占比读数都不成立',
  [K.findingMeasuredTotalOverBudget]: '已测总耗时 {measuredTotalMs} ms 超过预算线 {ceilingMs} ms',
  [K.messagesTitle]: '会话消息({count} 条)',
  [K.messagesTruncated]: '正文已截断',
  [K.glossaryTitle]: '术语表',
  [K.glossaryMeasured]: '有耗时步数',
  [K.glossaryMeasuredDef]: '带 durationMs 且为非负有限数的步;只有这些步参与总耗时与占比',
  [K.glossaryUnmeasured]: '缺耗时步数',
  [K.glossaryUnmeasuredDef]: '量不到耗时的步,不折算成 0 —— 缺测会让总耗时偏小',
  [K.glossarySlowestShare]: '最慢步占比',
  [K.glossarySlowestShareDef]: '最慢一步 ÷ 已测总耗时;单步轨迹不判该档',
  [K.glossaryFinding]: 'finding',
  [K.glossaryFindingDef]: '由可注入阈值算出的自动提示,每条附带数字明细;不是裁决,是线索',
  [K.copyGapTitle]: '本地化欠账',
  [K.copyGapBody]: '{count} 个文案键在该语言下取不到值,已回显键名',
  [K.timeFallback]: '时刻无法格式化',
  [K.offlineNote]: '本文档自包含:样式与脚本全部内联,零外部请求。',
}

const EN: CopyTable = {
  [K.documentTitleSuffix]: 'diagnostic report',
  [K.sourceExportedAt]: 'trace exported at',
  [K.localeLabel]: 'locale',
  [K.timeZoneLabel]: 'time zone',
  [K.stepTotalLabel]: 'steps',
  [K.kpiTitle]: 'Key readouts',
  [K.kpiSteps]: 'Tool calls',
  [K.kpiSuccess]: 'Succeeded',
  [K.kpiError]: 'Failed',
  [K.kpiCancelled]: 'Cancelled',
  [K.kpiRunning]: 'Running',
  [K.kpiMeasured]: 'Steps with duration',
  [K.kpiUnmeasured]: 'Steps missing duration',
  [K.kpiMeasuredTotal]: 'Measured total',
  [K.kpiSlowest]: 'Slowest step',
  [K.kpiSlowestShare]: 'Slowest share',
  [K.waterfallTitle]: 'Stage waterfall',
  [K.waterfallFilter]: 'Filter by tool name',
  [K.waterfallFilterClear]: 'Clear',
  [K.waterfallCopy]: 'Copy all',
  [K.waterfallCopyDone]: 'Selected — press Ctrl+C',
  [K.waterfallEmpty]: 'This trace contains no steps',
  [K.waterfallUnmeasuredMark]: 'unmeasured',
  [K.waterfallHiddenCount]: '{hidden} hidden / {shown} shown',
  [K.findingsTitle]: 'Automated findings',
  [K.findingsEmpty]: 'No finding hit the thresholds (not the same as "nothing wrong")',
  [K.findingSeverityHigh]: 'high',
  [K.findingSeverityMedium]: 'medium',
  [K.findingSeverityLow]: 'low',
  [K.findingFailuresPresent]:
    'Failing steps present: {errorCount} failed, {cancelledCount} cancelled',
  [K.findingSlowestStepDominant]:
    'Slowest step {toolName} takes {sharePercent}% of measured time (threshold {thresholdPercent}%)',
  [K.findingUnmeasuredSteps]:
    '{unmeasuredStepCount}/{stepCount} steps have no duration — the total is a lower bound',
  [K.findingEmptyTrace]: 'Empty trace: only {stepCount} steps, no share reading is meaningful',
  [K.findingMeasuredTotalOverBudget]:
    'Measured total {measuredTotalMs} ms exceeds the budget line {ceilingMs} ms',
  [K.messagesTitle]: 'Conversation messages ({count})',
  [K.messagesTruncated]: 'body truncated',
  [K.glossaryTitle]: 'Glossary',
  [K.glossaryMeasured]: 'Steps with duration',
  [K.glossaryMeasuredDef]: 'Steps carrying a finite non-negative durationMs; only these feed totals',
  [K.glossaryUnmeasured]: 'Steps missing duration',
  [K.glossaryUnmeasuredDef]: 'Unmeasured steps are never folded into 0 — that shrinks the total',
  [K.glossarySlowestShare]: 'Slowest share',
  [K.glossarySlowestShareDef]: 'Slowest step ÷ measured total; skipped for single-step traces',
  [K.glossaryFinding]: 'finding',
  [K.glossaryFindingDef]: 'A hint from injectable thresholds, with its numbers attached',
  [K.copyGapTitle]: 'Localization debt',
  [K.copyGapBody]: '{count} copy keys had no value in this locale and are shown as key names',
  [K.timeFallback]: 'instant could not be formatted',
  [K.offlineNote]: 'Self-contained document: styles and script are inline, zero external requests.',
}

/**
 * 繁体、日文、韩文同批补齐(AGENTS §19「新增状态词必须同批补齐五语言」)。
 * 表类型是 `Record<AgentReportCopyKey,string>` ⇒ 少任一键即编译期红,不靠人记。
 * 语言纯度:zh-TW 不用简体字形,ko 不夹汉字(ja 保留日文里正常的汉字用字)。
 */
const ZH_TW: CopyTable = {
  [K.documentTitleSuffix]: '診斷報告',
  [K.sourceExportedAt]: '軌跡匯出時刻',
  [K.localeLabel]: '語言',
  [K.timeZoneLabel]: '時區',
  [K.stepTotalLabel]: '步數',
  [K.kpiTitle]: '關鍵讀數',
  [K.kpiSteps]: '呼叫步數',
  [K.kpiSuccess]: '成功',
  [K.kpiError]: '失敗',
  [K.kpiCancelled]: '已取消',
  [K.kpiRunning]: '進行中',
  [K.kpiMeasured]: '有耗時步數',
  [K.kpiUnmeasured]: '缺耗時步數',
  [K.kpiMeasuredTotal]: '總耗時(僅已測步)',
  [K.kpiSlowest]: '最慢一步',
  [K.kpiSlowestShare]: '最慢步佔比',
  [K.waterfallTitle]: '階段瀑布',
  [K.waterfallFilter]: '依工具名篩選',
  [K.waterfallFilterClear]: '清除',
  [K.waterfallCopy]: '複製全文',
  [K.waterfallCopyDone]: '已選取,按 Ctrl+C 複製',
  [K.waterfallEmpty]: '這份軌跡沒有任何步',
  [K.waterfallUnmeasuredMark]: '未量到',
  [K.waterfallHiddenCount]: '隱藏 {hidden} 步 / 顯示 {shown} 步',
  [K.findingsTitle]: '自動判據(findings)',
  [K.findingsEmpty]: '本次判據門檻下沒有發現問題(不等於「沒有問題」)',
  [K.findingSeverityHigh]: '高',
  [K.findingSeverityMedium]: '中',
  [K.findingSeverityLow]: '低',
  [K.findingFailuresPresent]: '存在失敗步:失敗 {errorCount} 步、取消 {cancelledCount} 步',
  [K.findingSlowestStepDominant]:
    '最慢一步 {toolName} 獨佔 {sharePercent}%(門檻 {thresholdPercent}%)',
  [K.findingUnmeasuredSteps]:
    '{unmeasuredStepCount}/{stepCount} 步量不到耗時,總耗時是**下界**不是真值',
  [K.findingEmptyTrace]: '空軌跡:只有 {stepCount} 步,任何佔比讀數都不成立',
  [K.findingMeasuredTotalOverBudget]: '已測總耗時 {measuredTotalMs} ms 超過預算線 {ceilingMs} ms',
  [K.messagesTitle]: '會話訊息({count} 條)',
  [K.messagesTruncated]: '內文已截斷',
  [K.glossaryTitle]: '術語表',
  [K.glossaryMeasured]: '有耗時步數',
  [K.glossaryMeasuredDef]: '帶 durationMs 且為非負有限數的步;只有這些步參與總耗時與佔比',
  [K.glossaryUnmeasured]: '缺耗時步數',
  [K.glossaryUnmeasuredDef]: '量不到耗時的步不折算成 0 —— 缺測會讓總耗時偏小',
  [K.glossarySlowestShare]: '最慢步佔比',
  [K.glossarySlowestShareDef]: '最慢一步 ÷ 已測總耗時;單步軌跡不判該檔',
  [K.glossaryFinding]: 'finding',
  [K.glossaryFindingDef]: '由可注入門檻算出的自動提示,每條附带數字明細;不是裁決,是線索',
  [K.copyGapTitle]: '在地化欠帳',
  [K.copyGapBody]: '{count} 個文案鍵在該語言下取不到值,已回顯鍵名',
  [K.timeFallback]: '時刻無法格式化',
  [K.offlineNote]: '本文件自包含:樣式與腳本全部內嵌,零外部請求。',
}

const JA: CopyTable = {
  [K.documentTitleSuffix]: '診断レポート',
  [K.sourceExportedAt]: 'トレース出力時刻',
  [K.localeLabel]: '言語',
  [K.timeZoneLabel]: 'タイムゾーン',
  [K.stepTotalLabel]: 'ステップ数',
  [K.kpiTitle]: '主要な読み值',
  [K.kpiSteps]: '呼び出しステップ',
  [K.kpiSuccess]: '成功',
  [K.kpiError]: '失敗',
  [K.kpiCancelled]: 'キャンセル',
  [K.kpiRunning]: '実行中',
  [K.kpiMeasured]: '所要測定のステップ',
  [K.kpiUnmeasured]: '所要未測定のステップ',
  [K.kpiMeasuredTotal]: '合計所要(測定分のみ)',
  [K.kpiSlowest]: '最遅の1ステップ',
  [K.kpiSlowestShare]: '最遅の割合',
  [K.waterfallTitle]: 'ステージウォーターフォール',
  [K.waterfallFilter]: 'ツール名で絞り込み',
  [K.waterfallFilterClear]: '解除',
  [K.waterfallCopy]: '全文コピー',
  [K.waterfallCopyDone]: '選択済み — Ctrl+C',
  [K.waterfallEmpty]: 'このトレースにはステップがありません',
  [K.waterfallUnmeasuredMark]: '未測定',
  [K.waterfallHiddenCount]: '非表示 {hidden} / 表示 {shown}',
  [K.findingsTitle]: '自動所見(findings)',
  [K.findingsEmpty]: 'しきい値に該当する所見はありません(= 問題がない、ではない)',
  [K.findingSeverityHigh]: '高',
  [K.findingSeverityMedium]: '中',
  [K.findingSeverityLow]: '低',
  [K.findingFailuresPresent]: '失敗ステップあり:失敗 {errorCount} / キャンセル {cancelledCount}',
  [K.findingSlowestStepDominant]:
    '最遅 {toolName} が測定時間の {sharePercent}% を占有(しきい値 {thresholdPercent}%)',
  [K.findingUnmeasuredSteps]:
    '{unmeasuredStepCount}/{stepCount} ステップは所要が測れない — 合計は**下限値**',
  [K.findingEmptyTrace]: '空のトレース:ステップ数 {stepCount} では割合は成立しません',
  [K.findingMeasuredTotalOverBudget]: '測定合計 {measuredTotalMs} ms が予算線 {ceilingMs} ms を超過',
  [K.messagesTitle]: '会話メッセージ({count} 件)',
  [K.messagesTruncated]: '本文は省略済み',
  [K.glossaryTitle]: '用語集',
  [K.glossaryMeasured]: '所要測定のステップ',
  [K.glossaryMeasuredDef]: 'durationMs を持つ非負有限値のステップ。合計と割合にのみ参加します',
  [K.glossaryUnmeasured]: '所要未測定のステップ',
  [K.glossaryUnmeasuredDef]: '測定不能を 0 としない — 合計が小さく見えます',
  [K.glossarySlowestShare]: '最遅の割合',
  [K.glossarySlowestShareDef]: '最遅ステップ ÷ 測定合計。1ステップでは判定しません',
  [K.glossaryFinding]: 'finding',
  [K.glossaryFindingDef]: '注入可能なしきい値から出る自動ヒント。数値も添付。裁定ではなく手がかり',
  [K.copyGapTitle]: 'ローカライズの負債',
  [K.copyGapBody]: 'この言語で {count} 件のキーが値を持たないため、キー名を表示しています',
  [K.timeFallback]: '時刻を整形できませんでした',
  [K.offlineNote]: '自己完結文書: 样式とスクリプトはすべてインライン、外部リクエストなし。',
}

const KO: CopyTable = {
  [K.documentTitleSuffix]: '진단 보고서',
  [K.sourceExportedAt]: '추적 내보낸 시각',
  [K.localeLabel]: '언어',
  [K.timeZoneLabel]: '시간대',
  [K.stepTotalLabel]: '단계 수',
  [K.kpiTitle]: '주요 수치',
  [K.kpiSteps]: '호출 단계',
  [K.kpiSuccess]: '성공',
  [K.kpiError]: '실패',
  [K.kpiCancelled]: '취소됨',
  [K.kpiRunning]: '진행 중',
  [K.kpiMeasured]: '소요 측정 단계',
  [K.kpiUnmeasured]: '소요 미측정 단계',
  [K.kpiMeasuredTotal]: '총 소요(측정분만)',
  [K.kpiSlowest]: '가장 느린 단계',
  [K.kpiSlowestShare]: '가장 느린 단계 비중',
  [K.waterfallTitle]: '단계 워터폴',
  [K.waterfallFilter]: '도구 이름으로 필터',
  [K.waterfallFilterClear]: '지우기',
  [K.waterfallCopy]: '전체 복사',
  [K.waterfallCopyDone]: '선택됨 — Ctrl+C',
  [K.waterfallEmpty]: '이 추적에는 단계가 없습니다',
  [K.waterfallUnmeasuredMark]: '미측정',
  [K.waterfallHiddenCount]: '숨김 {hidden} / 표시 {shown}',
  [K.findingsTitle]: '자동 점검 항목(findings)',
  [K.findingsEmpty]: '임계값에 해당하는 항목이 없습니다(= 문제가 없다는 뜻이 아님)',
  [K.findingSeverityHigh]: '높음',
  [K.findingSeverityMedium]: '보통',
  [K.findingSeverityLow]: '낮음',
  [K.findingFailuresPresent]: '실패 단계 있음: 실패 {errorCount} / 취소 {cancelledCount}',
  [K.findingSlowestStepDominant]:
    '가장 느린 {toolName} 이 측정 시간의 {sharePercent}% 를 차지(임계 {thresholdPercent}%)',
  [K.findingUnmeasuredSteps]:
    '{unmeasuredStepCount}/{stepCount} 단계는 소요를 측정할 수 없음 — 합계는 **하한**',
  [K.findingEmptyTrace]: '빈 추적: 단계 수 {stepCount} 에서는 비율 성립하지 않음',
  [K.findingMeasuredTotalOverBudget]: '측정 합계 {measuredTotalMs} ms 가 예산 한도 {ceilingMs} ms 초과',
  [K.messagesTitle]: '대화 메시지({count} 건)',
  [K.messagesTruncated]: '본문 생략됨',
  [K.glossaryTitle]: '용어집',
  [K.glossaryMeasured]: '소요 측정 단계',
  [K.glossaryMeasuredDef]: 'durationMs 를 가진 유한하고 음이 아닌 단계. 합계와 비율에만 참여',
  [K.glossaryUnmeasured]: '소요 미측정 단계',
  [K.glossaryUnmeasuredDef]: '측정 불가을 0 으로 치환하지 않음 — 합계가 작해 보입니다',
  [K.glossarySlowestShare]: '가장 느린 단계 비중',
  [K.glossarySlowestShareDef]: '가장 느린 단계 ÷ 측정 합계. 단일 단계는 판단하지 않음',
  [K.glossaryFinding]: 'finding',
  [K.glossaryFindingDef]: '주입 가능한 임계값에서 만든 자동 힌트, 수치도 함께 기재. 판정이 아니라 단서',
  [K.copyGapTitle]: '지역화 부채',
  [K.copyGapBody]: '이 언어에서 {count} 개의 키가 값이 없어 키 이름을 표시합니다',
  [K.timeFallback]: '시각을 형식화할 수 없음',
  [K.offlineNote]: '자기 완결 문서: 스타일과 스크립트 모두 인라인, 외부 요청 없음.',
}

const TABLES: Readonly<Record<ReportLocale, CopyTable>> = {
  'zh-CN': ZH_CN,
  'zh-TW': ZH_TW,
  en: EN,
  ja: JA,
  ko: KO,
}

/** 词典取词:缺表缺键一律回显键名(与 shared 层的欠账登记同一口径,不出空串) */
export function resolveReportTranslate(locale?: string): (key: string, params?: Record<string, string | number>) => string {
  // 未知/缺省语言显式落 en;不再用 `|| TABLES.en` 的短路写法 ——
  // 那会让 `Record<string,…>` 的索引返回 `CopyTable | undefined`,编译器只能靠运行时兜底(本仓 TS 零债要求)。
  const table: CopyTable =
    locale !== undefined && Object.prototype.hasOwnProperty.call(TABLES, locale)
      ? TABLES[locale as ReportLocale]
      : TABLES.en
  return (key, params) => {
    const template: string | undefined = table[key as AgentReportCopyKey]
    if (template === undefined) return key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name]
      // 占位符写了但调用方没给值 ⇒ 保留原样,不替换成空串(空串会把"少给了参数"洗成"就是这样")
      return value === undefined ? match : String(value)
    })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
