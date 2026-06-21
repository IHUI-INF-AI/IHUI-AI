<template>
    <view class="settings-page">
        <SettingsPageLayout title="账号注销/注销说明">
            <view class="content-inner">
                <!-- 浅红提醒区 -->
                <view class="cancel-notice-block">
                    <view class="cancel-notice-title">【重要提醒】账号注销后将无法恢复</view>
                    <view class="cancel-notice-desc">注销后账号内的所有数据将被永久删除，包括但不限于个人信息、资产、订单、内容、会员权益等。</view>
                </view>
                <!-- 注销后果区（结合本平台） -->
                <view class="cancel-consequences-block">
                    <view class="consequences-intro">注销后您将失去以下内容与权益，相关数据将按国家个人信息保护相关法规处理，一经操作无法逆转，请务必仔细阅读并确认：</view>
                    <view class="consequence-item">
                        <text class="item-num">1. 个人信息与账号：</text>昵称、头像、绑定手机号、个人资料等将被<text class="consequence-highlight">永久清除</text>，账号将<text class="consequence-highlight">永久冻结</text>，无法再次登录或复用。
                    </view>
                    <view class="consequence-item">
                        <text class="item-num">2. 会员/VIP 权益：</text>本平台已开通的会员、VIP 及特权将同步终止，剩余有效期<text class="consequence-highlight">不予折现</text>，未使用的会员权益（折扣、专属内容等）<text class="consequence-highlight">全部作废</text>，<text class="consequence-highlight">不予补发</text>、<text class="consequence-highlight">不予退还</text>。
                    </view>
                    <view class="consequence-item">
                        <text class="item-num">3. 账户与资产：</text>账户余额、充值记录将<text class="consequence-highlight">清零</text>，优惠券、积分等未使用权益失效；充值记录<text class="consequence-highlight">永久删除</text>，<text class="consequence-highlight">无法查询</text>。
                    </view>
                    <view class="consequence-item">
                        <text class="item-num">4. 订单与学习：</text>历史订单、购买记录将被<text class="consequence-highlight">永久删除</text>，<text class="consequence-highlight">无法查询</text>、无法补打凭证或办理售后；已购课程、学习进度、笔记等将清空，<text class="consequence-highlight">无法恢复</text>。
                    </view>
                    <view class="consequence-item">
                        <text class="item-num">5. AI 与创作：</text>本平台内 AI 对话记录、创作内容（文章/视频/音频/草稿）、收藏与关注等将<text class="consequence-highlight">永久删除</text>，<text class="consequence-highlight">无法恢复</text>、无法导出。
                    </view>
                    <view class="consequence-item">
                        <text class="item-num">6. 分销与收益：</text>分销推广数据、收益与佣金明细将<text class="consequence-highlight">清零</text>，未提现收益<text class="consequence-highlight">自动作废</text>，绑定关系解除，<text class="consequence-highlight">无法恢复</text>或补办。
                    </view>
                    <view class="consequence-item">
                        <text class="item-num">7. 消息与互动：</text>站内消息、系统通知、评论与回复等将<text class="consequence-highlight">永久清除</text>，<text class="consequence-highlight">无法查询</text>、<text class="consequence-highlight">无法恢复</text>。
                    </view>
                    <view class="consequence-item consequence-remind">
                        <text>提交注销申请后，</text><text>账号将被</text><text class="consequence-highlight">正式、永久注销</text><text>，所有数据将</text><text class="consequence-highlight">彻底清除</text><text>，</text><text class="consequence-highlight">无任何恢复渠道</text><text>。</text>
                    </view>
                    <view class="consequences-footer">
                        <text class="consequence-highlight consequence-highlight-sentence">以上所有内容及权益，一经注销均永久无法恢复，不存在任何补救措施，请您结合自身情况，谨慎决定是否提交注销申请，避免造成不必要的损失。</text>
                    </view>
                </view>
                <!-- 底部操作区（后果区下方，随内容滚动） -->
                <view class="cancel-footer">
                    <view class="footer-confirm-block">
                        <view class="confirm-label confirm-label-highlight">请对照下方文字，在输入框中完整输入以确认：</view>
                        <view class="confirm-ref-text confirm-ref-highlight">{{ confirmSentence }}</view>
                        <input
                            class="confirm-input"
                            type="text"
                            placeholder="请完整输入上方文字"
                            placeholder-class="code-placeholder"
                            v-model="confirmText"
                        />
                        <view v-if="confirmText.length > 0 && !confirmTextMatch" class="confirm-error">输入内容与上方不一致，请核对后重新输入</view>
                        <view v-else-if="confirmTextMatch" class="confirm-ok">✓ 已确认</view>
                    </view>
                    <view class="footer-phone-block" :class="{ disabled: !confirmTextMatch }">
                        <view class="confirm-label">请输入您绑定的手机号（用于校验身份）</view>
                        <input
                            class="confirm-input phone-input"
                            type="number"
                            maxlength="11"
                            placeholder="请输入绑定手机号"
                            placeholder-class="code-placeholder"
                            v-model="inputPhone"
                            :disabled="!confirmTextMatch"
                        />
                        <view v-if="!boundPhone" class="confirm-error">当前未获取到绑定手机号，请确保已登录且账号已绑定手机号</view>
                        <view v-else-if="inputPhone.length > 0 && !phoneMatch" class="confirm-error">输入的手机号与绑定手机号不一致，请核对后重新输入</view>
                        <view v-else-if="phoneMatch" class="confirm-ok">✓ 手机号一致</view>
                    </view>
                    <view class="footer-row">
                        <input
                            class="code-input"
                            type="number"
                            maxlength="6"
                            placeholder="请输入短信验证码"
                            placeholder-class="code-placeholder"
                            v-model="smsCode"
                        />
                        <view
                            class="code-btn"
                            :class="{ disabled: countdown > 0 || !phoneMatch || !confirmTextMatch }"
                            @click="onGetCode"
                        >
                            {{ countdown > 0 ? countdown + 's' : '获取验证码' }}
                        </view>
                    </view>
                    <view
                        class="btn-submit"
                        :class="{ disabled: !canSubmit }"
                        @click="onSubmit"
                    >
                        提交注销申请
                    </view>
                </view>
            </view>
        </SettingsPageLayout>
        <!-- 最后确认弹窗 -->
        <SettingsModal
            :visible="showConfirmModal"
            title="最后确认"
            message="账号注销后所有数据将被永久删除，且无法恢复。您确定要提交注销申请吗？"
            cancelText="取消"
            confirmText="确定注销"
            :confirmDisabledSeconds="5"
            :maskClosable="false"
            @cancel="showConfirmModal = false"
            @confirm="onFinalConfirm"
        />
    </view>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import SettingsPageLayout from './common/SettingsPageLayout.vue'
