# Putting an MCP server behind a real identity provider

I run my own MCP servers. When there was one, its authorization server lived inside the same
process, which is the path of least resistance and what most examples show you. When I wanted
a second one, that stopped being reasonable: two servers meant two login screens, two token
stores, two places to add a second factor, and two things to keep patched.

So I moved identity out to a central provider and turned the MCP servers into resource
servers that trust it. This is what I found, including three things I only learned by
measuring, because no specification or documentation was going to tell me.

## The constraint that shapes everything else

You cannot put a redirect-based auth proxy in front of `/mcp`. Not Cloudflare Access, not
forward-auth, not anything that answers an unauthenticated request with a login redirect. It
breaks remote MCP clients.

Two distinct failure modes get conflated here, and telling them apart matters because they
have different fixes:

**Pre-auth.** The connector fails the instant you click Connect, with no login screen, while
the same URL works fine from a CLI client. Your origin logs nothing at all, because the
request never reached it. The failure lives between the connector and the proxy.

**Post-token.** The whole OAuth flow succeeds. Registration works, `/authorize` works,
`/token` returns 200. Then silence. What happened is that the broker's authenticated POST was
dropped at the CDN edge by bot protection, because it looks exactly like what bot protection
is built to stop: a server-to-server POST carrying a bearer token, with no cookies and no
browser fingerprint. This one is not an auth problem at all, and it is the more common of the
two. The fix is to allowlist the provider's egress range and turn bot fighting off on that
hostname.

The design consequence is that you stop thinking per host and start thinking per route.
`/mcp` and the OAuth discovery routes are protected by token validation inside the
application and by nothing else. Everything that is not part of the handshake, the viewer and
the data API in my case, sits behind forward-auth. Same host, different policy per path.

This is also how I closed a real hole. My viewer and my data API had been reachable from the
internet without authentication, because the tunnel publishes the whole application and I had
only ever thought about protecting `/mcp`. The first patch was a 404 at the edge, which is a
plug and not a design. Selective forward-auth is the design.

## The question I did not need to answer

I had one open question going in: does the identity provider need to support RFC 8707
resource indicators, so that each module gets a token scoped to its own audience? That
requirement would have ruled out most of the lightweight providers and pushed me toward a
heavyweight one.

It turned out not to apply. FastMCP's `OAuthProxy` is not a pass-through. It is a token
factory: it issues its own JWTs scoped to the server, validates signature and audience
locally, and keeps the upstream provider's tokens encrypted server-side where the client
never sees them. The audience separation I wanted was guaranteed by the proxy, not by the
provider.

That collapsed the whole decision. The question stopped being "which provider implements the
right RFCs" and became "which one gives me passkeys with the smallest footprint". An
afternoon of verification removed a constraint that would have shaped the architecture
around a requirement I did not have.

## What the protocol does not tell you

MCP carries no signal of which model is on the other end of the connection. Not a header, not
a claim, not a field. If you want to know what wrote a row, you have to design for it, and
you have to be honest about how much of it you actually know.

The mistake is recording one string. I split the axes by how much each can be trusted:

| Axis | Source | Trust |
|---|---|---|
| `product` | `clientInfo` in the handshake | set by the client application |
| `surface` | the endpoint the request arrived on | fixed by connector configuration |
| `zone`, `actor` | presence of a token, channel used | derived server-side |
| `vendor`, `model` | declared by the agent itself | taken on trust |
| `model_source` | `declared`, `undeclared` or `human` | records which of the two applied |

Proven and claimed live in the same object but never in the same field. A query that needs
certainty reads the first group. A query that can tolerate self-reporting reads the second.
The point is not that self-reported data is useless, it is that silently mixing it with
verified data makes both worthless.

## Three things I only learned by measuring

**Every client shares one `client_id`.** Once auth goes through the proxy, the registered
OAuth client is the module, not the agent. All clients present the same identifier. My first
design keyed identity off `client_id` and was worthless the moment I looked at real traffic.
Identity had to come from the handshake and the endpoint instead. The design did not survive
contact with the measurement, which is the cheapest kind of failure if you measure early.

**Client names in the wild are not what you would guess.** One client identifies itself as
`claude-code`. Another reports `Anthropic/ClaudeAI`, joined, with no separator and no dot. My
normaliser assumed a separator and mislabelled the first row it saw. The reason that was a
bug and not a permanent data loss is that I had stored the raw payload alongside the
normalised value, so the fix was a migration instead of a shrug. Normalisation is a
heuristic, heuristics break on clients that do not exist yet, and the raw thing costs almost
nothing to keep.

**Agents declare their model without being asked.** I assumed I would have to request it in
the prompt. I did not. Both clients read the tool description and sent it on their own. That
is what made it safe to move enforcement from `warn`, which stores the write anyway, to
`strict`, which rejects it with an instructive error. I moved it after measuring that real
clients complied, not before. Enforcement you turn on hoping it works is just an outage with
extra steps.

## If you are about to do this

- Protect by route, not by host. Keep `/mcp` and the OAuth routes out of any redirect-based
  proxy, and validate the token in the application.
- Before you debug your auth layer, check whether your CDN is eating the request. A flow that
  reaches `/token` with a 200 and then goes quiet is almost never an auth bug.
- Check what your proxy library actually issues before choosing a provider around a
  specification requirement. Mine did not have the requirement I thought it had.
- Record authorship in separate axes by trust level, and store the raw client payload next to
  the normalised one.
- Turn on strict enforcement after you have measured that clients comply, not on the
  assumption that they will.

None of this is in the specification, and most of it is not in the documentation either. It
is what the system does once you connect a real client to it.

---

*This is my own writeup, based on building and running the system described. The commissioned
research report that preceded the build is kept separately in
[`mcp-auth-centralisation-research.en.md`](mcp-auth-centralisation-research.en.md); it is a
saved third-party report, not my writing, and where my conclusions depart from its
recommendations the reason is given above.*
