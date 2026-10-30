// 生成 .ihui-agent/wave3/p10.manifest.json —— 文案值逐字取自 web i18n 现读快照(§0.6 单源:脚本搬运,不手抄)
const fs = require('node:fs')

const langs = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko']
const dumps = Object.fromEntries(
  langs.map((L) => [L, JSON.parse(fs.readFileSync(`.ihui-agent/tmp/p10/web-i18n-${L}.json`, 'utf8'))]),
)

function nsFor(lang) {
  const d = dumps[lang]
  return {
    circlePostPage: {
      title: d.circlesTitle,
      back: d.common.back,
      cardTitle: d.post.cardTitle,
      selectCircle: d.post.selectCircle,
      titleLabel: d.post.titleLabel,
      titlePlaceholder: d.post.titlePlaceholder,
      contentLabel: d.post.contentLabel,
      contentPlaceholder: d.post.contentPlaceholder,
      images: d.post.images,
      submit: d.common.submit,
      cancel: d.common.cancel,
      errorCircleRequired: d.post.errorCircleRequired,
      errorTitleContentRequired: d.post.errorTitleContentRequired,
      uploadFailed: d.uploadFailed,
      error: d.letters.error,
    },
    invitationsPage: {
      title: d.invitations.title,
      subtitle: d.invitations.subtitle,
      generate: d.invitations.generate,
      myCodes: d.invitations.myCodes,
      invitees: d.invitations.invitees,
      loading: d.invitations.loading,
      emptyCodes: d.invitations.emptyCodes,
      emptyInvitees: d.invitations.emptyInvitees,
      user: d.invitations.user,
      registeredAt: d.invitations.registeredAt,
      reward: d.invitations.reward,
      rewardValue: d.invitations.rewardValue,
      expiresAt: d.invitations.expiresAt,
      copy: d.invitations.copy,
      copied: d.invitations.copied,
      statusUnused: d.invitations.status.unused,
      statusUsed: d.invitations.status.used,
      statusExpired: d.invitations.status.expired,
      back: d.common.back,
      loginRequired: d.loginRequired,
      error: d.letters.error,
    },
    lettersPage: {
      title: d.letters.title,
      subtitle: d.letters.subtitle,
      searchPlaceholder: d.letters.searchPlaceholder,
      loading: d.letters.loading,
      empty: d.letters.empty,
      error: d.letters.error,
      you: d.letters.you,
      send: d.letters.send,
      sendPlaceholder: d.letters.sendPlaceholder,
      delete: d.letters.delete,
      deleteConfirm: d.letters.deleteConfirm,
      confirm: d.common.confirm,
      cancel: d.common.cancel,
      back: d.common.back,
      loginRequired: d.loginRequired,
    },
    newsCategoryPage: {
      backToList: d.news.backToList,
      subtitle: d.news.subtitle,
      notFound: d.news.notFound,
      empty: d.news.empty,
      pinned: d.news.pinned,
      publishedAt: d.news.publishedAt,
      viewCount: d.news.viewCount,
      total: d.news.total,
      prev: d.news.prev,
      next: d.news.next,
      loading: d.invitations.loading,
      error: d.letters.error,
    },
    searchHistoryPage: {
      title: d.searchHistory.title,
      subtitle: d.searchHistory.subtitle,
      clearAll: d.searchHistory.clearAll,
      loading: d.searchHistory.loading,
      empty: d.searchHistory.empty,
      resultCount: d.searchHistory.resultCount,
      back: d.common.back,
      loginRequired: d.loginRequired,
      error: d.letters.error,
    },
  }
}

const i18n = Object.fromEntries(langs.map((L) => [L, nsFor(L)]))

