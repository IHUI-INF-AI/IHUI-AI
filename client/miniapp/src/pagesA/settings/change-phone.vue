<template>
    <view class="settings-page">
        <SettingsPageLayout title="更换手机号">
            <view class="content-inner">
                <!-- 说明区 -->
                <view class="intro-block">
                    <view class="intro-title">更换说明</view>
                    <view class="intro-desc">为保障账号安全，需先验证当前绑定的手机号，再绑定新号码；流程简单，几步即可完成。</view>
                </view>

                <!-- 第一步：验证当前手机号（未通过时只显示本步） -->
                <view class="form-block" v-if="step === 1">
                    <view class="form-section">
                        <view class="section-label">1. 验证当前手机号</view>
                        <view class="phone-display">{{ maskedPhone }}</view>
                        <view class="footer-row">
                            <input
                                class="code-input"
                                type="number"
                                maxlength="6"
                                placeholder="请输入当前手机号收到的验证码"
                                placeholder-class="code-placeholder"
                                v-model="oldCode"
                            />
                            <view
                                class="code-btn"
                                :class="{ disabled: oldCountdown > 0 }"
                                @click="onGetOldCode"
                            >
                                {{ oldCountdown > 0 ? oldCountdown + 's' : '获取验证码' }}
                            </view>
                        </view>
                    </view>
                    <view
                        class="btn-submit"
                        :class="{ disabled: !canVerifyOld }"
                        @click="onVerifyOld"
                    >
                        下一步
                    </view>
                </view>

                <!-- 第二步：绑定新手机号（当前手机号验证通过后显示） -->
                <view class="form-block" v-if="step === 2">
                    <view class="step-done-tip">当前手机号 {{ maskedPhone }} 已通过验证</view>
                    <view class="form-section">
                        <view class="section-label">2. 绑定新手机号</view>
                        <view class="footer-row">
                            <input
                                class="code-input phone-input"
                                type="number"
                                maxlength="11"
                                placeholder="请输入新手机号"
                                placeholder-class="code-placeholder"
                                v-model="newPhone"
                            />
                        </view>
                        <view class="footer-row">
                            <input
                                class="code-input"
                                type="number"
                                maxlength="6"
                                placeholder="请输入新手机号收到的验证码"
                                placeholder-class="code-placeholder"
                                v-model="newCode"
                            />
                            <view
                                class="code-btn"
                                :class="{ disabled: newCountdown > 0 }"
                                @click="onGetNewCode"
                            >
                                {{ newCountdown > 0 ? newCountdown + 's' : '获取验证码' }}
                            </view>
                        </view>
                    </view>
                    <view
                        class="btn-submit"
                        :class="{ disabled: !canSubmitNew }"
                        @click="onSubmit"
                    >
                        确认更换
                    </view>
                </view>

                <!-- 底部提示：更换后的影响 -->
                <view class="notice-block">
                    <view class="notice-title">【更换后影响】</view>
                    <view class="notice-desc">更换成功后，登录、找回密码、消息通知等将使用新手机号；旧手机号将无法再用于本账号登录，请确认后再操作。</view>
                </view>
            </view>
        </SettingsPageLayout>
    </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { sendTextMsg, sendTextMsg_new, editPhone, pwdExist } from '@/service/login.js'
import SettingsPageLayout from './common/SettingsPageLayout.vue'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const currentPhone = ref('')
const oldCode = ref('')
const newPhone = ref('')
const newCode = ref('')
const oldCountdown = ref(0)
const newCountdown = ref(0)
const oldTimer = ref(null)
const newTimer = ref(null)
const step = ref(1)

const maskedPhone = computed(() => {
    const p = (currentPhone.value || '').trim()
    if (!p || p.length < 11) return '未绑定'
    return p
})

const canVerifyOld = computed(() => {
    return oldCode.value.trim().length === 6
})

const canSubmitNew = computed(() => {
    return (
        /^1\d{10}$/.test((newPhone.value || '').trim()) &&
        (newCode.value || '').trim().length === 6
    )
})

function loadCurrentPhone() {
    const data = uni.getStorageSync('data') || {}
    const fromStorage = data.phone || data.authInfo?.phone || ''
    const fromStore = userStore?.userInfo?.phone || ''
    currentPhone.value = fromStorage || fromStore || ''
}

onLoad(() => {
    loadCurrentPhone()
})

onUnload(() => {
    if (oldTimer.value) clearInterval(oldTimer.value)
    if (newTimer.value) clearInterval(newTimer.value)
})

async function onGetOldCode() {
    if (oldCountdown.value > 0) return
    const p = (currentPhone.value || '').trim()
    if (!p || p.length < 11) {
        uni.showToast({ title: '当前未绑定手机号', icon: 'none' })
        return
    }
    try {
        await sendTextMsg(p, 2, '')
        oldCountdown.value = 60
        if (oldTimer.value) clearInterval(oldTimer.value)
        oldTimer.value = setInterval(() => {
            oldCountdown.value--
            if (oldCountdown.value <= 0 && oldTimer.value) {
                clearInterval(oldTimer.value)
                oldTimer.value = null
            }
        }, 1000)
        uni.showToast({ title: '验证码已发送', icon: 'none' })
    } catch (e) {
        const msg = e?.data?.msg || e?.data?.message || '发送失败'
        uni.showToast({ title: msg, icon: 'none' })
    }
}

function onVerifyOld() {
    if (!canVerifyOld.value) {
        uni.showToast({ title: '请输入6位验证码', icon: 'none' })
        return
    }
    uni.showToast({ title: '验证通过', icon: 'success' })
    step.value = 2
}

