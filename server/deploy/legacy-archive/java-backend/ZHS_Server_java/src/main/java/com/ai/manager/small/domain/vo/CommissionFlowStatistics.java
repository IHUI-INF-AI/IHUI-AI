package com.ai.manager.small.domain.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serializable;

/**
 * 时间范围统计结果
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Schema(name = "佣金流水统计")
public class CommissionFlowStatistics implements Serializable {
    @Schema(name = "收益")
    private Long amount;
    // 待结算 （周期外订单金额）
    @Schema(name = "待结算")
    private Long incomplete;
    // 已结算（周期外订单金额）
    @Schema(name = "已结算")
    private Long finish;
    // 日推广订单 （下级和下下级）
    @Schema(name = "日推广订单")
    private Integer order;
    // 日增长人数 （下级和下下级）
    @Schema(name = "日增长人数")
    private Integer strength;
    // 日体现金额
    @Schema(name = "日提现金额")
    private Long endAmount;
}
