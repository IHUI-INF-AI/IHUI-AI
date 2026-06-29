<template>
    <scroll-view class="set_need" @click.stop="clearDialog" scroll-y>
        <Loading v-if="loading"></Loading>
        <view class="title_icon">
            <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/backf2.png" />
            <view class="title_icon-text">请选择种类（多选）</view>
        </view>
        <!-- 文字，图片，视频 -->
        <TypeBar customize @change="typeFileClick"></TypeBar>

        <view class="f_n m_b18">
            <image class="icon_icon" src="https://file.aizhs.top/sys-mini/default/bumen.png" />
            <view class="font_hold">部门（多选）</view>
        </view>
        <!-- 赛道 -->
        <view class="select_name_list m_b18">
            <view class="name_item haad" @click="() => { showModelTypes = !showModelTypes }">
                <text>{{ '选择部门' }}</text>
                <image class="select_icon-head" src="https://file.aizhs.top/sys-mini/xtk/model_edit_down.png" />
            </view>
            <scroll-view v-if="showModelTypes" class="scroll_body"
                style="height: 240rpx;border-top:  1rpx solid #DADADA;;" scroll-y scroll-x="false" lower-threshold="50">
                <view v-for="(item) in processedCategorySaidao" :key="item.id" class="name_item font_nomal"
                    :class="{ 'font_hold': modelTypeSelected.includes(item.id) }" @click="typeClick(item)">
                    <text>{{ item.showName }}</text>
                    <image v-if="modelTypeSelected.includes(item.id)" class="select_icon-item"
                        src="https://file.aizhs.top/sys-mini/xtk/model_edit_yes.png" />
                </view>
            </scroll-view>
        </view>
        <view class="f_n m_b18">
            <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_work.png" />
            <view class="font_hold">请输入需求标题</view>
        </view>
        <input class="m_b18 font_nomal need_title_input" maxlength="50" v-model="need_title" type="text" />
        <view class="f_n m_b18">
            <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_text.png" />
            <view class="font_hold">请输入需求描述</view>
        </view>
        <textarea class="m_b18 font_nomal text_area" auto-height :value="need_text" @input="changeNeedtext"></textarea>
        <view class="f_n m_b18">
            <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_image.png" />
            <view class="font_hold">上传图片</view>
        </view>
        <view class="f_n m_b18 image_list">
            <view class="image_item" @click.stop="() => { up_bo_win = true }">
                <image class="icon_image" src="https://file.aizhs.top/sys-mini/xtk/set_need_addimage.png" />
            </view>
            <view class="image_item" v-for="(item, index) in imageList" :key="index">
                <image class="icon_image" :src="item.imgUrl" />
            </view>
        </view>
        <view class="f_n m_b18">
            <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_time.png" />
            <view class="font_hold">请设置任务截止时间</view>
        </view>
        <view class="m_b18 time_part">
            <picker mode="date" header-text="周期设置" :value="closeingTime" @change="datechange" indchange="datechange">
                <view class="f_n font_hold picker_slot">
                    <text>任务截止时间</text>
                    <text style="margin: 0 10rpx;">{{ closeingTime }}</text>
                    <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_time_end.png" />
                </view>
            </picker>
        </view>
        <view class="f_n m_b18">
            <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_time.png" />
            <view class="font_hold">请设置开发周期</view>
        </view>
        <view class="m_b18 time_part">
            <view class="f_n" style="position: relative;">
                <view class="font_hold" style="margin-right: 8rpx;">开发周期：</view>
                <view class="s_time_l flex_center"
                    @click.stop="() => { show_time_type = false; show_time_num = true; }">
                    <view class="font_nomal">{{ cycle }}</view>
                    <image class="set_need_select_down"
                        src="https://file.aizhs.top/sys-mini/xtk/set_need_select_down.png" />
                </view>
                <view class="s_time_r flex_center" @click.stop="() => { show_time_num = false; show_time_type = true }">
                    <view class="font_nomal">{{ cycleUnits[cycleUnit] }}</view>
                    <image class="set_need_select_down"
                        src="https://file.aizhs.top/sys-mini/xtk/set_need_select_down.png" />
                </view>
                <view class="s_o" v-if="show_time_num">
                    <view class="s_o_i flex_center" v-for="item in time_nums" :key="item.value"
                        @click.stop="() => { cycle = item.value; clearDialog() }">
                        <view :class="{ 'font_hold': cycle == item.value, 'font_nomal': cycle != item.value }">
                            <text>{{ item.text }}</text>
                        </view>
                    </view>
                </view>
                <view class="s_o" v-if="show_time_type">
                    <view class="s_o_i flex_center" v-for="item in time_types" :key="item.value"
                        @click.stop="() => { cycleUnit = item.value; clearDialog() }">
                        <view :class="{ 'font_hold': cycleUnit == item.value, 'font_nomal': cycleUnit != item.value }">
                            <text>{{ item.text }}</text>
                        </view>
                    </view>
                </view>
            </view>
        </view>
        <view class="f_n m_b18">
            <image class="icon_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_money.png" />
            <view class="font_hold">开发预算（请输入心理预算区间）</view>
        </view>
        <view class="input_part">
            <view class="input_title font_hold">起步价</view>
            <input class="input_body font_nomal" v-model="lowestPrice" type="number" placeholder="￥0.00">
        </view>
        <view class="input_part">
            <view class="input_title font_hold">最高价</view>
            <input class="input_body font_nomal" v-model="peakPrice" type="number" placeholder="￥0.00">
        </view>

        <view class="up_bo_win" v-if="up_bo_win">
            <view class="flex_center item1" @click="handleIconClick('camera')">拍照</view>
            <view class="flex_center item1" @click="handleIconClick('album')">相册</view>
            <view class="flex_center item3"></view>
            <view class="flex_center item4" @click="() => { up_bo_win = false }">取消</view>
        </view>

        <view class="sub_btn flex_center" @click.stop="submit">
            <text>提交需求</text>
        </view>
        <view style="height: 122rpx;"></view>
    </scroll-view>
