package com.ai.manager.course.mapper;

import com.ai.manager.course.domain.ZhsCategoryDictionary;
import com.ai.manager.course.domain.vo.ZhsCategoryDictionaryVO;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.MapKey;
import org.apache.ibatis.annotations.Param;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 赛道字典Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-09-02
 */
@DS("course")
public interface ZhsCategoryDictionaryMapper 
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
    public int addZhsCategoryDictionary(ZhsCategoryDictionary zhsCategoryDictionary);

    /**
     * 修改赛道字典
     * 
     * @param zhsCategoryDictionary 赛道字典
     * @return 结果
     */
    public int edit(ZhsCategoryDictionary zhsCategoryDictionary);

    /**
     * 删除赛道字典
     * 
     * @param id 赛道字典主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除赛道字典
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    List<ZhsCategoryDictionaryVO> getByLinkIds(@Param("agentIds") List<String> agentIds);

    @MapKey("id")
    Map<String, String> getParentMap(@Param("ids") ArrayList<String> ids);
}
