<template>
  <div class="profile-container">
    <div class="profile-info-wrapper">
      <div class="profile-info-l">
        <a class="avatar">
          <div class="ttp-avatar auth-0 auth">
            <img v-if="member.avatar" :src="member.avatar" alt="">
          </div>
        </a>
        <div class="detail"><span class="name">{{member.name || ''}}</span>
          <div class="relation-stat">
            <button type="button" class="stat-item"><span class="num">{{fansTotal || 0}}<span class="unit"></span></span>粉丝</button>
            <button type="button" class="stat-item"><span class="num">{{followTotal || 0}}</span>关注</button>
          </div>
          <p class="user-auth-info" v-if="member.level"><span class="field">等级：</span>{{member.level.name}}</p>
          <p class="user-desc" v-if="member.description"><span class="field">简介：</span>{{member.description}}</p>
        </div>
      </div>
      <div class="profile-info-r" v-if="showBtn">
        <div class="right-actions">
          <button @click="follow" aria-pressed="false" class="ttp-user-subscribe profile-header-subscribe primary">
            <el-icon><Plus /></el-icon>
            <span>{{followFlag ? '取消关注' : '关注' }}</span>
          </button>
        </div>
        <div class="right-actions">
          <el-button @click="privateLetter" class="ttp-user-subscribe profile-header-subscribe">
            <el-icon><ChatDotRound /></el-icon>
            <span>私信</span>
          </el-button>
        </div>
      </div>
    </div>
    <div>
      <el-tabs v-model="activeName" class="demo-tabs" @tab-click="handleClick">
        <el-tab-pane label="知识" name="first">
          <div class="content-list" v-loading="resourceLoading">
            <resource-item :item-list="resourceList" :editable="false" :show-member="false"></resource-item>
            <page v-if="!resourceList && !resourceList.length" style="padding: 20px;" :page-size="resourceParam.size" :total="resourceParam.total" :current-change="resourceCurrentChange" :size-change="resourceSizeChange"></page>
          </div>
        </el-tab-pane>
        <el-tab-pane label="文章" name="second">
          <div v-if="!articleList || !articleList.length">
            <el-empty />
          </div>
          <div v-else class="article-wrap">
            <div class="card" v-for="item in articleList" :key="item.id" @click="goto('/edu/article/detail', item.id)">
              <h2 class="title">{{item.title}}</h2>
              <span class="time">{{item.createTime}}</span>
              <div class="content">
                <div class="cover" v-if="item.image.trim()">
                  <div class="cover-inner">
                    <img :src="item.image"/>
                  </div>
                </div>
                <div class="inner">
                  <div class="rich-text">
                    <p v-html="item.content"></p>
                  </div>
                  <el-button link class="more">阅读全文</el-button>
                </div>
              </div>
              <div class="actions">
                <el-button link class="action"><el-icon><View /></el-icon> {{item.createTime }} </el-button>
                <el-button link class="action"><el-icon><View /></el-icon> 浏览 {{item.watchNum || 0}} </el-button>
                <el-button link class="action"><el-icon><Pointer /></el-icon> 点赞 {{item.likeNum || 0}} </el-button>
                <el-button link class="action"><el-icon><ChatDotRound /></el-icon> 评论 {{item.commentNum || 0}}</el-button>
                <el-button link class="action"><el-icon><Star /></el-icon> 收藏 {{item.favoriteNum || 0}} </el-button>
              </div>
            </div>
            <page style="padding: 20px;" :total="articleParam.total" :page-size="articleParam.size" :current-change="articleCurrentChange" :size-change="articleSizeChange"></page>
          </div>
        </el-tab-pane>
        <el-tab-pane label="问答" name="third">
          <div v-if="!questionList || !questionList.length">
            <el-empty />
          </div>
          <div v-else class="ask-wrap">
            <div class="card" v-for="item in questionList" :key="item.id">
              <h2 class="title" @click="goto('/edu/ask/question', item.id)">{{item.title}}</h2>
              <span class="time">{{item.createTime}}</span>
              <div class="content" @click="goto('/edu/ask/question', item.id)">
                <div class="cover" v-if="item.image.trim()">
                  <div class="cover-inner">
                    <img :src="item.image"/>
                  </div>
                </div>
                <div class="inner">
                  <div class="rich-text">
                    {{item.content}}
                  </div>
                  <el-button link class="more">问题详情</el-button>
                </div>
              </div>
              <div class="actions">
                <el-button link class="action"><el-icon><View /></el-icon> {{item.createTime }} </el-button>
                <el-button link class="action"><el-icon><View /></el-icon> 查看 {{item.watchNum || 0}} </el-button>
                <el-button link class="action"><el-icon><Pointer /></el-icon> 好问答{{item.likeNum || 0}} </el-button>
                <el-button link class="action"><el-icon><ChatDotRound /></el-icon> {{item.commentNum || 0}}条评论</el-button>
                <el-button link class="action"><el-icon><Star /></el-icon> 收藏 {{item.favoriteNum || 0}} </el-button>
              </div>
            </div>
            <page style="padding: 20px;" :total="questionParam.total" :current-change="questionCurrentChange" :size-change="questionSizeChange" :page-size="questionParam.size"></page>
          </div>
        </el-tab-pane>
        <el-tab-pane label="社区" name="fourth">
          <div v-if="!circleList || !circleList.length">
            <el-empty/>
          </div>
          <div v-else class="circle-wrap">
            <div class="card joinCircle-item" v-for="item in circleList" :key="item.id">
              <h2 class="title" @click="goto('/edu/circle/detail', item.id)">{{item.name}}</h2>
              <span class="time">{{item.createTime}}</span>
              <div class="content" :class="{'show-more': item.showMore}" @click="toggleMore(item)">
                <div class="cover" v-if="item.image.trim()">
                  <div class="cover-inner">
                    <img :src="item.image"/>
                  </div>
                </div>
                <div class="inner">
                  <div class="rich-text">
                    {{item.introduction}}
                  </div>
                  <el-button link class="more">{{item.showMore ? '收起' : '展开'}}</el-button>
                </div>
              </div>
              <div class="actions">
                <el-button link class="action"><el-icon><View /></el-icon> {{item.createTime }} </el-button>
                <el-button link class="action"><el-icon><Pointer /></el-icon> 成员 {{item.memberNum || 0}} </el-button>
                <el-button link class="action"><el-icon><ChatDotRound /></el-icon> 动{{item.dynamicNum || 0}}</el-button>
              </div>
            </div>
            <page style="padding: 20px;" :page-size="circleParam.size" :total="circleParam.total" :current-change="circleCurrentChange" :size-change="circleSizeChange"></page>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script>
