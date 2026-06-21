# BodyLuyalaCompletion


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** |  | 
**model** | **str** |  | [optional] [default to 'luyala-pro']
**max_tokens** | **int** |  | [optional] [default to 1024]

## Example

```python
from zhs_api.models.body_luyala_completion import BodyLuyalaCompletion

# TODO update the JSON string below
json = "{}"
# create an instance of BodyLuyalaCompletion from a JSON string
body_luyala_completion_instance = BodyLuyalaCompletion.from_json(json)
# print the JSON string representation of the object
print(BodyLuyalaCompletion.to_json())

# convert the object into a dict
body_luyala_completion_dict = body_luyala_completion_instance.to_dict()
# create an instance of BodyLuyalaCompletion from a dict
body_luyala_completion_from_dict = BodyLuyalaCompletion.from_dict(body_luyala_completion_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


