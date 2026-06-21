# ChatQueryBody


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model_name** | **str** | Model name (optional filter) | [optional] 

## Example

```python
from zhs_api.models.chat_query_body import ChatQueryBody

# TODO update the JSON string below
json = "{}"
# create an instance of ChatQueryBody from a JSON string
chat_query_body_instance = ChatQueryBody.from_json(json)
# print the JSON string representation of the object
print(ChatQueryBody.to_json())

# convert the object into a dict
chat_query_body_dict = chat_query_body_instance.to_dict()
# create an instance of ChatQueryBody from a dict
chat_query_body_from_dict = ChatQueryBody.from_dict(chat_query_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


