"""
SentinelAI AI Engine - Log Vectorization Module
================================================

This module converts cleaned text log messages into numerical vectors
that can be processed by machine learning models.

=== WHY VECTORIZATION IS REQUIRED ===

Machine learning models, including neural networks like autoencoders,
can only process numerical data. Text logs must be converted to numbers.

There are several approaches to text vectorization:

1. BAG OF WORDS (BoW):
   - Counts word occurrences in each document
   - Simple but ignores word importance
   - Results in sparse, high-dimensional vectors

2. TF-IDF (Term Frequency - Inverse Document Frequency):
   - Weighs words by their importance in the corpus
   - Common words (like "the", "is") get lower weights
   - Rare, meaningful words get higher weights
   - Better for anomaly detection than raw counts

3. WORD EMBEDDINGS (Word2Vec, GloVe):
   - Captures semantic relationships between words
   - Dense, lower-dimensional vectors
   - Requires pre-trained models or large training data

4. TRANSFORMER EMBEDDINGS (BERT, etc.):
   - State-of-the-art semantic understanding
   - Computationally expensive
   - Overkill for log analysis

=== WHY WE CHOSE TF-IDF ===

For log anomaly detection, TF-IDF is ideal because:
- Logs have a relatively small, domain-specific vocabulary
- We want to emphasize unusual words (potential anomaly indicators)
- It's computationally efficient for real-time analysis
- Works well with autoencoders for reconstruction-based detection

The autoencoder will learn to reconstruct "normal" TF-IDF vectors.
Anomalous logs will have higher reconstruction error because they
contain unusual word patterns the model hasn't learned.
"""

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from typing import Tuple, Optional
import pickle
import os


class LogVectorizer:
    """
    Converts log messages to TF-IDF vectors for ML processing.
    
    This class wraps scikit-learn's TfidfVectorizer with settings
    optimized for log analysis and anomaly detection.
    """
    
    def __init__(self, max_features: int = 1000, min_df: int = 1, max_df: float = 0.95):
        """
        Initialize the log vectorizer.
        
        Args:
            max_features: Maximum vocabulary size. Limits dimensionality to
                          prevent overfitting and reduce computation.
                          Default 1000 works well for most log datasets.
            
            min_df: Minimum document frequency. Words appearing in fewer
                    documents are ignored (likely typos or rare errors).
            
            max_df: Maximum document frequency (as proportion). Words appearing
                    in more than 95% of documents are too common to be useful.
        """
        self.max_features = max_features
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            min_df=min_df,
            max_df=max_df,
            # Use unigrams and bigrams to capture phrases like "connection failed"
            ngram_range=(1, 2),
            # Normalize vectors to unit length for consistent comparison
            norm='l2',
            # Use sublinear TF scaling to reduce impact of word frequency
            sublinear_tf=True
        )
        self.is_fitted = False
    
    def fit_transform(self, messages: pd.Series) -> np.ndarray:
        """
        Fit the vectorizer on messages and transform them to vectors.
        
        This should be called once on the training data. The vectorizer
        learns the vocabulary from these messages.
        
        Args:
            messages: pandas Series of cleaned log messages
        
        Returns:
            NumPy array of shape (n_samples, n_features) containing
            TF-IDF vectors for each log message.
        """
        if messages.empty:
            print("[WARN] Empty message series provided")
            return np.array([])
        
        # Convert to list and handle any remaining NaN values
        message_list = messages.fillna("").astype(str).tolist()
        
        # Fit and transform
        vectors = self.vectorizer.fit_transform(message_list)
        self.is_fitted = True
        
        # Convert sparse matrix to dense array for autoencoder
        # Note: For very large datasets, consider keeping sparse format
        dense_vectors = vectors.toarray()
        
        print(f"[INFO] Vectorization complete:")
        print(f"       - Documents: {dense_vectors.shape[0]}")
        print(f"       - Features (vocabulary size): {dense_vectors.shape[1]}")
        print(f"       - Sparsity: {100 * (1 - np.count_nonzero(dense_vectors) / dense_vectors.size):.1f}%")
        
        return dense_vectors
    
    def transform(self, messages: pd.Series) -> np.ndarray:
        """
        Transform new messages using the fitted vectorizer.
        
        Use this for transforming new/incoming logs after the model
        is trained. The vocabulary is fixed from fit_transform().
        
        Args:
            messages: pandas Series of cleaned log messages
        
        Returns:
            NumPy array of TF-IDF vectors
        """
        if not self.is_fitted:
            raise RuntimeError("Vectorizer not fitted. Call fit_transform() first.")
        
        message_list = messages.fillna("").astype(str).tolist()
        vectors = self.vectorizer.transform(message_list)
        
        return vectors.toarray()
    
    def get_feature_names(self) -> list:
        """
        Get the vocabulary (feature names) learned by the vectorizer.
        
        Useful for interpreting which words contribute to anomalies.
        
        Returns:
            List of words/phrases in the vocabulary
        """
        if not self.is_fitted:
            return []
        return self.vectorizer.get_feature_names_out().tolist()
    
    def get_vector_dimension(self) -> int:
        """
        Get the dimensionality of output vectors.
        
        Returns:
            Number of features (vocabulary size actually used)
        """
        if not self.is_fitted:
            return self.max_features
        return len(self.vectorizer.get_feature_names_out())
    
    def save(self, filepath: str):
        """
        Save the fitted vectorizer to disk.
        
        Args:
            filepath: Path to save the vectorizer (pickle format)
        """
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted vectorizer")
        
        with open(filepath, 'wb') as f:
            pickle.dump(self.vectorizer, f)
        print(f"[INFO] Vectorizer saved to {filepath}")
    
    def load(self, filepath: str):
        """
        Load a previously fitted vectorizer from disk.
        
        Args:
            filepath: Path to the saved vectorizer
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Vectorizer file not found: {filepath}")
        
        with open(filepath, 'rb') as f:
            self.vectorizer = pickle.load(f)
        self.is_fitted = True
        print(f"[INFO] Vectorizer loaded from {filepath}")


def vectorize_logs(df: pd.DataFrame, message_column: str = "message") -> Tuple[np.ndarray, LogVectorizer]:
    """
    Convenience function to vectorize a DataFrame of logs.
    
    Args:
        df: DataFrame containing log messages
        message_column: Name of the column containing messages
    
    Returns:
        Tuple of (feature_matrix, vectorizer_instance)
    """
    if df.empty:
        print("[WARN] Empty DataFrame provided")
        return np.array([]), LogVectorizer()
    
    if message_column not in df.columns:
        raise ValueError(f"Column '{message_column}' not found in DataFrame")
    
    vectorizer = LogVectorizer()
    vectors = vectorizer.fit_transform(df[message_column])
    
    return vectors, vectorizer
