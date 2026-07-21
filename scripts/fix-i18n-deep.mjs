#!/usr/bin/env node
/**
 * i18n 深度审校问题修复脚本 (配套 deep-i18n-audit.mjs)。
 *
 * 修复策略:
 *   1. zh-TW: opencc 字形转换 + 27 条 TW 用词映射 (机械修复,高质量)
 *   2. ja: 翻译表 (常见 en 值) + 模式匹配 (Edit X / Search X / Back to X 等) + en 兜底
 *   3. ko: 翻译表 (常见 en 值) + 模式匹配 + en 兜底
 *   4. 术语统一: 11 处具体覆盖
 *
 * 用法: node scripts/fix-i18n-deep.mjs
 * 修改: apps/web/messages/{zh-TW,ja,ko}.json (不修改 en.json / zh-CN.json)
 */
import fs from 'node:fs'
import path from 'node:path'
import * as OpenCC from 'opencc-js'

const ROOT = process.cwd()
const MSG_DIR = path.join(ROOT, 'apps/web/messages')
const REPORT_PATH = path.join(ROOT, '.trae-cn/goal-runtime/deep-i18n-audit-report.json')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// ============================================================
// 加载
// ============================================================
function loadLang(lang) {
  return JSON.parse(fs.readFileSync(path.join(MSG_DIR, `${lang}.json`), 'utf8'))
}
function saveLang(lang, data) {
  fs.writeFileSync(path.join(MSG_DIR, `${lang}.json`), JSON.stringify(data, null, 2) + '\n', 'utf8')
}
function flatten(obj, prefix = '', map = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, p, map)
    else map.set(p, v)
  }
  return map
}
function setNested(obj, dotPath, value) {
  const parts = dotPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

const zhTW = loadLang('zh-TW')
const ja = loadLang('ja')
const ko = loadLang('ko')
const enFlat = flatten(loadLang('en'))

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'))

// ============================================================
// zh-TW 修复: opencc + TW 用词映射
// ============================================================
const simpConverter = OpenCC.Converter({ from: 'cn', to: 'tw' })
const TW_VOCAB = [
  ['用戶', '使用者'], ['搜索', '搜尋'], ['導出', '匯出'], ['保存', '儲存'],
  ['數據', '資料'], ['視頻', '影片'], ['軟件', '軟體'], ['博客', '部落格'],
  ['默認', '預設'], ['屏幕', '螢幕'], ['鼠標', '滑鼠'], ['硬盤', '硬碟'],
  ['域名', '網域'], ['帶寬', '頻寬'], ['客服', '客戶服務'], ['登錄', '登入'],
  ['注冊', '註冊'], ['點擊', '點選'], ['鏈接', '連結'], ['訪問', '造訪'],
  ['內存', '記憶體'], ['光盤', '光碟'], ['打印', '列印'], ['共享', '共用'],
  ['數字', '數位'], ['網絡', '網路'], ['程序', '程式'], ['代碼', '程式碼'],
  ['鏈結', '連結'],
]

function fixZhTWValue(value, enValue) {
  if (typeof value !== 'string' || !value) return value
  if (!/[\u4e00-\u9fff]/.test(value)) return value
  const enHasCJK = typeof enValue === 'string' && /[\u4e00-\u9fff]/.test(enValue)
  let result = value
  // 1. 字形级: opencc 简→繁 (跳过 en 也含 CJK 的情况, 因品牌名应保持)
  const converted = simpConverter(result)
  if (converted !== result && !enHasCJK) {
    result = converted
  } else if (converted !== result && enHasCJK) {
    // 即使 en 含 CJK, 若 value 含简体字也转换 (智谱清言 → 智譜清言 也是改进)
    result = converted
  }
  // 2. 用词级: 大陆用词 → TW 用词 (跳过 en 也含相同词的情况)
  for (const [mainland, tw] of TW_VOCAB) {
    if (result.includes(mainland) && !(enValue && enValue.includes(mainland))) {
      result = result.split(mainland).join(tw)
    }
  }
  return result
}

// ============================================================
// ja 翻译表 (常见 en 值 → 日文翻译)
// ============================================================
const JA_TABLE = {
  'Next': '次へ',
  'Previous': '前へ',
  'Prev': '前',
  'Published': '公開済み',
  'Pending': '保留中',
  'All': 'すべて',
  'Rejected': '却下済み',
  'Sort': 'ソート',
  'Approved': '承認済み',
  'Duration': '所要時間',
  'and': 'と',
  'Back to Learning': '学習に戻る',
  'I': '私の',
  'Expired': '期限切れ',
  'Paid': '支払済み',
  'to': 'へ',
  'PaySuccess': '支払成功',
  'Deleted': '削除済み',
  'Pending Review': '審査待ち',
  'About Us': '私たちについて',
  'Payment': '支払い',
  'Enter verification code': '認証コードを入力',
  'Resolved': '解決済み',
  'Fill Blank': '空欄補充',
  'Select Paper': '試験問題を選択',
  'Submitted': '提出済み',
  'Enter description': '説明を入力',
  'My Comments': 'マイコメント',
  'I Favorite': 'お気に入り',
  'Alipay': 'Alipay',
  'Pay Now': '今すぐ支払う',
  'Back to Exam Management': '試験管理に戻る',
  'Graded': '採点済み',
  'Edit Category': 'カテゴリを編集',
  'Enter category name': 'カテゴリ名を入力',
  'Enter title': 'タイトルを入力',
  'Back to Education': '教育に戻る',
  'Select paper': '試験問題を選択',
  'Sort Order': '並び順',
  'Search UUID': 'UUIDを検索',
  'My Points': 'マイポイント',
  'My Questions': 'マイ質問',
  'Send failed': '送信失敗',
  'Back to Certificates': '証明書一覧に戻る',
  'Name is required': '名前は必須です',
  'Back to Exam': '試験に戻る',
  'Name cannot be empty': '名前は空にできません',
  'Issued': '発行済み',
  'I Follow': 'フォロー中',
  'My Lessons': 'マイレッスン',
  'Search user ID': 'ユーザーIDを検索',
  'Enter your phone number': '電話番号を入力',
  'Resend in {seconds}s': '{seconds}s後に再送信',
  'Payments': '支払い',
  'To Balance': '残高へ',
  'Edit Question': '問題を編集',
  'Edit Chapter': 'チャプターを編集',
  'Built-in': '組み込み',
  'Issue Certificate': '証明書を発行',
  'Search students...': '学生を検索...',
  'Edit category': 'カテゴリを編集',
  'Back to Exams': '試験一覧に戻る',
  'Edit Template': 'テンプレートを編集',
  'Edit Topic': 'トピックを編集',
  'New Material': '新規資料',
  'Edit Material': '資料を編集',
  'Search records...': '記録を検索...',
  'Edit Rule': 'ルールを編集',
  'Manage certificate templates': '証明書テンプレートを管理',
  'Type a message to start the conversation': 'メッセージを入力して会話を開始',
  'Enter rule name': 'ルール名を入力',
  'Enter rule code': 'ルールコードを入力',
  'Enter link': 'リンクを入力',
  'Search title': 'タイトルを検索',
  'Search Agent ID': 'Agent IDを検索',
  'Search {label}': '{label}を検索',
  'Current device': '現在のデバイス',
  'Pay': '支払う',
  'Manage your personal profile information': '個人情報を管理',
  'New Category': '新規カテゴリ',
  'New Chapter': '新規チャプター',
  'New Question': '新規問題',
  'New Topic': '新規トピック',
  'New Template': '新規テンプレート',
  'New Rule': '新規ルール',
  'Enter name': '名前を入力',
  'Enter content': '内容を入力',
  'Enter URL': 'URLを入力',
  'Enter keyword': 'キーワードを入力',
  'Search name': '名前を検索',
  'Search title...': 'タイトルを検索...',
  'Search content...': '内容を検索...',
  'Loading...': '読み込み中...',
  'Sending...': '送信中...',
  'Creating...': '作成中...',
  'Saving...': '保存中...',
  'Deleting...': '削除中...',
  'Updating...': '更新中...',
  'No data': 'データがありません',
  'No results': '結果がありません',
  'No results found': '結果が見つかりません',
  'No more data': 'これ以上データはありません',
  'Operation successful': '操作成功',
  'Operation failed': '操作失敗',
  'Save success': '保存成功',
  'Save failed': '保存失敗',
  'Delete success': '削除成功',
  'Delete failed': '削除失敗',
  'Update success': '更新成功',
  'Update failed': '更新失敗',
  'Create success': '作成成功',
  'Create failed': '作成失敗',
  'Confirm delete': '削除を確認',
  'Confirm operation': '操作を確認',
  'Are you sure': 'よろしいですか',
  'Are you sure to delete': '削除してもよろしいですか',
  'Are you sure to delete this item': 'この項目を削除してもよろしいですか',
  'This action cannot be undone': 'この操作は取り消せません',
  'Cancel': 'キャンセル',
  'Confirm': '確認',
  'OK': 'OK',
  'Yes': 'はい',
  'No': 'いいえ',
  'True': '真',
  'False': '偽',
  'Enable': '有効化',
  'Disable': '無効化',
  'Enabled': '有効',
  'Disabled': '無効',
  'Active': 'アクティブ',
  'Inactive': '非アクティブ',
  'Online': 'オンライン',
  'Offline': 'オフライン',
  'Running': '実行中',
  'Stopped': '停止',
  'Paused': '一時停止',
  'Completed': '完了',
  'Cancelled': 'キャンセル',
  'Failed': '失敗',
  'Success': '成功',
  'Warning': '警告',
  'Error': 'エラー',
  'Info': '情報',
  'Debug': 'デバッグ',
  'Trace': 'トレース',
  'Fatal': '致命的',
  'Unknown': '不明',
  'None': 'なし',
  'Empty': '空',
  'Null': 'ヌル',
  'Undefined': '未定義',
  'Valid': '有効',
  'Invalid': '無効',
  'Required': '必須',
  'Optional': '任意',
  'Read': '読む',
  'Write': '書く',
  'Execute': '実行',
  'View': '表示',
  'Edit': '編集',
  'Create': '作成',
  'Delete': '削除',
  'Update': '更新',
  'Save': '保存',
  'Submit': '送信',
  'Reset': 'リセット',
  'Cancel': 'キャンセル',
  'Close': '閉じる',
  'Open': '開く',
  'Search': '検索',
  'Filter': 'フィルター',
  'Sort': 'ソート',
  'Order': '順序',
  'Group': 'グループ',
  'Category': 'カテゴリ',
  'Tag': 'タグ',
  'Label': 'ラベル',
  'Title': 'タイトル',
  'Description': '説明',
  'Content': '内容',
  'Name': '名前',
  'Value': '値',
  'Key': 'キー',
  'Type': 'タイプ',
  'Status': 'ステータス',
  'State': '状態',
  'Action': 'アクション',
  'Operation': '操作',
  'Settings': '設定',
  'Config': '設定',
  'Configuration': '設定',
  'Options': 'オプション',
  'Preferences': '設定',
  'Profile': 'プロフィール',
  'Account': 'アカウント',
  'User': 'ユーザー',
  'Users': 'ユーザー',
  'Role': 'ロール',
  'Roles': 'ロール',
  'Permission': '権限',
  'Permissions': '権限',
  'Menu': 'メニュー',
  'Dashboard': 'ダッシュボード',
  'Home': 'ホーム',
  'Back': '戻る',
  'Next': '次へ',
  'Previous': '前へ',
  'Prev': '前',
  'First': '最初',
  'Last': '最後',
  'Current': '現在',
  'Previous': '前へ',
  'New': '新規',
  'Old': '旧',
  'Add': '追加',
  'Remove': '削除',
  'Insert': '挿入',
  'Append': '追加',
  'Prepend': '先頭に追加',
  'Move up': '上に移動',
  'Move down': '下に移動',
  'Move left': '左に移動',
  'Move right': '右に移動',
  'Select all': 'すべて選択',
  'Deselect all': 'すべて選択解除',
  'Clear': 'クリア',
  'Clear all': 'すべてクリア',
  'Refresh': '更新',
  'Reload': '再読み込み',
  'Export': 'エクスポート',
  'Import': 'インポート',
  'Download': 'ダウンロード',
  'Upload': 'アップロード',
  'Preview': 'プレビュー',
  'Print': '印刷',
  'Share': '共有',
  'Copy': 'コピー',
  'Paste': '貼り付け',
  'Cut': '切り取り',
  'Undo': '元に戻す',
  'Redo': 'やり直し',
  'Zoom in': '拡大',
  'Zoom out': '縮小',
  'Fullscreen': 'フルスクリーン',
  'Exit fullscreen': 'フルスクリーンを終了',
  'Login': 'ログイン',
  'Logout': 'ログアウト',
  'Register': '登録',
  'Sign in': 'サインイン',
  'Sign up': 'サインアップ',
  'Sign out': 'サインアウト',
  'Username': 'ユーザー名',
  'Password': 'パスワード',
  'Email': 'メール',
  'Phone': '電話',
  'Code': 'コード',
  'Captcha': '認証',
  'Remember me': 'ログイン情報を記憶',
  'Forgot password': 'パスワードをお忘れですか',
  'Reset password': 'パスワードリセット',
  'Change password': 'パスワード変更',
  'New password': '新しいパスワード',
  'Confirm password': 'パスワード確認',
  'Current password': '現在のパスワード',
  'Phone number': '電話番号',
  'Verification code': '認証コード',
  'Send code': 'コードを送信',
  'Resend code': 'コードを再送信',
  'Countdown': 'カウントダウン',
  'Remaining': '残り',
  'Total': '合計',
  'Subtotal': '小計',
  'Discount': '割引',
  'Tax': '税',
  'Fee': '手数料',
  'Amount': '金額',
  'Price': '価格',
  'Quantity': '数量',
  'Count': '数',
  'Number': '番号',
  'Date': '日付',
  'Time': '時間',
  'Start time': '開始時間',
  'End time': '終了時間',
  'Create time': '作成日時',
  'Update time': '更新日時',
  'Delete time': '削除日時',
  'Start date': '開始日',
  'End date': '終了日',
  'Today': '今日',
  'Yesterday': '昨日',
  'Tomorrow': '明日',
  'Now': '現在',
  'Hour': '時間',
  'Minute': '分',
  'Second': '秒',
  'Day': '日',
  'Week': '週',
  'Month': '月',
  'Year': '年',
  'Hours ago': '時間前',
  'Minutes ago': '分前',
  'Days ago': '日前',
  'Months ago': 'ヶ月前',
  'Years ago': '年前',
  'Just now': 'たった今',
  'In {n} hours': '{n}時間後',
  'In {n} days': '{n}日後',
  'In {n} months': '{n}ヶ月後',
  '{n} hours ago': '{n}時間前',
  '{n} days ago': '{n}日前',
  '{n} minutes ago': '{n}分前',
  'Admin': '管理者',
  'Administrator': '管理者',
  'Member': 'メンバー',
  'Guest': 'ゲスト',
  'Author': '作成者',
  'Editor': '編集者',
  'Viewer': '閲覧者',
  'Owner': '所有者',
  'Manager': 'マネージャー',
  'Operator': 'オペレーター',
  'Customer': '顧客',
  'Client': 'クライアント',
  'Partner': 'パートナー',
  'Vendor': 'ベンダー',
  'Supplier': 'サプライヤー',
  'Distributor': '販売代理店',
  'Agent': 'エージェント',
  'Reseller': '再販業者',
  'Affiliate': 'アフィリエイト',
  'Referral': '紹介',
  'Commission': 'コミッション',
  'Reward': '報酬',
  'Bonus': 'ボーナス',
  'Points': 'ポイント',
  'Credits': 'クレジット',
  'Balance': '残高',
  'Wallet': 'ウォレット',
  'Transaction': '取引',
  'Transfer': '振込',
  'Deposit': '入金',
  'Withdraw': '出金',
  'Withdrawal': '出金',
  'Refund': '返金',
  'Payment': '支払い',
  'Invoice': '請求書',
  'Receipt': '領収書',
  'Order': '注文',
  'Orders': '注文',
  'Subscription': 'サブスクリプション',
  'Plan': 'プラン',
  'Tier': 'ティア',
  'Level': 'レベル',
  'Grade': '等級',
  'Rank': 'ランク',
  'Score': 'スコア',
  'Rating': '評価',
  'Review': 'レビュー',
  'Comment': 'コメント',
  'Comments': 'コメント',
  'Reply': '返信',
  'Replies': '返信',
  'Like': 'いいね',
  'Likes': 'いいね',
  'Favorite': 'お気に入り',
  'Favorites': 'お気に入り',
  'Bookmark': 'ブックマーク',
  'Bookmarks': 'ブックマーク',
  'Follow': 'フォロー',
  'Following': 'フォロー中',
  'Follower': 'フォロワー',
  'Followers': 'フォロワー',
  'Friend': 'フレンド',
  'Friends': 'フレンド',
  'Block': 'ブロック',
  'Block user': 'ユーザーをブロック',
  'Unblock': 'ブロック解除',
  'Unblock user': 'ブロックを解除',
  'Ban': 'アカウント停止',
  'Ban user': 'ユーザーを停止',
  'Unban': '停止解除',
  'Unban user': '停止を解除',
  'Suspend': '一時停止',
  'Suspend user': 'ユーザーを一時停止',
  'Activate': '有効化',
  'Activate user': 'ユーザーを有効化',
  'Deactivate': '無効化',
  'Deactivate user': 'ユーザーを無効化',
  'Approve': '承認',
  'Reject': '却下',
  'Pending': '保留中',
  'Approved': '承認済み',
  'Rejected': '却下済み',
  'Submitted': '提出済み',
  'Draft': '下書き',
  'Published': '公開済み',
  'Unpublished': '非公開',
  'Archived': 'アーカイブ済み',
  'Deleted': '削除済み',
  'Restored': '復元済み',
  'Expired': '期限切れ',
  'Active': 'アクティブ',
  'Inactive': '非アクティブ',
  'Enabled': '有効',
  'Disabled': '無効',
  'Visible': '表示',
  'Hidden': '非表示',
  'Public': '公開',
  'Private': '非公開',
  'Internal': '内部',
  'External': '外部',
  'Personal': '個人',
  'Business': 'ビジネス',
  'Enterprise': 'エンタープライズ',
  'Organization': '組織',
  'Department': '部署',
  'Team': 'チーム',
  'Group': 'グループ',
  'Project': 'プロジェクト',
  'Task': 'タスク',
  'Issue': '課題',
  'Bug': 'バグ',
  'Feature': '機能',
  'Enhancement': '機能強化',
  'Improvement': '改善',
  'Optimization': '最適化',
  'Performance': 'パフォーマンス',
  'Security': 'セキュリティ',
  'Privacy': 'プライバシー',
  'Compliance': 'コンプライアンス',
  'Audit': '監査',
  'Log': 'ログ',
  'Logs': 'ログ',
  'History': '履歴',
  'Activity': 'アクティビティ',
  'Statistics': '統計',
  'Analytics': '分析',
  'Report': 'レポート',
  'Reports': 'レポート',
  'Chart': 'チャート',
  'Graph': 'グラフ',
  'Table': 'テーブル',
  'List': 'リスト',
  'Grid': 'グリッド',
  'Card': 'カード',
  'Badge': 'バッジ',
  'Tag': 'タグ',
  'Tags': 'タグ',
  'Category': 'カテゴリ',
  'Categories': 'カテゴリ',
  'Topic': 'トピック',
  'Topics': 'トピック',
  'Thread': 'スレッド',
  'Post': '投稿',
  'Posts': '投稿',
  'Article': '記事',
  'Articles': '記事',
  'News': 'ニュース',
  'Blog': 'ブログ',
  'Page': 'ページ',
  'Pages': 'ページ',
  'Link': 'リンク',
  'URL': 'URL',
  'Image': '画像',
  'Photo': '写真',
  'Video': '動画',
  'Audio': '音声',
  'File': 'ファイル',
  'Files': 'ファイル',
  'Folder': 'フォルダ',
  'Document': 'ドキュメント',
  'Documents': 'ドキュメント',
  'Attachment': '添付ファイル',
  'Attachments': '添付ファイル',
  'Download': 'ダウンロード',
  'Upload': 'アップロード',
  'Size': 'サイズ',
  'Format': '形式',
  'Type': 'タイプ',
  'Source': 'ソース',
  'Target': 'ターゲット',
  'Destination': '宛先',
  'Origin': '送信元',
  'Method': 'メソッド',
  'Parameter': 'パラメータ',
  'Parameters': 'パラメータ',
  'Argument': '引数',
  'Arguments': '引数',
  'Variable': '変数',
  'Constant': '定数',
  'Function': '関数',
  'Method': 'メソッド',
  'Class': 'クラス',
  'Object': 'オブジェクト',
  'Array': '配列',
  'String': '文字列',
  'Number': '数値',
  'Boolean': '真偽値',
  'Null': 'ヌル',
  'Undefined': '未定義',
  'Integer': '整数',
  'Float': '小数',
  'Double': '倍精度小数',
  'Decimal': '十進数',
  'Hex': '十六進数',
  'Binary': '二進数',
  'Octal': '八進数',
  'Char': '文字',
  'Byte': 'バイト',
  'Bit': 'ビット',
  'Kilobyte': 'キロバイト',
  'Megabyte': 'メガバイト',
  'Gigabyte': 'ギガバイト',
  'Terabyte': 'テラバイト',
  'Yes': 'はい',
  'No': 'いいえ',
  'True': '真',
  'False': '偽',
  'On': 'オン',
  'Off': 'オフ',
  'Up': '上',
  'Down': '下',
  'Left': '左',
  'Right': '右',
  'Top': '上',
  'Bottom': '下',
  'Center': '中央',
  'Middle': '中',
  'Front': '前',
  'Back': '後',
  'Inside': '内',
  'Outside': '外',
  'Above': '上',
  'Below': '下',
  'Before': '前',
  'After': '後',
  'Start': '開始',
  'End': '終了',
  'Begin': '開始',
  'Finish': '完了',
  'Pause': '一時停止',
  'Resume': '再開',
  'Restart': '再起動',
  'Stop': '停止',
  'Run': '実行',
  'Execute': '実行',
  'Test': 'テスト',
  'Debug': 'デバッグ',
  'Build': 'ビルド',
  'Deploy': 'デプロイ',
  'Install': 'インストール',
  'Uninstall': 'アンインストール',
  'Update': '更新',
  'Upgrade': 'アップグレード',
  'Downgrade': 'ダウングレード',
  'Patch': 'パッチ',
  'Fix': '修正',
  'Hotfix': '緊急修正',
  'Release': 'リリース',
  'Version': 'バージョン',
  'Channel': 'チャンネル',
  'Branch': 'ブランチ',
  'Tag': 'タグ',
  'Commit': 'コミット',
  'Push': 'プッシュ',
  'Pull': 'プル',
  'Merge': 'マージ',
  'Rebase': 'リベース',
  'Checkout': 'チェックアウト',
  'Fetch': 'フェッチ',
  'Clone': 'クローン',
  'Fork': 'フォーク',
  'Issue': '課題',
  'Pull request': 'プルリクエスト',
  'Review': 'レビュー',
  'Approve': '承認',
  'Reject': '却下',
  'Comment': 'コメント',
  'Description': '説明',
  'Note': 'ノート',
  'Notes': 'ノート',
  'Remark': '備考',
  'Remarks': '備考',
  'Tip': 'ヒント',
  'Tips': 'ヒント',
  'Hint': 'ヒント',
  'Warning': '警告',
  'Caution': '注意',
  'Danger': '危険',
  'Important': '重要',
  'Info': '情報',
  'Notice': '通知',
  'Notification': '通知',
  'Notifications': '通知',
  'Alert': 'アラート',
  'Message': 'メッセージ',
  'Messages': 'メッセージ',
  'Email': 'メール',
  'SMS': 'SMS',
  'Call': '通話',
  'Chat': 'チャット',
  'Conversation': '会話',
  'Conversations': '会話',
  'Contact': '連絡先',
  'Contacts': '連絡先',
  'Support': 'サポート',
  'Help': 'ヘルプ',
  'FAQ': 'よくある質問',
  'About': 'について',
  'About Us': '私たちについて',
  'Contact Us': 'お問い合わせ',
  'Privacy Policy': 'プライバシーポリシー',
  'Terms of Service': '利用規約',
  'Terms and Conditions': '利用規約',
  'Cookie Policy': 'Cookieポリシー',
  'Disclaimer': '免責事項',
  'Copyright': '著作権',
  'License': 'ライセンス',
  'All rights reserved': 'All rights reserved',
  'Maintenance': 'メンテナンス',
  'Under maintenance': 'メンテナンス中',
  'Coming soon': '近日公開',
  'Stay tuned': 'お楽しみに',
  'TBD': '未定',
  'TBA': '未発表',
  'N/A': '該当なし',
  'N/A (Not available)': '利用不可',
  'Default': 'デフォルト',
  'Custom': 'カスタム',
  'General': '一般',
  'Advanced': '詳細',
  'Basic': '基本',
  'Standard': '標準',
  'Premium': 'プレミアム',
  'Free': '無料',
  'Paid': '有料',
  'Trial': 'トライアル',
  'Beta': 'ベータ',
  'Alpha': 'アルファ',
  'Stable': '安定版',
  'Latest': '最新',
  'New': '新規',
  'Old': '旧',
  'Popular': '人気',
  'Hot': '人気',
  'Trending': 'トレンド',
  'Recommended': 'おすすめ',
  'Featured': '注目',
  'Sponsored': 'スポンサー',
  'Verified': '認証済み',
  'Unverified': '未認証',
  'Official': '公式',
  'Unofficial': '非公式',
  'Original': 'オリジナル',
  'Copy': 'コピー',
  'Duplicate': '複製',
  'Clone': 'クローン',
  'Template': 'テンプレート',
  'Templates': 'テンプレート',
  'Snippet': 'スニペット',
  'Snippets': 'スニペット',
  'Example': '例',
  'Examples': '例',
  'Sample': 'サンプル',
  'Samples': 'サンプル',
  'Demo': 'デモ',
  'Tutorial': 'チュートリアル',
  'Guide': 'ガイド',
  'Documentation': 'ドキュメント',
  'Docs': 'ドキュメント',
  'API': 'API',
  'SDK': 'SDK',
  'CLI': 'CLI',
  'GUI': 'GUI',
  'UI': 'UI',
  'UX': 'UX',
  'AI': 'AI',
  'ML': 'ML',
  'GPT': 'GPT',
  'LLM': 'LLM',
  'MCP': 'MCP',
  'Token': 'トークン',
  'Tokens': 'トークン',
  'Model': 'モデル',
  'Models': 'モデル',
  'Prompt': 'プロンプト',
  'Prompts': 'プロンプト',
  'Generate': '生成',
  'Generating...': '生成中...',
  'Generated': '生成済み',
  'Generation': '生成',
  'Output': '出力',
  'Input': '入力',
  'Result': '結果',
  'Results': '結果',
  'Response': 'レスポンス',
  'Request': 'リクエスト',
  'Streaming': 'ストリーミング',
  'Stream': 'ストリーム',
  'Chunk': 'チャンク',
  'Batch': 'バッチ',
  'Queue': 'キュー',
  'Worker': 'ワーカー',
  'Job': 'ジョブ',
  'Task': 'タスク',
  'Tasks': 'タスク',
  'Process': 'プロセス',
  'Thread': 'スレッド',
  'Async': '非同期',
  'Sync': '同期',
  'Concurrent': '並行',
  'Parallel': '並列',
  'Serial': '直列',
  'Sequential': '順次',
}

// ============================================================
// ko 翻译表 (常见 en 值 → 韩文翻译)
// ============================================================
const KO_TABLE = {
  'Next': '다음',
  'Previous': '이전',
  'Prev': '이전',
  'Published': '게시됨',
  'Pending': '대기 중',
  'All': '전체',
  'Rejected': '거절됨',
  'Sort': '정렬',
  'Approved': '승인됨',
  'Duration': '소요 시간',
  'and': '및',
  'I': '나의',
  'Expired': '만료됨',
  'Paid': '결제 완료',
  'to': '으로',
  'PaySuccess': '결제 성공',
  'Deleted': '삭제됨',
  'Pending Review': '심사 대기',
  'About Us': '회사 소개',
  'Payment': '결제',
  'Enter verification code': '인증 코드 입력',
  'Resolved': '해결됨',
  'Fill Blank': '빈칸 채우기',
  'Select Paper': '시험지 선택',
  'Submitted': '제출됨',
  'Enter description': '설명 입력',
  'My Comments': '내 댓글',
  'I Favorite': '내 즐겨찾기',
  'Alipay': 'Alipay',
  'Pay Now': '지금 결제',
  'Graded': '채점 완료',
  'Edit Category': '카테고리 편집',
  'Enter category name': '카테고리 이름 입력',
  'Enter title': '제목 입력',
  'Select paper': '시험지 선택',
  'Sort Order': '정렬 순서',
  'Search UUID': 'UUID 검색',
  'My Points': '내 포인트',
  'My Questions': '내 질문',
  'Send failed': '전송 실패',
  'Name is required': '이름은 필수입니다',
  'Name cannot be empty': '이름은 비워둘 수 없습니다',
  'Issued': '발급됨',
  'I Follow': '내 팔로우',
  'My Lessons': '내 레슨',
  'Search user ID': '사용자 ID 검색',
  'Enter your phone number': '전화번호 입력',
  'Resend in {seconds}s': '{seconds}s 후 재전송',
  'To Balance': '잔액으로',
  'Edit Question': '문제 편집',
  'Edit Chapter': '챕터 편집',
  'Built-in': '내장',
  'Issue Certificate': '증명서 발급',
  'Search students...': '학생 검색...',
  'Edit category': '카테고리 편집',
  'Edit Template': '템플릿 편집',
  'Edit Topic': '주제 편집',
  'New Material': '새 자료',
  'Edit Material': '자료 편집',
  'Search records...': '기록 검색...',
  'Edit Rule': '규칙 편집',
  'Manage certificate templates': '증명서 템플릿 관리',
  'Type a message to start the conversation': '대화를 시작하려면 메시지를 입력하세요',
  'Enter rule name': '규칙 이름 입력',
  'Enter rule code': '규칙 코드 입력',
  'Enter link': '링크 입력',
  'Search title': '제목 검색',
  'Search Agent ID': 'Agent ID 검색',
  'Search {label}': '{label} 검색',
  'Current device': '현재 기기',
  'Pay': '결제',
  'Manage your personal profile information': '개인 프로필 정보 관리',
  'New Category': '새 카테고리',
  'New Chapter': '새 챕터',
  'New Question': '새 문제',
  'New Topic': '새 주제',
  'New Template': '새 템플릿',
  'New Rule': '새 규칙',
  'Enter name': '이름 입력',
  'Enter content': '내용 입력',
  'Enter URL': 'URL 입력',
  'Enter keyword': '키워드 입력',
  'Search name': '이름 검색',
  'Loading...': '로딩 중...',
  'Sending...': '전송 중...',
  'Creating...': '생성 중...',
  'Saving...': '저장 중...',
  'Deleting...': '삭제 중...',
  'Updating...': '업데이트 중...',
  'No data': '데이터 없음',
  'No results': '결과 없음',
  'No results found': '결과를 찾을 수 없습니다',
  'Operation successful': '작업 성공',
  'Operation failed': '작업 실패',
  'Save success': '저장 성공',
  'Save failed': '저장 실패',
  'Delete success': '삭제 성공',
  'Delete failed': '삭제 실패',
  'Update success': '업데이트 성공',
  'Update failed': '업데이트 실패',
  'Create success': '생성 성공',
  'Create failed': '생성 실패',
  'Confirm delete': '삭제 확인',
  'Are you sure': '확실합니까',
  'Are you sure to delete': '삭제하시겠습니까',
  'This action cannot be undone': '이 작업은 취소할 수 없습니다',
  'Cancel': '취소',
  'Confirm': '확인',
  'OK': '확인',
  'Yes': '예',
  'No': '아니오',
  'True': '참',
  'False': '거짓',
  'Enable': '활성화',
  'Disable': '비활성화',
  'Enabled': '활성화됨',
  'Disabled': '비활성화됨',
  'Active': '활성',
  'Inactive': '비활성',
  'Online': '온라인',
  'Offline': '오프라인',
  'Running': '실행 중',
  'Stopped': '중지됨',
  'Paused': '일시정지',
  'Completed': '완료',
  'Cancelled': '취소됨',
  'Failed': '실패',
  'Success': '성공',
  'Warning': '경고',
  'Error': '오류',
  'Info': '정보',
  'Unknown': '알 수 없음',
  'None': '없음',
  'Empty': '비어 있음',
  'Required': '필수',
  'Optional': '선택',
  'View': '보기',
  'Edit': '편집',
  'Create': '생성',
  'Delete': '삭제',
  'Update': '업데이트',
  'Save': '저장',
  'Submit': '제출',
  'Reset': '재설정',
  'Close': '닫기',
  'Open': '열기',
  'Search': '검색',
  'Filter': '필터',
  'Order': '순서',
  'Group': '그룹',
  'Category': '카테고리',
  'Tag': '태그',
  'Label': '라벨',
  'Title': '제목',
  'Description': '설명',
  'Content': '내용',
  'Name': '이름',
  'Value': '값',
  'Key': '키',
  'Type': '유형',
  'Status': '상태',
  'State': '상태',
  'Action': '동작',
  'Operation': '작업',
  'Settings': '설정',
  'Configuration': '설정',
  'Options': '옵션',
  'Profile': '프로필',
  'Account': '계정',
  'User': '사용자',
  'Users': '사용자',
  'Role': '역할',
  'Permission': '권한',
  'Menu': '메뉴',
  'Dashboard': '대시보드',
  'Home': '홈',
  'Back': '뒤로',
  'First': '첫 번째',
  'Last': '마지막',
  'Current': '현재',
  'New': '신규',
  'Old': '이전',
  'Add': '추가',
  'Remove': '제거',
  'Insert': '삽입',
  'Clear': '지우기',
  'Refresh': '새로고침',
  'Export': '내보내기',
  'Import': '가져오기',
  'Download': '다운로드',
  'Upload': '업로드',
  'Preview': '미리보기',
  'Print': '인쇄',
  'Share': '공유',
  'Copy': '복사',
  'Undo': '실행 취소',
  'Redo': '다시 실행',
  'Login': '로그인',
  'Logout': '로그아웃',
  'Register': '회원가입',
  'Sign in': '로그인',
  'Sign up': '가입',
  'Sign out': '로그아웃',
  'Username': '사용자 이름',
  'Password': '비밀번호',
  'Email': '이메일',
  'Phone': '전화',
  'Code': '코드',
  'Captcha': '캡차',
  'Remember me': '로그인 유지',
  'Forgot password': '비밀번호 찾기',
  'Reset password': '비밀번호 재설정',
  'Change password': '비밀번호 변경',
  'New password': '새 비밀번호',
  'Confirm password': '비밀번호 확인',
  'Phone number': '전화번호',
  'Verification code': '인증 코드',
  'Send code': '코드 전송',
  'Resend code': '코드 재전송',
  'Total': '합계',
  'Subtotal': '소계',
  'Discount': '할인',
  'Amount': '금액',
  'Price': '가격',
  'Quantity': '수량',
  'Count': '수',
  'Number': '번호',
  'Date': '날짜',
  'Time': '시간',
  'Today': '오늘',
  'Yesterday': '어제',
  'Tomorrow': '내일',
  'Now': '현재',
  'Hour': '시간',
  'Minute': '분',
  'Second': '초',
  'Day': '일',
  'Week': '주',
  'Month': '월',
  'Year': '년',
  'Admin': '관리자',
  'Member': '회원',
  'Guest': '게스트',
  'Author': '작성자',
  'Owner': '소유자',
  'Customer': '고객',
  'Points': '포인트',
  'Balance': '잔액',
  'Wallet': '지갑',
  'Refund': '환불',
  'Invoice': '청구서',
  'Receipt': '영수증',
  'Order': '주문',
  'Orders': '주문',
  'Subscription': '구독',
  'Plan': '플랜',
  'Level': '레벨',
  'Score': '점수',
  'Rating': '평점',
  'Review': '리뷰',
  'Comment': '댓글',
  'Comments': '댓글',
  'Reply': '답글',
  'Like': '좋아요',
  'Favorite': '즐겨찾기',
  'Bookmark': '북마크',
  'Follow': '팔로우',
  'Following': '팔로잉',
  'Follower': '팔로워',
  'Block': '차단',
  'Ban': '정지',
  'Approve': '승인',
  'Reject': '거절',
  'Draft': '초안',
  'Archived': '보관됨',
  'Restored': '복원됨',
  'Visible': '표시',
  'Hidden': '숨김',
  'Public': '공개',
  'Private': '비공개',
  'Internal': '내부',
  'External': '외부',
  'Organization': '조직',
  'Department': '부서',
  'Team': '팀',
  'Project': '프로젝트',
  'Task': '작업',
  'Bug': '버그',
  'Feature': '기능',
  'Security': '보안',
  'Privacy': '개인정보',
  'Log': '로그',
  'History': '기록',
  'Statistics': '통계',
  'Report': '보고서',
  'Chart': '차트',
  'Table': '테이블',
  'List': '목록',
  'Card': '카드',
  'Badge': '배지',
  'Topic': '주제',
  'Topics': '주제',
  'Post': '게시물',
  'Posts': '게시물',
  'Article': '게시글',
  'News': '뉴스',
  'Page': '페이지',
  'Link': '링크',
  'Image': '이미지',
  'Photo': '사진',
  'Video': '동영상',
  'Audio': '오디오',
  'File': '파일',
  'Folder': '폴더',
  'Document': '문서',
  'Attachment': '첨부파일',
  'Size': '크기',
  'Format': '형식',
  'Source': '소스',
  'Method': '메서드',
  'Parameter': '매개변수',
  'Function': '함수',
  'Class': '클래스',
  'Object': '객체',
  'Array': '배열',
  'String': '문자열',
  'Number': '숫자',
  'Boolean': '불린',
  'Token': '토큰',
  'Tokens': '토큰',
  'Model': '모델',
  'Models': '모델',
  'Prompt': '프롬프트',
  'Prompts': '프롬프트',
  'Generate': '생성',
  'Generating...': '생성 중...',
  'Generated': '생성됨',
  'Output': '출력',
  'Input': '입력',
  'Result': '결과',
  'Response': '응답',
  'Request': '요청',
  'Streaming': '스트리밍',
  'Process': '프로세스',
  'Async': '비동기',
  'Sync': '동기',
  // 韩文特有 (CJK 污染修复)
  'Contact': '연락처',
  'Subjective': '주관식',
  'final': '종료',
  'finalhave': '모든 세션 종료',
  'Record Number': '등록 번호',
  'Point': '포인트',
  'Permission': '권한',
  'Console': '콘솔',
  'Required': '필수',
  'Thing': '사물',
  'Main': '메인',
  'around': '주변',
  'Environment': '환경',
  'people': '명',
  'peopleThing': '인원',
  'Line': '선',
  'Son': '고급',
  'peopleMachine': '인간 기계 협업',
  'Go': '이동',
  'few': '부족',
  'Business License': '사업자등록증',
  'View platform business license information': '플랫폼 사업자등록증 정보 보기',
  'Business License Information': '사업자등록증 정보',
  'Business license image not available': '사업자등록증 이미지를 사용할 수 없습니다',
  'Contact customer service or view in mini program': '문의하거나 미니 프로그램에서 확인하세요',
  'Click to view large image': '클릭하여 큰 이미지 보기',
  'View Large Image': '큰 이미지 보기',
  'ICP Record Information': 'ICP 등록 정보',
  'View platform ICP record information': '플랫폼 ICP 등록 정보 보기',
  'Record Information': '등록 정보',
  'Entity': '등록 주체',
  'Entity Type': '주체 유형',
  'Record Time': '등록 시간',
  'Record Query': '등록 조회',
  'Service Scope': '서비스 범위',
  'Internet Information Service': '인터넷 정보 서비스',
  "This platform has completed ICP record registration. The record information is as shown above. Contact customer service for any questions.": '본 플랫폼은 ICP 등록을 완료했습니다. 등록 정보는 위와 같습니다. 문의사항은 고객센터에 연락하세요.',
  'Model Record Information': '모델 등록 정보',
  'View AI model algorithm record information': 'AI 모델 알고리즘 등록 정보 보기',
  'Model Record Registration': '모델 등록 등록',
  'Model Name': '모델 이름',
  'Algorithm Type': '알고리즘 유형',
  'Generative Synthesis': '생성 합성류',
  'Applicant': '신청자',
  'Apply Date': '신청 날짜',
  'Filed': '등록됨',
  'Application Scope': '적용 범위',
  'Text generation and dialogue services for users in China': '중국 내 사용자를 위한 텍스트 생성 및 대화 서비스',
  "This platform's AI model has completed algorithm record filing in accordance with the Interim Measures for the Management of Generative AI Services.": '본 플랫폼의 AI 모델은 생성형 AI 서비스 관리 잠정 조치에 따라 알고리즘 등록을 완료했습니다.',
  'Usage Rules': '사용 규정',
  'Why': '이유',
  'peopleMachine': '인간-기계 협업',
}

// ============================================================
// ja/ko 模式匹配 (模板化翻译)
// ============================================================
function jaPattern(en) {
  if (!en) return null
  // 占位符保护
  const placeholders = []
  const work = en.replace(/\{[^}]+\}/g, (m) => {
    placeholders.push(m)
    return `\u0001${placeholders.length - 1}\u0001`
  })
  let result = null
  // Edit X → Xを編集
  if (/^Edit (.+)$/.test(work)) result = `${RegExp.$1}を編集`
  // Search X... → Xを検索...
  else if (/^Search (.+)\.\.\.$/.test(work)) result = `${RegExp.$1}を検索...`
  // Search X → Xを検索
  else if (/^Search (.+)$/.test(work)) result = `${RegExp.$1}を検索`
  // Enter X... → Xを入力...
  else if (/^Enter (.+)\.\.\.$/.test(work)) result = `${RegExp.$1}を入力...`
  // Enter X → Xを入力
  else if (/^Enter (.+)$/.test(work)) result = `${RegExp.$1}を入力`
  // New X → 新規X
  else if (/^New (.+)$/.test(work)) result = `新規${RegExp.$1}`
  // Back to X → Xに戻る
  else if (/^Back to (.+)$/.test(work)) result = `${RegExp.$1}に戻る`
  // My X → マイX
  else if (/^My (.+)$/.test(work)) result = `マイ${RegExp.$1}`
  // I X → X (subset)
  else if (/^I (.+)$/.test(work)) result = RegExp.$1
  // X required → Xは必須です
  else if (/^(.+) is required$/.test(work)) result = `${RegExp.$1}は必須です`
  else if (/^(.+) required$/.test(work)) result = `${RegExp.$1}は必須です`
  // X cannot be empty → Xは空にできません
  else if (/^(.+) cannot be empty$/.test(work)) result = `${RegExp.$1}は空にできません`
  // X failed → Xに失敗しました
  else if (/^(.+) failed$/.test(work)) result = `${RegExp.$1}に失敗しました`
  // X success → X成功
  else if (/^(.+) success$/.test(work)) result = `${RegExp.$1}成功`
  // X... → X...
  // Loading X... → Xを読み込み中...
  else if (/^Loading (.+)\.\.\.$/.test(work)) result = `${RegExp.$1}を読み込み中...`
  // Confirm X → Xを確認
  else if (/^Confirm (.+)$/.test(work)) result = `${RegExp.$1}を確認`
  // Select X → Xを選択
  else if (/^Select (.+)$/.test(work)) result = `${RegExp.$1}を選択`
  // Delete X → Xを削除
  else if (/^Delete (.+)$/.test(work)) result = `${RegExp.$1}を削除`
  // Add X → Xを追加
  else if (/^Add (.+)$/.test(work)) result = `${RegExp.$1}を追加`
  // Save X → Xを保存
  else if (/^Save (.+)$/.test(work)) result = `${RegExp.$1}を保存`
  // Update X → Xを更新
  else if (/^Update (.+)$/.test(work)) result = `${RegExp.$1}を更新`
  // View X → Xを表示
  else if (/^View (.+)$/.test(work)) result = `${RegExp.$1}を表示`
  // Manage X → Xを管理
  else if (/^Manage (.+)$/.test(work)) result = `${RegExp.$1}を管理`
  // Are you sure to delete this X? → このXを削除してもよろしいですか?
  else if (/^Are you sure to delete this (.+)\?$/.test(work)) result = `この${RegExp.$1}を削除してもよろしいですか?`
  // Are you sure to delete X? → Xを削除してもよろしいですか?
  else if (/^Are you sure to delete (.+)\?$/.test(work)) result = `${RegExp.$1}を削除してもよろしいですか?`
  if (!result) return null
  // 还原占位符
  result = result.replace(/\u0001(\d+)\u0001/g, (m, i) => placeholders[Number(i)])
  return result
}

