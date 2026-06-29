package com.ai.manager.course.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;


/**
 * 用户购买课程记录对象 zhs_course_pay_log
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsCoursePayLog extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * 唯一标识
     */
    @Schema(description = "唯一标识")
    private String id;

    /**
     * 用户唯一标识
     */
    @Schema(description = "用户唯一标识")
    private String userUuid;

    /**
     * 付费课程唯一标识
     */
    @Schema(description = "付费课程唯一标识")
    private String courseId;

    /**
     * 视频唯一标识
     */
    @Schema(description = "视频唯一标识")
    private String videoId;

    /**
     * 支付订单id
     */
    @Schema(description = "支付订单id")
    private String outBillOn;

    /**
     * 支付方式 wechat tencent
     */
    @Schema(description = "支付方式 wechat tencent")
    private String payWay;

    /**
     * 订单金额 单位分
     */
    @Schema(description = "订单金额")
    private Integer amount;

    /**
     * 实际订单金额 单位分
     */
    @Schema(description = "实际订单金额")
    private Integer realAmount;

    /**
     * 购买类型 0课程 | 1附件
     */
    @Schema(description = "购买类型 0课程 | 1附件")
    private Integer type;
    /**
     * 支付状态 0-待支付，1-已支付 2-退款中 3已结束
     */
    @Schema(description = "支付状态 0-待支付，1-已支付 2-退款中 3已结束")
    private Integer status;

    /**
     * 订单创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "订单创建时间")
    private Date createdAt;

}
