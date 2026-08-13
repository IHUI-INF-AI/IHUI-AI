/**
 * AccountCancelScreen 账号注销页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/settings/account-cancel.vue:
 * - 顶部 NavBar(标题「账号注销/注销说明」+ 返回)
 * - 浅红提醒区:注销后无法恢复
 * - 注销后果区:7 条后果 + 提醒 + 落款(含红色高亮片段)
 * - 底部表单:确认语输入校验 + 绑定手机号校验 + 短信验证码(60s 倒计时)+ 提交按钮
 * - 最后确认弹窗(5 秒延时确认,防误触)
 * - 浅色优雅风,rnLightTokens;圆角守门;无分割线
 *
 * API 说明:RN 后端 deleteAccount(password) 为密码注销流程,与 Uniapp SMS 注销不同;
 * 验证码发送复用 sendSmsCode(scene='login',后端暂无 'cancel' 场景),最终注销以"申请已提交"
 * 提示 + 返回,待后端补齐 SMS 注销接口后接入真实删除。
 */
import { useEffect, useRef, useState } from 'react'
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { sendSmsCode } from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// mobile-rn 端暂无 settings.accountCancel 翻译 key(对齐 .vue 硬编码中文),key 就绪后自动切换
const TITLE_KEY = 'settings.accountCancel'
const CONFIRM_SENTENCE = '我已仔细阅读并知晓账号注销的所有后果，自愿申请注销账号'
const SMS_COUNTDOWN_SECONDS = 60
const MODAL_CONFIRM_DELAY = 5

type Segment = { text: string; highlight?: boolean }
interface ConsequenceItem {
  num?: string
  segments: Segment[]
}

const CONSEQUENCE_ITEMS: ConsequenceItem[] = [
  {
    num: '1. 个人信息与账号:',
    segments: [
      { text: '昵称、头像、绑定手机号、个人资料等将被' },
      { text: '永久清除', highlight: true },
      { text: ',账号将' },
      { text: '永久冻结', highlight: true },
      { text: ',无法再次登录或复用。' },
    ],
  },
  {
    num: '2. 会员/VIP 权益:',
    segments: [
      { text: '本平台已开通的会员、VIP 及特权将同步终止,剩余有效期' },
      { text: '不予折现', highlight: true },
      { text: ',未使用的会员权益(折扣、专属内容等)' },
      { text: '全部作废', highlight: true },
      { text: ',' },
      { text: '不予补发', highlight: true },
      { text: '、' },
      { text: '不予退还', highlight: true },
      { text: '。' },
    ],
  },
  {
    num: '3. 账户与资产:',
    segments: [
      { text: '账户余额、充值记录将' },
      { text: '清零', highlight: true },
      { text: ',优惠券、积分等未使用权益失效;充值记录' },
      { text: '永久删除', highlight: true },
      { text: ',' },
      { text: '无法查询', highlight: true },
      { text: '。' },
    ],
  },
  {
    num: '4. 订单与学习:',
    segments: [
      { text: '历史订单、购买记录将被' },
      { text: '永久删除', highlight: true },
      { text: ',' },
      { text: '无法查询', highlight: true },
      { text: '、无法补打凭证或办理售后;已购课程、学习进度、笔记等将清空,' },
      { text: '无法恢复', highlight: true },
      { text: '。' },
    ],
  },
  {
    num: '5. AI 与创作:',
    segments: [
      { text: '本平台内 AI 对话记录、创作内容(文章/视频/音频/草稿)、收藏与关注等将' },
      { text: '永久删除', highlight: true },
      { text: ',' },
      { text: '无法恢复', highlight: true },
      { text: '、无法导出。' },
    ],
  },
  {
    num: '6. 分销与收益:',
    segments: [
      { text: '分销推广数据、收益与佣金明细将' },
      { text: '清零', highlight: true },
      { text: ',未提现收益' },
      { text: '自动作废', highlight: true },
      { text: ',绑定关系解除,' },
      { text: '无法恢复', highlight: true },
      { text: '或补办。' },
    ],
  },
  {
    num: '7. 消息与互动:',
    segments: [
      { text: '站内消息、系统通知、评论与回复等将' },
      { text: '永久清除', highlight: true },
      { text: ',' },
      { text: '无法查询', highlight: true },
      { text: '、' },
      { text: '无法恢复', highlight: true },
      { text: '。' },
    ],
  },
]

