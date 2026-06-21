# MyTeamQuery


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**search** | **str** |  | [optional] 
**begin** | **str** |  | [optional] 
**end** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.my_team_query import MyTeamQuery

# TODO update the JSON string below
json = "{}"
# create an instance of MyTeamQuery from a JSON string
my_team_query_instance = MyTeamQuery.from_json(json)
# print the JSON string representation of the object
print(MyTeamQuery.to_json())

# convert the object into a dict
my_team_query_dict = my_team_query_instance.to_dict()
# create an instance of MyTeamQuery from a dict
my_team_query_from_dict = MyTeamQuery.from_dict(my_team_query_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


