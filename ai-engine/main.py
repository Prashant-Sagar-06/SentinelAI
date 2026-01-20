"""
SentinelAI AI Engine - Main Entry Point
========================================

This is the main entry script for the SentinelAI AI Engine.
It demonstrates the log preprocessing pipeline that will feed into
the anomaly detection autoencoder (to be implemented in future steps).

=== ENVIRONMENT SETUP ===

1. Create a Python virtual environment:
   
   Windows:
       python -m venv venv
       venv\\Scripts\\activate
   
   macOS/Linux:
       python3 -m venv venv
       source venv/bin/activate

2. Install required dependencies:
   
       pip install -r requirements.txt

3. Configure environment variables:
   
   Copy .env.example to .env (or create .env) and set:
       MONGODB_URI=mongodb://localhost:27017/sentinelai_logs
   
   For MongoDB Atlas, use:
       MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/sentinelai_logs

4. Run the script:
   
       python main.py

=== CURRENT PIPELINE ===

1. Connect to MongoDB
2. Fetch logs from the last N minutes
3. Load logs into pandas DataFrame
4. Clean and normalize log messages
5. Display statistics and sample data

=== FUTURE STEPS (NOT IMPLEMENTED YET) ===

- Tokenization and vectorization of log messages
- Autoencoder model for learning normal log patterns
- Anomaly detection based on reconstruction error
- Real-time streaming analysis
- API endpoints for integration with dashboard
"""

import os
import sys

# Add the project root to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from src.preprocessing.load_logs import load_logs_as_dataframe
from src.preprocessing.clean_logs import clean_logs, get_cleaning_stats
from src.utils.db import close_connection


def main():
    """
    Main entry point for the SentinelAI AI Engine.
    
    This function orchestrates the log preprocessing pipeline:
    1. Loads raw logs from MongoDB
    2. Cleans and normalizes the data
    3. Displays statistics and samples for verification
    """
    print("=" * 60)
    print("SentinelAI AI Engine - Log Preprocessing Pipeline")
    print("=" * 60)
    print()
    
    # Configuration
    # Fetch logs from the last 60 minutes (adjust as needed)
    LOOKBACK_MINUTES = 60
    
    print(f"[CONFIG] Looking back {LOOKBACK_MINUTES} minutes for logs")
    print()
    
    # Step 1: Load logs from MongoDB into DataFrame
    print("[STEP 1] Loading logs from MongoDB...")
    print("-" * 40)
    raw_df = load_logs_as_dataframe(minutes=LOOKBACK_MINUTES)
    print()
    
    # Check if we have any data to process
    if raw_df.empty:
        print("[WARN] No logs found. Please ensure:")
        print("  1. MongoDB is running")
        print("  2. MONGODB_URI is correctly set in .env")
        print("  3. The Node.js demo app has generated some logs")
        print()
        print("Exiting...")
        close_connection()
        return
    
    # Step 2: Clean and normalize log messages
    print("[STEP 2] Cleaning and normalizing logs...")
    print("-" * 40)
    cleaned_df = clean_logs(raw_df)
    print()
    
    # Step 3: Display cleaning statistics
    print("[STEP 3] Preprocessing Statistics")
    print("-" * 40)
    stats = get_cleaning_stats(raw_df, cleaned_df)
    print(f"  Original logs:  {stats['original_count']}")
    print(f"  Cleaned logs:   {stats['cleaned_count']}")
    print(f"  Removed logs:   {stats['removed_count']}")
    print(f"  Removal rate:   {stats['removal_rate']}%")
    print()
    
    # Step 4: Display sample of cleaned data
    print("[STEP 4] Sample of Cleaned Logs")
    print("-" * 40)
    
    if not cleaned_df.empty:
        # Show first 5 rows
        sample_size = min(5, len(cleaned_df))
        print(f"Showing first {sample_size} cleaned log messages:\n")
        
        for idx, row in cleaned_df.head(sample_size).iterrows():
            level = row.get("level", "unknown").upper()
            message = row.get("message", "")
            timestamp = row.get("timestamp", "")
            
            # Truncate long messages for display
            display_msg = message[:80] + "..." if len(message) > 80 else message
            
            print(f"  [{level}] {display_msg}")
        
        print()
        
        # Show log level distribution
        print("Log Level Distribution:")
        level_counts = cleaned_df["level"].value_counts()
        for level, count in level_counts.items():
            percentage = round(count / len(cleaned_df) * 100, 1)
            print(f"  {level.upper()}: {count} ({percentage}%)")
    
    print()
    print("=" * 60)
    print("Preprocessing complete. Ready for AI model training.")
    print("=" * 60)
    
    # Cleanup
    close_connection()


if __name__ == "__main__":
    main()
