Branch: simba/create-reusable-telemetry-schema-for-future-repo
Title: Create reusable telemetry schema for future repos.

## Summary
- Repo orchestration task for via-decide/alchemist_app
- Goal: Create reusable telemetry schema for future repos.

## Testing Checklist
- [ ] Run unit/integration tests
- [ ] Validate command flow
- [ ] Validate generated artifact files

## Risks
- Prompt quality depends on repository metadata completeness.
- GitHub API limits/token scope can block deep inspection.

## Rollback
- Revert branch and remove generated artifact files if workflow output is invalid.