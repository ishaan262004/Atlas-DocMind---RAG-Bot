from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
from services.llm import get_llm
import json
import logging
import re

logger = logging.getLogger(__name__)

MEMORY_EXTRACTION_PROMPT = PromptTemplate(
    input_variables=["conversation"],
    template="""You are a memory extraction system. Analyze the conversation and extract durable, important facts ABOUT THE USER.

Extract ONLY facts that are:
- Personal preferences (favorite things, likes, dislikes)
- Professional information (job, skills, frameworks they use)
- Goals or intentions
- Personal details the user explicitly shares
- Strong opinions on specific topics

Do NOT extract: questions, transient context, or facts about the assistant.

For each fact, pick a category from EXACTLY this set:
- technical, professional, preference, goal, general

Conversation:
{conversation}

Return a JSON array of objects, each: {{"fact": "...", "category": "...", "confidence": 0.0-1.0}}
- fact: a clear, concise third-person statement (e.g. "User prefers Python over JavaScript")
- confidence: how certain you are this is a durable fact (0.5-1.0)
If no important facts are found, return an empty array [].

Only return the JSON array, nothing else.""",
)


def extract_memories_from_conversation(
    messages: list[dict],
    llm: OllamaLLM = None,
) -> list[dict]:
    """
    Extract important facts from recent conversation using LLM.

    Returns list of dicts with 'fact' and 'category' keys.
    """
    if not messages:
        return []

    # Build conversation text from recent messages
    recent = messages[-6:]  # Last 3 exchanges
    conversation_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in recent
    )

    llm = llm or get_llm()

    valid_categories = {"technical", "professional", "preference", "goal", "general"}

    try:
        chain = MEMORY_EXTRACTION_PROMPT | llm
        result = chain.invoke({"conversation": conversation_text})

        result_str = str(result).strip()

        # Find the JSON array in the response (greedy to capture objects).
        json_match = re.search(r'\[.*\]', result_str, re.DOTALL)
        if not json_match:
            return []

        facts_raw = json.loads(json_match.group())
        if not isinstance(facts_raw, list):
            return []

        extracted = []
        for item in facts_raw:
            # Support both the new object form and a bare string form.
            if isinstance(item, str):
                fact = item.strip()
                category = categorize_fact(fact)
                confidence = 0.8
            elif isinstance(item, dict) and item.get("fact"):
                fact = str(item["fact"]).strip()
                category = str(item.get("category", "")).lower().strip()
                if category not in valid_categories:
                    category = categorize_fact(fact)
                try:
                    confidence = float(item.get("confidence", 0.8))
                except (TypeError, ValueError):
                    confidence = 0.8
                confidence = max(0.0, min(1.0, confidence))
            else:
                continue

            if len(fact) > 5:
                extracted.append({
                    "fact": fact,
                    "category": category,
                    "confidence": confidence,
                })

        logger.info(f"Extracted {len(extracted)} memory facts")
        return extracted

    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse failed for memory extraction: {e}")
        return []
    except Exception as e:
        logger.error(f"Memory extraction failed: {e}")
        return []


def categorize_fact(fact: str) -> str:
    """Simple rule-based fact categorization."""
    fact_lower = fact.lower()

    tech_keywords = [
        "framework", "language", "library", "tool", "stack",
        "python", "javascript", "react", "fastapi", "code",
        "developer", "engineer", "programming",
    ]
    preference_keywords = [
        "favorite", "prefer", "like", "love", "enjoy",
        "hate", "dislike", "best", "worst",
    ]
    professional_keywords = [
        "work", "job", "company", "team", "project",
        "experience", "skill", "years",
    ]
    goal_keywords = [
        "want", "goal", "plan", "trying", "learning",
        "building", "working on",
    ]

    if any(k in fact_lower for k in tech_keywords):
        return "technical"
    elif any(k in fact_lower for k in goal_keywords):
        return "goal"
    elif any(k in fact_lower for k in professional_keywords):
        return "professional"
    elif any(k in fact_lower for k in preference_keywords):
        return "preference"
    else:
        return "general"