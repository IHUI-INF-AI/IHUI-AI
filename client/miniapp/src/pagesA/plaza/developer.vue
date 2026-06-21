<template>
    <view>
        <navigation-bars color="black" :viscosity="true" :showBack="false" title="开发者详情" @pack="backPage"
            style="width: 100%;" :image="'https://file.aizhs.top/sys-mini/default/back.svg'" />
        <view class="page_body">
            <Cover v-if="entry" @go="hasPay" :userInfo="userInfo"></Cover>
            <Loading v-if="loading"></Loading>
            <view class="header_card m_b20">
                <view class="header_card_logo_body">
                    <image class="header_card-logo"
                        :src="userInfo.avatar ? userInfo.avatar : 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'" mode="aspectFill" />
                </view>
                <view class="user_name m_b16">{{ userInfo.nickname }}</view>

                <view class="watting" v-if="waitting">专属开发者空间开通中......</view>
                <view class="watting_sub" v-if="waitting">进度查询请加入社区联系工作人员</view>
                <!-- 不是开发者 developerLink -->
                <view class="to_entry f_c" v-if="!userInfo.developerLink" @click="topay">
                    <text>成为开发者</text>
                </view>
            </view>
            <view class="dev_list m_b18">
                <view class="dev_item" @click.stop="toMyModel">
                    <view class="icon_body">
                        <image class="my_model" src="https://file.aizhs.top/sys-mini/xtk/my_model.png" mode="widthFix"
                            lazy-load="false"></image>
                    </view>
                    <view class="text">我的智能体</view>
                </view>
                <view class="dev_item" @click.stop="toModelIncome">
                    <view class="icon_body">
                        <image class="my_pay" src="https://file.aizhs.top/sys-mini/xtk/my_input.png" mode="widthFix"
                            lazy-load="false"></image>
                    </view>
                    <view class="text">智能体收入</view>
                </view>
                <view class="dev_item" @click.stop="toNbnModel">
                    <view class="icon_body">
                        <image class="my_pay" src="https://file.aizhs.top/sys-mini/default/n8n.png" mode="widthFix"
                            lazy-load="false"></image>
                    </view>
                    <view class="text">n8n智能体</view>
                </view>
            </view>

            <view class="developer_info_body m_b20" v-if="developer && !expire">
                <view class="developer_info">
                    <view class="info_item">
                        <view class="font_hold">账号：{{ developer.signNickname }}</view>
                        <image class="icon_copy" @click="copyText(developer.signNickname)"
                            src="https://file.aizhs.top/sys-mini/xtk/dev_copy.png" mode="widthFix" lazy-load="false" />
                    </view>
                    <view class="info_item">
                        <view class="font_hold">秘密：{{ developer.signPassword }}</view>
                        <image class="icon_copy" @click="copyText(developer.signPassword)"
                            src="https://file.aizhs.top/sys-mini/xtk/dev_copy.png" mode="widthFix" lazy-load="false" />
                    </view>
                    <view class="info_item">
                        <view class="font_hold">网址：{{ developer.address || '无' }}</view>
                        <image class="icon_copy" @click="copyText(developer.address)"
                            src="https://file.aizhs.top/sys-mini/xtk/dev_copy.png" mode="widthFix" lazy-load="false" />
                    </view>
                    <view class="info_item">
                        <view class="font_hold" style="color: #FF7272;">到期时间：{{ userInfo.developerLink.expiresAtStr || '-'
                            }}</view>
                        <view class="re_new f_c" @click="renew">
                            <text>续费</text>
                        </view>
                    </view>
                </view>
            </view>
            <view class="s_tip m_b16" v-if="developer && !expire">开发者须知</view>
            <view class="to_plaza f_c" @click="toPlaza" v-if="developer && !expire">
                <text>继续接单</text>
            </view>

            <view class="un_developer" v-if="!userInfo.developerLink || waitting">
                <view class="title m_b18">相关开发者的一系列问题解答？</view>
                <view class="und_cards">
                    <view class="und_card_item" v-for="(item, index) in problems" :key="index" @click="toWeb(item.url)">
                        <view class="title m_b18">{{ item.title }}</view>
                        <view class="context" style="margin-bottom: 24rpx;">{{ item.context }}</view>
                        <view class="btn">{{ item.btn }}</view>
                    </view>
                    <view class="big_btn" @click="showCode">
                        <view class="top">其他问题？</view>
                        <view class="bot">咨询你的团长，获得多对一在线答疑 </view>
                    </view>
                </view>
            </view>

            <view class="bo_mask" v-if="expireShow" @click="() => { expireShow = false }"></view>
            <view class="w_b" v-if="expireShow">
                <view class="title_body m_b16">
                    <image class="Welcome" src="https://file.aizhs.top/sys-mini/xtk/Welcome.png" mode="widthFix"
                        lazy-load="false"></image>
                    <image class="iHuiInfAI" src="https://file.aizhs.top/sys-mini/xtk/iHuiInfAI.png" mode="widthFix"
                        lazy-load="false"></image>
                </view>
                <image class="header_card-logo m_b8"
                    :src="userInfo.avatar ? userInfo.avatar : 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'"
                    mode="aspectFill" />
                <view class="user_name m_b8"> | {{ userInfo.nickname }}</view>
                <view class="logo_text m_b8">80万AI应用需求用户等您开发</view>
                <view class="btn_body m_b8">
                    <view class="bg_image" :class="{ 'bg_im_selected': devPayType == 'month' }"
                        @click="() => { devPayType = 'month' }">
                        <view class="title">开发者包月</view>
                        <view class="price">{{ price.month || 100 }} / 月</view>
                    </view>
                    <image class="image_or" src="https://file.aizhs.top/sys-mini/xtk/image_or.png" mode="widthFix" />
                    <view class="bg_image" :class="{ 'bg_im_selected': devPayType == 'year' }"
                        @click="() => { devPayType = 'year' }">
                        <view class="title">开发者包年</view>
                        <view class="price">{{ price.year || 1000 }} / 年</view>
                    </view>
                </view>
                <view class="sub_title f_c m_b16">开发者须知</view>
                <view class="sub_btn f_c" @click.stop="payForDev">开通/续费</view>
            </view>
            <BottomPops :isShow="isShow" @close="() => { isShow = false }">
                <template v-slot:center>
                    <view style="display: flex; justify-content: center; align-items: center">
                        <image :src="erweima" show-menu-by-longpress="true" mode="widthFix"
                            style="width: 400rpx;margin-bottom: 10rpx;" />
                    </view>
                    <view class="qrcode-footer">
                        <view class="qrcode-title">我的分享二维码</view>
                        <view class="qrcode-copyright-row">
                            <view class="qrcode-copyright-text">
                                COPYRIGHT © 2025-2035 IHUIINF AGI<br />
                                ALL RIGHTS RESERVED.
                            </view>
                        </view>
                        <view class="qrcode-divider"></view>
                        <button class="qrcode-share-btn" open-type="share">分享给好友</button>
                        <view class="qrcode-save-text" @click="handleSave">保存到相册</view>
                    </view>
                </template>
            </BottomPops>
        </view>
    </view>
