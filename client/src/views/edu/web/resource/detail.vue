<template>
  <div class="resource-detail">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/resource' }">知识库</el-breadcrumb-item>
      <el-breadcrumb-item>详情</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="affix-wrap">
      <el-affix :offset="300">
        <div class="count-bar">
          <el-badge :value="resource.favoriteNum || 0" class="item" type="primary">
            <div @click="resourceFavorite" :class="{'active': resource.favorite && resource.favorite.id}">
              <span>收藏</span>
            </div>
          </el-badge>
        </div>
        <div class="count-bar">
          <el-badge :value="resource.likeNum || 0" class="item" type="primary">
            <div @click="resourceLike" :class="{'active': resource.like && resource.like.status}">
              <span>点赞</span>
            </div>
          </el-badge>
        </div>
      </el-affix>
    </div>
    <el-row :gutter="20">
      <el-col :span="18">
        <div class="resource-content" v-loading="resourceLoading">
          <div class="content">
            <div class="image-box" v-if="resource.image">
              <img :src="resource.image" alt="">
            </div>
            <div class="title-box">
              <h3>{{resource.title}}</h3>
              <div class="price">
                <div class="tag-wrap" v-if="resource.tags && resource.tags.length">
                  <span class="tag-lab">标签：</span>
                  <div class="tag" v-for="t in tagsFormat(resource.tags)" :key="t">
                    {{t}}
                  </div>
                </div>
                <div class="tag-wrap" v-if="resource.resourceProduct && resource.resourceProduct.id">
                  <span class="tag-lab">类别：</span>
                  <div class="tag primary-color">
                    {{resource.resourceProduct.name}}
                  </div>
                </div>
              </div>
              <div class="time">{{resource.createTime}}</div>
            </div>
            <div class="download-box" v-if="resource.url">
              <el-button class="download-btn" @click="previewResource">预览</el-button>
              <el-button class="download-btn" @click="downloadResource" :loading="downloadLoading">立即下载</el-button>
              <p>{{resource.downloadNum || 0}}次已下载</p>
            </div>
          </div>
          <div class="desc-box">
            <el-card shadow="never" style="border: 0;">
              <template #header>
                <div class="card-header">
                  <span>详情</span>
                </div>
              </template>
            </el-card>
            <div>
              <WangEditorShowIndex v-if="resource.introduction" :content="resource.introduction"/>
            </div>
          </div>
          <div class="comment">
            <el-card shadow="never" style="border: 0;">
              <template #header>
                <div class="card-header">
                  <span>评论</span>
                </div>
              </template>
            </el-card>
            <div style="margin-top: 20px">
              <comment-list topic-type="resource" :topic-id="resource.id" v-if="resource.id"/>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="right-box">
          <div class="circle-info">
            <div class="board-header">
              <div class="title">
                <span>创作业</span>
              </div>
            </div>
            <div class="board-info" v-if="resource && resource.member && resource.member.id" @click="gotoMemberDetail(resource.member.id)">
              <div class="board-left">
                <el-image :src="resource.member.avatar || ''">
                  <template #error>
                    <div class="image-slot">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
              </div>
              <div class="board-left">
                <div class="circle-name">{{resource.member.name || ''}}</div>
                <div class="circle-introduction">{{resource.member.signature || ''}}</div>
              </div>
            </div>
          </div>
          <div>
            <right-module/>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref, markRaw} from "vue"
import {ArrowRight} from '@/lib/lucide-fallback'
import {useRoute} from "vue-router";
import {getResource} from "@/api/edu/web/resource";
import CommentList from "@/views/edu/web/comment/list";
import {like} from "@/api/edu/web/comment/like";
import {favorite} from "@/api/edu/web/comment/favorite";
import {download} from "@/util/downloadUtils";
import {getToken} from "@/util/tokenUtils";
import RightModule from "@/views/edu/web/resource/right-module/index.vue";
import {gotoMemberDetail} from "@/api/edu/web/member";
import WangEditorShowIndex from "@/components/WangEditor/show.vue";
const Base64 = { encode: function(str) { return btoa(unescape(encodeURIComponent(str))) } };
export default {
  name: "ResourceIndex",
  methods: {gotoMemberDetail},
  components: {WangEditorShowIndex, RightModule, CommentList},
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const resource = ref({})
    const route = useRoute();
    const id = route.query.id;
    const resourceLoading = ref(true)
    getResource(id, res => {
      resource.value = res;
      resourceLoading.value = false
    })
    const showLoginFlag = inject("showLogin")
    const resourceLike = function() {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      like(resource.value, "resource")
    }
    const resourceFavorite = function() {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      favorite(resource.value, "resource")
    }
    const getFileSuffix = (url) => {
      if (!url) {
        var suffix;
        switch (resource.value.type) {
          case "word":
            suffix = "docx";
            break;
          case "excel":
            suffix = "xlsx";
            break;
          case "ppt":
            suffix = "pptx";
            break;
          case "pdf":
            suffix = "pdf";
            break;
          case "image":
            suffix = "png";
            break;
          case "txt":
            suffix = "txt";
            break;
          default:
            suffix = "txt"
            break;
        }
        return resource.value.title + "." + suffix;
      }
      var filePaths = url.split("/");
      var fileName = filePaths[filePaths.length - 1]
      return fileName;
    }
    const downloadLoading = ref(false)
    const downloadResource = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      downloadLoading.value = true;
      var host = window.location.origin
      download("/resource/auth-api/resource/download", {id: resource.value.id, host:host}, getFileSuffix(resource.value.url), () => {
        downloadLoading.value = false;
      }, () => {
        downloadLoading.value = false;
      })
    }
    const previewResource = function () {
      //要预览文件的访问地址
      var url = resource.value.url;
      var host = window.location.origin
      if (url.indexOf("/api") === 0) {
        url = host + url
      }
      window.open('http://chawind.com/fileview/onlinePreview?url='+encodeURIComponent(Base64.encode(url)));
    }
    const tagsFormat = function (tags) {
      if (tags && tags.length) {
        return tags.split(",")
      }
      return []
    }
    return {
      ArrowRight: ArrowRightIcon,
      resource,
      resourceLike,
      resourceFavorite,
      downloadResource,
      downloadLoading,
      resourceLoading,
      previewResource,
      tagsFormat
    }
  }
}
</script>

