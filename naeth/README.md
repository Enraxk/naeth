# naeth stack

The runnable stack for `naeth`, which since July 2026 runs as the `memory` module of `cenit`,
a modular self-hosted platform (private for now). For what the system is and why, see the
[root README](../README.md).

## Topology

Data lives in the core Postgres instance (`modules-db`), reached over the external
`cenit-net` network. The local `db` service in this compose file is **not** the source of
truth: it predates the cutover and is kept as a cold rollback.

The module exposes two surfaces on purpose, on separate ports, because they have different
auth needs:

| Service | Port | Auth | Reached by |
|---|---|---|---|
| `api` | `127.0.0.1:8800` | OAuth 2.1 via OIDCProxy against Pocket-ID | agents, publicly as `memory.enraxk.dev` |
| `viewer` | `127.0.0.1:8801` | none in the process itself | me, over loopback and over SSO |

The viewer running without its own auth is deliberate, not an oversight. It is never naked
on the internet: from outside it sits behind forward-auth SSO (oauth2-proxy to Pocket-ID),
and from inside it is loopback only, which is the trusted zone. Splitting them this way is
what allows `/mcp` to keep its own OAuth handshake, which breaks if you put a redirect-based
auth proxy in front of it.

`worker` drains the embedding queue. `test` only runs under its profile.

## Prerequisites

This module does not start standalone. It needs the cenit core up: the shared Postgres, the
identity provider, and the `cenit-net` network.

Credentials are **not** in `.env`. `CENIT_DB_PASSWORD`, `OIDC_CLIENT_ID` and
`OIDC_CLIENT_SECRET` are decrypted from SOPS and injected at start, which is why the compose
file fails loudly if they are missing rather than falling back to a default.

## Running

```powershell
cp .env.example .env    # non-sensitive module config only
.\up.ps1                # decrypts secrets, then docker compose up -d
```

Tests, 12 of them, against an ephemeral database that the fixture creates and tears down:

```sh
docker compose --profile test run --rm test
```

## Environment worth knowing

`EMBED_MODEL` / `EMBED_DIM` must be **identical on every node**. Logical replication copies
the `embedding vector(N)` column as is, so a node on 384 dimensions talking to a node on
1024 fails on type mismatch. The compose defaults are already `multilingual-e5-large` and
`1024` so that a fresh node started without an `.env` creates the right schema instead of
breaking sync later.

`AUTHORSHIP_ENFORCE` is `warn` or `strict`. Strict rejects writes from an agent that does not
declare its model, with an instructive error. Only turn it on once every client has reloaded
the tool schema, otherwise they cannot write until they reconnect.

`ASSETS_PATH` defaults to a Windows path. On a Linux node it has to be POSIX.

## Layout

```
app/            core, FastAPI, MCP server, embedding worker
app/viewer/     the original zero-build viewer, kept as reference spec
app/tests/      pytest suite
bench/          retrieval benchmarks (see the root README)
db/             schema and migrations
web/            Svelte 5 viewer
up.ps1          start with secrets injected from SOPS
```
