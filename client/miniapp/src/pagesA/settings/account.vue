<template>
    <view class="settings-page">
        <SettingsPageLayout title="账号管理">
            <view class="content-inner">
                <!-- 头像 -->
                <view class="settings-section">
                    <view class="section-title">头像</view>
                    <view class="section-card">
                        <view class="settings-item settings-item-avatar" @click="onEditAvatar">
                            <view class="avatar-wrap">
                                <image
                                    class="avatar-img"
                                    :src="avatarUrl || '/static/images/daixaodiming.png'"
                                    mode="aspectFill"
                                    @click.stop="onPreviewAvatar"
                                />
                                <view class="avatar-edit-tip" @click.stop="onPreviewAvatar">查看大图</view>
                            </view>
                            <text class="item-hint">点击更换头像</text>
                            <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
                        </view>
                    </view>
                </view>

                <!-- 账号信息 -->
                <view class="settings-section">
                    <view class="section-title">账号信息</view>
                    <view class="section-card">
                        <view class="settings-item" @click="onEditNickname">
                            <text class="item-label">账号昵称</text>
                            <text class="item-value">{{ nickname || '未设置' }}</text>
                            <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
                        </view>
                        <view class="settings-item" @click="onEditPhone">
                            <text class="item-label">手机号</text>
                            <text class="item-value">{{ maskedPhone }}</text>
                            <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
                        </view>
                        <view class="settings-item settings-item-readonly">
                            <text class="item-label">身份</text>
                            <text class="item-value identity-tag" :class="identityClass">{{ identityText }}</text>
                        </view>
                    </view>
                </view>
            </view>
        </SettingsPageLayout>

        <!-- 修改昵称弹窗：使用统一弹窗组件 -->
        <SettingsModal
            :visible="showNicknamePopup"
            title="修改昵称"
            @cancel="closeNicknamePopup"
            @confirm="submitNickname"
        >
            <template #body>
                <input
                    class="settings-modal-input"
                    v-model="editNickname"
                    placeholder="请输入昵称"
                    maxlength="8"
                />
            </template>
        </SettingsModal>
    </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { uploadPictures } from '@/utils/uploadImage.js'
import { bindUserNew } from '@/service/login.js'
import SettingsModal from './common/SettingsModal.vue'
import SettingsPageLayout from './common/SettingsPageLayout.vue'

const avatarUrl = ref('')
const nickname = ref('')
const phone = ref('')
const identityText = ref('普通用户')
const identityClass = ref('identity-normal')
const showNicknamePopup = ref(false)
const editNickname = ref('')

const maskedPhone = computed(() => {
    const p = (phone.value || '').trim()
    if (!p || p.length < 11) return '未绑定'
    return p.slice(0, 3) + '****' + p.slice(-4)
})

function loadUserInfo() {
    const data = uni.getStorageSync('data') || {}
    avatarUrl.value = data.avatar || data.authInfo?.avatar || data.thirdPartyAccounts?.avatar || uni.getStorageSync('avatarPic') || ''
    nickname.value = data.nickname || data.username || data.authInfo?.nickname || data.thirdPartyAccounts?.nickname || ''
    phone.value = data.phone || data.authInfo?.phone || ''
    const isVip = data.isVip !== undefined ? data.isVip : (data.authInfo && data.authInfo.isVip)
    if (isVip === 1) {
        identityText.value = '会员'
        identityClass.value = 'identity-vip'
    } else if (isVip === 2) {
        identityText.value = '操盘手'
        identityClass.value = 'identity-trader'
    } else {
        identityText.value = '普通用户'
        identityClass.value = 'identity-normal'
    }
}

function getUserDataFromResponse(res) {
    if (!res || typeof res !== 'object') return null
    const d = res.data
    if (!d || typeof d !== 'object') return null
    const userData = d.data && typeof d.data === 'object' ? d.data : d
    return userData
}

onLoad(() => {
    loadUserInfo()
})

function onPreviewAvatar() {
    const url = avatarUrl.value || '/static/images/daixaodiming.png'
    const urls = [url]
    uni.previewImage({
        current: url,
        urls
    })
}

function onEditAvatar() {
    uploadPictures(1)
        .then((res) => {
            if (!res || res.length === 0) return
            const avatarBase64 = res[0].base64
            const fileName = res[0].fileName
            const phoneVal = phone.value || ''
            const nicknameVal = nickname.value || ''
            if (!nicknameVal) {
                uni.showToast({ title: '请先设置昵称', icon: 'none' })
                return
            }
            if (!phoneVal || phoneVal.length !== 11) {
                uni.showToast({ title: '请先绑定正确手机号', icon: 'none' })
                return
            }
            uni.showLoading({ title: '保存中...' })
            return bindUserNew(nicknameVal, phoneVal, avatarBase64, fileName)
        })
        .then((res) => {
            uni.hideLoading()
            if (!res || !res.data) return
            const userData = getUserDataFromResponse(res)
            if (!userData) return
            const existing = uni.getStorageSync('data') || {}
            const merged = { ...existing, ...userData }
            if (userData.thirdPartyAccounts) {
                merged.thirdPartyAccounts = { ...existing.thirdPartyAccounts, ...userData.thirdPartyAccounts }
            }
            uni.setStorageSync('data', merged)
            const avatar = merged.thirdPartyAccounts?.avatar || merged.avatar
            if (avatar) {
                uni.setStorageSync('avatarPic', avatar)
                uni.$emit('setAvatarPic', avatar)
            }
            loadUserInfo()
            uni.showToast({ title: '头像已更新', icon: 'success' })
        })
        .catch((err) => {
            uni.hideLoading()
            const msg = (err && err.message) ? err.message : '更换头像失败'
            uni.showToast({ title: msg, icon: 'none', duration: 2000 })
        })
}