import {inject, ref} from "vue"
import {getFollowMemberList, getFollowFansMemberList, unfollowMember, followMember, getMemberById, isFollowMember} from "@/api/edu/web/member";
// import MemberMenu from "@/views/edu/web/member/menu";
// import Page from "@/components/Page";
import {success} from "@/util/tipsUtils";
import router from "@/router";
import {getToken} from "@/util/tokenUtils";
import ResourceItem from "@/views/edu/web/resource/resourceItem.vue";
import Page from "@/components/Page/index.vue";
import {getMemberResourceList} from "@/api/edu/web/resource";
import {useRoute} from "vue-router";
import {getMemberArticleList} from "@/api/edu/web/content/article";
import {getMemberQuestionList} from "@/api/edu/web/ask";
import {getMemberJoinCircleList} from "@/api/edu/web/circle";
import {Plus} from '@/lib/lucide-fallback';
import {getUser} from "@/util/userUtils";

export default {
  name: "noticeFollow",
  components: {Plus, Page, ResourceItem},
  setup() {
    const route = useRoute();
    const loginMember = getUser();
    // 会员ID
    const memberId = route.query.id
    const followFlag = ref(false);
    const followTotal = ref(0)
    const fansTotal = ref(0)
    const showBtn = ref(false)
    //
    const activeName = ref('first')
    const handleClick = (tab, event) => {
    }
    const follow = () => {
      if (followFlag.value) {
        unfollowMember(memberId, () => {
          loadMember()
          success("取消关注成功")
        })
      } else {
        followMember(memberId, () => {
          loadMember()
          success("关注成功")
        })
      }
    }
    const privateLetter = () => {
      if (!memberId) {
        return;
      }
      router.push({path: "/edu/message/private-letter", query: {memberId: memberId}})
    }

    // 登录
    const showLoginFlag = inject("showLogin")
    const showLoginClose = inject("showLoginClose")
    if (!getToken()) {
      showLoginFlag.value = true
      showLoginClose.value = false
      return
    }

    // 获取会员信息
    const member = ref({})
    const loadMember = function () {
      getMemberById(memberId, res => {
        if (res) {
          member.value = res;
          showBtn.value = !loginMember || !loginMember.id || loginMember.id !== member.value.id
        }
      })
      // 是否关注当前用户
      isFollowMember(memberId, res => {
        followFlag.value = res && res.id;
      })
      // 粉丝人数
      getFollowMemberList({
        memberId: memberId,
        current: 1,
        size: 1
      }, res => {
        fansTotal.value = res.total;
      })
      // 关注者
      getFollowFansMemberList({
        followMemberId: memberId,
        current: 1,
        size: 1
      }, res => {
        followTotal.value = res.total;
      })
    }
    loadMember()

    // 获取知识列表
    const resourceParam = ref({
      memberId: memberId,
      current: 1,
      size: 20,
      keyword: "",
      total: 0
    })
    const resourceLoading = ref(true)
    const resourceList = ref([])
    // const resourceLisTotal = ref(0)
    const loadResourceList = () => {
      resourceLoading.value = true
      getMemberResourceList(resourceParam.value, res => {
        resourceList.value = res.list
        resourceParam.value.total = res.total
        resourceLoading.value = false
      })
    }
    const resourceCurrentChange = (currentPage) => {
      resourceParam.value.current = currentPage;
      loadResourceList();
    }
    const resourceSizeChange = (s) => {
      resourceParam.value.size = s;
      loadResourceList();
    }
    loadResourceList();

    // 文章
    const articleParam = ref({
      memberId: memberId,
      current: 1,
      size: 20,
      total: 0
    })
    const articleLoading = ref(true)
    const articleList = ref([])
    const articleCurrentChange = (currentPage) => {
      articleParam.value.current = currentPage;
      loadResourceList();
    }
    const articleSizeChange = (s) => {
      articleParam.value.size = s;
      loadResourceList();
    }
    const loadArticleList = () => {
      articleLoading.value = true
      getMemberArticleList(articleParam.value, res => {
        articleList.value = res.list
        articleParam.value.total = res.total
        articleLoading.value = false
      })
    }
    loadArticleList()

    // 问题
    const questionParam = ref({
      memberId: memberId,
      current: 1,
      size: 20,
      total: 0
    })
    const questionLoading = ref(true)
    const questionList = ref([])
    const questionCurrentChange = (currentPage) => {
      questionParam.value.current = currentPage;
      loadResourceList();
    }
    const questionSizeChange = (s) => {
      questionParam.value.size = s;
      loadResourceList();
    }
    const loadQuestionList = () => {
      questionLoading.value = true
      getMemberQuestionList(questionParam.value, res => {
        questionList.value = res.list
        questionParam.value.total = res.total
        questionLoading.value = false
      })
    }
    loadQuestionList()

    // 社区
    const circleParam = ref({
      memberId: memberId,
      current: 1,
      size: 20,
      total: 0
    })
    const circleLoading = ref(true)
    const circleList = ref([])
    const circleCurrentChange = (currentPage) => {
      circleParam.value.current = currentPage;
      loadResourceList();
    }
    const circleSizeChange = (s) => {
      circleParam.value.size = s;
      loadResourceList();
    }
    const toggleMore = (item) => {
      item.showMore = !item.showMore
    }
    const loadCircleList = () => {
      circleLoading.value = true
      getMemberJoinCircleList(circleParam.value, res => {
        circleList.value = res.list
        circleParam.value.total = res.total
        circleLoading.value = false
      })
    }
    loadCircleList()

    const goto = (path, id) => {
      if (id) {
        router.push({ path: path, query: { id: id } })
      } else {
        router.push({ path })
      }
    }

    return {
      showBtn,
      followFlag,
      followTotal,
      fansTotal,
      follow,
      privateLetter,
      activeName,
      handleClick,
      // 知识
      resourceLoading,
      resourceList,
      resourceParam,
      resourceCurrentChange,
      resourceSizeChange,
      // 文章
      articleParam,
      articleLoading,
      articleList,
      articleCurrentChange,
      articleSizeChange,
      // 问题
      questionParam,
      questionLoading,
      questionList,
      questionCurrentChange,
      questionSizeChange,
      // 社区
      circleParam,
      circleLoading,
      circleList,
      circleCurrentChange,
      circleSizeChange,
      member,
      loginMember,
      goto,
      toggleMore
    }
  }
}
</script>

