#!/usr/bin/env python3
"""
SentinelAI - HDFS Log Ingestion Script
=======================================

This script ingests raw HDFS log data from a file into MongoDB,
transforming each log line into the standard SentinelAI log schema.

HDFS Log Format:
    YYMMDD HHMMSS THREAD_ID LEVEL SERVICE: MESSAGE
    Example: 081109 203518 148 INFO dfs.DataNode$DataXceiver: Receiving block...

Target MongoDB Schema:
    {
        timestamp: datetime,
        level: "info" | "warn" | "error",
        service: string,
        message: string,
        metadata: {
            source: "hdfs",
            thread_id: string,
            raw_line: string
        },
        createdAt: datetime
    }

Usage:
    python scripts/ingest_hdfs_logs.py

Requirements:
    - pymongo
    - python-dotenv
    - MONGODB_URI in .env file
    - HDFS.log file in datasets/hdfs/
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Third-party imports
from dotenv import load_dotenv
from pymongo import MongoClient, InsertOne
from pymongo.errors import BulkWriteError, ConnectionFailure

# =============================================================================
# CONFIGURATION
# =============================================================================

# File paths
HDFS_LOG_FILE = PROJECT_ROOT / "datasets" / "hdfs" / "HDFS.log"

# Possible .env file locations (checked in order)
ENV_FILE_LOCATIONS = [
    PROJECT_ROOT / ".env",
    PROJECT_ROOT / "ai-engine" / ".env",
    PROJECT_ROOT / "demo-app" / ".env",
]

# Batch processing settings
BATCH_SIZE = 500           # Number of documents per batch insert
PROGRESS_INTERVAL = 5000   # Print progress every N lines

# MongoDB settings
DATABASE_NAME = "sentinelai_logs"
COLLECTION_NAME = "logs"

# =============================================================================
# LOG PARSING
# =============================================================================

# Regex pattern to parse HDFS log lines
# Format: YYMMDD HHMMSS THREAD_ID LEVEL SERVICE: MESSAGE
# Example: 081109 203518 148 INFO dfs.DataNode$DataXceiver: Receiving block...
HDFS_LOG_PATTERN = re.compile(
    r"^(\d{6})\s+"           # Group 1: Date (YYMMDD)
    r"(\d{6})\s+"            # Group 2: Time (HHMMSS)
    r"(\d+)\s+"              # Group 3: Thread ID
    r"(\w+)\s+"              # Group 4: Log Level (INFO, WARN, ERROR, etc.)
    r"([\w.$]+):\s*"         # Group 5: Service/Component name
    r"(.*)$"                 # Group 6: Message (rest of line)
)

# Map HDFS log levels to normalized lowercase values
LEVEL_MAPPING = {
    "INFO": "info",
    "WARN": "warn",
    "WARNING": "warn",
    "ERROR": "error",
    "FATAL": "error",
    "DEBUG": "info",      # Treat debug as info for our purposes
    "TRACE": "info",      # Treat trace as info for our purposes
}


def parse_hdfs_date(date_str: str, time_str: str) -> Optional[datetime]:
    """
    Parse HDFS date and time strings into a Python datetime object.
    
    Args:
        date_str: Date in YYMMDD format (e.g., "081109" for Nov 9, 2008)
        time_str: Time in HHMMSS format (e.g., "203518" for 20:35:18)
    
    Returns:
        datetime object or None if parsing fails
    
    Note:
        HDFS logs from 2008 use 2-digit years. We assume years 00-99 map to 2000-2099.
    """
    try:
        # Parse date components
        year = int(date_str[0:2])
        month = int(date_str[2:4])
        day = int(date_str[4:6])
        
        # Parse time components
        hour = int(time_str[0:2])
        minute = int(time_str[2:4])
        second = int(time_str[4:6])
        
        # Convert 2-digit year to 4-digit (assume 2000s for HDFS logs)
        full_year = 2000 + year
        
        return datetime(full_year, month, day, hour, minute, second)
    except (ValueError, IndexError):
        return None


def parse_log_line(line: str) -> Optional[Dict[str, Any]]:
    """
    Parse a single HDFS log line into a structured document.
    
    Args:
        line: Raw log line from HDFS.log
    
    Returns:
        Dictionary matching the target MongoDB schema, or None if parsing fails
    
    Example:
        Input:  "081109 203518 148 INFO dfs.DataNode$DataXceiver: Receiving block..."
        Output: {
            "timestamp": datetime(2008, 11, 9, 20, 35, 18),
            "level": "info",
            "service": "dfs.DataNode$DataXceiver",
            "message": "Receiving block...",
            "metadata": {
                "source": "hdfs",
                "thread_id": "148",
                "raw_line": "081109 203518 148 INFO dfs.DataNode$DataXceiver: Receiving block..."
            },
            "createdAt": <current_datetime>
        }
    """
    # Skip empty lines
    line = line.strip()
    if not line:
        return None
    
    # Try to match the log pattern
    match = HDFS_LOG_PATTERN.match(line)
    if not match:
        return None
    
    # Extract matched groups
    date_str, time_str, thread_id, level, service, message = match.groups()
    
    # Parse timestamp
    timestamp = parse_hdfs_date(date_str, time_str)
    if not timestamp:
        return None
    
    # Normalize log level (default to "info" if unknown)
    normalized_level = LEVEL_MAPPING.get(level.upper(), "info")
    
    # Build the document matching SentinelAI schema
    document = {
        "timestamp": timestamp,
        "level": normalized_level,
        "service": service,
        "message": message.strip(),
        "metadata": {
            "source": "hdfs",
            "thread_id": thread_id,
            "raw_line": line
        },
        "createdAt": datetime.utcnow()
    }
    
    return document


# =============================================================================
# DATABASE OPERATIONS
# =============================================================================

def get_mongodb_client() -> MongoClient:
    """
    Create and return a MongoDB client using the URI from environment.
    
    Returns:
        MongoClient instance
    
    Raises:
        SystemExit: If MONGODB_URI is not set or connection fails
    """
    mongodb_uri = os.getenv("MONGODB_URI")
    
    if not mongodb_uri:
        print("[ERROR] MONGODB_URI environment variable is not set.")
        print("        Please ensure .env file exists with MONGODB_URI=<your_uri>")
        sys.exit(1)
    
    try:
        client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        # Test connection
        client.admin.command('ping')
        return client
    except ConnectionFailure as e:
        print(f"[ERROR] Failed to connect to MongoDB: {e}")
        sys.exit(1)


def batch_insert_documents(collection, documents: List[Dict[str, Any]]) -> int:
    """
    Insert a batch of documents into MongoDB.
    
    Args:
        collection: MongoDB collection object
        documents: List of documents to insert
    
    Returns:
        Number of documents successfully inserted
    
    Note:
        Uses ordered=False to continue inserting even if some documents fail.
        This makes the script idempotent-friendly (safe to re-run).
    """
    if not documents:
        return 0
    
    try:
        # Use bulk write with ordered=False for better performance
        # and to continue even if some inserts fail (e.g., duplicates)
        result = collection.insert_many(documents, ordered=False)
        return len(result.inserted_ids)
    except BulkWriteError as e:
        # Some documents may have been inserted despite the error
        # This can happen with duplicate keys, etc.
        write_errors = e.details.get('writeErrors', [])
        inserted_count = e.details.get('nInserted', 0)
        
        if write_errors:
            # Only log first few errors to avoid spam
            for error in write_errors[:3]:
                print(f"    [WARN] Write error: {error.get('errmsg', 'Unknown error')}")
            if len(write_errors) > 3:
                print(f"    [WARN] ...and {len(write_errors) - 3} more errors")
        
        return inserted_count


# =============================================================================
# MAIN INGESTION LOGIC
# =============================================================================

def ingest_hdfs_logs():
    """
    Main function to ingest HDFS logs into MongoDB.
    
    Process:
        1. Load environment variables
        2. Connect to MongoDB
        3. Read HDFS.log line by line (memory-safe)
        4. Parse each line and collect into batches
        5. Batch insert into MongoDB
        6. Print progress and final summary
    """
    print("=" * 60)
    print("SentinelAI - HDFS Log Ingestion")
    print("=" * 60)
    
    # -------------------------------------------------------------------------
    # Step 1: Load environment variables
    # -------------------------------------------------------------------------
    print("\n[1/5] Loading environment configuration...")
    
    env_loaded = False
    for env_path in ENV_FILE_LOCATIONS:
        if env_path.exists():
            load_dotenv(env_path)
            print(f"      Loaded .env from: {env_path}")
            env_loaded = True
            break
    
    if not env_loaded:
        print("      [WARN] No .env file found in expected locations")
        print("             Attempting to use system environment variables...")
    
    # -------------------------------------------------------------------------
    # Step 2: Verify log file exists
    # -------------------------------------------------------------------------
    print("\n[2/5] Checking HDFS log file...")
    
    if not HDFS_LOG_FILE.exists():
        print(f"[ERROR] HDFS log file not found: {HDFS_LOG_FILE}")
        print("        Please ensure the file exists at: datasets/hdfs/HDFS.log")
        sys.exit(1)
    
    file_size_mb = HDFS_LOG_FILE.stat().st_size / (1024 * 1024)
    print(f"      Found: {HDFS_LOG_FILE}")
    print(f"      Size:  {file_size_mb:.2f} MB")
    
    # -------------------------------------------------------------------------
    # Step 3: Connect to MongoDB
    # -------------------------------------------------------------------------
    print("\n[3/5] Connecting to MongoDB...")
    
    client = get_mongodb_client()
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    
    # Get current document count for reference
    existing_count = collection.count_documents({})
    print(f"      Connected to database: {DATABASE_NAME}")
    print(f"      Target collection: {COLLECTION_NAME}")
    print(f"      Existing documents: {existing_count:,}")
    
    # -------------------------------------------------------------------------
    # Step 4: Process log file
    # -------------------------------------------------------------------------
    print("\n[4/5] Processing HDFS logs...")
    print(f"      Batch size: {BATCH_SIZE}")
    print(f"      Progress interval: every {PROGRESS_INTERVAL:,} lines")
    print()
    
    # Counters for tracking progress
    total_lines = 0
    total_inserted = 0
    total_skipped = 0
    
    # Current batch of documents
    batch: List[Dict[str, Any]] = []
    
    # Start time for performance tracking
    start_time = datetime.now()
    
    # Read file line by line (memory-safe for large files)
    with open(HDFS_LOG_FILE, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            total_lines += 1
            
            # Parse the log line
            document = parse_log_line(line)
            
            if document:
                batch.append(document)
            else:
                total_skipped += 1
            
            # Insert batch when it reaches BATCH_SIZE
            if len(batch) >= BATCH_SIZE:
                inserted = batch_insert_documents(collection, batch)
                total_inserted += inserted
                batch = []
            
            # Print progress at intervals
            if total_lines % PROGRESS_INTERVAL == 0:
                elapsed = (datetime.now() - start_time).total_seconds()
                rate = total_lines / elapsed if elapsed > 0 else 0
                print(f"      Processed: {total_lines:>10,} lines | "
                      f"Inserted: {total_inserted:>10,} | "
                      f"Skipped: {total_skipped:>6,} | "
                      f"Rate: {rate:,.0f} lines/sec")
    
    # Insert remaining documents in the final batch
    if batch:
        inserted = batch_insert_documents(collection, batch)
        total_inserted += inserted
    
    # Calculate elapsed time
    elapsed_time = (datetime.now() - start_time).total_seconds()
    
    # -------------------------------------------------------------------------
    # Step 5: Print summary
    # -------------------------------------------------------------------------
    print("\n[5/5] Ingestion complete!")
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Total lines read:     {total_lines:>12,}")
    print(f"  Total logs inserted:  {total_inserted:>12,}")
    print(f"  Total lines skipped:  {total_skipped:>12,}")
    print(f"  Time elapsed:         {elapsed_time:>12.2f} seconds")
    
    if elapsed_time > 0:
        print(f"  Processing rate:      {total_lines / elapsed_time:>12,.0f} lines/sec")
        print(f"  Insert rate:          {total_inserted / elapsed_time:>12,.0f} docs/sec")
    
    # Final document count
    final_count = collection.count_documents({})
    print(f"\n  Documents before:     {existing_count:>12,}")
    print(f"  Documents after:      {final_count:>12,}")
    print(f"  Net change:           {final_count - existing_count:>+12,}")
    
    print("=" * 60)
    
    # Cleanup
    client.close()
    
    return total_inserted


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    try:
        ingest_hdfs_logs()
    except KeyboardInterrupt:
        print("\n\n[INTERRUPTED] Ingestion cancelled by user.")
        sys.exit(130)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        sys.exit(1)
