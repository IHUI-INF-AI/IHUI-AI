# RuleSpec

单条抑制规则 (alertmanager YAML JSON 等价).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** | 规则名 (可空, 便于日志) | [optional] [default to '']
**source_match** | **Dict[str, object]** | source 侧 matchers (AND) | [optional] 
**target_match** | **Dict[str, object]** | target 侧 matchers (AND) | [optional] 
**equal** | **List[str]** | equal 字段列表, None&#x3D;alertname | [optional] 

## Example

```python
from zhs_api.models.rule_spec import RuleSpec

# TODO update the JSON string below
json = "{}"
# create an instance of RuleSpec from a JSON string
rule_spec_instance = RuleSpec.from_json(json)
# print the JSON string representation of the object
print(RuleSpec.to_json())

# convert the object into a dict
rule_spec_dict = rule_spec_instance.to_dict()
# create an instance of RuleSpec from a dict
rule_spec_from_dict = RuleSpec.from_dict(rule_spec_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


