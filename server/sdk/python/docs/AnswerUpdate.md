# AnswerUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **int** |  | 
**content** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.answer_update import AnswerUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of AnswerUpdate from a JSON string
answer_update_instance = AnswerUpdate.from_json(json)
# print the JSON string representation of the object
print(AnswerUpdate.to_json())

# convert the object into a dict
answer_update_dict = answer_update_instance.to_dict()
# create an instance of AnswerUpdate from a dict
answer_update_from_dict = AnswerUpdate.from_dict(answer_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


