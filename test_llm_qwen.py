from core.summarizer import _llm_summarize, _rule_based_summarize
from dotenv import load_dotenv

load_dotenv()

text = """She was started on a course of Dexatone 400mg for a persistent infection starting Monday morning. She died later that day."""

try:
    print("LLM Output:")
    print(_llm_summarize(text))
except Exception as e:
    print("LLM failed:", e)

print("Rule Based Output:")
print(_rule_based_summarize(text))

