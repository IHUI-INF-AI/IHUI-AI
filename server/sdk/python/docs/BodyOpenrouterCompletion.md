# BodyOpenrouterCompletion


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** |  | 
**model** | **str** |  | [optional] [default to 'openai/gpt-3.5-turbo-instruct']
**max_tokens** | **int** |  | [optional] [default to 1024]

## Example

```python
from zhs_api.models.body_openrouter_completion import BodyOpenrouterCompletion

# TODO update the JSON string below
json = "{}"
# create an instance of BodyOpenrouterCompletion from a JSON string
body_openrouter_completion_instance = BodyOpenrouterCompletion.from_json(json)
# print the JSON string representation of the object
print(BodyOpenrouterCompletion.to_json())

# convert the object into a dict
body_openrouter_completion_dict = body_openrouter_completion_instance.to_dict()
# create an instance of BodyOpenrouterCompletion from a dict
body_openrouter_completion_from_dict = BodyOpenrouterCompletion.from_dict(body_openrouter_completion_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


