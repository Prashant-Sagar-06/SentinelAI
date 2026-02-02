"""
SentinelAI AI Engine - Main Entry Point
========================================

This is the main entry script for the SentinelAI AI Engine.
It runs the complete log analysis pipeline including:
1. Log ingestion from MongoDB
2. Text preprocessing and cleaning
3. TF-IDF vectorization
4. Autoencoder training
5. Anomaly detection

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
   
   Create .env file and set:
       MONGODB_URI=mongodb://localhost:27017/sentinelai_logs
   
   For MongoDB Atlas, use:
       MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/sentinelai_logs

4. Run the script:
   
       python main.py

=== PIPELINE STAGES ===

Stage 1: Data Ingestion
    - Connect to MongoDB
    - Fetch logs from specified time window
    - Load into pandas DataFrame

Stage 2: Preprocessing
    - Clean and normalize log messages
    - Remove noise (numbers, special characters)
    - Prepare text for vectorization

Stage 3: Vectorization
    - Convert text to TF-IDF vectors
    - Create numerical representation for ML

Stage 4: Anomaly Detection
    - Train autoencoder on log vectors
    - Compute reconstruction errors
    - Flag anomalous logs based on threshold

Stage 5: Results
    - Display anomaly statistics
    - Show sample anomalous log messages
"""

import os
import sys
import warnings

# Suppress TensorFlow warnings for cleaner output
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
warnings.filterwarnings('ignore', category=DeprecationWarning)

# Add the project root to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import numpy as np
import pandas as pd

from src.preprocessing.load_logs import load_logs_as_dataframe
from src.preprocessing.clean_logs import clean_logs, get_cleaning_stats
from src.preprocessing.vectorize_logs import vectorize_logs
from src.analysis.anomaly_detection import run_anomaly_detection
from src.analysis.root_cause_analysis import analyze_root_causes
from src.analysis.explanation_utils import format_explanation_report
from src.utils.db import close_connection
from src.utils.persist import persist_analysis_results


