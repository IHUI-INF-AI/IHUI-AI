package com.ai.manager.small.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class CommissionFlow implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 分佣流水
     */
    private Integer id;

    /**
     * 关联用户id
     */
    private Integer userId;

    /**
     * 关联订单id
     */
    private String orderId;

    /**
     * 用户open_id
     */
    private String openId;

    /**
     * 分佣金额
     */
    @Schema(description = "分佣金额")
    private Integer amount;

    /**
     * 类型， 0上级token | 1上级VIP | 2上上级操盘手
     */
    @Schema(description = "类型， 0上级token | 1上级VIP | 2上上级操盘手")
    private Integer type;

    /**
     * 状态 0未提现 | 1已提现
     */
    @Schema(description = "状态 0未提现 | 1已提现")
    private Integer status;

    /**
     * 分佣token
     */
    @Schema(description = "分佣token")
    private String token;

    /**
     * 创建分佣流水时间
     */
    @Schema(description = "创建分佣流水时间")
    private Long time;

    /**
     * 备注
     */
    @Schema(description = "备注")
    private String remark;

    /**
     * 归属者ID
     */
    @Schema(description = "归属者ID")
    private String belongersOpenId;

    /**
     * 订单状态 0未结算 | 1退单（显示单价为0） | 2已完成
     */
    @Schema(description = "订单状态 0未结算 | 1退单（显示单价为0） | 2已完成")
    private Integer orderStatus;


    @Schema(description = "用户昵称")
    private String nickname;
    @Schema(description = "订单名称")
    private String productName;
    @Schema(description = "订单名称")
    private String activityName;
    @Schema(description = "订单名称")
    private String productIdentityName;
    @Schema(description = "图片地址")
    private String images;
    @Schema(description = "总花费")
    private Long orderAmount;
    @Schema(description = "订单编号")
    private String outTradeNo;


    @Schema(description = "匹配查询")
    private String search;
    @Schema(description = "用户唯一标识")
    private String tokenUuid;

    @Schema(description = "订单类型")
    private Integer orderType;
    @Schema(description = "活动商品id")
    private String productIdentityId;
}