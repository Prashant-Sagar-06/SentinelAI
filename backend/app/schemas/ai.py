from pydantic import BaseModel
from typing import Optional

class AnalyzeRequest(BaseModel):
    incident_id: str          # we fetch incident from DB using this

class ExplainLogRequest(BaseModel):
    log_text:    str          # raw log content pasted or sent by agent
    server_name: str

class ChatRequest(BaseModel):
    message:     str          # user's question
    server_name: Optional[str] = None

class RecommendRequest(BaseModel):
    server_name: str

class AIResponse(BaseModel):
    result: str               # Grok's response, always plain text
