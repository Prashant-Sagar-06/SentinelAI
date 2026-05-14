from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    GROK_API_KEY: str
    GROK_API_URL: str = "https://api.groq.com/openai/v1"
    GROK_MODEL: str = "llama3-8b-8192"

    # AWS S3 (for logs)
    AWS_ACCESS_KEY: str
    AWS_SECRET_KEY: str
    S3_BUCKET: str

    class Config:
        env_file = ".env"

settings = Settings()