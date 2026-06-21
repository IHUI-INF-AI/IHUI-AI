# SimpleEditBody

Simple image editing (background removal, etc.).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**images** | **str** | Image URL | 
**prompt** | **str** | Editing instruction / operation | 
**model** | **str** | Model name | [optional] [default to 'qwen-image-edit']
**negative_prompt** | **str** | Negative prompt | [optional] [default to '']
**prompt_extend** | **bool** | Whether to extend the prompt | [optional] [default to True]
**watermark** | **bool** | Whether to add watermark | [optional] [default to False]
**sync** | **bool** | If true, wait for completion and return image URL | [optional] [default to False]

## Example

```python
from zhs_api.models.simple_edit_body import SimpleEditBody

# TODO update the JSON string below
json = "{}"
# create an instance of SimpleEditBody from a JSON string
simple_edit_body_instance = SimpleEditBody.from_json(json)
# print the JSON string representation of the object
print(SimpleEditBody.to_json())

# convert the object into a dict
simple_edit_body_dict = simple_edit_body_instance.to_dict()
# create an instance of SimpleEditBody from a dict
simple_edit_body_from_dict = SimpleEditBody.from_dict(simple_edit_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