</template>
<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavigationBars from "@/components/navigation-bars/index.vue";
import { getDevInfo } from '@/service/aiModels.js'
import { pay } from "@/utils/pay/index.js";
import Cover from './cover.vue'
import Loading from "@/components/loading/index.vue";
import BottomPops from "@/components/bottom-pops/index.vue";
import { getWxCode } from "@/service/trader.js";

const expire = ref(false)
const entry = ref(false)
const price = reactive({ month: '', year: '' })
const real_price = reactive({ month: 0, year: 0 })
const ids = reactive({ month: '', year: '' })
const devPayType = ref('year')
const userInfo = ref({})
const problems = [
    {
        url: 'https://blurb.kou.aizhs.top/shangchuan.html', title: '智能体如何上传智汇社？',
        context: '将你的扣子智能体发布到AI智汇社，让移动端APP、微信小程序都可以使用。', btn: '点击查询上传流程 >'
    },
    {
        url: 'https://blurb.kou.aizhs.top/kecheng.html', title: '零基础如何进行智能体开发？',
        context: '将你的扣子智能体发布到AI智汇社，让移动端APP、微信小程序都可以使用。', btn: '了解基础课程 >'
    },
    {
        url: 'https://blurb.kou.aizhs.top/bianxian.html', title: '如何变现？',
        context: 'AI智汇社是目前唯一智能体开发者变现平台，用户订阅智能体开发者获得分成 ', btn: '了解变现策略 >'
    },
    {
        url: 'https://blurb.kou.aizhs.top/zhihuishe.html', title: 'AI智汇社区能做什么？',
        context: '了解AI智汇社的所有功能和作用，利用好AI智汇社资源，取得商业成功。', btn: '了解AI智汇社 >'
    },
]
const expireShow = ref(false)
const loading = ref(false)
const waitting = ref(false)
const isShow = ref(false)
const erweima = ref('')