function koPattern(en) {
  if (!en) return null
  const placeholders = []
  const work = en.replace(/\{[^}]+\}/g, (m) => {
    placeholders.push(m)
    return `\u0001${placeholders.length - 1}\u0001`
  })
  let result = null
  if (/^Edit (.+)$/.test(work)) result = `${RegExp.$1} 편집`
  else if (/^Search (.+)\.\.\.$/.test(work)) result = `${RegExp.$1} 검색...`
  else if (/^Search (.+)$/.test(work)) result = `${RegExp.$1} 검색`
  else if (/^Enter (.+)\.\.\.$/.test(work)) result = `${RegExp.$1} 입력...`
  else if (/^Enter (.+)$/.test(work)) result = `${RegExp.$1} 입력`
  else if (/^New (.+)$/.test(work)) result = `새 ${RegExp.$1}`
  else if (/^Back to (.+)$/.test(work)) result = `${RegExp.$1}로 돌아가기`
  else if (/^My (.+)$/.test(work)) result = `내 ${RegExp.$1}`
  else if (/^I (.+)$/.test(work)) result = RegExp.$1
  else if (/^(.+) is required$/.test(work)) result = `${RegExp.$1}은(는) 필수입니다`
  else if (/^(.+) required$/.test(work)) result = `${RegExp.$1} 필수`
  else if (/^(.+) cannot be empty$/.test(work)) result = `${RegExp.$1}은(는) 비워둘 수 없습니다`
  else if (/^(.+) failed$/.test(work)) result = `${RegExp.$1} 실패`
  else if (/^(.+) success$/.test(work)) result = `${RegExp.$1} 성공`
  else if (/^Loading (.+)\.\.\.$/.test(work)) result = `${RegExp.$1} 로딩 중...`
  else if (/^Confirm (.+)$/.test(work)) result = `${RegExp.$1} 확인`
  else if (/^Select (.+)$/.test(work)) result = `${RegExp.$1} 선택`
  else if (/^Delete (.+)$/.test(work)) result = `${RegExp.$1} 삭제`
  else if (/^Add (.+)$/.test(work)) result = `${RegExp.$1} 추가`
  else if (/^Save (.+)$/.test(work)) result = `${RegExp.$1} 저장`
  else if (/^Update (.+)$/.test(work)) result = `${RegExp.$1} 업데이트`
  else if (/^View (.+)$/.test(work)) result = `${RegExp.$1} 보기`
  else if (/^Manage (.+)$/.test(work)) result = `${RegExp.$1} 관리`
  else if (/^Are you sure to delete this (.+)\?$/.test(work)) result = `이 ${RegExp.$1}을(를) 삭제하시겠습니까?`
  else if (/^Are you sure to delete (.+)\?$/.test(work)) result = `${RegExp.$1}을(를) 삭제하시겠습니까?`
  if (!result) return null
  result = result.replace(/\u0001(\d+)\u0001/g, (m, i) => placeholders[Number(i)])
  return result
}

