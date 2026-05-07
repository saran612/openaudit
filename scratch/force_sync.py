from meilisearch import Client
import os
import json
from dotenv import load_dotenv

# Load env vars
load_dotenv()

MEILI_URL = os.getenv("MEILI_URL", "http://localhost:7700")
MEILI_MASTER_KEY = os.getenv("MEILI_MASTER_KEY")
MEILI_INDEX_NAME = os.getenv("MEILI_INDEX_NAME", "documents")

client = Client(MEILI_URL, MEILI_MASTER_KEY)

# Data for the test document
data = {
    "id": "64f4057a-74c0-44d6-bb4d-208734bfb4a6",
    "analysis_result": {
        "classification": {"category": "Death", "confidence": 0.92},
        "validation": {"is_valid": True, "errors": []}
    },
    "created_at": "2026-05-07T12:00:00"
}

print(f"Updating Meilisearch document {data['id']}...")
task = client.index(MEILI_INDEX_NAME).update_documents([data])
print(f"Task queued: {task}")