const manifest = {
  domain: 'community',
  newFiles: [
    'packages/api-client/src/endpoints/wave3-community.ts',
    'packages/app/src/features/community/CirclePostScreen.tsx',
    'packages/app/src/features/community/InvitationsScreen.tsx',
    'packages/app/src/features/community/LettersScreen.tsx',
    'packages/app/src/features/community/LetterChatScreen.tsx',
    'packages/app/src/features/community/NewsCategoryScreen.tsx',
    'packages/app/src/features/community/SearchHistoryScreen.tsx',
    'apps/mobile-rn/src/screens/CirclePostScreen.tsx',
    'apps/mobile-rn/src/screens/InvitationsScreen.tsx',
    'apps/mobile-rn/src/screens/LettersScreen.tsx',
    'apps/mobile-rn/src/screens/LetterChatScreen.tsx',
    'apps/mobile-rn/src/screens/NewsCategoryScreen.tsx',
    'apps/mobile-rn/src/screens/SearchHistoryScreen.tsx',
    'apps/mobile-rn/src/utils/letter-time.ts',
  ],
  indexExports: [
    "export { CirclePostScreen } from './features/community/CirclePostScreen'",
    "export type { CircleOption, CirclePostImage, CirclePostScreenProps } from './features/community/CirclePostScreen'",
    "export { InvitationsScreen } from './features/community/InvitationsScreen'",
    "export type { InvitationStatus, InvitationRowView, InviteeRowView, InvitationsScreenProps } from './features/community/InvitationsScreen'",
    "export { LettersScreen } from './features/community/LettersScreen'",
    "export type { LetterConversationRow, LettersScreenProps } from './features/community/LettersScreen'",
    "export { LetterChatScreen } from './features/community/LetterChatScreen'",
    "export type { LetterChatMessageRow, LetterChatScreenProps } from './features/community/LetterChatScreen'",
    "export { NewsCategoryScreen } from './features/community/NewsCategoryScreen'",
    "export type { NewsCategoryArticleRow, NewsCategoryScreenProps } from './features/community/NewsCategoryScreen'",
    "export { SearchHistoryScreen } from './features/community/SearchHistoryScreen'",
    "export type { SearchHistoryRowView, SearchHistoryScreenProps } from './features/community/SearchHistoryScreen'",
  ],
  apiClientIndexExports: ["export * from './endpoints/wave3-community.js'"],
  apiClientIndexNote:
    '新建 packages/api-client/src/endpoints/wave3-community.ts(邀请码 3 端点、圈子发帖精确响应 {post}、news categories/articles、search history 3 端点、私信行形状修正 normalizeLetterRow/normalizeLetterMemberRow)需在 packages/api-client/src/index.ts 补一行 re-export,否则 6 枚薄壳 import 报「无此导出」。getCircles/uploadFileMultipart/resolveFileUrl/private-letters 7 封装均已在 index 在册,零新增。',
  navigator: [
    {
      import: "import { CirclePostScreen } from '../screens/CirclePostScreen'",
      param: '  CirclePost: undefined',
      screen: '<RootStack.Screen name="CirclePost" component={CirclePostScreen} />',
    },
    {
      import: "import { InvitationsScreen } from '../screens/InvitationsScreen'",
      param: '  Invitations: undefined',
      screen: '<RootStack.Screen name="Invitations" component={InvitationsScreen} />',
    },
    {
      import: "import { LettersScreen } from '../screens/LettersScreen'",
      param: '  Letters: undefined',
      screen: '<RootStack.Screen name="Letters" component={LettersScreen} />',
    },
    {
      import: "import { LetterChatScreen } from '../screens/LetterChatScreen'",
      param: '  LetterChat: { memberId: string; memberName: string }',
      screen: '<RootStack.Screen name="LetterChat" component={LetterChatScreen} />',
    },
    {
      import: "import { NewsCategoryScreen } from '../screens/NewsCategoryScreen'",
      param: '  NewsCategory: { id: string }',
      screen: '<RootStack.Screen name="NewsCategory" component={NewsCategoryScreen} />',
    },
    {
      import: "import { SearchHistoryScreen } from '../screens/SearchHistoryScreen'",
      param: '  SearchHistory: undefined',
      screen: '<RootStack.Screen name="SearchHistory" component={SearchHistoryScreen} />',
    },
  ],
  i18n,
  ledger: [
    {
      web: 'circles/post',
      rn: 'apps/mobile-rn/src/screens/CirclePostScreen.tsx',
      status: 'aligned',
      note:
        'Wave3@2026-10-26: 承载证据=共享屏 packages/app/src/features/community/CirclePostScreen.tsx + 薄壳(上图);端点:选圈 GET /api/circles?page=1&pageSize=100 复用 getCircles(community.ts:91),发帖 POST /api/circles/:id/posts→data{post} 新封装 submitCirclePost(wave3-community.ts,后端 community/circles.ts:457 现读);图片腿 expo-image-picker→uploadFileMultipart(POST /api/files/upload/form,与 web ImageUpload 同端点,maxCount=9 同值);校验文案逐字同 web(post.errorCircleRequired/errorTitleContentRequired);成功跳 CircleDetail(web router.push("/circles/"+id) 同口径)。',
      at: '2026-10-26',
    },
    {
      web: 'invitations',
      rn: 'apps/mobile-rn/src/screens/InvitationsScreen.tsx',
      status: 'aligned',
      note:
        'Wave3@2026-10-26: 承载证据=共享屏 community/InvitationsScreen.tsx + 薄壳;端点 GET /api/invitations、POST /api/invitations、GET /api/invitations/invitees(wave3-community.ts 新封装,后端 promotions.ts:190/130/198 现读,data 面 {list}/{invitation});复制腿 @react-native-clipboard/clipboard(web navigator.clipboard 同动作);时间 Intl.DateTimeFormat 同 web 参数(year/month/day/hour/minute,locale);登录门与 web useAuthGate 同口径(未登录不发注定 401 请求)。',
      at: '2026-10-26',
    },
    {
      web: 'letters',
      rn: 'apps/mobile-rn/src/screens/LettersScreen.tsx',
      status: 'aligned',
      note:
        'Wave3@2026-10-26: 承载证据=web 双栏在移动端拆两屏:会话列表 LettersScreen.tsx(GET /api/private-letters/members?page=1&pageSize=100&memberNameKeyword,300ms 防抖+15s 轮询与 web page.tsx:33/53 同参)+ 会话内容 apps/mobile-rn/src/screens/LetterChatScreen.tsx(GET /list?senderId&id=0&pageSize=50、POST、DELETE {id},逐条复用 private-letters.ts 既有封装;行时间列经 wave3-community.ts normalizeLetterRow 修正为后端 message_private_letter 真实 createdAt 列);删除确认 appAlert(web ConfirmDialog 同文案 deleteConfirm/confirm/cancel);时间格式逐字复刻 web helpers.ts。',
      at: '2026-10-26',
    },
    {
      web: 'news/category/[id]',
      rn: 'apps/mobile-rn/src/screens/NewsCategoryScreen.tsx',
      status: 'aligned',
      note:
        'Wave3@2026-10-26: 承载证据=共享屏 community/NewsCategoryScreen.tsx + 薄壳(路由参 { id: string });端点 GET /api/news/categories + GET /api/news/articles?page&pageSize=20&categoryId(wave3-community.ts 新封装,后端 news.ts:136/167 现读,articlesQuerySchema categoryId=uuid 同 web 参数);封面/置顶/浏览量/上一页下一页与 web PageClient 同构;日期 formatDateOnly(@ihui/shared/utils,与 web 同一出口)。降级:RN 无 NewsDetail 路由(RootNavigator 现读零该路由,本包禁改)⇒ 文章条目为只读展示,未造假点击;分页/返回 News 全真。',
      at: '2026-10-26',
    },
    {
      web: 'search/history',
      rn: 'apps/mobile-rn/src/screens/SearchHistoryScreen.tsx',
      status: 'aligned',
      note:
        'Wave3@2026-10-26: 承载证据=共享屏 community/SearchHistoryScreen.tsx + 薄壳;端点 GET /api/search/history、DELETE /api/search/history(全清)、DELETE /api/search/history/:id(wave3-community.ts 新封装,后端 search.ts:205/237/243 现读,data 面 {list}/{deletedCount}/{id});时间 Intl 同 web 参数(MM/DD HH:mm,locale)+resultCount 文案逐字;登录门同 web useAuthGate。降级:RN Search 路由为无参路由(RootNavigator:607 现读「Search: undefined」,本包禁改)⇒ web 行点击带词重搜不可复刻,行只读,未造假按钮。',
      at: '2026-10-26',
    },
  ],
}

fs.writeFileSync('.ihui-agent/wave3/p10.manifest.json', JSON.stringify(manifest, null, 2) + '\n')
console.log('manifest written:', fs.statSync('.ihui-agent/wave3/p10.manifest.json').size, 'bytes')
