# QuestionCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **str** |  | 
**content** | **str** |  | 
**image** | **str** |  | [optional] 
**cid_list** | **List[int]** |  | [optional] 

## Example

```python
from zhs_api.models.question_create import QuestionCreate

# TODO update the JSON string below
json = "{}"
# create an instance of QuestionCreate from a JSON string
question_create_instance = QuestionCreate.from_json(json)
# print the JSON string representation of the object
print(QuestionCreate.to_json())

# convert the object into a dict
question_create_dict = question_create_instance.to_dict()
# create an instance of QuestionCreate from a dict
question_create_from_dict = QuestionCreate.from_dict(question_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


