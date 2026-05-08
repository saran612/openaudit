from core.summarizer import _rule_based_summarize, _llm_summarize
import PyPDF2

def extract_pdf():
    text = ""
    with open("test/testcase_pdf-1.pdf", "rb") as file:
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return text

text = extract_pdf()
print("--- Extracted Text Preview ---")
print(text[:1000])
print("\n--- Rule Based Summary ---")
print(_rule_based_summarize(text))
try:
    print("\n--- LLM Summary ---")
    print(_llm_summarize(text))
except Exception as e:
    print("LLM Error:", e)