const developer = computed(() => {
    return (userInfo.value.developerLink && userInfo.value.developerLink.developer) ? userInfo.value.developerLink.developer : false
})

userInfo.value = uni.getStorageSync("data")
if (userInfo.value.developerLink && userInfo.value.developerLink.expiresAt) {
    const time = userInfo.value.developerLink.expiresAt * 1000
    const now = new Date().getTime()
    if (now > time) {
        expire.value = true
    } else {
        expire.value = false
    }
} else {
    expire.value = false
}

onMounted(() => {
    if (!developer.value && (userInfo.value.developerLink.type == 1)) {
        waitting.value = true
    } else {
        waitting.value = false
    }
    uni.$on('user-info-updated', refreshUserInfo)
    getDevInfo().then(res => {
        res.data.forEach(item => {
            if (item.remark == '月费开发者') {
                price.month = (item.amount / 100).toFixed(0)
                real_price.month = item.amount
                ids.month = item.id
            }
            if (item.remark == '年费开发者') {
                price.year = (item.amount / 100).toFixed(0)
                real_price.year = item.amount
                ids.year = item.id
            }
        })
    })
    getWxCodeFn()
})

onShow(() => {
    const pages = getCurrentPages()
    const app = getApp()
    app.globalData.developAdmin = 'developer'
})

onBeforeUnmount(() => {
    uni.$off('user-info-updated', refreshUserInfo)
})

function renew() {
    expireShow.value = true
}

function toPlaza() {
    uni.navigateTo({
        url: `/pagesA/plaza/index?from=dev`
    })
}

function toWeb(url) {
    uni.setClipboardData({
        data: url,
        success: () => {
            uni.showToast({
                title: '已复制链接，请粘贴到浏览器进行浏览',
                icon: 'none'
            });
        },
        fail: () => {
            uni.showToast({
                title: '复制失败',
                icon: 'none'
            });
        }
    });
}

function refreshUserInfo() {
    try {
        const userData = uni.getStorageSync('data');
        if (userData) {
            userInfo.value = userData;
        }
    } catch (e) {
    }
}

function topay() {
    entry.value = true
}

function hasPay() {
    entry.value = false
}

function payForDev() {
    if (devPayType.value == 'month') {
        pay("", real_price.month, ids.month, 1, 3).then(res => {
            if (res) {
                entry.value = false
            }
        })
    } else {
        pay("", real_price.year, ids.year, 1, 3).then(res => {
            if (res) {
                entry.value = false
            }
        })
    }
}

function copyText(data) {
    uni.setClipboardData({
        data,
        success: () => {
            uni.showToast({
                title: '已复制',
                icon: 'none'
            });
        },
        fail: () => {
            uni.showToast({
                title: '复制失败',
                icon: 'none'
            });
        }
    });
}

function showCode() {
}

function handleSave() {
    uni.getSetting({
        success: (res) => {
            const authState = res.authSetting['scope.writePhotosAlbum'];

            if (authState === false) {
                uni.showModal({
                    title: '提示',
                    content: '需要您授权保存到相册的权限',
                    confirmText: '去设置',
                    cancelText: '取消',
                    success: (res) => {
                        if (res.confirm) {
                            uni.openSetting();
                        }
                    }
                });
            } else if (authState === true) {
                saveClick();
            } else {
                uni.authorize({
                    scope: 'scope.writePhotosAlbum',
                    success: () => {
                        saveClick();
                    },
                    fail: () => {
                        uni.showToast({
                            title: '您拒绝了授权',
                            icon: 'none'
                        });
                    }
                });
            }
        }
    });
}

