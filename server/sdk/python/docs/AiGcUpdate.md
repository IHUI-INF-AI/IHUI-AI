# AiGcUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **int** |  | 
**user_uuid** | **str** |  | [optional] 
**agent_id** | **str** |  | [optional] 
**gc_type** | **str** |  | [optional] 
**content** | **str** |  | [optional] 
**status** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.ai_gc_update import AiGcUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of AiGcUpdate from a JSON string
ai_gc_update_instance = AiGcUpdate.from_json(json)
# print the JSON string representation of the object
print(AiGcUpdate.to_json())

# convert the object into a dict
ai_gc_update_dict = ai_gc_update_instance.to_dict()
# create an instance of AiGcUpdate from a dict
ai_gc_update_from_dict = AiGcUpdate.from_dict(ai_gc_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


