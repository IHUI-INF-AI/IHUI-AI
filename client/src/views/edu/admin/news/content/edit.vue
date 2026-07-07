<template>
  <div class="news-edit-wrap">
    <el-form :model="news" :rules="newsRules" ref="newsRef" label-width="120px">
      <el-form-item label="标题：" prop="title">
        <el-input size="small" v-model="news.title" placeholder="请输入标题"></el-input>
      </el-form-item>
      <el-form-item label="导语：" prop="description">
        <el-input size="small" v-model="news.description" placeholder="请输入导语"></el-input>
      </el-form-item>
      <el-form-item label="内容：" prop="content">
        <wang-editor v-if="loadWangEditorFlag" v-model="news.content"></wang-editor>
      </el-form-item>
      <el-form-item label="封面：" prop="image">
        <upload
          :on-upload-success="onUploadImageSuccess"
          :on-upload-remove="onUploadImageRemove"
          :files="uploadData.files"
          :upload-url="uploadData.url"
          :limit="1"
          accept="image/jpeg,image/gif,image/png">
        </upload>
        <span class="upload-image-tips">图片建议：尺寸 1920 x 1200 像素，大小7M以下</span>
      </el-form-item>
      <el-form-item label="标签：">
        <el-tag size="small" :key="tag" v-for="(tag, index) in tags" closable :disable-transitions="false" @close="delTag(index)">{{tag}}</el-tag>
        <el-input size="small" class="input-new-tag" v-if="tagsVisible" v-model="tag" ref="tagsRef" @blur="tagsInputConfirm" placeholder="请输入标签"></el-input>
        <el-button v-else class="button-new-tag" size="small" @click="showTagsInput">+ 新增标签</el-button>
      </el-form-item>
      <el-form-item label="关键字：">
        <el-tag size="small" :key="keyword" v-for="(keyword, index) in keywords" closable :disable-transitions="false" @close="delKeyword(index)">{{keyword}}</el-tag>
        <el-input size="small" class="input-new-tag" v-if="keywordsVisible" v-model="keyword" ref="keywordsRef" @blur="keywordsInputConfirm" @keydown.enter="keywordsInputConfirm" placeholder="请输入关键字"></el-input>
        <el-button v-else class="button-new-tag" size="small" @click="showKeywordsInput">+ 新增关键字</el-button>
      </el-form-item>
      <el-form-item style="text-align: center">
        <el-button size="small" @click="submitNewsDraft">存草稿</el-button>
        <el-button size="small" @click="submitNewsPublished">发布</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
<script>
// @ts-nocheck
  import {ref} from "vue"
  import {useRoute} from "vue-router"
  import router from "@/router"
  import { contentApi } from '@/api/edu/admin-api'
const { saveNews, updateNews, getNews } = contentApi
  import Upload from "@/components/Uplaod/index.vue"
  import WangEditor from "@/components/WangEditor/index.vue"
  import {success} from "@/util/tipsUtils";

  export default {
    name: "NewsContentEdit",
    components:{
      Upload,
      WangEditor
    },
    setup() {
      const loadWangEditorFlag = ref(false)
      const route = useRoute()
      const isUpdate = !!route.query.id
      // 基本信息
      const uploadData = ref({
        url: '/api/v1/edu' + "/oss/content/news/image",
        files: []
      })
      const news = ref({
        id: "",
        title: "",
        image: "",
        status: "published",
        tags: "",
        keywords: "",
        content: "",
        description: ""
      })
      const newsRules = {
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
        content: [{ required: true, message: "请输入内容", trigger: "blur" }],
        description: [{ required: true, message: "请输入导语", trigger: "blur" }],
        image: [{ required: true, message: "请选择海报", trigger: "change" }],
      }
      const tags = ref([])
      const tag = ref("")
      const tagsVisible = ref(false)
      const tagsRef = ref(null)
      const showTagsInput = () => {
        tagsVisible.value = true
      }
      const tagsInputConfirm = () => {
        if (tag.value) {
          tags.value.push(tag.value)
          tag.value = ""
        }
        tagsVisible.value = false
      }
      const delTag = (index) => {
        tags.value.splice(index, 1)
      }
      const keywords = ref([])
      const keyword = ref("")
      const keywordsVisible = ref(false)
      const keywordsRef = ref(null)
      const showKeywordsInput = () => {
        keywordsVisible.value = true
      }
      const keywordsInputConfirm = () => {
        if (keyword.value) {
          keywords.value.push(keyword.value)
          keyword.value = ""
        }
        keywordsVisible.value = false
      }
      const delKeyword = (index) => {
        keywords.value.splice(index, 1)
      }
      // 加载基本信息
      const load = () => {
        let id = route.query.id;
        if (!id) {
          loadWangEditorFlag.value = true;
          return;
        }
        getNews(id, function (res) {
          news.value = res;
          if (res && res.tags) {
            tags.value = res.tags.split(",")
          }
          if (res && res.keywords) {
            keywords.value = res.keywords.split(",")
          }
          uploadData.value.files = [{name: "海报", url: news.value.image}]
          loadWangEditorFlag.value = true;
        })
      }
      load()
      // 上传图片成功
      const onUploadImageSuccess = (res) => {
        news.value.image = res.data
      }
      // 删除图片
      const onUploadImageRemove = () => {
        news.value.image = ""
        uploadData.value.files = []
      }
      // 提交基本信息
      const newsRef = ref(null)
      const submitNews = () => {
        newsRef.value.validate((valid) => {
          if (!valid) { return false }
          if (tags.value && tags.value.length) {
            news.value.tags = tags.value.join(",");
          }
          if (keywords.value && keywords.value.length) {
            news.value.keywords = keywords.value.join(",");
          }
          if (isUpdate) {
            updateNews(news.value, function (res) {
              if (res && res.id) {
                news.value.id = res.id;
                success("编辑成功")
                router.push({path: "/admin/edu/news/list"});
              }
            })
          } else {
            saveNews(news.value, function (res) {
              if (res && res.id) {
                news.value.id = res.id;
                success("新增成功")
                router.push({path: "/admin/edu/news/list"});
              }
            })
          }
        })
      }
      const submitNewsPublished = () => {
        news.value.status = "published"
        submitNews()
      }
      const submitNewsDraft = () => {
        news.value.status = "draft"
        submitNews()
      }
      return {
        uploadData,
        news,
        newsRules,
        newsRef,
        onUploadImageSuccess,
        onUploadImageRemove,
        submitNews,
        submitNewsDraft,
        submitNewsPublished,
        tags,
        tag,
        tagsVisible,
        tagsRef,
        showTagsInput,
        tagsInputConfirm,
        delTag,
        keywords,
        keyword,
        keywordsVisible,
        keywordsRef,
        showKeywordsInput,
        keywordsInputConfirm,
        delKeyword,
        loadWangEditorFlag
      };
    }
  }
</script>
<style scoped>
  .news-edit-wrap {
    padding: 40px 0;
  }
  .upload-image-tips {
    font-size: 12px;
    color: #999999;
  }
  .el-form-item {
    width: 96%;
  }
  .el-tag {
    margin-right: 10px;
  }
  .el-upload--picture-card, .el-upload-list--picture-card .el-upload-list__item {
    width: 100%;
    height: 62.5%;
  }
  .tips {
    font-size: 12px;
    color: #999999;
  }
</style>
