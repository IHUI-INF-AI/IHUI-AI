package com.ai.manager.small.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;

/**
 * 开通身份订单对象 zhs_product_identity
 * 
 * @author Raindrop_L
 * @date 2025-06-07
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class ZhsProductIdentity
{
    private static final long serialVersionUID = 1L;

    /** uuid */
    private String id;

    /** 价格 */
    private Integer amount;

    /** 优惠开始时间 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date beginTime;

    /** 优惠截至时间 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date endTime;

    /** 商品默认价格 */
    private Integer defAmount;

    /** 优惠启用状态 0不启用| 1启用 */
    private Integer status;

    /** 创建人 */
    private String creator;

    /** 创建时间 */
    private Date createdTime;

    /** 修改人 */
    private String updator;

    /** 修改时间 */
    private Date updatedTime;

    private String remark;

    // 类型 0普通用户 | 1身份 | 2开发者 | 3期限会员 | 4连续订阅会员
    private Integer type;

    // 常规分润比例
    private Integer routineProportion;
    // vip分润比例
    private Integer vipProportion;
    // 操盘手分润比例
    private Integer traderProportion;
    // 失效时长 天
    private Integer expireAt;

    // 赠送的token
    private Integer giveToken;
    // 标签图片地址
    private String labelPic;
    // 详情
    private String detail;


}
