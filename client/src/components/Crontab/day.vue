<template>
  <el-form size="small">
    <el-form-item>
      <el-radio v-model="radioValue" :label="1">
        Day, allowed wildcards [, - * ? / L W]
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="2"> Not specified </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="3">
        Cycle from
        <el-input-number v-model="cycle01" :min="1" :max="30" /> -
        <el-input-number
          v-model="cycle02"
          :min="cycle01 ? cycle01 + 1 : 2"
          :max="31"
        />
        day
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="4">
        From
        <el-input-number v-model="average01" :min="1" :max="30" /> start, every
        <el-input-number
          v-model="average02"
          :min="1"
          :max="31 - average01 || 1"
        />
        days execute once
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="5">
        Monthly
        <el-input-number v-model="workday" :min="1" :max="31" />
        nearest working day
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="6"> Last day of the month </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio v-model="radioValue" :label="7">
        Specify
        <el-select
          clearable
          v-model="checkboxList"
          placeholder="Multiple selection"
          multiple
          style="width: 100%"
        >
          <el-option v-for="item in 31" :key="item" :value="item">{{
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
      workday: 1,
      cycle01: 1,
      cycle02: 2,
      average01: 1,
      average02: 1,
      checkboxList: [],
      checkNum: this.$options.propsData.check,
    };
  },
  name: "crontab-day",
  props: ["check", "cron"],
  methods: {
    // When radio button value changes
    radioChange() {
      if (this.radioValue !== 2 && this.cron.week !== "?") {
        this.$emit("update", "week", "?", "day");
      }

      switch (this.radioValue) {
        case 1:
          this.$emit("update", "day", "*");
          break;
        case 2:
          this.$emit("update", "day", "?");
          break;
        case 3:
          this.$emit("update", "day", this.cycleTotal);
          break;
        case 4:
          this.$emit("update", "day", this.averageTotal);
          break;
        case 5:
          this.$emit("update", "day", this.workday + "W");
          break;
        case 6:
          this.$emit("update", "day", "L");
          break;
        case 7:
          this.$emit("update", "day", this.checkboxString);
          break;
      }
    },
    // When cycle two values change
    cycleChange() {
      if (this.radioValue == "3") {
        this.$emit("update", "day", this.cycleTotal);
      }
    },
    // When average two values change
    averageChange() {
      if (this.radioValue == "4") {
        this.$emit("update", "day", this.averageTotal);
      }
    },
    // When nearest working day value changes
    workdayChange() {
      if (this.radioValue == "5") {
        this.$emit("update", "day", this.workdayCheck + "W");
      }
    },
    // When checkbox value changes
    checkboxChange() {
      if (this.radioValue == "7") {
        this.$emit("update", "day", this.checkboxString);
      }
    },
  },
  watch: {
    radioValue: "radioChange",
    cycleTotal: "cycleChange",
    averageTotal: "averageChange",
    workdayCheck: "workdayChange",
    checkboxString: "checkboxChange",
  },
  computed: {
    // Calculate two cycle values
    cycleTotal: function () {
      const cycle01 = this.checkNum(this.cycle01, 1, 30);
      const cycle02 = this.checkNum(
        this.cycle02,
        cycle01 ? cycle01 + 1 : 2,
        31,
        31,
      );
      return cycle01 + "-" + cycle02;
    },
    // Calculate values used for average
    averageTotal: function () {
      const average01 = this.checkNum(this.average01, 1, 30);
      const average02 = this.checkNum(this.average02, 1, 31 - average01 || 0);
      return average01 + "/" + average02;
    },
    // Calculate working day format
    workdayCheck: function () {
      const workday = this.checkNum(this.workday, 1, 31);
      return workday;
    },
    // Calculate collection of checked checkbox values
    checkboxString: function () {
      let str = this.checkboxList.join();
      return str == "" ? "*" : str;
    },
  },
};
</script>
