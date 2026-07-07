<template>
  <div class="live-box">
    <el-container>
      <el-header>
        <div class="live-header">
          <!--          <div class="header-item content-icon">-->
          <!--            <i class="el-icon-menu"></i>-->
          <!--          章节-->
          <!--          </div>-->
          <div class="header-item content-icon" onclick="window.history.back();">
            <el-icon><Back /></el-icon>
            返回
          </div>
          <div class="header-item current-task-name">
            {{channel.name}}
          </div>
          <div class="header-item float-right" @click="commentView(channel)">
            <el-icon><ChatLineSquare /></el-icon> 评论 {{channel.commentNum || 0}}
          </div>
          <div class="header-item float-right" :class="{'active': channel.favorite && channel.favorite.id}" @click="channelFavorite(channel)">
            <el-icon><Star /></el-icon> 收藏 {{channel.favoriteNum || 0}}
          </div>
          <div class="header-item float-right" :class="{'active': channel.like && channel.like.status}" @click="channelLike(channel)">
            <el-icon><Pointer /></el-icon> 点赞 {{channel.likeNum || 0}}
          </div>
          <div class="header-item float-right text">
            {{channel.learnNum || 0}} 人在线          </div>
        </div>
      </el-header>
      <el-main class="custom-main">
        <div class="video-box" id="yjs-video" :style="{height: screenHeight +'px'}">
          <div class="overlay" v-if="channel.status === 'inactive'">
            <p class="title">老师已经下课了！</p>
            <p class="next">点击下方按钮刷新上课状态</p>
            <div class="btn-wrap">
              <span class="btn next-btn" @click="loadChannel">刷新一</span>
            </div>
          </div>
          <div class="controller-box">
            <div class="controller-item">
              <el-icon @click="togglePlaying">
                <VideoPause v-if="playing"/>
                <VideoPlay v-else/>
              </el-icon>
            </div>
            <div class="controller-item audio-box">
              <el-icon @click="toggleMute"><Microphone /></el-icon>
              <el-slider v-model="audioValue" @change="changeAudio"></el-slider>
            </div>
            <div class="controller-item full-screen-box">
              <el-icon title="全屏" @click="toggleFullScreen"><FullScreen /></el-icon>
            </div>
          </div>
        </div>
      </el-main>
    </el-container>
    <comment-drawer topic-type="channel" :drawer-close="drawerClose" :show-drawer="drawer" :topic="selectTopic"/>
  </div>
</template>

<script>
import { onMounted, ref, markRaw } from "vue"
import { getChannel } from "@/api/edu/web/live"
import { useRoute } from "vue-router"
import CommentDrawer from "@/views/edu/web/comment/drawer/commentDrawer";
import {like} from "@/api/edu/web/comment/like";
import {favorite} from "@/api/edu/web/comment/favorite";
import {getCommentList} from "@/api/edu/web/comment";
import {Back, ChatLineSquare, VideoPlay, VideoPause, Microphone, FullScreen, Star, Pointer} from '@/lib/lucide-fallback';
export default {
  name: "LiveDetail",
  components: {
    CommentDrawer
  },
  setup() {
    // 获取高度
    const screenHeight = ref(document.documentElement.clientHeight - 60)
    window.onresize = () => {
      return (() => {
        screenHeight.value = document.documentElement.clientHeight - 60;
      })()
    }
    const route = useRoute()
    // 直播id
    const channelId = route.query.id
    // 是否正在播放
    const playing = ref(false)
    const channel = ref({})
    // 声音频
    const audioValue = ref(50)
    // 拉流地址
    let pullUrl;
    // video对象
    let video;
    const initVideo = () => {
      video = new window.TcPlayer("yjs-video", {
        //请替换成实际可用的播放地址
        "m3u8": pullUrl,
        //iOS safari 浏览器，以及大部分移动端浏览器是不开放视频自动播放这个能力的
        "autoplay" : false,
        "poster" : "",
        //视频的显示宽度，请尽量使用视频分辨率宽度
        "width" :  "100%",
        //视频的显示高度，请尽量使用视频分辨率高度
        "height" : "100%",
        "live": true,
        "controls": "system",
        "volume": 0.5,
        // 监听事件
        "listener": msg => {
          playing.value = !!video.playing();
        }
      })
    }
    const loadChannel = () => {
      getChannel({id: channelId}, data => {
        pullUrl = data.stream.pullUrl
        channel.value = data
        // 获取评论数量
        getCommentList({topicId: data.id, topicType: 'channel', size: 1}, r => {
          if (r && r.total !== undefined) {
            channel.value.commentNum = r.total
          }
        })
        // 直播中才加载
        if (data.status === "active") {
          initVideo()
        }
      })
    }
    onMounted(() => {
      loadChannel()
    })
    // 播放/暂停
    const togglePlaying = () => {
      if (playing.value) {
        video.pause()
      } else {
        video.play()
      }
      playing.value = !playing.value
    }
    // 静音/非静
    let beforeValue = 0
    const toggleMute = () => {
      if (audioValue.value === 0) {
        video.volume(beforeValue)
        audioValue.value = beforeValue;
      } else {
        beforeValue = audioValue.value
        video.volume(0)
        audioValue.value = 0
      }
    }
    // 改变声音
    const changeAudio = val => {
      video.volume(val / 100)
    }
    // 全屏
    const toggleFullScreen = () => {
      video.fullscreen(true)
    }
    // 查看评论
    const selectTopic = ref({})
    const drawer = ref(false)
    const drawerClose = (done) => {
      drawer.value = false
      done()
    }
    const commentView = (item) => {
      drawer.value = true
      selectTopic.value = item
    }
    const channelLike = function() {
      like(channel.value, "channel")
    }
    const channelFavorite = function() {
      favorite(channel.value, "channel")
    }
    return {
      screenHeight,
      togglePlaying,
      playing,
      channel,
      audioValue,
      toggleMute,
      changeAudio,
      toggleFullScreen,
      drawerClose,
      commentView,
      drawer,
      selectTopic,
      channelLike,
      channelFavorite,
      loadChannel,
      Back: markRaw(Back),
      ChatLineSquare: markRaw(ChatLineSquare),
      VideoPlay: markRaw(VideoPlay),
      VideoPause: markRaw(VideoPause),
      Microphone: markRaw(Microphone),
      FullScreen: markRaw(FullScreen),
      Star: markRaw(Star),
      Pointer: markRaw(Pointer)
    }
  }
}
</script>

