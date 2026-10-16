# Project-local Hermes skills

The repository contains 12 Hermes-native `SKILL.md` files under `skills/<skill-name>/SKILL.md`. Each has YAML frontmatter (`name`, `description`, `version`, `license`, `platforms`, `metadata.hermes.tags`) and a focused workflow with required inputs/tools, expected output, verification, failure handling and safety constraints.

| Skill | File |
|---|---|
| PRD generation | [`crypto-prd-generator`](../skills/crypto-prd-generator/SKILL.md) |
| UI/UX audit | [`crypto-ui-ux-auditor`](../skills/crypto-ui-ux-auditor/SKILL.md) |
| Market data integration | [`market-data-integration`](../skills/market-data-integration/SKILL.md) |
| Indicator validation | [`technical-indicator-validation`](../skills/technical-indicator-validation/SKILL.md) |
| AI analysis evaluation | [`ai-analysis-evaluation`](../skills/ai-analysis-evaluation/SKILL.md) |
| Security audit | [`security-audit`](../skills/security-audit/SKILL.md) |
| Root-cause debugging | [`debug-root-cause`](../skills/debug-root-cause/SKILL.md) |
| Playwright E2E | [`playwright-e2e`](../skills/playwright-e2e/SKILL.md) |
| Dead-code refactoring | [`dead-code-refactoring`](../skills/dead-code-refactoring/SKILL.md) |
| Conventional Git | [`conventional-git-commits`](../skills/conventional-git-commits/SKILL.md) |
| Market-data quality | [`crypto-data-quality-check`](../skills/crypto-data-quality-check/SKILL.md) |
| Cost guardrails | [`provider-cost-guard`](../skills/provider-cost-guard/SKILL.md) |

## Discovery and safety

Files are repository-local and are not installed into or trusted by any Hermes profile. This task did not edit global skills, tap configuration, project trust, or Hermes settings. Hermes discovers skill directories from its configured skills/tap paths; to use these skills, follow the current official [Hermes skills documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills) and explicitly register/trust this repository only if desired. Native format guidance: [Creating Skills](https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills).

