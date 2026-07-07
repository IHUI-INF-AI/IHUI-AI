<template>
  <div class="rate-wrap">
    <div class="rate-item-list">
      <div class="rate-item">
        <div class="rate-item-name">课程内容</div>
        <div class="rate-item-rate">
          <el-rate v-model="value" clearable allow-half size="large" />
        </div>
        <div class="rate-item-desc">课程内容符合课程目标的要科学严谨,课程结构的组织和编排合理,并具有开放性和可拓展性别</div>
      </div>
      <div class="rate-item">
        <div class="rate-item-name">教学设计</div>
        <div class="rate-item-rate">
          <el-rate v-model="value" clearable allow-half size="large" />
        </div>
        <div class="rate-item-desc">课程的教学设计良教学功能完整,在学习目标、教学过程与策略以及学习测评等方面均设计合理,能促成有效的学习</div>
      </div>
      <div class="rate-item">
        <div class="rate-item-name">界面设计</div>
        <div class="rate-item-rate">
          <el-rate v-model="value" clearable allow-half size="large" />
        </div>
        <div class="rate-item-desc">界面风格统一，协调美观，易于使用和操作，具有完备的功能</div>
      </div>
      <div class="rate-item">
        <div class="rate-item-name">创新设计</div>
        <div class="rate-item-rate">
          <el-rate v-model="value" clearable allow-half size="large" />
        </div>
        <div class="rate-item-desc">课程建设有自己的特色和创意</div>
      </div>
    </div>
    <div>
      <el-button type="primary">提交评分</el-button>
    </div>
  </div>
</template>

<script>
  import {ref} from "vue"
  import {getHomework, updateHomework, saveHomework} from "@/api/edu/web/learn/lesson"
  import {error, success} from "@/util/tipsUtils";
  export default {
    name: "RateIndex",
    components: {

    },
    props: {
      lesson: {
        type: Object
      },
      callback: {
        type: Function,
        default: () => {}
      }
    },
    setup(props) {
      const uploadHomeworkData = ref({
        url: '/api/v1/edu' + "/oss/auth-api/learn/lesson-homework/file",
        files: []
      })
      const homework = ref({
        url: ""
      })
      const loadHomework = () => {
        if (props.lesson && props.lesson.signUp && props.lesson.signUp.id) {
          getHomework({lessonId: props.lesson.id, signUpId: props.lesson.signUp.id}, res => {
            homework.value = res
            if (homework.value && homework.value.url) {
              uploadHomeworkData.value.files = [{name: "作业内容", url: homework.value.url}]
            }
          })
        }
      }
      loadHomework()
      // 上传附件成功
      const onUploadHomeworkAttachmentSuccess = (res) => {
        homework.value.url = res.data
      }
      // 删除附件成功
      const onUploadHomeworkAttachmentRemove = () => {
        homework.value.url = ""
        uploadHomeworkData.value.files = []
      }
      const submitHomework = () => {
        if (!homework.value.url) {
          error("请先上传作业")
          return
        }
        if (homework.value.id) {
          if (homework.value.status && homework.value.status === "pass_approval") {
            error("你的作业已经通过批改")
            return
          }
          updateHomework(homework.value, () => {
            success("修改作业成功")
            props.callback && props.callback()
          })
        } else {
          if (homework.value && homework.value.status && homework.value.status === "waiting_approval") {
            error("你已上传了作业")
            return
          }
          homework.value.lessonId = props.lesson.id
          homework.value.signUpId = props.lesson.signUp.id
          saveHomework(homework.value, () => {
            success("上传作业成功")
            props.callback && props.callback()
          })
        }
      }
      return {
        uploadHomeworkData,
        onUploadHomeworkAttachmentSuccess,
        onUploadHomeworkAttachmentRemove,
        submitHomework,
        homework
      }
    }
  }
</script>

<style lang="scss" scoped>
.rate-wrap {
  margin: 0 150px;
  .rate-item-list {
    .rate-item {
      display: flex;
      align-items: center;
      margin: 20px 0;
      .rate-item-name {
        font-size: 16px;
        min-width: 68px;
      }
      .rate-item-rate {
        margin: 0 20px 0 10px;
      }
      .rate-item-desc {
        font-size: 12px;
        color: #999999;
      }
    }
  }
}
</style>