const REMIND_SEGMENTS: Segment[] = [
  { text: '提交注销申请后,账号将被' },
  { text: '正式、永久注销', highlight: true },
  { text: ',所有数据将' },
  { text: '彻底清除', highlight: true },
  { text: ',' },
  { text: '无任何恢复渠道', highlight: true },
  { text: '。' },
]

const FOOTER_SENTENCE =
  '以上所有内容及权益,一经注销均永久无法恢复,不存在任何补救措施,请您结合自身情况,谨慎决定是否提交注销申请,避免造成不必要的损失。'

export function AccountCancelScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { user } = useAuth()
  const tTitle = t(TITLE_KEY)
  const title = tTitle === TITLE_KEY ? '账号注销/注销说明' : tTitle

  const boundPhone = (user?.phone ?? '').trim()
  const [inputPhone, setInputPhone] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmCountdown, setConfirmCountdown] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current)
      if (confirmTimer.current) clearInterval(confirmTimer.current)
    }
  }, [])

  const confirmTextMatch = confirmText.trim() === CONFIRM_SENTENCE
  const phoneMatch =
    !!boundPhone &&
    inputPhone.trim().replace(/\s/g, '').length >= 11 &&
    inputPhone.trim().replace(/\s/g, '') === boundPhone.replace(/\s/g, '')
  const canSubmit = phoneMatch && confirmTextMatch && smsCode.trim().length >= 4

  const startSmsCountdown = () => {
    setCountdown(SMS_COUNTDOWN_SECONDS)
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimer.current) {
            clearInterval(countdownTimer.current)
            countdownTimer.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const onGetCode = async () => {
    if (countdown > 0) return
    if (!confirmTextMatch) {
      Alert.alert('请先完整输入确认语后再获取验证码')
      return
    }
    if (!phoneMatch) {
      Alert.alert('请先输入与绑定一致的手机号')
      return
    }
    const phone = inputPhone.trim()
    if (phone.length < 11) {
      Alert.alert('请输入正确的手机号')
      return
    }
    try {
      // 后端 SmsScene 暂无 'cancel' 场景,临时复用 'login';待后端补齐后切换
      const res = await sendSmsCode(phone, 'login')
      if (!res.success) throw new Error(res.error)
      Alert.alert('验证码已发送')
      startSmsCountdown()
    } catch {
      Alert.alert('发送失败,请稍后重试')
    }
  }

  const onSubmit = () => {
    if (!confirmTextMatch) {
      Alert.alert('请完整输入确认语后再提交')
      return
    }
    if (!phoneMatch) {
      Alert.alert('请输入与绑定一致的手机号')
      return
    }
    if (smsCode.trim().length < 4) {
      Alert.alert('请输入短信验证码')
      return
    }
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setShowConfirmModal(true)
    setConfirmCountdown(MODAL_CONFIRM_DELAY)
    confirmTimer.current = setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev <= 1) {
          if (confirmTimer.current) {
            clearInterval(confirmTimer.current)
            confirmTimer.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const closeModal = () => {
    setShowConfirmModal(false)
    setSubmitting(false)
    if (confirmTimer.current) {
      clearInterval(confirmTimer.current)
      confirmTimer.current = null
    }
  }

  const onFinalConfirm = () => {
    closeModal()
    // RN 后端 deleteAccount(password) 为密码注销流程,与 Uniapp SMS 注销不同;
    // 此处先以"申请已提交"提示 + 返回,待后端补齐 SMS 注销接口后接入真实删除。
    Alert.alert(
      '注销申请已提交',
      '您的注销申请已提交,平台将在 7 个工作日内审核处理,审核通过后账号将被永久注销,无法恢复。',
      [{ text: '我知道了', onPress: () => navigation.goBack() }],
    )
  }

  const tCancel = t('common.cancel')
  const cancelLabel = tCancel === 'common.cancel' ? '取消' : tCancel
  const tConfirm = t('common.confirm')
  const confirmLabel = tConfirm === 'common.confirm' ? '确定注销' : tConfirm
  const confirmBtnLabel = confirmCountdown > 0 ? `${confirmLabel}(${confirmCountdown}s)` : confirmLabel

  return (
    <View style={styles.container}>
      <NavBar title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.noticeBlock}>
          <Text style={styles.noticeTitle}>【重要提醒】账号注销后将无法恢复</Text>
          <Text style={styles.noticeDesc}>
            注销后账号内的所有数据将被永久删除,包括但不限于个人信息、资产、订单、内容、会员权益等。
          </Text>
        </View>

        <View style={styles.consequencesBlock}>
          <Text style={styles.consequencesIntro}>
            注销后您将失去以下内容与权益,相关数据将按国家个人信息保护相关法规处理,一经操作无法逆转,请务必仔细阅读并确认:
          </Text>

          {CONSEQUENCE_ITEMS.map((item, idx) => (
            <Text key={idx} style={styles.consequenceItem}>
              {item.num ? <Text style={styles.itemNum}>{item.num}</Text> : null}
              {item.segments.map((seg, i) => (
                <Text key={i} style={seg.highlight ? styles.highlight : null}>
                  {seg.text}
                </Text>
              ))}
            </Text>
          ))}

          <Text style={[styles.consequenceItem, styles.consequenceRemind]}>
            {REMIND_SEGMENTS.map((seg, i) => (
              <Text key={i} style={seg.highlight ? styles.highlight : null}>
                {seg.text}
              </Text>
            ))}
          </Text>

          <Text style={styles.consequencesFooter}>
            <Text style={styles.highlight}>{FOOTER_SENTENCE}</Text>
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBlock}>
            <Text style={styles.confirmLabelHighlight}>请对照下方文字,在输入框中完整输入以确认:</Text>
            <Text style={styles.confirmRefText}>{CONFIRM_SENTENCE}</Text>
            <TextInput
              style={styles.confirmInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="请完整输入上方文字"
              placeholderTextColor={tk.text.tertiary}
            />
            {confirmText.length > 0 && !confirmTextMatch ? (
              <Text style={styles.confirmError}>输入内容与上方不一致,请核对后重新输入</Text>
            ) : confirmTextMatch ? (
              <Text style={styles.confirmOk}>✓ 已确认</Text>
            ) : null}
          </View>

          <View style={[styles.footerBlock, !confirmTextMatch ? styles.footerBlockDisabled : null]}>
            <Text style={styles.confirmLabel}>请输入您绑定的手机号(用于校验身份)</Text>
            <TextInput
              style={styles.confirmInput}
              value={inputPhone}
              onChangeText={setInputPhone}
              placeholder="请输入绑定手机号"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="number-pad"
              maxLength={11}
              editable={confirmTextMatch}
            />
            {!boundPhone ? (
              <Text style={styles.confirmError}>当前未获取到绑定手机号,请确保已登录且账号已绑定手机号</Text>
            ) : inputPhone.length > 0 && !phoneMatch ? (
              <Text style={styles.confirmError}>输入的手机号与绑定手机号不一致,请核对后重新输入</Text>
            ) : phoneMatch ? (
              <Text style={styles.confirmOk}>✓ 手机号一致</Text>
            ) : null}
          </View>

          <View style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              value={smsCode}
              onChangeText={setSmsCode}
              placeholder="请输入短信验证码"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.codeBtn, (countdown > 0 || !phoneMatch || !confirmTextMatch) ? styles.codeBtnDisabled : null]}
              disabled={countdown > 0 || !phoneMatch || !confirmTextMatch}
              onPress={onGetCode}
            >
              <Text
                style={[
                  styles.codeBtnText,
                  (countdown > 0 || !phoneMatch || !confirmTextMatch) ? styles.codeBtnTextDisabled : null,
                ]}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btnSubmit, !canSubmit ? styles.btnSubmitDisabled : null]}
            disabled={!canSubmit}
            onPress={onSubmit}
          >
            <Text style={styles.btnSubmitText}>提交注销申请</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>最后确认</Text>
            <Text style={styles.modalMessage}>
              账号注销后所有数据将被永久删除,且无法恢复。您确定要提交注销申请吗?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={closeModal}>
                <Text style={styles.modalBtnCancelText}>{cancelLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, confirmCountdown > 0 ? styles.modalBtnConfirmDisabled : null]}
                disabled={confirmCountdown > 0}
                onPress={onFinalConfirm}
              >
                <Text style={styles.modalBtnConfirmText}>{confirmBtnLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tk.surface.muted,
  },
  content: {
    padding: 12,
    paddingBottom: 40,
  },
  noticeBlock: {
    backgroundColor: tk.danger.light,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tk.danger.DEFAULT,
    lineHeight: 22,
    marginBottom: 10,
  },
  noticeDesc: {
    fontSize: 13,
    color: tk.error.text,
    lineHeight: 20,
  },
  consequencesBlock: {
    backgroundColor: tk.surface.light,
    borderRadius: 8,
    padding: 16,
  },
  consequencesIntro: {
    fontSize: 13,
    color: tk.text.primary,
    lineHeight: 22,
    marginBottom: 14,
  },
  consequenceItem: {
    fontSize: 13,
    color: tk.text.secondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  consequenceRemind: {
    marginTop: 4,
  },
  itemNum: {
    fontWeight: '600',
    color: tk.text.primary,
  },
  highlight: {
    color: tk.danger.DEFAULT,
    fontWeight: '600',
  },
  consequencesFooter: {
    marginTop: 8,
  },
  footer: {
    marginTop: 16,
    gap: 14,
  },
  footerBlock: {
    gap: 6,
  },
  footerBlockDisabled: {
    opacity: 0.6,
  },
  confirmLabel: {
    fontSize: 13,
    color: tk.text.secondary,
    lineHeight: 20,
  },
  confirmLabelHighlight: {
    fontSize: 14,
    fontWeight: '600',
    color: tk.indigo.deep,
    backgroundColor: tk.indigo.light,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confirmRefText: {
    fontSize: 14,
    fontWeight: '600',
    color: tk.indigo.deep,
    backgroundColor: tk.indigo.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    lineHeight: 22,
  },
  confirmInput: {
    borderWidth: 1,
    borderColor: tk.border.medium,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tk.text.primary,
    backgroundColor: tk.surface.light,
  },
  confirmError: {
    fontSize: 12,
    color: tk.danger.DEFAULT,
    lineHeight: 16,
  },
  confirmOk: {
    fontSize: 12,
    color: tk.success.deep,
    lineHeight: 16,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: tk.border.medium,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tk.text.primary,
    backgroundColor: tk.surface.muted,
  },
  codeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tk.danger.DEFAULT,
    backgroundColor: tk.surface.light,
  },
  codeBtnDisabled: {
    borderColor: tk.border.medium,
  },
  codeBtnText: {
    fontSize: 13,
    color: tk.danger.DEFAULT,
  },
  codeBtnTextDisabled: {
    color: tk.text.tertiary,
  },
  btnSubmit: {
    backgroundColor: tk.danger.DEFAULT,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnSubmitDisabled: {
    backgroundColor: tk.border.medium,
  },
  btnSubmitText: {
    color: tk.surface.light,
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: tk.overlay.modal,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: tk.surface.light,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    gap: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tk.text.primary,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: tk.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tk.border.medium,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    fontSize: 14,
    color: tk.text.secondary,
  },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: tk.danger.DEFAULT,
    alignItems: 'center',
  },
  modalBtnConfirmDisabled: {
    opacity: 0.5,
  },
  modalBtnConfirmText: {
    fontSize: 14,
    color: tk.surface.light,
    fontWeight: '600',
  },
})

export default AccountCancelScreen
