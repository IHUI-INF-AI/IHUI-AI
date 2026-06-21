# AppSchemasAskCommentCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**target_type** | **str** |  | 
**target_id** | **int** |  | 
**content** | **str** |  | 
**pid** | **int** |  | [optional] [default to 0]

## Example

```python
from zhs_api.models.app_schemas_ask_comment_create import AppSchemasAskCommentCreate

# TODO update the JSON string below
json = "{}"
# create an instance of AppSchemasAskCommentCreate from a JSON string
app_schemas_ask_comment_create_instance = AppSchemasAskCommentCreate.from_json(json)
# print the JSON string representation of the object
print(AppSchemasAskCommentCreate.to_json())

# convert the object into a dict
app_schemas_ask_comment_create_dict = app_schemas_ask_comment_create_instance.to_dict()
# create an instance of AppSchemasAskCommentCreate from a dict
app_schemas_ask_comment_create_from_dict = AppSchemasAskCommentCreate.from_dict(app_schemas_ask_comment_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


