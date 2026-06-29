<template>
    <view>
        <Loading v-if="loading"></Loading>
        <view class="f_c group_image" v-if="formInfo.binding">
            <view class="image_view">
                <view class="f_c">
                    <text>封面</text>
                </view>
                <image class="image" :src="formInfo.binding" mode="aspectFit" />
            </view>
        </view>
        <view class="add_video f_c">
            <image v-if="formInfo.binding" class="study_icon_add_grad" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png"
                @click="uploadImage()" />
            <image v-else class="study_icon_add_grad_empty" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png"
                @click="uploadImage()" />
        </view>

        <view class="video_form">
            <view class="title">合集标题</view>
            <input class="v_title_f m_b18" v-model="formInfo.title" type="text" placeholder="请输入合集标题"
                placeholder-class="placeholder_color">
            <view class="title">合集描述</view>
            <textarea class="font_nomal text_area" auto-height v-model="formInfo.content"
                placeholder-class="placeholder_color" placeholder="请输入合集描述"></textarea>

            <text class="sub_title">选择合集赛道</text>
            <text class="title">#大赛道</text>
            <Single :options="mainSaidao" @change="changeMain" :value="msId"></Single>

            <text class="title" v-if="subSaidao.length > 0">#细分赛道</text>
            <Single :options="subSaidao" @change="changeSub" :value="formInfo.categorys"></Single>

            <text class="sub_title">选择课程阶段</text>
            <Single :options="stageList" @change="changeStage" :value="formInfo.stage"></Single>
        </view>

        <view
            v-if="(status == 'edit' && (formInfo.auditStatus == 0 || formInfo.auditStatus == 2 || formInfo.auditStatus == 3 || formInfo.auditStatus == 4))"
            class="title" style="margin-left: 18rpx;">上传视频</view>
        <view
            v-if="(status == 'edit' && (formInfo.auditStatus == 0 || formInfo.auditStatus == 2 || formInfo.auditStatus == 3 || formInfo.auditStatus == 4))"
            class="to_video_btn f_c" @click="toUploadVideoPage()">
            <text class="btn_text">上传课程视频</text>
        </view>
        <view class="submit f_c" v-if="status == 'add'">
            <view class="btn btn-publish f_c" @click="submitGroup('add')">
                <text>发布</text>
            </view>
        </view>
        <view class="submit f_a" v-if="status == 'edit'">
            <view class="btn f_c" @click="submitGroup('edit')"
                v-if="formInfo.auditStatus == 0 || formInfo.auditStatus == 2 || formInfo.auditStatus == 3 || formInfo.auditStatus == 4">
                <text>修改</text>
            </view>
            <view class="btn f_c" @click="handleDelete()"
                v-if="formInfo.auditStatus == 0 || formInfo.auditStatus == 2 || formInfo.auditStatus == 3 || formInfo.auditStatus == 4">
                <text>删除</text>
            </view>
            <view class="btn f_c" @click="xiajia()" v-if="formInfo.auditStatus == 4">
                <text>下架</text>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, reactive, watch, nextTick } from 'vue'
import { uploadBybase64 } from "@/service/businessCard.js";
import { addGroup, getCourseDetail, courseDelete, coursePut, parentquery, delist } from '@/service/study.js'
import Loading from "@/components/loading/index.vue";
import Tab from '@/components/type-bar/tab.vue'
import Single from '@/components/type-bar/single.vue'

const props = defineProps({
    fromParent: {
        type: String,
        default: 'add'
    },
    courseId: String,
    tabList: Array,
    mainSaidao: Array,
})

const emit = defineEmits(['goBack', 'getGroupId', 'toUploadVideoPage', 'getGroupImage'])

const status = ref('add')
const formInfo = reactive({
    binding: '',
    title: '',
    content: '',
    categorys: '',
    stage: 0,
    auditStatus: 0,
})
const subSaidao = ref([])
const msId = ref('')
const ssId = ref('')
const stageList = ref([
    { name: '入门', id: 0 },
    { name: '进阶', id: 1 },
    { name: '精通', id: 2 },
])
const types = ref([])
const typeList = ref([])
const loading = ref(false)

