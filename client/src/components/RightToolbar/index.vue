<template>
  <div class="top-right-btn" :style="style">
    <el-row>
      <el-tooltip
        class="item"
        effect="dark"
        :content="showSearch ? $t('rightToolbar.hideSearch') : $t('rightToolbar.showSearch')"
        placement="top"
        v-if="search"
      >
        <el-button
          size="small"
          circle
          icon="el-icon-search"
          @click="toggleSearch()"
        />
      </el-tooltip>
      <el-tooltip class="item" effect="dark" :content="$t('rightToolbar.refresh')" placement="top">
        <el-button
          size="small"
          circle
          icon="el-icon-refresh"
          @click="refresh()"
        />
      </el-tooltip>
      <el-tooltip
        class="item"
        effect="dark"
        :content="$t('rightToolbar.toggleColumns')"
        placement="top"
        v-if="columns"
      >
        <el-button
          size="small"
          circle
          icon="el-icon-menu"
          @click="showColumn()"
          v-if="showColumnsType == 'transfer'"
        />
        <el-dropdown
          trigger="click"
          :hide-on-click="false"
          style="padding-left: 12px"
          v-if="showColumnsType == 'checkbox'"
        >
          <el-button size="small" circle icon="el-icon-menu" />
          <template v-slot:dropdown>
            <el-dropdown-menu>
              <!-- Select all/Deselect all button -->
              <el-dropdown-item>
                <el-checkbox
                  :indeterminate="isIndeterminate"
                  v-model="isChecked"
                  @change="toggleCheckAll"
                >
                  {{ $t('rightToolbar.columnDisplay') }}
                </el-checkbox>
              </el-dropdown-item>
              <div class="check-line"></div>
              <template v-for="item in columns" :key="item.key">
                <el-dropdown-item>
                  <el-checkbox
                    v-model="item.visible"
                    @change="checkboxChange($event, item.label)"
                    :label="item.label"
                  />
                </el-dropdown-item>
              </template>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-tooltip>
    </el-row>
    <el-dialog :title="title" v-model="open" append-to-body>
      <el-transfer
        :titles="[$t('rightToolbar.show'), $t('rightToolbar.hide')]"
        v-model="value"
        :data="columns"
        @change="dataChange"
      ></el-transfer>
    </el-dialog>
  </div>
</template>
<script>
export default {
  name: "RightToolbar",
  data() {
    return {
      // Show/hide data
      value: [],
      // Dialog title
      title: "",
      // Whether to show dialog
      open: false,
    };
  },
  props: {
    /* Whether to show search conditions */
    showSearch: {
      type: Boolean,
      default: true,
    },
    /* Show/hide column information */
    columns: {
      type: Array,
    },
    /* Whether to show search icon */
    search: {
      type: Boolean,
      default: true,
    },
    /* Show/hide column type (transfer shuttle box, checkbox) */
    showColumnsType: {
      type: String,
      default: "checkbox",
    },
    /* Right margin */
    gutter: {
      type: Number,
      default: 10,
    },
  },
  computed: {
    style() {
      const ret = {};
      if (this.gutter) {
        ret.marginRight = `${this.gutter / 2}px`;
      }
      return ret;
    },
    isChecked: {
      get() {
        return this.columns.every((col) => col.visible);
      },
      set() {},
    },
    isIndeterminate() {
      return this.columns.some((col) => col.visible) && !this.isChecked;
    },
  },
  created() {
    this.title = this.$t('rightToolbar.dialogTitle');
    if (this.showColumnsType == "transfer") {
      // Show/hide columns initial default hidden columns
      for (let item in this.columns) {
        if (this.columns[item].visible === false) {
          this.value.push(parseInt(item));
        }
      }
    }
  },
  methods: {
    // Search
    toggleSearch() {
      this.$emit("update:showSearch", !this.showSearch);
    },
    // Refresh
    refresh() {
      this.$emit("queryTable");
    },
    // Right side list element change
    dataChange(data) {
      for (let item in this.columns) {
        const key = this.columns[item].key;
        this.columns[item].visible = !data.includes(key);
      }
    },
    // Open show/hide columns dialog
    showColumn() {
      this.open = true;
    },
    // Single checkbox
    checkboxChange(event, label) {
      this.columns.filter((item) => item.label == label)[0].visible = event;
    },
    // Toggle select all/deselect all
    toggleCheckAll() {
      const newValue = !this.isChecked;
      this.columns.forEach((col) => (col.visible = newValue));
    },
  },
};
</script>
<style lang="scss" scoped>
:deep(.el-transfer__button) {
  border-radius: 50%;
  padding: 12px;
  display: block;
  margin-left: 0;
}

:deep(.el-transfer__button:first-child) {
  margin-bottom: 10px;
}

.check-line {
  width: 90%;
  height: 1px;

  // Background color controlled by theme class
  margin: 3px auto;
}
</style>