function onEditNickname() {
    editNickname.value = nickname.value || ''
    showNicknamePopup.value = true
}

function closeNicknamePopup() {
    showNicknamePopup.value = false
}

function submitNickname() {
    const val = (editNickname.value || '').trim()
    if (!val) {
        uni.showToast({ title: '请输入昵称', icon: 'none' })
        return
    }
    if (val.length > 8) {
        uni.showToast({ title: '昵称不能超过8个字符', icon: 'none' })
        return
    }
    const phoneVal = phone.value || ''
    if (!phoneVal || phoneVal.length !== 11) {
        uni.showToast({ title: '请先绑定正确手机号', icon: 'none' })
        return
    }
    const avatar = avatarUrl.value || ''
    const fileName = ''
    uni.showLoading({ title: '保存中...' })
    bindUserNew(val, phoneVal, avatar, fileName)
        .then((res) => {
            uni.hideLoading()
            if (!res || !res.data) return
            const userData = getUserDataFromResponse(res)
            if (!userData) return
            const existing = uni.getStorageSync('data') || {}
            const merged = { ...existing, ...userData }
            if (userData.thirdPartyAccounts) {
                merged.thirdPartyAccounts = { ...existing.thirdPartyAccounts, ...userData.thirdPartyAccounts }
            }
            uni.setStorageSync('data', merged)
            loadUserInfo()
            showNicknamePopup.value = false
            uni.showToast({ title: '昵称已更新', icon: 'success' })
        })
        .catch((err) => {
            uni.hideLoading()
            const msg = (err && err.message) ? err.message : '修改失败'
            uni.showToast({ title: msg, icon: 'none', duration: 2000 })
        })
}

function onEditPhone() {
    uni.navigateTo({ url: '/pagesA/settings/change-phone' })
}
</script>

<style lang="scss" scoped>
/* 与设置页一致：整页禁止页面级滚动，仅 scroll-view 可滚动 */
.settings-page {
    min-height: 100vh;
    background-color: #f5f5f5;
}

.content-inner {
    padding: 24rpx 24rpx 48rpx;
}

.settings-section {
    margin-bottom: 32rpx;
}

.section-title {
    padding: 0 8rpx 16rpx;
    font-size: 26rpx;
    color: #999;
}

.section-card {
    background-color: #fff;
    border-radius: 16rpx;
    overflow: hidden;

    .settings-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 28rpx 24rpx;
        border-bottom: 1rpx solid #f0f0f0;

        &:last-child {
            border-bottom: none;
        }

        &:active {
            background-color: #f8f8f8;
        }

        .item-label {
            font-size: 30rpx;
            color: #333;
        }

        .item-value {
            font-size: 28rpx;
            color: #666;
            flex: 1;
            text-align: right;
            margin: 0 16rpx;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .arrow-icon {
            width: 24rpx;
            height: 24rpx;
            opacity: 0.5;
            flex-shrink: 0;
        }

        /* 头像行：左侧头像+更换角标，中间提示，右侧箭头 */
        &.settings-item-avatar {
            padding: 32rpx 24rpx;

            .avatar-wrap {
                position: relative;
                width: 120rpx;
                height: 120rpx;
                border-radius: 50%;
                overflow: hidden;
                flex-shrink: 0;
            }

            .avatar-img {
                width: 100%;
                height: 100%;
                display: block;
            }

            .avatar-edit-tip {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 36rpx;
                line-height: 36rpx;
                text-align: center;
                font-size: 22rpx;
                color: #fff;
                background-color: rgba(0, 0, 0, 0.5);
            }

            .item-hint {
                flex: 1;
                font-size: 28rpx;
                color: #999;
                margin-left: 24rpx;
            }

            .arrow-icon {
                margin-left: 16rpx;
            }
        }

        /* 只读行：身份，无箭头，点击无高亮 */
        &.settings-item-readonly {
            &:active {
                background-color: transparent;
            }

            .item-value.identity-tag {
                flex: none;
                padding: 6rpx 16rpx;
                border-radius: 8rpx;
                font-size: 26rpx;

                &.identity-normal {
                    color: #999;
                    background-color: #f5f5f5;
                }

                &.identity-vip {
                    color: #716fff;
                    background-color: #f0eeff;
                }

                &.identity-trader {
                    color: #7ca500;
                    background-color: #f0f8e8;
                }
            }
        }
    }
}

</style>
