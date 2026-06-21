<template>
    <view class="add_video_body">
        <Loading v-if="loading"></Loading>
        <view class="video_image">
            <view class="f_a m_b" @click="changeImage()">
                <view class="f_c" style="margin-right: 12rpx;">
                    <text>封面</text>
                </view>
                <image class="image" :src="formInfo.binding" v-if="formInfo.binding" />
                <image class="study_icon_add_grad_empty" v-else
                    src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png" @click="changeImage()" />
            </view>
            <view class="f_a m_b" v-if="localUrl">
                <view class="f_c" style="margin-right: 12rpx;">
                    <text>视频</text>
                </view>
                <video class="video" :controls="false" :src="localUrl" autoplay controls object-fit="fill"
                    @waiting="waiting" @error="error" @loadedmetadata="loadedmetadata"></video>
            </view>
        </view>
        <Progress v-if="chunkUploading" :totalSize="size" :overSize="overSize"></Progress>
        <view class="add_video_list f_n" v-if="status == 'all' || status == 'edit'">
            <image class="video_image_item m_r" v-for="(item, index) in videoList" :key="index" :src="item.binding"
                @click="changeVideo(index)" />
            <image class="study_icon_add_grad" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png"
                @click="uploadVideo()" />
        </view>
        <view class="add_video_list f_a" v-if="status == 'add'">
            <view class="f_c" style="margin-right: 12rpx;color: rgba(0, 0, 0, 0.6);font-weight: bold;">
                <text>视频</text>
            </view>
            <image class="study_icon_add_grad_empty" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png"
                @click="uploadVideo()" />
        </view>

        <view class="sub_title" v-if="status == 'all'">合集标题</view>
        <input class="v_title_f m_b18" v-if="status == 'all'" :value="groupTitle" type="text" disabled>

        <view class="sub_title">课程标题</view>
        <input class="v_title_f m_b18" v-model="formInfo.title" type="text" placeholder="请输入课程标题"
            placeholder-class="placeholder_color" :disabled="status == 'all'">

        <view class="sub_title">课程描述</view>
        <textarea class="font_nomal text_area" auto-height v-model="formInfo.content"
            placeholder-class="placeholder_color" placeholder="请输入课程描述" :disabled="status == 'all'"></textarea>

        <view class="net_ai">关联AI应用</view>

        <input class="v_title_f m_b18" v-model="agentName" type="text" placeholder="搜索智能体"
            placeholder-class="placeholder_color" :disabled="status == 'all'" @focus="focusAiSearch()"
            @blur="blurAiSearch" @confirm="confirmSearch">

        <view class="select_option" v-show="showAiList">
            <view class="s_i f_n" v-for="(item, index) in aiOptions" :key="item.agentId" @click="selectAi(item)">
                <text class="font_nomal">{{ item.agentName }}</text>
            </view>
        </view>

        <view class="view_ai f_n">
            <view class="view_item f_c" v-for="(item, index) in formInfo.aiList" :key="index">
                <text class="font_nomal" style="color: #768DFF;">{{ item.name }}</text>
            </view>
        </view>

        <view class="sub_title">置顶评论</view>
        <textarea class="font_nomal text_area" auto-height v-model="formInfo.remark"
            placeholder-class="placeholder_color" placeholder="请输入置顶评论" :disabled="status == 'all'"></textarea>
        <view class="search-box2" @click="() => { showRemarkUrl = true }">
            <image class="search-box2-img" :class="{ 'rotate-icon': isShowIcon }"
                src="https://file.aizhs.top/sys-mini/search-add.png" mode="" />
        </view>
        <view class="modal_overlay f_c" v-if="showRemarkUrl" @click="() => { showRemarkUrl = false }">
            <view class="color_bg" v-if="showRemarkUrl" @click.stop="() => { }">
                <view class="color_cont">
                    <textarea class="font_nomal text_area" auto-height v-model="remarkText"
                        placeholder-class="placeholder_color" placeholder="请填写您资料的合法网络地址链接..."></textarea>
                </view>
                <view class="remark_btn">
                    <view class="btn f_c" @click="pushRemark()">
                        <text>保存</text>
                    </view>
                </view>
            </view>
        </view>

        <text class="sub_title">选择课程标签</text>
        <Tab customize :options="tabList" @change="changeTypes" :values="typeList"></Tab>

        <view class="submit f_c" v-if="status == 'add'">
            <view class="btn btn-publish f_c" @click="submit('add')">
                <text>发布</text>
            </view>
        </view>
        <view class="submit f_a" v-if="status == 'edit'">
            <view class="btn f_c" @click="cancel()">
                <text>取消</text>
            </view>
            <view class="btn f_c" @click="submit('edit')"
                v-if="formInfo.auditStatus == 0 || formInfo.auditStatus == 2 || formInfo.auditStatus == 3 || formInfo.auditStatus == 4">
                <text>修改</text>
            </view>
            <view class="btn f_c" @click="handleDelete()"
                v-if="formInfo.auditStatus == 0 || formInfo.auditStatus == 2 || formInfo.auditStatus == 3 || formInfo.auditStatus == 4">
                <text>删除</text>
            </view>
            <view class="btn f_c" @click="shangjia()" v-if="formInfo.auditStatus == 0">
                <text>上架</text>
            </view>
            <view class="next_btn f_c" @click="toNext()">
                <text class="btn_text">上传下集</text>
            </view>
        </view>
        <view class="submit f_b" v-if="status == 'all'">
            <view class="btn f_c" @click="goback()">
                <text>完成</text>
            </view>
            <view class="next_btn f_c" @click="toNext()">
                <text class="btn_text">上传下集</text>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { uploadBybase64 } from "@/service/businessCard.js";
