# Unified application infrastructure

Follow [DEPLOYER.md](../DEPLOYER.md). `render.mjs` validates a local config and writes a Kubernetes JSON List without contacting a cluster. `nginx.conf` preserves `/pre2/`, `/ga/`, `/flappy/`, `/tappy/` and `/dune2/` paths. The [k3s templates](k3s/README.md) are the renderer's actual resource inputs. Required cluster-specific values stay in ignored `config.local.json`; never commit credentials.

Run portable positive/negative renderer checks with `node --test deploy/render.test.mjs`. The previous per-game deploy directories remain historical references, not independent active rollout targets.
