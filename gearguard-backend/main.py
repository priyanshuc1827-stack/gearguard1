"""
main.py — GearGuard Backend Entry Point
Directly delegates to the modern v2 FastAPI application in app.main.
"""
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.config import get_settings

if __name__ == "__main__":
    import uvicorn
    cfg = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=cfg.PORT,
        reload=cfg.ENV == "development",
    )
