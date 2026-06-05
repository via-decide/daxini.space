Branch: simba/refactor-reading-progress-engine-to-be-fully-sta
Title: Refactor Reading Progress Engine to be fully stateless, remove intern...

## Summary
- Repo orchestration task for via-decide/alchemist_app
- Goal: Refactor Reading Progress Engine to be fully stateless, remove internal book binding, and optimize tracker usage.

## Testing Checklist
- [ ] Run unit/integration tests
- [ ] Validate command flow
- [ ] Validate generated artifact files

## Risks
- Prompt quality depends on repository metadata completeness.
- GitHub API limits/token scope can block deep inspection.

## Rollback
- Revert branch and remove generated artifact files if workflow output is invalid.