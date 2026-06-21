<template>
  <el-form size="small">
    <el-form-item>
      <el-radio v-model="radioValue" :label="1">
        Month, allowed wildcards [, - * /]
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="2">
        Cycle from
        <el-input-number v-model="cycle01" :min="1" :max="11" /> -
        <el-input-number
          v-model="cycle02"
          :min="cycle01 ? cycle01 + 1 : 2"
          :max="12"
        />
        month
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="3">
        From
        <el-input-number v-model="average01" :min="1" :max="11" /> month start, every
        <el-input-number
          v-model="average02"
          :min="1"
          :max="12 - average01 || 0"
        />
        months execute once
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="4">
        Specify
        <el-select
          clearable
          v-model="checkboxList"
          placeholder="Can select multiple"
          multiple
          style="width: 100%"
        >
          <el-option v-for="item in 12" :key="item" :value="item">{{
            item
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
      average01: 1,
      average02: 1,
      checkboxList: [],
      checkNum: this.check,
    };
  },
  name: "crontab-month",
  props: ["check", "cron"],
  methods: {
    // When radio button value changes
    radioChange() {
      switch (this.radioValue) {
        case 1:
          this.$emit("update", "month", "*");
          break;
        case 2:
          this.$emit("update", "month", this.cycleTotal);
          break;
        case 3:
          this.$emit("update", "month", this.averageTotal);
          break;
        case 4:
          this.$emit("update", "month", this.checkboxString);
          break;
      }
    },
    // When cycle two values change
    cycleChange() {
      if (this.radioValue == "2") {
        this.$emit("update", "month", this.cycleTotal);
      }
    },
    // When average two values change
    averageChange() {
      if (this.radioValue == "3") {
        this.$emit("update", "month", this.averageTotal);
      }
    },
    // checkbox值变化时
    checkboxChange() {
      if (this.radioValue == "4") {
        this.$emit("update", "month", this.checkboxString);
      }
    },
  },
  watch: {
    radioValue: "radioChange",
    cycleTotal: "cycleChange",
    averageTotal: "averageChange",
    checkboxString: "checkboxChange",
  },
  computed: {
    // 计算两个周期值
    cycleTotal: function () {
      const cycle01 = this.checkNum(this.cycle01, 1, 11);
      const cycle02 = this.checkNum(
        this.cycle02,
        cycle01 ? cycle01 + 1 : 2,
        12,
      );
      return cycle01 + "-" + cycle02;
    },
    // 计算平均用到的值
    averageTotal: function () {
      const average01 = this.checkNum(this.average01, 1, 11);
      const average02 = this.checkNum(this.average02, 1, 12 - average01 || 0);
      return average01 + "/" + average02;
    },
    // 计算勾选的checkbox值合集
    checkboxString: function () {
      let str = this.checkboxList.join();
      return str == "" ? "*" : str;
    },
  },
};
</script>