import SettingsModal from './common/SettingsModal.vue'
import { sendTextMsg, sendTextMsg_new, accountCancel } from '@/service/login.js'
import { useUserStore } from '@/store/modules/user'

const CONFIRM_SENTENCE = '我已仔细阅读并知晓账号注销的所有后果，自愿申请注销账号'
const SMS_TEMP_ID = 2

const userStore = useUserStore()

const boundPhone = ref('')
const inputPhone = ref('')
const confirmSentence = ref(CONFIRM_SENTENCE)
const confirmText = ref('')
const smsCode = ref('')
const countdown = ref(0)
const countdownTimer = ref(null)
const showConfirmModal = ref(false)
const submitting = ref(false)

const phoneMatch = computed(() => {
    const input = (inputPhone.value || '').trim().replace(/\s/g, '')
    const bound = (boundPhone.value || '').trim().replace(/\s/g, '')
    if (!bound) return false
    return input.length >= 11 && input === bound
})

const confirmTextMatch = computed(() => {
    return confirmText.value.trim() === CONFIRM_SENTENCE
})

const canSubmit = computed(() => {
    return phoneMatch.value && confirmTextMatch.value && smsCode.value.trim().length >= 4
})

onLoad(() => {
    const data = uni.getStorageSync('data') || {}
    const fromStorage = data.phone || data.authInfo?.phone || ''
    const fromStore = userStore?.userInfo?.phone || ''
    boundPhone.value = (fromStorage || fromStore || '').trim()
})

onUnload(() => {
    if (countdownTimer.value) {
        clearInterval(countdownTimer.value)
    }
})

async function onGetCode() {
    if (countdown.value > 0) return
    if (!phoneMatch.value) {
        uni.showToast({ title: '请先输入与绑定一致的手机号', icon: 'none' })
        return
    }
    if (!confirmTextMatch.value) {
        uni.showToast({ title: '请先完整输入确认语后再获取验证码', icon: 'none' })
        return
    }
    const phone = (inputPhone.value || '').trim()
    if (!phone || phone.length < 11) {
        uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return
    }
    try {
        await sendTextMsg(phone, SMS_TEMP_ID, '')
        countdown.value = 60
        uni.showToast({ title: '验证码已发送', icon: 'none' })
        countdownTimer.value = setInterval(() => {
            countdown.value--
            if (countdown.value <= 0 && countdownTimer.value) {
                clearInterval(countdownTimer.value)
                countdownTimer.value = null
            }
        }, 1000)
    } catch (e) {
        const msg = e?.data?.msg || e?.data?.message || '发送失败'
        uni.showToast({ title: msg, icon: 'none' })
    }
}

