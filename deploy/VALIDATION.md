# Unified infrastructure validation

## Dune II integration — 18 November 2026

The unified image now serves five games: `/pre2/`, `/ga/`, `/flappy/`, `/tappy/` and `/dune2/`. The Dockerfile, public-file allowlist, preview routing, combined/per-game snapshots, CI build arguments and actual-image smoke checks all carry the Dune runtime and `DUNE2_SNAPSHOT`. The checked-in k3s workload/Ingress templates are consumed by the existing offline renderer; required cluster values remain unset in the example.

- Thirteen routing and manifest tests passed with `node --test tests/routing.test.mjs deploy/render.test.mjs`: all five prefix redirects, distinct pages, missing-asset404s, native WASM magic/MIME, preload delivery, gzip source download and JPEG tile MIME, plus positive/negative renderer checks. The tests used an ephemeral loopback server and closed it.
- The template-backed renderer produces exactly the same resources as the previous renderer for four configurations: Traefik, internal-only, existing pull Secret and standard ingress controller. No cluster was contacted.
- Installed Homebrew NGINX accepted the final config with only its local MIME-file and temporary PID-path substitutions. No server was started for that syntax check.
- Docker is unavailable locally. CI must still build/smoke the actual image and verify both architectures before an immutable image digest can be selected for rollout. No registry publication or cluster operation is asserted by these local checks.

## Historical unified migration checks

Implemented one root Docker build context and a strict public-file allowlist; portal at `/`, games at `/pre2/`, `/ga/`, `/flappy/`. The root metadata writer is supplied by the coordinator; the Dockerfile passes each game's snapshot independently and the combined snapshot to the portal. Base nginx is pinned to the previously verified official digest. Existing standalone publishers are disabled outside `.github/workflows/`; the sole active workflow targets only `ghcr.io/michalmedvecky/remastered` after the repository rename.

Checks performed:

- Four portable renderer tests passed: hardened Deployment/Service/Ingress with preserved paths, internal-only rendering and optional pull Secret, invalid/missing context/namespace/digest/host/TLS/type/unknown-key rejection. Traefik explicitly requires a configured HTTPS entrypoint and receives TLS/entrypoint annotations; an explicitly selected standard controller receives none.
- An offline valid JSON render produced exactly Deployment/remastered, Service/remastered and Ingress/remastered. It produced no Namespace, Secret or cluster-scoped resource and contacted no cluster.
- Active workflow YAML parsed with Ruby's YAML parser. Static review confirms root tests and verification precede publishing, multiarch amd64/arm64, exact digest runtime smoke, inherited pinned Actions, no cluster credentials or apply step.
- Local Homebrew NGINX accepted the configuration. Seventeen HTTP paths passed: root fixture, health, all three real game directories, representative JS and build JSON, missing JS404 and directory redirects. `absolute_redirect off` keeps redirects relative behind TLS ingress. Evidence: `golden-axe-research/evidence/remastered-migration/nginx-prefix-smoke.json`. The temporary server used local MIME/root/listen/tmp replacements and a fixture root page with symlinked game directories; this is explicitly **not a Docker image or live deployment proof**.
- Follow-up causal check passed explicit `/pre2/manifest.webmanifest` MIME `application/manifest+json` and three redundant-source404 denials (`assets/source/`, `executable-data.bin`, `README.md`). Evidence: `nginx-manifest-source-smoke.json` in the same evidence directory. NGINX syntax passed again; the isolated server was closed.
- Current official Kubernetes security-context/Ingress, Traefik TLS/entrypoint and NGINX static-serving/relative-redirect documentation was retrieved using Context7. Links are in DEPLOYER.md.

Local Docker CLI is unavailable. Actual image construction, pinned-image runtime smoke, architecture-index proof and registry publication must succeed in CI before handing an image digest to the deployer. No image build/publication or cluster operation is claimed here. The isolated localhost5968 NGINX process was stopped after checks.

Cluster-specific inputs remain intentionally required: exact context, namespace, TLS Secret, ingress class, optional pull Secret, and actual legacy-resource identities. Source-only references were inventoried; the English deployer handoff requires live inventory, backup and an explicit exact-object removal allowlist. No wildcard/namespace deletion is prepared or performed.
