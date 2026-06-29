package com.ai.manager.course.domain.vo;

import com.ai.manager.course.domain.ZhsCategoryDictionary;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * 赛道字典对象 zhs_category_dictionary
 * 
 * @author Raindrop_L
 * @date 2025-09-02
 */

@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsCategoryDictionaryVO extends ZhsCategoryDictionary
{
    private static final long serialVersionUID = 1L;

    private String agentId;
}
