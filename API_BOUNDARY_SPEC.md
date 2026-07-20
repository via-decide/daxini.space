# API Boundary Spec

Future frontend boundary: UI components call `DaxiniSDK` or `ZayvoraSDK`; each SDK calls the shared API client; the shared API client calls Gateway endpoints; the Gateway delegates to runtime services. UI page policy: Runtime Status, Workspace List, Workspace Detail, Execution Detail, Reasoning Session, Models, Deployments, and Billing Entitlements pages require **No UI changes required** unless their backend integration is explicitly marked `EXTEND`.

| Endpoint | Contract | Gateway delegation | UI impact |
| --- | --- | --- | --- |
| `GET /runtime/status` | Returns `{ status, version, services[], checkedAt }`; `services[]` includes `{ name, status, latencyMs? }`. | Runtime health service. | No UI changes required. |
| `GET /workspaces` | Returns `{ items, nextCursor? }`; supports `cursor`, `limit`, `ownerId?`; each item has `{ id, name, status, updatedAt }`. | Workspace catalog service. | No UI changes required. |
| `GET /workspaces/:id` | Returns `{ id, name, status, config, metadata, createdAt, updatedAt }`; `404` when missing. | Workspace catalog service. | No UI changes required. |
| `POST /workspaces/:id/executions` | Body `{ input, mode?, modelId?, metadata? }`; returns `202 { id, workspaceId, status, submittedAt }`. | Execution runtime service. | No UI changes required unless marked `EXTEND` for new launch controls. |
| `GET /executions/:id` | Returns `{ id, workspaceId, status, input?, output?, error?, startedAt?, completedAt? }`. | Execution runtime service. | No UI changes required. |
| `POST /reasoning/sessions` | Body `{ workspaceId?, modelId?, context?, metadata? }`; returns `201 { id, status, createdAt }`. | Reasoning session service. | No UI changes required unless marked `EXTEND` for session creation UX. |
| `GET /reasoning/sessions/:id` | Returns `{ id, status, workspaceId?, messages[], artifacts[], updatedAt }`. | Reasoning session service. | No UI changes required. |
| `GET /models` | Returns `{ items }`; each model has `{ id, provider, displayName, capabilities[], defaultParameters? }`. | Model registry service. | No UI changes required. |
| `GET /deployments` | Returns `{ items }`; each deployment has `{ id, environment, status, version, updatedAt }`. | Deployment registry service. | No UI changes required. |
| `GET /billing/entitlements` | Returns `{ plan, limits, usage, features[], refreshedAt }`. | Billing entitlement service. | No UI changes required. |