</template>
<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import TypeBar from '@/pagesA/plaza/components/category-tab.vue'
import { uploadBusinessCarda } from "@/service/businessCard.js";
import { happenTimeFun, nowDate } from '@/utils/time.js'
import { addPlazaModel } from '@/service/aiModels.js'
import Loading from "@/components/loading/index.vue";

const props = defineProps({
    categorySaidao: {
        type: Array,
        default: () => { return [] }
    },
})

const emit = defineEmits(['reback'])

const userInfo = ref({})
const typeFileClicked = ref([])
const typeList = ref('')
const modelTypeSelected = ref([])
const showModelTypes = ref(false)
const need_title = ref("")
const need_text = ref("")
const imageList = ref([])
const up_bo_win = ref(false)
const ALL_OPTION_ID = 'all'
const time_nums = [
    { value: 1, text: "1" },
    { value: 2, text: "2" },
    { value: 3, text: "3" },
    { value: 4, text: "4" },
    { value: 5, text: "5" },
    { value: 6, text: "6" },
    { value: 7, text: "7" },
    { value: 8, text: "8" },
    { value: 9, text: "9" },
    { value: 10, text: "10" },
]
const cycle = ref(1)
const time_types = [
    { value: 3, text: "年" },
    { value: 2, text: "月" },
    { value: 1, text: "周" },
    { value: 0, text: "日" },
]
const cycleUnit = ref(3)
const cycleUnits = {
    '0': '日',
    '1': '周',
    '2': '月',
    '3': '年'
}
const show_time_num = ref(false)
const show_time_type = ref(false)
const closeingTime = ref('2025-8-17')
const loading = ref(false)
const lowestPrice = ref('')
const peakPrice = ref('')

const processedCategorySaidao = computed(() => {
    const allOption = {
        id: ALL_OPTION_ID,
        showName: '全部'
    };
    return [allOption, ...props.categorySaidao];
})

watch(peakPrice, (n) => {
    if (lowestPrice.value && (n < lowestPrice.value)) {
        uni.showToast({
            title: '最高价不能低于起步价',
            icon: 'none'
        });
        peakPrice.value = lowestPrice.value
    }
})

watch(lowestPrice, (n) => {
    if (peakPrice.value && (n > peakPrice.value)) {
        uni.showToast({
            title: '起步价不能高于最高价',
            icon: 'none'
        });
        lowestPrice.value = 0
    }
})

onMounted(() => {
    userInfo.value = uni.getStorageSync("data");
    console.log('userInfo', userInfo.value)
    closeingTime.value = nowDate()
})

function typeFileClick(arr) {
    console.log('typeFileClick', arr)
    typeFileClicked.value = arr
}

function typeClick(item) {
    if (item.id === ALL_OPTION_ID) {
        if (!modelTypeSelected.value.includes(item.id)) {
            modelTypeSelected.value = [ALL_OPTION_ID];
            props.categorySaidao.forEach(cat => {
                modelTypeSelected.value.push(cat.id);
            });
        } else {
            modelTypeSelected.value = [];
        }
    } else {
        const index = modelTypeSelected.value.indexOf(item.id)
        if (index < 0) {
            modelTypeSelected.value.push(item.id);
        } else {
            modelTypeSelected.value.splice(index, 1);
            const allIndex = modelTypeSelected.value.indexOf(ALL_OPTION_ID);
            if (allIndex >= 0) {
                modelTypeSelected.value.splice(allIndex, 1);
            }
        }
    }
}

