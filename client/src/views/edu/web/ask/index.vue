<template>
  <div class="question-list-box">
    <el-breadcrumb style="margin: 0 0 20px 0;" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/ask' }">问答</el-breadcrumb-item>
    </el-breadcrumb>
    <el-row :gutter="20">
      <el-col :span="18" v-loading="questionLoading">
        <div class="card-header">
          <div class="header-list-wrapper">
            <div class="header-list" :class="{'expanded': categoryExpanded}">
              <div :class="{'active': selectedCid === ''}" class="header-item" @click="categoryChange('')">最新问题</div>
              <div :class="{'active': selectedCid === item.id}" class="header-item" @click="categoryChange(item.id)" v-for="item in categoryList" :key="item.name">{{item.name}}</div>
            </div>
            <div class="expand-btn" @click="categoryExpanded = !categoryExpanded" v-if="categoryList.length > 10">
              <span>{{ categoryExpanded ? '收起' : '展开' }}</span>
              <el-icon :class="{'rotated': categoryExpanded}"><ArrowDown /></el-icon>
            </div>
          </div>
        </div>
        <el-empty style="background: #ffffff;position: relative;" v-if="!questions || !questions.length"/>
        <div class="card" v-for="item in questions" :key="item.id">
          <h2 class="title" @click="goto('/edu/ask/question', item.id)">{{item.title}}</h2>
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
              <el-button link class="more">阅读全文</el-button>
            </div>
          </div>
          <div class="actions">
            <el-button link class="action"><el-icon><View /></el-icon> 查看 {{item.watchNum || 0}} </el-button>
            <el-button link class="action"><el-icon><Pointer /></el-icon> 好问答{{item.likeNum || 0}} </el-button>
            <el-button link class="action"><el-icon><ChatDotSquare /></el-icon> {{item.answerNum || 0}}条回答</el-button>
            <el-button link class="action"><el-icon><Star /></el-icon> 收藏 {{item.favoriteNum || 0}} </el-button>
          </div>
        </div>
        <div v-if="questions && questions.length" style="margin: 20px 0;">
          <page :total="total" :page-size="params.size" :current-change="currentChange" :size-change="sizeChange"></page>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="nav-box">
          <a class="item" @click="issueQuestions">
            <svg width="40" height="40" viewBox="0 0 40 40" class="icon" fill="currentColor"><g fill="none" fill-rule="evenodd"><circle cx="20" cy="20" r="20" fill="#F4C807" opacity=".12"></circle><path d="M6 6h28v28H6z"></path><path fill="#F4C807" d="M20.406 11.772l-2.172 2.176h-2.29c-1.438 0-1.875.085-2.322.324-.33.176-.575.422-.751.752-.24.448-.324.886-.324 2.326v7.12c0 1.44.085 1.878.324 2.326.176.33.421.576.75.752.421.225.834.314 2.08.323l7.35.001c1.438 0 1.876-.084 2.323-.324.33-.176.575-.422.751-.752.24-.448.324-.886.324-2.326v-4.905l2.172-2.175v7.08c0 1.94-.202 2.643-.58 3.352a3.95 3.95 0 01-1.643 1.645c-.708.379-1.41.58-3.346.58h-7.108c-1.936 0-2.639-.201-3.347-.58a3.95 3.95 0 01-1.642-1.645c-.378-.71-.58-1.413-.58-3.352v-7.12c0-1.94.202-2.643.58-3.352a3.95 3.95 0 011.642-1.645c.708-.379 1.41-.58 3.347-.58h4.462zm6.908-2.053c.384.116.747.338 1.168.759l.188.189c.42.421.642.785.758 1.17a1.98 1.98 0 010 1.163c-.116.385-.337.749-.758 1.17l-6.9 6.911c-.62.622-.827.81-1.078 1.004-.251.193-.496.34-.784.47-.288.131-.553.226-1.392.48l-1.088.332a1.303 1.303 0 01-1.625-1.629l.33-1.09c.255-.84.35-1.104.48-1.393.13-.29.277-.534.47-.785.193-.252.381-.46 1.001-1.081l6.9-6.911c.42-.421.784-.643 1.168-.76a1.97 1.97 0 011.162 0zm-3.204 4.096l-4.797 4.805c-.547.548-.709.723-.852.91-.112.146-.19.276-.265.443-.097.214-.175.44-.4 1.182l-.094.31.31-.095c.74-.225.965-.303 1.179-.4.167-.076.297-.154.442-.266.187-.143.361-.305.909-.853l4.797-4.805-1.23-1.23zm2.546-2.43c-.109.033-.23.11-.443.324l-.874.875 1.228 1.231.875-.876c.213-.213.29-.334.323-.444a.24.24 0 000-.153c-.033-.11-.11-.23-.323-.445l-.189-.188c-.213-.214-.334-.291-.443-.325a.238.238 0 00-.154 0z" fill-rule="nonzero"></path></g></svg>
            <div class="title">提出问题</div>
          </a>
          <a class="item" @click="goMyProblem">
            <svg width="40" height="40" viewBox="0 0 40 40" class="icon" fill="currentColor"><g fill="#26BFBF" fill-rule="evenodd"><circle cx="20" cy="20" r="20" opacity=".12"></circle><path d="M21.987 11.686v2.169h-6.125c-1.43 0-1.863.064-2.297.306-.332.128-.574.383-.74.702-.255.447-.332.893-.332 2.297v7.018c0 1.442.09 1.876.332 2.297.166.345.408.587.74.766.434.23.868.319 2.297.319h7.018c1.43 0 1.863-.077 2.297-.32.345-.165.587-.408.766-.74.216-.408.296-.816.305-2.054l.001-6.316.025.025h2.17v6.074c0 1.914-.217 2.616-.587 3.318a3.92 3.92 0 01-1.634 1.62c-.689.383-1.403.575-3.317.575h-7.018c-1.915 0-2.616-.204-3.318-.575a3.891 3.891 0 01-1.62-1.62c-.384-.702-.575-1.404-.575-3.318v-7.018c0-1.914.204-2.629.574-3.318a3.996 3.996 0 011.62-1.633c.703-.383 1.404-.574 3.318-.574h6.1zm1.889 6.954c1.059 1.06 1.059 2.807 0 3.88l-.039.038a2.719 2.719 0 01-3.879 0l-2.45-2.553a.801.801 0 00-1.123 0l-.05.052c-.32.357-.32.893 0 1.212a.75.75 0 00.726.217c.51-.128 1.047.23 1.149.74a.946.946 0 01-.727 1.148 2.649 2.649 0 01-2.527-.74 2.796 2.796 0 010-3.905l.038-.025c1.098-1.085 2.808-1.085 3.892 0l2.463 2.488a.764.764 0 001.11 0l.038-.025a.855.855 0 000-1.187.876.876 0 00-.74-.217c-.51.128-1.02-.204-1.148-.727-.128-.51.204-1.021.727-1.149l.013-.013a2.703 2.703 0 012.527.766zm4.338-9.315v2.578h2.578v1.722h-2.578v2.59h-1.723v-2.602h-2.59v-1.71h2.59V9.325h1.723z" fill-rule="nonzero"></path></g></svg>
            <div class="title">我的问题</div>
          </a>
          <a class="item" @click="goMyProblem">
            <svg width="40" height="40" viewBox="0 0 40 40" class="icon" fill="currentColor"><g fill="#06F" fill-rule="evenodd"><circle cx="20" cy="20" r="20" opacity=".12"></circle><path d="M23.487 10.463c1.896 0 2.583.193 3.277.555a3.824 3.824 0 011.607 1.573c.371.678.569 1.35.569 3.206v8.472c0 1.855-.198 2.527-.569 3.205a3.824 3.824 0 01-1.607 1.573c-.694.363-1.381.556-3.277.556h-6.96c-1.895 0-2.583-.193-3.276-.556a3.824 3.824 0 01-1.608-1.573c-.37-.678-.568-1.35-.568-3.205v-8.472c0-1.855.197-2.528.568-3.206.37-.678.915-1.21 1.608-1.573.693-.362 1.38-.556 3.277-.556h6.959zm0 2.08h-6.96c-1.407 0-1.836.081-2.273.31a1.72 1.72 0 00-.735.72c-.234.427-.317.847-.317 2.224v8.472c0 1.377.083 1.796.317 2.224.172.316.412.551.735.72.437.229.866.31 2.274.31h6.959c1.407 0 1.836-.081 2.274-.31a1.72 1.72 0 00.735-.72c.234-.428.317-.847.317-2.224v-8.472c0-1.377-.083-1.797-.317-2.225a1.72 1.72 0 00-.735-.72c-.438-.228-.867-.309-2.274-.309zm-1.991 9.778v1.873h-5.955V22.32h5.955zm2.977-3.328v1.872h-8.932v-1.872h8.932zm0-3.33v1.873h-8.932v-1.872h8.932z" fill-rule="nonzero"></path></g></svg>
            <div class="title">我的回答</div>
          </a>
        </div>
        <div class="recommend-ask" v-if="hotQuestionList && hotQuestionList.length">
          <h4 class="header">热门推荐</h4>
          <div class="content" v-loading="htoQuestionLoading">
            <a v-for="item in hotQuestionList" :key="item.id" @click="goto(item.id)" class="item">
              <div class="img-box" v-if="item.image.trim()">
                <img :src="item.image"/>
              </div>
              <div class="personal" :style="item.image.trim() ? '' : 'width: calc(100% - 10px);'">
                <div class="title">{{item.title}}</div>
                <div class="meta" v-if="item.member">
                  <img :src="item.member.avatar || ''" alt="" class="avatar" v-if="item.member.avatar">
                  <span class="name">{{item.member.name || ''}}</span>
                  <span class="time">{{item.createTime}}</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </el-col>
    </el-row>
    <question-edit v-model="dialogVisible" :cancel-callback="cancelQuestionDialog" :submit-callback="submitQuestion"/>
  </div>
