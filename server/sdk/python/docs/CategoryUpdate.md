# CategoryUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **int** |  | 
**pid** | **int** |  | [optional] 
**name** | **str** |  | [optional] 
**sort_order** | **int** |  | [optional] 
**is_show** | **bool** |  | [optional] 
**is_show_index** | **bool** |  | [optional] 
**image** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.category_update import CategoryUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of CategoryUpdate from a JSON string
category_update_instance = CategoryUpdate.from_json(json)
# print the JSON string representation of the object
print(CategoryUpdate.to_json())

# convert the object into a dict
category_update_dict = category_update_instance.to_dict()
# create an instance of CategoryUpdate from a dict
category_update_from_dict = CategoryUpdate.from_dict(category_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


