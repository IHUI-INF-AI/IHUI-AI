package com.ai.manager.small.domain.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

@EqualsAndHashCode(callSuper = true)
@Data
@Schema(name = "订单")
public class OrderPageDTO extends PageBean {

    // @Id // Removed JPA annotation
    // @GeneratedValue(strategy = GenerationType.IDENTITY) // Removed JPA annotation
    private Long id;
    private Integer userId;
    @Schema(description = "订单号")
    private String outTradeNo;
    private String openId;
    @Schema(description = "支付金额（分）")
    private Integer amount;
    @Schema(description = "订单状态（0-待支付，1-已支付，2-已发货，3-已完成，4-已取消，5-已退款, 6-已结束）")
    private Integer status;
    @Schema(description = "支付状态（0-待支付，1-已支付 2-退款中 3已结束）")
    private Integer paymentStatus;
    @Schema(description = "创建订单时间")
    private Long createdAt;
    @Schema(description = "完成订单时间")
    private Long paidAt;
    @Schema(description = "商品ID，关联商品表")
    private Long productId;
    @Schema(description = "订单类型。1为会员 2为Token 3活动 4开通")
    private Integer orderType;
    @Schema(description = "退单时间")
    private Date refundTime;
    @Schema(description = "退款原因")
    private Date refundReason;

    @Schema(description = "活动id")
    private String activityId;
    @Schema(description = "角色商品id")
    private String productIdentityId;


    @Schema(description = "商品名称")
    private String productName;
    @Schema(description = "商品图片")
    private String images;


    @Schema(description = "查询使用")
    private String search;

    @Schema(description = "用户唯一标识")
    private String token;

    // Remove manual getters and setters if they exist
} 