function changeNeedtext(e) {
    need_text.value = e.target.value;
}

function clearDialog() {
    show_time_num.value = false
    show_time_type.value = false
    up_bo_win.value = false
}

function datechange(e) {
    console.log('datechange', e)
    closeingTime.value = e.detail.value
}

function handleIconClick(icon) {
    up_bo_win.value = false
    if (imageList.value.length > 4) {
        uni.showToast({
            title: '最多上传5张图片',
            icon: 'success',
            duration: 2000
        });
        return
    }
    switch (icon) {
        case 'camera':
            uni.chooseImage({
                count: 1,
                sourceType: ['camera'],
                success: (res) => {
                    console.log('相机选择的图片:', res.tempFilePaths);
                    const imgUrl = res.tempFilePaths[0];
                    uni.getFileSystemManager().readFile({
                        filePath: imgUrl,
                        encoding: 'base64',
                        success: (data) => {
                            const base64Str = data.data;
                            const fileName = imgUrl.split('/').pop();
                            const { uuid } = uni.getStorageSync("data");
                            const id = uuid;
                            console.log("id", id);
                            uploadBusinessCarda(base64Str, fileName)
                                .then((res) => {
                                    console.log("上传成功", res);
                                    if (res.code === "200" && res.data) {
                                        const cardUrl = res.data;
                                        uni.hideLoading();
                                        uni.showToast({
                                            title: '上传成功',
                                            icon: 'success',
                                            duration: 2000
                                        });
                                        imageList.value.push({
                                            imgUrl: cardUrl,
                                            originalUrl: imgUrl,
                                            id: id
                                        });
                                    } else {
                                        throw new Error('返回的路径无效');
                                    }
                                })
                                .catch((err) => {
                                    uni.hideLoading();
                                    uni.showToast({
                                        title: '上传失败',
                                        icon: 'none',
                                        duration: 2000
                                    });
                                    console.error("上传失败", err);
                                });
                        }
                    });
                }
            });
            break;
        case 'album':
            uni.chooseImage({
                count: 1,
                sourceType: ['album'],
                success: (res) => {
                    console.log('相册选择的图片:', res.tempFilePaths);
                    const imgUrl = res.tempFilePaths[0];
                    uni.getFileSystemManager().readFile({
                        filePath: imgUrl,
                        encoding: 'base64',
                        success: (data) => {
                            const base64Str = data.data;
                            const fileName = imgUrl.split('/').pop();
                            const { uuid } = uni.getStorageSync("data");
                            const id = uuid;
                            console.log("id", id);
                            uploadBusinessCarda(base64Str, fileName)
                                .then((res) => {
                                    console.log("上传成功", res);
                                    if (res.code === "200" && res.data) {
                                        const cardUrl = res.data;
                                        imageList.value.push({
                                            imgUrl: cardUrl,
                                            originalUrl: imgUrl,
                                            id: id
                                        });
                                        uni.hideLoading();
                                        uni.showToast({
                                            title: '上传成功',
                                            icon: 'success',
                                            duration: 2000
                                        });
                                    } else {
                                        throw new Error('返回的路径无效');
                                    }
                                })
                                .catch((err) => {
                                    uni.hideLoading();
                                    uni.showToast({
                                        title: '上传失败',
                                        icon: 'none',
                                        duration: 2000
                                    });
                                    console.error("上传失败", err);
                                });
                        }
                    });
                }
            });
            break;
    }
}

