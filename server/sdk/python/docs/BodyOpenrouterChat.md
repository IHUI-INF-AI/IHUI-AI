# BodyOpenrouterChat


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**messages** | **List[object]** |  | 
**model** | **str** |  | [optional] [default to 'openai/gpt-4o-mini']
**temperature** | **float** |  | [optional] [default to 0.7]
**max_tokens** | **int** |  | [optional] [default to 2048]

## Example

```python
from zhs_api.models.body_openrouter_chat import BodyOpenrouterChat

# TODO update the JSON string below
json = "{}"
# create an instance of BodyOpenrouterChat from a JSON string
body_openrouter_chat_instance = BodyOpenrouterChat.from_json(json)
# print the JSON string representation of the object
print(BodyOpenrouterChat.to_json())

# convert the object into a dict
body_openrouter_chat_dict = body_openrouter_chat_instance.to_dict()
# create an instance of BodyOpenrouterChat from a dict
body_openrouter_chat_from_dict = BodyOpenrouterChat.from_dict(body_openrouter_chat_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


