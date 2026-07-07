<template>
  <div class="question-detail">
    <el-breadcrumb style="margin: 0 0 20px 0;" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/ask' }">问答</el-breadcrumb-item>
      <el-breadcrumb-item>详情</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="question-header">
      <div class="tags" style="display: none">
        <a class="tag">
          程序        </a>
        <a class="tag">
          Java
        </a>
        <a class="tag">
          代码
        </a>
        <a class="tag">
          算法
        </a>
      </div>
      <div class="title">
        <h3>{{question.title}}</h3>
      </div>
      <div class="content">
        {{question.content}}
      </div>
      <div class="actions">
        <el-button type="primary" @click="showAnswerDialog" size="small" class="action" style="color: #fff;"><el-icon><Edit /></el-icon> 回答 </el-button>
        <el-button link class="action text">
          <el-icon><View /></el-icon> 查看 {{question.watchNum || 0}}
        </el-button>
        <el-button link class="action" :class="{'active': question.like && question.like.status}" @click="questionLike(question)">
          <el-icon><Pointer /></el-icon> 好问答{{question.likeNum || 0}}
        </el-button>
        <el-button link class="action" :class="{'active': question.showComment}" @click="question.showComment = !question.showComment">
          <el-icon><ChatDotSquare /></el-icon> 评论 {{question.commentNum || 0}}
        </el-button>
        <el-button link class="action" @click="questionFavorite(question)">
          <el-icon><Star /></el-icon> 收藏 {{question.favoriteNum || 0}}
        </el-button>
      </div>
      <div class="comment" v-if="question.showComment">
        <comment-list topic-type="question" :topic-id="question.id"/>
      </div>
    </div>
    <div class="answer-box">
      <el-row :gutter="20">
        <el-col :span="18" v-loading="answerLoading">
          <div class="answer" v-for="item in answerList" :key="item.id">
            <div class="meta">
              <div class="user-info" v-if="item.member" @click="gotoMemberDetail(item.member.id)">
                <div class="user-info-img">
                  <img :src="item.member.avatar || ''" alt="" v-if="item.member.avatar">
                </div>
                <div class="user-info-base">
                  <span>{{item.member.name || ''}}</span>
                  <p>{{item.member.createTime || ''}}</p>
                </div>
              </div>
            </div>
            <div class="answer-content" v-html="item.content"></div>
            <div class="answer-actions">
              <el-button link class="action" :class="{'active': item.like && item.like.status}" @click="answerLike(item)">
                <el-icon><Pointer /></el-icon> 有理 {{item.likeNum || 0}}
              </el-button>
              <el-button link class="action" :class="{'active': item.showComment}" @click="item.showComment = !item.showComment">
                <el-icon><ChatDotSquare /></el-icon> 评论 {{item.commentNum || 0}}
              </el-button>
              <el-button link class="action" @click="answerFavorite(item)">
                <el-icon><Star /></el-icon> 收藏 {{item.favoriteNum || 0}}
              </el-button>
            </div>
            <div class="comment" v-if="item.showComment">
              <comment-list topic-type="answer" :topic-id="item.id"/>
            </div>
          </div>
          <div class="load-more" v-if="answerList && answerList.length">
            <a v-if="moreAnswer" @click="loadMoreAnswer">点击查看更多</a>
            <span v-else style="line-height: 60px;font-size: 12px;">这是我的底线</span>
          </div>
          <div class="load-more" v-else>
            <el-empty style="background: #fff;margin: 0;padding: 45px 0;"/>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="author-box">
            <h4 class="header">关于作业</h4>
            <div class="content">
              <div class="meta">
                <div class="user-info" v-if="question.member" @click="gotoMemberDetail(question.member.id)">
                  <div class="user-info-img">
                    <img :src="question.member.avatar || ''" alt="" v-if="question.member.avatar">
                  </div>
                  <div class="user-info-base">
                    <span>{{question.member.name || ''}}</span>
                    <p>{{question.member.createTime || ''}}</p>
                  </div>
                </div>
              </div>
              <div class="section">
                <div class="author-counts">
                  <a class="author-count">
                    <div class="count-name">回答</div>
                    <strong class="count-value">{{countMap.answerCount || 0}}</strong>
                  </a>
                  <a class="author-count">
                    <div class="count-name">问题</div>
                    <strong class="count-value">{{countMap.questionCount || 0}}</strong>
                  </a>
                  <a class="author-count">
                    <div class="count-name">关注册</div>
                    <strong class="count-value">{{countMap.followCount || 0}}</strong>
                  </a>
                </div>
                <div class="author-buttons">
                  <el-button type="primary" class="author-button" :icon="isFollow ? null : Plus" @click="follow"> {{isFollow ? '取消关注' : '关注'}} </el-button>
                  <el-button class="author-button" :icon="Promotion" @click="privateLetter"> 发私</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
    <el-dialog title="回答问题" v-model="answerDialogVisible" width="80%">
      <span>
        <el-input :rows="10" type="textarea" v-model="answer"></el-input>
      </span>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="answerDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitAnswer">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
  import {useRoute} from "vue-router"
  import {countMemberAnswer, countMemberQuestion, getAnswerList, getQuestion, saveAnswer} from "@/api/edu/web/ask/index"
  import {inject, reactive, ref, markRaw} from "vue"
  import {ArrowRight, Plus, Promotion} from '@/lib/lucide-fallback'
  import {error, success} from "@/util/tipsUtils";
  import {like} from "@/api/edu/web/comment/like";
  import {favorite} from "@/api/edu/web/comment/favorite";
  import {getCommentList} from "@/api/edu/web/comment";
  import CommentList from "../../comment/list.vue";
  import {followMember, followMemberCount, gotoMemberDetail, isFollowMember, unfollowMember} from "@/api/edu/web/member";
  import router from "@/router";
  import {getToken} from "@/util/tokenUtils";

  export default {
    name: "QuestionIndex",
    methods: {gotoMemberDetail},
    components: {CommentList},
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight)
      const PlusIcon = markRaw(Plus)
      const PromotionIcon = markRaw(Promotion)
      const route = useRoute()
      const showLogin = inject("showLogin")
      // 获取问题详情
      const question = ref({})
      const isFollow = ref(false)
      const countMap = ref({
        followCount: 0,
        answerCount: 0,
        questionCount: 0
      })
      getQuestion({ id: route.query.id}, res => {
        question.value = res
        question.value.showComment = false
        // 获取评论数量
        getCommentList({topicId: res.id, topicType: 'question', size: 1}, r => {
          if (r && r.total !== undefined) {
            question.value.commentNum = r.total
          }
        })
        // 检查会员信息是否存在
        if (question.value.member && question.value.member.id) {
          isFollowMember(question.value.member.id, res => {
            isFollow.value = res && res.id
          })
          followMemberCount(question.value.member.id, res => {
            countMap.value.followCount = res
          })
          countMemberQuestion({memberId: question.value.member.id}, (res) => {
            countMap.value.questionCount = res
          })
          countMemberAnswer({memberId: question.value.member.id}, (res) => {
            countMap.value.answerCount = res
          })
        }
      })
      const follow = () => {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        if (!isFollow.value) {
          followMember(question.value.member.id, () => {
            success("关注成功")
            isFollow.value = true
          })
        } else {
          unfollowMember(question.value.member.id, () => {
            success("取消关注成功")
            isFollow.value = false
          })
        }
      }
      const privateLetter = () => {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        router.push({path: "/edu/message/private-letter", query: {memberId: question.value.member.id}})
      }
      // 获取答案
      const params = reactive({
        questionId: route.query.id,
        current: 1,
        size: 10
      })
      const moreAnswer = ref(true)
      const answerList = ref([])
      const answerLoading = ref(true)
      const loadAnswerList = () => {
        answerLoading.value = true
        getAnswerList(params, res => {
          answerList.value.push(...res.list)
          for (const valueElement of answerList.value) {
            valueElement.showComment = false
          }
          moreAnswer.value = res.list.length === params.size
          answerLoading.value = false
        })
      }
      loadAnswerList();
      // 加载更多答案
      const loadMoreAnswer = () => {
        params.current++
        loadAnswerList()
      }
      // 回答
      const answer = ref("")
      const answerDialogVisible = ref(false)
      const showAnswerDialog = () => {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        answerDialogVisible.value = true
      }
      const submitAnswer = () => {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        if (!answer.value) {
          error("答案内容为必填项")
          return
        }
        saveAnswer({content: answer.value, questionId: question.value.id}, () => {
          answer.value = "";
          params.current = 1
          answerList.value = []
          loadAnswerList();
          answerDialogVisible.value = false
        })
      }
      // 点赞
      const questionLike = function(item) {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        like(item, "question")
      }
      const answerLike = function(item) {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        like(item, "answer")
      }
      const questionFavorite = function(item) {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        favorite(item, "question")
      }
      const answerFavorite = function(item) {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        favorite(item, "answer")
      }
      return {
        ArrowRight: ArrowRightIcon,
        Plus: PlusIcon,
        Promotion: PromotionIcon,
        question,
        answerList,
        loadMoreAnswer,
        answerDialogVisible,
        showAnswerDialog,
        submitAnswer,
        answer,
        answerLoading,
        moreAnswer,
        questionLike,
        answerLike,
        questionFavorite,
        answerFavorite,
        follow,
        privateLetter,
        isFollow,
        countMap
      }
    }
  }
