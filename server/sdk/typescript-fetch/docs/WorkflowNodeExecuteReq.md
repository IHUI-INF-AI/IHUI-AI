
# WorkflowNodeExecuteReq


## Properties

Name | Type
------------ | -------------
`workflowId` | string
`executeId` | string
`nodeExecuteUuid` | string

## Example

```typescript
import type { WorkflowNodeExecuteReq } from ''

// TODO: Update the object below with actual values
const example = {
  "workflowId": null,
  "executeId": null,
  "nodeExecuteUuid": null,
} satisfies WorkflowNodeExecuteReq

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as WorkflowNodeExecuteReq
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


