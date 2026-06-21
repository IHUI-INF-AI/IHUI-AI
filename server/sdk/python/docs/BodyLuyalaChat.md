# BodyLuyalaChat


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**messages** | **List[object]** |  | 
**model** | **str** |  | [optional] [default to 'luyala-pro']
**temperature** | **float** |  | [optional] [default to 0.7]
**max_tokens** | **int** |  | [optional] [default to 2048]

## Example

```python
from zhs_api.models.body_luyala_chat import BodyLuyalaChat

# TODO update the JSON string below
json = "{}"
# create an instance of BodyLuyalaChat from a JSON string
body_luyala_chat_instance = BodyLuyalaChat.from_json(json)
# print the JSON string representation of the object
print(BodyLuyalaChat.to_json())

# convert the object into a dict
body_luyala_chat_dict = body_luyala_chat_instance.to_dict()
# create an instance of BodyLuyalaChat from a dict
body_luyala_chat_from_dict = BodyLuyalaChat.from_dict(body_luyala_chat_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


