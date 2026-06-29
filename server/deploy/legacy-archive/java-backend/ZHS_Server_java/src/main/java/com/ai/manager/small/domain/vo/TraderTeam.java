package com.ai.manager.small.domain.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Schema(name = "操盘手团队")
public class TraderTeam {
    /*@Schema(description = "自增id")
    private Integer id;

    @Schema(description = "用户token值")
    private String token;

    @Schema(description = "小程序用户唯一ID")
    private String openId;

    @Schema(description = "用户昵称")
    private String nickname;

    @Schema(description = "用户登录名称")
    private String userName;

    @Schema(description = "用户登录密码")
    private String userPassword;


    @Schema(description = "名片URL")
    private String card;

    @Schema(description = "手机号（可选）")
    private String phone;

    @Schema(description = "分销邀请码（唯一）")
    private String inviteCode;

    @Schema(description = "上级推荐人ID（为空表示没有上级）")
    private String parentId;

    @Schema(description = "账户余额（默认0分）")
    private Long balance;

    @Schema(description = "累计收益（默认0分）")
    private Long totalEarnings;

    @Schema(description = "注册时间")
    private Long createdAt;

    @Schema(description = "更新时间")
    private Long updatedAt;

    @Schema(description = "是否是VIP（0不是，1是）")
    private Integer isVIP;

    @Schema(description = "成为VIP时间")
    private Date isVipTime;

    @Schema(description = "身份类型（0-用户，1-操盘手，9-管理员）")
    private Integer identityTypy;

    @Schema(description = "成为操盘手时间")
    private Date identityTypyTime;

    @Schema(description = "分佣比例 普通会员 0.3的比例 操盘手 0.9的比例")
    private Double commissionRatio;

    @Schema(description = "token的数量")
    private Long tokenQuantity;

    @Schema(description = "每日免费次数；默认3次")
    private Integer tokenFree;
    // "数据库不存在字段"
    @Schema(description = "头像地址")
    private String profilePicUrl;

    @Schema(description = "头像地址")
    private Integer status;
    @Schema(description = "订单号")
    private String outTradeNo;

    @Schema(description = "操作描述")
    private String operateDesc;

    @Schema(description = "商品类型")
    private Integer productType;

    @Schema(description = "vip信息")
    private ZhsVipLevel vipLevel;

    @Schema(description = "子级操盘手用户")
    private List<TraderTeam> childTraders;*/
    @Schema(description = "自增id")
    private String id;
    @Schema(description = "用户openId")
    private String openId;
    @Schema(description = "昵称")
    private String nickname;
    @Schema(description = "VIPId")
    private String vipId;
    @Schema(description = "VIP级别")
    private String vipName;
    @Schema(description = "成交额度")
    private Integer transactionVolume = 0;
    @Schema(description = "获取佣金")
    private Integer commission = 0;
    @Schema(description = "成交订单数")
    private Integer orderNum = 0;
    @Schema(description = "上级用户名称")
    private String parentName;
    @Schema(description = "🥇地址")
    private String levelUrl;


    @Schema(description = "注册时间")
    private Long createdAt;

    @Schema(description = "手机号（可选）")
    private String phone;

    @Schema(description = "头像 URL")
    private String avatar;
}
