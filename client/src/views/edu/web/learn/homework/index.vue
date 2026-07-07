<template>
  <div v-if="!lesson.homework">
    <el-empty/>
  </div>
  <div v-else>
    <div class="homework">
      <div class="homework-title">作业说明</div>
      <div class="homework-content">
        {{lesson.homework}}
      </div>
      <div class="homework-attachment">
        <a target="_blank" :href="lesson.homeworkAttachment">下载附件</a>
      </div>
    </div>
    <div class="homework" style="padding-top: 20px;">
      <div class="homework-title">提交作业 (
        <span v-if="homework && homework.status === 'pass_approval'" style="color: green;">作业已通过</span>
        <span v-else-if="homework && homework.status === 'waiting_approval'" style="color: gray;">作业正等待批</span>
        <span v-else-if="homework && homework.status === 'reject_approval'" style="color: red;">作业不通过，请重新提交</span>
        <span v-else style="color: orange;">作业还没提交，请尽快提交</span>
        )
      </div>
      <div class="homework-content">
        <upload
            list-type="text"
            :on-upload-success="onUploadHomeworkAttachmentSuccess"
            :on-upload-remove="onUploadHomeworkAttachmentRemove"
            :files="uploadHomeworkData.files"
            :upload-url="uploadHomeworkData.url"
            :limit="1"
            accept="image/*,video/*,audio/*,application/*">
        </upload>
      </div>
      <el-button link @click="submitHomework">确认提交</el-button>
    </div>
  </div>
</template>

<script>
  import {ref} from "vue"
  import {
    getHomework, updateHomework, saveHomework
  } from "@/api/edu/web/learn/lesson"
  import upload from "@/components/Uplaod"
  import {error, success} from "@/util/tipsUtils";
  export default {
    name: "HomeworkIndex",
    components: {
      upload
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
.homework {
  .homework-title {
    font-size: 18px;
    font-weight: 500;
    margin: 10px 0;
  }
  .homework-content {
    white-space: pre-wrap;
    white-space: -moz-pre-wrap;
    white-space: -o-pre-wrap;
    word-wrap: break-word;
    background: #fafafa;
    padding: 20px;
  }
  .homework-attachment {
    padding: 10px 0;
  }
}
</style>