function validateForm() {
    if (!typeFileClicked.value || typeFileClicked.value.length === 0) {
        uni.showToast({ title: '请选择种类', icon: 'none' });
        return false;
    }

    const filteredCategories = modelTypeSelected.value.filter(id => id !== ALL_OPTION_ID);
    if (filteredCategories.length === 0) {
        uni.showToast({ title: '请选择部门', icon: 'none' });
        return false;
    }

    if (!need_title.value || need_title.value.trim() === '') {
        uni.showToast({ title: '请输入需求标题', icon: 'none' });
        return false;
    }

    if (need_title.value.trim().length < 2) {
        uni.showToast({ title: '需求标题至少2个字符', icon: 'none' });
        return false;
    }

    if (!need_text.value || need_text.value.trim() === '') {
        uni.showToast({ title: '请输入需求描述', icon: 'none' });
        return false;
    }

    if (need_text.value.trim().length < 10) {
        uni.showToast({ title: '需求描述至少10个字符', icon: 'none' });
        return false;
    }

    if (!closeingTime.value) {
        uni.showToast({ title: '请设置任务截止时间', icon: 'none' });
        return false;
    }

    const today = new Date();
    const selectedDate = new Date(closeingTime.value);
    if (selectedDate <= today) {
        uni.showToast({ title: '截止时间不能早于明天', icon: 'none' });
        return false;
    }

    if (!cycle.value || cycle.value <= 0) {
        uni.showToast({ title: '请设置有效的开发周期', icon: 'none' });
        return false;
    }

    if (!lowestPrice.value || lowestPrice.value <= 0) {
        uni.showToast({ title: '请输入起步价', icon: 'none' });
        return false;
    }

    if (!peakPrice.value || peakPrice.value <= 0) {
        uni.showToast({ title: '请输入最高价', icon: 'none' });
        return false;
    }

    if (parseFloat(lowestPrice.value) > parseFloat(peakPrice.value)) {
        uni.showToast({ title: '起步价不能高于最高价', icon: 'none' });
        return false;
    }

    if (parseFloat(lowestPrice.value) < 100) {
        uni.showToast({ title: '起步价不能低于100元', icon: 'none' });
        return false;
    }

    return true;
}

