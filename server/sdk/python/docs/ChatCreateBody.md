# ChatCreateBody


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model_name** | **str** | Model name | 
**mark** | **str** | Chat summary/label | [optional] 

## Example

```python
from zhs_api.models.chat_create_body import ChatCreateBody

# TODO update the JSON string below
json = "{}"
# create an instance of ChatCreateBody from a JSON string
chat_create_body_instance = ChatCreateBody.from_json(json)
# print the JSON string representation of the object
print(ChatCreateBody.to_json())

# convert the object into a dict
chat_create_body_dict = chat_create_body_instance.to_dict()
# create an instance of ChatCreateBody from a dict
chat_create_body_from_dict = ChatCreateBody.from_dict(chat_create_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


