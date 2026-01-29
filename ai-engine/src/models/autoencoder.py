"""
SentinelAI AI Engine - Autoencoder Model
=========================================

This module defines an unsupervised Autoencoder neural network for
learning normal log patterns and detecting anomalies.

=== WHAT IS AN AUTOENCODER? ===

An autoencoder is a neural network that learns to compress data into
a smaller representation (encoding) and then reconstruct the original
data from that compressed form (decoding).

Structure:
    Input → [Encoder] → Bottleneck → [Decoder] → Output
    
    - Encoder: Compresses input to lower-dimensional representation
    - Bottleneck: Smallest layer, captures essential features
    - Decoder: Reconstructs input from compressed representation

=== WHY AUTOENCODERS FOR ANOMALY DETECTION? ===

1. UNSUPERVISED LEARNING:
   - No labeled data needed (we don't need to know what's "anomalous")
   - The model learns what "normal" looks like from the data itself

2. RECONSTRUCTION-BASED DETECTION:
   - Train on normal logs → model learns normal patterns
   - Anomalous logs are poorly reconstructed (high error)
   - Reconstruction error = anomaly score

3. PATTERN COMPRESSION:
   - The bottleneck forces the model to learn the most important features
   - Normal logs share common patterns → easy to compress
   - Anomalies have unique patterns → hard to compress

=== ARCHITECTURE DECISIONS ===

1. INPUT SIZE:
   - Matches the TF-IDF vector dimension (typically 500-1000)
   - Flexible to accommodate different vocabulary sizes

2. ENCODER LAYERS:
   - Progressively smaller layers (e.g., 512 → 256 → 128)
   - Forces compression of information
   - ReLU activation for non-linearity

3. BOTTLENECK:
   - Smallest layer (e.g., 64 neurons)
   - Captures the "essence" of normal log patterns
   - Too small = underfitting, too large = overfitting

4. DECODER LAYERS:
   - Mirror of encoder (128 → 256 → 512)
   - Symmetric architecture works best for reconstruction

5. OUTPUT LAYER:
   - Sigmoid activation (outputs 0-1 range)
   - Matches TF-IDF values (which are also 0-1 after normalization)

6. LOSS FUNCTION:
   - Mean Squared Error (MSE)
   - Measures reconstruction quality
   - Lower MSE = better reconstruction = more "normal"
"""

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model, regularizers
from typing import Tuple, Optional


def build_autoencoder(
    input_dim: int,
    encoding_layers: list = [512, 256, 128],
    bottleneck_dim: int = 64,
    dropout_rate: float = 0.2,
    l2_reg: float = 0.001
) -> Tuple[Model, Model, Model]:
    """
    Build an autoencoder model for log anomaly detection.
    
    The architecture is symmetric:
    Input → Encoder → Bottleneck → Decoder → Output
    
    Args:
        input_dim: Dimension of input vectors (TF-IDF feature count)
        
        encoding_layers: List of layer sizes for encoder.
                         Decoder will mirror this in reverse.
                         Default: [512, 256, 128] for gradual compression.
        
        bottleneck_dim: Size of the bottleneck (latent) layer.
                        Smaller = more compression = stricter normal definition.
                        Default: 64 works well for log data.
        
        dropout_rate: Dropout for regularization (prevents overfitting).
                      Default: 0.2 (20% of neurons dropped during training)
        
        l2_reg: L2 regularization strength.
                Penalizes large weights to prevent overfitting.
    
    Returns:
        Tuple of (autoencoder, encoder, decoder) models:
        - autoencoder: Full model for training and inference
        - encoder: Just the encoding part (input → bottleneck)
        - decoder: Just the decoding part (bottleneck → output)
    """
    
    # ==================== ENCODER ====================
    # Takes input and compresses to bottleneck
    
    encoder_input = layers.Input(shape=(input_dim,), name="encoder_input")
    x = encoder_input
    
    # Build encoder layers with decreasing sizes
    for i, units in enumerate(encoding_layers):
        x = layers.Dense(
            units,
            activation='relu',
            kernel_regularizer=regularizers.l2(l2_reg),
            name=f"encoder_dense_{i}"
        )(x)
        # Batch normalization for stable training
        x = layers.BatchNormalization(name=f"encoder_bn_{i}")(x)
        # Dropout for regularization
        x = layers.Dropout(dropout_rate, name=f"encoder_dropout_{i}")(x)
    
    # Bottleneck layer (smallest representation)
    bottleneck = layers.Dense(
        bottleneck_dim,
        activation='relu',
        kernel_regularizer=regularizers.l2(l2_reg),
        name="bottleneck"
    )(x)
    
    # Create encoder model
    encoder = Model(encoder_input, bottleneck, name="encoder")
    
    # ==================== DECODER ====================
    # Takes bottleneck and reconstructs to original dimension
    
    decoder_input = layers.Input(shape=(bottleneck_dim,), name="decoder_input")
    x = decoder_input
    
    # Build decoder layers with increasing sizes (mirror of encoder)
    decoding_layers = encoding_layers[::-1]  # Reverse the encoder layers
    for i, units in enumerate(decoding_layers):
        x = layers.Dense(
            units,
            activation='relu',
            kernel_regularizer=regularizers.l2(l2_reg),
            name=f"decoder_dense_{i}"
        )(x)
        x = layers.BatchNormalization(name=f"decoder_bn_{i}")(x)
        x = layers.Dropout(dropout_rate, name=f"decoder_dropout_{i}")(x)
    
    # Output layer - reconstructs original input
    # Sigmoid activation because TF-IDF values are in [0, 1] range
    decoder_output = layers.Dense(
        input_dim,
        activation='sigmoid',
        name="decoder_output"
    )(x)
    
    # Create decoder model
    decoder = Model(decoder_input, decoder_output, name="decoder")
    
    # ==================== AUTOENCODER ====================
    # Full model: Input → Encoder → Decoder → Output
    
    autoencoder_input = layers.Input(shape=(input_dim,), name="autoencoder_input")
    encoded = encoder(autoencoder_input)
    decoded = decoder(encoded)
    
    autoencoder = Model(autoencoder_input, decoded, name="autoencoder")
    
    # Compile with MSE loss (measures reconstruction quality)
    autoencoder.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='mse',
        metrics=['mae']  # Mean Absolute Error for monitoring
    )
    
    return autoencoder, encoder, decoder


