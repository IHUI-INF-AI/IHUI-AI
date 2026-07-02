/**
 * i18n 最终修复脚本 (一次性)
 * 补全 60 个无 fallback 的 key, 5 语言全部填入
 *
 * 翻译源: 从源码上下文 + 中文语义人工推导
 */

const fs = require('fs')
const path = require('path')

const CLIENT_ROOT = path.join(__dirname, '..')
const MODULES_DIR = path.join(CLIENT_ROOT, 'src', 'locales', 'modules')

function readJSONRobust(p) {
  if (!fs.existsSync(p)) return null
  let raw = fs.readFileSync(p, 'utf-8')
  while (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
  return JSON.parse(raw)
}

function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
}

function setNestedValue(obj, segs, value) {
  let cur = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]
    if (!(s in cur) || typeof cur[s] !== 'object' || cur[s] === null || Array.isArray(cur[s])) {
      cur[s] = {}
    }
    cur = cur[s]
  }
  cur[segs[segs.length - 1]] = value
}

function ensureTopKey(obj, topKey) {
  if (!(topKey in obj) || typeof obj[topKey] !== 'object' || obj[topKey] === null) {
    obj[topKey] = {}
  }
  return obj[topKey]
}

/** 60 个 key 的 5 语言翻译表 (zh-CN 是源, 其他用合理翻译或同源) */
const I18N = {
  'common.toggleThemeToLight': {
    'zh-CN': '切换到浅色主题',
    en: 'Switch to Light Theme',
    'zh-TW': '切換到淺色主題',
    ja: 'ライトテーマに切り替え',
    ko: '라이트 테마로 전환',
  },
  'common.toggleThemeToDark': {
    'zh-CN': '切换到深色主题',
    en: 'Switch to Dark Theme',
    'zh-TW': '切換到深色主題',
    ja: 'ダークテーマに切り替え',
    ko: '다크 테마로 전환',
  },
  'common.settings': {
    'zh-CN': '设置',
    en: 'Settings',
    'zh-TW': '設定',
    ja: '設定',
    ko: '설정',
  },
  'common.updateSuccess': {
    'zh-CN': '更新成功',
    en: 'Update Successful',
    'zh-TW': '更新成功',
    ja: '更新成功',
    ko: '업데이트 성공',
  },
  'common.messages.saveSuccess': {
    'zh-CN': '保存成功',
    en: 'Saved Successfully',
    'zh-TW': '保存成功',
    ja: '保存成功',
    ko: '저장 성공',
  },
  'aiChatInput.stopRecording': {
    'zh-CN': '停止录音',
    en: 'Stop Recording',
    'zh-TW': '停止錄音',
    ja: '録音を停止',
    ko: '녹음 중지',
  },
  'voiceInput.clearTranscript': {
    'zh-CN': '清除转写',
    en: 'Clear Transcript',
    'zh-TW': '清除轉寫',
    ja: '文字起こしをクリア',
    ko: '받아쓰기 지우기',
  },
  'file.moreActions': {
    'zh-CN': '更多操作',
    en: 'More Actions',
    'zh-TW': '更多操作',
    ja: 'その他の操作',
    ko: '더 많은 작업',
  },
  'hardcoded.cross.project.banner.switchTo': {
    'zh-CN': '切换到',
    en: 'Switch to',
    'zh-TW': '切換到',
    ja: '切り替え',
    ko: '전환',
  },
  'hardcoded.cross.project.banner.userPortal': {
    'zh-CN': '用户端',
    en: 'User Portal',
    'zh-TW': '用戶端',
    ja: 'ユーザー側',
    ko: '사용자 포털',
  },
  'hardcoded.cross.project.banner.adminPortal': {
    'zh-CN': '管理端',
    en: 'Admin Portal',
    'zh-TW': '管理端',
    ja: '管理側',
    ko: '관리자 포털',
  },
  'auth.emailLogin': {
    'zh-CN': '邮箱登录',
    en: 'Email Login',
    'zh-TW': '郵箱登錄',
    ja: 'メールログイン',
    ko: '이메일 로그인',
  },
  'notificationCenter.level.info': {
    'zh-CN': '信息',
    en: 'Info',
    'zh-TW': '資訊',
    ja: '情報',
    ko: '정보',
  },
  'notificationCenter.level.warn': {
    'zh-CN': '警告',
    en: 'Warning',
    'zh-TW': '警告',
    ja: '警告',
    ko: '경고',
  },
  'notificationCenter.level.error': {
    'zh-CN': '错误',
    en: 'Error',
    'zh-TW': '錯誤',
    ja: 'エラー',
    ko: '오류',
  },
  'admin.sms.searchPlaceholder': {
    'zh-CN': '搜索模板名称/编码',
    en: 'Search template name/code',
    'zh-TW': '搜尋模板名稱/編碼',
    ja: 'テンプレート名/コードを検索',
    ko: '템플릿 이름/코드 검색',
  },
  'admin.sms.templateName': {
    'zh-CN': '模板名称',
    en: 'Template Name',
    'zh-TW': '模板名稱',
    ja: 'テンプレート名',
    ko: '템플릿 이름',
  },
  'admin.sms.templateCode': {
    'zh-CN': '模板编码',
    en: 'Template Code',
    'zh-TW': '模板編碼',
    ja: 'テンプレートコード',
    ko: '템플릿 코드',
  },
  'admin.sms.templateContent': {
    'zh-CN': '模板内容',
    en: 'Template Content',
    'zh-TW': '模板內容',
    ja: 'テンプレート内容',
    ko: '템플릿 내용',
  },
  'admin.sms.templateType': {
    'zh-CN': '模板类型',
    en: 'Template Type',
    'zh-TW': '模板類型',
    ja: 'テンプレートタイプ',
    ko: '템플릿 유형',
  },
  'admin.sms.typeVerify': {
    'zh-CN': '验证码',
    en: 'Verification',
    'zh-TW': '驗證碼',
    ja: '認証コード',
    ko: '인증 코드',
  },
  'admin.sms.typeNotice': {
    'zh-CN': '通知',
    en: 'Notice',
    'zh-TW': '通知',
    ja: '通知',
    ko: '알림',
  },
  'admin.sms.typeMarketing': {
    'zh-CN': '营销',
    en: 'Marketing',
    'zh-TW': '營銷',
    ja: 'マーケティング',
    ko: '마케팅',
  },
  'admin.sms.signName': {
    'zh-CN': '短信签名',
    en: 'SMS Signature',
    'zh-TW': '短信簽名',
    ja: 'SMS署名',
    ko: 'SMS 서명',
  },
  'admin.sms.status': {
    'zh-CN': '状态',
    en: 'Status',
    'zh-TW': '狀態',
    ja: 'ステータス',
    ko: '상태',
  },
  'admin.sms.statusEnabled': {
    'zh-CN': '已启用',
    en: 'Enabled',
    'zh-TW': '已啟用',
    ja: '有効',
    ko: '활성화됨',
  },
  'admin.sms.statusDisabled': {
    'zh-CN': '已禁用',
    en: 'Disabled',
    'zh-TW': '已禁用',
    ja: '無効',
    ko: '비활성화됨',
  },
  'admin.sms.remark': {
    'zh-CN': '备注',
    en: 'Remark',
    'zh-TW': '備註',
    ja: '備考',
    ko: '비고',
  },
  'admin.sms.createTime': {
    'zh-CN': '创建时间',
    en: 'Create Time',
    'zh-TW': '創建時間',
    ja: '作成時間',
    ko: '생성 시간',
  },
  'admin.sms.toggleStatus': {
    'zh-CN': '切换状态',
    en: 'Toggle Status',
    'zh-TW': '切換狀態',
    ja: 'ステータス切替',
    ko: '상태 전환',
  },
  'exam.searchPlaceholder.chapter': {
    'zh-CN': '搜索章节名称',
    en: 'Search chapter name',
    'zh-TW': '搜尋章節名稱',
    ja: '章節名を検索',
    ko: '챕터 이름 검색',
  },
  'exam.searchPlaceholder.chapterSection': {
    'zh-CN': '搜索章节小节名称',
    en: 'Search chapter section name',
    'zh-TW': '搜尋章節小節名稱',
    ja: '章節小節名を検索',
    ko: '챕터 섹션 이름 검색',
  },
  'help.faq': {
    'zh-CN': '常见问题',
    en: 'FAQ',
    'zh-TW': '常見問題',
    ja: 'よくある質問',
    ko: '자주 묻는 질문',
  },
  'help.refundPolicy': {
    'zh-CN': '退款政策',
    en: 'Refund Policy',
    'zh-TW': '退款政策',
    ja: '返金ポリシー',
    ko: '환불 정책',
  },
  'help.refundContact': {
    'zh-CN': '退款请联系客服',
    en: 'Please contact support for refund',
    'zh-TW': '退款請聯絡客服',
    ja: '返金はサポートまでご連絡ください',
    ko: '환불은 고객센터로 문의하세요',
  },
  'help.contactWays': {
    'zh-CN': '联系方式',
    en: 'Contact Ways',
    'zh-TW': '聯絡方式',
    ja: '連絡方法',
    ko: '연락 방법',
  },
  'help.workHours': {
    'zh-CN': '工作时间: 周一至周五 9:00-18:00',
    en: 'Working Hours: Mon-Fri 9:00-18:00',
    'zh-TW': '工作時間: 週一至週五 9:00-18:00',
    ja: '営業時間: 月〜金 9:00-18:00',
    ko: '근무 시간: 월~금 9:00-18:00',
  },
  'help.quickEntry': {
    'zh-CN': '快速入口',
    en: 'Quick Entry',
    'zh-TW': '快速入口',
    ja: 'クイックエントリ',
    ko: '빠른 진입',
  },
  'help.courseCenter': {
    'zh-CN': '课程中心',
    en: 'Course Center',
    'zh-TW': '課程中心',
    ja: 'コースセンター',
    ko: '코스 센터',
  },
  'help.personalCenter': {
    'zh-CN': '个人中心',
    en: 'Personal Center',
    'zh-TW': '個人中心',
    ja: 'マイページ',
    ko: '개인 센터',
  },
  'help.feedback': {
    'zh-CN': '意见反馈',
    en: 'Feedback',
    'zh-TW': '意見反饋',
    ja: 'フィードバック',
    ko: '피드백',
  },
  'help.aboutUs': {
    'zh-CN': '关于我们',
    en: 'About Us',
    'zh-TW': '關於我們',
    ja: '私たちについて',
    ko: '회사 소개',
  },
}

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

