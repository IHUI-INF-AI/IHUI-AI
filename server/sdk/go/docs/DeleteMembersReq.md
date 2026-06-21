# DeleteMembersReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**WorkspaceId** | **string** |  | 
**MemberIds** | **[]string** |  | 

## Methods

### NewDeleteMembersReq

`func NewDeleteMembersReq(workspaceId string, memberIds []string, ) *DeleteMembersReq`

NewDeleteMembersReq instantiates a new DeleteMembersReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewDeleteMembersReqWithDefaults

`func NewDeleteMembersReqWithDefaults() *DeleteMembersReq`

NewDeleteMembersReqWithDefaults instantiates a new DeleteMembersReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetWorkspaceId

`func (o *DeleteMembersReq) GetWorkspaceId() string`

GetWorkspaceId returns the WorkspaceId field if non-nil, zero value otherwise.

### GetWorkspaceIdOk

`func (o *DeleteMembersReq) GetWorkspaceIdOk() (*string, bool)`

GetWorkspaceIdOk returns a tuple with the WorkspaceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWorkspaceId

`func (o *DeleteMembersReq) SetWorkspaceId(v string)`

SetWorkspaceId sets WorkspaceId field to given value.


### GetMemberIds

`func (o *DeleteMembersReq) GetMemberIds() []string`

GetMemberIds returns the MemberIds field if non-nil, zero value otherwise.

### GetMemberIdsOk

`func (o *DeleteMembersReq) GetMemberIdsOk() (*[]string, bool)`

GetMemberIdsOk returns a tuple with the MemberIds field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMemberIds

`func (o *DeleteMembersReq) SetMemberIds(v []string)`

SetMemberIds sets MemberIds field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


