package com.ai.manager.course.service;

import com.ai.manager.course.domain.ZhsCategoryDictionary;

import java.util.List;
import java.util.Map;

/**
 * 赛道字典Service接口
 * 
 * @author Raindrop_L
 * @date 2025-09-02
 */
public interface IZhsCategoryDictionaryService
{
    /**
     * 查询赛道字典
     * 
     * @param id 赛道字典主键
     * @return 赛道字典
     */
    public ZhsCategoryDictionary getById(String id);

    /**
     * 查询赛道字典列表
     * 
     * @param zhsCategoryDictionary 赛道字典
     * @return 赛道字典集合
     */
    public List<ZhsCategoryDictionary> getList(ZhsCategoryDictionary zhsCategoryDictionary);

    /**
     * 新增赛道字典
     * 
     * @param zhsCategoryDictionary 赛道字典
     * @return 结果
     */
    public int add(ZhsCategoryDictionary zhsCategoryDictionary);

    /**
     * 修改赛道字典
     * 
     * @param zhsCategoryDictionary 赛道字典
     * @return 结果
     */
    public int edit(ZhsCategoryDictionary zhsCategoryDictionary);

    /**
     * 批量删除赛道字典
     * 
     * @param ids 需要删除的赛道字典主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    /**
     * 删除赛道字典信息
     * 
     * @param id 赛道字典主键
     * @return 结果
     */
    public int delById(String id);

    Map<String, String> getParentMap(String ids);
}