</template>

<script>
import {useRouter} from "vue-router"
import {inject, ref, markRaw} from "vue"
import {ArrowRight, ArrowDown} from '@/lib/lucide-fallback'
import {getQuestionList, getCategoryList} from "@/api/edu/web/ask"
import page from "@/components/Page"
import {getToken} from "@/util/tokenUtils";
import QuestionEdit from "@/views/edu/web/ask/edit";

export default {
  name: "AskIndex",
  components: {
    QuestionEdit,
    page
  },
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const ArrowDownIcon = markRaw(ArrowDown)
    const route = useRouter()
    const categoryList = ref([])
    const categoryExpanded = ref(false)
    // 加载目录
    getCategoryList({id: 0, fetchAll: false}, res => {
      categoryList.value = res
    })
    // 获取问题列表
    const questions = ref([])
    const total = ref(0)
    const params = ref({
      current: 1,
      size: 20,
      cid: ""
    })
    const questionLoading = ref(true)
    // 获取问题列表
    const loadQuestionList = () => {
      questionLoading.value = true
      questions.value = []
      getQuestionList(params.value, res => {
        questions.value.push(...res.list)
        total.value = res.total
        questionLoading.value = false
      }).catch(() => {
        questionLoading.value = false
      })
    }
    loadQuestionList()
    const currentChange = (current) => {
      params.value.current = current;
      loadQuestionList();
    }
    const sizeChange = (s) => {
      params.value.size = s;
      loadQuestionList();
    }
    // 跳转
    const goto = (path, id) => {
      // 校验用户是否登录
      if (id) {
        route.push({ path, query: { id } })
      } else {
        route.push({ path })
      }
    }
    const showLoginFlag = inject("showLogin")
    // 我的问答
    const goMyProblem = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      route.push({ path: "/edu/member/ask" })
    }
    // 提出问题
    const dialogVisible = ref(false)
    const issueQuestions = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      dialogVisible.value = true
    }
    // 提问
    const submitQuestion = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      dialogVisible.value = false
      params.value.current = 1
      loadQuestionList();
    }
    const cancelQuestionDialog = () => {
      dialogVisible.value = false
    }
    const selectedCid = ref("")
    const categoryChange = (id) => {
      params.value.cid = id
      selectedCid.value = id
      loadQuestionList()
    }
    // 热门推荐
    const hotQuestionList = ref([])
    const htoQuestionLoading = ref(true)
    const loadHotQuestionList = () => {
      htoQuestionLoading.value = true
      getQuestionList({current: 1, size: 10}, res => {
        hotQuestionList.value.push(...res.list)
        htoQuestionLoading.value = false
      }).catch(() => {
        htoQuestionLoading.value = false
      })
    }
    loadHotQuestionList()
    return {
      ArrowRight: ArrowRightIcon,
      ArrowDown: ArrowDownIcon,
      categoryExpanded,
      questionLoading,
      questions,
      params,
      currentChange,
      sizeChange,
      total,
      goto,
      issueQuestions,
      dialogVisible,
      submitQuestion,
      showLoginFlag,
      goMyProblem,
      cancelQuestionDialog,
      categoryList,
      categoryChange,
      selectedCid,
      hotQuestionList,
      htoQuestionLoading
    }
  }
}
</script>

