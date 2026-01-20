# SentinelAI - AI-Powered Log Intelligence System

An intelligent log analysis platform that uses machine learning to detect anomalies in application logs in real-time.

## 🏗️ Project Structure

```
SentinelAI/
├── ai-engine/          # Python ML engine for log analysis
│   ├── src/
│   │   ├── preprocessing/  # Log cleaning & normalization
│   │   ├── models/         # ML models (autoencoder)
│   │   ├── analysis/       # Anomaly detection
│   │   └── utils/          # Database utilities
│   ├── notebooks/          # Jupyter notebooks for experiments
│   └── trained_models/     # Saved ML models
│
├── demo-app/           # Node.js demo application
│   └── src/
│       ├── config/         # Logger & database config
│       ├── controllers/    # Request handlers
│       ├── routes/         # API routes
│       ├── middleware/     # Request logging
│       └── services/       # Failure simulation
│
├── ai-service/         # AI inference API (coming soon)
├── backend/            # Main backend service (coming soon)
├── dashboard/          # React dashboard (coming soon)
├── docker/             # Docker configurations
├── docs/               # Documentation
├── scripts/            # Utility scripts
└── shared/             # Shared types & constants
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)

### 1. Demo App Setup

```bash
cd demo-app
npm install
```

Create `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/sentinelai_logs
PORT=3000
```

Run the app:
```bash
node src/index.js
```

### 2. AI Engine Setup

```bash
cd ai-engine
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/sentinelai_logs
```

Run the preprocessing pipeline:
```bash
python main.py
```

## 📡 API Endpoints

### Demo App

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/demo/db-failure` | GET | Simulate DB timeout (ERROR log) |
| `/demo/api-timeout` | GET | Simulate API timeout (ERROR log) |
| `/demo/memory-warning` | GET | Simulate high memory (WARN log) |

## 🔧 Tech Stack

- **Demo App**: Node.js, Express, Winston, Mongoose
- **AI Engine**: Python, pandas, pymongo
- **Database**: MongoDB
- **ML** (coming soon): TensorFlow/PyTorch Autoencoder

## 📝 License

MIT