def main():
    """
    Main entry point for the SentinelAI AI Engine.
    
    Orchestrates the complete anomaly detection pipeline:
    1. Load logs from MongoDB
    2. Clean and preprocess
    3. Vectorize with TF-IDF
    4. Train autoencoder and detect anomalies
    5. Display results
    """
    print("=" * 70)
    print("   SentinelAI AI Engine - Log Anomaly Detection Pipeline")
    print("=" * 70)
    print()
    
    # ==================== CONFIGURATION ====================
    LOOKBACK_MINUTES = 525600 * 20  # Time window for log fetching (20 years - includes historical HDFS logs)
    TRAINING_EPOCHS = 50         # Autoencoder training epochs
    ANOMALY_PERCENTILE = 95.0    # Threshold percentile (95 = top 5% are anomalies)
    MIN_LOGS_REQUIRED = 10       # Minimum logs needed for training
    
    print("[CONFIG] Pipeline Configuration:")
    print(f"         - Lookback window: {LOOKBACK_MINUTES} minutes")
    print(f"         - Training epochs: {TRAINING_EPOCHS}")
    print(f"         - Anomaly threshold: {ANOMALY_PERCENTILE}th percentile")
    print()
    
    # ==================== STAGE 1: DATA INGESTION ====================
    print("=" * 70)
    print("[STAGE 1] Data Ingestion - Loading logs from MongoDB")
    print("=" * 70)
    
    raw_df = load_logs_as_dataframe(minutes=LOOKBACK_MINUTES)
    
    if raw_df.empty:
        print("\n[ERROR] No logs found. Please ensure:")
        print("        1. MongoDB is running and accessible")
        print("        2. MONGODB_URI is correctly configured in .env")
        print("        3. The demo app has generated logs recently")
        print("\nExiting pipeline.")
        close_connection()
        return
    
    print(f"\n[INFO] Loaded {len(raw_df)} logs from database")
    print()
    
    # ==================== STAGE 2: PREPROCESSING ====================
    print("=" * 70)
    print("[STAGE 2] Preprocessing - Cleaning and normalizing logs")
    print("=" * 70)
    
    cleaned_df = clean_logs(raw_df)
    stats = get_cleaning_stats(raw_df, cleaned_df)
    
    print(f"\n[INFO] Preprocessing Results:")
    print(f"       - Original logs: {stats['original_count']}")
    print(f"       - Cleaned logs: {stats['cleaned_count']}")
    print(f"       - Removed: {stats['removed_count']} ({stats['removal_rate']}%)")
    
    if len(cleaned_df) < MIN_LOGS_REQUIRED:
        print(f"\n[ERROR] Insufficient data for training. Need at least {MIN_LOGS_REQUIRED} logs.")
        print(f"        Current count: {len(cleaned_df)}")
        print("\nExiting pipeline.")
        close_connection()
        return
    
    print()
    
    # ==================== STAGE 3: VECTORIZATION ====================
    print("=" * 70)
    print("[STAGE 3] Vectorization - Converting text to TF-IDF vectors")
    print("=" * 70)
    
    vectors, vectorizer = vectorize_logs(cleaned_df, message_column="message")
    
    if vectors.size == 0:
        print("\n[ERROR] Vectorization failed - no vectors produced")
        close_connection()
        return
    
    print(f"\n[INFO] Vectorization Results:")
    print(f"       - Vector shape: {vectors.shape}")
    print(f"       - Vocabulary size: {vectorizer.get_vector_dimension()}")
    print()
    
    # ==================== STAGE 4: ANOMALY DETECTION ====================
    print("=" * 70)
    print("[STAGE 4] Anomaly Detection - Training autoencoder")
    print("=" * 70)
    print()
    
    # Run the anomaly detection pipeline
    detector, results, summary = run_anomaly_detection(
        vectors=vectors,
        epochs=TRAINING_EPOCHS,
        percentile=ANOMALY_PERCENTILE,
        verbose=1  # Show training progress
    )
    
    # ==================== STAGE 5: RESULTS ====================
    print()
    print("=" * 70)
    print("[STAGE 5] Results - Anomaly Detection Summary")
    print("=" * 70)
    
    print(f"\n{'─' * 50}")
    print("DETECTION STATISTICS")
    print(f"{'─' * 50}")
    print(f"  Total logs processed:    {summary['total_logs']}")
    print(f"  Normal logs:             {summary['normal_count']}")
    print(f"  Anomalous logs:          {summary['anomaly_count']}")
    print(f"  Anomaly rate:            {summary['anomaly_rate'] * 100:.2f}%")
    print(f"{'─' * 50}")
    print(f"  Threshold:               {summary['threshold']:.6f}")
    print(f"  Mean reconstruction error: {summary['mean_error']:.6f}")
    print(f"  Max reconstruction error:  {summary['max_error']:.6f}")
    print(f"{'─' * 50}")
    
    # Add anomaly flags to DataFrame for analysis
    cleaned_df = cleaned_df.copy()
    cleaned_df['reconstruction_error'] = results['errors']
    cleaned_df['is_anomaly'] = results['is_anomaly']
    cleaned_df['anomaly_score'] = results['anomaly_scores']
    
    # Display anomalous logs
    anomalous_logs = cleaned_df[cleaned_df['is_anomaly'] == True]
    
    if len(anomalous_logs) > 0:
        print(f"\n{'─' * 50}")
        print("SAMPLE ANOMALOUS LOGS")
        print(f"{'─' * 50}")
        
        # Show top anomalies (highest reconstruction error)
        top_anomalies = anomalous_logs.nlargest(5, 'reconstruction_error')
        
        for idx, (_, row) in enumerate(top_anomalies.iterrows(), 1):
            level = str(row.get('level', 'unknown')).upper()
            message = row.get('message', '')[:70]
            score = row.get('anomaly_score', 0)
            error = row.get('reconstruction_error', 0)
            
            print(f"\n  Anomaly #{idx}:")
            print(f"    Level:   [{level}]")
            print(f"    Message: {message}...")
            print(f"    Score:   {score:.3f} (error: {error:.6f})")
        
        # Show log level distribution for anomalies
        print(f"\n{'─' * 50}")
        print("ANOMALY LOG LEVEL DISTRIBUTION")
        print(f"{'─' * 50}")
        
        level_dist = anomalous_logs['level'].value_counts()
        for level, count in level_dist.items():
            pct = count / len(anomalous_logs) * 100
            print(f"  {level.upper()}: {count} ({pct:.1f}%)")
    else:
        print("\n[INFO] No anomalies detected in the current log batch.")
        print("       This could mean:")
        print("       - All logs are normal")
        print("       - Threshold is too high")
        print("       - More diverse log data is needed for training")
    
    # ==================== STAGE 6: ROOT CAUSE ANALYSIS ====================
    # Initialize root_causes for use in stage 7 (persistence)
    root_causes = []
    
    if len(anomalous_logs) > 0:
        print()
        print("=" * 70)
        print("[STAGE 6] Root Cause Analysis - Identifying underlying causes")
        print("=" * 70)
        
        root_causes, _ = analyze_root_causes(cleaned_df, time_window_minutes=2)
        
        if len(root_causes) > 0:
            print(f"\n{'─' * 50}")
            print("ROOT CAUSE ANALYSIS RESULTS")
            print(f"{'─' * 50}")
            print(f"Identified {len(root_causes)} root cause(s):\n")
            
            for idx, root_cause in enumerate(root_causes, 1):
                print(f"\n{idx}. ROOT CAUSE #{idx}")
                print(f"   {'─' * 46}")
                
                # Display structured data
                service = root_cause.get('root_cause_service', 'unknown')
                confidence = root_cause.get('confidence_score', 0)
                affected = root_cause.get('affected_services', [])
                count = root_cause.get('anomaly_count', 0)
                
                print(f"   Service:         {service}")
                print(f"   Confidence:      {confidence * 100:.1f}%")
                print(f"   Affected services: {', '.join(affected) if affected else 'N/A'}")
                print(f"   Anomaly count:   {count}")
                print(f"\n   Root Cause Message:")
                message = root_cause.get('root_cause_message', 'Unknown cause')
                for line in message.split('\n'):
                    print(f"   {line}")
                
                # Display explanations if available
                explanations = root_cause.get('explanations', {})
                if explanations:
                    print(f"\n   Analysis:")
                    if 'root_cause' in explanations:
                        print(f"   - Root Cause: {explanations['root_cause'][:100]}...")
                    if 'timeline' in explanations:
                        print(f"   - Timeline: {explanations['timeline'][:100]}...")
        else:
            print("\n[INFO] No root causes could be identified.")
            print("       This may indicate isolated anomalies rather than cascading failures.")
    else:
        print("\n[STAGE 6 SKIPPED] Root cause analysis requires at least one anomaly.")
    
    # ==================== STAGE 7: PERSISTENCE ====================
    # WHY PERSIST?
    # - Enable other systems (APIs, dashboards) to query results
    # - Track anomalies and root causes over time
    # - Support alerting and notification systems
    # - Provide audit trail for detected issues
    
    print()
    print("=" * 70)
    print("[STAGE 7] Persistence - Saving results to MongoDB")
    print("=" * 70)
    
    # Persist results only if we have data to save
    if len(anomalous_logs) > 0 or len(root_causes) > 0:
        persist_results = persist_analysis_results(
            anomaly_df=cleaned_df,
            root_causes=root_causes
        )
        
        print(f"\n{'─' * 50}")
        print("PERSISTENCE SUMMARY")
        print(f"{'─' * 50}")
        print(f"  Anomalies persisted:    {persist_results['anomalies'][0]}")
        print(f"  Root causes persisted:  {persist_results['root_causes'][0]}")
        print(f"{'─' * 50}")
    else:
        print("\n[STAGE 7 SKIPPED] No anomalies or root causes to persist.")
    
    # ==================== CLEANUP ====================
    print()
    print("=" * 70)
    print("   Pipeline Complete")
    print("=" * 70)
    print()
    print("[INFO] Results are now persisted to MongoDB:")
    print("       - 'anomalies' collection: Detected anomalous logs")
    print("       - 'root_causes' collection: Root cause analysis insights")
    print()
    print("[INFO] Next steps:")
    print("       - Query results via MongoDB Compass or APIs")
    print("       - Create API endpoints for real-time access")
    print("       - Integrate with dashboard for visualization")
    print()
    
    close_connection()


if __name__ == "__main__":
    main()
