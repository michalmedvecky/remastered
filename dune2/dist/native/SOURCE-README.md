# Complete corresponding source

Download [source.tar.gz](source.tar.gz) and every art volume listed below into one directory. The original source.tar.gz URL remains the main code, licenses, prompts and manifests archive. The parts contain exact large artwork/reference inputs and matching painted runtime PNGs.

- [source-art-01-59f24e4478e8815d.tar.gz](source-art-01-59f24e4478e8815d.tar.gz) — 46754523 bytes, SHA256 `59f24e4478e8815da1d6cc5ad7bc15961e778bfa27cf2bb63c15f527722f5c8f`
- [source-art-02-4f249e91ab608620.tar.gz](source-art-02-4f249e91ab608620.tar.gz) — 45855622 bytes, SHA256 `4f249e91ab608620090a69bbef5db51253c09f65775e359e2d49791d1cc9eb0f`
- [source-art-03-65dd46dc11102a9e.tar.gz](source-art-03-65dd46dc11102a9e.tar.gz) — 46920229 bytes, SHA256 `65dd46dc11102a9efff2cdca0f1136b28e45a8e302868cd99f820c7588da3142`
- [source-art-04-3b4f5d2b015f87bb.tar.gz](source-art-04-3b4f5d2b015f87bb.tar.gz) — 41829195 bytes, SHA256 `3b4f5d2b015f87bb81cdfa42c3bb7cafaee677e8efb29824ddeddb2e2887b4c3`
- [source-art-05-9801fcc9194f3bdf.tar.gz](source-art-05-9801fcc9194f3bdf.tar.gz) — 47276649 bytes, SHA256 `9801fcc9194f3bdf63f6ba985b10a7c773dafbaeaab56a3c1d7c8ea865443153`
- [source-art-06-90b201978476321e.tar.gz](source-art-06-90b201978476321e.tar.gz) — 45526054 bytes, SHA256 `90b201978476321e21a3d14b55b82b61b7e8dca2ec26b9e8cc9350aa36708279`
- [source-art-07-d7d870976cc6fa47.tar.gz](source-art-07-d7d870976cc6fa47.tar.gz) — 27003421 bytes, SHA256 `d7d870976cc6fa4795662b462ea74f8a0564701ebf0267890ddde9ecebb2fbb7`

Extract source.tar.gz and each art volume into the same empty directory; all entries live below dune2/. Run `python3 dune2/tools/verify-source-package.py --archives-dir /path/to/downloads --root dune2` to verify the complete reconstructed source against SOURCE-MANIFEST.json. The verifier rejects unsafe paths, links, duplicate or unexpected members, missing parts and modified bytes. Source packages contain no original game ZIP, EXE, COM or PAK files. Native rebuilds still require your own game data.

SOURCE-MANIFEST.json records every file, its volume, size, mode and hash. SOURCE-PACKAGE.json describes the published main archive and all content-addressed volumes. UI coverage statuses distinguish paintings, derivatives, original aliases, analytic shapes, text and empty native slots; WSA movie coverage is separately documented.
