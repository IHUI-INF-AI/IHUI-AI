<template>
    <view class="comment">
        <Loading v-if="loading"></Loading>
        <scroll-view class="s_v" :scroll-top="0" scroll-y lower-threshold="50" @scrolltolower="scrolltolower">
            <view>
                <text class="comment_title">热门评论</text>

                <view class="s_i" v-for="(item, index) in commentList" :key="index">
                    <view class="header">
                        <image class="icon_head" :src="item.avatar" />
                        <view>
                            <text class="name">{{ item.nickname ? item.nickname : '' }}</text>
                            <text class="date">{{ item.createdAt ? item.createdAt : '' }}</text>
                        </view>
                    </view>
                    <view class="context">{{ item.content }}</view>
                    <view class="btns" v-if="item.id && item.id != 0">
                        <image class="icon_info" src="https://file.aizhs.top/sys-mini/xtk/study_comment_info.png"
                            @click="showTalk(item)" />
                    </view>
                    <view class="comments" v-if="item.showTalk">
                        <view class="c_i">
                            <text class="name">{{ userInfo.nickname + "：" }}</text>
                            <text class="con">{{ childContext }}</text>
                        </view>
                    </view>
                    <view class="comments" v-if="item.videoComments && item.videoComments.length > 0">
                        <view class="c_i" v-for="(com, index) in item.videoComments" :key="index">
                            <text class="name">{{ com.nickname + "：" }}</text>
                            <text class="con">{{ com.content }}</text>
                        </view>
                    </view>
                </view>
            </view>
        </scroll-view>
        <SearchInput ref="SearchInputRef" @change="searchChange" :isIos="isIos"></SearchInput>
    </view>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import SearchInput from '@/components/SearchInput/index.vue'
import { getUserVideoCommentList, userVideoComment } from '@/service/study.js'
import Loading from "@/components/loading/index.vue";

const props = defineProps({
    videoId: String,
    remark: String
})

const SearchInputRef = ref(null)
const isIos = ref(false)
const commentList = ref([])
const pageNum = ref(1)
const pageSize = 10
const total = ref(0)
const userInfo = ref({})
const childContext = '请输入回复内容...'
const parentId = ref('')
const loading = ref(false)

onMounted(() => {
    userInfo.value = uni.getStorageSync('data');
    getData()
})

onShow(() => {
    const systemInfo = uni.getSystemInfoSync();
    isIos.value = systemInfo.platform === 'ios';
})

function showTalk(item) {
    if (parentId.value) {
        parentId.value = ''
        item.showTalk = false
    } else {
        parentId.value = item.id
        item.showTalk = true
    }
}

function searchChange(val) {
    console.log('searchChange', val)
    loading.value = true
    let param = {
        videoId: props.videoId,
        userUuid: userInfo.value.uuid,
        content: val,
        parentId: parentId.value
    }

    userVideoComment(param).then(res => {
        if (parentId.value) {
            parentId.value = ''
        }
        SearchInputRef.value.clear()
        getData()
    }).catch(() => {
        loading.value = false
    })
}

function getData() {
    console.log('remark', props.remark)
    loading.value = true
    getUserVideoCommentList({
        pageNum: pageNum.value,
        pageSize: pageSize,
        videoId: props.videoId
    }).then(res => {
        commentList.value = res.data
        total.value = res.total
        if (props.remark) {
            commentList.value.unshift({
                id: 0,
                content: props.remark
            })
        }

    }).finally(() => {
        loading.value = false
    })
}

function scrolltolower() {
    if (commentList.value.length < total.value) {
        pageNum.value++
        getData()
    }
}
</script>
<style lang="scss" scoped>
.comment {
    margin-top: 14rpx;
    width: 100%;
    box-sizing: border-box;

    .comment_title {
        font-size: 26rpx;
        font-weight: 600;
        color: #000;
    }

    .s_v {
        height: calc(100vh - 854rpx);

        .s_i {
            margin-top: 17rpx;
            border-bottom: 1px solid rgb(0 0 0 / 0.1);
            padding-bottom: 12rpx;

            .header {
                display: flex;

                .icon_head {
                    width: 60rpx;
                    height: 60rpx;
                    border-radius: 8rpx;
                    margin-right: 8rpx;
                }

                .name {
                    font-size: 26rpx;
                    font-weight: normal;
                    color: #000;
                }

                .date {
                    font-size: 22rpx;
                    font-weight: normal;
                    color: rgb(0 0 0 / 0.6);
                }
            }

            .context {
                margin-left: 67rpx;
                white-space: pre-wrap;
                margin-bottom: 8rpx;
                color: #757575;
                word-break: break-all;
                width: calc(100% - 100rpx);
            }

            .btns {
                display: flex;
                flex-direction: row-reverse;
                align-items: center;

                .icon_info {
                    width: 44rpx;
                    height: 40rpx;
                    margin-left: 11rpx;
                }

                .menber {
                    font-size: 26rpx;
                    font-weight: bold;
                    color: rgb(0 0 0 / 0.6);
                    margin-left: 7rpx;
                }

                .icon_like {
                    width: 44rpx;
                    height: 44rpx;
                }
            }

            .comments {
                width: 100%;
                box-sizing: border-box;
                margin-left: 67rpx;
                padding: 10rpx 19rpx;
                border-radius: 15rpx;
                background: #F4F4F4;

                .c_i {
                    display: flex;
                    margin-bottom: 14rpx;

                    .name {
                        font-size: 22rpx;
                        font-weight: normal;
                        color: #8D83FF;
                    }

                    .con {
                        font-size: 22rpx;
                        font-weight: normal;
                        color: #757575;
                    }
                }
            }
        }
    }
}
</style>