function saveClick() {
    loading.value = true;
    const { inviteCode } = uni.getStorageSync("data");
    getWxCode(inviteCode, 1).then((res) => {
        let erweimaData = res;
        const base64Data = erweimaData.split(',')[1];
        const fs = uni.getFileSystemManager();
        const tempFilePath = `${wx.env.USER_DATA_PATH}/qrcode_${new Date().getTime()}.png`;

        try {
            fs.writeFileSync(tempFilePath, base64Data, 'base64');

            uni.saveImageToPhotosAlbum({
                filePath: tempFilePath,
                success: () => {
                    isShow.value = false;
                    uni.showToast({
                        title: "保存成功",
                        icon: "success",
                    });
                },
                fail: (err) => {
                    isShow.value = false;
                    uni.showToast({
                        title: "保存失败",
                        icon: "none",
                    });
                },
                complete: () => {
                    loading.value = false;
                }
            });
        } catch (error) {
            uni.showToast({
                title: "保存失败",
                icon: "none",
            });
            loading.value = false;
        }
    });
}

function getWxCodeFn() {
    const { inviteCode } = uni.getStorageSync("data");
    getWxCode(inviteCode).then((res) => {
        erweima.value = res;
    });
}

function toMyModel() {
    uni.navigateTo({
        url: '/pagesA/dev_enter/index',
    })
}

function toNbnModel() {
    uni.navigateTo({
        url: '/pagesA/dev_enter/nbn_model',
    })
}

function toModelIncome() {
    uni.navigateTo({
        url: '/pagesA/dev_enter/model_income',
    })
}

function backPage() {
    uni.navigateBack({
        delta: 1,
    });
}
</script>
<style lang="scss" scoped>
.page_body {
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    padding: 0 32rpx;
    color: #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
}

.bo_mask {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 990;
}

.w_b {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 996;
    height: 636rpx;
    border-radius: 69rpx 69rpx 0px 0px;
    background: rgba(0, 26, 255, 0.08);
    box-shadow: 0rpx -6rpx 20rpx 0px rgba(255, 255, 255, 1);
    box-sizing: border-box;
    padding: 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;

    .title_body {
        display: flex;
        align-items: flex-end;
        box-sizing: border-box;
        padding-top: 24rpx;
    }

    .Welcome {
        width: 410rpx;
        height: 67rpx;
        margin-right: 15rpx;
    }

    .iHuiInfAI {
        width: 281rpx;
        height: 40rpx;
    }

    .logo_text {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 30rpx;
        font-weight: bold;
        letter-spacing: 0.29em;
        color: #8F81FF;
    }

    .sub_title {
        font-family: Silkscreen;
        font-size: 20rpx;
        font-weight: normal;
        color: #86AEFF;
    }

    .sub_btn {
        background: linear-gradient(268deg,
                rgba(217, 219, 254, 0.65) -208%,
                rgba(217, 219, 254, 0.65) -149%,
                rgba(217, 219, 255, 0.65) -123%,
                rgba(217, 219, 254, 0.65) -33%,
                rgba(217, 219, 255, 0.65) -18%,
                rgba(144, 125, 255, 0.65) 218%,
                rgba(224, 225, 252, 0.65) 303%);
        border-radius: 15rpx;
        width: 230rpx;
        height: 86rpx;
        box-sizing: border-box;
        box-shadow: inset 0rpx -6rpx 20rpx 0rpx rgba(255, 255, 255, 0.8);
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 36rpx;
        font-weight: bold;
        color: #FFFFFF;
    }
}

.user_name {
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 30rpx;
    font-weight: bold;
    color: #000000;
}

.btn_body {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    justify-content: space-between;
    align-items: center;

    .bg_image {
        width: calc(50vw - 76rpx);
        height: 144rpx;
        background-image: url('https://file.aizhs.top/sys-mini/xtk/dev_pay_boder_nomal.png');
        background-size: 100% 100%;
        box-sizing: border-box;
        position: relative;
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 30rpx;
        font-weight: 600;
        letter-spacing: 0.28em;
        color: #000000;

        .title {
            margin: 24rpx 0 0 16rpx;
        }

        .price {
            position: absolute;
            right: 18rpx;
            bottom: 24rpx;
        }
    }

    .image_or {
        width: 92rpx;
        height: 40rpx;
    }
}

