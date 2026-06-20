# Parrot — LLM Model & Prompting Strategy (Research)

**Ticket:** [RESEARCH, 5] Choose optimal LLM model and prompting strategy for Parrot.
**Deliverable:** a justified choice of model + prompting strategy, backed by comparison criteria and findings. *(No implementation required — this is a decision record.)*

---

## 1. What Parrot actually does (requirements, from the code)

Parrot is the island's chat assistant ([`services/parrot`](../)). The decisive facts that drive model choice come from the real implementation, not generic chatbot assumptions:

| Trait | Evidence in code | Consequence for model choice |
|---|---|---|
| **Tool-calling is the core loop** | `chat()` / `chat_stream()` run a function-calling loop, `MAX_TOOL_ROUNDS = 5`, `tools=...` passed every call ([`llm.py`](../llm.py)) | The model must emit **correct, well-formed tool calls with valid args**, sometimes **several rounds** deep. This is the #1 requirement. |
| **6 tools, some guest-scoped** | `TOOL_SCHEMAS` + `GUEST_TOOL_SCHEMAS` ([`tools.py`](../tools.py)) | Needs reliable **tool selection** (pick the right one) and parallel/serial call handling. |
| **Strict, faithfulness-critical system prompt** | "always call a tool first", "never fabricate a value", refuse-to-guess, privacy/placeholder rules ([`llm.py` `SYSTEM_PROMPT_BASE`](../llm.py)) | Needs strong **instruction-following**. A model that ignores "don't fabricate" directly fails grading tickets (e.g. time-to-event accuracy). |
| **PII pseudonymization** | guest profile injected as placeholders; model must echo `[GUEST_NAME]` verbatim ([`pii.py`](../pii.py)) | Needs literal-token fidelity; weak models corrupt/paraphrase placeholders. |
| **Streaming (SSE) + non-streaming** | `chat_stream` token loop, `stream=True` | Needs **low time-to-first-token** and steady throughput. |
| **Short outputs** | `max_tokens = 600`, "chat bubble, not a brochure" | Output cost is small; **input + tool-result tokens dominate** cost. |
| **High request volume** | frontend traffic generator + automated grader at the 20:30 / 08:30 perf checkpoints (resilience/elasticity under load) | **p95 latency and per-request cost** matter as much as quality; the model/provider must be **stable** (no rate-limited free tiers). |
| **Provider is untrusted** | runs via OpenRouter to a third-party LLM | PII must never leave as plaintext (already handled); model is a **swappable** dependency (`LLM_MODEL` env). |

**Current configuration:** OpenRouter, `meta-llama/llama-3.1-8b-instruct`, `temperature 0.4`, `max_tokens 600`, `top_p 1.0`.

**Net:** Parrot is a **latency-sensitive, high-volume, tool-calling agent with a faithfulness-critical prompt and short outputs**. It does *not* need a frontier reasoning model, long context, or multimodality. It *does* need rock-solid function-calling + instruction-following at the lowest viable latency and cost.

---

## 2. Evaluation criteria (weighted)

Weights reflect what moves the hackathon score (ticket correctness 50% + system performance 20%):

| Criterion | Weight | Why |
|---|---:|---|
| **Tool/function-calling reliability** (valid args, right tool, multi-round) | 30% | The entire architecture depends on it; a bad call = wrong/empty answer. |
| **Instruction-following & faithfulness** (no fabrication, refuse-to-guess, verbatim placeholders) | 25% | Directly gates ticket correctness (time-to-event accuracy, PII, "never make up data"). |
| **Latency (p50 / p95, time-to-first-token)** | 20% | Live chat UX + the performance checkpoint scores resilience under load. |
| **Cost per request** | 15% | High volume; pay-per-token; input + tool results dominate. |
| **Stability / availability on OpenRouter** | 7% | Must not depend on rate-limited free endpoints during a timed checkpoint. |
| **Context window** | 3% | System prompt + resort context + history + tool JSON fit comfortably in ~16–32k; not a differentiator. |

---

## 3. Candidate models & findings

All reachable through the existing OpenRouter integration (no infra change). Scores are the qualitative standing from public benchmarks/pricing (June 2026); the matrix is **relative**, not absolute.

