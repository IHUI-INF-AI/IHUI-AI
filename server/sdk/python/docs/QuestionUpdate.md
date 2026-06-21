# QuestionUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **int** |  | 
**title** | **str** |  | [optional] 
**content** | **str** |  | [optional] 
**image** | **str** |  | [optional] 
**status** | **str** |  | [optional] 
**cid_list** | **List[int]** |  | [optional] 

## Example

```python
from zhs_api.models.question_update import QuestionUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of QuestionUpdate from a JSON string
question_update_instance = QuestionUpdate.from_json(json)
# print the JSON string representation of the object
print(QuestionUpdate.to_json())

# convert the object into a dict
question_update_dict = question_update_instance.to_dict()
# create an instance of QuestionUpdate from a dict
question_update_from_dict = QuestionUpdate.from_dict(question_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


