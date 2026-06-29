package com.ai.manager.course.service.impl;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.ai.manager.course.domain.ZhsCategoryDictionary;
import com.ai.manager.course.mapper.ZhsCategoryDictionaryMapper;
import com.ai.manager.course.service.IZhsCategoryDictionaryService;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.Lists;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * 赛道字典Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-09-02
 */
@Service
public class ZhsCategoryDictionaryServiceImpl implements IZhsCategoryDictionaryService
{
    @Autowired
    private ZhsCategoryDictionaryMapper zhsCategoryDictionaryMapper;

    /**
     * 查询赛道字典
     * 
     * @param id 赛道字典主键
     * @return 赛道字典
     */
    @Override
    public ZhsCategoryDictionary getById(String id)
    {
        return zhsCategoryDictionaryMapper.getById(id);
    }

    /**
     * 查询赛道字典列表
     * 
     * @param zhsCategoryDictionary 赛道字典
     * @return 赛道字典
     */
    @Override
    public List<ZhsCategoryDictionary> getList(ZhsCategoryDictionary zhsCategoryDictionary)
    {
        List<ZhsCategoryDictionary> list = zhsCategoryDictionaryMapper.getList(zhsCategoryDictionary);
        List<String> collect = list.stream().map(ZhsCategoryDictionary::getId).collect(Collectors.toList());

        List<ZhsCategoryDictionary> list1 = zhsCategoryDictionaryMapper.getList(ZhsCategoryDictionary.builder().parentIds(collect).build());
        if(CollectionUtils.isNotEmpty(list1)){
            Map<String, List<ZhsCategoryDictionary>> collect1 = list1.stream().collect(Collectors.groupingBy(ZhsCategoryDictionary::getPrentId));
            list.forEach(item -> item.setChildren(collect1.get(item.getId())));
        }
        return list;
    }

    /**
     * 新增赛道字典
     * 
     * @param zhsCategoryDictionary 赛道字典
     * @return 结果
     */
    @Override
    public int add(ZhsCategoryDictionary zhsCategoryDictionary)
    {
        return zhsCategoryDictionaryMapper.addZhsCategoryDictionary(zhsCategoryDictionary);
    }

    /**
     * 修改赛道字典
     * 
     * @param zhsCategoryDictionary 赛道字典
     * @return 结果
     */
    @Override
    public int edit(ZhsCategoryDictionary zhsCategoryDictionary)
    {
        return zhsCategoryDictionaryMapper.edit(zhsCategoryDictionary);
    }

    /**
     * 批量删除赛道字典
     * 
     * @param ids 需要删除的赛道字典主键
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids)
    {
        return zhsCategoryDictionaryMapper.delByIds(ids);
    }

    /**
     * 删除赛道字典信息
     * 
     * @param id 赛道字典主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        return zhsCategoryDictionaryMapper.delById(id);
    }

    @Override
    public Map<String, String> getParentMap(String ids) {
        if(StringUtils.isBlank(ids)){
            return null;
        }
        return zhsCategoryDictionaryMapper.getParentMap(Lists.newArrayList(ids.split(",")));
    }
}
