// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/settings/SettingsScreen.tsx
import { useI18n } from '@/i18n'
import { goToLogin } from '@/utils/auth'
import { logger } from '@/utils/logger'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, logout, type UserInfo } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { clearAuth } from '@/utils/auth'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
import { RowsSection, NotificationSection, PasswordModal, type SettingRow } from './parts'

export default function SettingIndexPage() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [user, setUser] = useState<Partial<UserInfo>>({})
  // 资料是否真的取到:未登录 / 取失败时不渲染用户卡(与 RN 侧 `user && onEditProfile` 同判)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [pwdVisible, setPwdVisible] = useState(false)
  /* 版本号取端上真实来源(与「关于我们」页 api/index.ts getAboutInfo 同一口径):
     `miniProgram.version` 只有线上版非空,开发/体验版为空串 ⇒ 空串时整行不渲染,
     对齐 RN 侧 `appVersion ? <Text>{t('settings.version')} {appVersion}</Text> : null`。
     此处此前写死 '1.0.0' —— 屏上那个数字与任何构建都没有关系,是编出来的。 */
  const appVersion = Taro.getAccountInfoSync?.()?.miniProgram?.version ?? ''

  // 本地 fallback:t(key) 未命中时返回 fb,保证页面可用(主 agent 补 i18n key 后自动切换)
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const load = useCallback(async () => {
    try {
      setUser(await getProfile())
      setProfileLoaded(true)
    } catch (e) {
      logger.error('setting/index', '获取用户信息', e)
      Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
    }
  }, [tt])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  const onLogout = useCallback(() => {
    Taro.showModal({
      title: t('profile.logout'),
      content: t('settings.logoutConfirm'),
      success: async (res) => {
        if (res.confirm) {
          try {
            await logout()
          } catch (e) {
            logger.error('setting/index', '退出登录', e)
            Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
          }
          // 本页 `logout` 是 `@/api` 的后端登出接口(只吊销服务端会话),不清本地凭据。
          // 清凭据 + 落登出标记是 `clearAuth()` 一件成对动作:只落标记不清凭据 ⇒ 内存/存储里
          // 的 token 还在,后续请求照样带着走;只清凭据不落标记 ⇒ 冷启动又被静默登回。
          clearAuth()
          goToLogin()
        }
      },
    })
  }, [t, tt])

  // 分区行:文案与 RN 共享屏同一套(账号与安全区首行「修改密码」对齐 RN 的页内弹层形态)
  const accountRows: SettingRow[] = [
    {
      key: 'password',
      label: t('settings.changePassword'),
      onPress: () => setPwdVisible(true),
    },
    {
      key: 'profile',
      label: tt('setting.profile', '个人资料'),
      onPress: () => navigate('/pkg-user/user/profile'),
    },
    {
      key: 'cancel',
      label: tt('setting.accountCancel', '账号注销'),
      onPress: () => navigate('/pkg-user/account-cancel/index/index'),
    },
    {
      key: 'notification',
      label: tt('setting.notificationSetting', '通知设置'),
      onPress: () => navigate('/pages/setting/notification'),
    },
  ]

  const generalRows: SettingRow[] = [
    {
      key: 'cache',
      label: tt('setting.clearCache', '清除缓存'),
      onPress: () => navigate('/pages/setting/cache'),
    },
    // 语言 / 主题:本端各有一整页选择器,行内跳转承载与 RN 内联选项等同的信息结构
    {
      key: 'language',
      label: t('settings.language'),
      onPress: () => navigate('/pages/setting/language'),
    },
    {
      key: 'theme',
      label: t('settings.theme'),
      onPress: () => navigate('/pages/setting/theme'),
    },
  ]

  const otherRows: SettingRow[] = [
    {
      key: 'feedback',
      label: tt('setting.feedback', '意见反馈'),
      onPress: () => navigate('/pkg-user/user/feedback'),
    },
    {
      key: 'privacy',
      label: tt('setting.privacyPermission', '隐私与权限'),
      onPress: () => navigate('/pages/setting/privacy'),
    },
    {
      key: 'web',
      label: tt('setting.webPortal', '网页版功能'),
      onPress: () => navigate('/pkg-about/about/web-portal/index'),
    },
    {
      key: 'about',
      label: tt('setting.aboutUs', '关于我们'),
      onPress: () => navigate('/pkg-about/about/index'),
    },
  ]

  // G-933 冷启动抢跑门控:load 唯一一支 GET /api/user/profile 需鉴权
  // (apps/api/src/routes/miniapp-compat-routes.ts:2247 handler 内
  // `if (!(await checkAuth(request, reply))) return`,注册前缀 /api 见 routes/index.ts:1045)
  // ⇒ 挡到门后。未登录卡面由既有 `profileLoaded ? … : null` 分支自然不渲染,不新增文案。
  useDidShow(() => {
    gate.waitUntilReady(() => {
      void load()
    })
  })

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN container(pageBg=surface.bg → --color-background);
          上下留白对齐 body paddingTop 12dp→24rpx / paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pb-[48rpx] pt-[24rpx]">
        {profileLoaded ? (
          <View
            className="mx-[20rpx] flex items-center gap-[24rpx] rounded-lg bg-muted p-[28rpx]"
            onClick={() => navigate('/pkg-user/user/profile')}
            hoverClass="opacity-60"
          >
            {/* 头像对齐 RN avatar: 48dp→96rpx + 圆角 8dp→16rpx */}
            <Image
              className="w-[96rpx] h-[96rpx] rounded-lg bg-background"
              src={user.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <View className="min-w-0 flex-1">
              {/* 昵称对齐 RN nickname: 16dp→32rpx semibold + text.primary;无昵称落「未设置昵称」 */}
              <Text className="block text-[length:32rpx] text-foreground font-semibold">
                {user.nickname || t('profile.nickname')}
              </Text>
              {/* 副行对齐 RN subText: 14dp→28rpx + text.secondary;间距对齐 userMeta gap 2dp→4rpx */}
              <Text className="mt-[4rpx] block text-[length:28rpx] text-muted-foreground">
                {t('profile.editProfile')}
              </Text>
            </View>
            <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
          </View>
        ) : null}

        {/* 三个分组卡片:对齐 RN Section(卡片几何/行高档位见 ./parts 的 RowsSection) */}
        <RowsSection title={t('settings.account')} rows={accountRows} />
        <RowsSection title={tt('setting.general', '通用')} rows={generalRows} />
        {/* 消息通知:对齐 RN 三条 switchRow(推送 / 站内消息 / 邮件) */}
        <NotificationSection />
        <RowsSection title={tt('setting.other', '其他')} rows={otherRows} />

        {/* logoutBtn 对齐 RN: 高 50dp→100rpx + 圆角 8dp→16rpx + 卡面底色;
            文字 16dp→32rpx semibold + danger(对齐 RN danger.DEFAULT,亮暗随 --color-danger);
            上边距 logoutBtn marginTop 8dp + body gap 16dp = 24dp→48rpx */}
        <Button
          className="mx-[20rpx] mt-[48rpx] flex h-[100rpx] items-center justify-center rounded-sm bg-card text-[length:32rpx] font-semibold dark:bg-muted"
          style={{ color: 'var(--color-danger)' }}
          onClick={onLogout}
        >
          {t('profile.logout')}
        </Button>

        {/* versionText 对齐 RN: 独立居中行 + 12dp→24rpx + text.tertiary + marginTop 4dp→8rpx;
            且同 RN 的 `appVersion ? … : null` —— 拿不到真实版本号时这一行不出现 */}
        {appVersion ? (
          <Text className="mt-[8rpx] block text-center text-[length:24rpx] text-[color:var(--color-text-tertiary)]">
            {t('settings.version')} {appVersion}
          </Text>
        ) : null}

        {/* 修改密码弹层:对齐 RN 共享屏内置 Modal(三输入 + 校验 + 成败提示) */}
        <PasswordModal visible={pwdVisible} onClose={() => setPwdVisible(false)} />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
