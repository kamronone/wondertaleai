"""Vercel FastAPI entrypoint for WonderTale private preview.

Secrets and the Neon branch connection are server-side environment variables.
This entrypoint intentionally exposes no static frontend.
"""
from secure_main import app

__all__=["app"]