watch(() => props.fromParent, (n) => {
    if (n) {
        status.value = n
    }
}, { immediate: true })

watch(() => props.mainSaidao, (n) => {
    if (n) {
        nextTick(() => {
            msId.value = n[0].id
        })
    }
}, { immediate: true })

function getEdit() {
    console.log('编辑合集回显', props.courseId)
    loading.value = true
    getCourseDetail(props.courseId).then(res => {
        Object.assign(formInfo, res.data)
        if (res.data.categoryList) {
            const subId = res.data.categoryList[0].id
            ssId.value = subId

            parentquery(subId).then(ids => {
                msId.value = ids.data[subId].pid
            })
        }
    }).finally(() => {
        loading.value = false
    })
}

function changeMain(obj) {
    console.log('changeMain', obj)
    if (obj.children) {
        subSaidao.value = obj.children
        formInfo.categorys = subSaidao.value[0].id
    } else {
        subSaidao.value = []
    }
    nextTick(() => {
        if (ssId.value) {
            formInfo.categorys = ssId.value
            ssId.value = ''
        } else {
            formInfo.categorys = ''
        }
    })
}

function changeSub(obj) {
    console.log('changeSub', obj)
    formInfo.categorys = obj.id
}

function changeStage(obj) {
    console.log('changeStage', obj)
    formInfo.stage = obj.id
}

function handleDelete() {
    loading.value = true
    courseDelete([props.courseId]).then(res => {
        emit('goBack')
    }).finally(() => {
        loading.value = false
    })
}

function xiajia() {
    loading.value = true
    delist(props.courseId).then(() => {
        emit('goBack')
    }).finally(() => {
        loading.value = false
    })
}

function submitGroup(value) {
    console.log('submitGroup', value, formInfo, enoughInfo())
    if (!enoughInfo()) {
        return
    }
    loading.value = true

    let param = {
        binding: formInfo.binding,
        title: formInfo.title,
        content: formInfo.content,
        categorys: formInfo.categorys,
        stage: formInfo.stage,
        auditStatus: formInfo.auditStatus,
    }
    if (value == 'add') {
        console.log('param', param)
        addGroup(param).then(res => {
            emit('getGroupId', {
                id: res.data,
                title: formInfo.title
            })
            uni.showToast({
                title: '发布成功请继续上传视频',
                icon: 'success',
                duration: 2000
            });
        }).finally(() => {
            loading.value = false
        })
    }
    if (value == 'edit') {
        param.id = props.courseId
        coursePut(param).then(res => {
            getEdit()
            emit('getGroupId', {
                id: props.courseId,
                title: formInfo.title
            })
            uni.showToast({
                title: '修改成功！请等待审核',
                icon: 'success',
                duration: 2000
            });
        }).catch(() => {
            loading.value = false
        })
    }
}

