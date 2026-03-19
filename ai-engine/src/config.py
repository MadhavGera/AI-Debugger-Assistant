import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str = ""
    deepseek_api_key: str = ""

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8001

    # Git clone
    clone_base: str = "/tmp/repos"
    max_file_size_kb: int = 500

    # LLM settings
    primary_model: str = "gpt-4.1"
    fallback_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    max_chunks_per_query: int = 8
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Server
    env: str = "production"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
