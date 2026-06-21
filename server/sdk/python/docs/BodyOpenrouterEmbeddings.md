# BodyOpenrouterEmbeddings


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**input_text** | **str** |  | 
**model** | **str** |  | [optional] [default to 'openai/text-embedding-3-small']

## Example

```python
from zhs_api.models.body_openrouter_embeddings import BodyOpenrouterEmbeddings

# TODO update the JSON string below
json = "{}"
# create an instance of BodyOpenrouterEmbeddings from a JSON string
body_openrouter_embeddings_instance = BodyOpenrouterEmbeddings.from_json(json)
# print the JSON string representation of the object
print(BodyOpenrouterEmbeddings.to_json())

# convert the object into a dict
body_openrouter_embeddings_dict = body_openrouter_embeddings_instance.to_dict()
# create an instance of BodyOpenrouterEmbeddings from a dict
body_openrouter_embeddings_from_dict = BodyOpenrouterEmbeddings.from_dict(body_openrouter_embeddings_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


