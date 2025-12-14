#!/usr/bin/env python3
"""
Populate Qdrant vector database with LainCorp knowledge
"""

import json
import os
import sys
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

# Configuration
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
COLLECTION_NAME = "lain_memory"
DATA_FILE = Path(__file__).parent / "data" / "laincorp_knowledge.json"

def main():
    print("🔮 LainCorp Knowledge Ingestion")
    print("=" * 50)
    
    # Initialize encoder
    print("Loading sentence encoder...")
    encoder = SentenceTransformer('all-MiniLM-L6-v2')
    print("✓ Encoder loaded")
    
    # Connect to Qdrant
    print(f"Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}...")
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    print("✓ Connected to Qdrant")
    
    # Check/create collection
    collections = client.get_collections().collections
    if not any(c.name == COLLECTION_NAME for c in collections):
        print(f"Creating collection: {COLLECTION_NAME}")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE)
        )
        print(f"✓ Collection created")
    else:
        print(f"✓ Collection exists: {COLLECTION_NAME}")
    
    # Load knowledge data
    print(f"\nLoading knowledge from {DATA_FILE}...")
    if not DATA_FILE.exists():
        print(f"❌ Knowledge file not found: {DATA_FILE}")
        sys.exit(1)
    
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
    
    company_info = data.get('company_info', [])
    print(f"✓ Loaded {len(company_info)} knowledge entries")
    
    # Process and upload
    print("\nProcessing and uploading to vector database...")
    points = []
    
    for idx, entry in enumerate(company_info):
        topic = entry['topic']
        content = entry['content']
        
        # Create embedding
        text = f"{topic}: {content}"
        embedding = encoder.encode(text).tolist()
        
        # Create point
        point = PointStruct(
            id=idx,
            vector=embedding,
            payload={
                "topic": topic,
                "content": content,
                "text": text,
                "source": "laincorp_knowledge",
                "type": "company_info"
            }
        )
        points.append(point)
        print(f"  [{idx+1}/{len(company_info)}] {topic}")
    
    # Upload to Qdrant
    print(f"\nUploading {len(points)} vectors to Qdrant...")
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points
    )
    print("✓ Upload complete")
    
    # Verify
    collection_info = client.get_collection(COLLECTION_NAME)
    print(f"\n📊 Collection Stats:")
    print(f"  Total vectors: {collection_info.points_count}")
    print(f"  Vector size: {collection_info.config.params.vectors.size}")
    
    # Test search
    print(f"\n🔍 Testing search...")
    test_query = "Who is the CEO of LainCorp?"
    query_vector = encoder.encode(test_query).tolist()
    
    from qdrant_client.models import SearchRequest
    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=3
    ).points
    
    print(f"Query: '{test_query}'")
    print(f"Top results:")
    for i, result in enumerate(results, 1):
        print(f"  {i}. [{result.score:.3f}] {result.payload['topic']}")
        print(f"     {result.payload['content'][:100]}...")
    
    print("\n✨ Knowledge ingestion complete!")
    print("Lain now knows about LainCorp and her role as CEO.")

if __name__ == "__main__":
    main()
