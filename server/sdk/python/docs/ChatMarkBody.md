# ChatMarkBody


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**mark** | **str** | New mark/label text | 

## Example

```python
from zhs_api.models.chat_mark_body import ChatMarkBody

# TODO update the JSON string below
json = "{}"
# create an instance of ChatMarkBody from a JSON string
chat_mark_body_instance = ChatMarkBody.from_json(json)
# print the JSON string representation of the object
print(ChatMarkBody.to_json())

# convert the object into a dict
chat_mark_body_dict = chat_mark_body_instance.to_dict()
# create an instance of ChatMarkBody from a dict
chat_mark_body_from_dict = ChatMarkBody.from_dict(chat_mark_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


