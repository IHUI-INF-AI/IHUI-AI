package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 存储Coze平台的智能体基本信息对象 agents
 * 
 * @author Raindrop_L
 * @date 2025-08-15
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class Agents extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** 智能体唯一标识符，对应Coze的bot_id */
    private String agentId;

    /** 智能体名称，对应Coze的bot_name */
    @Schema(description = "智能体名称，对应Coze的bot_name")
    private String agentName;

    /** 智能体功能描述，对应Coze的description */
    @Schema(description = "智能体功能描述，对应Coze的description")
    private String agentDescription;

    /** 智能体头像图片URL地址 */
    @Schema(description = "智能体头像图片URL地址")
    private String agentAvatar;

    /** 智能体版本号，对应Coze的version */
    @Schema(description = "智能体版本号，对应Coze的version")
    private String agentVersion;

    /** Coze平台的机器人ID（数字格式） */
    @Schema(description = "Coze平台的机器人ID 数=字格式")
    private String botId;

    /** Coze平台的机器人ID（字符串格式） */
    @Schema(description = "Coze平台的机器人ID, 字=符串格式")
    private String botIdStr;

    /** Coze平台的机器人名称 */
    @Schema(description = "Coze平台的机器人名称")
    private String botName;

    /** Coze连接器唯一标识符 */
    @Schema(description = "Coze连接器唯一标识符")
    private String connectorId;

    /** Coze连接器用户ID，用户登录时输入的真实用户标识 */
    @Schema(description = "Coze连接器用户ID，用户登录时输入的真实用户标识")
    private String connectorUserId;

    /** Coze平台用户ID（数字格式） */
    @Schema(description = "Coze平台用户ID, 数=字格式")
    private String userId;

    /** Coze平台用户ID（字符串格式） */
    @Schema(description = "Coze平台用户ID, 字=符串格式")
    private String userIdStr;

    /** Coze平台用户显示名称 */
    @Schema(description = "Coze平台用户显示名称")
    private String userName;

    /** 智能体系统提示词，定义智能体的行为和角色 */
    @Schema(description = "智能体系统提示词，定义智能体的行为和角色")
    private String agentPrompt;

    /** 使用的AI模型名称，如GPT-4、Claude等 */
    @Schema(description = "使用的AI模型名称，如GPT-4、Claude等")
    private String agentModel;

    /** 模型温度参数，控制回答的随机性 */
    @Schema(description = "模型温度参数，控制回答的随机性")
    private String agentTemperature;

    /** 单次对话最大Token数量限制 */
    @Schema(description = "单次对话最大Token数量限制")
    private Long agentMaxTokens;

    /** 智能体变量配置JSON，存储从Coze API获取的Variable参数 */
    @Schema(description = "智能体变量配置JSON，存储从Coze API获取的Variable参数")
    private String agentVariables;

    /** 发布状态：draft=草稿，published=已发布，rejected=被拒绝 */
    @Schema(description = "发布状态：draft=草稿，published=已发布，rejected=被拒绝")
    private String publishStatus;

    /** 发布渠道，如coze、marketplace等 */
    @Schema(description = "发布渠道，如coze、marketplace等")
    private String publishChannel;

    /** 智能体发布时间 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    @Schema(description = "智能体发布时间, yyyy-MM-dd")
    private Date publishTime;

    /** 智能体分类，如助手、娱乐、工具等 */
    @Schema(description = "智能体分类，如助手、娱乐、工具等")
    private String category;

    /** 智能体标签数组，用于搜索和分类 */
    @Schema(description = "智能体标签数组，用于搜索和分类")
    private String tags;

    /** 是否公开可见：true=公开，false=私有 */
    @Schema(description = "是否公开可见：true=公开，false=私有")
    private Integer isPublic;

    /** 访问级别：private=私有，internal=内部，public=公开 */
    @Schema(description = "访问级别：private=私有，internal=内部，public=公开")
    private String accessLevel;

    /** 智能体使用次数统计 */
    @Schema(description = "智能体使用次数统计")
    private Long usageCount;

    /** 用户点赞数量统计 */
    @Schema(description = "用户点赞数量统计")
    private Long likeCount;

    /** 分享次数统计 */
    @Schema(description = "分享次数统计")
    private Long shareCount;

    /** 创建者用户ID，对应Coze的user_id */
    @Schema(description = "创建者用户ID，对应Coze的user_id")
    private String creatorId;

    /** 创建者用户名，对应Coze的user_name */
    @Schema(description = "创建者用户名，对应Coze的user_name")
    private String creatorName;

    /** Coze回调完整数据JSON存储，用于调试和数据恢复 */
    @Schema(description = "Coze回调完整数据JSON存储，用于调试和数据恢复")
    private String callbackData1;

    /** 特定回调信息文本存储 */
    @Schema(description = "特定回调信息文本存储")
    private String callbackData2;

    /** 回调状态或其他简短信息存储 */
    @Schema(description = "回调状态或其他简短信息存储")
    private String callbackData3;

    /** 记录创建时间 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    @Schema(description = "记录创建时间, yyyy-MM-dd")
    private Date createdAt;

    /** 记录最后更新时间 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    @Schema(description = "记录最后更新时间, yyyy-MM-dd")
    private Date updatedAt;

    /** $column.columnComment */
    @Schema(description = "${comment}, $column.readConverterExp()")
    private String prologue;

    /** 预估token */
    @Schema(description = "预估token")
    private String allToken;

    /** 排序 */
    @Schema(description = "排序")
    private Long sort;

    /** 事件所属的扣子账号 ID。例如，在智能体发布事件中，即为该智能体所属空间的所有者的账号 ID */
    @Schema(description = "事件所属的扣子账号 ID。例如，在智能体发布事件中，即为该智能体所属空间的所有者的账号 ID")
    private String cozeAccountId;

    /** 收费模式 1免费 2限免3 收费 */
    @Schema(description = "收费模式 1免费 2限免3 收费")
    private String type;
    @Schema(description = "来源")
    private String source;

    private ZhsAgentBuy agentBuy;

    private ZhsAgentCategory categoryList;
    private List<Map<String, String>> agentCategory;
    private List<Map<String, String>> agentMainCategory;

    private String categoryId;
    private String categoryName;
    private String labelIds;
    private String labelNames;

    @Schema(description = "是否是热门")
    private Integer isHot = 0;

    private List<String> labelIdList;

    @Schema(description = "是否收藏")
    private Integer isCollect = 0;
    @Schema(description = "是否点赞")
    private Integer isThumbs = 1;

    @Schema(description = "头像")
    private String userAvatar;
    @Schema(description = "昵称")
    private String userNickname;

    private String suggestedQuestions;
}
