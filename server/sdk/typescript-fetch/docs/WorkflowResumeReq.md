
# WorkflowResumeReq


## Properties

Name | Type
------------ | -------------
`workflowId` | string
`eventId` | string
`resumeData` | string
`interruptType` | string

## Example

```typescript
import type { WorkflowResumeReq } from ''

// TODO: Update the object below with actual values
const example = {
  "workflowId": null,
  "eventId": null,
  "resumeData": null,
  "interruptType": null,
} satisfies WorkflowResumeReq

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as WorkflowResumeReq
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


