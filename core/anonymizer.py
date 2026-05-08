import re
import random
import string
import json
import requests
import os

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except (ImportError, OSError):
    nlp = None
    print("Warning: spaCy or en_core_web_sm not installed. Advanced NER masking disabled.")

# ─── Optional LLM Config (shared with summarizer.py) ────────────────────────
LLM_API_URL = os.getenv("LLM_API_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL   = os.getenv("LLM_MODEL",   "llama3-8b-8192")

# Configuration for Generalization
METRO_CITIES = ["Mumbai", "Delhi", "Bangalore", "Bengaluru", "Chennai", "Kolkata", "Hyderabad"]
TIER2_STATE_MAPPING = {
    "Jaipur": "Rajasthan", "Nagpur": "Maharashtra", "Gurgaon": "Haryana", "Gurugram": "Haryana",
    "Pune": "Maharashtra", "Ahmedabad": "Gujarat", "Lucknow": "Uttar Pradesh", "Kanpur": "Uttar Pradesh",
    "Chandigarh": "Chandigarh", "Indore": "Madhya Pradesh", "Bhopal": "Madhya Pradesh", "Patna": "Bihar"
}

class AnonymizerEngine:
    def __init__(self):
        self.token_mapping = {}  # original -> token
        self.reverse_mapping = [] # List of dicts as per requested output format
        self.used_codes = set()

    def _generate_token(self, category):
        # Ensure consistency: same original gets same token
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        while code in self.used_codes:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        
        self.used_codes.add(code)
        return f"[{category}_{code}]"

    def _get_or_create_token(self, original, category):
        key = f"{category}:{original}"
        if key not in self.token_mapping:
            token = self._generate_token(category)
            self.token_mapping[key] = token
            self.reverse_mapping.append({
                "token": token,
                "original": original,
                "category": category
            })
        return self.token_mapping[key]

        return self.token_mapping[key]

    def _llm_anonymize(self, text: str) -> dict:
        """High-accuracy LLM-based anonymisation using the system prompt."""
        prompt = f"""You are a precise medical document anonymisation engine compliant 
with DPDP Act 2023, NDHM, ICMR, and CDSCO guidelines.

Your job is to detect and replace ONLY real PII/PHI entities.
You must be conservative — when in doubt, DO NOT mask.

---

## WHAT TO MASK

PATIENT names (full names of patients only):
→ [PATIENT_XXXX]

DOCTOR names (any name preceded by Dr. / Doctor, including 
abbreviated names like "Dr. S. K. Nair", "Dr. A. B. Roy"):
→ [DOCTOR_XXXX]
Special rule: always treat "Dr." or "Doctor" followed by ANY
combination of initials and/or a surname as a doctor name.
Example: "Dr. S. K. Nair" → [DOCTOR_XXXX]
Example: "Dr. Ananya Rao" → [DOCTOR_XXXX]

HOSPITAL names (only when a specific NAMED hospital or clinic 
is mentioned as a proper noun):
→ [HOSPITAL_XXXX]
Example: "City General Hospital" → [HOSPITAL_XXXX]
Example: "Apollo Specialty Center" → [HOSPITAL_XXXX]

AADHAAR numbers (12-digit number with or without spaces):
→ [AADHAAR_XXXX]

PHONE numbers (Indian 10-digit mobile or landline):
→ [PHONE_XXXX]

EMAIL addresses:
→ [EMAIL_XXXX]

PERSONAL ADDRESSES (flat/house number + street + area/sector):
→ [ADDRESS_XXXX]

CASE REFERENCE numbers (e.g. CDSCO-AE-1882):
→ [CASEREF_XXXX]

---

## WHAT TO NEVER MASK

Strictly DO NOT mask any of the following even if capitalised:

Document section titles:
- "Case Summary Report", "Incident Log", "Ward Report",
  "Adverse Event Report", "AEFI Report", anything that is
  a document heading or section label

Department and location words used generically:
- "Emergency Dept", "ER", "ICU", "Ward B", "OPD",
  "the hospital", "the ward", "the clinic", "the ER"
  (only mask if it is a NAMED hospital like "City General Hospital")

Job titles and designations (never PII):
- "Senior Consultant", "Junior Doctor", "Duty Doctor",
  "Nurse", "Ward Sister", "Pharmacist", "Consultant",
  "Duty Officer", "Reported by", "Doctor on call"

Medical and clinical terms:
- Drug names, dosages, frequencies
- Symptoms, diagnoses, procedures
- Lab values, test results

General words that happen to be capitalised:
- "Case", "Summary", "Report", "Subject", "Patient"
  used as common nouns or section headings

City names used in general context (not part of a personal 
address): e.g. "Gurgaon" alone in a sentence is fine to keep,
only mask if it is part of a full personal address

---

## TOKEN FORMAT RULES

- Format: [TYPE_XXXX] where XXXX = 4 random uppercase 
  alphanumeric characters
- Same entity appearing multiple times = same token every time
- Different entities of same type = different tokens
- Never break a sentence grammatically with a token insertion
- Never create a token for something that is not a real entity

---

## STEP 2 — GENERALISATION

After masking, generalise these quasi-identifiers:

Age:
- 0-17   → "Minor (under 18)"
- 18-30  → "18-30"
- 31-45  → "31-45"
- 46-60  → "46-60"
- 61+    → "Senior (60+)"

City (ONLY when part of a masked personal address):
- Metro cities → keep city name
- Tier-2 cities → state name only

Dates:
- Specific dates (2024-05-20, Oct 10th) → "Month Year" only
- Times of day (7:00 PM, 8:15 PM) → KEEP exactly as-is
- Day names ("Tuesday", "Monday") → remove

---

## OUTPUT FORMAT

Return ONLY valid JSON. No markdown. No preamble. No explanation.

{{
  "anonymised_text": "<full document with replacements applied>",

  "token_mapping": [
    {{
      "token": "[PATIENT_WWOR]",
      "original": "Amit Mehra",
      "category": "PATIENT_NAME"
    }},
    {{
      "token": "[DOCTOR_N8K2]",
      "original": "Dr. S. K. Nair",
      "category": "DOCTOR_NAME"
    }},
    {{
      "token": "[HOSPITAL_IVN7]",
      "original": "City General Hospital",
      "category": "HOSPITAL_NAME"
    }}
  ],

  "generalisation_log": [
    {{
      "field": "age",
      "original": "54",
      "generalised": "46-60"
    }},
    {{
      "field": "city",
      "original": "Gurgaon",
      "generalised": "Haryana"
    }},
    {{
      "field": "date",
      "original": "2024-05-20",
      "generalised": "May 2024"
    }}
  ],

  "pii_summary": {{
    "total_pii_detected": 6,
    "categories_found": [
      "PATIENT_NAME",
      "DOCTOR_NAME",
      "HOSPITAL_NAME",
      "AADHAAR",
      "PHONE",
      "ADDRESS"
    ],
    "safe_to_index": true
  }}
}}

---

## SELF CHECK BEFORE OUTPUT

Before returning, verify each of these:

[ ] Is "Dr. S. K. Nair" or any "Dr." name masked as [DOCTOR_XXXX]?
[ ] Is "Case Summary Report" left unmasked?
[ ] Is "Emergency Dept" left unmasked?
[ ] Is "Senior Consultant" left unmasked?
[ ] Is "the hospital" (generic) left unmasked?
[ ] Is only the NAMED hospital (e.g. City General Hospital) masked?
[ ] Are drug names completely untouched?
[ ] Does every sentence still read grammatically after masking?
[ ] Are times of day (7:00 PM, 8:15 PM) preserved exactly?

If any check fails, fix it before returning.

---

Document to anonymise:

\"\"\"
{text}
\"\"\"
"""
        headers = {
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": LLM_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0
        }
        
        try:
            import requests
            import re
            response = requests.post(LLM_API_URL, headers=headers, json=payload, timeout=120)
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"]
            raw = re.sub(r"```(?:json)?", "", raw).strip()
            result = json.loads(raw)
            
            # Map LLM format to our engine format
            return {
                "step1_pseudonymised_text": result.get("anonymised_text", ""),
                "token_mapping": result.get("token_mapping", []),
                "step2_anonymised_text": result.get("anonymised_text", ""),
                "generalisation_log": result.get("generalisation_log", []),
                "pii_summary": result.get("pii_summary", {"total_pii_detected": 0})
            }
        except Exception as e:
            print(f"[anonymizer] LLM fallback failed: {e}")
            return self._rule_based_process(text)

    def process(self, text):
        # Always use rule-based to prevent 120s timeouts from massive prompts
        return self._rule_based_process(text)

    def _rule_based_process(self, text):
        if not text:
            return {
                "step1_pseudonymised_text": "",
                "token_mapping": [],
                "step2_anonymised_text": "",
                "generalisation_log": [],
                "pii_summary": {"total_pii_detected": 0}
            }

        # --- STEP 1: PSEUDONYMISATION ---
        p_text = text

        # 1.1 Regex for structured PII
        patterns = [
            (r'\b\d{4}\s\d{4}\s\d{4}\b', "AADHAAR"),
            (r'\b(?:\+91|0)?[6-9]\d{9}\b', "PHONE"),
            (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b', "EMAIL"),
            (r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b', "PAN"), # Indian PAN
            (r'\bCDSCO-AE-\d+\b', "CASEREF")
        ]

        for pattern, cat in patterns:
            matches = re.findall(pattern, p_text)
            for m in set(matches):
                token = self._get_or_create_token(m, cat)
                p_text = p_text.replace(m, token)

        # 1.2 NER for Names and Entities (with Regex Fallbacks)
        if nlp:
            doc = nlp(p_text)
            entities = sorted(doc.ents, key=lambda e: len(e.text), reverse=True)
            for ent in entities:
                if ent.label_ == "PERSON":
                    token = self._get_or_create_token(ent.text, "PATIENT" if "patient" in p_text.lower() else "PERSON")
                    p_text = p_text.replace(ent.text, token)
                elif ent.label_ in ["FAC", "ORG"] and any(kw in ent.text.lower() for kw in ["hospital", "clinic", "medical", "centre", "center"]):
                    token = self._get_or_create_token(ent.text, "HOSPITAL")
                    p_text = p_text.replace(ent.text, token)
        
        # Always run these fallbacks for higher coverage
        # 1. Doctors (handling initials like Dr. S. K. Nair)
        doc_pattern = r"(?:Dr\.|Doctor)\s+([A-Z][a-z]*(?:\s+[A-Z]\.?)*\s+[A-Z][a-z]+)"
        matches = re.findall(doc_pattern, p_text)
        for m in set(matches):
            token = self._get_or_create_token(m, "DOCTOR")
            p_text = p_text.replace(m, token)

        # 2. General Names (Patients/Others)
        name_fallbacks = [
            r"(?:Mr\.|Ms\.|Mrs\.|Patient|Reporter)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
            r"\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b" # Generic Capitalized Pairs
        ]
        for nf in name_fallbacks:
            matches = re.findall(nf, p_text)
            for m in set(matches):
                if m.lower() not in ["the", "this", "that", "case", "report", "hospital", "summary", "date typed", "case reference"]:
                    category = "PATIENT" if "patient" in p_text.lower() else "PERSON"
                    token = self._get_or_create_token(m, category)
                    p_text = p_text.replace(m, token)

        # 3. Addresses
        addr_keywords = ["Flat", "House", "Plot", "Sector", "Street", "Lane", "Road", "Enclave", "Colony", "Nagar", "Apartments", "Society"]
        addr_pattern = r"\b(?:" + "|".join(addr_keywords) + r")\b[\s\d,]+[^,\.\n]{2,100}"
        matches = re.findall(addr_pattern, p_text, re.IGNORECASE)
        for m in set(matches):
            token = self._get_or_create_token(m.strip(), "ADDRESS")
            p_text = p_text.replace(m, token)

        # 4. Hospitals (Fallback)
        hosp_pattern = r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Hospital|Clinic|Medical|Centre|Center|Nursing Home))\b"
        matches = re.findall(hosp_pattern, p_text, re.IGNORECASE)
        for m in set(matches):
            token = self._get_or_create_token(m, "HOSPITAL")
            p_text = p_text.replace(m, token)
        a_text = p_text
        gen_log = []

        # 2.1 Age Generalisation
        age_matches = re.finditer(r'\b(\d{1,2})\s*(?:years?|yrs?|yo)\s*(?:old)?\b', a_text, re.IGNORECASE)
        for m in sorted(list(age_matches), key=lambda x: len(x.group(0)), reverse=True):
            age = int(m.group(1))
            gen = ""
            if age <= 17: gen = "Minor (under 18)"
            elif age <= 30: gen = "18-30"
            elif age <= 45: gen = "31-45"
            elif age <= 60: gen = "46-60"
            else: gen = "Senior (60+)"
            
            a_text = a_text.replace(m.group(0), f"{gen} years old")
            gen_log.append({"field": "age", "original": m.group(0), "generalised": gen})

        # 2.2 Date Generalisation (e.g. 2024-05-20 -> May 2024)
        date_patterns = [
            r'\b\d{4}-\d{2}-\d{2}\b',
            r'\b\d{2}/\d{2}/\d{4}\b'
        ]
        for dp in date_patterns:
            for dm in re.findall(dp, a_text, re.IGNORECASE):
                # Simple month placeholder
                gen = "[Month Year]"
                a_text = a_text.replace(dm, gen)
                gen_log.append({"field": "date", "original": dm, "generalised": gen})

        # 2.3 City/Location Generalisation
        found_cities = []
        # Check for known cities in text
        for city, state in TIER2_STATE_MAPPING.items():
            if re.search(r'\b' + city + r'\b', a_text, re.IGNORECASE):
                a_text = re.sub(r'\b' + city + r'\b', state, a_text, flags=re.IGNORECASE)
                gen_log.append({"field": "city", "original": city, "generalised": state})
                found_cities.append(city)
        
        for city in METRO_CITIES:
            if re.search(r'\b' + city + r'\b', a_text, re.IGNORECASE):
                found_cities.append(city)

        if not nlp and not found_cities:
            # Last resort: look for address-like strings (simplified)
            addr_pattern = r"\b(?:Flat|Sector|Street|Enclave|Colony|Nagar)\b[^,\.\n]{2,50}"
            matches = re.findall(addr_pattern, a_text, re.IGNORECASE)
            for m in set(matches):
                a_text = a_text.replace(m, "[ADDRESS REDACTED]")

        return {
            "step1_pseudonymised_text": p_text,
            "token_mapping": self.reverse_mapping,
            "step2_anonymised_text": a_text,
            "generalisation_log": gen_log,
            "pii_summary": {
                "total_pii_detected": len(self.reverse_mapping),
                "categories_found": list(set(m["category"] for m in self.reverse_mapping)),
                "pseudonymisation_complete": True,
                "generalisation_complete": True,
                "safe_to_index": True
            }
        }

def anonymize(text: str) -> str:
    """Compatibility wrapper for existing code"""
    engine = AnonymizerEngine()
    result = engine.process(text)
    return result["step2_anonymised_text"]

if __name__ == "__main__":
    engine = AnonymizerEngine()
    sample = "Patient Amit Mehra (Aadhaar: 1234 5678 9012), age 54, was treated at City General Hospital in Gurgaon on 2024-05-20."
    print(json.dumps(engine.process(sample), indent=2))
