/**
 * FenLeiOverlay 赛道分类弹层 (mobile-rn 端)
 *
 * 对齐历史项目 Uniapp tools/index.vue tagWrapShow 弹层(s_t_b):
 * - NavBar"分类"按钮触发,弹层紧贴顶部(nav-click → handleFenLeiClick → tagWrapShow = true)。
 * - 结构:顶部标题"分类"(tag-head:紫色居中加粗) + 赛道横向按钮行(ScrollTitle informationList=agentCategory,
 *   首项"全公司" id='') + 分类网格(fenlei_btn_list_overlay:agentMainCategory,首项"全部" id='') + 确定按钮。
 * - 两层均为单选(对齐 fenlei_active 单选数组 / agentCategory_active 单值),确定后回调刷新智能体列表。
 * - 半透明遮罩(对齐 .mask rgba(0,0,0,0.5)),点击遮罩关闭。
 * - 类型零 any;颜色走 @ihui/design-tokens 的 rnLightTokens。
 */
import { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { AgentCategoryItem } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface FenLeiOverlayProps {
  visible: boolean
  onClose: () => void
  /** 赛道列表(agentCategory,首项"全公司" id='';对应接口参数 agentCategory) */
  trackCategories: ReadonlyArray<AgentCategoryItem>
  /** 分类列表(agentMainCategory,首项"全部" id='';对应接口参数 agentMainCategory) */
  mainCategories: ReadonlyArray<AgentCategoryItem>
  /** 当前选中赛道 id(空串 = 全公司) */
  selectedTrackId: string
  /** 当前选中分类 id(空串 = 全部) */
  selectedMainId: string
  /** 确定回调:携带两层选中 id,由调用方刷新智能体列表(对齐 uniapp home() 重载) */
  onConfirm: (trackId: string, mainId: string) => void
}

export function FenLeiOverlay({
  visible,
  onClose,
  trackCategories,
  mainCategories,
  selectedTrackId,
  selectedMainId,
  onConfirm,
}: FenLeiOverlayProps): React.JSX.Element {
  // 弹层内临时选中态(对齐 uniapp fenlei_active / agentCategory_active,确定时才提交)
  const [tempTrackId, setTempTrackId] = useState(selectedTrackId)
  const [tempMainId, setTempMainId] = useState(selectedMainId)

  // 每次打开时同步外部已生效的选中态(对齐 uniapp 重复打开保留上次选择)
  useEffect(() => {
    if (visible) {
      setTempTrackId(selectedTrackId)
      setTempMainId(selectedMainId)
    }
  }, [visible, selectedTrackId, selectedMainId])

  const handleConfirm = (): void => {
    onConfirm(tempTrackId, tempMainId)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* 遮罩(对齐 uniapp .mask rgba(0,0,0,0.5),点击关闭) */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="关闭分类弹层"
        />
        {/* 弹层面板:顶部对齐(对齐 uniapp s_t_b 紧贴导航栏下方下拉) */}
        <View style={styles.panel}>
          {/* 顶部标题(对齐 uniapp tag-head:紫色 #865EFF 居中加粗) */}
          <Text style={styles.headTitle}>分类</Text>
          {/* 赛道横向按钮行(对齐 ScrollTitle informationList=agentCategory,单选) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trackRow}
          >
            {trackCategories.map((item) => {
              const active = tempTrackId === item.id
              return (
                <TouchableOpacity
                  key={item.id || 'all-track'}
                  style={[styles.tagItem, active ? styles.tagItemActive : null]}
                  onPress={() => setTempTrackId(item.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`赛道 ${item.name}`}
                >
                  <Text
                    style={[styles.tagText, active ? styles.tagTextActive : null]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          {/* 分类网格(对齐 fenlei_btn_list_overlay:agentMainCategory 两行网格,单选) */}
          <View style={styles.mainGrid}>
            {mainCategories.map((item) => {
              const active = tempMainId === item.id
              return (
                <TouchableOpacity
                  key={item.id || 'all-main'}
                  style={[styles.tagItem, active ? styles.tagItemActive : null]}
                  onPress={() => setTempMainId(item.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`分类 ${item.name}`}
                >
                  <Text
                    style={[styles.tagText, active ? styles.tagTextActive : null]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {/* 确定按钮(任务要求:选中后确定提交并刷新列表) */}
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="确定"
          >
            <Text style={styles.confirmText}>确定</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

export default FenLeiOverlay

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
  },
  // 面板:顶部下拉全宽(对齐 uniapp s_t_b fixed top + 白底 + 底部边框)
  panel: {
    width: '100%',
    backgroundColor: tokens.surface.light,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  // 标题(对齐 uniapp tag-head:36rpx≈18sp 紫色 #865EFF 加粗居中)
  headTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.purple.DEFAULT,
    textAlign: 'center',
    marginBottom: 10,
  },
  // 赛道行(对齐 uniapp tag-list 横向滚动,gap 20rpx≈10dp)
  trackRow: {
    gap: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  // 分类网格(对齐 uniapp fenlei_btn_list_overlay 换行按钮列表)
  mainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  // 单个标签(对齐 uniapp tag-item:26rpx≈13sp 灰底圆角)
  tagItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  // 选中态(对齐 uniapp fenlei_btn.active / tag-item_active:加边框 + 加粗)
  tagItemActive: {
    borderColor: tokens.brand.DEFAULT,
    backgroundColor: tokens.purple.light,
  },
  tagText: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  tagTextActive: {
    color: tokens.text.primary,
    fontWeight: '600',
  },
  // 确定按钮(品牌色胶囊)
  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  },
})
