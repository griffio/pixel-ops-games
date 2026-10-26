# OpenRouter free models for the CPU commander

*26 October 2026. Gathered from OpenRouter's models API and documentation; none of the models has been tried with the game yet.*

The LLM commander runs on Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) and errors once the daily neuron allowance is spent. OpenRouter lists 20 free text models and a new class of "decision" models. A few of the free models suit the game, but OpenRouter's free tier allows 50 requests a day, about one match, so free alone does not fix running out of quota. The decision models fit the way the CPU already decides unusually well.

## The catch: free-tier limits

| Credits ever bought on OpenRouter | Requests per minute | Requests per day |
|---|---|---|
| Under $10 | 20 | 50 |
| $10 or more | 20 | 1,000 |

These limits apply to every `:free` model, decision models included.

- Each LLM-commanded CPU side consults the model every 10–60 s: about 25–75 requests in a 25-minute match, twice that when the CPU plays both sides.
- 50 a day is about one match. A one-off $10 top-up gives about 13–40 matches a day, and the credits stay usable on paid models.
- If fallback models are set up, list only `:free` ones: OpenRouter bills a fallback to a paid model even when the first model was free. `openrouter/free` on its own only ever falls back to other free models.

## Free text models worth trying

7 of the 20 free models. The rest are coding, music, content-safety or very small models.

| Model | Size | Forced-JSON support | Why |
|---|---|---|---|
| `nvidia/nemotron-3-super-120b-a12b:free` | 120B (12B active) | JSON schema | **First pick.** Built for multi-agent work, and it can be forced to follow the plan schema. |
| `nvidia/nemotron-3.5-super-vl:free` | 120B (12B active) | JSON schema | Same class; newer, and also accepts images. |
| `dots-studio/dots-3-note-preview:free` | 280B (16B active) | JSON schema | Strong, but a preview release. |
| `thinkingmachines/inkling:free` | 975B (41B active) | Tool calls only | Probably the best judgement, but slower; the schema would go in a tool definition. |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 550B (55B active) | Tool calls only | Reasoning model: likely the strongest plans and the slowest replies. |
| `google/gemma-4-31b-it:free` | 31B | JSON mode | Mid-size fallback. The earlier Gemma failed the plan JSON on Workers AI; JSON mode should help. |
| `openrouter/free` | Varies | JSON schema | Picks a random free model per call. A last-resort fallback; plans would jump between models. |

The ratings come from model size, structured-output support and the published descriptions, not from trying them with the game.

Not suitable: `poolside/laguna-*`, `cohere/north-mini-code` and `recursive/flint-v1.0` (coding), `google/lyria-3-*` (music), `nvidia/nemotron-3.5-content-safety` (a safety classifier), `liquid/lfm-2.5-2.6b` (too small), `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (a perception sub-agent). `nvidia/nemotron-3.5-lightning:free` (30B, 3B active) and `xingchen-agi/xing4.0-29b-a4b:free` (29B, 4B active, JSON schema) are fast smaller options if speed matters more than judgement.

## Decision models

The decision models (the `output_modalities=decisions` filter) are a strong fit. They do not write text. They take a **state**, here the commander's briefing JSON, and **typed questions**, and return a probability for every answer:

- `noul`: a yes/no probability;
- `choice`: one option from a list, with a probability for each;
- `score`: a point on an ordered scale.

That is the shape of the CPU's plan:

| Plan field | Question type |
|---|---|
| Place to attack (a capturable place, or none) | choice |
| Posture (aggressive, balanced, cautious) | choice |
| Logistics (FOB, sandbags, none) | choice |
| Helicopter lifts allowed | yes/no |
| Attack share | score |
| Wait condition | choice |

**Advantages**

- Fast and cheap, since there is no text to generate.
- No broken-JSON failures: the answers come back already typed.
- The probabilities could be blended with the utility commander's own scores rather than replacing them, or sampled from to vary the difficulty.

**Drawbacks**

- No radio chatter, reasons or notes. The game could still say things based on what was chosen.
- The API is still marked alpha: `POST https://openrouter.ai/api/alpha/decisions`.

**Free decision models:** `baseten/mammoth-1:free` (27B, 16k context), `baseten/elephant-1:free` (9B, 16k context), `inception/mercury-decide:free`. The 16k context is plenty: the briefing is about 2 KB.

**Paid, at about a cent per match** (input $0.01–0.15 per million tokens, output free): TypeSafe's `typesafe/jev-1.14` (set aside on 25 October because it was new), `perplexity/pplx-decider-v1.2` (27B) and `perplexity/pplx-decider-flash-v1.2` (4B), `nace-ai/drex-max`, `upstage/solar-decide`, `openai/gpt-6-luna-decisions`. Cloudflare's `cloudflare/clef`, `clef-flash` and `clef-omni` run on Workers AI, so the existing Worker may be able to call them, but they would use the same daily allowance that is running out now.

## Suggestion

1. Top up $10 on OpenRouter and add Nemotron 3 Super as a commander option next to Llama, with a free-only fallback.
2. Separately, try Mammoth 1 as an adviser to the utility commander: the briefing as the state, the plan fields as questions, its probabilities blended with the utility scores.

To test either, an OpenRouter API key goes in `.env` as `OPENROUTER_API_KEY` and is stored as a Worker secret, never in the game's code. The comparison would follow the earlier Workers AI one, in which gpt-oss-120b had the best judgement.

## Sources

- Models API: `https://openrouter.ai/api/v1/models` (free text models), `https://openrouter.ai/api/v1/models?output_modalities=decisions` (decision models)
- Limits: `https://openrouter.ai/docs/api_reference/limits.md`
- Free variant: `https://openrouter.ai/docs/guides/routing/model-variants/free.md`
- Decisions API: `https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request.md`