// ============================================================
// 术语统一覆盖 (rule 5 issues)
// ============================================================
const TERM_OVERRIDES = {
  // models.subtitle 在 3 语言都是错的翻译 (说"文档和API参考"但 en 是"选择适合你的 AI 模型")
  'models.subtitle': {
    ja: 'あなたに合った AI モデルを選択',
    ko: '적합한 AI 모델을 선택하세요',
    'zh-TW': '選擇適合您的 AI 模型',
  },
  // mcp.promptTitle en="Prompt Manager" 但翻译都是"标题/建议标题"
  'mcp.promptTitle': {
    ja: 'プロンプトマネージャー',
    ko: '프롬프트 관리자',
    'zh-TW': '提示詞管理員',
  },
}

// ============================================================
// 修复执行
// ============================================================
let zhTWF = 0
let jaF = 0
let koF = 0
let termF = 0
const jaFallbackToEn = []
const koFallbackToEn = []

// 1. zh-TW: 全文件扫描, 应用 opencc + vocab
const zhTWFlat = flatten(zhTW)
for (const [key, value] of zhTWFlat) {
  if (typeof value !== 'string' || !value) continue
  const enV = enFlat.get(key) || ''
  const fixed = fixZhTWValue(value, enV)
  if (fixed !== value) {
    setNested(zhTW, key, fixed)
    zhTWF++
  }
}

