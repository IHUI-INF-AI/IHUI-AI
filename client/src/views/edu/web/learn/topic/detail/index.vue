<template>
  <learn-nav-menu/>
  <div class="content-list-container">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/'}">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/edu/learn/topic'}">专题课程</el-breadcrumb-item>
      <el-breadcrumb-item>{{'详情'}}</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="content-list" v-loading="dataLoading" v-if="topic">
      <div class="topic-item">
        <div class="topic-item-left">
          <img :src="topic.image" alt="零基础学习python全栈课程，助你月薪轻松过万"/>
        </div>
        <div class="topic-item-right">
          <div class="title-box">
            <h1 class="title">{{topic.title}}</h1>
          </div>
          <div class="info">
            <div class="basic-info">
              <div class="basic-info-item">
                <p>{{topic.lessonList ? topic.lessonList.length : 0}}</p>
                <p>门课程</p>
              </div>
              <div class="basic-info-line"></div>
              <div class="basic-info-item">
                <p>{{topic.learnNum || 0}}</p>
                <p>人学</p>
              </div>
              <!--              <div class="basic-info-line"></div>-->
              <!--              <div class="basic-info-item">-->
              <!--                <p>0</p>-->
              <!--                <p>课程总时间</p>-->
              <!--              </div>-->
            </div>
            <div class="teacher"></div>
          </div>
        </div>
      </div>
      <div class="topic-item-opt">
        <div class="topic-item-opt-left">
          <div class="opt-btn">
            <p>点赞</p>
            <p>{{topic.likeNum || 0}}</p>
          </div>
          <div class="topic-item-opt-line"></div>
          <div class="opt-btn">
            <p>收藏</p>
            <p>{{topic.favoriteNum || 0}}</p>
          </div>
          <div class="topic-item-opt-line"></div>
          <div class="opt-btn">
            <p>评论</p>
            <p>{{topic.commentNum || 0}}</p>
          </div>
        </div>
        <div class="topic-item-opt-right">
          <div class="price del">总价 ￥{{formatFloat(topic.price)}}</div>
          <div class="price">专题套餐￥{{formatFloat(topic.originalPrice)}} <div class="discount">立省￥{{formatFloat((topic.originalPrice || 0) - (topic.price || 0))}}</div></div>
          <button class="buy-btn">立即购买</button>
        </div>
      </div>
      <div class="topic-item-detail">
        <div class="topic-detail-nav">
          <el-menu
            :default-active="activeIndex"
            class="el-menu-demo"
            mode="horizontal"
            :ellipsis="false"
            @select="handleSelect">
            <el-menu-item index="1">课程</el-menu-item>
            <el-menu-item index="2">概览</el-menu-item>
            <el-menu-item index="3">评论</el-menu-item>
          </el-menu>
        </div>
        <div class="lesson-list" v-if="activeIndex === '1' && topic.lessonList && topic.lessonList.length">
          <div class="lesson-item" v-for="lesson in topic.lessonList" :key="lesson.id" @click="gotoLesson(lesson.id)">
            <div class="pic">
              <img :src="lesson.image" alt="" height="104">
            </div>
            <div class="tit">{{lesson.name}}</div>
            <!--                <p class="num  clearfix2"><span class="fl"><b>20</b>课时</span><em></em><span class="fl">讲师</span></p>-->
            <div class="price">单价：￥{{formatFloat(lesson.price)}}<span class="fr"></span></div>
          </div>
        </div>
        <div v-else-if="activeIndex === '2'">
          <div v-html="topic.description"></div>
        </div>
        <div v-else-if="activeIndex === '3'">
          <comment-list topic-type="learn_topic" :topic-id="topic.id"/>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  import {ref, markRaw} from "vue"
  import {ArrowRight} from '@/lib/lucide-fallback'
  import {getTopic} from "@/api/edu/web/learn/topic"
  import {useRoute, useRouter} from "vue-router";
  import LearnNavMenu from "@/views/edu/web/learn/navMenu";
  import {getCommentList} from "@/api/edu/web/comment";
  import commentList from "@/views/edu/web/comment/list"
  export default {
    name: "learnTopicList",
    components: {
      LearnNavMenu,
      commentList
    },
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight)
      const route = useRoute();
      const id = route.query.id
      const param = ref({
        id: id
      })
      const topic = ref({lessonList: []})
      const dataLoading = ref(true)
      const load = function() {
        dataLoading.value = true
        getTopic(param.value, res => {
          topic.value = res
          dataLoading.value = false
          // 获取评论数量
          getCommentList({topicId: res.id, topicType: 'learn_topic', size: 1}, r => {
            if (r && r.total !== undefined) {
              topic.value.commentNum = r.total
            }
          })
        }).catch(() => {
          dataLoading.value = false
        })
      }
      load()
      const formatFloat = function(value) {
        if (!value) {
          value = 0;
        }
        return parseFloat(value).toFixed(2);
      }
      const router = useRouter();
      const gotoLesson = function(lessonId) {
        router.push({path: "/edu/learn/detail", query: {id: lessonId}})
      }
      const activeIndex = ref("1");
      const handleSelect = (key, keyPath) => {
        activeIndex.value = key
      }
      return {
        ArrowRight: ArrowRightIcon,
        dataLoading,
        topic,
        formatFloat,
        gotoLesson,
        activeIndex,
        handleSelect
      }
    }
  }