| Model | Tool-calling | Instr.-following | Latency | Cost (in/out per 1M) | Stability | Notes |
|---|---|---|---|---|---|---|
| `meta-llama/llama-3.1-8b-instruct` *(current)* | ◐ moderate | ◐ moderate | ● fast | ● ~cheapest | ● | MMLU ~68.4; weakest at strict multi-tool following & "don't fabricate" — the smaller variant is the risk. |
| **`openai/gpt-4o-mini`** | ● strong | ● strong | ● fast | $0.15 / $0.60 | ● | Best balance: reliable agentic tool-use + faithful instruction-following at low cost/latency. |
| `google/gemini-2.0-flash` | ● strong | ● strong | ●● fastest | ◐ very cheap | ● | Built-in function calling; lowest latency/cost of the strong tier. (Gemini **2.5** Flash got pricier: $0.30/$2.50.) |
| `meta-llama/llama-3.3-70b-instruct` | ● strong | ● strong | ◐ slower | ◐ $0.32–$1+ (free tier rate-limited) | ◐ | Quality jump over 8B, but heavier and the free endpoint is **not safe for a timed checkpoint**. |
| `qwen2.5-72b-instruct` | ● strong (notably good for cost) | ● strong | ◐ slower | ◐ mid | ◐ | Excellent tool-use/value; latency higher than the Flash/mini tier. |
| `anthropic/claude-haiku-4.5` | ● strong | ●● strongest | ● fast | ◐ premium-of-the-cheap-tier | ● | Best faithfulness, but highest cost here; overkill for short tool-grounded replies. |

