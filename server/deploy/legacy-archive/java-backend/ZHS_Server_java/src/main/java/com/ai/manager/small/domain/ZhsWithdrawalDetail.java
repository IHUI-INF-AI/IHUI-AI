package com.ai.manager.small.domain;

import lombok.*;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

/**
 * 提现明细对象 zhs_withdrawal_detail
 * 
 * @author 张旭
 * @date 2025-06-11
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsWithdrawalDetail implements Serializable {
    private static final long serialVersionUID = 1L;

    /** Id */
    private String Id;

    /** 关联用户ID */
    private String userId;

    /** 实际金额 */
    private String withdrawalAmount;

    /** 提现方式 */
    private String withdrawalType;

    /** 发起时间 */
    private String withdrawalTime;

    /** 提现状态 */
    private String withdrawalStatus;

    /** 审核人 */
    private String reviewer;

    /** 审核人审核时间 */
    private String reviewerTime;

    /** 到账时间 */
    private String paymentTime;

    /** 是否成功 */
    private String isSuccess;

    /** 备注 */
    private String notes;

    /** 提现批次号 */
    private String outBillNo;

    /** 用户名称 */
    private String userName;
    /** openId */
    private String openId;

    private Map<String,Object> params =new HashMap<>();
    private String orderIds;
    private String weChatMsg;
    public void setParams(Map<String, Object> params) {
        this.params = params;
    }

}
