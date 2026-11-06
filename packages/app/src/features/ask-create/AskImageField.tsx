// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 问答配图共享段(2026-11-07)。
 *
 * 立因:`pages/ask/create` 的选图一直写在端内(`Taro.chooseImage`),RN 侧无对应实现,
 * 同一交互两端各活各的。本段把"点击 + → 多选 → 追加缩略图 / 删除"整段下沉到 packages/app,
 * 选图一律走注入的 `media` 端口 —— 共享层零平台 API,宿主各自实现:
 *   - 小程序: `Taro.chooseImage`(apps/miniapp-taro/src/host/ask-create-ports.ts)
 *   - RN: `expo-image-picker`(apps/mobile-rn/src/screens/AskCreateScreen.tsx)
 *
 * 缺端口不静默降级:`pickAskImages` 走 `assertRequiredPort`,dev 直接抛 `[host-port] missing media`。
 */

import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { assertRequiredPort, isPortErrorState } from '../../host/ports'
import type { MediaPort, OnToast } from '../../host/ports'

/** 配图上限(与改动前的端内常量 IMAGE_MAX 同值)。 */
export const ASK_IMAGE_MAX = 3

export type PickAskImagesStatus = 'added' | 'limited' | 'cancelled' | 'failed' | 'capability-off'

export interface PickAskImagesResult {
  status: PickAskImagesStatus
  uris: string[]
}

export interface PickAskImagesOptions {
  media: MediaPort | null | undefined
  images: readonly string[]
  maxCount?: number
  maxToast: string
  onToast: OnToast
  onAdd: (uris: string[]) => void
}

/**
 * 选图纯函数(不碰 React,便于直测):判定上限 → 调注入端口 → 追加 URI。
 * 取消/失败都不弹错(与改动前端内行为一致:取消静默、失败静默,不把"没选到"伪装成"选到了")。
 */
export async function pickAskImages({
  media,
  images,
  maxCount = ASK_IMAGE_MAX,
  maxToast,
  onToast,
  onAdd,
}: PickAskImagesOptions): Promise<PickAskImagesResult> {
  const port = assertRequiredPort('media', media)
  if (isPortErrorState(port)) return { status: 'capability-off', uris: [] }

  if (images.length >= maxCount) {
    onToast(maxToast, { kind: 'info' })
    return { status: 'limited', uris: [] }
  }

  let assets: readonly { uri: string }[]
  try {
    assets = await port.pickImages({ count: maxCount - images.length, source: 'album' })
  } catch {
    return { status: 'failed', uris: [] }
  }

  const uris = assets.map((a) => a.uri).filter((uri) => uri.length > 0)
  if (uris.length === 0) return { status: 'cancelled', uris: [] }

  onAdd(uris)
  return { status: 'added', uris }
}

export interface AskImageFieldProps {
  images: readonly string[]
  /** 上限文案由宿主给出:小程序读 `ask.create.maxImages`,RN 复用既有发布图文案。 */
  maxToast: string
  media: MediaPort
  onToast: OnToast
  onAdd: (uris: string[]) => void
  onRemove: (index: number) => void
  maxCount?: number
  colorScheme?: 'light' | 'dark'
}

/** 配图共享段:缩略图网格 + 删除角标 + 添加入口。 */
export function AskImageField({
  images,
  maxToast,
  media,
  onToast,
  onAdd,
  onRemove,
  maxCount = ASK_IMAGE_MAX,
  colorScheme = 'light',
}: AskImageFieldProps) {
  const tk = getTokens(colorScheme)
  const styles = createStyles(tk)

  const handleAdd = () => {
    void pickAskImages({ media, images, maxCount, maxToast, onToast, onAdd })
  }

  return (
    <View style={styles.grid}>
      {images.map((uri, index) => (
        <View key={`${index}-${uri}`} style={styles.tileWrap}>
          <Image source={{ uri }} style={styles.tile} resizeMode="cover" />
          <TouchableOpacity
            style={styles.del}
            onPress={() => onRemove(index)}
            accessibilityRole="button"
          >
            <Text style={styles.delText}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
      {images.length < maxCount ? (
        <TouchableOpacity style={styles.add} onPress={handleAdd} accessibilityRole="button">
          <Text style={styles.addIcon}>+</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

/**
 * 尺寸逐值取自端内旧 CSS(create.css:139-182):160rpx=80px、36rpx=18px、
 * -10rpx=-5px、2rpx=1px、--radius-lg / --radius-sm、--text-label / --text-display,
 * 只换渲染层不改观感。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    tileWrap: { width: 80, height: 80 },
    tile: { width: 80, height: 80, borderRadius: rnRadius.lg, backgroundColor: tk.surface.bg },
    del: {
      position: 'absolute',
      top: -5,
      right: -5,
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.danger.DEFAULT,
      zIndex: 2,
    },
    delText: { color: tk.surface.light, ...rnType.label },
    add: {
      width: 80,
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tk.border.medium,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    addIcon: { ...rnType.display, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