**Key findings (sourced below):**
- **Capability gap at 8B is real:** Gemini-Flash-class models score MMLU ~80.9 vs Llama-3.1-8B ~68.4. For Parrot the gap shows up as **flakier multi-round tool calls and weaker adherence to "never fabricate / always ground"** — exactly the behaviors the grader probes.
- **GPT-4o-mini** is repeatedly cited as a strong, cheap pick for **agentic/reasoning** workloads, with mature, well-behaved OpenAI-style function calling — the same API shape Parrot already uses.
- **Gemini 2.0 Flash** offers built-in function calling at the **lowest latency/cost** of the capable tier; older Gemini was weak at tool use but the Flash 2.x line improved markedly. Watch the price step-up on **2.5** Flash.
- **Bigger ≠ better here:** Llama-3.3-70B / Qwen-72B raise quality but add latency and (for Llama's free tier) **availability risk during the checkpoint window** — a poor trade for short, tool-grounded replies.
- Benchmarks under-measure **tool latency, context-truncation behavior, and provider quirks** — so the choice should be confirmed with a small task-specific eval (§6), not taken from leaderboards alone.

---

## 4. Decision — Model

**Primary recommendation: `openai/gpt-4o-mini`** (via the existing OpenRouter base URL).

It wins the weighted scoring: top-tier **function-calling reliability** and **instruction-following/faithfulness** (the two highest weights, 55% combined), while staying **fast and cheap** ($0.15/$0.60) and **stable** on OpenRouter. It uses the exact OpenAI-style tool-call API Parrot is already built around, so it's a **zero-code swap** (`LLM_MODEL` env).

**Cost/latency-optimized alternative: `google/gemini-2.0-flash`** — if checkpoint latency/throughput or token budget is the binding constraint, Flash gives ~the same tool-calling/instruction quality at the **lowest latency and cost**. Recommended as the **A/B challenger** and the **failover** model.

**Move off the default `llama-3.1-8b-instruct`:** keep it only as a **cheap fallback**. At 8B its weaker faithfulness/tool-following is a direct risk to the "never fabricate", time-to-event-accuracy, and PII-placeholder behaviors the grader checks.

**Operational guidance:**
- Keep the model **swappable** via `LLM_MODEL` (already the design) and configure a **fallback** model so a provider blip during a checkpoint degrades gracefully rather than failing.
- Prefer `gpt-4o-mini` primary, `gemini-2.0-flash` failover, `llama-3.1-8b` last-resort.

---

## 5. Decision — Prompting strategy

The strategy must maximize **faithful, tool-grounded** answers and **minimize latency**, for a small/cheap model. Recommended approach (mostly already in place — this validates and tightens it):

1. **Native function-calling / ReAct loop — keep it.** Let the model request tools via the tools API and answer from results; never parse free-text "actions". This is what makes answers grounded and is the single biggest correctness lever. *(Already implemented.)*
2. **Structured, sectioned system prompt** with explicit rules: role → **ground-before-answer** ("call a tool first; never fabricate") → privacy/placeholder rules → time-to-event rules → terse style. Clear, rule-style instructions outperform prose for small models. *(Already implemented; keep tight.)*
3. **Low temperature (0.2–0.4).** Faithful, repeatable tool grounding beats creativity here. Keep `top_p 1.0`, `max_tokens ~600`. *(Matches current 0.4.)*
4. **Bias toward tool use on data questions.** Keep `tool_choice="auto"` but reinforce "always check the live system first"; for clearly data-bound questions, forcing a tool on the first turn (`tool_choice="required"`) removes the "answer from memory" failure mode. *(Cheap, high-value addition.)*
5. **A few targeted few-shot exemplars** for the failure-prone behaviors: refuse-to-guess (time-to-event when data is null), verbatim placeholder usage, and multi-tool "what's my status". 2–4 short examples meaningfully lift small-model adherence. *(Recommended addition.)*
6. **No verbose chain-of-thought in the output.** It adds latency and can leak reasoning/PII; rely on tool grounding instead of "think step by step" prose.
7. **Bound the loop & outputs** (`MAX_TOOL_ROUNDS=5`, short `max_tokens`) to cap latency/cost tail. *(Already implemented.)*
8. **Assume an untrusted provider:** keep PII pseudonymization regardless of model. *(Already implemented.)*

**Summary:** *native tool-calling (ReAct) + a tight rule-based system prompt + low temperature + tool-use bias + a handful of few-shot exemplars*, output kept short and CoT-free.

---

## 6. How to validate the choice (recommended, optional)

Leaderboards don't capture Parrot's tool latency or provider quirks, so confirm with a **small task eval** before/at deploy:
- Build ~20–30 representative prompts: airport/hotel/beach "how long until…", "what's my status", definitional ("what is a reservation?"), a fabrication trap (ask for data no tool provides), a PII/placeholder case, a profanity case.
- For each candidate model, measure: **tool-call correctness** (right tool, valid args), **fabrication rate**, **refuse-to-guess correctness**, **p50/p95 latency + time-to-first-token**, and **cost/req**.
- A/B `llama-3.1-8b` (baseline) vs `gpt-4o-mini` vs `gemini-2.0-flash`; pick on the weighted criteria in §2.

---

## 7. Decision record (one line)

> **Use `openai/gpt-4o-mini` as Parrot's model** (with `gemini-2.0-flash` as the cheap/low-latency failover and `llama-3.1-8b` as last-resort fallback), driven by a **native tool-calling (ReAct) loop, a tight rule-based system prompt, low temperature, a tool-use bias, and a few few-shot exemplars** — chosen for top function-calling reliability and faithfulness at low latency/cost, which is what Parrot's grading and performance checkpoints reward.

---

## Sources
- [OpenRouter Pricing 2026 — complete guide](https://betonai.net/openrouter-pricing-2026-complete-guide-to-every-model-tier-and-hidden-cost/)
- [OpenRouter — lowest-cost LLM inference guide](https://openrouter.ai/blog/tutorials/how-to-get-the-lowest-cost-llm-inference-on-openrouter/)
- [LLM API pricing comparison (300+ models)](https://pricepertoken.com/)
- [Berkeley Function-Calling Leaderboard (BFCL) V4](https://gorilla.cs.berkeley.edu/leaderboard.html)
- [BFCL: From Tool Use to Agentic Evaluation (paper)](https://proceedings.mlr.press/v267/patil25a.html)
- [Claude Haiku 4.5 vs GPT-4o-mini vs Gemini Flash — pricing & limits](https://skywork.ai/blog/claude-haiku-4-5-vs-gpt4o-mini-vs-gemini-flash-vs-mistral-small-vs-llama-comparison/)
- [Gemini 2.0 Flash vs GPT-4o-mini — benchmarks](https://www.neura.market/directories/chatgpt/blog/gemini-2-0-flash-vs-gpt-4o-mini-comprehensive-performance-breakdown-and-real-world-benchmarks)
- [Comparative study: fine-tuning GPT-4o-mini, Gemini Flash, Llama-3.1-8B](https://www.patched.codes/blog/a-comparative-study-of-fine-tuning-gpt-4o-mini-gemini-flash-1-5-and-llama-3-1-8b)
- [Meta Llama 3.1 8B Instruct — model card](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct)
