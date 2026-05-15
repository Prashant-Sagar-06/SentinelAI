from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class MetricIngest(BaseModel):
    server_name:    str
    cpu_percent:    float
    memory_percent: float
    disk_percent:   float
    net_bytes_sent: float
    net_bytes_recv: float
    recorded_at:    datetime

class MetricResponse(BaseModel):
    id:             UUID
    server_name:    str
    cpu_percent:    float
    memory_percent: float
    disk_percent:   float
    net_bytes_sent: float
    net_bytes_recv: float
    recorded_at:    datetime

    class Config:
        from_attributes = True