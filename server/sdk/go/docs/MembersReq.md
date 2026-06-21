# MembersReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**WorkspaceId** | **string** |  | 
**Members** | **[]map[string]interface{}** |  | 

## Methods

### NewMembersReq

`func NewMembersReq(workspaceId string, members []map[string]interface{}, ) *MembersReq`

NewMembersReq instantiates a new MembersReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewMembersReqWithDefaults

`func NewMembersReqWithDefaults() *MembersReq`

NewMembersReqWithDefaults instantiates a new MembersReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetWorkspaceId

`func (o *MembersReq) GetWorkspaceId() string`

GetWorkspaceId returns the WorkspaceId field if non-nil, zero value otherwise.

### GetWorkspaceIdOk

`func (o *MembersReq) GetWorkspaceIdOk() (*string, bool)`

GetWorkspaceIdOk returns a tuple with the WorkspaceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWorkspaceId

`func (o *MembersReq) SetWorkspaceId(v string)`

SetWorkspaceId sets WorkspaceId field to given value.


### GetMembers

`func (o *MembersReq) GetMembers() []map[string]interface{}`

GetMembers returns the Members field if non-nil, zero value otherwise.

### GetMembersOk

`func (o *MembersReq) GetMembersOk() (*[]map[string]interface{}, bool)`

GetMembersOk returns a tuple with the Members field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMembers

`func (o *MembersReq) SetMembers(v []map[string]interface{})`

SetMembers sets Members field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