async function onGetNewCode() {
    if (newCountdown.value > 0) return
    const phone = (newPhone.value || '').trim()
    if (!/^1\d{10}$/.test(phone)) {
        uni.showToast({ title: '请先输入正确的新手机号', icon: 'none' })
        return
    }
    try {
        const exist = await pwdExist(phone)
        if (exist) {
            uni.showToast({ title: '该手机号已注册，请换用其他手机号', icon: 'none' })
            return
        }
        await sendTextMsg(phone, 2, '')
        newCountdown.value = 60
        if (newTimer.value) clearInterval(newTimer.value)
        newTimer.value = setInterval(() => {
            newCountdown.value--
            if (newCountdown.value <= 0 && newTimer.value) {
                clearInterval(newTimer.value)
                newTimer.value = null
            }
        }, 1000)
        uni.showToast({ title: '验证码已发送', icon: 'none' })
    } catch (e) {
        const msg = e?.data?.msg || e?.data?.message || '发送失败'
        uni.showToast({ title: msg, icon: 'none' })
    }
}

async function onSubmit() {
    if (!canSubmitNew.value) {
        if (!/^1\d{10}$/.test((newPhone.value || '').trim())) {
            uni.showToast({ title: '请输入正确的新手机号', icon: 'none' })
            return
        }
        if ((newCode.value || '').trim().length !== 6) {
            uni.showToast({ title: '请输入6位验证码', icon: 'none' })
            return
        }
        return
    }
    const newPhoneVal = (newPhone.value || '').trim()
    const newCodeVal = (newCode.value || '').trim()
    const uuid = uni.getStorageSync('data')?.uuid || userStore?.userInfo?.userId || ''
    if (!uuid) {
        uni.showToast({ title: '未获取到用户信息，请重新登录', icon: 'none' })
        return
    }
    uni.showLoading({ title: '提交中...' })
    try {
        const verifyRes = await sendTextMsg_new(newPhoneVal, newCodeVal)
        const verifyData = verifyRes?.data?.data ?? verifyRes?.data ?? null
        if (!verifyData) {
            uni.hideLoading()
            uni.showToast({ title: '验证码校验失败', icon: 'none' })
            return
        }
        const res = await editPhone(newPhoneVal, uuid, verifyData)
        uni.hideLoading()
        const resData = res?.data
        const code = resData?.code
        if (code !== 200 && code !== '200') {
            uni.showToast({ title: resData?.msg || '更换失败', icon: 'none' })
            return
        }
        const resultData = resData?.data || null
        if (resultData) {
            try {
                uni.setStorageSync('data', resultData)
                uni.setStorageSync('avatarPic', resultData.avatar || '')
                const token = resultData.thirdPartyAccounts?.accessToken || ''
                if (token) uni.setStorageSync('token', token)
                if (resultData.thirdPartyAccounts?.refreshToken) {
                    uni.setStorageSync('refreshToken', resultData.thirdPartyAccounts.refreshToken)
                }
                if (userStore) {
                    userStore.setUserInfo({
                        userId: resultData.uuid,
                        username: resultData.authInfo?.username,
                        nickName: resultData.nickname,
                        avatarUrl: resultData.avatar,
                        isVip: resultData.isVip,
                        vipExpireTime: resultData.vipExpireTime,
                        phone: resultData.authInfo?.phone
                    })
                }
                uni.$emit('loginSuccess', resultData)
            } catch (e) {}
        }
        uni.showToast({ title: '更换成功', icon: 'success' })
        setTimeout(() => {
            uni.navigateBack({ delta: 1 })
        }, 800)
    } catch (e) {
        uni.hideLoading()
        const msg = e?.data?.msg || e?.data?.message || '操作失败'
        uni.showToast({ title: msg, icon: 'none' })
    }
}
</script>

<style lang="scss" scoped>
.settings-page {
    min-height: 100vh;
    background-color: #f5f5f5;
}

.content-inner {
    padding: 24rpx 24rpx 32rpx;
}

/* 说明区 */
.intro-block {
    background-color: #fff;
    border-radius: 16rpx;
    padding: 28rpx;
    margin-bottom: 24rpx;
    border: 1rpx solid #eee;
    box-sizing: border-box;
}

.intro-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 16rpx;
}

.intro-desc {
    font-size: 26rpx;
    color: #666;
    line-height: 1.6;
}

/* 核心操作区 */
.form-block {
    background-color: #fff;
    border-radius: 16rpx;
    padding: 28rpx;
    margin-bottom: 24rpx;
    border: 1rpx solid #eee;
    box-sizing: border-box;
}

.form-section {
    margin-bottom: 32rpx;
}

.form-section:last-of-type {
    margin-bottom: 24rpx;
}

.step-done-tip {
    font-size: 26rpx;
    color: #07c160;
    margin-bottom: 24rpx;
    padding: 16rpx 0;
}

.section-label {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 16rpx;
}

.phone-display {
    font-size: 30rpx;
    color: #333;
    margin-bottom: 16rpx;
    letter-spacing: 2rpx;
}

.footer-row {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 20rpx;
}

.footer-row:last-child {
    margin-bottom: 0;
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

.code-input.phone-input {
    flex: 1;
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
    color: #07c160;
    background-color: #fff;
    border: 1rpx solid #07c160;
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
    background-color: #07c160;
    border-radius: 12rpx;
    margin-top: 8rpx;
}

.btn-submit.disabled {
    background-color: #ccc;
    color: #fff;
}

/* 底部提示：更换后影响 */
.notice-block {
    background-color: #f0f9f4;
    border: 1rpx solid #b8e6cf;
    border-radius: 16rpx;
    padding: 28rpx;
    box-sizing: border-box;
}

.notice-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #07c160;
    margin-bottom: 12rpx;
}

.notice-desc {
    font-size: 26rpx;
    color: #333;
    line-height: 1.6;
}
</style>