<style scoped lang="scss">
.affix-wrap {
  margin-left: -80px;
  position: absolute;
}
.resource-detail {
  margin: 20px 10px;
  position: relative;
}
.resource-content {
  //width: calc(100% - 292px);
  padding-top: 20px;
  width: 100%;
  display: inline-block;
  float: left;
  .content{
    background: #fff;
    padding: 0 0 20px 0;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    :deep(.el-card) {
      border: 0;
    }
    .image-box {
      width: 270px;
      height: 148px;
      margin-right: 20px;
      img {
        border-radius: 5px;
        width: 100%;
        height: 100%;
      }
    }
    .title-box {
      flex: 1;
      h3 {
        font-size: 18px;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }
      .price {
        margin-top: 10px;
        color: #19be6b;
        display: inline-block;
        .tag-wrap {
          display: inline-block;
          margin-right: 10px;
        }
        .tag-lab {
          color: #999999;
          font-size: 12px;
        }
        .tag {
          font-size: 12px;
          display: inline-block;
          margin-right: 10px;
          color: #999999;
          border-radius: 6px;
        }
        .primary-color {
          color: #19be6b;
        }
      }
      .time {
        color: #999999;
        display: inline-block;
        font-size: 12px;
      }
    }
    .download-box {
      width: 200px;
      margin-left: 20px;
      .download-btn {
        width: 100%;
        text-align: center;
        display: block;
        background: var(--el-color-primary);
        color: #fff;
        font-size: 14px;
        border-radius: 6px;
        border: 0;
        margin: 10px 0;
      }
      p {
        line-height: 30px;
        text-align: center;
        font-size: 14px;
        color: #999;
        margin-top: 5px;
      }
    }
  }
  .desc-box, .comment {
    margin-top: 10px;
  }
  .comment {
    margin-bottom: 20px;
  }
}
.right-box {
  border-radius: 6px;
  width: 100%;
  display: inline-block;
  margin-left: 10px;
  float: right;
  .circle-info {
    margin-bottom: 20px;
    width: 100%;
    .board-header {
      padding: 0 0 10px 0;
      .title {
        font-weight: 700;
        font-size: 14px;
      }
    }
    .board-info {
      border-radius: 6px;
      border: 1px solid #f0f0f0;
      background: #fff;
      display: flex;
      //flex-wrap: wrap;
      //justify-content: center;
      align-items: center;
      width: 100%;
      position: relative;
      overflow: hidden;
      //padding: 15px 20px;
      //box-sizing: border-box;
      //border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      &:hover {
        .circle-name {
          color: var(--el-color-primary);
        }
      }
      .el-image {
        font-size: 48px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        position: relative;
        align-items: center;
        //justify-content: center;
        object-fit: cover;
        margin: 10px;
        background-color: #f0f0f0;
        img {
          height: 100%;
          width: 100%;
        }
      }
      .circle-name {
        width: 100%;
        //text-align: center;
        font-size: 18px;
        //font-weight: 700;
        z-index: 1;
        //padding: 0 20px;
      }
      .circle-introduction {
        font-size: 12px;
        //margin: 10px 0;
        color: rgba(0,0,0,.45);
      }
      .el-button {
        display: block;
        margin: 10px auto 0;
        width: 120px;
        height: 40px;
        border-radius: 20px;
        font-size: 16px;
        color: #fff;
        text-align: center;
        border: none;
        text-shadow: unset;
        box-shadow: unset;
      }
    }
  }
}
.count-bar {
  //border: 1px solid #cccccc;
  //display: flex;
  //justify-content: space-between;
  //align-items: center;
  padding: 10px;
  border-radius: 50%;
  width: 28px;
  margin-bottom: 20px;
  background-color: #f0f0f0;
  div {
    cursor: pointer;
    //padding-top: 3px;
    text-align: center;
    width: 28px;
    font-size: 12px;
    color: rgba(0,0,0,.8);
    line-height: 28px;
    span {
      //margin-top: 7px;
      font-size: 12px;
      color: rgba(0,0,0,.5);
      display: block;
    }
    &:hover {
      color: var(--el-color-primary);
      span {
        color: var(--el-color-primary);
      }
    }
  }
  div.active {
    color: var(--el-color-primary);
    span {
      color: var(--el-color-primary);
    }
  }
}
:deep(.el-card__body) {
  padding: 0;
}
:deep(.el-card__header) {
  padding-left: 0;
}
.card-header {
  font-weight: 700;
}
</style>
