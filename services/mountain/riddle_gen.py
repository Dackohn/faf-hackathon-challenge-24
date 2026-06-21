import json
import logging
from openai import AsyncOpenAI
from config import settings

logger = logging.getLogger(__name__)

PROMPT = """\
Generate exactly 5 university-level mathematics questions for a multiple-choice challenge.
Cover a variety of topics such as: calculus (derivatives, integrals, limits), linear algebra
(determinants, eigenvalues, matrix operations), probability & statistics, discrete mathematics
(combinatorics, graph theory), and real analysis or differential equations.

Return a JSON array of exactly 5 objects. Each object must have:
  "text"    – the question, written clearly and precisely (include any necessary formula or expression)
  "paths"   – array of exactly 3 answer options; each is a short mathematical expression or value
  "correct" – integer 0, 1, or 2 (index of the correct answer)
  "hint"    – one sentence that points toward the right method or concept without giving the answer

Rules:
- Each question must have one unambiguously correct answer.
- Wrong answers must be plausible (e.g. common mistakes, close values, sign errors).
- Spread the correct index: no index may appear more than twice across the 5 questions.
- Use LaTeX-style notation where helpful (e.g. x^2, sqrt(x), pi, e, ln(x), sum, integral).
- Output ONLY the JSON array, no markdown fences, no extra text.
"""


async def generate_riddles() -> list[dict] | None:
    if not settings.llm_api_key:
        logger.info("No LLM API key — using static riddles")
        return None
    client = AsyncOpenAI(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        max_retries=0,
        timeout=10.0,
    )
    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[{"role": "user", "content": PROMPT}],
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
        content = (response.choices[0].message.content or "").strip()
        start = content.find("[")
        end = content.rfind("]") + 1
        if start == -1 or end == 0:
            logger.warning("Riddle gen: no JSON array in response")
            return None
        riddles = json.loads(content[start:end])
        if not isinstance(riddles, list) or len(riddles) != 5:
            logger.warning("Riddle gen: got %s riddles, expected 5", len(riddles) if isinstance(riddles, list) else "?")
            return None
        for r in riddles:
            if not all(k in r for k in ("text", "paths", "correct", "hint")):
                logger.warning("Riddle gen: malformed riddle object")
                return None
            if not isinstance(r["paths"], list) or len(r["paths"]) != 3:
                return None
            if r["correct"] not in (0, 1, 2):
                return None
        logger.info("Riddle gen: generated %d riddles successfully", len(riddles))
        return riddles
    except Exception:
        logger.exception("Riddle generation failed")
        return None
    finally:
        await client.close()