</script>

<style scoped lang="scss">
.question-detail {
  margin: 20px 10px;
  .question-header {
    background: #fff;
    padding: 20px 0;
    .tags {
      .tag {
        line-height: 30px;
        padding: 5px 10px;
        background: rgba(0,102,255,.1);
        color: #06f;
        border-radius: 10px;
        margin-right: 10px;
        margin-bottom: 12px;
        height: 30px;
        cursor: text;
      }
    }
    .title {
      background: #fff;
      margin-bottom: 4px;
      font-size: 22px;
      font-weight: 600;
    }
    .content {
      font-size: 14px;
      line-height: 30px;
      word-break: break-word;
      margin: 10px 0;
    }
    .actions {
      .action {
        margin-right: 10px;
        color: #8590a6;
        &:hover {
          color: var(--el-color-primary);
        }
      }
      .active {
        color: var(--el-color-primary);
      }
      .text {
        cursor: text;
        &:hover {
          color: #8590a6;
        }
      }
    }
    .comment {
      background: #fff;
      border-radius: 10px;
      margin-top: 10px;
    }
  }
  .answer-box {
    margin-top: 20px;
    min-height: 280px;
    .answer {
      transition: box-shadow .3s,-webkit-box-shadow .3s;
      margin-bottom: 10px;
      background: #fff;
      overflow: hidden;
      //border-radius: 2px;
      //box-shadow: 0 0px 1px rgb(18 18 18 / 50%);
      border-bottom: 1px solid #f0f0f0;
      padding: 20px 0;
      overflow: initial;
      .meta {
        font-size: 15px;
        color: #646464;
        .user-info {
          display: flex;
          align-items: center;
          cursor: pointer;
          &:hover {
            .user-info-base {
              span {
                color: var(--el-color-primary);
              }
            }
          }
          .user-info-base {
            font-size: 12px;
            display: inline-block;
            width: calc(100% - 50px);
            p {
              margin-top: 5px;
            }
          }
          .user-info-img {
            width: 40px;
            height: 40px;
            display: inline-block;
            object-fit: cover;
            margin-right: 10px;
            img {
              width: 100%;
              height: 100%;
              border-radius: 50%;
            }
          }
        }
      }
      .answer-content {
        margin: 15px 0 5px;
      }
      .answer-actions {
        .action {
          margin-right: 10px;
          color: #8590a6;
          &:hover {
            color: var(--el-color-primary);
          }
        }
        .active {
          color: var(--el-color-primary);
        }
      }
      .comment {
        background: #fff;
        border-radius: 10px;
        margin-top: 10px;
      }
    }
    .load-more {
      text-align: center;
      color: #cccccc;
      a {
        width: 100%;
        height: 50px;
        font-size: 15px;
        border: none;
        border-radius: 0;
        display: block;
        line-height: 50px;
        color: #8590a6;
        text-align: center;
        background: #fff;
        &:hover {
          color: var(--el-color-primary);
        }
      }
    }
    .author-box {
      .header {
        background: #ffffff;
        font-weight: 500;
        padding-left: 10px;
        line-height: 50px;
        border-bottom: 1px solid #f0f0f0;
      }
      .content {
        background: #fff;
        .meta {
          padding: 16px 20px;
          font-size: 15px;
          color: #646464;
          border-bottom: 1px solid #f5f5f5;
          min-height: 60px;
          .user-info {
            align-items: center;
            display: flex;
            cursor: pointer;
            &:hover {
              .user-info-base {
                span {
                  color: var(--el-color-primary);
                }
              }
            }
            .user-info-base {
              font-size: 12px;
              display: inline-block;
              width: calc(100% - 70px);
              span {
                font-size: 20px;
                line-height: 30px;
                color: #121212;
                font-weight: 600;
              }
              p {
                margin-top: 5px;
              }
            }
            .user-info-img {
              width: 60px;
              height: 60px;
              display: inline-block;
              object-fit: cover;
              margin-right: 10px;
              img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
              }
            }
          }
        }
        .section {
          padding: 16px 20px;
          position: relative;
          .author-counts {
            font-size: 14px;
            text-align: center;
            display: flex;
            .author-count {
              border: 0;
              line-height: unset;
              font-size: unset;
              flex: 1 1;
              cursor: default;
              .count-name {
                font-size: 14px;
                color: #8590a6;
              }
              .count-value {
                display: inline-block;
                font-size: 18px;
                color: #121212;
                font-weight: 600;
              }
              &:hover {
                .count-name {
                  //color: var(--el-color-primary);
                }
                .count-value {
                  //color: var(--el-color-primary);
                }
              }
            }
          }
          .author-buttons {
            display: flex;
            margin-top: 16px;
            padding: 12px 0;
            .author-button {
              flex: 1 1;
              min-width: 96px;
              width: 50%;
            }
          }
        }
      }
    }
  }
}
</style>
