package com.ai.manager.small.domain;

import lombok.*;

import java.io.Serializable;
import java.util.Date;

/**
 * 用户支付购买智能体记录表对象 zhs_agent_buy
 * 
 * @author AI Assistant
 * @date 2025-08-12
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsAgentBuy implements Serializable {
    private static final long serialVersionUID = 1L;

    /** id */
    private String id;

    /** 智能体id,对应botId */
    private String agentId;

    /** 智能体名称 */
    private String agentName;

    /** 智能体开发者uuId */
    private String agentOrderUuid;

    /** 购买人uuid */
    private String bugUuid;

    /** 购买人名称 */
    private String bugName;

    /** 购买时间 */
    private Date bugTime;

    /** 对应配置表ID */
    private String categoryId;

    /** 折扣，按照100写 8折 写80 */
    private Integer discount;

    /** 实际标价，折扣后的实际支付金额 单位：分 */
    private Integer realPrice;

    /** 标价配置表中的account */
    private Integer price;

    /** 购买数量-单位:月 */
    private Integer count;

    /** 过期时间，计算后的续费过期时间 */
    private Date expirationDate;

    /** 状态：0=生效，1=过期 */
    private String status;

    /** 订单号 */
    private String orderNo;

    /** 是否支付成功：0=未支付，1=已支付 */
    private String settlement;

    private String prologue;
}