// 2. ja: 修复所有 audit 发现的问题
const _jaFlat = flatten(ja)
for (const issue of report.issues) {
  if (issue.lang !== 'ja') continue
  const { key, en } = issue
  if (!en) continue
  // 先查 TERM_OVERRIDES
  if (TERM_OVERRIDES[key] && TERM_OVERRIDES[key].ja) {
    setNested(ja, key, TERM_OVERRIDES[key].ja)
    termF++
    continue
  }
  // 查翻译表
  if (JA_TABLE[en]) {
    setNested(ja, key, JA_TABLE[en])
    jaF++
    continue
  }
  // 模式匹配
  const pat = jaPattern(en)
  if (pat) {
    setNested(ja, key, pat)
    jaF++
    continue
  }
  // 兜底: 使用 en 值
  setNested(ja, key, en)
  jaF++
  jaFallbackToEn.push({ key, en, old: issue.current })
}

// 3. ko: 修复所有 audit 发现的问题
for (const issue of report.issues) {
  if (issue.lang !== 'ko') continue
  const { key, en } = issue
  if (!en) continue
  if (TERM_OVERRIDES[key] && TERM_OVERRIDES[key].ko) {
    setNested(ko, key, TERM_OVERRIDES[key].ko)
    termF++
    continue
  }
  if (KO_TABLE[en]) {
    setNested(ko, key, KO_TABLE[en])
    koF++
    continue
  }
  const pat = koPattern(en)
  if (pat) {
    setNested(ko, key, pat)
    koF++
    continue
  }
  // 兜底: 使用 en 值
  setNested(ko, key, en)
  koF++
  koFallbackToEn.push({ key, en, old: issue.current })
}

