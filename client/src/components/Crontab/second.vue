<template>
  <el-form size="small">
    <el-form-item>
      <el-radio v-model="radioValue" :label="1">
        Second, allowed wildcards [, - * /]
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="2">
        Cycle from
        <el-input-number v-model="cycle01" :min="0" :max="58" /> -
        <el-input-number
          v-model="cycle02"
          :min="cycle01 ? cycle01 + 1 : 1"
          :max="59"
        />
        second
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="3">
        From
        <el-input-number v-model="average01" :min="0" :max="58" /> second start, every
        <el-input-number
          v-model="average02"
          :min="1"
          :max="59 - average01 || 0"
        />
        seconds execute once
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="4">
        Specify
        <el-select
          clearable
          v-model="checkboxList"
          placeholder="Multiple selection"
          multiple
          style="width: 100%"
        >
          <el-option v-for="item in 60" :key="item" :value="item - 1">{{
            item - 1
          }}</el-option>
        </el-select>
      </el-radio>
    </el-form-item>
  </el-form>
</template>

<script>
export default {
  data() {
    return {
      radioValue: 1,
      cycle01: 1,
      cycle02: 2,
      average01: 0,
      average02: 1,
      checkboxList: [],
      checkNum: this.$options.propsData.check,
    };
  },
  name: "crontab-second",
  props: ["check", "radioParent"],
  methods: {
    // When radio button value changes
    radioChange() {
      switch (this.radioValue) {
        case 1:
          this.$emit("update", "second", "*", "second");
          break;
        case 2:
          this.$emit("update", "second", this.cycleTotal);
          break;
        case 3:
          this.$emit("update", "second", this.averageTotal);
          break;
        case 4:
          this.$emit("update", "second", this.checkboxString);
          break;
      }
    },
    // When cycle two values change
    cycleChange() {
      if (this.radioValue == "2") {
        this.$emit("update", "second", this.cycleTotal);
      }
    },
    // When average two values change
    averageChange() {
      if (this.radioValue == "3") {
        this.$emit("update", "second", this.averageTotal);
      }
    },
    // When checkbox value changes
    checkboxChange() {
      if (this.radioValue == "4") {
        this.$emit("update", "second", this.checkboxString);
      }
    },
  },
  watch: {
    radioValue: "radioChange",
    cycleTotal: "cycleChange",
    averageTotal: "averageChange",
    checkboxString: "checkboxChange",
    radioParent() {
      this.radioValue = this.radioParent;
    },
  },
  computed: {
    // Calculate two cycle values
    cycleTotal: function () {
      const cycle01 = this.checkNum(this.cycle01, 0, 58);
      const cycle02 = this.checkNum(
        this.cycle02,
        cycle01 ? cycle01 + 1 : 1,
        59,
      );
      return cycle01 + "-" + cycle02;
    },
    // Calculate values used for average
    averageTotal: function () {
      const average01 = this.checkNum(this.average01, 0, 58);
      const average02 = this.checkNum(this.average02, 1, 59 - average01 || 0);
      return average01 + "/" + average02;
    },
    // Calculate collection of checked checkbox values
    checkboxString: function () {
      let str = this.checkboxList.join();
      return str == "" ? "*" : str;
    },
  },
};
</script>
