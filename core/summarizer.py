import os
import re
import json
import requests

# ─── Optional LLM Config (set LLM_API_URL + LLM_API_KEY in .env) ────────────
# Works with any OpenAI-compatible endpoint (OpenAI, Groq, Ollama, etc.)
LLM_API_URL = os.getenv("LLM_API_URL", "")          # e.g. https://api.groq.com/openai/v1/chat/completions
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL   = os.getenv("LLM_MODEL",   "llama3-8b-8192")

SUMMARY_FIELDS = [
    "case_reference", "patient_info", "drug_name", "indication",
    "event_description", "severity", "outcome", "key_findings"
]


def _llm_summarize(text: str) -> dict:
    """Call an OpenAI-compatible LLM to extract summary fields."""
    prompt = f"""You are a clinical information extractor for CDSCO adverse event 
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

{{
  "case_reference": "<from document, e.g. CDSCO-AE-1882>",
  "patient_info": "<single token + gender + age bucket>",
  "drug_name": "<name + dosage + frequency>",
  "indication": "<why the drug was prescribed>",
  "event_description": "<2-3 clean clinical sentences>",
  "severity": "<Mild|Moderate|Severe|Life-threatening|Fatal>",
  "outcome": "<Recovered|Recovering|Not Recovered|Fatal|Unknown>",
  "key_findings": "<comma separated complete clinical terms only>"
}}

Document:
\"\"\"
{text[:6000]}
\"\"\"
"""
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1
    }
    response = requests.post(LLM_API_URL, headers=headers, json=payload, timeout=120)
    response.raise_for_status()

    raw = response.json()["choices"][0]["message"]["content"]

    # Strip markdown fences if present
    raw = re.sub(r"```(?:json)?", "", raw).strip()
    return json.loads(raw)


