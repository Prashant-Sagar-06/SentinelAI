import httpx
from app.config import settings

HEADERS = {
    "Authorization": f"Bearer {settings.GROK_API_KEY}",
    "Content-Type":  "application/json",
}

# ── Core Grok caller ──────────────────────────────────────────────────
async def call_grok(system_prompt: str, user_message: str) -> str:
    payload = {
        "model": settings.GROK_MODEL,
        "messages": [
            {"role": "system",  "content": system_prompt},
            {"role": "user",    "content": user_message},
        ],
        "max_tokens": 1024,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.GROK_API_URL}/chat/completions",
            headers=HEADERS,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

# ── 1. Root Cause Analysis ────────────────────────────────────────────
async def analyze_incident(title: str, description: str, server_name: str) -> str:
    system = (
        "You are Sentinel AI, an expert DevOps assistant. "
        "Analyze infrastructure incidents and explain the root cause clearly. "
        "Be concise and actionable. Always suggest a fix."
    )
    message = (
        f"Server: {server_name}\n"
        f"Incident: {title}\n"
        f"Details: {description}\n\n"
        "What is the root cause and how should this be fixed?"
    )
    return await call_grok(system, message)

# ── 2. Log Explanation ────────────────────────────────────────────────
async def explain_logs(log_text: str, server_name: str) -> str:
    system = (
        "You are Sentinel AI. You read raw server logs and explain what happened "
        "in plain English. Highlight errors, warnings, and suspicious patterns. "
        "Be brief and clear."
    )
    message = (
        f"Server: {server_name}\n"
        f"Logs:\n{log_text[:3000]}\n\n"   # cap at 3000 chars to save tokens
        "Explain what happened in these logs."
    )
    return await call_grok(system, message)

# ── 3. Chat Assistant ─────────────────────────────────────────────────
async def chat(message: str, server_name: str = None) -> str:
    system = (
        "You are Sentinel AI, an intelligent infrastructure monitoring assistant. "
        "Answer questions about server health, incidents, metrics, and DevOps best practices. "
        "Be helpful and concise."
    )
    context = f"Server context: {server_name}\n" if server_name else ""
    return await call_grok(system, context + message)

# ── 4. Recommendations ────────────────────────────────────────────────
async def recommend(
    server_name:    str,
    cpu_avg:        float,
    memory_avg:     float,
    disk_avg:       float,
    incident_count: int
) -> str:
    system = (
        "You are Sentinel AI. Based on server metrics and incident history, "
        "provide 3-5 clear, prioritized recommendations to improve stability and performance. "
        "Be specific and practical."
    )
    message = (
        f"Server: {server_name}\n"
        f"Average CPU:    {cpu_avg:.1f}%\n"
        f"Average Memory: {memory_avg:.1f}%\n"
        f"Average Disk:   {disk_avg:.1f}%\n"
        f"Open incidents: {incident_count}\n\n"
        "What should I do to improve this server's health?"
    )
    return await call_grok(system, message)
