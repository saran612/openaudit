import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

LLM_API_URL = os.getenv("LLM_API_URL", "http://localhost:11434/v1/chat/completions")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")
LLM_MODEL   = os.getenv("LLM_MODEL", "qwen2.5:1.5b")

prompt = """You are a clinical information extractor for CDSCO adverse event 
reports. Extract structured fields from the anonymised document below.

RULES:
- Extract ONLY what is explicitly stated in the document
- Use null if a field is genuinely absent — do NOT infer or guess
- patient_info must be a single clean entry — one patient only,
  using their anonymised token + age bucket + gender
  e.g. "[PATIENT_GYXL], Male, 46-60"
  Do NOT list multiple tokens or copy garbled text
- case_reference must be extracted from the document itself
  (e.g. "CDSCO-AE-1882") — do NOT use system-generated IDs
- event_description must be 2-3 clean clinical sentences
  describing what happened medically — not a copy of the raw text
- key_findings must be complete clinical terms only
  (e.g. "anaphylaxis, cyanosis, failed intubation, cardiac arrest")
  Do NOT include partial words, sentence fragments, or cut-off text
- indication is WHY the drug was prescribed
  (e.g. "chronic hypertension") — look for phrases like
  "prescribed for", "treatment of", "indicated for"
- severity must be one of: 
  Mild / Moderate / Severe / Life-threatening / Fatal
- outcome must be one of:
  Recovered / Recovering / Not Recovered / Fatal / Unknown

---

Return ONLY valid JSON, no markdown, no preamble:

{
  "case_reference": "<from document, e.g. CDSCO-AE-1882>",
  "patient_info": "<single token + gender + age bucket>",
  "drug_name": "<name + dosage + frequency>",
  "indication": "<why the drug was prescribed>",
  "event_description": "<2-3 clean clinical sentences>",
  "severity": "<Mild|Moderate|Severe|Life-threatening|Fatal>",
  "outcome": "<Recovered|Recovering|Not Recovered|Fatal|Unknown>",
  "key_findings": "<comma separated complete clinical terms only>"
}

Document:
She was started on a course of Dexatone 400mg for a persistent infection starting Monday morning. She died later that day.
"""

payload = {
    "model": LLM_MODEL,
    "messages": [{"role": "user", "content": prompt}],
    "temperature": 0.1
}

try:
    response = requests.post(LLM_API_URL, json=payload, timeout=60)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