def _rule_based_summarize(text: str) -> dict:
    """Fast deterministic fallback when no LLM is configured."""

    # 1. Helper to strip noise/headers for cleaner narrative extraction
    clean_text = re.sub(r'(?:REPORT|Case Reference|Date Typed|Case Summary Report|Page \d+).*?\n', '', text, flags=re.IGNORECASE)
    
    def find_all(patterns, flags=re.IGNORECASE):
        found = []
        for p in patterns:
            matches = re.finditer(p, text, flags)
            for m in matches:
                try:
                    val = m.group(1).strip()
                except IndexError:
                    val = m.group(0).strip()
                if val and val not in found:
                    found.append(val)
        return found

    def find_first(patterns, flags=re.IGNORECASE):
        for p in patterns:
            m = re.search(p, text, flags)
            if m:
                try:
                    return m.group(1).strip().replace('\n', ' ')
                except IndexError:
                    return m.group(0).strip().replace('\n', ' ')
        return None

    # Patient info (extract generalized age and token)
    p_info_parts = find_all([
        r"(\[PATIENT_[A-Z0-9]{4}\])",
        r"\b(\d{2}-\d{2})\s+years?\b", # Require "years" after range if it's XX-XX
        r"\b(\d{1,2}\+|\bSenior\b|\bMinor\b)(?:\s+years?\s*(?:old)?)?\b",
        r"\b(male|female|other)\b"
    ])
    # Filter out potential date fragments like 24-05 from 2024-05-20
    patient_info = ", ".join([p for p in p_info_parts if not re.match(r'^\d{2}-\d{2}$', p) or any(kw in text.lower() for kw in ["age", "years", "old"])])
    if not patient_info and p_info_parts:
        patient_info = ", ".join(p_info_parts)

    # Drug name
    drug_name = find_first([
        r"(?:drug|medicine|medication|suspect\s*drug)\s*[:\-]\s*([^\n,;\.]+)",
        r"(?:prescribed|taking|started\s*on|given|dose\s*of)(?:\s+(?:a|an|the|course\s*of|daily|dose\s*of|tablet\s*of|capsule\s*of|injection\s*of))*\s+([A-Z][a-zA-Z0-9\-]+(?:\s+\d+(?:mg|g|ml|mcg))?)",
        r"(?:tablet|capsule|injection|syrup)\s+(?:of\s+)?([A-Za-z0-9]+(?:\s+\d+(?:mg|g|ml|mcg))?)"
    ])
    if drug_name and drug_name.lower() in ["of", "for", "the", "a", "in", "and", "is"]:
        drug_name = None

    # Severity & Outcome
    severity = find_first([r"\b(mild|moderate|severe|life[-\s]threatening|fatal|dead|death|died)\b"])
    if severity: 
        if severity.lower() in ["dead", "death", "died"]: severity = "Fatal"
        else: severity = severity.capitalize()
    
    outcome = find_first([r"\b(recovered|recovering|not\s+recovered|fatal|dead|death|died|unknown)\b"])
    if outcome:
        if outcome.lower() in ["dead", "death", "died"]: outcome = "Fatal"
        else: outcome = outcome.capitalize()

    # Event Description - Look for the clinical narrative
    narrative = None
    # More flexible sentence matching
    narrative_matches = re.finditer(r"([^.!?]{20,}[^.!?]+(?:developed|presented|admitted|reported|observed|found|started|suffered|declared|brought|occurred)[^.!?]+[.!?])", clean_text, re.IGNORECASE | re.DOTALL)
    narrative_sentences = [m.group(1).strip().replace('\n', ' ') for m in narrative_matches]
    if narrative_sentences:
        narrative = " ".join(narrative_sentences[:3]) 
    else:
        # Fallback to keywords
        event_match = re.search(r"(?:adverse\s+event|adverse\s+reaction|side\s+effect|event\s+description|summary)[:\-]?\s*(.{20,400})", clean_text, re.IGNORECASE | re.DOTALL)
        if event_match:
            narrative = event_match.group(1).strip().replace('\n', ' ')

    # Key Findings - Collect ALL matching findings
    findings_list = find_all([
        r"(?:lab(?:oratory)?|diagnosis|diagnose[sd]|key\s*findings?|findings?)[:\-]?\s*([^\n\.]+)",
        r"(?:state\s*of|presented\s*with|signs\s*of|symptoms\s*of|diagnosed\s*with|history\s*of|secondary\s*to|developed|complained\s*of|suffering\s*from)\s+([a-zA-Z\s\-]{3,50})(?:\.|,|and|with|\n|\()",
        r"\b(cyanosis|cyanotic|anaphylaxis|anaphylactic|arrest|hypotension|hypertension|respiratory\s*distress|tachycardia|bradycardia|seizure|rash|unconscious|unresponsive|fever|pain|infection|vomiting|nausea|dizziness|bleeding)\b",
        r"(?:blood\s*pressure|BP|heart\s*rate|HR|SpO2|oxygen|ECG|temperature)\s*(?:was|is|showed|measured|at)?\s*([^\n\.,;]+)"
    ])
    # De-duplicate
    findings_list = list(set(f.strip().lower() for f in findings_list if f and len(f) > 3))
    key_findings = ", ".join(findings_list) if findings_list else None

    # Case Reference
    case_ref = find_first([r"\b(CDSCO-AE-\d+)\b", r"Case\s*Ref(?:erence)?\s*[:\-]?\s*(\w+-\w+-\d+)"])

    # Indication
    indication = find_first([
        r"(?:indication|prescribed\s+for|treatment\s+of|indicated\s+for)\s*[:\-]?\s*([^\n\.,;]+)",
        r"known\s+case\s+of\s+([^\n\.,;]+)"
    ])

    return {
        "case_reference":    case_ref,
        "patient_info":      patient_info,
        "drug_name":         drug_name,
        "indication":        indication,
        "event_description": narrative,
        "severity":          severity,
        "outcome":           outcome,
        "key_findings":      key_findings
    }


def summarize(text: str) -> dict:
    """
    Main entry point.
    Uses LLM if LLM_API_URL and LLM_API_KEY are set; otherwise falls back to
    rule-based extraction.
    """
    if LLM_API_URL and LLM_API_KEY:
        try:
            llm_result = _llm_summarize(text)
            
            # Check if ANY important field is missing from the LLM extraction
            missing_any = any(not llm_result.get(k) for k in SUMMARY_FIELDS)
            
            if missing_any:
                print("[summarizer] LLM missed some fields, merging with rule-based fallback.")
                rb_result = _rule_based_summarize(text)
                for k in SUMMARY_FIELDS:
                    if not llm_result.get(k) and rb_result.get(k):
                        llm_result[k] = rb_result[k]
                        
            return llm_result
        except Exception as e:
            print(f"[summarizer] LLM call failed ({e}), falling back to rule-based.")

    return _rule_based_summarize(text)


if __name__ == "__main__":
    sample = """
    Patient: John Doe, Male, 45 years, 70kg.
    Suspect Drug: Amoxicillin 500mg TDS.
    Adverse Event: Patient developed severe skin rash and difficulty breathing
    within 30 minutes of taking the drug. Severity: Severe.
    Outcome: Recovered after treatment.
    Lab Findings: WBC elevated at 12,000.
    """
    result = summarize(sample)
    print(json.dumps(result, indent=2))
