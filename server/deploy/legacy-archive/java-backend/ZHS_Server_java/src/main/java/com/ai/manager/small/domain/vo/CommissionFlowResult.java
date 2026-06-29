package com.ai.manager.small.domain.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serializable;

/**
 * 流水统计
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class CommissionFlowResult implements Serializable {
    // 总金额
    @Schema(name = "总金额")
    private Long totalIncome;
    // 当前可提现金额
    @Schema(name = "当前可提现金额")
    private Long currentAmount;
    // 日
    @Schema(name = "日")
    private CommissionFlowStatistics dayStatistics;
    // 月
    @Schema(name = "月")
    private CommissionFlowStatistics monthStatistics;
    // 总
    @Schema(name = "总")
    private CommissionFlowStatistics sumStatistics;
}
