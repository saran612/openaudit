import re
text = "She was started on a course of Dexatone 400mg for a persistent infection starting Monday morning. After the third dose on Tuesday afternoon around 2 PM, she developed high grade fever (104 F) and severe abdominal pain."

patterns = [
    r"(?:lab(?:oratory)?|diagnosis|diagnose[sd]|key\s*findings?|findings?)[:\-]?\s*([^\n\.]+)",
    r"(?:state\s*of|presented\s*with|signs\s*of|symptoms\s*of|diagnosed\s*with|history\s*of|secondary\s*to|developed)\s+([a-zA-Z\s\-]+)(?:\.|,|and|with|\n|\()",
    r"\b(cyanosis|cyanotic|anaphylaxis|anaphylactic|arrest|hypotension|hypertension|respiratory\s*distress|tachycardia|bradycardia|seizure|rash|unconscious|unresponsive|fever|pain|infection)\b",
    r"(?:blood\s*pressure|BP|heart\s*rate|HR|SpO2|oxygen|ECG|temperature)\s*(?:was|is|showed|measured|at)?\s*([^\n\.,;]+)"
]

findings = []
for p in patterns:
    for match in re.finditer(p, text, re.IGNORECASE):
        try:
            val = match.group(1).strip()
        except IndexError:
            val = match.group(0).strip()
        findings.append(val)

print("Findings:", findings)
