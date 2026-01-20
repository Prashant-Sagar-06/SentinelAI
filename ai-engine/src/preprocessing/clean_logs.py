"""
SentinelAI AI Engine - Log Cleaning Module
===========================================

This module handles text preprocessing and cleaning of log messages.
Clean, normalized text is essential for machine learning because:

1. CONSISTENCY: ML models perform better with consistent input formats.
   "ERROR" and "error" should be treated as the same token.

2. NOISE REDUCTION: Numbers, timestamps, and special characters often
   represent instance-specific data (like request IDs, ports, memory addresses)
   that don't generalize well. Removing them helps the model focus on
   meaningful patterns.

3. DIMENSIONALITY: Text normalization reduces the vocabulary size,
   making the feature space more manageable and reducing overfitting.

4. PATTERN DETECTION: For anomaly detection, we want to identify unusual
   MESSAGE PATTERNS, not unusual numbers. A message like "Connection failed
   after 5000ms" and "Connection failed after 3000ms" represent the same
   type of event.

Future AI steps will:
- Tokenize the cleaned messages
- Convert to numerical vectors (TF-IDF, Word2Vec, or embeddings)
- Feed into an autoencoder for anomaly detection
"""

import re
import pandas as pd
from typing import Optional


def normalize_message(message: str) -> str:
    """
    Normalize a single log message for ML processing.
    
    Transformations applied:
    1. Convert to lowercase for consistency
    2. Remove numbers (timestamps, IDs, ports, etc.)
    3. Remove special characters (keep only letters and spaces)
    4. Collapse multiple spaces into single space
    5. Strip leading/trailing whitespace
    
    Args:
        message: Raw log message string
    
    Returns:
        Normalized message string
    
    Example:
        >>> normalize_message("ERROR: Connection failed at 192.168.1.1:5432")
        'error connection failed at'
    """
    if not isinstance(message, str):
        return ""
    
    # Step 1: Convert to lowercase
    text = message.lower()
    
    # Step 2: Remove numbers (including decimals and negative numbers)
    # This removes timestamps, IDs, ports, memory values, etc.
    text = re.sub(r"-?\d+\.?\d*", "", text)
    
    # Step 3: Remove special characters, keep only letters and spaces
    # This removes punctuation, brackets, colons, etc.
    text = re.sub(r"[^a-z\s]", " ", text)
    
    # Step 4: Collapse multiple spaces into single space
    text = re.sub(r"\s+", " ", text)
    
    # Step 5: Strip leading/trailing whitespace
    text = text.strip()
    
    return text


def clean_logs(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and preprocess log messages in the DataFrame.
    
    This function applies text normalization to the message column and
    removes rows that would be useless for ML training (empty messages,
    null values, etc.).
    
    Args:
        df: DataFrame with at least a 'message' column
    
    Returns:
        Cleaned DataFrame with normalized messages.
        Rows with empty/invalid messages are removed.
    
    Example:
        >>> raw_df = load_logs_as_dataframe(minutes=60)
        >>> clean_df = clean_logs(raw_df)
        >>> print(f"Kept {len(clean_df)} of {len(raw_df)} logs after cleaning")
    """
    # Handle empty DataFrame
    if df.empty:
        print("[WARN] Empty DataFrame provided - returning as-is")
        return df.copy()
    
    # Verify required column exists
    if "message" not in df.columns:
        print("[ERROR] DataFrame missing 'message' column")
        return df.copy()
    
    # Create a copy to avoid modifying the original
    cleaned_df = df.copy()
    
    # Track original count for reporting
    original_count = len(cleaned_df)
    
    # Step 1: Apply normalization to all messages
    # Using .apply() for row-wise transformation
    cleaned_df["message"] = cleaned_df["message"].apply(normalize_message)
    
    # Step 2: Remove rows with empty messages after normalization
    # These could be logs that were only numbers/special chars
    cleaned_df = cleaned_df[cleaned_df["message"].str.len() > 0]
    
    # Step 3: Remove rows with null/NaN messages
    cleaned_df = cleaned_df.dropna(subset=["message"])
    
    # Step 4: Remove duplicate consecutive messages (optional deduplication)
    # This helps reduce redundant training data from repeated log spam
    # Keeping this commented for now - can be enabled based on use case
    # cleaned_df = cleaned_df.drop_duplicates(subset=["message"], keep="first")
    
    # Report cleaning results
    removed_count = original_count - len(cleaned_df)
    print(f"[INFO] Cleaned logs: {original_count} -> {len(cleaned_df)} "
          f"({removed_count} rows removed)")
    
    # Reset index after row removal
    cleaned_df = cleaned_df.reset_index(drop=True)
    
    return cleaned_df


def get_cleaning_stats(original_df: pd.DataFrame, cleaned_df: pd.DataFrame) -> dict:
    """
    Generate statistics about the cleaning process.
    
    Useful for monitoring data quality and understanding how much
    data is being filtered out during preprocessing.
    
    Args:
        original_df: DataFrame before cleaning
        cleaned_df: DataFrame after cleaning
    
    Returns:
        Dictionary with cleaning statistics
    """
    stats = {
        "original_count": len(original_df),
        "cleaned_count": len(cleaned_df),
        "removed_count": len(original_df) - len(cleaned_df),
        "removal_rate": 0.0
    }
    
    if stats["original_count"] > 0:
        stats["removal_rate"] = round(
            stats["removed_count"] / stats["original_count"] * 100, 2
        )
    
    return stats
