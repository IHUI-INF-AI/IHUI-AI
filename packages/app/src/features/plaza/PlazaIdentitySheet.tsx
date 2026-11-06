// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { User } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { Tappable } from '@ihui/ui-native'

/** 身份切换弹层的一个身份选项(数据驱动,不写死文案) */
export interface PlazaIdentityOption {
  id: string
  label: string
}

export interface PlazaIdentitySheetProps {
  t: TFunction
  visible: boolean
  colorScheme?: 'light' | 'dark'
  /** 弹层标题;缺省取 plaza.index.identityTitle */
  title?: string
  /** 身份选项:两端口径一致(RN/小程序都传同一组 id+label) */
  items: readonly PlazaIdentityOption[]
  selectedId?: string
  /** 身份卡用户区(头像/昵称/副文案);缺省不渲染 */
  user?: { avatar?: string; name: string; subtext?: string }
  /** 底部入口(RN 端「开发者须知」挂这里);缺省不渲染 */
  footer?: { title: string; text: string; onPress: () => void }
  onSelect: (id: string) => void
  onClose: () => void
}

/** 身份切换弹层共享实现(2026-11-05 自两端页面内联弹层上收) */
export function PlazaIdentitySheet({
  t,
  visible,
  colorScheme = 'light',
  title,
  items,
  selectedId,
  user,
  footer,
  onSelect,
  onClose,
}: PlazaIdentitySheetProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Tappable
        style={styles.mask}
        onPress={onClose}
        accessibilityLabel={t('plaza.index.closeIdentity')}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title ?? t('plaza.index.identityTitle')}</Text>
          {user ? (
            <View style={styles.userRow}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarBox, styles.avatarFallback]}>
                  <User size={28} color={tk.text.secondary} />
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.name}
                </Text>
                {user.subtext ? <Text style={styles.userSub}>{user.subtext}</Text> : null}
              </View>
            </View>
          ) : null}
          {items.map((it) => (
            <Tappable
              key={it.id}
              style={[styles.item, selectedId === it.id ? styles.itemActive : null]}
              onPress={() => onSelect(it.id)}
              accessibilityRole="button"
              accessibilityLabel={it.label}
            >
              <Text style={[styles.itemText, selectedId === it.id ? styles.itemTextActive : null]}>
                {it.label}
              </Text>
            </Tappable>
          ))}
          {footer ? (
            <Tappable
              style={styles.footer}
              onPress={footer.onPress}
              accessibilityRole="button"
              accessibilityLabel={footer.title}
            >
              <Text style={styles.footerTitle}>{footer.title}</Text>
              <Text style={styles.footerText}>{footer.text}</Text>
            </Tappable>
          ) : null}
        </Pressable>
      </Tappable>
    </Modal>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    mask: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: rnSpacing['2xl'],
      backgroundColor: 'rgba(0,0,0,0.45)',
    } as ViewStyle,
    card: {
      width: '100%',
      maxWidth: 360,
      padding: rnSpacing['2xl'],
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      gap: rnSpacing.md,
    } as ViewStyle,
    title: {
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
      textAlign: 'center',
      marginBottom: rnSpacing.sm,
    } as TextStyle,
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
    } as ViewStyle,
    avatarBox: {
      width: 56,
      height: 56,
      borderRadius: 28,
    } as ViewStyle,
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
    } as ImageStyle,
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    userInfo: {
      flex: 1,
      gap: rnSpacing['2xs'],
    } as ViewStyle,
    userName: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    userSub: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    } as TextStyle,
    item: {
      paddingVertical: rnSpacing['md-loose'],
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
    } as ViewStyle,
    itemActive: {
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    itemText: {
      fontSize: rnType.title.size,
      color: tk.text.secondary,
    } as TextStyle,
    itemTextActive: {
      color: tk.brandAccent.deep,
      fontWeight: '600',
    } as TextStyle,
    footer: {
      marginTop: rnSpacing.sm,
      gap: rnSpacing['2xs'],
      alignItems: 'center',
    } as ViewStyle,
    footerTitle: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    footerText: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      textAlign: 'center',
    } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