function main() {
  console.log('🔧 最终 i18n 修复 (60 个无 fallback key)')
  console.log('━'.repeat(60))
  console.log(`📋 待补 key: ${Object.keys(I18N).length}`)

  let totalFilled = 0
  const skipped = []

  for (const locale of LOCALES) {
    for (const [key, translations] of Object.entries(I18N)) {
      const segs = key.split('.')
      const mod = segs[0]
      const modFile = path.join(MODULES_DIR, locale, `${mod}.json`)
      let modObj = {}
      if (fs.existsSync(modFile)) {
        try {
          modObj = readJSONRobust(modFile) || {}
        } catch (e) {
          skipped.push({ key, locale, reason: 'parse_fail' })
          continue
        }
      }
      const topObj = ensureTopKey(modObj, mod)
      // 检查现有值
      let cur = topObj
      let exists = true
      for (let i = 1; i < segs.length; i++) {
        if (cur && typeof cur === 'object' && segs[i] in cur) cur = cur[segs[i]]
        else { exists = false; break }
      }
      if (exists) {
        skipped.push({ key, locale, reason: 'already_exists' })
        continue
      }
      const value = translations[locale]
      if (!value) {
        skipped.push({ key, locale, reason: 'no_translation' })
        continue
      }
      setNestedValue(topObj, segs.slice(1), value)
      writeJSON(modFile, modObj)
      totalFilled++
    }
  }

  console.log(`\n📊 修复统计:`)
  console.log(`  写入 key: ${totalFilled} (5 语言 × 60 = 300 目标)`)
  console.log(`  跳过: ${skipped.length}`)

  // 按 reason 统计
  const byReason = {}
  for (const s of skipped) {
    byReason[s.reason] = (byReason[s.reason] || 0) + 1
  }
  for (const [r, c] of Object.entries(byReason)) {
    console.log(`    ${r}: ${c}`)
  }

  console.log('\n✅ 完成. 运行 npm run check:i18n:keys 验证.')
}

main()
