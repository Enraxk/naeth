"""Punto de entrada del proceso FastAPI/uvicorn (compose: `uvicorn app.api:app`).

La app principal es el http_app de FastMCP (app/mcp_server.py): un solo proceso sirve el
endpoint MCP en /mcp, las rutas OAuth en raiz (cuando OAUTH_ENABLED) y el visor + CRUD
como custom_route. Asi el discovery OAuth (RFC 8414/9728) queda en la raiz del host, que
es donde claude.ai lo busca (Paso 7 §5).
"""
from __future__ import annotations

from app.mcp_server import app  # noqa: F401  (lo sirve uvicorn)