import { addVideo, getAgentsAlllist, uploadChunkedFile, uploadChunkedFileJoint, getVideoList, videoDelete, videoPut, parentquery, issue, uploadChunkedFilePC } from '@/service/study.js'
import Loading from "@/components/loading/index.vue";
import Progress from './video_progress.vue'
import Tab from '@/components/type-bar/tab.vue'
import Single from '@/components/type-bar/single.vue'
import { isPCEnvironment } from '../video.js'

const props = defineProps({
    courseId: String,
    groupTitle: String,
    fromParent: {
        type: String,
        default: 'add'
    },
    tabList: Array,
    mainSaidao: Array,
})

const status = ref('add')
const loading = ref(false)
const agentName = ref('')
const showAiList = ref(false)
const aiOptions = ref([])
const aiTimer = ref(null)
const userInfo = ref({})
const selectLoading = ref(false)
const videoList = ref([])
const formInfo = reactive({
    id: '',
    binding: '',
    videoPath: '',
    title: '',
    content: '',
    remark: '',
    aiList: [],
    auditStatus: 0
})
const protoInfo = ref({})
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

const videoInfo = ref({})
const localUrl = ref('')
const chunkSize = ref(5 * 1024 * 1024)
const md5id = ref('')
const chunkCount = ref(0)
const size = ref(0)
const overSize = ref(0)
const vIndex = ref(0)
const fileName = ref('')
const chunkRes = ref({})
const chunks = ref([])
const chunkUploading = ref(false)
const showRemarkUrl = ref(false)
const remarkText = ref('')
const ispc = ref(false)

watch(agentName, () => {
    togetAgentsAlllist()
})

watch(() => props.fromParent, (n) => {
    if (n) {
        status.value = n
    }
}, { immediate: true })

watch(formInfo, (n) => {
    if (n && n.id && formInfo != n) {
        protoInfo.value = n
    }
}, { immediate: true })

userInfo.value = uni.getStorageSync('data')
togetAgentsAlllist()

onMounted(() => {
    ispc.value = isPCEnvironment()
    console.log('ispc', ispc.value)
    if (ispc.value) {
        chunkSize.value = 1 * 1024 * 1024
    } else {
        chunkSize.value = 5 * 1024 * 1024
    }
    console.log('chunkSize', chunkSize.value)
})