<style lang="scss" scoped>
.content-container {
  .msg-list {
    background: #FFFFFF;
    margin: 20px 0;
    padding: 20px;
    .msg-item {
      display: inline-block;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      margin-bottom: 24px;
      border-radius: 6px;
      border: 1px solid #f0f0f0;
      cursor: pointer;
      transition: all .3s;
      width: calc(100% - 24px);
      flex: 0 0 calc(100% - 24px);
      padding: 32px 12px;
      text-align: center;
      &:hover {
        box-shadow: 0 2px 25px rgb(0 0 0 / 15%);
      }
      .msg-item-avatar {
        width: 80px;
        height: 80px;
        display: block;
        margin: 0 auto;
        .msg-item-avatar-item {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 1px solid #f0f0f0;
          font-size: 80px;
        }
        img {
          width: 100%;
          height: 100%;
        }
      }
      .user-name {
        margin-top: 16px;
        font-size: 16px;
        color: #505050;
        text-align: center;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .button-group {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 24px;
        .el-button {
          &:not(:last-child) {
            margin-right: 20px;
          }
        }
      }
    }
  }
}

.profile-info-wrapper {
  position: relative;
  margin: 40px auto;
  width: 100%;
  justify-content: space-between;
}

.profile-info-wrapper,.profile-info-wrapper>.profile-info-l {
  display: -moz-box;
  display: -ms-flexbox;
  display: flex;
  -moz-box-pack: start;
  -ms-flex-pack: start;
  justify-content: flex-start
}

.profile-info-wrapper>.profile-info-l {
  margin-right: 60px;
  width: 676px
}

.profile-info-wrapper>.profile-info-l .avatar {
  display: block;
  margin-right: 40px;
  font-size: 0
}

.profile-info-wrapper>.profile-info-l .avatar .ttp-avatar {
  border: 3px solid #fff;
  width: 112px;
  height: 112px
}

.profile-info-wrapper>.profile-info-l .avatar .ttp-avatar:before {
  right: 5px;
  bottom: 5px;
  width: 20px;
  height: 20px
}

.profile-info-wrapper>.profile-info-l .name {
  display: block;
  margin-bottom: 8px;
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  font-size: 24px;
  font-weight: 600;
  line-height: 34px;
  white-space: nowrap;
  color: #222
}

.profile-info-wrapper>.profile-info-l .user-auth-info,.profile-info-wrapper>.profile-info-l .user-desc {
  word-break: break-all;
  font-size: 16px;
  line-height: 20px;
  color: #222
}

.profile-info-wrapper>.profile-info-l .user-auth-info .field,.profile-info-wrapper>.profile-info-l .user-desc .field {
  font-weight: 500
}

.profile-info-wrapper>.profile-info-l .user-auth-info {
  margin-bottom: 8px
}

.profile-info-wrapper>.profile-info-l .user-desc {
  white-space: pre-wrap
}

.profile-info-wrapper>.profile-info-l .more-info {
  margin-top: 16px;
  padding-right: 16px;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  color: #222;
  border: none;
  background: transparent;
  position: relative
}

.profile-info-wrapper>.profile-info-l .more-info:after {
  content: "";
  position: absolute;
  top: 50%;
  right: 0;
  -webkit-transform: translateY(-50%);
  -moz-transform: translateY(-50%);
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  background: url(//lf3-cdn2-tos.bytescm.com/toutiao/toutiao_web_pc/svgs/icon_right_black.1de869c7.svg) no-repeat 50%;
  background-size: contain
}

.profile-info-wrapper .right-actions {
  margin: 10px 0;
}

.profile-info-wrapper .ttp-user-subscribe.profile-header-subscribe {
  border-radius: 6px;
  width: 180px;
  height: 36px;
  color: #666666;
  background: #e5e7eb;
}
.profile-info-wrapper .ttp-user-subscribe.profile-header-subscribe.primary {
  background: var(--el-color-primary);
  color: #fff;
}

.profile-info-wrapper .ttp-user-subscribe.profile-header-subscribe .plus-icon {
  margin-right: 4px;
  width: 8px;
  height: 8px;
  background-image: url(//lf3-cdn2-tos.bytescm.com/toutiao/toutiao_web_pc/svgs/icon_plus_white.67edef38.svg)
}

.profile-info-wrapper .ttp-user-subscribe.profile-header-subscribe span {
  margin-left: 0
}

.profile-info-wrapper .ttp-user-subscribe.profile-header-subscribe.following {
  color: #999;
  background: #f8f8f8;
}

.profile-info-wrapper .ttp-user-subscribe.profile-header-subscribe.following:hover {
  opacity: .8
}

.profile-info-wrapper .ttp-user-subscribe.profile-header-subscribe.followed {
  font-size: 14px
}

.ttp-avatar {
  position: relative;
  display: inline-block;
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  border: 1px solid #f0f0f0;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  background: url(data:image/png;base64,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) no-repeat 50%;
  background-size: contain
}

.ttp-avatar.large {
  width: 60px;
  height: 60px
}

.ttp-avatar.middle {
  width: 44px;
  height: 44px
}

.ttp-avatar.small {
  width: 32px;
  height: 32px
}

.ttp-avatar.auth:before {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  width: 13px;
  height: 13px;
  background: transparent no-repeat 50%;
  background-size: contain
}

.ttp-avatar.auth.large:before {
  width: 17px;
  height: 17px
}

.ttp-avatar.auth-0:before {
  background-image: url(//lf3-cdn2-tos.bytescm.com/toutiao/toutiao_web_pc/svgs/auth_0.600aa73b.svg)
}

.ttp-avatar.auth-1:before {
  background-image: url(//lf3-cdn2-tos.bytescm.com/toutiao/toutiao_web_pc/svgs/auth_1.9fe8a9f6.svg)
}

.ttp-avatar.auth-2:before {
  background-image: url(//lf3-cdn2-tos.bytescm.com/toutiao/toutiao_web_pc/svgs/auth_2.ac774735.svg)
}

.ttp-avatar img {
  border-radius: 50%;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover
}

.ttp-user-subscribe {
  display: -moz-box;
  display: -ms-flexbox;
  display: flex;
  -moz-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  -moz-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  border: none;
  border-radius: 6px;
  width: 64px;
  height: 32px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: #222;
  background: #f8f8f8;
  cursor: pointer
}

.ttp-user-subscribe:hover {
  opacity: .8
}

.ttp-user-subscribe .plus-icon {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: url(//lf3-cdn2-tos.bytescm.com/toutiao/toutiao_web_pc/svgs/icon_plus.23a99274.svg) no-repeat 50%;
  background-size: contain
}

.ttp-user-subscribe .loading-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAqCAMAAADyHTlpAAAAVFBMVEVHcEz///////////////////////////////////////////////////////////////////////////////////////////////////////////+DS+nTAAAAHHRSTlMAQSVmHAlMFQMOLjeDwpikjXtVce/ZXa/N++S5UDf/KQAAAblJREFUOMuN1NuWgyAMBVAFAnJREO/6//85idgu2yrOeWlXu5uSGC2K32iliufokjfTVtf11rSlzkDT+mnD1JR5np29gcpN07S97Uxx4kpK7yeyZzkMA/+B0PpEnbRKKWZ4g5Ks/zqyCp6oj1AU1fGZ4NtAqT8OAbv0I3wWEC3RtT7X7ZrG+8B+G7D1sK7rdOqowYTLuYsa6fruTd1LtFR2fR13JMrurotF2R9HYKEJTby/hm7t+z5dtzGE4DILogekPg0KI3M71CJdaWCGaHbrNNJ+xDcRJc+v5tYvS8BX7pwr85QvSz/TSZwLLE/lgpZmgXm4QQTSRReaqP4HFYVuMQ+0SpsJ/6BFhaEFRMqeJOyUt21nHygAEC27rot5Cgc1SDvIFtVa7xQ40uwJAGlqXCLlkCuqlE7fC5Q8UxalUscdLznvuLgtKlC+/lRzzKjvJOZVFIeAcoz6VopTJxLpKC/2CxijouffRqRjNF9zqBRjZKuPLsnGKBmcoTE7rb4KlCjRSstwiAD03DQ7/ZbUW6JSlhhLIWsumwWbJFlbJnlR8njOmVfVvaxhuS3CVmyS5jT37H5eqT+9yx1r7w1/7gAAAABJRU5ErkJggg==) no-repeat 50%;
  background-size: contain;
  -webkit-animation: loadingRotate 1s linear infinite;
  -moz-animation: loadingRotate 1s linear infinite;
  animation: loadingRotate 1s linear infinite
}

.ttp-user-subscribe span {
  margin-left: 4px
}

.ttp-user-subscribe.followed .loading-icon,.ttp-user-subscribe.following .loading-icon {
  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAqBAMAAAA37dRoAAAAJ1BMVEVHcEyZmZmYmJiZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZnw1FD6AAAADXRSTlMADBwwR12HcvPE252wIz/fRAAAAZ9JREFUKM9lkj9PwkAYxu8EZG2RYOIEJYJxgh7GuKmUaOIiCacDiyApJiwaU2ri4p+YXHAxbjR8ADhX06UMjiL9UF4ppe31hubNL0+f5717XwC8AyUQOenmbDgyj8Jwf2qPhuxcB2HGtmczBg2j7cP43LYdrWEY9HaV88hgR5byTWNCv4QlLUyteX1Rbf9R+rmU9qxpfSkoUjpxxUnL8qMPKP1ZFGeWmV3RNWPwtjCwrFagyV1KHE3C6pUCNDYeOxYF8zt0zRvyyr4XZitEt8g7s1V7hyGaJAMBxFRVCFFIyDlIqF3uUX/JFaMdjj6QD5BU2xw9JU9gPUJ3yDPI9FsR+gIy3VZ0imCzf8cRCFnT3XteKAggofMUimySusZRkTnEdF3gKNMCXS9xBg490ethmnNo8TIcl8o5E4prWjYolVJODtS0oMWa5G7sHsaBLiQp5+4exse+qyS5EogxLnv/y7K38mncaJQ9KHvRsIZriiyKMI+QLPv70mjUFKWqMIgCwRsMKtUqQijYOsgzqlQqKBd+qBRSKkgWorMS/fIffZdpZ+vBF+AAAAAASUVORK5CYII=)
}

.ttp-user-subscribe.following {
  color: #999
}

.ttp-user-subscribe.followed {
  font-size: 13px
}

.relation-stat {
  margin-top: 8px;
  margin-bottom: 24px
}

.relation-stat .stat-item {
  display: inline-block;
  border: none;
  margin-right: 40px;
  font-size: 14px;
  line-height: 24px;
  color: #505050;
  background: none;
  cursor: pointer
}

.relation-stat .stat-item .num {
  display: inline-block;
  margin-right: 4px;
  font-size: 24px;
  font-weight: 700;
  font-family: ByteNumber-center;
  line-height: 28px;
  color: #222
}

.relation-stat .stat-item .unit {
  display: inline-block;
  margin-left: 2px;
  font-size: 18px;
  line-height: 22px;
  font-family: 'HarmonyOS Sans SC', 'EDIX', sans-serif
}

.article-wrap {
  .card {
    background: #fff;
    box-sizing: border-box;
    border-radius: 0;
    overflow: visible;
    overflow: initial;
    position: relative;
    padding: 20px 0;
    margin-bottom: 0;
    -webkit-box-shadow: none;
    box-shadow: none;
    border-bottom: 1px solid #f0f2f7;
    cursor: pointer;
    &:first-child {
      padding-top: 0;
      .time {
        top: 0;
      }
    }
    &:hover {
      .title {
        color: var(--el-color-primary);
      }
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      line-height: 1.9;
      color: #121212;
      margin-top: -4px;
      margin-bottom: -4px;
      cursor: pointer;
      width: calc(100% - 142px);
      &:hover {
        color: var(--el-color-primary);
      }
    }
    .time {
      position: absolute;
      top: 20px;
      right: 20px;
      color: #999;
    }
    .content {
      cursor: pointer;
      transition: color .14s ease-out;
      line-height: 1.97;
      .cover {
        position: relative;
        width: 190px;
        height: 105px;
        margin-top: -2px;
        margin-right: 18px;
        margin-bottom: 4px;
        float: left;
        overflow: hidden;
        background-position: 50%;
        background-size: cover;
        border-radius: 6px;
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        .cover-inner {
          position: absolute;
          top: 50%;
          left: 0;
          height: 100%;
          width: 100%;
          -webkit-transform: translateY(-50%);
          transform: translateY(-50%);
          overflow: hidden;
          img {
            position: absolute;
            top: 50%;
            left: 50%;
            height: 100%;
            width: 100%;
            -o-object-fit: cover;
            object-fit: cover;
            -webkit-transform: translate3d(-50%,-50%,0);
            transform: translate3d(-50%,-50%,0);
          }
        }
        &:after {
          content: "";
          position: absolute;
          z-index: 1;
          display: block;
          width: 100%;
          height: 100%;
          background: rgba(18,18,18,.02);
        }
      }
      .inner {
        margin-bottom: -4px;
        overflow: hidden;
        max-height: 100px;
        margin-top: 16px;
        .rich-text {
          pointer-events: none;
          line-height: 1.9;
          cursor: pointer;
          display: -webkit-box;
          white-space: normal;
          word-break: break-word;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .more {
          display: inline-block;
          font-size: 14px;
          text-align: center;
          cursor: pointer;
          margin-left: 4px;
          color: #175199;
          height: auto;
          padding: 0;
          line-height: inherit;
          background-color: transparent;
          border: none;
          border-radius: 0;
        }
        .more {
          float: right;
          margin-top: -26px;
          position: relative;
          background: #fff;
          &::after {
            content: "";
            position: absolute;
            display: block;
            top: 0;
            left: -30px;
            width: 30px;
            height: 100%;
            background: linear-gradient(
                    270deg, #fff, hsla(0, 0%, 100%, .2));
          }
        }
      }
      &:hover {
        .inner {
          .more {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .show-more {
      .inner {
        height: auto;
        max-height: none;
        .rich-text {
          -webkit-line-clamp: inherit;
        }
      }
    }
    .actions {
      align-items: center;
      padding: 10px 20px;
      margin: 0 -20px -10px;
      color: #646464;
      clear: both;
      background: #fff;
      .action {
        margin-left: 24px;
        font-size: 14px;
        color: #646464;
        cursor: text;
        &:first-child {
          margin-left: 0;
        }
      }
      .float-right {
        float: right;
        cursor: pointer;
        &:hover {
          color: var(--el-color-primary);
        }
      }
    }
  }
}

.ask-wrap {
  .card {
    background: #fff;
    box-sizing: border-box;
    border-radius: 0;
    overflow: visible;
    overflow: initial;
    position: relative;
    padding: 20px 0;
    margin-bottom: 0;
    -webkit-box-shadow: none;
    box-shadow: none;
    border-bottom: 1px solid #f0f2f7;
    &:first-child {
      padding-top: 0;
      .time {
        top: 0;
      }
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      line-height: 1.9;
      color: #121212;
      margin-top: -4px;
      margin-bottom: -4px;
      cursor: pointer;
      width: calc(100% - 142px);
      &:hover {
        color: var(--el-color-primary);
      }
    }
    .time {
      position: absolute;
      top: 20px;
      right: 20px;
      color: #999;
    }
    .content {
      cursor: pointer;
      transition: color .14s ease-out;
      line-height: 1.97;
      .cover {
        position: relative;
        width: 190px;
        height: 105px;
        margin-top: -2px;
        margin-right: 18px;
        margin-bottom: 4px;
        float: left;
        overflow: hidden;
        background-position: 50%;
        background-size: cover;
        border-radius: 6px;
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        .cover-inner {
          position: absolute;
          top: 50%;
          left: 0;
          height: 100%;
          width: 100%;
          -webkit-transform: translateY(-50%);
          transform: translateY(-50%);
          overflow: hidden;
          img {
            position: absolute;
            top: 50%;
            left: 50%;
            height: 100%;
            width: 100%;
            -o-object-fit: cover;
            object-fit: cover;
            -webkit-transform: translate3d(-50%,-50%,0);
            transform: translate3d(-50%,-50%,0);
          }
        }
        &:after {
          content: "";
          position: absolute;
          z-index: 1;
          display: block;
          width: 100%;
          height: 100%;
          background: rgba(18,18,18,.02);
        }
      }
      .inner {
        margin-bottom: -4px;
        overflow: hidden;
        max-height: 100px;
        margin-top: 16px;
        .rich-text {
          pointer-events: none;
          line-height: 1.9;
          cursor: pointer;
          display: -webkit-box;
          white-space: normal;
          word-break: break-word;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .more {
          display: inline-block;
          font-size: 14px;
          text-align: center;
          cursor: pointer;
          margin-left: 4px;
          color: #175199;
          height: auto;
          padding: 0;
          line-height: inherit;
          background-color: transparent;
          border: none;
          border-radius: 0;
        }
        .more {
          float: right;
          margin-top: -26px;
          position: relative;
          background: #fff;
          &::after {
            content: "";
            position: absolute;
            display: block;
            top: 0;
            left: -30px;
            width: 30px;
            height: 100%;
            background: linear-gradient(
                    270deg, #fff, hsla(0, 0%, 100%, .2));
          }
        }
      }
      &:hover {
        .inner {
          .more {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .show-more {
      .inner {
        height: auto;
        max-height: none;
        .rich-text {
          -webkit-line-clamp: inherit;
        }
      }
    }
    .actions {
      align-items: center;
      padding: 10px 20px;
      margin: 0 -20px -10px;
      color: #646464;
      clear: both;
      background: #fff;
      .action {
        margin-left: 24px;
        font-size: 14px;
        color: #646464;
        cursor: text;
        &:first-child {
          margin-left: 0;
        }
      }
      .float-right {
        float: right;
        cursor: pointer;
        &:hover {
          color: var(--el-color-primary);
        }
      }
    }
  }
}

.circle-wrap {
  .card {
    background: #fff;
    box-sizing: border-box;
    border-radius: 0;
    overflow: visible;
    overflow: initial;
    position: relative;
    padding: 20px 0;
    margin-bottom: 0;
    -webkit-box-shadow: none;
    box-shadow: none;
    border-bottom: 1px solid #f0f2f7;
    &:first-child {
      padding-top: 0;
      .time {
        top: 0;
      }
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      line-height: 1.9;
      color: #121212;
      margin-top: -4px;
      margin-bottom: -4px;
      cursor: pointer;
      width: calc(100% - 142px);
      &:hover {
        color: var(--el-color-primary);
      }
    }
    .time {
      position: absolute;
      top: 20px;
      right: 20px;
      color: #999;
    }
    .content {
      cursor: pointer;
      transition: color .14s ease-out;
      line-height: 1.97;
      .cover {
        position: relative;
        width: 190px;
        height: 105px;
        margin-top: -2px;
        margin-right: 18px;
        margin-bottom: 4px;
        float: left;
        overflow: hidden;
        background-position: 50%;
        background-size: cover;
        border-radius: 6px;
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        .cover-inner {
          position: absolute;
          top: 50%;
          left: 0;
          height: 100%;
          width: 100%;
          -webkit-transform: translateY(-50%);
          transform: translateY(-50%);
          overflow: hidden;
          img {
            height: 100%;
            width: 100%;
          }
        }
        &:after {
          content: "";
          position: absolute;
          z-index: 1;
          display: block;
          width: 100%;
          height: 100%;
          background: rgba(18,18,18,.02);
        }
      }
      .inner {
        margin-bottom: -4px;
        overflow: hidden;
        max-height: 100px;
        margin-top: 16px;
        .rich-text {
          pointer-events: none;
          line-height: 1.9;
          cursor: pointer;
          display: -webkit-box;
          white-space: normal;
          word-break: break-word;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .more {
          display: inline-block;
          font-size: 14px;
          text-align: center;
          cursor: pointer;
          margin-left: 4px;
          color: #175199;
          height: auto;
          padding: 0;
          line-height: inherit;
          background-color: transparent;
          border: none;
          border-radius: 0;
        }
        .more {
          float: right;
          margin-top: -26px;
          position: relative;
          background: #fff;
          &::after {
            content: "";
            position: absolute;
            display: block;
            top: 0;
            left: -30px;
            width: 30px;
            height: 100%;
            background: linear-gradient(
                    270deg, #fff, hsla(0, 0%, 100%, .2));
          }
        }
      }
      &:hover {
        .inner {
          .more {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .show-more {
      .inner {
        height: auto;
        max-height: none;
        .rich-text {
          -webkit-line-clamp: inherit;
        }
      }
    }
    .actions {
      align-items: center;
      padding: 10px 20px;
      margin: 0 -20px -10px;
      color: #646464;
      clear: both;
      background: #fff;
      .action {
        margin-left: 24px;
        font-size: 14px;
        color: #646464;
        cursor: text;
        &:first-child {
          margin-left: 0;
        }
      }
      .float-right {
        float: right;
        cursor: pointer;
        &:hover {
          color: var(--el-color-primary);
        }
      }
    }
  }
}
</style>
