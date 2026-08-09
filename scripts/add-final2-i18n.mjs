/**
 * feature-final2 i18n: eduAi.{voice, outbound, tbox, metaLearner} + fundData (top-level) x 5 langs + nav keys
 * Idempotent: existing keys are not overwritten. Usage: node scripts/add-final2-i18n.mjs
 * 2026-08-09: fundData moved from eduAi.fundData to top-level fundData (金融板块)
 */
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'G:/IHUI-AI/packages/i18n/messages/web/'

const ns = {
  voice: {
    'zh-CN': {
      title: '实时语音通话', subtitle: '基于 WebRTC 的点对点语音通话',
      startCall: '发起通话', calleeId: '对方用户 ID', calleeIdHint: '输入对方的用户 ID',
      calling: '呼叫中', connected: '已接通', ended: '通话结束', endCall: '挂断',
      noActiveCall: '暂无活跃通话', callError: '通话出错', microphoneError: '无法获取麦克风权限',
      submitCall: '呼叫',
    },
    en: {
      title: 'Voice Call', subtitle: 'WebRTC peer-to-peer voice communication',
      startCall: 'Start Call', calleeId: 'Callee User ID', calleeIdHint: 'Enter the target user ID',
      calling: 'Calling', connected: 'Connected', ended: 'Call Ended', endCall: 'Hang Up',
      noActiveCall: 'No active call', callError: 'Call error', microphoneError: 'Cannot access microphone',
      submitCall: 'Call',
    },
    ja: {
      title: '音声通話', subtitle: 'WebRTC ピアツーピア音声通話',
      startCall: '通話開始', calleeId: '相手ユーザー ID', calleeIdHint: '相手のユーザー ID を入力',
      calling: '呼び出し中', connected: '通話中', ended: '通話終了', endCall: '切断',
      noActiveCall: 'アクティブな通話なし', callError: '通話エラー', microphoneError: 'マイクアクセス不可',
      submitCall: '発信',
    },
    ko: {
      title: '음성 통화', subtitle: 'WebRTC P2P 음성 통신',
      startCall: '통화 시작', calleeId: '상대 사용자 ID', calleeIdHint: '상대 사용자 ID 입력',
      calling: '호출 중', connected: '연결됨', ended: '통화 종료', endCall: '끊기',
      noActiveCall: '활성 통화 없음', callError: '통화 오류', microphoneError: '마이크 접근 불가',
      submitCall: '전화',
    },
    'zh-TW': {
      title: '語音通話', subtitle: '基於 WebRTC 的點對點語音通話',
      startCall: '發起通話', calleeId: '對方用戶 ID', calleeIdHint: '輸入對方的用戶 ID',
      calling: '呼叫中', connected: '已接通', ended: '通話結束', endCall: '掛斷',
      noActiveCall: '暫無活躍通話', callError: '通話出錯', microphoneError: '無法取得麥克風權限',
      submitCall: '呼叫',
    },
  },
  outbound: {
    'zh-CN': {
      title: '外呼营销', subtitle: '批量外呼任务编排与管理',
      createCampaign: '创建任务', campaignName: '任务名称', script: '话术脚本',
      phoneNumbers: '电话号码', phoneNumbersHint: '多个号码用逗号分隔',
      create: '创建', start: '启动', stop: '停止', stats: '统计',
      totalCalls: '总呼叫', answered: '已接听', failed: '失败', answerRate: '接通率',
      avgDuration: '平均时长', status: '状态', created: '已创建', running: '运行中',
      paused: '已暂停', stopped: '已停止', completed: '已完成',
      noCampaigns: '暂无外呼任务', loading: '加载中...', error: '加载失败', viewStats: '查看统计',
    },
    en: {
      title: 'Outbound Marketing', subtitle: 'Batch outbound campaign management',
      createCampaign: 'Create Campaign', campaignName: 'Campaign Name', script: 'Script',
      phoneNumbers: 'Phone Numbers', phoneNumbersHint: 'Separate with commas',
      create: 'Create', start: 'Start', stop: 'Stop', stats: 'Stats',
      totalCalls: 'Total Calls', answered: 'Answered', failed: 'Failed', answerRate: 'Answer Rate',
      avgDuration: 'Avg Duration', status: 'Status', created: 'Created', running: 'Running',
      paused: 'Paused', stopped: 'Stopped', completed: 'Completed',
      noCampaigns: 'No campaigns', loading: 'Loading...', error: 'Failed to load', viewStats: 'View Stats',
    },
    ja: {
      title: 'アウトバウンド', subtitle: '一括発信タスク管理',
      createCampaign: 'タスク作成', campaignName: 'タスク名', script: 'スクリプト',
      phoneNumbers: '電話番号', phoneNumbersHint: 'カンマ区切り',
      create: '作成', start: '開始', stop: '停止', stats: '統計',
      totalCalls: '総発信', answered: '応答', failed: '失敗', answerRate: '応答率',
      avgDuration: '平均時間', status: '状態', created: '作成済み', running: '実行中',
      paused: '一時停止', stopped: '停止済み', completed: '完了',
      noCampaigns: 'タスクなし', loading: '読み込み中...', error: '読み込み失敗', viewStats: '統計表示',
    },
    ko: {
      title: '아웃바운드 마케팅', subtitle: '일괄 발신 캠페인 관리',
      createCampaign: '캠페인 생성', campaignName: '캠페인 이름', script: '스크립트',
      phoneNumbers: '전화번호', phoneNumbersHint: '쉼표로 구분',
      create: '생성', start: '시작', stop: '중지', stats: '통계',
      totalCalls: '총 발신', answered: '응답', failed: '실패', answerRate: '응답률',
      avgDuration: '평균 시간', status: '상태', created: '생성됨', running: '실행 중',
      paused: '일시정지', stopped: '중지됨', completed: '완료',
      noCampaigns: '캠페인 없음', loading: '로딩 중...', error: '로드 실패', viewStats: '통계 보기',
    },
    'zh-TW': {
      title: '外呼行銷', subtitle: '批量外呼任務編排與管理',
      createCampaign: '建立任務', campaignName: '任務名稱', script: '話術腳本',
      phoneNumbers: '電話號碼', phoneNumbersHint: '多個號碼用逗號分隔',
      create: '建立', start: '啟動', stop: '停止', stats: '統計',
      totalCalls: '總呼叫', answered: '已接聽', failed: '失敗', answerRate: '接通率',
      avgDuration: '平均時長', status: '狀態', created: '已建立', running: '執行中',
      paused: '已暫停', stopped: '已停止', completed: '已完成',
      noCampaigns: '暫無外呼任務', loading: '載入中...', error: '載入失敗', viewStats: '查看統計',
    },
  },
  tbox: {
    'zh-CN': {
      title: 'IoT 设备管理', subtitle: 'TBox 车载设备注册、指令下发与状态监控',
      devices: '设备列表', deviceNo: '设备编号', deviceName: '设备名称', deviceType: '设备类型',
      status: '状态', signal: '信号', battery: '电量', registerDevice: '注册设备',
      sendCommand: '发送指令', commandHistory: '指令历史',
      reboot: '重启', lock: '锁定', unlock: '解锁', upgrade: '升级',
      online: '在线', offline: '离线', sleep: '休眠', noDevices: '暂无设备',
      loading: '加载中...', error: '加载失败', firmwareVersion: '固件版本',
      lastOnline: '最后在线', location: '位置', commands: '指令列表',
      command: '指令', sentAt: '发送时间', ackedAt: '确认时间', result: '结果',
      pending: '待发送', sent: '已发送', ack: '已确认', failed: '失败',
    },
    en: {
      title: 'IoT Device Management', subtitle: 'TBox vehicle device registration, commands and monitoring',
      devices: 'Devices', deviceNo: 'Device No.', deviceName: 'Device Name', deviceType: 'Device Type',
      status: 'Status', signal: 'Signal', battery: 'Battery', registerDevice: 'Register Device',
      sendCommand: 'Send Command', commandHistory: 'Command History',
      reboot: 'Reboot', lock: 'Lock', unlock: 'Unlock', upgrade: 'Upgrade',
      online: 'Online', offline: 'Offline', sleep: 'Sleep', noDevices: 'No devices',
      loading: 'Loading...', error: 'Failed to load', firmwareVersion: 'Firmware',
      lastOnline: 'Last Online', location: 'Location', commands: 'Commands',
      command: 'Command', sentAt: 'Sent At', ackedAt: 'Acked At', result: 'Result',
      pending: 'Pending', sent: 'Sent', ack: 'Acked', failed: 'Failed',
    },
    ja: {
      title: 'IoT デバイス管理', subtitle: 'TBox 車載デバイスの登録・コマンド・監視',
      devices: 'デバイス一覧', deviceNo: 'デバイス番号', deviceName: 'デバイス名', deviceType: 'デバイス種別',
      status: '状態', signal: '信号', battery: 'バッテリー', registerDevice: 'デバイス登録',
      sendCommand: 'コマンド送信', commandHistory: 'コマンド履歴',
      reboot: '再起動', lock: 'ロック', unlock: '解除', upgrade: 'アップグレード',
      online: 'オンライン', offline: 'オフライン', sleep: 'スリープ', noDevices: 'デバイスなし',
      loading: '読み込み中...', error: '読み込み失敗', firmwareVersion: 'ファームウェア',
      lastOnline: '最終オンライン', location: '位置', commands: 'コマンド一覧',
      command: 'コマンド', sentAt: '送信時間', ackedAt: '確認時間', result: '結果',
      pending: '待機中', sent: '送信済み', ack: '確認済み', failed: '失敗',
    },
    ko: {
      title: 'IoT 기기 관리', subtitle: 'TBox 차량 기기 등록, 명령 및 모니터링',
      devices: '기기 목록', deviceNo: '기기 번호', deviceName: '기기 이름', deviceType: '기기 유형',
      status: '상태', signal: '신호', battery: '배터리', registerDevice: '기기 등록',
      sendCommand: '명령 전송', commandHistory: '명령 기록',
      reboot: '재부팅', lock: '잠금', unlock: '해제', upgrade: '업그레이드',
      online: '온라인', offline: '오프라인', sleep: '슬립', noDevices: '기기 없음',
      loading: '로딩 중...', error: '로드 실패', firmwareVersion: '펌웨어',
      lastOnline: '마지막 온라인', location: '위치', commands: '명령 목록',
      command: '명령', sentAt: '전송 시간', ackedAt: '확인 시간', result: '결과',
      pending: '대기 중', sent: '전송됨', ack: '확인됨', failed: '실패',
    },
    'zh-TW': {
      title: 'IoT 設備管理', subtitle: 'TBox 車載設備註冊、指令下發與狀態監控',
      devices: '設備列表', deviceNo: '設備編號', deviceName: '設備名稱', deviceType: '設備類型',
      status: '狀態', signal: '信號', battery: '電量', registerDevice: '註冊設備',
      sendCommand: '發送指令', commandHistory: '指令歷史',
      reboot: '重啟', lock: '鎖定', unlock: '解鎖', upgrade: '升級',
      online: '在線', offline: '離線', sleep: '休眠', noDevices: '暫無設備',
      loading: '載入中...', error: '載入失敗', firmwareVersion: '韌體版本',
      lastOnline: '最後在線', location: '位置', commands: '指令列表',
      command: '指令', sentAt: '發送時間', ackedAt: '確認時間', result: '結果',
      pending: '待發送', sent: '已發送', ack: '已確認', failed: '失敗',
    },
  },
  fundData: {
    'zh-CN': {
      title: '基金数据', subtitle: '基金列表、详情与净值历史查询',
      fundCode: '基金代码', fundName: '基金名称', fundType: '基金类型',
      fundStatus: '状态', netValue: '净值', date: '日期',
      viewDetail: '查看详情', history: '净值历史', noFunds: '暂无基金数据',
      loading: '加载中...', error: '加载失败', search: '搜索基金代码或名称',
      active: '活跃', inactive: '停用',
    },
    en: {
      title: 'Fund Data', subtitle: 'Fund list, details and net value history',
      fundCode: 'Code', fundName: 'Fund Name', fundType: 'Type',
      fundStatus: 'Status', netValue: 'Net Value', date: 'Date',
      viewDetail: 'Details', history: 'Net Value History', noFunds: 'No funds found',
      loading: 'Loading...', error: 'Failed to load', search: 'Search by code or name',
      active: 'Active', inactive: 'Inactive',
    },
    ja: {
      title: 'ファンドデータ', subtitle: 'ファンド一覧・詳細・基準価額履歴',
      fundCode: 'コード', fundName: 'ファンド名', fundType: '種類',
      fundStatus: '状態', netValue: '基準価額', date: '日付',
      viewDetail: '詳細', history: '基準価額履歴', noFunds: 'ファンドなし',
      loading: '読み込み中...', error: '読み込み失敗', search: 'コードまたは名称で検索',
      active: 'アクティブ', inactive: '非アクティブ',
    },
    ko: {
      title: '펀드 데이터', subtitle: '펀드 목록, 상세 및 순자산가치 이력',
      fundCode: '코드', fundName: '펀드명', fundType: '유형',
      fundStatus: '상태', netValue: '순자산가치', date: '날짜',
      viewDetail: '상세', history: '순자산가치 이력', noFunds: '펀드 없음',
      loading: '로딩 중...', error: '로드 실패', search: '코드 또는 이름 검색',
      active: '활성', inactive: '비활성',
    },
    'zh-TW': {
      title: '基金資料', subtitle: '基金列表、詳情與淨值歷史查詢',
      fundCode: '基金代碼', fundName: '基金名稱', fundType: '基金類型',
      fundStatus: '狀態', netValue: '淨值', date: '日期',
      viewDetail: '查看詳情', history: '淨值歷史', noFunds: '暫無基金資料',
      loading: '載入中...', error: '載入失敗', search: '搜尋基金代碼或名稱',
      active: '活躍', inactive: '停用',
    },
  },
  metaLearner: {
    'zh-CN': {
      title: '自进化系统', subtitle: 'Meta-Learner 元学习与自进化运行状态管理',
      systemStatus: '系统状态', learner: '元学习器', scheduler: '调度器',
      skillEvolution: '技能进化', enabled: '已启用', disabled: '已禁用',
      lessons: '元知识', lessonType: '类型', confidence: '置信度',
      occurrenceCount: '出现次数', sourceSkills: '来源技能',
      history: '运行历史', trigger: '手动触发', triggerSuccess: '触发成功',
      triggerError: '触发失败', runAt: '运行时间', result: '结果',
      noLessons: '暂无元知识', noHistory: '暂无运行记录',
      loading: '加载中...', error: '加载失败', success: '成功', failed: '失败',
      duration: '耗时', lessonsExtracted: '提取知识数',
      failurePattern: '失败模式', improvementTip: '改进建议', bestPractice: '最佳实践',
    },
    en: {
      title: 'Meta-Learner', subtitle: 'Meta-learning and self-evolution system management',
      systemStatus: 'System Status', learner: 'Meta-Learner', scheduler: 'Scheduler',
      skillEvolution: 'Skill Evolution', enabled: 'Enabled', disabled: 'Disabled',
      lessons: 'Lessons', lessonType: 'Type', confidence: 'Confidence',
      occurrenceCount: 'Occurrences', sourceSkills: 'Source Skills',
      history: 'History', trigger: 'Trigger', triggerSuccess: 'Triggered successfully',
      triggerError: 'Trigger failed', runAt: 'Run At', result: 'Result',
      noLessons: 'No lessons', noHistory: 'No history',
      loading: 'Loading...', error: 'Failed to load', success: 'Success', failed: 'Failed',
      duration: 'Duration', lessonsExtracted: 'Lessons Extracted',
      failurePattern: 'Failure Pattern', improvementTip: 'Improvement Tip', bestPractice: 'Best Practice',
    },
    ja: {
      title: 'メタラーナー', subtitle: 'メタ学習と自己進化システム管理',
      systemStatus: 'システム状態', learner: 'メタラーナー', scheduler: 'スケジューラ',
      skillEvolution: 'スキル進化', enabled: '有効', disabled: '無効',
      lessons: 'メタ知識', lessonType: '種別', confidence: '信頼度',
      occurrenceCount: '出現回数', sourceSkills: '元スキル',
      history: '実行履歴', trigger: '手動トリガー', triggerSuccess: 'トリガー成功',
      triggerError: 'トリガー失敗', runAt: '実行時間', result: '結果',
      noLessons: 'メタ知識なし', noHistory: '履歴なし',
      loading: '読み込み中...', error: '読み込み失敗', success: '成功', failed: '失敗',
      duration: '所要時間', lessonsExtracted: '抽出知識数',
      failurePattern: '失敗パターン', improvementTip: '改善提案', bestPractice: 'ベストプラクティス',
    },
    ko: {
      title: '메타 러너', subtitle: '메타 학습 및 자가 진화 시스템 관리',
      systemStatus: '시스템 상태', learner: '메타 러너', scheduler: '스케줄러',
      skillEvolution: '스킬 진화', enabled: '활성화', disabled: '비활성화',
      lessons: '메타 지식', lessonType: '유형', confidence: '신뢰도',
      occurrenceCount: '발생 횟수', sourceSkills: '소스 스킬',
      history: '실행 기록', trigger: '수동 트리거', triggerSuccess: '트리거 성공',
      triggerError: '트리거 실패', runAt: '실행 시간', result: '결과',
      noLessons: '메타 지식 없음', noHistory: '기록 없음',
      loading: '로딩 중...', error: '로드 실패', success: '성공', failed: '실패',
      duration: '소요 시간', lessonsExtracted: '추출 지식 수',
      failurePattern: '실패 패턴', improvementTip: '개선 제안', bestPractice: '모범 사례',
    },
    'zh-TW': {
      title: '自進化系統', subtitle: 'Meta-Learner 元學習與自進化運行狀態管理',
      systemStatus: '系統狀態', learner: '元學習器', scheduler: '調度器',
      skillEvolution: '技能進化', enabled: '已啟用', disabled: '已禁用',
      lessons: '元知識', lessonType: '類型', confidence: '置信度',
      occurrenceCount: '出現次數', sourceSkills: '來源技能',
      history: '運行歷史', trigger: '手動觸發', triggerSuccess: '觸發成功',
      triggerError: '觸發失敗', runAt: '運行時間', result: '結果',
      noLessons: '暫無元知識', noHistory: '暫無運行記錄',
      loading: '載入中...', error: '載入失敗', success: '成功', failed: '失敗',
      duration: '耗時', lessonsExtracted: '提取知識數',
      failurePattern: '失敗模式', improvementTip: '改進建議', bestPractice: '最佳實踐',
    },
  },
}

const navKeys = {
  'zh-CN': { eduAiVoice: '实时语音', eduAiOutbound: '外呼营销', eduAiTbox: 'IoT 设备', eduAiFundData: '基金数据', eduAiMetaLearner: '自进化系统' },
  en: { eduAiVoice: 'Voice Call', eduAiOutbound: 'Outbound', eduAiTbox: 'IoT Devices', eduAiFundData: 'Fund Data', eduAiMetaLearner: 'Meta-Learner' },
  ja: { eduAiVoice: '音声通話', eduAiOutbound: 'アウトバウンド', eduAiTbox: 'IoT デバイス', eduAiFundData: 'ファンドデータ', eduAiMetaLearner: 'メタラーナー' },
  ko: { eduAiVoice: '음성 통화', eduAiOutbound: '아웃바운드', eduAiTbox: 'IoT 기기', eduAiFundData: '펀드 데이터', eduAiMetaLearner: '메타 러너' },
  'zh-TW': { eduAiVoice: '語音通話', eduAiOutbound: '外呼行銷', eduAiTbox: 'IoT 設備', eduAiFundData: '基金資料', eduAiMetaLearner: '自進化系統' },
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