function pushRemark() {
    formInfo.remark = remarkText.value + '\n' + formInfo.remark
    showRemarkUrl.value = false
}

function getFileInfo(tempFilePath) {
    const fs = uni.getFileSystemManager();
    fs.getFileInfo({
        filePath: tempFilePath,
        success: (res) => {
            console.log('文件信息', res);
            let date = new Date()
            md5id.value = date.getTime()
            console.log('md5id', md5id.value)
            uploadNextChunk()
        }
    });
}

function uploadNextChunk() {
    const start = vIndex.value * chunkSize.value
    overSize.value = start
    let end
    if (vIndex.value == chunkCount.value - 1) {
        end = size.value
    } else {
        end = (vIndex.value + 1) * chunkSize.value
    }
    console.log('start', start)
    console.log('end', end)
    const length = end - start
    const fs = uni.getFileSystemManager();
    fs.readFile({
        filePath: localUrl.value,
        offset: start,
        position: start,
        length: end - start,
        success(res) {
            console.log('readFile', res)
            uploadChunk(res.data, length);
        },
        fail(err) {
            console.error('读取文件分片失败', err);
        }
    });
}

function getBuffer() {
    let totalLength = 0;
    for (const buf of chunks.value) {
        totalLength += buf.byteLength;
    }
    const result = new Uint8Array(totalLength);

    let offset = 0;
    for (const buf of chunks.value) {
        result.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
    }

    console.log('result', result)
    console.log('buffer', result.buffer)

    const fs = wx.getFileSystemManager();
    const fname = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 10)}`;
    const tempFilePath = `${wx.env.USER_DATA_PATH}/${fname}`;

    fs.writeFileSync(tempFilePath, result.buffer, 'binary');
    console.log('tempFilePath', tempFilePath)
    console.log('window', window)
    const url = window.URL.createObjectURL(tempFilePath)
    console.log('url', url)
    localUrl.value = url
}

function uploadChunk(data, length) {
    uploadChunkedFile({
        file: data,
        fileName: fileName.value,
        fileMD5: md5id.value,
        chunkNumber: vIndex.value,
        totalChunks: chunkCount.value,
        fileType: 'video/mp4'
    }, length).then(res => {
        console.log('uploadChunkedFile', res)

        vIndex.value++
        if (vIndex.value < chunkCount.value) {
            uploadNextChunk()
        } else {
            chunkRes.value = res.data
            console.log('chunkRes', chunkRes.value)
            formInfo.videoPath = res.data.presetPath
            vIndex.value = 0
            chunkUploading.value = false
            getVideoUrl()
            uni.showToast({
                title: '视频上传成功！',
                icon: 'success',
                duration: 2000
            });
        }
    })
    if (false) {
        const fs = wx.getFileSystemManager();
        const fname = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 10)}`;
        const tempFilePath = `${wx.env.USER_DATA_PATH}/${fname}`;
        let p = new Promise((resolve, reject) => {
            try {
                fs.writeFileSync(tempFilePath, data, 'binary');
                resolve(tempFilePath)
            } catch (err) {
                reject(err)
            }
        })
        p.then(tempFilePath => {
            console.log('tempFilePath', tempFilePath)

            const formData = {
                fileName: fileName.value,
                fileMD5: md5id.value,
                chunkNumber: vIndex.value,
                totalChunks: chunkCount.value,
                fileType: 'video/mp4',
            }
            console.log('formData', formData)

            uni.uploadFile({
                url: 'http://192.168.1.72:8080/file/uploadChunkedFile/pc',
                filePath: tempFilePath,
                name: 'file',
                formData: formData,
                header: {
                    'Content-Type': `multipart/form-data;`
                },
                success(res) {
                    const result = JSON.parse(res.data);
                    console.log('uploadFile', result)

                    vIndex.value++
                    console.log('vIndex', vIndex.value, chunkCount.value)
                    if (vIndex.value < chunkCount.value) {
                        uploadNextChunk()
                    } else {
                        chunkRes.value = result
                        console.log('chunkRes', chunkRes.value)
                        formInfo.videoPath = result.presetPath
                        vIndex.value = 0
                        chunkUploading.value = false
                        getVideoUrl()
                        uni.showToast({
                            title: '视频上传成功！',
                            icon: 'success',
                            duration: 2000
                        });
                    }
                },
                fail(err) {
                    console.error('分片上传失败', err);
                },
            });
        })
            .catch(err => {
                console.log('writeFileSync fail', err)
            })
            .finally(() => {
                fs.unlinkSync(tempFilePath);
            })
    }
}

