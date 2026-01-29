"""
SentinelAI AI Engine - Anomaly Detection Module
================================================

This module implements anomaly detection using autoencoder reconstruction error.
It identifies logs that deviate from normal patterns learned by the model.

=== HOW RECONSTRUCTION-BASED ANOMALY DETECTION WORKS ===

1. TRAINING PHASE:
   - Autoencoder is trained on log data (assumed mostly normal)
   - Model learns to compress and reconstruct normal patterns
   - Normal logs have LOW reconstruction error

2. DETECTION PHASE:
   - Pass all logs through the trained autoencoder
   - Compute reconstruction error for each log
   - High error = log is different from what model learned = anomaly

3. THRESHOLD DETERMINATION:
   - Use statistical methods to set anomaly threshold
   - Common approach: percentile-based (e.g., 95th percentile)
   - Logs with error above threshold are flagged as anomalies

=== WHY PERCENTILE-BASED THRESHOLDING? ===

- Adapts to the data distribution automatically
- No manual tuning required
- 95th percentile means ~5% of logs will be flagged
- Can adjust sensitivity by changing percentile:
  - Lower percentile (e.g., 90%) = more sensitive, more anomalies
  - Higher percentile (e.g., 99%) = less sensitive, fewer anomalies

=== FUTURE ENHANCEMENTS ===

- Dynamic thresholding based on time windows
- Multiple threshold levels (warning vs critical)
- Root cause analysis for detected anomalies
- Feedback loop for false positive reduction
"""

import numpy as np
import pandas as pd
from typing import Tuple, Dict, Optional
from src.models.autoencoder import LogAutoencoder


def compute_reconstruction_error(
    original: np.ndarray,
    reconstructed: np.ndarray,
    method: str = "mse"
) -> np.ndarray:
    """
    Compute reconstruction error between original and reconstructed vectors.
    
    Args:
        original: Original input vectors (n_samples, n_features)
        reconstructed: Reconstructed vectors from autoencoder
        method: Error computation method:
                - "mse": Mean Squared Error (default, most common)
                - "mae": Mean Absolute Error (less sensitive to outliers)
                - "cosine": Cosine distance (good for sparse vectors)
    
    Returns:
        Array of reconstruction errors (one per sample)
    """
    if original.shape != reconstructed.shape:
        raise ValueError(f"Shape mismatch: {original.shape} vs {reconstructed.shape}")
    
    if method == "mse":
        # Mean Squared Error per sample
        errors = np.mean((original - reconstructed) ** 2, axis=1)
    
    elif method == "mae":
        # Mean Absolute Error per sample
        errors = np.mean(np.abs(original - reconstructed), axis=1)
    
    elif method == "cosine":
        # Cosine distance (1 - cosine similarity)
        dot_product = np.sum(original * reconstructed, axis=1)
        norm_original = np.linalg.norm(original, axis=1)
        norm_reconstructed = np.linalg.norm(reconstructed, axis=1)
        
        # Avoid division by zero
        denominator = norm_original * norm_reconstructed
        denominator = np.where(denominator == 0, 1e-10, denominator)
        
        cosine_similarity = dot_product / denominator
        errors = 1 - cosine_similarity
    
    else:
        raise ValueError(f"Unknown method: {method}. Use 'mse', 'mae', or 'cosine'")
    
    return errors


def calculate_threshold(
    errors: np.ndarray,
    percentile: float = 95.0,
    method: str = "percentile"
) -> float:
    """
    Calculate the anomaly threshold from reconstruction errors.
    
    Args:
        errors: Array of reconstruction errors
        percentile: Percentile to use for threshold (default: 95)
                    Higher = fewer anomalies, Lower = more anomalies
        method: Thresholding method:
                - "percentile": Use specified percentile of errors
                - "std": Mean + N standard deviations
    
    Returns:
        Threshold value for anomaly classification
    """
    if len(errors) == 0:
        return 0.0
    
    if method == "percentile":
        threshold = np.percentile(errors, percentile)
    
    elif method == "std":
        # Use mean + 2 standard deviations (approx 95th percentile for normal dist)
        mean = np.mean(errors)
        std = np.std(errors)
        threshold = mean + 2 * std
    
    else:
        raise ValueError(f"Unknown method: {method}")
    
    return float(threshold)


def detect_anomalies(
    errors: np.ndarray,
    threshold: float
) -> np.ndarray:
    """
    Flag samples as anomalous based on reconstruction error threshold.
    
    Args:
        errors: Array of reconstruction errors
        threshold: Anomaly threshold
    
    Returns:
        Boolean array where True = anomaly
    """
    return errors > threshold