async function onSubmit() {
    if (!phoneMatch.value) {
        uni.showToast({ title: '请输入与绑定一致的手机号', icon: 'none' })
        return
    }
    if (!confirmTextMatch.value) {
        uni.showToast({ title: '请完整输入确认语后再提交', icon: 'none' })
        return
    }
    if (smsCode.value.trim().length < 4) {
        uni.showToast({ title: '请输入短信验证码', icon: 'none' })
        return
    }
    if (!canSubmit.value || submitting.value) return
    submitting.value = true
    const phone = (inputPhone.value || '').trim()
    const code = (smsCode.value || '').trim()
    try {
        const res = await sendTextMsg_new(phone, code)
        const codeNum = res?.data?.code
        const isSuccess = res?.statusCode === 200 && (codeNum === 200 || codeNum === 0 || codeNum === '200')
        if (!isSuccess) {
            const msg = res?.data?.msg || res?.data?.message || '验证码错误，请核对后重试'
            uni.showToast({ title: msg, icon: 'none' })
            submitting.value = false
            return
        }
        showConfirmModal.value = true
    } catch (e) {
        const msg = e?.data?.msg || e?.data?.message || '验证码校验失败，请重试'
        uni.showToast({ title: msg, icon: 'none' })
    } finally {
        submitting.value = false
    }
}

function clearLoginDataSync() {
    try {
        const storageKeys = [
            'token', 'userInfo', 'data', 'accessToken', 'refreshToken',
            'openid', 'openId', 'uuid', 'thirdPartyAccounts', 'authInfo',
            'userMargin', 'isVip', 'vipExpireTime', 'loginState', 'hasLogin',
            'isLoggedIn', 'phone', 'nickname', 'avatar'
        ]
        storageKeys.forEach(key => {
            try { uni.removeStorageSync(key) } catch (err) {}
        })
        try { uni.clearStorageSync() } catch (err) { uni.clearStorage() }
    } catch (err) {}
}

async function onFinalConfirm() {
    showConfirmModal.value = false
    uni.showLoading({ title: '提交中...' })
    try {
        const res = await accountCancel()
        const code = res?.data?.code
        const isSuccess = res?.statusCode === 200 && (code === 200 || code === 0 || code === '200')
        if (!isSuccess) {
            uni.hideLoading()
            const msg = res?.data?.msg || res?.data?.message || '注销失败'
            uni.showToast({ title: msg, icon: 'none' })
            return
        }
        uni.hideLoading()
        try {
            const { clearLoginDataCompletely } = require('@/utils/auth.js')
            clearLoginDataCompletely({ showToast: false, redirectToLogin: false })
        } catch (e) {
            clearLoginDataSync()
        }
        if (userStore) {
            userStore.clearUserData()
        }
        uni.$emit('userLogout')
        uni.$emit('loginStateChanged', false)
        uni.$emit('loginOut')
        uni.showToast({ title: '账号已注销', icon: 'none', duration: 1500 })
        setTimeout(() => {
            uni.reLaunch({ url: '/pages/login-app/login' })
        }, 1500)
    } catch (e) {
        uni.hideLoading()
        const msg = e?.data?.msg || e?.data?.message || '注销失败，请重试'
        uni.showToast({ title: msg, icon: 'none' })
    }
}
</script>

<style lang="scss" scoped>
/* 整页：禁止页面级滚动 */
.settings-page {
    min-height: 100vh;
    background-color: #f5f5f5;
}

.content-inner {
    padding: 24rpx 24rpx 32rpx;
}

/* 浅红提醒区 */
.cancel-notice-block {
    background-color: #fff5f5;
    border: 1rpx solid #ffd4d4;
    border-radius: 16rpx;
    padding: 32rpx 28rpx;
    box-sizing: border-box;
    margin-bottom: 24rpx;
}

.cancel-notice-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #c62828;
    line-height: 1.5;
    margin-bottom: 20rpx;
}

.cancel-notice-desc {
    font-size: 28rpx;
    color: #b71c1c;
    line-height: 1.6;
    opacity: 0.95;
}

