package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import lombok.*;

import java.util.Date;

/**
 * 用户对象 zhs_user
 * 
 * @author Raindrop_L
 * @date 2025-06-18
 */

@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsUser extends PageBean {

    /** 自增id */
    private Integer id;

    /** 用户token值 */
    private String token;

    /** 小程序用户唯一ID */
    private String openId;

    /** 用户昵称 */
    private String nickname;

    /** 用户登录名称 */
    private String userName;

    /** 用户登录密码 */
    private String userPassword;

    /** 头像 URL */
    private String avatar;

    /** 名片URL */
    private String card;

    /** 手机号（可选） */
    private String phone;

    /** 分销邀请码（唯一） */
    private String inviteCode;

    /** 上级推荐人ID（为空表示没有上级） */
    private String parentId;

    /** 账户余额（默认0分） */
    private Long balance;

    /** 累计收益（默认0分） */
    private Long totalEarnings;

    /** 注册时间 */
    private Long createdAt;

    /** 更新时间 */
    private Long updatedAt;

    /** 是否是VIP（0不是，1是，-1游客） */
    private Integer isVip;

    /** 成为VIP时间 */
    private Date isVipTime;

    /** 身份类型（0-用户，1-操盘手，9-管理员） */
    private Integer identityTypy;

    /** 成为操盘手时间 */
    private Date identityTypyTime;

    /** 分佣比例  普通会员 0.3的比例  操盘手 0.9的比例 */
    private Double commissionRatio;

    /** token的数量 */
    private Long tokenQuantity;

    /** 每日免费次数；默认3次 */
    private Long tokenFree;

    /** 用户小程序appid */
    private String appId;

}
