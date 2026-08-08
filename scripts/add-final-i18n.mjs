/**
 * feature-final 轮次 i18n 注入：eduAi.{a2a, personas, orch, traders} × 5 语言 + 导航 key
 * 幂等：已存在的 key 不覆盖。用法：node scripts/add-final-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'G:/IHUI-AI/packages/i18n/messages/web/'

const ns = {
  a2a: {
    'zh-CN': {
      title: 'A2A 智能体互联', subtitle: '注册智能体、派发任务，实现智能体之间的互联协作',
      tabAgents: '智能体列表', tabRegister: '注册智能体', tabTasks: '任务派发',
      agentId: '智能体 ID', agentName: '智能体名称', description: '描述', capabilities: '能力列表',
      endpoint: '端点地址', register: '注册', noAgents: '暂无注册智能体', taskName: '任务名称',
      assignAgent: '指派智能体', taskInput: '任务输入（JSON，可选）', sendTask: '发送任务',
      taskStatus: '任务状态', pending: '等待中', running: '执行中', completed: '已完成', failed: '失败',
      error: '操作失败', success: '操作成功', empty: '暂无数据', capabilitiesHint: '多个能力用逗号分隔',
      sendSuccess: '任务已派发', statusLabel: '状态', result: '任务结果', pollHint: '轮询任务状态中...',
    },
    en: {
      title: 'A2A Agent Interconnect', subtitle: 'Register agents, dispatch tasks, enable agent-to-agent collaboration',
      tabAgents: 'Agents', tabRegister: 'Register', tabTasks: 'Tasks',
      agentId: 'Agent ID', agentName: 'Agent name', description: 'Description', capabilities: 'Capabilities',
      endpoint: 'Endpoint', register: 'Register', noAgents: 'No agents registered', taskName: 'Task name',
      assignAgent: 'Assign agent', taskInput: 'Task input (JSON, optional)', sendTask: 'Send task',
      taskStatus: 'Task status', pending: 'Pending', running: 'Running', completed: 'Completed', failed: 'Failed',
      error: 'Failed', success: 'Done', empty: 'No data', capabilitiesHint: 'Separate capabilities with commas',
      sendSuccess: 'Task dispatched', statusLabel: 'Status', result: 'Result', pollHint: 'Polling task status...',
    },
    ja: {
      title: 'A2A エージェント連携', subtitle: 'エージェント登録・タスク派遣で相互連携を実現',
      tabAgents: 'エージェント一覧', tabRegister: '登録', tabTasks: 'タスク派遣',
      agentId: 'エージェント ID', agentName: 'エージェント名', description: '説明', capabilities: '能力',
      endpoint: 'エンドポイント', register: '登録', noAgents: '登録エージェントなし', taskName: 'タスク名',
      assignAgent: '割当エージェント', taskInput: 'タスク入力（JSON、任意）', sendTask: '送信',
      taskStatus: 'タスク状態', pending: '待機中', running: '実行中', completed: '完了', failed: '失敗',
      error: '失敗', success: '成功', empty: 'データなし', capabilitiesHint: 'カンマ区切りで複数指定',
      sendSuccess: 'タスク送信完了', statusLabel: '状態', result: '結果', pollHint: 'タスク状態を確認中...',
    },
    ko: {
      title: 'A2A 에이전트 연결', subtitle: '에이전트 등록·작업 배포로 에이전트 간 협업 구현',
      tabAgents: '에이전트 목록', tabRegister: '등록', tabTasks: '작업 배포',
      agentId: '에이전트 ID', agentName: '에이전트 이름', description: '설명', capabilities: '능력',
      endpoint: '엔드포인트', register: '등록', noAgents: '등록된 에이전트 없음', taskName: '작업 이름',
      assignAgent: '지정 에이전트', taskInput: '작업 입력 (JSON, 선택)', sendTask: '보내기',
      taskStatus: '작업 상태', pending: '대기 중', running: '실행 중', completed: '완료', failed: '실패',
      error: '실패', success: '성공', empty: '데이터 없음', capabilitiesHint: '쉼표로 구분',
      sendSuccess: '작업 배포 완료', statusLabel: '상태', result: '결과', pollHint: '작업 상태 확인 중...',
    },
    'zh-TW': {
      title: 'A2A 智能體互聯', subtitle: '註冊智能體、派發任務，實現智能體之間的互聯協作',
      tabAgents: '智能體列表', tabRegister: '註冊智能體', tabTasks: '任務派發',
      agentId: '智能體 ID', agentName: '智能體名稱', description: '描述', capabilities: '能力列表',
      endpoint: '端點地址', register: '註冊', noAgents: '暫無註冊智能體', taskName: '任務名稱',
      assignAgent: '指派智能體', taskInput: '任務輸入（JSON，可選）', sendTask: '發送任務',
      taskStatus: '任務狀態', pending: '等待中', running: '執行中', completed: '已完成', failed: '失敗',
      error: '操作失敗', success: '操作成功', empty: '暫無資料', capabilitiesHint: '多個能力用逗號分隔',
      sendSuccess: '任務已派發', statusLabel: '狀態', result: '任務結果', pollHint: '輪詢任務狀態中...',
    },
  },
  personas: {
    'zh-CN': {
      title: 'Personas 人设中心', subtitle: '查看 AI 人设定义与输入输出契约',
      searchPlaceholder: '搜索人设...', inputSchema: '输入契约', outputSchema: '输出契约',
      description: '描述', name: '人设名称', selectPersona: '选择一个人设查看详情', noPersonas: '暂无可用人设',
      error: '加载失败', loading: '加载中...', empty: '暂无数据', fields: '字段', required: '必填', optional: '可选',
    },
    en: {
      title: 'Personas Hub', subtitle: 'Browse AI persona definitions and I/O contracts',
      searchPlaceholder: 'Search personas...', inputSchema: 'Input contract', outputSchema: 'Output contract',
      description: 'Description', name: 'Persona name', selectPersona: 'Select a persona to view details', noPersonas: 'No personas available',
      error: 'Failed to load', loading: 'Loading...', empty: 'No data', fields: 'Fields', required: 'Required', optional: 'Optional',
    },
    ja: {
      title: 'Personas ハブ', subtitle: 'AI ペルソナ定義と入出力コントラクトを表示',
      searchPlaceholder: 'ペルソナを検索...', inputSchema: '入力コントラクト', outputSchema: '出力コントラクト',
      description: '説明', name: 'ペルソナ名', selectPersona: 'ペルソナを選択して詳細を表示', noPersonas: '利用可能なペルソナなし',
      error: '読み込み失敗', loading: '読み込み中...', empty: 'データなし', fields: 'フィールド', required: '必須', optional: '任意',
    },
    ko: {
      title: 'Personas 허브', subtitle: 'AI 페르소나 정의와 입출력 계약 조회',
      searchPlaceholder: '페르소나 검색...', inputSchema: '입력 계약', outputSchema: '출력 계약',
      description: '설명', name: '페르소나 이름', selectPersona: '페르소나를 선택하여 상세 보기', noPersonas: '사용 가능한 페르소나 없음',
      error: '로드 실패', loading: '로딩 중...', empty: '데이터 없음', fields: '필드', required: '필수', optional: '선택',
    },
    'zh-TW': {
      title: 'Personas 人設中心', subtitle: '查看 AI 人設定義與輸入輸出契約',
      searchPlaceholder: '搜尋人設...', inputSchema: '輸入契約', outputSchema: '輸出契約',
      description: '描述', name: '人設名稱', selectPersona: '選擇一個人設查看詳情', noPersonas: '暫無可用人設',
      error: '載入失敗', loading: '載入中...', empty: '暫無資料', fields: '欄位', required: '必填', optional: '可選',
    },
  },
  orch: {
    'zh-CN': {
      title: 'Orchestration 编排中心', subtitle: '监控编排中枢运行状态、仪表盘与事件流',
      status: '运行状态', dashboard: '仪表盘', events: '事件流', refresh: '刷新',
      healthy: '正常', unhealthy: '异常', unknown: '未知', error: '加载失败', loading: '加载中...',
      noEvents: '暂无事件', lastHeartbeat: '最后心跳', module: '模块', time: '时间', type: '类型',
      total: '总数', success: '成功', failed: '失败', running: '运行中', description: '描述',
    },
    en: {
      title: 'Orchestration Hub', subtitle: 'Monitor hub status, dashboard and event stream',
      status: 'Status', dashboard: 'Dashboard', events: 'Events', refresh: 'Refresh',
      healthy: 'Healthy', unhealthy: 'Unhealthy', unknown: 'Unknown', error: 'Failed to load', loading: 'Loading...',
      noEvents: 'No events', lastHeartbeat: 'Last heartbeat', module: 'Module', time: 'Time', type: 'Type',
      total: 'Total', success: 'Succeeded', failed: 'Failed', running: 'Running', description: 'Description',
    },
    ja: {
      title: 'Orchestration ハブ', subtitle: 'オーケストレーション中枢の状態・ダッシュボード・イベントを監視',
      status: 'ステータス', dashboard: 'ダッシュボード', events: 'イベント', refresh: '更新',
      healthy: '正常', unhealthy: '異常', unknown: '不明', error: '読み込み失敗', loading: '読み込み中...',
      noEvents: 'イベントなし', lastHeartbeat: '最終ハートビート', module: 'モジュール', time: '時間', type: '種別',
      total: '合計', success: '成功', failed: '失敗', running: '実行中', description: '説明',
    },
    ko: {
      title: 'Orchestration 허브', subtitle: '오케스트레이션 허브 상태·대시보드·이벤트 모니터링',
      status: '상태', dashboard: '대시보드', events: '이벤트', refresh: '새로고침',
      healthy: '정상', unhealthy: '비정상', unknown: '알 수 없음', error: '로드 실패', loading: '로딩 중...',
      noEvents: '이벤트 없음', lastHeartbeat: '마지막 하트비트', module: '모듈', time: '시간', type: '유형',
      total: '합계', success: '성공', failed: '실패', running: '실행 중', description: '설명',
    },
    'zh-TW': {
      title: 'Orchestration 編排中心', subtitle: '監控編排中樞運行狀態、儀表板與事件流',
      status: '運行狀態', dashboard: '儀表板', events: '事件流', refresh: '重新整理',
      healthy: '正常', unhealthy: '異常', unknown: '未知', error: '載入失敗', loading: '載入中...',
      noEvents: '暫無事件', lastHeartbeat: '最後心跳', module: '模組', time: '時間', type: '類型',
      total: '總數', success: '成功', failed: '失敗', running: '執行中', description: '描述',
    },
  },
  traders: {
    'zh-CN': {
      title: '交易员入驻', subtitle: '申请成为平台认证交易员，展示你的交易专长',
      apply: '申请入驻', commissionRate: '佣金率（%）', specialties: '交易专长',
      specialtiesHint: '多个专长用逗号分隔，如：趋势交易,量化分析', intro: '个人简介（≤500字）',
      submit: '提交申请', submitting: '提交中...', applySuccess: '申请已提交，等待审核',
      applyDuplicate: '您已提交过交易员申请', traders: '已入驻交易员', noTraders: '暂无入驻交易员',
      commission: '佣金率', joinedAt: '入驻时间', viewDetail: '查看详情', error: '操作失败',
      empty: '暂无数据', performance: '业绩', required: '请填写必填项',
    },
    en: {
      title: 'Trader Onboarding', subtitle: 'Apply to become a certified trader and showcase your expertise',
      apply: 'Apply', commissionRate: 'Commission rate (%)', specialties: 'Specialties',
      specialtiesHint: 'Separate with commas, e.g. trend trading, quantitative', intro: 'Bio (≤500 chars)',
      submit: 'Submit', submitting: 'Submitting...', applySuccess: 'Application submitted, pending review',
      applyDuplicate: 'You have already applied', traders: 'Traders', noTraders: 'No traders yet',
      commission: 'Commission', joinedAt: 'Joined', viewDetail: 'Details', error: 'Failed',
      empty: 'No data', performance: 'Performance', required: 'Required fields missing',
    },
    ja: {
      title: 'トレーダー登録', subtitle: '認定トレーダーに応募して取引の専門性を公開',
      apply: '応募', commissionRate: '手数料率（%）', specialties: '取引専門性',
      specialtiesHint: 'カンマ区切り（例：トレンド取引,定量分析）', intro: 'プロフィール（500字以内）',
      submit: '送信', submitting: '送信中...', applySuccess: '応募完了、審査待ちです',
      applyDuplicate: 'すでに応募済みです', traders: 'トレーダー一覧', noTraders: 'トレーダーなし',
      commission: '手数料率', joinedAt: '登録日', viewDetail: '詳細', error: '失敗',
      empty: 'データなし', performance: '実績', required: '必須項目を入力してください',
    },
    ko: {
      title: '트레이더 등록', subtitle: '인증 트레이더에 지원하고 거래 전문성 공개',
      apply: '지원', commissionRate: '수수료율 (%)', specialties: '거래 전문성',
      specialtiesHint: '쉼표로 구분 (예: 추세거래, 퀀트분석)', intro: '소개 (500자 이내)',
      submit: '제출', submitting: '제출 중...', applySuccess: '지원 완료, 심사 대기 중',
      applyDuplicate: '이미 지원했습니다', traders: '트레이더 목록', noTraders: '트레이더 없음',
      commission: '수수료율', joinedAt: '가입일', viewDetail: '상세', error: '실패',
      empty: '데이터 없음', performance: '실적', required: '필수 항목을 입력하세요',
    },
    'zh-TW': {
      title: '交易員入駐', subtitle: '申請成為平台認證交易員，展示你的交易專長',
      apply: '申請入駐', commissionRate: '佣金率（%）', specialties: '交易專長',
      specialtiesHint: '多個專長用逗號分隔，如：趨勢交易,量化分析', intro: '個人簡介（≤500字）',
      submit: '提交申請', submitting: '提交中...', applySuccess: '申請已提交，等待審核',
      applyDuplicate: '您已提交過交易員申請', traders: '已入駐交易員', noTraders: '暫無入駐交易員',
      commission: '佣金率', joinedAt: '入駐時間', viewDetail: '查看詳情', error: '操作失敗',
      empty: '暫無資料', performance: '業績', required: '請填寫必填項',
    },
  },
}

const navKeys = {
  'zh-CN': { eduAiA2a: 'A2A 智能体互联', eduAiPersonas: 'Personas 人设', eduAiOrch: '编排中心', eduAiTraders: '交易员入驻' },
  en: { eduAiA2a: 'A2A Agents', eduAiPersonas: 'Personas', eduAiOrch: 'Orchestration', eduAiTraders: 'Traders' },
  ja: { eduAiA2a: 'A2A エージェント', eduAiPersonas: 'Personas', eduAiOrch: 'オーケストレーション', eduAiTraders: 'トレーダー' },
  ko: { eduAiA2a: 'A2A 에이전트', eduAiPersonas: 'Personas', eduAiOrch: '오케스트레이션', eduAiTraders: '트레이더' },
  'zh-TW': { eduAiA2a: 'A2A 智能體互聯', eduAiPersonas: 'Personas 人設', eduAiOrch: '編排中心', eduAiTraders: '交易員入駐' },
}

const langs = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
let injected = 0

for (const lang of langs) {
  const file = dir + lang + '.json'
  const data = JSON.parse(readFileSync(file, 'utf8'))

  if (!data.eduAi) data.eduAi = {}
  for (const [nsName, nsData] of Object.entries(ns)) {
    if (!data.eduAi[nsName]) data.eduAi[nsName] = {}
    for (const [key, value] of Object.entries(nsData[lang])) {
      if (!(key in data.eduAi[nsName])) {
        data.eduAi[nsName][key] = value
        injected++
      }
    }
  }

  if (!data.nav) data.nav = {}
  for (const [key, value] of Object.entries(navKeys[lang])) {
    if (!(key in data.nav)) {
      data.nav[key] = value
      injected++
    }
  }

  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
  console.log('OK', lang)
}

console.log('INJECTED', injected, 'keys')
