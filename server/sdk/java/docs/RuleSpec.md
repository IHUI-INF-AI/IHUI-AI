

# RuleSpec

单条抑制规则 (alertmanager YAML JSON 等价).

## Properties

| Name | Type | Description | Notes |
|------------ | ------------- | ------------- | -------------|
|**name** | **String** | 规则名 (可空, 便于日志) |  [optional] |
|**sourceMatch** | **Map&lt;String, Object&gt;** | source 侧 matchers (AND) |  [optional] |
|**targetMatch** | **Map&lt;String, Object&gt;** | target 侧 matchers (AND) |  [optional] |
|**equal** | **List&lt;String&gt;** | equal 字段列表, None&#x3D;alertname |  [optional] |