function submit() {
    if (!validateForm()) {
        return;
    }

    loading.value = true

    const imageListData = imageList.value.map(item => {
        return item.imgUrl || ''
    })
    let types = []
    let type = ''

    for (let i = 0, len = typeFileClicked.value.length; i < len; i++) {
        if (typeFileClicked.value[i].type == 'type') {
            if (type) {
                type = type + ',' + typeFileClicked.value[i].id
            } else {
                type = typeFileClicked.value[i].id
            }
        } else {
            types.push(typeFileClicked.value[i].id)
        }
    }

    let params = {
        title: need_title.value,
        context: need_text.value,
        imgs: imageListData.join(),
        lowestPrice: lowestPrice.value,
        peakPrice: peakPrice.value,
        cycle: cycle.value,
        cycleUnit: cycleUnit.value,
        closingTime: closeingTime.value,
        types: types,
        type: type,
        categorys: modelTypeSelected.value.filter(id => id !== ALL_OPTION_ID),
        creator: userInfo.value.uuid
    }
    addPlazaModel(params).then(res => {
        if (res && res.code == 200) {
            emit('reback')
            uni.showToast({
                title: '提交成功',
                icon: 'none'
            });
        } else {
            uni.showToast({
                title: '提交失败',
                icon: 'none'
            });
        }
    }).catch(err => {
        uni.showToast({
            title: `${err.detail}`,
            icon: 'none'
        });
    }).finally(() => {
        loading.value = false
    })
}
</script>
<style lang="scss" scoped>
.set_need {
    box-sizing: border-box;
    width: 100%;
    height: calc(100vh - 240rpx);
    padding: 0 18rpx;

    .user_info {
        box-sizing: border-box;
        width: 100%;
        margin: 0 4rpx;
        border-bottom: 1px solid #D8D8D8;
        display: flex;
        padding: 18rpx 2rpx;

        .avatar {
            width: 60rpx;
            height: 60rpx;
            border-radius: 8rpx;
            margin-right: 8rpx;
        }

        .user_name {
            font-family: AlimamaFangYuanTi !important;
            font-size: 30rpx;
            font-weight: bold;
            color: #000;
            margin-left: 12rpx;
        }
    }

    .title_icon {
        display: flex;
        align-items: center;
        margin-top: 18rpx;

        .title_icon-image {
            width: 41rpx;
            height: 41rpx;
            margin-right: 13rpx;
        }

        .title_icon-text {
            font-family: AlimamaFangYuanTi !important;
            font-size: 28rpx;
            color: #000;
            font-weight: bold;
        }
    }

    .select_all {
        font-family: AlimamaFangYuanTi !important;
        font-size: 28rpx;
        font-weight: 500;
        color: #3D3D3D;
    }

    .select_name_list {
        width: 330rpx;
        box-sizing: border-box;
        overflow: hidden;
        border: 1rpx solid #DADADA;
        border-radius: 20rpx;
        box-shadow: 0 0 6px 0 rgb(21 0 255 / 0);
        margin-top: 18rpx;

        .haad {
            font-family: AlimamaFangYuanTi !important;
            font-size: 28rpx;
            font-weight: normal;
            color: #979797;
        }

        .name_item {
            height: 60rpx;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16rpx;
        }

        .select_icon-head {
            width: 34rpx;
            height: 30rpx;
        }

        .select_icon-item {
            width: 24rpx;
            height: 16rpx;
        }
    }

    .need_title_input {
        width: 100%;
        box-sizing: border-box;
        border: 1rpx solid #D8D8D8;
        border-radius: 8rpx;
        padding: 12rpx 12rpx 14rpx 14rpx;
        min-height: 72rpx;
    }

    .text_area {
        width: 100%;
        box-sizing: border-box;
        border: 1rpx solid #D8D8D8;
        border-radius: 8rpx;
        padding: 18rpx 14rpx;
        min-height: 188rpx;
    }

    .image_list {
        .image_item {
            width: 100rpx;
            height: 100rpx;
            box-sizing: border-box;
            overflow: hidden;
            margin-right: 18rpx;

            .icon_image {
                width: 100%;
                height: 100%;
            }
        }
    }

    .time_part {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14rpx 0;

        .s_time_l {
            width: 89rpx;
            height: 60rpx;
            box-sizing: border-box;
            border: 1rpx solid #DADADA;
            border-radius: 8rpx 0rpx 0rpx 8rpx;
        }

        .s_time_r {
            width: 89rpx;
            height: 60rpx;
            box-sizing: border-box;
            border-style: solid;
            border-color: #DADADA;
            border-width: 1rpx 1rpx 1rpx 0rpx;
            border-radius: 0rpx 8rpx 8rpx 0rpx;
        }

        .set_need_select_down {
            width: 18rpx;
            height: 10rpx;
            margin-left: 11rpx;
        }

        .s_o {
            width: 176rpx;
            height: 185rpx;
            box-sizing: border-box;
            border-radius: 0rpx 0rpx 8rpx 8rpx;
            border-width: 0rpx 1rpx 1rpx;
            border-style: solid;
            border-color: #DADADA;
            overflow: hidden scroll;
            position: absolute;
            top: 56rpx;
            left: 140rpx;
            z-index: 99;

            .s_o_i {
                width: 100%;
                height: 46rpx;
                background-color: #FFF;
            }
        }

        .picker_slot {
            width: 100%;
        }
    }

    .input_part {
        width: 100%;
        box-sizing: border-box;
        position: relative;
        border-bottom: 1rpx solid #E4E7ED;

        .input_body {
            padding-left: 95rpx;
            height: 90rpx;
            line-height: 89rpx;
        }

        .input_title {
            position: absolute;
            left: 0;
            top: 0;
            line-height: 88rpx;
        }
    }

    .sub_btn {
        width: 600rpx;
        height: 88rpx;
        border-radius: 15rpx;
        font-family: AlimamaFangYuanTi !important;
        font-size: 48rpx;
        font-weight: bold;
        color: #fff;
        text-transform: uppercase;
        border: none;
        background: #000;
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
        animation: bouncea 0.5s ease-in-out infinite;
        margin: 41rpx auto 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
}

.up_bo_win {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 400rpx;
    display: flex;
    flex-direction: column;
    border-radius: 20rpx 20rpx 0 0;
    background: #E4E7ED;
    z-index: 980;

    .item1 {
        background: #FFF;
        font-family: AlimamaFangYuanTi !important;
        font-size: 36rpx;
        font-weight: normal;
        letter-spacing: 0.1em;
        color: #3D3D3D;
        border-bottom: 1rpx solid #E4E7ED;
        width: 100%;
        height: 120rpx;
    }

    .item3 {
        background: #E4E7ED;
        width: 100%;
        flex: 1;
    }

    .item4 {
        width: 100%;
        height: 120rpx;
        background: #F4F4F4;
        font-family: AlimamaFangYuanTi !important;
        font-size: 36rpx;
        font-weight: normal;
        letter-spacing: 0.1em;
        color: #979797;
    }
}

.icon_icon {
    width: 42rpx;
    height: 42rpx;
    margin-right: 12rpx;
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

.f_n {
    display: flex;
    align-items: center;
}

.flex_center {
    display: flex;
    align-items: center;
    justify-content: center;
}

.font_nomal {
    font-family: AlimamaFangYuanTi !important;
    font-size: 28rpx;
    font-weight: normal;
    color: #000;
}

.font_hold {
    font-family: AlimamaFangYuanTi !important;
    font-size: 28rpx;
    font-weight: bold !important;
    color: #000;
}

@keyframes bouncea {
    0% {
        box-shadow: none;
        transform: translate(3rpx, 3rpx);
    }

    50% {
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
        transform: translate(0, 0);
    }

    100% {
        box-shadow: none;
        transform: translate(3rpx, 3rpx);
    }
}
</style>
