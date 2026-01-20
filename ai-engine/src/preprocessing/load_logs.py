"""
SentinelAI AI Engine - Log Loading Module
==========================================

This module is responsible for loading raw logs from MongoDB and converting
them into a pandas DataFrame for further preprocessing and AI analysis.

The DataFrame format is chosen because:
1. Pandas provides efficient data manipulation for large datasets
2. Easy integration with scikit-learn and TensorFlow/PyTorch
3. Built-in handling of missing values and data type conversions
4. Powerful grouping and aggregation for feature engineering
"""

import pandas as pd
from typing import Optional
from src.utils.db import fetch_logs


def load_logs_as_dataframe(minutes: int = 60) -> pd.DataFrame:
    """
    Load logs from MongoDB and convert to a pandas DataFrame.
    
    This function fetches logs from the database and structures them into
    a DataFrame with standardized column names. This standardization ensures
    consistent data format for downstream AI preprocessing.
    
    Args:
        minutes: Number of minutes to look back for logs (default: 60)
    
    Returns:
        pandas DataFrame with columns:
            - timestamp: When the log event occurred
            - level: Log severity (info, warn, error)
            - message: The log message content
            - service: Service that generated the log
            - metadata: Additional contextual data (as dict)
        
        Returns an empty DataFrame with correct columns if no logs are found.
    
    Example:
        >>> df = load_logs_as_dataframe(minutes=120)
        >>> print(df.head())
        >>> print(f"Loaded {len(df)} log entries")
    """
    # Define the expected columns for the DataFrame
    # This ensures consistent structure even when no data is returned
    expected_columns = ["timestamp", "level", "message", "service", "metadata"]
    
    # Fetch raw logs from MongoDB
    raw_logs = fetch_logs(minutes=minutes)
    
    # Handle empty dataset gracefully
    if not raw_logs:
        print("[WARN] No logs found - returning empty DataFrame")
        return pd.DataFrame(columns=expected_columns)
    
    # Convert list of dictionaries to DataFrame
    df = pd.DataFrame(raw_logs)
    
    # Select and rename columns to ensure consistent naming
    # MongoDB may include _id and other fields we don't need for AI processing
    column_mapping = {
        "timestamp": "timestamp",
        "level": "level",
        "message": "message",
        "service": "service",
        "metadata": "metadata"
    }
    
    # Filter to only include columns that exist in the data
    available_columns = [col for col in column_mapping.keys() if col in df.columns]
    
    # Select only the columns we need
    df = df[available_columns].copy()
    
    # Ensure all expected columns exist (fill missing with defaults)
    for col in expected_columns:
        if col not in df.columns:
            if col == "metadata":
                df[col] = [{}] * len(df)
            elif col == "timestamp":
                df[col] = pd.NaT
            else:
                df[col] = ""
    
    # Reorder columns to match expected order
    df = df[expected_columns]
    
    # Convert timestamp to datetime if it's not already
    if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    
    print(f"[INFO] Loaded {len(df)} logs into DataFrame")
    print(f"[INFO] Log level distribution: {df['level'].value_counts().to_dict()}")
    
    return df