function getVideoUrl() {
    uploadChunkedFileJoint({
        path: chunkRes.value.currentPath,
        fileName: fileName.value
    }).then(res => {
        formInfo.videoPath = res.data
    })
}

function uploadVideo() {
    if (status.value == 'all') {
        toNext()
        return
    }

    if (false) {
        uni.chooseMessageFile({
            count: 1,
            type: 'file',
            extension: ['mp4'],
            success: (res) => {
                console.log('PC端选择文件成功', res)
                chunkUploading.value = true

                const tempFilePath = res.tempFiles[0].path;
                const fileSize = res.tempFiles[0].size;

                videoInfo.value = {
                    tempFilePath: tempFilePath,
                    size: fileSize
                }
                localUrl.value = tempFilePath

                handleFileName(tempFilePath)

                size.value = fileSize
                chunkCount.value = Math.ceil(size.value / chunkSize.value);
                console.log('分片数量', chunkCount.value)
                getFileInfo(localUrl.value)
            },
            fail: (fail) => {
                console.error('PC端选择文件失败', fail)
                uni.showToast({
                    title: '选择视频文件失败',
                    icon: 'error',
                    duration: 2000
                });
            }
        })
    } else {
        uni.chooseVideo({
            sourceType: ['album', 'camera'],
            extension: ['mp4'],
            success: (res) => {
                console.log('移动端选择视频成功', res)
                chunkUploading.value = true

                videoInfo.value = res
                localUrl.value = res.tempFilePath

                if (res.thumbTempFilePath) {
                    uploadImage(res.thumbTempFilePath)
                } else {
                    console.log('没有获取到视频封面图');
                }

                const nameIndex = localUrl.value.indexOf('tmp/')
                const length = localUrl.value.length
                fileName.value = localUrl.value.slice(nameIndex + 4, length)

                size.value = res.size
                chunkCount.value = Math.ceil(size.value / chunkSize.value);
                console.log('分片数量', chunkCount.value)
                getFileInfo(localUrl.value)
            },
            fail: (fail) => {
                console.error('移动端选择视频失败', fail)
                uni.showToast({
                    title: '选择视频失败',
                    icon: 'error',
                    duration: 2000
                });
            }
        })
    }
}

function handleFileName(filePath) {
    try {
        if (filePath.indexOf('/') !== -1) {
            const parts = filePath.split('/');
            fileName.value = parts[parts.length - 1];
        } else if (filePath.indexOf('\\') !== -1) {
            const parts = filePath.split('\\');
            fileName.value = parts[parts.length - 1];
        } else if (filePath.indexOf('tmp/') !== -1) {
            const nameIndex = filePath.indexOf('tmp/')
            fileName.value = filePath.slice(nameIndex + 4);
        } else {
            fileName.value = filePath;
        }

        console.log('处理后的文件名:', fileName.value);
    } catch (e) {
        console.error('处理文件名失败', e);
        const date = new Date();
        fileName.value = 'video_' + date.getTime() + '.mp4';
    }
}

function waiting() {
}

function error() {
}

function loadedmetadata() {
}

