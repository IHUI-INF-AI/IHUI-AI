/**
 * feature-connect 轮次 i18n 注入：eduAi.{video, letters, security, groups} × 5 语言
 * 幂等：已存在的 key 不覆盖。用法：node scripts/add-feature-connect-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const dir = 'G:/IHUI-AI/packages/i18n/messages/web/'

const ns = {
  video: {
    'zh-CN': {
      title: 'AI 视频编排', subtitle: '一句话生成脚本、素材、合成与字幕，全流程 AI 自动完成',
      promptPlaceholder: '输入视频创意，例如：制作一条 30 秒的 AI 科普短视频，介绍大模型如何工作',
      modelPlaceholder: '模型（可选，默认 stepfun/step-3.7-flash）', createBtn: '开始编排', creating: '编排中...',
      stepScript: '脚本生成', stepMaterial: '素材收集', stepCompose: '视频合成', stepSubtitle: '字幕生成',
      statusPending: '等待中', statusRunning: '执行中', statusSucceeded: '已完成', statusFailed: '失败',
      regenerate: '重新生成', detail: '查看详情', error: '编排失败', success: '编排完成',
      taskId: '任务 ID', noTasks: '暂无任务，输入创意开始你的第一个视频编排', elapsed: '耗时',
      scriptResult: '脚本内容', materialResult: '素材列表', composeResult: '合成视频', subtitleResult: '字幕文件',
      promptLabel: '视频创意', stepLabel: '当前步骤', optional: '（可选）',
    },
    en: {
      title: 'AI Video Compose', subtitle: 'Generate script, materials, video and subtitles from one prompt',
      promptPlaceholder: 'Enter your video idea, e.g. a 30s AI science short video about how LLMs work',
      modelPlaceholder: 'Model (optional, default stepfun/step-3.7-flash)', createBtn: 'Start', creating: 'Creating...',
      stepScript: 'Script', stepMaterial: 'Materials', stepCompose: 'Compose', stepSubtitle: 'Subtitles',
      statusPending: 'Pending', statusRunning: 'Running', statusSucceeded: 'Done', statusFailed: 'Failed',
      regenerate: 'Regenerate', detail: 'Details', error: 'Compose failed', success: 'Compose done',
      taskId: 'Task ID', noTasks: 'No tasks yet. Start your first video compose now', elapsed: 'Elapsed',
      scriptResult: 'Script', materialResult: 'Materials', composeResult: 'Video', subtitleResult: 'Subtitles',
      promptLabel: 'Prompt', stepLabel: 'Step', optional: '(optional)',
    },
    ja: {
      title: 'AI 動画編成', subtitle: 'プロンプトから脚本・素材・合成・字幕を全自動生成',
      promptPlaceholder: '動画アイデアを入力（例：LLM の仕組みを紹介する 30 秒の AI 科学解説動画）',
      modelPlaceholder: 'モデル（任意、デフォルト stepfun/step-3.7-flash）', createBtn: '開始', creating: '編成中...',
      stepScript: '脚本生成', stepMaterial: '素材収集', stepCompose: '動画合成', stepSubtitle: '字幕生成',
      statusPending: '待機中', statusRunning: '実行中', statusSucceeded: '完了', statusFailed: '失敗',
      regenerate: '再生成', detail: '詳細', error: '編成失敗', success: '編成完了',
      taskId: 'タスク ID', noTasks: 'タスクはまだありません', elapsed: '所要時間',
      scriptResult: '脚本', materialResult: '素材', composeResult: '動画', subtitleResult: '字幕',
      promptLabel: 'プロンプト', stepLabel: 'ステップ', optional: '（任意）',
    },
    ko: {
      title: 'AI 영상 편성', subtitle: '프롬프트 하나로 대본·소재·합성·자막 전 과정 자동화',
      promptPlaceholder: '영상 아이디어를 입력하세요 (예: LLM 작동 원리를 소개하는 30초 AI 과학 영상)',
      modelPlaceholder: '모델 (선택, 기본 stepfun/step-3.7-flash)', createBtn: '시작', creating: '편성 중...',
      stepScript: '대본 생성', stepMaterial: '소재 수집', stepCompose: '영상 합성', stepSubtitle: '자막 생성',
      statusPending: '대기 중', statusRunning: '실행 중', statusSucceeded: '완료', statusFailed: '실패',
      regenerate: '재생성', detail: '상세', error: '편성 실패', success: '편성 완료',
      taskId: '작업 ID', noTasks: '아직 작업이 없습니다', elapsed: '소요 시간',
      scriptResult: '대본', materialResult: '소재', composeResult: '영상', subtitleResult: '자막',
      promptLabel: '프롬프트', stepLabel: '단계', optional: '(선택)',
    },
    'zh-TW': {
      title: 'AI 影片編排', subtitle: '一句話生成腳本、素材、合成與字幕，全流程 AI 自動完成',
      promptPlaceholder: '輸入影片創意，例如：製作一支 30 秒的 AI 科普短影片',
      modelPlaceholder: '模型（可選，預設 stepfun/step-3.7-flash）', createBtn: '開始編排', creating: '編排中...',
      stepScript: '腳本生成', stepMaterial: '素材收集', stepCompose: '影片合成', stepSubtitle: '字幕生成',
      statusPending: '等待中', statusRunning: '執行中', statusSucceeded: '已完成', statusFailed: '失敗',
      regenerate: '重新生成', detail: '查看詳情', error: '編排失敗', success: '編排完成',
      taskId: '任務 ID', noTasks: '尚無任務，輸入創意開始你的第一個影片編排', elapsed: '耗時',
      scriptResult: '腳本內容', materialResult: '素材列表', composeResult: '合成影片', subtitleResult: '字幕檔案',
      promptLabel: '影片創意', stepLabel: '目前步驟', optional: '（可選）',
    },
  },
  letters: {
    'zh-CN': {
      title: '私信', subtitle: '与平台用户一对一的私密沟通',
      searchPlaceholder: '搜索联系人...', noConversation: '选择左侧会话开始聊天', sendPlaceholder: '输入消息内容...',
      send: '发送', empty: '暂无会话', delete: '删除', you: '我', loading: '加载中...', error: '加载失败',
      deleteConfirm: '确定删除这条私信？', sendSuccess: '发送成功', members: '联系人',
    },
    en: {
      title: 'Private Messages', subtitle: 'One-on-one private chat with platform users',
      searchPlaceholder: 'Search contacts...', noConversation: 'Select a conversation to start chatting',
      sendPlaceholder: 'Type a message...', send: 'Send', empty: 'No conversations', delete: 'Delete',
      you: 'Me', loading: 'Loading...', error: 'Failed to load', deleteConfirm: 'Delete this message?',
      sendSuccess: 'Sent', members: 'Contacts',
    },
    ja: {
      title: 'プライベートメッセージ', subtitle: 'プラットフォームユーザーとの1対1のプライベートチャット',
      searchPlaceholder: '連絡先を検索...', noConversation: '会話を選択してチャットを開始',
      sendPlaceholder: 'メッセージを入力...', send: '送信', empty: '会話なし', delete: '削除',
      you: '私', loading: '読み込み中...', error: '読み込み失敗', deleteConfirm: 'このメッセージを削除しますか？',
      sendSuccess: '送信しました', members: '連絡先',
    },
    ko: {
      title: '쪽지', subtitle: '플랫폼 사용자와 1:1 비공개 대화',
      searchPlaceholder: '연락처 검색...', noConversation: '왼쪽에서 대화를 선택하세요',
      sendPlaceholder: '메시지 입력...', send: '보내기', empty: '대화 없음', delete: '삭제',
      you: '나', loading: '로딩 중...', error: '로드 실패', deleteConfirm: '이 메시지를 삭제할까요?',
      sendSuccess: '전송 완료', members: '연락처',
    },
    'zh-TW': {
      title: '私訊', subtitle: '與平台用戶一對一的私密溝通',
      searchPlaceholder: '搜尋聯絡人...', noConversation: '選擇左側會話開始聊天', sendPlaceholder: '輸入訊息內容...',
      send: '傳送', empty: '暫無會話', delete: '刪除', you: '我', loading: '載入中...', error: '載入失敗',
      deleteConfirm: '確定刪除這則私訊？', sendSuccess: '傳送成功', members: '聯絡人',
    },
  },
  security: {
    'zh-CN': {
      mfaTitle: '两步验证（MFA）', mfaDesc: '使用身份验证器应用（如 Google Authenticator）增强账号安全',
      enableMfa: '启用两步验证', mfaEnabled: '已启用', enabledAt: '启用时间', backupCodes: '恢复码',
      backupCodesRemaining: '剩余恢复码', regenerateCodes: '重新生成恢复码', disableMfa: '禁用两步验证',
      enterPassword: '输入账号密码', verifyCode: '输入 6 位验证码', scanQr: '扫描二维码',
      saveCodesWarning: '请立即保存以下恢复码，关闭后不再显示！', passkeyTitle: 'Passkey 免密登录',
      passkeyDesc: '使用设备生物识别（指纹/面容）或系统 PIN 免密登录', addPasskey: '添加 Passkey',
      passkeyNotSupported: '当前浏览器不支持 WebAuthn', success: '操作成功', error: '操作失败',
      confirm: '确认', cancel: '取消', copySecret: '复制密钥', secret: '密钥', enableConfirm: '启用',
    },
    en: {
      mfaTitle: 'Two-factor auth (MFA)', mfaDesc: 'Use an authenticator app (e.g. Google Authenticator) for extra security',
      enableMfa: 'Enable 2FA', mfaEnabled: 'Enabled', enabledAt: 'Enabled at', backupCodes: 'Recovery codes',
      backupCodesRemaining: 'Recovery codes left', regenerateCodes: 'Regenerate codes', disableMfa: 'Disable 2FA',
      enterPassword: 'Enter your password', verifyCode: 'Enter 6-digit code', scanQr: 'Scan QR code',
      saveCodesWarning: 'Save these recovery codes now — they will not be shown again!', passkeyTitle: 'Passkey sign-in',
      passkeyDesc: 'Use device biometrics (fingerprint/face) or system PIN to sign in', addPasskey: 'Add Passkey',
      passkeyNotSupported: 'WebAuthn is not supported in this browser', success: 'Done', error: 'Failed',
      confirm: 'Confirm', cancel: 'Cancel', copySecret: 'Copy secret', secret: 'Secret', enableConfirm: 'Enable',
    },
    ja: {
      mfaTitle: '2段階認証（MFA）', mfaDesc: '認証アプリ（Google Authenticator 等）でアカウントを保護',
      enableMfa: '2段階認証を有効化', mfaEnabled: '有効', enabledAt: '有効化日時', backupCodes: 'リカバリーコード',
      backupCodesRemaining: '残りリカバリーコード', regenerateCodes: '再生成', disableMfa: '2段階認証を無効化',
      enterPassword: 'パスワードを入力', verifyCode: '6桁の認証コードを入力', scanQr: 'QRコードをスキャン',
      saveCodesWarning: 'リカバリーコードを今すぐ保存してください。再表示されません！', passkeyTitle: 'Passkey ログイン',
      passkeyDesc: 'デバイスの生体認証または PIN でログイン', addPasskey: 'Passkey を追加',
      passkeyNotSupported: 'このブラウザは WebAuthn に対応していません', success: '成功', error: '失敗',
      confirm: '確認', cancel: 'キャンセル', copySecret: 'シークレットをコピー', secret: 'シークレット', enableConfirm: '有効化',
    },
    ko: {
      mfaTitle: '2단계 인증 (MFA)', mfaDesc: '인증 앱(Google Authenticator 등)으로 계정 보안 강화',
      enableMfa: '2단계 인증 활성화', mfaEnabled: '활성화됨', enabledAt: '활성화 시각', backupCodes: '복구 코드',
      backupCodesRemaining: '남은 복구 코드', regenerateCodes: '복구 코드 재생성', disableMfa: '2단계 인증 비활성화',
      enterPassword: '비밀번호 입력', verifyCode: '6자리 코드 입력', scanQr: 'QR 코드 스캔',
      saveCodesWarning: '복구 코드를 지금 저장하세요. 다시 표시되지 않습니다!', passkeyTitle: 'Passkey 로그인',
      passkeyDesc: '기기 생체인증(지문/얼굴) 또는 PIN으로 로그인', addPasskey: 'Passkey 추가',
      passkeyNotSupported: '이 브라우저는 WebAuthn을 지원하지 않습니다', success: '성공', error: '실패',
      confirm: '확인', cancel: '취소', copySecret: '시크릿 복사', secret: '시크릿', enableConfirm: '활성화',
    },
    'zh-TW': {
      mfaTitle: '兩步驟驗證（MFA）', mfaDesc: '使用驗證器應用程式（如 Google Authenticator）增強帳號安全',
      enableMfa: '啟用兩步驟驗證', mfaEnabled: '已啟用', enabledAt: '啟用時間', backupCodes: '恢復碼',
      backupCodesRemaining: '剩餘恢復碼', regenerateCodes: '重新產生恢復碼', disableMfa: '停用兩步驟驗證',
      enterPassword: '輸入帳號密碼', verifyCode: '輸入 6 位驗證碼', scanQr: '掃描 QR Code',
      saveCodesWarning: '請立即儲存以下恢復碼，關閉後不再顯示！', passkeyTitle: 'Passkey 免密登入',
      passkeyDesc: '使用裝置生物辨識（指紋/臉部）或系統 PIN 免密登入', addPasskey: '新增 Passkey',
      passkeyNotSupported: '目前瀏覽器不支援 WebAuthn', success: '操作成功', error: '操作失敗',
      confirm: '確認', cancel: '取消', copySecret: '複製金鑰', secret: '金鑰', enableConfirm: '啟用',
    },
  },
  groups: {
    'zh-CN': {
      title: '我的群组', subtitle: '创建和管理你的用户群组',
      createGroup: '创建群组', groupName: '群组名称', description: '群组描述', members: '成员数',
      createdAt: '创建时间', edit: '编辑', delete: '删除', addMember: '添加成员', userId: '用户 ID',
      save: '保存', cancel: '取消', empty: '暂无群组，点击右上角创建', success: '操作成功', error: '操作失败',
      confirmDelete: '确定删除该群组？', type: '类型', owner: '群主', memberList: '成员管理',
      groupNameRequired: '群组名称不能为空', custom: '自定义', close: '关闭',
    },
    en: {
      title: 'My Groups', subtitle: 'Create and manage your user groups',
      createGroup: 'Create Group', groupName: 'Group name', description: 'Description', members: 'Members',
      createdAt: 'Created at', edit: 'Edit', delete: 'Delete', addMember: 'Add member', userId: 'User ID',
      save: 'Save', cancel: 'Cancel', empty: 'No groups yet. Create your first group', success: 'Done', error: 'Failed',
      confirmDelete: 'Delete this group?', type: 'Type', owner: 'Owner', memberList: 'Members',
      groupNameRequired: 'Group name is required', custom: 'Custom', close: 'Close',
    },
    ja: {
      title: 'マイグループ', subtitle: 'ユーザーグループの作成・管理',
      createGroup: 'グループ作成', groupName: 'グループ名', description: '説明', members: 'メンバー数',
      createdAt: '作成日時', edit: '編集', delete: '削除', addMember: 'メンバー追加', userId: 'ユーザーID',
      save: '保存', cancel: 'キャンセル', empty: 'グループはまだありません', success: '成功', error: '失敗',
      confirmDelete: 'このグループを削除しますか？', type: 'タイプ', owner: 'オーナー', memberList: 'メンバー管理',
      groupNameRequired: 'グループ名は必須です', custom: 'カスタム', close: '閉じる',
    },
    ko: {
      title: '내 그룹', subtitle: '사용자 그룹 생성 및 관리',
      createGroup: '그룹 만들기', groupName: '그룹 이름', description: '설명', members: '멤버 수',
      createdAt: '생성 시간', edit: '편집', delete: '삭제', addMember: '멤버 추가', userId: '사용자 ID',
      save: '저장', cancel: '취소', empty: '아직 그룹이 없습니다', success: '성공', error: '실패',
      confirmDelete: '이 그룹을 삭제할까요?', type: '유형', owner: '소유자', memberList: '멤버 관리',
      groupNameRequired: '그룹 이름은 필수입니다', custom: '사용자 지정', close: '닫기',
    },
    'zh-TW': {
      title: '我的群組', subtitle: '建立和管理你的使用者群組',
      createGroup: '建立群組', groupName: '群組名稱', description: '群組描述', members: '成員數',
      createdAt: '建立時間', edit: '編輯', delete: '刪除', addMember: '新增成員', userId: '使用者 ID',
      save: '儲存', cancel: '取消', empty: '尚無群組，點擊右上角建立', success: '操作成功', error: '操作失敗',
      confirmDelete: '確定刪除該群組？', type: '類型', owner: '群主', memberList: '成員管理',
      groupNameRequired: '群組名稱不能為空', custom: '自訂', close: '關閉',
    },
  },
}

const navKeys = {
  'zh-CN': { eduAiVideo: 'AI 视频编排', eduAiLetters: '私信', eduAiSecurity: '登录安全', eduAiGroups: '我的群组' },
  en: { eduAiVideo: 'AI Video Compose', eduAiLetters: 'Messages', eduAiSecurity: 'Login Security', eduAiGroups: 'My Groups' },
  ja: { eduAiVideo: 'AI 動画編成', eduAiLetters: 'メッセージ', eduAiSecurity: 'ログインセキュリティ', eduAiGroups: 'マイグループ' },
  ko: { eduAiVideo: 'AI 영상 편성', eduAiLetters: '쪽지', eduAiSecurity: '로그인 보안', eduAiGroups: '내 그룹' },
  'zh-TW': { eduAiVideo: 'AI 影片編排', eduAiLetters: '私訊', eduAiSecurity: '登入安全', eduAiGroups: '我的群組' },
}

const langs = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
let injected = 0

for (const lang of langs) {
  const file = dir + lang + '.json'
  const data = JSON.parse(readFileSync(file, 'utf8'))

  // 1. 确保 eduAi 命名空间存在
  if (!data.eduAi) data.eduAi = {}

  // 2. 注入 4 个命名空间
  for (const [nsName, nsData] of Object.entries(ns)) {
    if (!data.eduAi[nsName]) data.eduAi[nsName] = {}
    for (const [key, value] of Object.entries(nsData[lang])) {
      if (!(key in data.eduAi[nsName])) {
        data.eduAi[nsName][key] = value
        injected++
      }
    }
  }

  // 3. 注入导航 key
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