</script>

<style lang="scss" scoped>
  .content-list-container {
    margin: 20px 10px;
    padding-top: 40px;
    .content-list {
      margin: 20px 0;
      background-color: #FFFFFF;
      min-height: 768px;
      border-radius: 6px;

      .topic-item {
        display: flex;

        .topic-item-left {
          border: 1px solid var(--el-color-primary);
          width: 224px;
          height: 132px;
          background: #FFF;
          border-radius: 3px;
          float: left;
          position: relative;

          img {
            width: 100%;
            height: 100%;
          }
        }
        .topic-item-right {
          float: right;
          position: relative;
          margin-left: 20px;

          .title-box {
            height: 82px;

            .title {
              font-size: 24px;
              margin: 10px 0;
            }
          }

          .info {
            .basic-info {
              display: inline-block;

              .basic-info-item {
                display: inline-block;

                p:first-child {
                  font-size: 20px;
                  font-weight: normal;
                }
              }

              .basic-info-line {
                display: inline-block;
                background: #b6c4d2;
                width: 1px;
                height: 20px;
                margin: 8px 20px;
                opacity: 0.5;
              }
            }
          }
        }
      }
      .topic-item-opt {
        background: #FFF;
        border: 1px solid #eee;
        padding: 19px;
        line-height: 50px;
        margin-top: 20px;
        // box-shadow: 0 0 8px #999;
        border-radius: 6px;
        position: relative;
        display: flex;
        justify-content: space-between;
        .topic-item-opt-left {
          line-height: 25px;
          .opt-btn {
            display: inline-block;
            text-align: center;
            margin: 0 10px;
          }
          .topic-item-opt-line {
            display: inline-block;
            background: #b6c4d2;
            width: 1px;
            height: 20px;
            margin: 8px 20px;
            opacity: 0.5;
          }
        }
        .topic-item-opt-right {
          // float: right;
          display: flex;
          .buy-btn {
            color: #FFF;
            line-height: 30px;
            border: none;
            padding: 0 20px;
            cursor: pointer;
            outline: none;
            background: var(--el-color-primary);
            height: 50px;
            width: 135px;
            border-radius: 3px;
            font-size: 16px;
          }
          .price {
            margin-right: 40px;
            font-size: 18px;
            color: var(--el-color-primary);
            position: relative;
            min-width: 118px;
            text-align: left;
            .discount {
              position: absolute;
              left: 0;
              top: -15px;
              height: 20px;
              line-height: 20px;
              background: var(--el-color-primary);
              color: #FFF;
              border-radius: 3px;
              padding: 0 5px;
              font-size: 14px;
              white-space: nowrap;
            }
          }
          .del {
            color: #999;
            text-decoration: line-through;
          }
        }
      }
      .topic-item-detail {
        padding-top: 20px;
        .topic-detail-nav {
          margin-bottom: 20px;
        }
        .lesson-list {
          .lesson-item {
            width: calc(20% - 26px);
            float: left;
            margin-right: 20px;
            cursor: pointer;
            .pic {
              width: 100%;
              height: 110px;
              background: #ccc;
              overflow: hidden;
              border-radius: 6px;
              position: relative;
              img {
                width: 100%;
              }
            }
            .tit {
              margin: 10px 0 5px 0;
              height: 40px;
              line-height: 21px;
              overflow: hidden;
              color: #414f65;
            }
            .num {
              color: #838b98;
              font-size: 12px;
              margin-bottom: 5px;
            }
            .fl, .Left {
              float: left;
            }
            .fr, .Right {
              float: right;
            }
            em {
              font-style: normal;
              margin: 5px 8px 0;
              float: left;
              width: 1px;
              height: 10px;
              background: #cfd2d9;
            }
            .price {
              color: #838b98;
              font-size: 12px;
            }
          }
        }
      }
    }
  }
</style>