function submit() {
    console.log('submitGroup', status.value, formInfo, enoughInfo())
    if (!enoughInfo()) {
        return
    }
    loading.value = true
    let typesStr = ''
    console.log('this.types', types.value)
    types.value.forEach(item => {
        if (typesStr) {
            typesStr = typesStr + "," + item.id
        } else {
            typesStr = item.id
        }
    })
    let agentMap = {}
    formInfo.aiList.forEach(item => {
        agentMap[item.id] = item.name
    })

    let param = {
        courseId: props.courseId,
        binding: formInfo.binding,
        videoPath: formInfo.videoPath,
        title: formInfo.title,
        content: formInfo.content,
        remark: formInfo.remark,
        types: typesStr,
        agentMap: agentMap,
        auditStatus: formInfo.auditStatus
    }

    if (status.value == 'add') {
        addVideo(param).then(res => {
            console.log('addVideo', res)
            videoList.value.push({ ...formInfo })
            ok(videoList.value.length)
        }).finally(() => {
            loading.value = false
        })
    }

    if (status.value == 'edit') {
        param.id = formInfo.id
        videoPut(param).then(res => {
            console.log('videoPut', res)
            uni.showToast({
                title: '修改成功！请等待审核',
                icon: 'success',
                duration: 2000
            });
            getEdit()
        }).finally(() => {
            loading.value = false
        })
    }
}

function ok(index) {
    status.value = 'all'
    Object.assign(formInfo, videoList.value[index - 1] || videoList.value[0])
}

function toNext() {
    status.value = 'add'
    Object.assign(formInfo, {
        id: '',
        binding: '',
        videoPath: '',
        title: '',
        content: '',
        remark: '',
        aiList: [],
        auditStatus: 0
    })
    types.value = []
    typeList.value = []
    localUrl.value = ''
}

function changeVideo(index) {
    Object.assign(formInfo, videoList.value[index])
    if (formInfo.id) {
        status.value = 'edit'
    } else {
        status.value = 'all'
    }
}

function cancel() {
    Object.assign(formInfo, protoInfo.value)
    protoInfo.value = {}
    if (formInfo.id) {
        status.value = 'edit'
    } else {
        status.value = 'all'
    }
}

function handleDelete() {
    loading.value = true
    videoDelete([formInfo.id]).then(res => {
        uni.showToast({
            title: '删除成功！请等待审核',
            icon: 'success',
            duration: 2000
        });
        getEdit()
    }).finally(() => {
        loading.value = false
    })
}

function shangjia() {
    loading.value = true
    issue(formInfo.id).then(res => {
        getEdit()
        loading.value = false
    }).catch(() => {
        loading.value = false
    })
}

function getEdit(id) {
    console.log('getEdit', id)
    loading.value = true
    getVideoList({
        courseId: props.courseId,
        pageSize: 100,
        pageNum: 1,
        creator: userInfo.value.uuid
    }).then(res => {
        const arr = res.data
        let datas
        videoList.value = arr

        if (arr.length == 0) {
            status.value = 'add'
        } else {
            status.value = 'edit'
            if (id) {
                datas = arr.find(item => {
                    return item.id == id
                })
            } else {
                datas = arr[0]
            }
            let aiList = []
            if (datas.agentMap) {
                for (let key in datas.agentMap) {
                    aiList.push({
                        id: key,
                        name: datas.agentMap[key]
                    })
                }
            }
            typeList.value = datas.typeList

            Object.assign(formInfo, {
                id: datas.id,
                binding: datas.binding,
                videoPath: datas.videoPath,
                title: datas.title,
                content: datas.content,
                remark: datas.remark,
                aiList,
                auditStatus: datas.auditStatus
            })
            localUrl.value = datas.videoPath
        }
    }).finally(() => {
        loading.value = false
    })
}

function changeTypes(arr) {
    console.log('changeTypes', arr)
    types.value = arr
}

function uploadImage(imgUrl) {
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

                        uni.hideLoading();
                        uni.showToast({
                            title: '图片上传成功',
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

function changeImage() {
    uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
            uploadImage(res.tempFilePaths[0])
        }
    });
}

