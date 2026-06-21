# AlertIn

输入告警 (简化: 只要 status + labels).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **str** | firing / resolved | [optional] [default to 'firing']
**labels** | **Dict[str, object]** | 告警 labels | [optional] 
**annotations** | **Dict[str, object]** | 可选 annotations | [optional] 

## Example

```python
from zhs_api.models.alert_in import AlertIn

# TODO update the JSON string below
json = "{}"
# create an instance of AlertIn from a JSON string
alert_in_instance = AlertIn.from_json(json)
# print the JSON string representation of the object
print(AlertIn.to_json())

# convert the object into a dict
alert_in_dict = alert_in_instance.to_dict()
# create an instance of AlertIn from a dict
alert_in_from_dict = AlertIn.from_dict(alert_in_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


