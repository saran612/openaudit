import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import DocumentMetadata, SessionLocal
from core import summarizer, classifier, validator

def test():
    db = SessionLocal()
    doc = db.query(DocumentMetadata).first()
    if not doc:
        print("No documents found in DB")
        return
    
    print(f"Testing analysis for {doc.id} ({doc.filename})")
    # Simulate extraction (since we don't have the async loop here easily)
    text = "Sample medical report: Patient Amit Mehra, 54 years old, developed severe rash after taking Cardioprin. Outcome: Hospitalized."
    
    summary = summarizer.summarize(text)
    print(f"Summary: {summary}")
    
    classification = classifier.classify(summary)
    print(f"Classification: {classification}")
    
    validation = validator.validate(summary, classification)
    print(f"Validation: {validation}")

if __name__ == "__main__":
    test()
