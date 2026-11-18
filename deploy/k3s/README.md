# k3s manifests for the unified Remastered application

`workload.template.json` and `ingress.template.json` are the actual inputs to the existing [validated renderer](../render.mjs). They describe one Deployment, one ClusterIP Service and an optional TLS Ingress. The image serves the portal plus `/pre2/`, `/ga/`, `/flappy/`, `/tappy/` and `/dune2/`. No second Dune deployment, prefix rewrite, PVC or controller installation is required.

The checked-in templates contain `__PLACEHOLDER__` values and must not be applied directly. Obtain the successful Remastered CI image digest and the operator's exact context, namespace and existing TLS/ingress settings, then render locally:

```sh
cp deploy/config.example.json deploy/config.local.json
# Fill the required reviewed cluster inputs and immutable image digest.
node deploy/render.mjs deploy/config.local.json > deploy/remastered.rendered.json
node --test deploy/render.test.mjs
```

The renderer only reads local JSON and emits a Kubernetes JSON List; it never contacts a cluster. The empty context, namespace, image, certificate and controller values in the example are intentional. No image digest exists for this source until its image workflow succeeds. `expose:false` omits the Ingress for internal acceptance. Namespaces and referenced Secrets must already exist; the templates do not create or change them.

k3s normally installs Traefik and ServiceLB. Use the actual installed ingress class and configured HTTPS entrypoint, and do not modify the packaged controller to deploy this application. See [k3s networking services](https://docs.k3s.io/networking/networking-services). The full operator review, dry-run, rollout, acceptance and rollback sequence is in [DEPLOYER.md](../../DEPLOYER.md).

The workload runs as UID/GID10001 on port8080 with a read-only root filesystem, dropped capabilities, no service-account token, RuntimeDefault seccomp and a bounded writable `/tmp`. Both probes use `/healthz`. The shared NGINX config serves WASM, ES modules and the matching source archive with explicit MIME types. Saves are browser-local IndexedDB files, so the game needs no server storage. Moving to a new origin requires exporting and importing saves through the game's Saved missions control.

Dune release acceptance includes `/dune2/`, `/dune2/native/dune-native.wasm`, its `.data` preload, `/dune2/music/adl.wasm`, `/dune2/native/source.tar.gz` and `/dune2/build.json`. CI checks their runtime digests in the actual image. All prefixes use the same clean commit, with a distinct `DUNE2_SNAPSHOT` injected into Dune's build metadata. This preparation performs no registry publication or cluster operation.
