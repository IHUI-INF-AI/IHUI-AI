# AnswerCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**question_id** | **int** |  | 
**content** | **str** |  | 

## Example

```python
from zhs_api.models.answer_create import AnswerCreate

# TODO update the JSON string below
json = "{}"
# create an instance of AnswerCreate from a JSON string
answer_create_instance = AnswerCreate.from_json(json)
# print the JSON string representation of the object
print(AnswerCreate.to_json())

# convert the object into a dict
answer_create_dict = answer_create_instance.to_dict()
# create an instance of AnswerCreate from a dict
answer_create_from_dict = AnswerCreate.from_dict(answer_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


