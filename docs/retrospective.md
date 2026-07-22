# How this project kept changing its mind

`naeth` started as a research project with a line at the top of its notes saying, in so many
words, that it was a design exercise and not a code project. It is now a module running in
production inside a platform that did not exist when it began.

Between those two states the first real stack went up on 25 June 2026 and verifiable
authorship went live with strict enforcement on 21 July. Under a month. What follows is not
the changelog, it is the list of things I believed and then stopped believing, and what it
cost each time.

## The bottleneck was not where I was looking

The first three steps were spent ranking existing memory systems, checking how integrable the
best of them were, and evaluating three architectures on paper against a list of open
questions. All of that assumed retrieval was the hard part.

The spike said otherwise. Semantic search stayed under a second up to a million notes, around
135 ms on CPU. The only real ceiling was generating the embeddings in the first place, roughly
a hundred a second on CPU, which the architecture already hid behind an async queue.

I had been designing against the wrong constraint. Cheap to find out, because I found out with
a spike instead of a build.

## The substrate I designed around got discarded

Two of those three paper architectures were built around a specific existing memory system as
the hot tier. When I finally compared it head to head against Postgres with pgvector, Postgres
won on graph scale and on reconciling with how the client actually behaves.

The system I had been designing around for two steps was dropped as a substrate. The design
work was not wasted, the questions it produced were the evaluation criteria, but it is the
clearest case in the project of committing to a component before testing it.

## The index looked verified and was not

The schema step closed with a caveat I nearly ignored: the latency spike had used synthetic
vectors. Synthetic vectors tell you how fast the index answers. They tell you nothing about
whether the answers are right.

Rerunning it with real embeddings gave recall@10 of 0.96 at sub-millisecond latency, so the
conclusion held. But the number I would have quoted before that rerun was one I had not
actually measured, and I would not have known.

## The model was chosen by availability, then by evidence

The embedding model in the first working stack was picked because the one I wanted was not
packaged in the library version I had. That is a reasonable way to unblock yourself and a
terrible way to make a decision.

So I built a benchmark for the actual job: a corpus of realistic notes, one paraphrased query
per note with deliberately minimal lexical overlap, so that retrieval had to depend on meaning
rather than shared words. The stopgap model scored 0.56 recall@1. `multilingual-e5-large`
scored 0.80.

Migrating meant altering the vector column, dropping and recreating a view and the HNSW index,
and re-embedding everything. Worth it, and much cheaper then than it would have been later.

## Nodes were allowed different models, until they were not

The multi-node design said each node could run its own embedding model, a large one locally
and a small one on the home server, because synchronisation was going to happen at the
application level and embeddings were never going to travel between nodes.

When synchronisation moved to logical replication, that stopped being true. Replication copies
the `vector(N)` column as it is, so a node on 384 dimensions and a node on 1024 fail on type
mismatch. A decision made under one transport quietly became a bug under another.

The fix was to change the defaults so that a fresh node started with no configuration creates
the correct schema rather than breaking sync weeks later. Failures should happen at setup, not
at the first replication.

## I built an authorization server and then deleted it

This is the one I am most attached to and least sorry about. Over a few days I built a
complete OAuth 2.1 authorization server: PKCE, dynamic client registration, tokens persisted
in Postgres, single-user login, refresh rotation with the old pair revoked. It was validated
against a real client and it worked.

Then a second MCP server appeared, and the argument changed. One authorization server per MCP
server means one login screen, one token store, and one place to add a second factor per
server. Identity moved out to a central provider, the MCP servers became resource servers that
validate its tokens, and the authorization server I had written was retired.

It was not deleted because it was broken. It was deleted because it was the wrong shape for
where the system was going, and keeping working code that is the wrong shape is more expensive
than throwing it away.

## "It is only on localhost" was false

The viewer and the data API were written as local-only surfaces. They were never given the
auth dependency that `/mcp` had, because they were not supposed to be reachable.

A tunnel publishes the whole application. From outside the network I could read the API and I
could write to it: an unauthenticated POST returned 200 and created a record. Which I then
removed with a tombstone, because nothing in this system is destroyed.

The first fix was a 404 at the edge, which is a plug. The real fix, selective forward-auth by
route with the OAuth handshake left untouched, came with the platform migration. The lesson is
that "internal" is a property of the network, not of the code, and the code should not assume
it.

## Identity did not come from where I designed it to

The authorship design assumed each connecting client would present its own OAuth `client_id`,
so tagging that identifier would tell me who wrote what.

Measured against real traffic, every client shares one `client_id`, the module's, because the
registered client is the proxy and not the agent. The design was worthless. Identity had to
come from the protocol handshake and the endpoint the request arrived on instead.

Then the replacement broke too, on a client that identifies itself with no separator in its
name, which my normaliser did not expect. That one was recoverable only because the raw client
payload was stored alongside the normalised value. Two design failures in the same feature,
one week apart, and the difference between an annoyance and permanent data loss was one column
I had added out of paranoia.

## A feature made a taxonomy obsolete

Notes were organised by project and by origin, where origin recorded which tool had written
them. Once authorship became a real field, recorded per write and verifiable, origin in the
path was duplicating a signal the system now had properly.

So the second level of the path became the topic instead. Adding the feature did not extend
the taxonomy, it deleted part of it.

## What actually held up

One decision paid for itself repeatedly: append-only. Editing writes a new version, deleting
writes a tombstone, nothing is overwritten.

It meant the backfill of three hundred historical notes could not corrupt anything. It meant
the migration to the platform could run blue and green against the same database at the same
time, because appends from either side simply coexisted. It meant that when I wrote a record
to my own system from the internet without authentication, I could retire it without erasing
the evidence that it had happened.

I did not choose it for any of those reasons. I chose it because the thing writing to the store
is a language model and I did not want a model to be able to destroy anything. The other
benefits were free.

## Still open

Multi-node synchronisation is designed and verified but not built. The viewer rewrite is three
phases in, with direct manipulation of the graph still ahead. The retired image generation
server is a reminder that I do sometimes build things I did not need, and that noticing takes
longer than it should.

The pattern across all of it is dull and consistent. Every correction came from measuring
something. The expensive mistakes were the ones where I kept designing on top of an assumption
instead of testing it first, and the cheap ones were the ones I caught with a spike, a
benchmark, or one look at real traffic.
