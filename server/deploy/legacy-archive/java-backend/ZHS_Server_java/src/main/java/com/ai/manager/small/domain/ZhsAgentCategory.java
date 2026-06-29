package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import org.apache.commons.lang3.StringUtils;

/**
 * 开发者智能体收费配置对象 zhs_agent_category
 * 
 * @author Raindrop_L
 * @date 2025-08-12
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsAgentCategory extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** id */
    private String id;

    /** 智能体id,对应botId */
    @Schema(description = "智能体id,对应botId")
    private String agentId;

    /** 智能体名称 */
    @Schema(description = "智能体名称")
    private String agentName;

    /** 创建收费配置的用户，为coze平台开发者 */
    @Schema(description = "创建收费配置的用户，为coze平台开发者")
    private String createUuid;

    /** 创建人名称用户名 */
    @Schema(description = "创建人名称用户名")
    private String createName;

    /** 智能体大类 1文字2图片3视频 */
    @Schema(description = "智能体大类 1文字2图片3视频")
    private String agentMainCategory;

    /** 智能体细分 汽车，教育，医疗，法律 关联字典表 ID */
    @Schema(description = "智能体细分 汽车，教育，医疗，法律 关联字典表 ID")
    private String agentCategory;

    /** 1免费 2限免3 收费 */
    @Schema(description = "1免费 2限免3 收费")
    private String type;

    /** 售卖价格 单位：分/月 */
    @Schema(description = "售卖价格 单位：分/月")
    private Long account;

    /** 1会员2 全部 */
    @Schema(description = "1会员2 全部")
    private String group;

    /** 1:1个月，2：3个月，3：6个月，4：1年 */
    @Schema(description = "1:1个月，2：3个月，3：6个月，4：1年")
    private String limitFree;

    /** 1：6个月后八折，2：9个月后7折 3：1年后5折 */
    @Schema(description = "1：6个月后八折，2：9个月后7折 3：1年后5折")
    private String discountMonth;

    /** 开场白 */
    @Schema(description = "开场白")
    private String prologue;

    /** 售卖方式种类细分1月2年3永久 */
    @Schema(description = "售卖方式种类细分1月2年3永久")
    private String typeChild;

    private String createTime;

    public String getTypeChildName() {
        if(StringUtils.isBlank(typeChild)){
            return "免费";
        }
        if(typeChild.equals("1")){
            return "月";
        }
        if(typeChild.equals("2")){
            return "年";
        }
        if(typeChild.equals("3")){
            return "永久";
        }
        return "免费";
    }
}
