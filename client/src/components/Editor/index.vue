<template>
  <div>
    <el-upload
      :action="uploadUrl"
      :before-upload="handleBeforeUpload"
      :on-success="handleUploadSuccess"
      :on-error="handleUploadError"
      name="file"
      :show-file-list="false"
      :headers="headers"
      style="display: none"
      ref="upload"
      v-if="this.type == 'url'"
    >
    </el-upload>
    <div v-if="uploading" class="editor-uploading">{{ $t('editorComponent.uploading') }}</div>
    <div class="editor" ref="editor" :style="styles"></div>
  </div>
</template>

<script>
import axios from "axios";
// Use dynamic import to avoid require is not defined error
import "quill/dist/quill.core.css";
import "quill/dist/quill.snow.css";
import "quill/dist/quill.bubble.css";
import { StorageManager, STORAGE_KEYS } from "@/utils/storage";
import { logger } from "@/utils/logger";
import { sanitizeHtml } from "@/utils/htmlSanitizer";

export default {
  name: "Editor",
  props: {
    /* Editor content */
    value: {
      type: String,
      default: "",
    },
    /* Height */
    height: {
      type: Number,
      default: null,
    },
    /* Minimum height */
    minHeight: {
      type: Number,
      default: null,
    },
    /* Read only */
    readOnly: {
      type: Boolean,
      default: false,
    },
    /* Upload file size limit (MB) */
    fileSize: {
      type: Number,
      default: 5,
    },
    /* Type (base64 format, url format) */
    type: {
      type: String,
      default: "url",
    },
  },
  data() {
    return {
      uploadUrl: (import.meta.env.VITE_BASE_API || import.meta.env.VUE_APP_BASE_API || "/dev-api") + "/cozeZhsApi/file/upload/form",
      headers: {
        Authorization: "Bearer " + (StorageManager.getItem(STORAGE_KEYS.USER_TOKEN) || ""),
      },
      Quill: null,
      currentValue: "",
      uploading: false,
      abortController: null,
      options: {
        theme: "snow",
        bounds: document.body,
        debug: "warn",
        modules: {
          // Toolbar configuration
          toolbar: [
            ["bold", "italic", "underline", "strike"], // Bold, italic, underline, strikethrough
            ["blockquote", "code-block"], // Blockquote, code block
            [{ list: "ordered" }, { list: "bullet" }], // Ordered, unordered list
            [{ indent: "-1" }, { indent: "+1" }], // Indent
            [{ size: ["small", false, "large", "huge"] }], // Font size
            [{ header: [1, 2, 3, 4, 5, 6, false] }], // Header
            [{ color: [] }, { background: [] }], // Font color, font background color
            [{ align: [] }], // Alignment
            ["clean"], // Clear text format
            ["link", "image", "video"], // Link, image, video
          ],
        },
        placeholder: this.$t('editor.placeholder'),
        readOnly: this.readOnly,
      },
    };
  },
  computed: {
    styles() {
      let style = {};
      if (this.minHeight) {
        style.minHeight = `${this.minHeight}px`;
      }
      if (this.height) {
        style.height = `${this.height}px`;
      }
      return style;
    },
  },
  watch: {
    value: {
      handler(val) {
        if (val !== this.currentValue) {
          this.currentValue = val === null ? "" : val;
          if (this.Quill) {
            this.Quill.clipboard.dangerouslyPasteHTML(sanitizeHtml(this.currentValue));
          }
        }
      },
      immediate: true,
    },
  },
  mounted() {
    this.init();
  },
  beforeUnmount() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // Clean up event listeners
    if (this.Quill && this.Quill.root && this.handlePasteCapture) {
      this.Quill.root.removeEventListener("paste", this.handlePasteCapture, true);
    }
    // Clean up Quill instance
    if (this.Quill) {
      this.Quill.off("text-change");
      this.Quill.off("selection-change");
      this.Quill.off("editor-change");
      this.Quill = null;
    }
  },
  methods: {
    async init() {
      const editor = this.$refs.editor;
      if (!editor) return;

      // Dynamic import of quill to avoid require is not defined error
      if (!this.Quill) {
        try {
          const QuillModule = await import("quill");
          const Quill = QuillModule.default || QuillModule;
          this.Quill = new Quill(editor, this.options);
        } catch (error) {
          logger.error("Failed to load Quill:", error);
          this.$message?.error?.("Editor load failed, please refresh page and try again");
          return;
        }
      }
      
      // If upload address is set, customize image upload event
      if (this.type == "url") {
        let toolbar = this.Quill.getModule("toolbar");
        toolbar.addHandler("image", (value) => {
          if (value) {
            // $children has been removed in Vue 3, access input element directly via ref
            const uploadRef = this.$refs.upload;
            if (uploadRef && uploadRef.$el) {
              const input = uploadRef.$el.querySelector('input[type="file"]');
              if (input) {
                input.click();
              }
            }
          } else {
            this.quill.format("image", false);
          }
        });
        this.Quill.root.addEventListener(
          "paste",
          this.handlePasteCapture,
          true,
        );
      }
      this.Quill.clipboard.dangerouslyPasteHTML(sanitizeHtml(this.currentValue));
      this.Quill.on("text-change", (_delta, _oldDelta, _source) => {
        const html = sanitizeHtml(this.$refs.editor.children[0].innerHTML);
        const text = this.Quill.getText();
        const quill = this.Quill;
        this.currentValue = html;
        this.$emit("input", html);
        this.$emit("on-change", { html, text, quill });
      });
      this.Quill.on("text-change", (delta, oldDelta, source) => {
        this.$emit("on-text-change", delta, oldDelta, source);
      });
      this.Quill.on("selection-change", (range, oldRange, source) => {
        this.$emit("on-selection-change", range, oldRange, source);
      });
      this.Quill.on("editor-change", (eventName, ...args) => {
        this.$emit("on-editor-change", eventName, ...args);
      });
    },
    // Validate format and size before upload
    handleBeforeUpload(file) {
      const type = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
      const isJPG = type.includes(file.type);
      // Check file format
      if (!isJPG) {
        this.$message.error(`Image format error!`);
        return false;
      }
      // Check file size
      if (this.fileSize) {
        const isLt = file.size / 1024 / 1024 < this.fileSize;
        if (!isLt) {
          this.$message.error(`Upload file size cannot exceed ${this.fileSize} MB!`);
          return false;
        }
      }
      this.uploading = true;
      return true;
    },
    handleUploadSuccess(res, _file) {
      this.uploading = false;
      // 后端返回 {code: 0, message, url}，兼容 code 0/200
      const code = Number(res?.code);
      const ok = code === 0 || code === 200;
      const imgUrl = res?.url || res?.data?.url;
      if (ok && imgUrl) {
        let quill = this.Quill;
        let length = quill.getSelection().index;
        quill.insertEmbed(length, "image", imgUrl);
        quill.setSelection(length + 1);
      } else {
        this.$message.error("Image insertion failed");
      }
    },
    handleUploadError() {
      this.uploading = false;
      this.$message.error("Image insertion failed");
    },
    // Copy and paste image handling
    handlePasteCapture(e) {
      const clipboard = e.clipboardData || window.clipboardData;
      if (clipboard && clipboard.items) {
        for (let i = 0; i < clipboard.items.length; i++) {
          const item = clipboard.items[i];
          if (item.type.indexOf("image") !== -1) {
            e.preventDefault();
            const file = item.getAsFile();
            this.insertImage(file);
          }
        }
      }
    },
    insertImage(file) {
      const formData = new FormData();
      formData.append("file", file);
      this.uploading = true;
      this.abortController = new AbortController();
      axios
        .post(this.uploadUrl, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: this.headers.Authorization,
          },
          signal: this.abortController.signal,
        })
        .then((res) => {
          this.uploading = false;
          this.handleUploadSuccess(res.data);
        })
        .catch((err) => {
          this.uploading = false;
          if (err && err.name === "AbortError") return;
          this.handleUploadError();
        });
    },
  },
};
</script>

