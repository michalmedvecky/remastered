# Complete corresponding source

Download [source.tar.gz](source.tar.gz) and every art volume listed below into one directory. The original source.tar.gz URL remains the main code, licenses, prompts and manifests archive. The parts contain exact large artwork/reference inputs and matching painted runtime PNGs.

- [source-art-01-59f24e4478e8815d.tar.gz](source-art-01-59f24e4478e8815d.tar.gz) — 46754523 bytes, SHA256 `59f24e4478e8815da1d6cc5ad7bc15961e778bfa27cf2bb63c15f527722f5c8f`
- [source-art-02-4f249e91ab608620.tar.gz](source-art-02-4f249e91ab608620.tar.gz) — 45855622 bytes, SHA256 `4f249e91ab608620090a69bbef5db51253c09f65775e359e2d49791d1cc9eb0f`
- [source-art-03-65dd46dc11102a9e.tar.gz](source-art-03-65dd46dc11102a9e.tar.gz) — 46920229 bytes, SHA256 `65dd46dc11102a9efff2cdca0f1136b28e45a8e302868cd99f820c7588da3142`
- [source-art-04-c3918fcd825a98b7.tar.gz](source-art-04-c3918fcd825a98b7.tar.gz) — 42186694 bytes, SHA256 `c3918fcd825a98b7c41e25d6a91e59560274283ec7578dd0c6fd3cf65ba4deae`
- [source-art-05-793ecadbe74a53e2.tar.gz](source-art-05-793ecadbe74a53e2.tar.gz) — 48655950 bytes, SHA256 `793ecadbe74a53e28e39fb21b26b6aaaaf0615d69591033e0a1d96512b617405`
- [source-art-06-ae3ccadd18887337.tar.gz](source-art-06-ae3ccadd18887337.tar.gz) — 43755529 bytes, SHA256 `ae3ccadd18887337d244566c70de7cf02a2419acab37fabddeffc087e7de85d8`
- [source-art-07-cba70bae11c8f011.tar.gz](source-art-07-cba70bae11c8f011.tar.gz) — 37293449 bytes, SHA256 `cba70bae11c8f01192d0a1532c5dd3f763ce1c97b53183864456226c2c1d7004`

Extract source.tar.gz and each art volume into the same empty directory; all entries live below dune2/. Run `python3 dune2/tools/verify-source-package.py --archives-dir /path/to/downloads --root dune2` to verify the complete reconstructed source against SOURCE-MANIFEST.json. The verifier rejects unsafe paths, links, duplicate or unexpected members, missing parts and modified bytes. Source packages contain no original game ZIP, EXE, COM or PAK files. Native rebuilds still require your own game data.

SOURCE-MANIFEST.json records every file, its volume, size, mode and hash. SOURCE-PACKAGE.json describes the published main archive and all content-addressed volumes. UI coverage statuses distinguish paintings, derivatives, original aliases, analytic shapes, text and empty native slots; WSA movie coverage is separately documented.
