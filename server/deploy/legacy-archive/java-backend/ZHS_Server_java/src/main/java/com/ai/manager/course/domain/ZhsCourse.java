package com.ai.manager.course.domain;

import com.ai.manager.course.domain.vo.ZhsCategoryDictionaryVO;
import com.ai.manager.small.domain.vo.AgentCategoryVO;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;
import java.util.List;

/**
 * 课程对象 zhs_course
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsCourse
{
    private static final long serialVersionUID = 1L;

    /** 唯一标识 */
    @Schema(description = "唯一标识")
    private String id;

    /** 标题 */
    @Schema(description = "标题")
    private String title;

    /** 副标题 */
    @Schema(description = "副标题")
    private String subtitle;

    /** 正文 */
    @Schema(description = "正文")
    private String content;

    /** 描述附件 */
    @Schema(description = "描述附件")
    private String remarkFile;

    /** 封面 */
    @Schema(description = "封面")
    private String binding;

    /** 阶段 0入门 | 1进阶 | 2精通 */
    @Schema(description = "阶段 0入门 | 1进阶 | 2精通")
    private Integer stage;

    /** 逻辑隐藏 0可用 | 1隐藏 */
    @Schema(description = "逻辑隐藏0可用 | 1隐藏")
    private Integer isHidden;

    /** 逻辑删除 0可用 |1删除 */
    @Schema(description = "逻辑删除 0可用 |1删除")
    private Integer isDel;

    /** 排序字段 */
    @Schema(description = "排序字段")
    private Integer sort;

    /** 创建人 */
    @Schema(description = "创建人")
    private String creator;

    /** 创建时间 */
    @Schema(description = "创建时间")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    private Date createdAt;

    /** 修改人 */
    @Schema(description = "修改人")
    private String updator;

    /** 修改时间 */
    @Schema(description = "修改时间")
    private Date updatedAt;
    
    @Schema(description = "备注")
    private String remark;

    @Schema(description = "自定义标签")
    private String label;

    /** 价格表 */
    @Schema(description = "价格表")
    private ZhsCoursePay pay;

    /** 种类 */
    @Schema(description = "种类")
    private String types;
    /** 赛道 */
    @Schema(description = "赛道")
    private String categorys;

    @Schema(description = "平台")
    private String platform;


    @Schema(description = "回参标签")
    private List<AgentCategoryVO> typeList;

    @Schema(description = "回参赛道")
    private List<ZhsCategoryDictionaryVO> categoryList;


    private List<String> typeArray;
    private List<String> categoryArray;

    private String nickname;
    private String avatar;

    private Integer auditStatus;

    private String courseId;
}
