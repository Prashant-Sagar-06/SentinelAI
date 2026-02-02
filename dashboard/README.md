# SentinelAI Dashboard

AI-Powered Log Intelligence Dashboard - React frontend for visualizing anomaly detection and root cause analysis.

## Features

- 📊 **Dashboard Overview** - Real-time statistics and recent insights
- ⚠️ **Anomaly Detection** - View and filter detected log anomalies
- 🔍 **Root Cause Analysis** - AI-identified root causes with confidence scores
- 🎨 **Professional UI** - Clean, responsive design with score-based color coding

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- SentinelAI FastAPI backend running on `http://localhost:8000`

### Installation

```bash
cd dashboard
npm install
```

### Development

```bash
npm run dev
```

Opens the dashboard at `http://localhost:3000`

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
dashboard/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── DataTable.jsx
│   │   ├── ErrorMessage.jsx
│   │   ├── Loading.jsx
│   │   ├── Navbar.jsx
│   │   ├── ScoreBadge.jsx
│   │   └── StatsCard.jsx
│   ├── hooks/          # Custom React hooks
│   │   ├── useAnomalies.js
│   │   ├── useRootCauses.js
│   │   └── useStats.js
│   ├── pages/          # Page components
│   │   ├── AnomaliesPage.jsx
│   │   ├── DashboardPage.jsx
│   │   └── RootCausesPage.jsx
│   ├── services/       # API client
│   │   └── api.js
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── public/
│   └── favicon.svg
├── index.html
├── package.json
└── vite.config.js
```

## API Integration

The dashboard connects to the SentinelAI FastAPI backend:

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/anomalies` | Fetch detected anomalies |
| `GET /api/v1/root-causes` | Fetch root cause analyses |
| `GET /api/v1/stats` | Fetch dashboard statistics |
| `GET /health` | API health check |

### Environment Variables

Create a `.env` file for custom API URL:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

## Tech Stack

- **React 18** - UI library
- **React Router 6** - Client-side routing
- **Axios** - HTTP client
- **Vite** - Build tool and dev server
- **CSS Modules** - Styling

## License

Part of the SentinelAI project.
