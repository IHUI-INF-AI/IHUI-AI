/**
 * feature-connect2 轮次 i18n 注入：eduAi.{stock, stt, dataRights} × 5 语言 + 导航 key
 * 幂等：已存在的 key 不覆盖。用法：node scripts/add-feature2-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'G:/IHUI-AI/packages/i18n/messages/web/'

const ns = {
  stock: {
    'zh-CN': {
      title: 'AI 股票分析', subtitle: '输入股票代码与问题，AI 智能分析走势与投资价值',
      symbolPlaceholder: '股票代码，如 AAPL 或 600519', questionPlaceholder: '输入你的问题，例如：分析这只股票最近的走势和风险',
      analyse: '开始分析', analysing: '分析中...', tokenBalance: 'Token 余额', total: '总额', used: '已用', remaining: '剩余',
      result: '分析结果', tokensUsed: 'Token 消耗', history: '历史分析', noHistory: '暂无分析记录',
      mockWarning: '分析服务暂未配置，当前为演示模式', error: '分析失败', empty: '输入股票代码开始分析',
      viewHistory: '查看详情', question: '问题', symbol: '代码', time: '时间', needBalance: 'Token 余额不足，请充值后重试',
    },
    en: {
      title: 'AI Stock Analysis', subtitle: 'Enter a symbol and question for AI-powered analysis',
      symbolPlaceholder: 'Symbol, e.g. AAPL or 600519', questionPlaceholder: 'Your question, e.g. analyze recent trend and risks',
      analyse: 'Analyze', analysing: 'Analyzing...', tokenBalance: 'Token Balance', total: 'Total', used: 'Used', remaining: 'Remaining',
      result: 'Result', tokensUsed: 'Tokens used', history: 'History', noHistory: 'No analysis yet',
      mockWarning: 'Analysis service not configured, demo mode', error: 'Analysis failed', empty: 'Enter a symbol to start',
      viewHistory: 'View', question: 'Question', symbol: 'Symbol', time: 'Time', needBalance: 'Insufficient token balance',
    },
    ja: {
      title: 'AI 株価分析', subtitle: '銘柄コードと質問を入力して AI が分析',
      symbolPlaceholder: '銘柄コード（例: AAPL / 600519）', questionPlaceholder: '質問を入力（例: 直近のトレンドとリスクを分析）',
      analyse: '分析開始', analysing: '分析中...', tokenBalance: 'トークン残高', total: '合計', used: '使用', remaining: '残り',
      result: '分析結果', tokensUsed: 'トークン消費', history: '分析履歴', noHistory: '履歴なし',
      mockWarning: '分析サービス未設定（デモモード）', error: '分析失敗', empty: '銘柄コードを入力してください',
      viewHistory: '詳細', question: '質問', symbol: '銘柄', time: '時間', needBalance: 'トークン残高不足',
    },
    ko: {
      title: 'AI 주식 분석', subtitle: '종목 코드와 질문을 입력하면 AI가 분석합니다',
      symbolPlaceholder: '종목 코드 (예: AAPL / 600519)', questionPlaceholder: '질문 입력 (예: 최근 추세와 위험 분석)',
      analyse: '분석 시작', analysing: '분석 중...', tokenBalance: '토큰 잔액', total: '총액', used: '사용', remaining: '잔여',
      result: '분석 결과', tokensUsed: '토큰 사용', history: '분석 기록', noHistory: '기록 없음',
      mockWarning: '분석 서비스 미설정 (데모 모드)', error: '분석 실패', empty: '종목 코드를 입력하세요',
      viewHistory: '상세', question: '질문', symbol: '종목', time: '시간', needBalance: '토큰 잔액 부족',
    },
    'zh-TW': {
      title: 'AI 股票分析', subtitle: '輸入股票代碼與問題，AI 智慧分析走勢與投資價值',
      symbolPlaceholder: '股票代碼，如 AAPL 或 600519', questionPlaceholder: '輸入你的問題，例如：分析這檔股票最近的走勢和風險',
      analyse: '開始分析', analysing: '分析中...', tokenBalance: 'Token 餘額', total: '總額', used: '已用', remaining: '剩餘',
      result: '分析結果', tokensUsed: 'Token 消耗', history: '歷史分析', noHistory: '暫無分析紀錄',
      mockWarning: '分析服務暫未設定，目前為示範模式', error: '分析失敗', empty: '輸入股票代碼開始分析',
      viewHistory: '查看詳情', question: '問題', symbol: '代碼', time: '時間', needBalance: 'Token 餘額不足，請儲值後重試',
    },
  },
  stt: {
    'zh-CN': {
      title: 'AI 语音转写', subtitle: '上传音频，AI 自动转写为文字',
      selectFile: '选择音频文件', fileSelected: '已选择文件', language: '语言', auto: '自动检测',
      zh: '中文', en: '英文', ja: '日文', transcribe: '开始转写', transcribing: '转写中...',
      result: '转写结果', model: '识别模型', stubWarning: '语音模型未就绪，返回空结果', error: '转写失败', noFile: '请先选择音频文件',
      supported: '支持 wav / mp3 / m4a / webm 格式',
    },
    en: {
      title: 'AI Speech-to-Text', subtitle: 'Upload audio, AI transcribes it to text',
      selectFile: 'Select audio file', fileSelected: 'File selected', language: 'Language', auto: 'Auto detect',
      zh: 'Chinese', en: 'English', ja: 'Japanese', transcribe: 'Transcribe', transcribing: 'Transcribing...',
      result: 'Result', model: 'Model', stubWarning: 'Speech model not ready, empty result', error: 'Failed', noFile: 'Select an audio file first',
      supported: 'Supports wav / mp3 / m4a / webm',
    },
    ja: {
      title: 'AI 音声文字起こし', subtitle: '音声をアップロードして AI が文字に変換',
      selectFile: '音声ファイルを選択', fileSelected: 'ファイル選択済み', language: '言語', auto: '自動検出',
      zh: '中国語', en: '英語', ja: '日本語', transcribe: '文字起こし開始', transcribing: '変換中...',
      result: '変換結果', model: 'モデル', stubWarning: '音声モデル未準備', error: '変換失敗', noFile: '音声ファイルを選択してください',
      supported: 'wav / mp3 / m4a / webm 対応',
    },
    ko: {
      title: 'AI 음성 텍스트 변환', subtitle: '오디오를 업로드하면 AI가 텍스트로 변환합니다',
      selectFile: '오디오 파일 선택', fileSelected: '파일 선택됨', language: '언어', auto: '자동 감지',
      zh: '중국어', en: '영어', ja: '일본어', transcribe: '변환 시작', transcribing: '변환 중...',
      result: '변환 결과', model: '모델', stubWarning: '음성 모델 미준비', error: '변환 실패', noFile: '오디오 파일을 먼저 선택하세요',
      supported: 'wav / mp3 / m4a / webm 지원',
    },
    'zh-TW': {
      title: 'AI 語音轉寫', subtitle: '上傳音訊，AI 自動轉寫為文字',
      selectFile: '選擇音訊檔案', fileSelected: '已選擇檔案', language: '語言', auto: '自動偵測',
      zh: '中文', en: '英文', ja: '日文', transcribe: '開始轉寫', transcribing: '轉寫中...',
      result: '轉寫結果', model: '辨識模型', stubWarning: '語音模型未就緒，回傳空結果', error: '轉寫失敗', noFile: '請先選擇音訊檔案',
      supported: '支援 wav / mp3 / m4a / webm 格式',
    },
  },
  dataRights: {
    'zh-CN': {
      title: '数据权利', subtitle: '管理你的个人数据：导出、转移与擦除',
      exportCard: '数据导出', exportDesc: '下载你的全部个人数据副本（账户信息、搜索历史、审计日志）',
      exportBtn: '导出我的数据', exporting: '导出中...', exportResult: '导出结果', downloadJson: '下载 JSON 文件',
      portabilityCard: '数据可携带', portabilityDesc: '将你的数据打包，便于转移到其他服务',
      portabilityBtn: '生成可携带数据', portabilityResult: '可携带数据',
      eraseCard: '数据擦除', eraseDesc: '永久擦除你的账号数据，此操作不可恢复！',
      eraseBtn: '擦除我的数据', eraseConfirm: '确认擦除', eraseConfirmText: '请输入 DELETE 确认永久擦除',
      eraseSuccess: '数据已擦除', eraseDone: '你的数据已被永久擦除，请重新登录或注册新账号',
      error: '操作失败', userInfo: '账户信息', searchHistory: '搜索历史', auditLogs: '审计日志',
      email: '邮箱', phone: '手机', nickname: '昵称', cancel: '取消', confirm: '确认', close: '关闭',
      exportSucceeded: '导出成功', count: '条', download: '下载',
    },
    en: {
      title: 'Data Rights', subtitle: 'Manage your personal data: export, portability and erasure',
      exportCard: 'Data Export', exportDesc: 'Download a copy of all your personal data (profile, search history, audit logs)',
      exportBtn: 'Export my data', exporting: 'Exporting...', exportResult: 'Export result', downloadJson: 'Download JSON',
      portabilityCard: 'Portability', portabilityDesc: 'Package your data for transfer to other services',
      portabilityBtn: 'Generate portable data', portabilityResult: 'Portable data',
      eraseCard: 'Data Erasure', eraseDesc: 'Permanently erase your account data. This cannot be undone!',
      eraseBtn: 'Erase my data', eraseConfirm: 'Confirm erasure', eraseConfirmText: 'Type DELETE to confirm permanent erasure',
      eraseSuccess: 'Data erased', eraseDone: 'Your data has been permanently erased. Please sign in or register again',
      error: 'Failed', userInfo: 'Profile', searchHistory: 'Search history', auditLogs: 'Audit logs',
      email: 'Email', phone: 'Phone', nickname: 'Nickname', cancel: 'Cancel', confirm: 'Confirm', close: 'Close',
      exportSucceeded: 'Exported', count: 'items', download: 'Download',
    },
    ja: {
      title: 'データ権利', subtitle: '個人データの管理：エクスポート・転送・消去',
      exportCard: 'データエクスポート', exportDesc: '全個人データ（プロフィール・検索履歴・監査ログ）のコピーをダウンロード',
      exportBtn: 'データをエクスポート', exporting: 'エクスポート中...', exportResult: 'エクスポート結果', downloadJson: 'JSON をダウンロード',
      portabilityCard: 'データポータビリティ', portabilityDesc: '他のサービスへの転送用にデータをパッケージ化',
      portabilityBtn: '転送用データを生成', portabilityResult: '転送用データ',
      eraseCard: 'データ消去', eraseDesc: 'アカウントデータを完全に消去します。取り消せません！',
      eraseBtn: 'データを消去', eraseConfirm: '消去を確認', eraseConfirmText: 'DELETE と入力して完全消去を確認',
      eraseSuccess: 'データを消去しました', eraseDone: 'データは完全に消去されました。再度ログインまたは新規登録してください',
      error: '失敗', userInfo: 'プロフィール', searchHistory: '検索履歴', auditLogs: '監査ログ',
      email: 'メール', phone: '電話', nickname: 'ニックネーム', cancel: 'キャンセル', confirm: '確認', close: '閉じる',
      exportSucceeded: 'エクスポート完了', count: '件', download: 'ダウンロード',
    },
    ko: {
      title: '데이터 권리', subtitle: '개인 데이터 관리: 내보내기, 전송, 삭제',
      exportCard: '데이터 내보내기', exportDesc: '모든 개인 데이터(프로필·검색 기록·감사 로그) 사본 다운로드',
      exportBtn: '내 데이터 내보내기', exporting: '내보내는 중...', exportResult: '내보내기 결과', downloadJson: 'JSON 다운로드',
      portabilityCard: '데이터 이동', portabilityDesc: '다른 서비스로 전송할 수 있도록 데이터 패키징',
      portabilityBtn: '이동용 데이터 생성', portabilityResult: '이동용 데이터',
      eraseCard: '데이터 삭제', eraseDesc: '계정 데이터를 영구 삭제합니다. 되돌릴 수 없습니다!',
      eraseBtn: '내 데이터 삭제', eraseConfirm: '삭제 확인', eraseConfirmText: '영구 삭제 확인을 위해 DELETE 입력',
      eraseSuccess: '데이터 삭제 완료', eraseDone: '데이터가 영구 삭제되었습니다. 다시 로그인하거나 새로 가입하세요',
      error: '실패', userInfo: '프로필', searchHistory: '검색 기록', auditLogs: '감사 로그',
      email: '이메일', phone: '전화', nickname: '닉네임', cancel: '취소', confirm: '확인', close: '닫기',
      exportSucceeded: '내보내기 완료', count: '개', download: '다운로드',
    },
    'zh-TW': {
      title: '資料權利', subtitle: '管理你的個人資料：匯出、轉移與刪除',
      exportCard: '資料匯出', exportDesc: '下載你的全部個人資料副本（帳號資訊、搜尋歷史、稽核日誌）',
      exportBtn: '匯出我的資料', exporting: '匯出中...', exportResult: '匯出結果', downloadJson: '下載 JSON 檔案',
      portabilityCard: '資料可攜', portabilityDesc: '將你的資料打包，便於轉移到其他服務',
      portabilityBtn: '產生可攜資料', portabilityResult: '可攜資料',
      eraseCard: '資料刪除', eraseDesc: '永久刪除你的帳號資料，此操作不可恢復！',
      eraseBtn: '刪除我的資料', eraseConfirm: '確認刪除', eraseConfirmText: '請輸入 DELETE 確認永久刪除',
      eraseSuccess: '資料已刪除', eraseDone: '你的資料已被永久刪除，請重新登入或註冊新帳號',
      error: '操作失敗', userInfo: '帳號資訊', searchHistory: '搜尋歷史', auditLogs: '稽核日誌',
      email: '信箱', phone: '手機', nickname: '暱稱', cancel: '取消', confirm: '確認', close: '關閉',
      exportSucceeded: '匯出成功', count: '筆', download: '下載',
    },
  },
}

const navKeys = {
  'zh-CN': { eduAiStock: 'AI 股票分析', eduAiStt: 'AI 语音转写', eduAiDataRights: '数据权利' },
  en: { eduAiStock: 'AI Stock', eduAiStt: 'Speech-to-Text', eduAiDataRights: 'Data Rights' },
  ja: { eduAiStock: 'AI 株価分析', eduAiStt: '音声文字起こし', eduAiDataRights: 'データ権利' },
  ko: { eduAiStock: 'AI 주식 분석', eduAiStt: '음성 텍스트', eduAiDataRights: '데이터 권리' },
  'zh-TW': { eduAiStock: 'AI 股票分析', eduAiStt: 'AI 語音轉寫', eduAiDataRights: '資料權利' },
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
