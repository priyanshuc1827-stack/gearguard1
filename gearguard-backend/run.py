"""Run entry point: python run.py"""
import os
import uvicorn
from app.core.config import get_settings

if __name__ == "__main__":
    cfg = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=cfg.PORT,
        reload=cfg.ENV == "development",
    )