.qrcode-footer {
    text-align: center;
}

.qrcode-title {
    font-size: 28rpx;
    color: #666666;
    margin-bottom: 11rpx;
}

.qrcode-copyright-row {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8rpx;
}

.qrcode-logo {
    width: 71rpx;
    height: 47rpx;
    margin-right: 16rpx;
}

.qrcode-copyright-text {
    font-size: 16rpx;
    color: rgba(0, 0, 0, 0.4);
    font-family: 'Consolas', 'monospace';
    text-align: center;
}

.qrcode-divider {
    height: 2rpx;
    background: #b0b0c0;
    margin: 17rpx 0 13rpx 0;
    width: 90%;
    margin-left: 5%;
    border-radius: 8rpx;
}

.qrcode-share-btn {
    width: 260rpx;
    color: #FFFFFF;
    font-size: 32rpx;
    font-weight: bold;
    text-align: center;
    border: none;
    box-shadow: 0 0 8rpx #8882;
    border-radius: 15px;
    background: rgba(0, 0, 0, 0.8);
    box-sizing: border-box;
}

.qrcode-save-text {
    color: #433F70;
    font-size: 30rpx;
    font-weight: bold;
    height: 60rpx;
    line-height: 68rpx;
}

.header_card {
    margin: 0 30rpx;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-bottom: 1rpx solid #D8D8D8;
    padding: 0 0 20rpx 0;
    box-sizing: border-box;
    width: calc(100vw - 92rpx);
}

.header_card_logo_body {
    width: 150rpx;
    height: 150rpx;
    margin-bottom: 16rpx;
    border-radius: 100%;
    overflow: hidden;
}

.header_card-logo {
    width: 150rpx;
    height: 150rpx;
    margin-bottom: 16rpx;
    border-radius: 100%;
}

.watting {
    font-family: "AlimamaFangYuanTi" !important;
    font-weight: 700;
    font-size: 32rpx;
    color: #A2A0FF
}

.watting_sub {
    font-family: "AlimamaFangYuanTi" !important;
    font-weight: 500;
    font-size: 20rpx;
    color: #A5A5A5
}

.to_entry {
    width: 140rpx;
    height: 47rpx;
    border-radius: 8rpx;
    background: linear-gradient(109deg, rgba(217, 219, 255, 0.8) 3%, rgba(253, 255, 220, 0.8) 104%);
    font-family: Alimama ShuHeiTi;
    font-size: 24rpx;
    font-weight: bold;
    line-height: normal;
    color: #7E5AFF;
    border-bottom: 4rpx solid rgba(0, 0, 0, 0.1);
}

.un_developer {
    width: calc(100vw - 70rpx);
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;

    .und_cards {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;


        .und_card_item {
            width: calc(50vw - 30rpx);
            margin-bottom: 14rpx;
            height: 166rpx;
            border-radius: 20rpx;
            box-sizing: border-box;
            border: 1rpx solid #8D8D8D;
            padding: 23rpx 23rpx 12rpx 23rpx;
            position: relative;

            .title {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 24rpx;
                font-weight: 600;
                color: #000000;
                white-space: nowrap;
            }

            .context {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 18rpx;
                font-weight: normal;
                color: #3D3D3D;
            }

            .btn {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 24rpx;
                font-weight: 500;
                color: #517BFF;
                position: absolute;
                bottom: -22rpx;
                right: 32rpx;
            }
        }

        .big_btn {
            width: calc(100vw - 40rpx);
            height: 111rpx;
            background: linear-gradient(81deg, rgba(217, 219, 255, 0.02) 3%, rgba(253, 255, 220, 0.02) 96%);
            box-sizing: border-box;
            box-shadow: 0rpx 0rpx 4rpx 0rpx rgba(0, 0, 0, 0.6);
            border-radius: 20rpx;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-around;

            .top {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 24rpx;
                font-weight: bold;
                color: #8284FF;
            }

            .bot {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 24rpx;
                font-weight: normal;
                color: #3D3D3D;
            }
        }
    }

    .title {
        font-family: Alimama ShuHeiTi;
        font-size: 25rpx;
        font-weight: bold;
        line-height: normal;
        color: #3D3D3D;
        box-sizing: border-box;
    }

    .content {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        box-sizing: border-box;
    }

    .c_i {
        width: 30vw;
        height: 30vw;
        box-sizing: border-box;
        background: #D8D8D8;
    }
}

