package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.ZhsUserAgentContext;
import com.ai.manager.small.mapper.ZhsUserAgentContextMapper;
import com.ai.manager.small.service.IZhsUserAgentContextService;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.collections.MapUtils;
import org.assertj.core.util.Lists;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 用户关于智能体上下文Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-06-20
 */
@Service
public class ZhsUserAgentContextServiceImpl implements IZhsUserAgentContextService
{
    @Autowired
    private ZhsUserAgentContextMapper zhsUserAgentContextMapper;

    /**
     * 查询用户关于智能体上下文
     * 
     * @param id 用户关于智能体上下文主键
     * @return 用户关于智能体上下文
     */
    @Override
    public ZhsUserAgentContext selectZhsUserAgentContextById(String id)
    {
        return zhsUserAgentContextMapper.selectZhsUserAgentContextById(id);
    }

    /**
     * 查询用户关于智能体上下文列表
     * 
     * @param zhsUserAgentContext 用户关于智能体上下文
     * @return 用户关于智能体上下文
     */
    @Override
    public List<ZhsUserAgentContext> selectZhsUserAgentContextList(ZhsUserAgentContext zhsUserAgentContext)
    {
        List<ZhsUserAgentContext> zhsUserAgentContexts = zhsUserAgentContextMapper.selectZhsUserAgentContextList(zhsUserAgentContext);

        Optional<ZhsUserAgentContext> max = zhsUserAgentContexts.stream().max(Comparator.comparingLong(ZhsUserAgentContext::getSendTime));
        if(max.isPresent()){
            ZhsUserAgentContext zhsUserAgentContext1 = max.get();
            String field1 = zhsUserAgentContext1.getField1();
            return zhsUserAgentContexts.stream().filter(item -> field1.equals(item.getField1())).collect(Collectors.toList());
        }

        return zhsUserAgentContexts;
    }

    /**
     * 新增用户关于智能体上下文
     * 
     * @param zhsUserAgentContext 用户关于智能体上下文
     * @return 结果
     */
    @Override
    public int insertZhsUserAgentContext(ZhsUserAgentContext zhsUserAgentContext)
    {

        return zhsUserAgentContextMapper.insertZhsUserAgentContext(zhsUserAgentContext);
    }

    /**
     * 修改用户关于智能体上下文
     * 
     * @param zhsUserAgentContext 用户关于智能体上下文
     * @return 结果
     */
    @Override
    public int updateZhsUserAgentContext(ZhsUserAgentContext zhsUserAgentContext)
    {
        ZhsUserAgentContext context = zhsUserAgentContextMapper.selectZhsUserAgentContextById(zhsUserAgentContext.getId());
        // 只存上下文10条
        List<ZhsUserAgentContext> userContext = zhsUserAgentContextMapper.getUserContext(context.getAgentId(), context.getUserUuid(), context.getField1());

        // 删除旧数据
        Map<String, List<ZhsUserAgentContext>> collect = userContext.stream().collect(Collectors.groupingBy(ZhsUserAgentContext::getField1));
        if(MapUtils.isNotEmpty(collect)){
            collect.forEach((key, userContexts) ->{
                if(CollectionUtils.isNotEmpty(userContexts)){
                    List<String> ids = userContexts.stream().map(ZhsUserAgentContext::getId).collect(Collectors.toList());
                    int i = zhsUserAgentContextMapper.deleteZhsUserAgentContextByIds(ids);
                }
            });
        }
//        // 删除旧数据
//        if(CollectionUtils.isNotEmpty(userContext)){
//            List<String> ids = userContext.stream().map(ZhsUserAgentContext::getId).collect(Collectors.toList());
//            int i = zhsUserAgentContextMapper.deleteZhsUserAgentContextByIds(ids);
//        }
        return zhsUserAgentContextMapper.updateZhsUserAgentContext(zhsUserAgentContext);
    }

    /**
     * 批量删除用户关于智能体上下文
     * 
     * @param ids 需要删除的用户关于智能体上下文主键
     * @return 结果
     */
    @Override
    public int deleteZhsUserAgentContextByIds(String[] ids)
    {
        return zhsUserAgentContextMapper.deleteZhsUserAgentContextByIds(Arrays.asList(ids));
    }

    /**
     * 删除用户关于智能体上下文信息
     * 
     * @param id 用户关于智能体上下文主键
     * @return 结果
     */
    @Override
    public int deleteZhsUserAgentContextById(String id)
    {
        return zhsUserAgentContextMapper.deleteZhsUserAgentContextById(id);
    }

    @Override
    public List<ZhsUserAgentContext> getUserAgentContextByField(ZhsUserAgentContext build) {

//        ZhsUserAgentContext context = zhsUserAgentContextMapper.selectZhsUserAgentContextById(build.getId());
        List<ZhsUserAgentContext> userContext = zhsUserAgentContextMapper.getUserContextField(build.getAgentId(), build.getUserUuid(), build.getField1());

        Map<String, List<ZhsUserAgentContext>> collect = userContext.stream().collect(Collectors.groupingBy(ZhsUserAgentContext::getField1));
        List<ZhsUserAgentContext> resultList = Lists.newArrayList();
        if(MapUtils.isNotEmpty(collect)){
            collect.forEach((key, contextList) -> {
                Optional<ZhsUserAgentContext> min = contextList.stream().min(Comparator.comparingLong(ZhsUserAgentContext::getSendTime));
                if(min.isPresent()){
                    ZhsUserAgentContext zhsUserAgentContext = min.get();
                    resultList.add(zhsUserAgentContext);
                }
            });
        }
        return resultList.stream().sorted(Comparator.comparingLong(ZhsUserAgentContext::getSendTime).reversed()).collect(Collectors.toList());
    }

    @Override
    public Integer removeContextField(ZhsUserAgentContext build) {
        return zhsUserAgentContextMapper.removeContextField(build);
    }
}