class AnomalyDetector:
    """
    High-level anomaly detection using trained autoencoder.
    
    This class orchestrates the full anomaly detection pipeline:
    1. Train autoencoder on log vectors
    2. Compute reconstruction errors
    3. Determine threshold
    4. Classify logs as normal/anomalous
    """
    
    def __init__(
        self,
        percentile_threshold: float = 95.0,
        error_method: str = "mse"
    ):
        """
        Initialize the anomaly detector.
        
        Args:
            percentile_threshold: Percentile for anomaly threshold (default: 95)
            error_method: Method for computing reconstruction error
        """
        self.percentile_threshold = percentile_threshold
        self.error_method = error_method
        self.autoencoder: Optional[LogAutoencoder] = None
        self.threshold: Optional[float] = None
        self.training_errors: Optional[np.ndarray] = None
    
    def fit(
        self,
        X: np.ndarray,
        epochs: int = 50,
        batch_size: int = 32,
        verbose: int = 1
    ):
        """
        Train the anomaly detector on log vectors.
        
        Args:
            X: Training vectors (TF-IDF from logs)
            epochs: Training epochs for autoencoder
            batch_size: Batch size for training
            verbose: Verbosity level
        """
        if X.shape[0] == 0:
            raise ValueError("Cannot train on empty data")
        
        input_dim = X.shape[1]
        
        # Create and train autoencoder
        self.autoencoder = LogAutoencoder(input_dim=input_dim)
        self.autoencoder.train(X, epochs=epochs, batch_size=batch_size, verbose=verbose)
        
        # Compute reconstruction errors on training data
        reconstructed = self.autoencoder.predict(X)
        self.training_errors = compute_reconstruction_error(
            X, reconstructed, method=self.error_method
        )
        
        # Calculate threshold from training errors
        self.threshold = calculate_threshold(
            self.training_errors,
            percentile=self.percentile_threshold
        )
        
        print(f"\n[INFO] Anomaly detection training complete:")
        print(f"       Threshold ({self.percentile_threshold}th percentile): {self.threshold:.6f}")
        print(f"       Training error - Mean: {np.mean(self.training_errors):.6f}, "
              f"Std: {np.std(self.training_errors):.6f}")
    
    def predict(self, X: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Detect anomalies in log vectors.
        
        Args:
            X: Log vectors to analyze
        
        Returns:
            Dictionary containing:
            - 'errors': Reconstruction errors for each sample
            - 'is_anomaly': Boolean flags (True = anomaly)
            - 'anomaly_scores': Normalized anomaly scores (0-1)
        """
        if self.autoencoder is None or self.threshold is None:
            raise RuntimeError("Detector not trained. Call fit() first.")
        
        # Reconstruct and compute errors
        reconstructed = self.autoencoder.predict(X)
        errors = compute_reconstruction_error(X, reconstructed, method=self.error_method)
        
        # Classify as anomalous
        is_anomaly = detect_anomalies(errors, self.threshold)
        
        # Compute normalized anomaly scores (0-1 range)
        # Score > 1 means error is above threshold
        anomaly_scores = errors / self.threshold if self.threshold > 0 else errors
        
        return {
            'errors': errors,
            'is_anomaly': is_anomaly,
            'anomaly_scores': anomaly_scores
        }
    
    def get_anomaly_summary(self, results: Dict[str, np.ndarray]) -> Dict:
        """
        Generate summary statistics for anomaly detection results.
        
        Args:
            results: Output from predict()
        
        Returns:
            Dictionary with summary statistics
        """
        total = len(results['is_anomaly'])
        anomaly_count = np.sum(results['is_anomaly'])
        normal_count = total - anomaly_count
        
        return {
            'total_logs': total,
            'anomaly_count': int(anomaly_count),
            'normal_count': int(normal_count),
            'anomaly_rate': float(anomaly_count / total) if total > 0 else 0.0,
            'threshold': self.threshold,
            'mean_error': float(np.mean(results['errors'])),
            'max_error': float(np.max(results['errors'])),
            'min_error': float(np.min(results['errors']))
        }


def run_anomaly_detection(
    vectors: np.ndarray,
    epochs: int = 50,
    percentile: float = 95.0,
    verbose: int = 1
) -> Tuple[AnomalyDetector, Dict[str, np.ndarray], Dict]:
    """
    Convenience function to run the full anomaly detection pipeline.
    
    Args:
        vectors: TF-IDF vectors from log messages
        epochs: Training epochs
        percentile: Threshold percentile
        verbose: Verbosity level
    
    Returns:
        Tuple of (detector, results, summary)
    """
    # Create and train detector
    detector = AnomalyDetector(percentile_threshold=percentile)
    detector.fit(vectors, epochs=epochs, verbose=verbose)
    
    # Detect anomalies
    results = detector.predict(vectors)
    
    # Get summary
    summary = detector.get_anomaly_summary(results)
    
    return detector, results, summary