<style scoped lang="scss">
.live-box {
  width: 100%;
  min-height: 560px;
  position: relative;
  :deep(.el-header) {
    padding: 0;
  }
  :deep(.el-overlay) {
    background: none;
    &:focus {
      outline: none;
    }
  }
  :deep(.el-drawer__container) {
    &:focus {
      outline: none;
    }
  }
  .live-header {
    width: 100%;
    background: #fff;
    align-items: center;
    height: 60px;
    .header-item {
      display: inline-block;
      height: 100%;
      vertical-align: middle;
      text-align: center;
      line-height: 60px;
      margin: 0 10px;
      cursor: pointer;
      &:not(.text):not(.current-task-name):hover {
        color: var(--el-color-primary);
      }
    }
    .header-item.active {
      color: var(--el-color-primary);
    }
    .float-right {
      float: right;
    }
    .text {
      color: #999999;
      cursor: text;
    }
    .content-icon {
      font-size: 16px;
      line-height: 60px;
      cursor: pointer;
      margin-left: 10px;
    }
    .current-task-name {
      overflow: hidden;
      white-space: nowrap;
      -o-text-overflow: ellipsis;
      text-overflow: ellipsis;
      font-size: 16px;
      line-height: 60px;
      max-width: 400px;
      text-align: left;
      cursor: default;
    }
  }
  :deep(.custom-main) {
    padding: 0;
  }
  .video-box {
    width: 100%;
    height: 100%;
    border: 0;
    position: relative;
    background: #000;
    &:hover .controller-box {
      height: 48px;
    }
    .overlay {
      position: absolute;
      top: 32%;
      width: 100%;
      text-align: center;
      .title {
        font-size: 24px;
        text-indent: .5em;
        color: #ccc;
      }
      .next {
        margin: 25px 0;
        font-size: 18px;
        color: #999;
      }
      .btn-wrap {
        margin-top: 25px;
        .btn {
          display: inline-block;
          width: 170px;
          height: 48px;
          line-height: 48px;
          font-size: 18px;
          vertical-align: middle;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn.next-btn {
          color: #fff;
          background-color: var(--el-color-primary);
        }
      }
    }
  }
  .controller-box {
    width: calc(100% - 80px);
    margin: 0 40px;
    height: 48px;
    background: rgba(0, 0, 0, 0.5);
    position: absolute;
    left: 0;
    bottom: 40px;
    z-index: 99;
    border-radius: 8px;
    align-items: center;
    justify-content: flex-end;
    padding: 0 20px;
    box-sizing: border-box;
    display: none;
    .controller-item {
      display: inline-block;
      margin-right: 10px;
      i {
        font-size: 30px;
        color: #fff;
        cursor: pointer;
        line-height: 48px;
      }
    }
    .audio-box {
      i {
        margin-right: 5px;
      }
      :deep(.el-slider) {
        display: inline-block;
        line-height: 48px;
        width: 120px;
      }
      :deep(.el-slider__runway) {
        line-height: 48px;
        margin: 0 0 10px 0;
      }
      :deep(.el-slider__runway), :deep(.el-slider__bar){
        height: 2px;
      }
      :deep(.el-slider__button-wrapper) {
        top: -6px;
        height: 14px;
        width: 14px;
        display: flex;
      }
      :deep(.el-slider__button) {
        background: #fff;
        height: 14px;
        width: 14px;
      }
    }
    .full-screen-box {
      float: right;
      margin: 0;
    }
  }
}
#yjs-video :deep(video) {
  object-fit: unset;
}
</style>