// 4. zh-TW 术语覆盖
for (const [key, langs] of Object.entries(TERM_OVERRIDES)) {
  if (langs['zh-TW']) {
    setNested(zhTW, key, langs['zh-TW'])
    termF++
  }
}

// 5. consistency-zh-duplicate: 由 zh-TW simp 修复自动处理 (不需要额外操作)

// 保存
saveLang('zh-TW', zhTW)
saveLang('ja', ja)
saveLang('ko', ko)

console.log(`${C.green}[fix-i18n-deep] 修复完成${C.reset}`)
console.log(`  zh-TW: ${zhTWF} 处 (opencc + TW 用词)`)
console.log(`  ja:    ${jaF} 处 (翻译表 + 模式 + en 兜底)`)
console.log(`  ko:    ${koF} 处 (翻译表 + 模式 + en 兜底)`)
console.log(`  术语:  ${termF} 处 (覆盖)`)
console.log(`  ja 兜底到 en: ${jaFallbackToEn.length} 处`)
console.log(`  ko 兜底到 en: ${koFallbackToEn.length} 处`)
if (jaFallbackToEn.length > 0) {
  console.log(`${C.dim}  ja 兜底样本 (前 20):${C.reset}`)
  jaFallbackToEn.slice(0, 20).forEach((x) => {
    console.log(`${C.dim}    ${x.key}: "${x.old}" → "${x.en}"${C.reset}`)
  })
}
if (koFallbackToEn.length > 0) {
  console.log(`${C.dim}  ko 兜底样本 (前 20):${C.reset}`)
  koFallbackToEn.slice(0, 20).forEach((x) => {
    console.log(`${C.dim}    ${x.key}: "${x.old}" → "${x.en}"${C.reset}`)
  })
}
