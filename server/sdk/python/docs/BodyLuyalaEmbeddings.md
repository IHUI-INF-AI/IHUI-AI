# BodyLuyalaEmbeddings


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**input_text** | **str** |  | 
**model** | **str** |  | [optional] [default to 'luyala-embed']

## Example

```python
from zhs_api.models.body_luyala_embeddings import BodyLuyalaEmbeddings

# TODO update the JSON string below
json = "{}"
# create an instance of BodyLuyalaEmbeddings from a JSON string
body_luyala_embeddings_instance = BodyLuyalaEmbeddings.from_json(json)
# print the JSON string representation of the object
print(BodyLuyalaEmbeddings.to_json())

# convert the object into a dict
body_luyala_embeddings_dict = body_luyala_embeddings_instance.to_dict()
# create an instance of BodyLuyalaEmbeddings from a dict
body_luyala_embeddings_from_dict = BodyLuyalaEmbeddings.from_dict(body_luyala_embeddings_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


