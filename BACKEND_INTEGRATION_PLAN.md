# Backend Integration Plan

Target boundary: UI pages must depend only on `DaxiniSDK` or `ZayvoraSDK`; SDK methods must depend on one shared API client; the client must issue Gateway HTTP requests; Gateway handlers must delegate to runtime services. Default page guidance is **No UI changes required**; only rows explicitly labeled `EXTEND` may add UI work.

| Page / capability | SDK method | API client / Gateway endpoint | Runtime service | Integration note |
| --- | --- | --- | --- | --- |
| Runtime Status page | `sdk.runtime.getStatus()` | `GET /runtime/status` | Runtime health service | No UI changes required. |
| Workspaces page | `sdk.workspaces.list(params)` | `GET /workspaces` | Workspace catalog service | No UI changes required. |
| Workspace Detail page | `sdk.workspaces.get(id)` | `GET /workspaces/:id` | Workspace catalog service | No UI changes required. |
| Workspace Execution action | `sdk.executions.create(workspaceId, payload)` | `POST /workspaces/:id/executions` | Execution runtime service | `EXTEND` only if the page lacks an execution launch action; otherwise No UI changes required. |
| Execution Detail page | `sdk.executions.get(id)` | `GET /executions/:id` | Execution runtime service | No UI changes required. |
| Reasoning Session creation | `sdk.reasoning.createSession(payload)` | `POST /reasoning/sessions` | Reasoning session service | `EXTEND` only if the page lacks a session creation action; otherwise No UI changes required. |
| Reasoning Session page | `sdk.reasoning.getSession(id)` | `GET /reasoning/sessions/:id` | Reasoning session service | No UI changes required. |
| Models page | `sdk.models.list()` | `GET /models` | Model registry service | No UI changes required. |
| Deployments page | `sdk.deployments.list()` | `GET /deployments` | Deployment registry service | No UI changes required. |
| Billing Entitlements page | `sdk.billing.getEntitlements()` | `GET /billing/entitlements` | Billing entitlement service | No UI changes required. |
