# AI provider strategy

## Default: no model

The application works without credentials or a local model. A deterministic technical summary is always available and is labeled as computed analysis, not AI. No automatic provider/model routing or paid fallback exists.

## Optional OpenRouter

OpenRouter documents `:free` model variants separately; free availability may differ by model and is subject to lower limits and variable availability. A free ID is not a permanent availability guarantee. The API requires an application-owned key. Source: [Free variant](https://openrouter.ai/docs/guides/routing/model-variants/free), [limits](https://openrouter.ai/docs/api_reference/limits), [models API](https://openrouter.ai/docs/api/api-reference/models/get-models).

Only an explicit model setting ending in `:free` may be used. Fixed endpoint `https://openrouter.ai/api/v1/chat/completions`, finite timeout, bounded request/output and validated structured response. Never read/copy Hermes keys. If key/model absent or request fails, present deterministic report and disclose provider unavailability. Never remove `:free` or auto-route to paid variants.

## Local inference

Disabled: Ollama was present but did not connect to a running instance; models were not verified. No installation or downloads performed. Revisit only after user authorizes local runtime/model setup and resource impact is evaluated.

## Output boundary

Model output is untrusted plain text and is never rendered as HTML. Validate structured fields (asset, source timestamp, observations, calculated metrics, scenarios, risk factors, evidence, limitations) before displaying. The UI identifies observations/calculations separately from model interpretation. Do not provide trade instructions or guaranteed predictions.