def create_simple_autoencoder(input_dim: int) -> Model:
    """
    Create a simple autoencoder with default settings.
    
    Convenience function for quick experimentation.
    
    Args:
        input_dim: Dimension of input vectors
    
    Returns:
        Compiled autoencoder model
    """
    autoencoder, _, _ = build_autoencoder(input_dim)
    return autoencoder


def get_model_summary(model: Model) -> str:
    """
    Get a string summary of the model architecture.
    
    Args:
        model: Keras model
    
    Returns:
        String representation of model architecture
    """
    summary_lines = []
    model.summary(print_fn=lambda x: summary_lines.append(x))
    return "\n".join(summary_lines)


class LogAutoencoder:
    """
    High-level wrapper for autoencoder-based log anomaly detection.
    
    This class provides a clean interface for training, saving, loading,
    and using the autoencoder model.
    """
    
    def __init__(
        self,
        input_dim: int,
        encoding_layers: list = [512, 256, 128],
        bottleneck_dim: int = 64
    ):
        """
        Initialize the log autoencoder.
        
        Args:
            input_dim: Dimension of input vectors (from vectorizer)
            encoding_layers: Layer sizes for encoder
            bottleneck_dim: Size of bottleneck layer
        """
        self.input_dim = input_dim
        self.autoencoder, self.encoder, self.decoder = build_autoencoder(
            input_dim=input_dim,
            encoding_layers=encoding_layers,
            bottleneck_dim=bottleneck_dim
        )
        self.history = None
    
    def train(
        self,
        X: np.ndarray,
        epochs: int = 50,
        batch_size: int = 32,
        validation_split: float = 0.1,
        verbose: int = 1
    ):
        """
        Train the autoencoder on log vectors.
        
        The model learns to reconstruct "normal" log patterns.
        
        Args:
            X: Training data (TF-IDF vectors)
            epochs: Number of training epochs
            batch_size: Samples per gradient update
            validation_split: Fraction of data for validation
            verbose: Training verbosity (0=silent, 1=progress, 2=one line/epoch)
        
        Returns:
            Training history
        """
        print(f"[INFO] Training autoencoder on {X.shape[0]} samples...")
        print(f"       Input dimension: {X.shape[1]}")
        print(f"       Epochs: {epochs}, Batch size: {batch_size}")
        
        # Early stopping to prevent overfitting
        early_stopping = keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True
        )
        
        self.history = self.autoencoder.fit(
            X, X,  # Input = Target (reconstruction)
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            callbacks=[early_stopping],
            verbose=verbose
        )
        
        return self.history
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Reconstruct log vectors using the trained autoencoder.
        
        Args:
            X: Input vectors to reconstruct
        
        Returns:
            Reconstructed vectors
        """
        return self.autoencoder.predict(X, verbose=0)
    
    def encode(self, X: np.ndarray) -> np.ndarray:
        """
        Get the encoded (bottleneck) representation of logs.
        
        Useful for visualization or clustering.
        
        Args:
            X: Input vectors
        
        Returns:
            Encoded representations
        """
        return self.encoder.predict(X, verbose=0)
    
    def save(self, filepath: str):
        """
        Save the trained model to disk.
        
        Args:
            filepath: Path to save directory
        """
        self.autoencoder.save(filepath)
        print(f"[INFO] Model saved to {filepath}")
    
    def load(self, filepath: str):
        """
        Load a trained model from disk.
        
        Args:
            filepath: Path to saved model
        """
        self.autoencoder = keras.models.load_model(filepath)
        print(f"[INFO] Model loaded from {filepath}")