function enoughInfo() {
    if (!formInfo.binding) {
        uni.showToast({
            title: '请上传封面',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    if (!formInfo.title) {
        uni.showToast({
            title: '请输入合集标题',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    if (!formInfo.content) {
        uni.showToast({
            title: '请输入合集描述',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    if (!formInfo.categorys) {
        uni.showToast({
            title: '请选择主赛道和子赛道',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    return true
}

function toUploadVideoPage() {
    emit('toUploadVideoPage')
}

function uploadImage() {
    uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
            loading.value = true
            console.log('相册选择的图片:', res.tempFilePaths);
            const imgUrl = res.tempFilePaths[0];
            uni.getFileSystemManager().readFile({
                filePath: imgUrl,
                encoding: 'base64',
                success: (data) => {
                    const base64Str = data.data;
                    const fname = imgUrl.split('/').pop();
                    uploadBybase64(base64Str, fname)
                        .then((res) => {
                            console.log("上传成功", res);

                            if (res.url) {
                                const cardUrl = res.url;
                                formInfo.binding = cardUrl
                                emit('getGroupImage', cardUrl)

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
                        })
                        .finally(() => {
                            loading.value = false
                        })
                }
            });
        }
    });
}
</script>
<style lang="scss" scoped>
.group_image {
    height: 300rpx;
    width: 100%;
    box-sizing: border-box;
    font-size: 32rpx;
    font-weight: bold;
    color: rgb(0 0 0 / 0.6);
}

.video_image {
    width: 100%;
    box-sizing: border-box;
    font-size: 32rpx;
    font-weight: bold;
    color: rgb(0 0 0 / 0.6);
    padding: 0 auto;
}

.image {
    width: 444rpx;
    height: 250rpx;
    border-radius: 15rpx;
    margin-right: 22rpx;
}

.video {
    width: 444rpx;
    height: 250rpx;
    border-radius: 15rpx;
}

.add_video {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 18rpx;

    .study_icon_add_grad {
        width: 80rpx;
        height: 80rpx;
    }
}

.study_icon_add_grad_empty {
    width: 200rpx;
    height: 200rpx;
}

.add_video_list {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 18rpx;

    .video_image_item {
        width: 141rpx;
        height: 80rpx;
    }

    .m_r {
        margin-right: 15rpx;
    }
}

.video_form {
    padding: 0 18rpx;

    .v_title_f {
        font-family: "Alimama FangYuanTi VF" !important;
        font-size: 32rpx;
        font-weight: bold;
        color: #999;
        width: 100%;
        box-sizing: border-box;
        border: 1rpx solid #D8D8D8;
        border-radius: 8rpx;
        padding: 12rpx 15rpx;
        min-height: 72rpx; // height 不好使
    }

    .placeholder_color {
        color: #999;
        font-weight: normal !important;
    }

    .text_area {
        width: 100%;
        box-sizing: border-box;
        border: 1rpx solid #D8D8D8;
        border-radius: 8rpx;
        padding: 12rpx 15rpx;
        min-height: 188rpx;
    }

    .sub_title {
        font-size: 32rpx;
        font-weight: bold;
        color: #000;
        margin: 18rpx 0;
        box-sizing: border-box;
        display: block;
    }
}

.to_video_btn {
    width: calc(100vw - 36rpx);
    margin: 5rpx auto;
    height: 82rpx;
    background: linear-gradient(106deg, rgb(228 229 255 / 0.25) 4%, rgb(254 255 236 / 0.25) 104%);
    border: 1rpx solid #EEE;
    backdrop-filter: blur(10px);
    border-radius: 15rpx;

    .btn_text {
        font-size: 36rpx;
        font-weight: bold;
        letter-spacing: 0.1em;
        color: #B0A6FF;
    }
}

.submit {
    width: 100%;
    height: 300rpx;
    box-sizing: border-box;

    .btn {
        background: linear-gradient(268deg,
                rgb(217 219 254 / 0.65) -207%,
                rgb(217 219 254 / 0.65) -148%,
                rgb(217 219 255 / 0.65) -122%,
                rgb(217 219 254 / 0.65) -33%,
                rgb(217 219 255 / 0.65) -17%,
                rgb(144 125 255 / 0.65) 217%,
                rgb(224 225 252 / 0.65) 302%);
        box-sizing: border-box;
        backdrop-filter: blur(10rpx);
        box-shadow: inset 0rpx -6rpx 20rpx 0rpx rgb(255 255 255 / 0.8);
        width: 192rpx;
        height: 82rpx;
        font-size: 50rpx;
        font-weight: bold;
        letter-spacing: 0.1em;
        color: #FFF;
    }

    .btn.btn-publish {
        background: #000;
        color: #fff;
        box-shadow: inset 0rpx -6rpx 20rpx 0rpx rgb(255 255 255 / 0.1);
    }
}

.f_n {
    display: flex;
    align-items: center;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}

.f_b {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.f_a {
    display: flex;
    align-items: center;
    justify-content: space-around;
}

.m_b18 {
    margin-bottom: 18rpx;
}

.title {
    font-family: "Alimama FangYuanTi VF" !important;
    font-size: 24rpx;
    font-weight: 600;
    color: #1A1A1A;
    margin: 15rpx 0;
}

.font_nomal {
    font-family: "Alimama FangYuanTi VF" !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #000;
}
</style>
