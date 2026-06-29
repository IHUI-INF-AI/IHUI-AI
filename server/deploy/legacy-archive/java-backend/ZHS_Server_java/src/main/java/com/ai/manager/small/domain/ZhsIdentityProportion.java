package com.ai.manager.small.domain;

import lombok.*;

import java.io.Serializable;
import java.util.Date;

/**
 * 当前分润比例对象 zhs_identity_proportion
 * 
 * @author Raindrop_L
 * @date 2025-06-10
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@ToString
public class ZhsIdentityProportion implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** UUID */
    private String id;

    /** 活动开始时间 */
    private Date beginTime;

    /** 活动结束时间 */
    private Date endTime;

    /** 启用状态 0停止 | 1启动 */
    private Integer status;

    /** 邀请新用户赠送token */
    private Long gift;

    /** token分润比例 % */
    private Integer tokenProportion;

    /** vip邀请新用户赠送token */
    private Long vipGift;

    /** vip身份常规分润比例 % */
    private Integer routineProportion;

    /** vip身份vip分润比例 % */
    private Integer vipProportion;

    /** vip身份操盘手分润比例 % */
    private Integer traderProportion;

    /** 操盘手邀请新用户赠送token */
    private Long traderGift;

    /** 操盘手身份常规分润比例 % */
    private Integer traderRoutineProportion;

    /** 操盘手身份vip分润比例 % */
    private Integer traderVipProportion;

    /** 操盘手身份vip分润比例 % */
    private Integer traderTraderProportion;

    /** 二级常规分润比例 % */
    private Integer grandRoutineProportion;

    /** 二级vip分润比例 % */
    private Integer grandVipProportion;

    /** 二级操盘手分润比例 % */
    private Integer grandTraderProportion;

    /** 创建人 */
    private String creator;

    /** 创建时间 */
    private Date createdTime;

    /** 修改人 */
    private String updator;

    /** 修改时间 */
    private Date updatedTime;
}