/* 注销后果区 */
.cancel-consequences-block {
    background-color: #fff;
    border-radius: 16rpx;
    padding: 28rpx;
    box-sizing: border-box;
    border: 1rpx solid #eee;
}

.consequences-intro {
    font-size: 26rpx;
    color: #333;
    line-height: 1.7;
    margin-bottom: 24rpx;
}

.consequence-item {
    font-size: 26rpx;
    color: #666;
    line-height: 1.8;
    margin-bottom: 20rpx;
}

.consequence-item.consequence-remind {
    margin-top: 8rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid #f0f0f0;
}

.item-num {
    font-weight: 600;
    color: #333;
}

.consequence-highlight {
    color: #c62828;
    font-weight: 600;
}

.consequence-highlight-sentence {
    display: block;
    color: #c62828;
    font-weight: 600;
    font-size: 26rpx;
    line-height: 1.7;
}

.consequences-footer {
    margin-top: 20rpx;
    padding-top: 16rpx;
    border-top: 1rpx solid #f0f0f0;
}

/* 底部操作区（后果区下方，随内容滚动） */
.cancel-footer {
    margin-top: 32rpx;
    padding: 24rpx 0 48rpx;
    padding-bottom: constant(safe-area-inset-bottom);
    padding-bottom: env(safe-area-inset-bottom);
    box-sizing: border-box;
}

.footer-phone-block {
    margin-bottom: 28rpx;
}

.footer-phone-block.disabled {
    opacity: 0.6;
    pointer-events: none;
}

.footer-phone-block.disabled .confirm-input {
    background-color: #f5f5f5;
    color: #999;
}

.footer-phone-block .phone-input {
    margin-bottom: 0;
}

.footer-confirm-block {
    margin-bottom: 28rpx;
}

.confirm-label {
    font-size: 26rpx;
    color: #666;
    margin-bottom: 12rpx;
    line-height: 1.5;
}

.confirm-label.confirm-label-highlight {
    font-size: 28rpx;
    font-weight: 600;
    color: #1565c0;
    background-color: #e3f2fd;
    padding: 16rpx 20rpx;
    border-radius: 8rpx;
    margin-bottom: 16rpx;
}

.confirm-ref-text {
    font-size: 26rpx;
    color: #333;
    line-height: 1.6;
    padding: 16rpx;
    background-color: #f8f8f8;
    border-radius: 12rpx;
    margin-bottom: 16rpx;
    border: 1rpx solid #eee;
}

.confirm-ref-text.confirm-ref-highlight {
    font-size: 28rpx;
    font-weight: 600;
    color: #0d47a1;
    background-color: #e3f2fd;
    border: 2rpx solid #90caf9;
    padding: 20rpx;
}

.confirm-input {
    width: 100%;
    height: 80rpx;
    padding: 0 24rpx;
    font-size: 26rpx;
    color: #333;
    background-color: #fff;
    border: 1rpx solid #ddd;
    border-radius: 12rpx;
    box-sizing: border-box;
}

.confirm-input:focus {
    border-color: #e64340;
}

.confirm-error {
    font-size: 24rpx;
    color: #e64340;
    margin-top: 12rpx;
    line-height: 1.4;
}

.confirm-ok {
    font-size: 24rpx;
    color: #07c160;
    margin-top: 12rpx;
    line-height: 1.4;
}

.footer-row {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 24rpx;
}

.code-input {
    flex: 1;
    height: 80rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    color: #333;
    background-color: #f5f5f5;
    border-radius: 12rpx;
    box-sizing: border-box;
}

.code-placeholder {
    color: #999;
}

.code-btn {
    flex-shrink: 0;
    height: 80rpx;
    padding: 0 28rpx;
    line-height: 80rpx;
    font-size: 26rpx;
    color: #e64340;
    background-color: #fff;
    border: 1rpx solid #e64340;
    border-radius: 12rpx;
}

.code-btn.disabled {
    color: #999;
    border-color: #ddd;
}

.btn-submit {
    height: 88rpx;
    line-height: 88rpx;
    text-align: center;
    font-size: 30rpx;
    color: #fff;
    background-color: #e64340;
    border-radius: 12rpx;
    margin-bottom: 20rpx;
}

.btn-submit.disabled {
    background-color: #ccc;
    color: #fff;
}

.btn-cancel {
    height: 88rpx;
    line-height: 88rpx;
    text-align: center;
    font-size: 30rpx;
    color: #333;
    background-color: #fff;
    border: 1rpx solid #ddd;
    border-radius: 12rpx;
}

</style>
