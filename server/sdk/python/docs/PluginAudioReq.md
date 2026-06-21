# PluginAudioReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**bot_id** | **str** |  | 
**conversation_id** | **str** |  | [optional] 
**plugin_id** | **str** |  | 
**audio_data** | **str** |  | 

## Example

```python
from zhs_api.models.plugin_audio_req import PluginAudioReq

# TODO update the JSON string below
json = "{}"
# create an instance of PluginAudioReq from a JSON string
plugin_audio_req_instance = PluginAudioReq.from_json(json)
# print the JSON string representation of the object
print(PluginAudioReq.to_json())

# convert the object into a dict
plugin_audio_req_dict = plugin_audio_req_instance.to_dict()
# create an instance of PluginAudioReq from a dict
plugin_audio_req_from_dict = PluginAudioReq.from_dict(plugin_audio_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