<style scoped>
/* scoped + :deep() 编译后特异性 (0,3,0) 高于 quill 默认 (0,2,0)，用层顺序控制 */
.editor {
  white-space: pre-wrap;
  line-height: normal;
}

.editor-uploading {
  padding: 6px 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-size: 13px;
}

:deep(.ql-toolbar) {
  white-space: pre-wrap;
  line-height: normal;
}

.quill-img {
  display: none;
}

/* Quill editor pseudo-elements have been removed, use data attributes or other methods to implement prompt text */

/* Note: This may affect Quill editor display, need to check editor functionality */
:deep(.ql-snow .ql-tooltip[data-mode="link"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-tooltip.ql-editing a.ql-action::after) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-tooltip[data-mode="video"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-size .ql-picker-label::before),
:deep(.ql-snow .ql-picker.ql-size .ql-picker-item::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-size .ql-picker-label[data-value="small"]::before),
:deep(.ql-snow .ql-picker.ql-size .ql-picker-item[data-value="small"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-size .ql-picker-label[data-value="large"]::before),
:deep(.ql-snow .ql-picker.ql-size .ql-picker-item[data-value="large"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-size .ql-picker-label[data-value="huge"]::before),
:deep(.ql-snow .ql-picker.ql-size .ql-picker-item[data-value="huge"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-header .ql-picker-label::before),
:deep(.ql-snow .ql-picker.ql-header .ql-picker-item::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="1"]::before),
:deep(.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="1"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="2"]::before),
:deep(.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="2"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="3"]::before),
:deep(.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="3"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="4"]::before),
:deep(.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="4"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="5"]::before),
:deep(.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="5"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="6"]::before),
:deep(.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="6"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-font .ql-picker-label::before),
:deep(.ql-snow .ql-picker.ql-font .ql-picker-item::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="serif"]::before),
:deep(.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="serif"]::before) {
  display: none;
  content: none;
}

:deep(.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="monospace"]::before),
:deep(.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="monospace"]::before) {
  display: none;
  content: none;
}
</style>
