import re

text = "The rash subsided by Sunday morning without further intervention. Patient recovered at home and didn't [HOSPITAL_SRXN]."

def find_first(patterns, text):
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m: return m.group(1).strip()
    return None

outcome = find_first([r"\b(recovered|recovering|not\s+recovered|fatal|dead|death|died|unknown)\b"], text)
if outcome:
    if outcome.lower() in ["dead", "death", "died"]: outcome = "Fatal"
    else: outcome = outcome.capitalize()
    
print("Outcome:", outcome)