function enoughInfo() {
    if (!props.courseId) {
        uni.showToast({
            title: '请先发布合集',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    if (chunkUploading.value) {
        uni.showToast({
            title: '视频正在合成请稍后发布',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    if (!formInfo.binding) {
        uni.showToast({
            title: '请上传封面',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    if (!formInfo.videoPath) {
        uni.showToast({
            title: '请上传视频',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    if (!formInfo.title) {
        uni.showToast({
            title: '请输入课程标题',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    if (!formInfo.content) {
        uni.showToast({
            title: '请输入课程描述',
            icon: 'error',
            duration: 2000
        });
        return false
    }
    return true
}

function togetAgentsAlllist() {
    getAgentsAlllist({
        uuid: userInfo.value.uuid,
        agentName: agentName.value
    }).then(res => {
        aiOptions.value = res.data.agents
    })
}

function focusAiSearch() {
    showAiList.value = true
}

function blurAiSearch() {
}

function confirmSearch() {
}

function selectAi(obj) {
    for (let i = 0, len = formInfo.aiList.length; i < len; i++) {
        if (formInfo.aiList[i].id == obj.agentId) {
            formInfo.aiList.splice(i, 1)
            return
        }
    }
    formInfo.aiList.push({
        name: obj.agentName,
        id: obj.agentId
    })
    showAiList.value = false
}

function goback() {
    const pages = getCurrentPages();
    if (pages.length <= 1) {
        uni.switchTab({
            url: '/pagesA/studyindex/index'
        });
    } else {
        uni.navigateBack({
            delta: 1,
        });
    }
}
</script>
<style lang="scss" scoped>
.add_video_body {
    padding: 0 18rpx;
}

.group_image {
    height: 300rpx;
    width: 100%;
    box-sizing: border-box;
    font-size: 32rpx;
    font-weight: bold;
    color: rgba(0, 0, 0, 0.6);
}

.video_image {
    width: 100%;
    box-sizing: border-box;
    font-size: 32rpx;
    font-weight: bold;
    color: rgba(0, 0, 0, 0.6);
    padding: 0 auto;
}

.image {
    width: 444rpx;
    height: 250rpx;
    border-radius: 15rpx;
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
}

.study_icon_add_grad {
    width: 80rpx;
    height: 80rpx;
}

.study_icon_add_grad_empty {
    width: 200rpx;
    height: 200rpx;
}

.add_video_list {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 18rpx;
    flex-wrap: wrap;

    .video_image_item {
        width: 141rpx;
        height: 80rpx;
        border-radius: 8rpx;
        border: 2.5rpx solid #6C52FF;
    }

    .m_r {
        margin-right: 15rpx;
    }
}

.v_title_f {
    font-family: Alimama FangYuanTi VF !important;
    font-size: 32rpx;
    font-weight: bold;
    color: #999999;

    width: 100%;
    box-sizing: border-box;
    border: 1rpx solid #D8D8D8;
    border-radius: 8rpx;
    padding: 12rpx 15rpx;
    min-height: 72rpx; // height 不好使
}

//  下拉框
.select_option {
    width: 100%;
    max-height: 300rpx;
    box-sizing: border-box;
    border: 1rpx solid #D8D8D8;
    border-radius: 8rpx;
    overflow-y: scroll;
    position: relative;

    .s_i {
        width: 100%;
        height: 60rpx;
        box-sizing: border-box;
        padding: 0 16rpx;

        :active {
            background-color: #d9e6fd;
        }

        :hover {
            background-color: #d9e6fd;
        }
    }
}

.view_ai {
    flex-wrap: wrap;
    margin: 18rpx 0;

    .view_item {
        margin: 4rpx 12rpx 4rpx 0;
    }
}

.placeholder_color {
    color: #999999;
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
    color: #000000;
    margin: 18rpx 0;
    box-sizing: border-box;
    display: block;
}


.submit {
    width: 100%;
    height: 300rpx;
    box-sizing: border-box;
    flex-wrap: wrap;

    .btn {
        background: linear-gradient(268deg,
                rgba(217, 219, 254, 0.65) -207%,
                rgba(217, 219, 254, 0.65) -148%,
                rgba(217, 219, 255, 0.65) -122%,
                rgba(217, 219, 254, 0.65) -33%,
                rgba(217, 219, 255, 0.65) -17%,
                rgba(144, 125, 255, 0.65) 217%,
                rgba(224, 225, 252, 0.65) 302%);
        box-sizing: border-box;
        backdrop-filter: blur(10rpx);
        box-shadow: inset 0rpx -6rpx 20rpx 0rpx rgba(255, 255, 255, 0.8);
        width: 192rpx;
        height: 82rpx;
        font-size: 50rpx;
        font-weight: bold;
        letter-spacing: 0.1em;
        color: #FFFFFF;
    }
    .btn.btn-publish {
        background: #000;
        color: #fff;
        box-shadow: inset 0rpx -6rpx 20rpx 0rpx rgba(255, 255, 255, 0.1);
    }
}

.next_btn {
    width: 295rpx;
    height: 82rpx;
    border-radius: 15rpx;
    background: linear-gradient(106deg, rgba(228, 229, 255, 0.25) 4%, rgba(254, 255, 236, 0.25) 104%);
    border: 1rpx solid #EEEEEE;
    backdrop-filter: blur(10rpx);

    .btn_text {
        font-size: 36rpx;
        font-weight: bold;
        letter-spacing: 0.1em;
        color: #B0A6FF;
    }
}

.modal_overlay {
    position: fixed;
    z-index: 999;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
}

.color_bg {
    background: linear-gradient(239deg, #D19EFF 6%, rgba(255, 242, 0, 0.3) 32%, rgba(146, 146, 146, 0.3) 52%, rgba(255, 242, 0, 0.3) 73%, #CD96FF 93%);
    padding: 2rpx;
    border-radius: 15rpx;
    overflow: hidden;
    margin-bottom: 18rpx;
    width: 710rpx;

    .color_cont {
        width: 100%;
        background-color: #eee;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        border-radius: 15rpx;
        height: auto;
        box-sizing: border-box;
        padding: 4rpx 6rpx;
    }
}

.remark_btn {
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    position: absolute;
    bottom: calc(50vh - 68rpx);
    right: 37rpx;
    width: 100rpx;
    height: 40rpx;
    border-radius: 8px;
    background: linear-gradient(268deg,
            rgba(217, 219, 254, 0.65) -207%,
            rgba(217, 219, 254, 0.65) -148%,
            rgba(217, 219, 255, 0.65) -122%,
            rgba(217, 219, 254, 0.65) -33%,
            rgba(217, 219, 255, 0.65) -18%,
            rgba(144, 125, 255, 0.65) 217%,
            rgba(224, 225, 252, 0.65) 303%);
    box-sizing: border-box;
    box-shadow: inset 0px -6px 20px 0px rgba(255, 255, 255, 0.8);
    z-index: 50;
}

.remark_tip {
    font-family: Alimama FangYuanTi VF !important;
    font-size: 18rpx;
    font-weight: normal;
    color: rgba(0, 0, 0, 0.3);
}

.search-box2 {
    width: 35rpx;
    height: 35rpx;
    position: absolute;
    right: 33rpx;
    bottom: -256rpx;
    z-index: 50;
}

.search-box2-img {
    width: 35rpx;
    height: 35rpx;
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

.m_b {
    margin-bottom: 18rpx;
}

.title {
    font-family: Alimama FangYuanTi VF !important;
    font-size: 24rpx;
    font-weight: 600;
    color: #1A1A1A;
    margin: 15rpx 0;
}

.net_ai {
    font-family: Alimama FangYuanTi VF !important;
    font-size: 32rpx;
    font-weight: bold;
    color: #768DFF;
    margin: 15rpx 0;
}

.font_nomal {
    font-family: Alimama FangYuanTi VF !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #000000;
}
</style>
