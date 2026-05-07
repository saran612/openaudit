import os
import boto3
import meilisearch
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/search_docs")
engine = create_engine(DATABASE_URL)

# MinIO
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "password")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "documents")

# Meilisearch
MEILI_HTTP_ADDR = os.getenv("MEILI_HTTP_ADDR", "http://localhost:7700")
MEILI_MASTER_KEY = os.getenv("MEILI_MASTER_KEY", "masterKey")
MEILI_INDEX_NAME = os.getenv("MEILI_INDEX", "documents")

def clear_postgres():
    print("Clearing PostgreSQL...")
    try:
        with engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE documents RESTART IDENTITY;"))
            conn.commit()
        print("PostgreSQL cleared.")
    except Exception as e:
        print(f"PostgreSQL clear error: {e}")

def clear_minio():
    print("Clearing MinIO...")
    try:
        s3 = boto3.resource(
            "s3",
            endpoint_url=MINIO_ENDPOINT,
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            region_name="us-east-1"
        )
        bucket = s3.Bucket(MINIO_BUCKET)
        bucket.objects.all().delete()
        print("MinIO cleared.")
    except Exception as e:
        print(f"MinIO clear error: {e}")

def clear_meilisearch():
    print("Clearing Meilisearch...")
    try:
        client = meilisearch.Client(MEILI_HTTP_ADDR, MEILI_MASTER_KEY)
        client.index(MEILI_INDEX_NAME).delete_all_documents()
        print("Meilisearch cleared.")
    except Exception as e:
        print(f"Meilisearch clear error: {e}")

if __name__ == "__main__":
    print("Starting system-wide data cleanup...")
    clear_postgres()
    clear_minio()
    clear_meilisearch()
    print("\nAll test data has been successfully purged from the system.")