<style scoped lang="scss">
  .question-list-box {
    padding-top: 20px;
    margin: 0 10px;
    .card-header{
      background: #ffffff;
      border-radius: 6px;
      border: 1px solid #f0f0f0;
      padding: 10px 15px;
      .header-list-wrapper {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .header-list {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        background: #ffffff;
        display: flex;
        flex-wrap: wrap;
        max-height: 80px;
        overflow: hidden;
        transition: max-height 0.3s ease;
        &.expanded {
          max-height: 500px;
        }
        .header-item {
          margin: 5px 10px;
          padding: 6px 0;
          cursor: pointer;
          white-space: nowrap;
          &:hover {
            color: var(--el-color-primary);
          }
        }
        .header-item.active {
          color: var(--el-color-primary);
          border-bottom: 2px solid var(--el-color-primary);
        }
      }
      .expand-btn {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background: #fff;
        font-size: 12px;
        color: #666;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        margin-top: 5px;
        &:hover {
          border-color: var(--el-color-primary);
          color: var(--el-color-primary);
        }
        .el-icon {
          font-size: 12px;
          transition: transform 0.3s;
          &.rotated {
            transform: rotate(180deg);
          }
        }
      }
    }
    .card {
      background: #fff;
      box-sizing: border-box;
      border-radius: 0;
      overflow: visible;
      overflow: initial;
      position: relative;
      padding: 20px;
      margin-bottom: 0;
      -webkit-box-shadow: none;
      box-shadow: none;
      border-bottom: 1px solid #f0f2f7;
      .title {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.9;
        color: #121212;
        margin-top: -4px;
        margin-bottom: -4px;
        cursor: pointer;
        &:hover {
          color: var(--el-color-primary);
        }
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
            -webkit-line-clamp: 3;
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
        }
        &:hover {
          .inner {
            .more {
              color: var(--el-color-primary);
            }
          }
        }
      }
      .actions {
        display: flex;
        -webkit-box-align: center;
        -ms-flex-align: center;
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
      }
    }
    .nav-box {
      position: relative;
      padding: 20px 15px;
      border: 1px solid #f6f6f6;
      margin-bottom: 10px;
      background: #fff;
      border-radius: 6px;
      .item {
        display: inline-flex;
        -webkit-box-orient: vertical;
        -webkit-box-direction: normal;
        -ms-flex-direction: column;
        flex-direction: column;
        -webkit-box-align: center;
        -ms-flex-align: center;
        align-items: center;
        cursor: pointer;
        width: calc(33.33% - 14.66px);
        margin-right: 22px;
        &:last-child {
          margin-right: 0;
        }
        .icon {
          margin: 0 auto 12px;
          color: #8590a6;
        }
        .title {
          font-size: 12px;
          line-height: 1;
          text-align: center;
          color: #444;
        }
        &:hover {
          .title {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .recommend-ask {
      .header {
        background: #ffffff;
        font-weight: 500;
        padding-left: 10px;
        line-height: 40px;
        border-bottom: 1px solid #f0f0f0;
      }
      .content {
        background: #fff;
        min-height: 180px;
        .item {
          padding: 10px;
          display: block;
          .title {
            white-space: normal;
            pointer-events: none;
            word-break: break-word;
            cursor: pointer;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .img-box {
            overflow: hidden;
            position: relative;
            width: 110px;
            height: 64px;
            border-radius: 6px;
            color: #fff;
            display: inline-block;
            img {
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
            }
          }
          .personal {
            display: inline-block;
            width: calc(100% - 120px);
            margin-left: 10px;
            vertical-align: top;
            .meta {
              .avatar {
                width: 20px;
                height: 20px;
                margin-right: 4px;
                vertical-align: middle;
                -webkit-border-radius: 20px;
                -moz-border-radius: 20px;
                border-radius: 20px;
                display: inline-block;
              }
              .name {
                font-size: 12px;
                color: rgba(153,153,153,.8);
                line-height: 12px;
              }
              .time {
                float: right;
                display: none;
                height: 20px;
                line-height: 20px;
                font-size: 12px;
                color: rgba(153,153,153,.8);
              }
            }
          }
          &:hover {
            background: #e5e7eb;
          }
        }
      }
    }
  }
</style>
