# DeleteVarReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ConnectorId** | **string** |  | 
**VariableId** | **string** |  | 

## Methods

### NewDeleteVarReq

`func NewDeleteVarReq(connectorId string, variableId string, ) *DeleteVarReq`

NewDeleteVarReq instantiates a new DeleteVarReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewDeleteVarReqWithDefaults

`func NewDeleteVarReqWithDefaults() *DeleteVarReq`

NewDeleteVarReqWithDefaults instantiates a new DeleteVarReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetConnectorId

`func (o *DeleteVarReq) GetConnectorId() string`

GetConnectorId returns the ConnectorId field if non-nil, zero value otherwise.

### GetConnectorIdOk

`func (o *DeleteVarReq) GetConnectorIdOk() (*string, bool)`

GetConnectorIdOk returns a tuple with the ConnectorId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConnectorId

`func (o *DeleteVarReq) SetConnectorId(v string)`

SetConnectorId sets ConnectorId field to given value.


### GetVariableId

`func (o *DeleteVarReq) GetVariableId() string`

GetVariableId returns the VariableId field if non-nil, zero value otherwise.

### GetVariableIdOk

`func (o *DeleteVarReq) GetVariableIdOk() (*string, bool)`

GetVariableIdOk returns a tuple with the VariableId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVariableId

`func (o *DeleteVarReq) SetVariableId(v string)`

SetVariableId sets VariableId field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


