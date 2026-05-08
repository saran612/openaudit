import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

LLM_API_URL = os.getenv("LLM_API_URL", "http://localhost:11434/v1/chat/completions")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")
LLM_MODEL   = os.getenv("LLM_MODEL", "llama3.1:8b")

print(f"URL: {LLM_API_URL}, Model: {LLM_MODEL}")

prompt = """You are a clinical information extractor for CDSCO adverse event 
reports. Extract structured fields from the anonymised document below.

Return ONLY valid JSON.

Document:
The patient Amit Mehra, male, 54 years old, was brought into the ER on Tuesday night in a state of severe respiratory distress. The patient had been prescribed Cardioprin 75mg once daily for chronic hypertension. Patient declared dead at 9:40 PM.
"""

payload = {
    "model": LLM_MODEL,
    "messages": [{"role": "user", "content": prompt}],
    "temperature": 0.1
}

try:
    response = requests.post(LLM_API_URL, json=payload, timeout=30)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