.dev_list {
    display: flex;
    align-items: center;
    padding: 0 4rpx;
    box-sizing: border-box;
    width: 100%;

    .dev_item {
        margin-right: 80rpx;
        display: flex;
        flex-direction: column;
        align-items: center;

        .icon_body {
            width: 96rpx;
            height: 96rpx;
            border-radius: 50%;
            background: #EBEEF5;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .my_model {
            width: 64rpx;
            height: 69rpx;
        }

        .my_pay {
            width: 66rpx;
            height: 66rpx;
        }

        .text {
            font-family: "AlimamaFangYuanTi" !important;
            font-size: 24rpx;
            color: #3D3D3D;
        }
    }
}

.developer_info_body {
    box-sizing: border-box;
    padding: 18rpx 0;
    border-width: 1rpx 0 1rpx 0;
    border-color: #D8D8D8;
    border-style: solid;
    width: 100%;

    .developer_info {
        border-radius: 30rpx;
        background: #EEEEFF;
        padding: 32rpx 0 18rpx 32rpx;

        .info_item {
            display: flex;
            align-items: center;
            margin-bottom: 8rpx;
        }
    }

    .icon_copy {
        width: 36rpx;
        height: 28rpx;
        margin-left: 16rpx;
    }

    .re_new {
        width: 74rpx;
        height: 36rpx;
        border-radius: 15rpx;
        background: linear-gradient(109deg, rgba(217, 219, 255, 0.8) 3%, rgba(253, 255, 220, 0.8) 104%);
        box-shadow: 0rpx 2rpx 4rpx 0rpx rgba(0, 0, 0, 0.3);
        font-family: Alimama ShuHeiTi;
        font-size: 24rpx;
        font-weight: bold;
        line-height: normal;
        color: #7E5AFF;
        margin: -6rpx 0 0 8rpx;
    }
}

.s_tip {
    font-family: Silkscreen;
    font-size: 20rpx;
    font-weight: normal;
    color: #86AEFF;
}

.to_plaza {
    width: 230rpx;
    height: 86rpx;
    border-radius: 15rpx;
    background: linear-gradient(268deg,
            rgba(217, 219, 254, 0.65) -208%,
            rgba(217, 219, 254, 0.65) -149%,
            rgba(217, 219, 255, 0.65) -123%,
            rgba(217, 219, 254, 0.65) -33%,
            rgba(217, 219, 255, 0.65) -18%,
            rgba(144, 125, 255, 0.65) 218%,
            rgba(224, 225, 252, 0.65) 303%);
    box-sizing: border-box;
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 36rpx;
    font-weight: bold;
    color: #FFFFFF;
}

.dev_pay_btn {
    width: calc(50vw - 78rpx);
    height: calc(25vw - 39rpx);
    box-sizing: border-box;
    border-radius: 15rpx;
    padding: 12rpx;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border: 2rpx solid #000 !important;

    .dev_pay_text {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 30rpx;
        font-weight: 600;
        color: #000;
    }

    .dev_pay_footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;

        .dev_pay_icon {
            width: 62rpx;
            height: 62rpx;
        }

        .dev_pay_count {
            font-family: "AlimamaFangYuanTi" !important;
            font-size: 36rpx;
            font-weight: bold;
            color: #000;
        }
    }
}

.selected {
    border: 2rpx solid #B0AEFA !important;

    .dev_pay_text {
        color: #B0AEFA !important;
    }

    .dev_pay_count {
        color: #B0AEFA !important;
    }
}

.bg_im_selected {
    background-image: url('https://file.aizhs.top/sys-mini/xtk/dev_pay_border_color.png') !important;
    color: #4A45FF !important;
}

.font_hold {
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 32rpx;
    font-weight: bold;
    color: #333333;
}

.m_b20 {
    margin-bottom: 20rpx;
}

.m_b18 {
    margin-bottom: 18rpx;
}

.m_b16 {
    margin-bottom: 16rpx;
}

.m_b8 {
    margin-bottom: 8rpx;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
