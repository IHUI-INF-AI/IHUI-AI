export interface MenuItem {
  key: string
  labelKey: string
  icon: string
  viaParent?: boolean
}

export interface MenuSection {
  titleKey: string
  items: MenuItem[]
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    titleKey: 'menu.sectionOrder',
    items: [
      { key: 'Order', labelKey: 'menu.order', icon: '🧾' },
      { key: 'OrderRefund', labelKey: 'menu.orderRefund', icon: '↩️', viaParent: true },
      { key: 'Payment', labelKey: 'menu.payment', icon: '💳', viaParent: true },
      { key: 'OrderLog', labelKey: 'menu.orderLog', icon: '📋', viaParent: true },
      { key: 'OrderTrack', labelKey: 'menu.orderTrack', icon: '📦', viaParent: true },
      { key: 'RefundHistory', labelKey: 'menu.refundHistory', icon: '🔄', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionWallet',
    items: [
      { key: 'Wallet', labelKey: 'menu.wallet', icon: '💰' },
      { key: 'Finance', labelKey: 'menu.finance', icon: '📊', viaParent: true },
      { key: 'Withdraw', labelKey: 'menu.withdraw', icon: '💸', viaParent: true },
      { key: 'BankCard', labelKey: 'menu.bankCard', icon: '🏦', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionVip',
    items: [
      { key: 'Vip', labelKey: 'menu.vip', icon: '👑', viaParent: true },
      { key: 'VipBenefit', labelKey: 'menu.vipBenefit', icon: '🎁', viaParent: true },
      { key: 'VipCompare', labelKey: 'menu.vipCompare', icon: '⚖️', viaParent: true },
      { key: 'Coupon', labelKey: 'menu.coupon', icon: '🎟️', viaParent: true },
      { key: 'Promotion', labelKey: 'menu.promotion', icon: '🏷️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionPoints',
    items: [
      { key: 'PointsMall', labelKey: 'menu.pointsMall', icon: '🛍️', viaParent: true },
      { key: 'PointsRecord', labelKey: 'menu.pointsRecord', icon: '📈', viaParent: true },
      { key: 'PointRule', labelKey: 'menu.pointRule', icon: '📖', viaParent: true },
      { key: 'PointHistory', labelKey: 'menu.pointHistory', icon: '🗂️', viaParent: true },
      { key: 'TaskCenter', labelKey: 'menu.taskCenter', icon: '✅', viaParent: true },
      { key: 'CheckIn', labelKey: 'menu.checkIn', icon: '📅', viaParent: true },
      { key: 'Ranking', labelKey: 'menu.ranking', icon: '🏆', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionPromote',
    items: [
      { key: 'Promote', labelKey: 'menu.promote', icon: '📢', viaParent: true },
      { key: 'Distribution', labelKey: 'menu.distribution', icon: '🤝', viaParent: true },
      { key: 'Team', labelKey: 'menu.team', icon: '👥', viaParent: true },
      { key: 'Referrer', labelKey: 'menu.referrer', icon: '👤', viaParent: true },
      { key: 'Invite', labelKey: 'menu.invite', icon: '✉️', viaParent: true },
      { key: 'QrCode', labelKey: 'menu.qrCode', icon: '📱', viaParent: true },
      { key: 'Activity', labelKey: 'menu.activity', icon: '🎉', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionStudy',
    items: [
      { key: 'Note', labelKey: 'menu.note', icon: '📝', viaParent: true },
      { key: 'StudyRecord', labelKey: 'menu.studyRecord', icon: '📚', viaParent: true },
      { key: 'StudyPlan', labelKey: 'menu.studyPlan', icon: '🗓️', viaParent: true },
      { key: 'StudyProgress', labelKey: 'menu.studyProgress', icon: '📈', viaParent: true },
      { key: 'AIMultimodal', labelKey: 'menu.aiMultimodal', icon: '🎨', viaParent: true },
      { key: 'CourseEnroll', labelKey: 'menu.courseEnroll', icon: '🎓', viaParent: true },
      { key: 'LivePlayback', labelKey: 'menu.livePlayback', icon: '▶️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionExam',
    items: [
      { key: 'Exam', labelKey: 'menu.exam', icon: '✏️', viaParent: true },
      { key: 'ExamHistory', labelKey: 'menu.examHistory', icon: '🗂️', viaParent: true },
      { key: 'Certificate', labelKey: 'menu.certificate', icon: '📜' },
      { key: 'CertList', labelKey: 'menu.certList', icon: '📋', viaParent: true },
      { key: 'CertApply', labelKey: 'menu.certApply', icon: '✍️', viaParent: true },
      { key: 'CertVerify', labelKey: 'menu.certVerify', icon: '✔️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionSocial',
    items: [
      { key: 'Favorites', labelKey: 'menu.favorites', icon: '⭐' },
      { key: 'Following', labelKey: 'menu.following', icon: '👀' },
      { key: 'Follow', labelKey: 'menu.follow', icon: '🤝' },
      { key: 'Favorite', labelKey: 'menu.favorite', icon: '❤️' },
      { key: 'MessageCenter', labelKey: 'menu.messageCenter', icon: '💬' },
      { key: 'MessageSystem', labelKey: 'menu.messageSystem', icon: '🔔', viaParent: true },
      { key: 'MessageDirect', labelKey: 'menu.messageDirect', icon: '📩', viaParent: true },
      { key: 'MessageGroup', labelKey: 'menu.messageGroup', icon: '👥', viaParent: true },
      { key: 'NotificationList', labelKey: 'menu.notificationList', icon: '📣', viaParent: true },
      {
        key: 'NotificationSettings',
        labelKey: 'menu.notificationSettings',
        icon: '⚙️',
        viaParent: true,
      },
    ],
  },
  {
    titleKey: 'menu.sectionAuth',
    items: [
      { key: 'ProfileEdit', labelKey: 'menu.profileEdit', icon: '✏️' },
      { key: 'RealNameAuth', labelKey: 'menu.realNameAuth', icon: '🪪', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionAgent',
    items: [
      { key: 'Agent', labelKey: 'menu.agent', icon: '🤖' },
      { key: 'AgentMarket', labelKey: 'menu.agentMarket', icon: '🏪', viaParent: true },
      { key: 'AgentCreate', labelKey: 'menu.agentCreate', icon: '➕', viaParent: true },
      { key: 'AgentReviewList', labelKey: 'menu.agentReviewList', icon: '💬', viaParent: true },
      { key: 'AgentStat', labelKey: 'menu.agentStat', icon: '📊', viaParent: true },
      { key: 'AgentSetting', labelKey: 'menu.agentSetting', icon: '⚙️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionCommunity',
    items: [
      { key: 'ArticleList', labelKey: 'menu.articleList', icon: '📰', viaParent: true },
      { key: 'PostCreate', labelKey: 'menu.postCreate', icon: '✍️', viaParent: true },
      { key: 'CircleCreate', labelKey: 'menu.circleCreate', icon: '⭕', viaParent: true },
      { key: 'AskList', labelKey: 'menu.askList', icon: '❓', viaParent: true },
      { key: 'AskCreate', labelKey: 'menu.askCreate', icon: '➕', viaParent: true },
      { key: 'NoteList', labelKey: 'menu.noteList', icon: '📝', viaParent: true },
      { key: 'NoteCreate', labelKey: 'menu.noteCreate', icon: '✏️', viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionSettings',
    items: [
      { key: 'Subscriptions', labelKey: 'menu.subscriptions', icon: '🔁' },
      { key: 'Settings', labelKey: 'menu.settings', icon: '⚙️' },
    ],
  },
]
