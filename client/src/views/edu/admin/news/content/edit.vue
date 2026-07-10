<template>
  <div class="news-edit-wrap">
    <form ref="newsRef" @submit.prevent>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">标题：</label>
        <div>
          <Input size="small" v-model="news.title" placeholder="请输入标题"></Input>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">导语：</label>
        <div>
          <Input size="small" v-model="news.description" placeholder="请输入导语"></Input>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">内容：</label>
        <div>
          <wang-editor v-if="loadWangEditorFlag" v-model="news.content"></wang-editor>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">封面：</label>
        <div>
          <upload
            :on-upload-success="onUploadImageSuccess"
            :on-upload-remove="onUploadImageRemove"
            :files="uploadData.files"
            :upload-url="uploadData.url"
            :limit="1"
            accept="image/jpeg,image/gif,image/png">
          </upload>
          <span class="upload-image-tips">图片建议：尺寸 1920 x 1200 像素，大小7M以下</span>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">标签：</label>
        <div>
          <Tag size="small" :key="tag" v-for="(tag, index) in tags" closable @close="delTag(index)">{{tag}}</Tag>
          <Input size="small" class="input-new-tag" v-if="tagsVisible" v-model="tag" ref="tagsRef" @blur="tagsInputConfirm" placeholder="请输入标签"></Input>
          <Button v-else className="button-new-tag" size="sm" variant="outline" @click="showTagsInput">+ 新增标签</Button>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">关键字：</label>
        <div>
          <Tag size="small" :key="keyword" v-for="(keyword, index) in keywords" closable @close="delKeyword(index)">{{keyword}}</Tag>
          <Input size="small" class="input-new-tag" v-if="keywordsVisible" v-model="keyword" ref="keywordsRef" @blur="keywordsInputConfirm" @keydown.enter="keywordsInputConfirm" placeholder="请输入关键字"></Input>
          <Button v-else className="button-new-tag" size="sm" variant="outline" @click="showKeywordsInput">+ 新增关键字</Button>
        </div>
      </div>
      <div class="mb-4" style="text-align: center">
        <Button size="sm" variant="outline" @click="submitNewsDraft">存草稿</Button>
        <Button size="sm" variant="outline" @click="submitNewsPublished">发布</Button>
      </div>
    </form>
  </div>
</template>
<script>
  import {ref} from "vue"
  import { useFormRef } from '@/composables/useFormRef'
  import {useRoute} from "vue-router"
  import router from "@/router"
  import { contentApi } from '@/api/edu/admin-api'
const { saveNews, updateNews, getNews } = contentApi
  import Upload from "@/components/Uplaod/index.vue"
  import WangEditor from "@/components/WangEditor/index.vue"
  import {success} from "@/util/tipsUtils";
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Tag } from '@/components/ui/tag'

  export default {
    name: "NewsContentEdit",
    components:{
      Upload,
      WangEditor,
      Button,
      Input,
      Tag
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
      const newsRef = useFormRef()
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
  .tips {
    font-size: 12px;
    color: #999999;
  }
</style>
