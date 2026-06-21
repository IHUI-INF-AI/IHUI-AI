# BodyUserModelChatChat


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** |  | [optional] [default to 'gpt-4o-mini']
**messages** | **List[object]** |  | 
**temperature** | **float** |  | [optional] [default to 0.7]
**max_tokens** | **int** |  | [optional] [default to 2048]
**stream** | **bool** |  | [optional] [default to False]

## Example

```python
from zhs_api.models.body_user_model_chat_chat import BodyUserModelChatChat

# TODO update the JSON string below
json = "{}"
# create an instance of BodyUserModelChatChat from a JSON string
body_user_model_chat_chat_instance = BodyUserModelChatChat.from_json(json)
# print the JSON string representation of the object
print(BodyUserModelChatChat.to_json())

# convert the object into a dict
body_user_model_chat_chat_dict = body_user_model_chat_chat_instance.to_dict()
# create an instance of BodyUserModelChatChat from a dict
body_user_model_chat_chat_from_dict = BodyUserModelChatChat.from_dict(body_user_model_chat_chat_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


