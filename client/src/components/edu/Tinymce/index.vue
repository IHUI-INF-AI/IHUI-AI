<template>
  <div :class="{fullscreen:fullscreen}" class="tiny-mce-container" :style="{width:containerWidth}">
    <textarea :placeholder="placeholder" :id="tinyMceId" class="tiny-mce-textarea"/>
    <div class="editor-custom-btn-container"></div>
  </div>
</template>

<script>
import {ref, watch, nextTick, computed, onMounted, onActivated, onDeactivated, onUnmounted} from "vue"
/**
 * docs:
 * https://panjiachen.github.io/vue-element-admin-site/feature/component/rich-editor.html#tinymce
 */
import plugins from "./plugins"
import toolbar from "./toolbar"
import load from "./dynamicLoadScript"
import {error} from "@/util/tipsUtils";

// why use this cdn, detail see https://github.com/PanJiaChen/tinymce-all-in-one
const tinyMceCdn = "https://cdn.jsdelivr.net/npm/tinymce-all-in-one@4.9.5/tinymce.min.js"

export default {
  name: "TinyMce",
  props: {
    id: {
      type: String,
      default: function() {
        return "vue-tiny-mce-" + +new Date() + ((Math.random() * 1000).toFixed(0) + "")
      }
    },
    modelValue: {
      type: String,
      default: ""
    },
    toolbar: {
      type: Array,
      required: false,
      default() {
        return []
      }
    },
    menubar: {
      type: String,
      default: "file edit insert view format table"
    },
    height: {
      type: [Number, String],
      required: false,
      default: 360
    },
    width: {
      type: [Number, String],
      required: false,
      default: "auto"
    },
    placeholder: {
      type: String,
      default: ""
    }
  },
  setup(props, context) {
    const hasChange = ref(false)
    const hasInit = ref(false)
    const fullscreen = ref(false)
    const tinyMceId = ref(props.id)
    watch(() => props.modelValue, (val) => {
      if (!hasChange.value && hasInit.value) {
        nextTick(() => window.tinymce.get(tinyMceId.value).setContent(val || ""))
      }
    })
    const languageTypeList = {
      "en": "en",
      "zh": "zh_CN",
      "es": "es_MX",
      "ja": "ja"
    }
    const initTinyMce = function() {
      window.tinymce.init({
        selector: `#${tinyMceId.value}`,
        language: languageTypeList["zh"],
        height: props.height,
        body_class: "panel-body ",
        object_resizing: false,
        toolbar: props.toolbar.length > 0 ? props.toolbar : toolbar,
        menubar: props.menubar,
        plugins: plugins,
        end_container_on_empty_block: true,
        powerpaste_word_import: "clean",
        code_dialog_height: 450,
        code_dialog_width: 1000,
        advlist_bullet_styles: "square",
        advlist_number_styles: "default",
        imagetools_cors_hosts: ["www.tinymce.com", "codepen.io"],
        default_link_target: "_blank",
        link_title: false,
        nonbreaking_force_tab: true, // inserting nonbreaking space &nbsp; need Nonbreaking Space Plugin
        init_instance_callback: editor => {
          if (props.modelValue) {
            editor.setContent(props.modelValue)
          }
          hasInit.value = true
          editor.on("NodeChange Change KeyUp SetContent", () => {
            hasChange.value = true
            context.emit("update:modelValue", editor.getContent())
          })
        },
        setup(editor) {
          editor.on("FullscreenStateChanged", (e) => {
            fullscreen.value = e.state
          })
        },
        // it will try to keep these URLs intact
        // https://www.tiny.cloud/docs-3x/reference/configuration/Configuration3x@convert_urls/
        // https://stackoverflow.com/questions/5196205/disable-tinymce-absolute-to-relative-url-conversions
        convert_urls: false
        // 整合七牛上传
        // images_dataimg_filter(img) {
        //   setTimeout(() => {
        //     const $image = $(img);
        //     $image.removeAttr("width");
        //     $image.removeAttr("height");
        //     if ($image[0].height && $image[0].width) {
        //       $image.attr("data-wscntype", "image");
        //       $image.attr("data-wscnh", $image[0].height);
        //       $image.attr("data-wscnw", $image[0].width);
        //       $image.addClass("wscnph");
        //     }
        //   }, 0);
        //   return img
        // },
        // images_upload_handler(blobInfo, success, failure, progress) {
        //   progress(0);
        //   const token = _this.$store.getters.token;
        //   getToken(token).then(response => {
        //     const url = response.data.qiniu_url;
        //     const formData = new FormData();
        //     formData.append("token", response.data.qiniu_token);
        //     formData.append("key", response.data.qiniu_key);
        //     formData.append("file", blobInfo.blob(), url);
        //     upload(formData).then(() => {
        //       success(url);
        //       progress(100);
        //     })
        //   }).catch(err => {
        //     failure("出现未知问题，刷新页面，或者联系程序员")
        //     console.log(err);
        //   });
        // },
      })
    }
    const init = function() {
      // dynamic load tinymce from cdn
      load(tinyMceCdn, (err) => {
        if (err) {
          error(err.message)
          return
        }
        initTinyMce()
      })
    }
    const destroyTinyMce = function() {
      if(!window.tinymce) {
        return
      }
      const tinyMce = window.tinymce.get(tinyMceId.value)
      if (fullscreen.value) {
        tinyMce.execCommand("mceFullScreen")
      }
      if (tinyMce) {
        tinyMce.destroy()
      }
    }
    const setContent = function(value) {
      window.tinymce.get(tinyMceId.value).setContent(value)
    }
    const getContent = function() {
      window.tinymce.get(tinyMceId.value).getContent()
    }
    const containerWidth = computed(() => {
      const width = props.width
      if (/^[\d]+(\.[\d]+)?$/.test(width)) { // matches `100`, `"100"`
        return `${width}px`
      }
      return width
    })
    onMounted(() => {
      init()
    })
    onActivated(() => {
      if (window.tinymce) {
        initTinyMce()
      }
    })
    onDeactivated(() => {
      destroyTinyMce()
    })
    onUnmounted(() => {
      destroyTinyMce()
    })
    return {
      hasChange,
      hasInit,
      tinyMceId,
      fullscreen,
      setContent,
      getContent,
      containerWidth
    }
  }
}
</script>

<style lang="scss" scoped>
.tiny-mce-container {
  position: relative;
  line-height: normal;
}
.tiny-mce-container {
  :deep(.mce-fullscreen) {
    z-index: 10000;
  }
}
.tiny-mce-textarea {
  visibility: hidden;
  z-index: -1;
}
.editor-custom-btn-container {
  position: absolute;
  right: 4px;
  top: 4px;
  /*z-index: 2005;*/
}
.fullscreen .editor-custom-btn-container {
  z-index: 10000;
  position: fixed;
}
.editor-upload-btn {
  display: inline-block;
}
</style>
