"""Read hash-bound browser preload resources statically; no game execution."""
from pathlib import Path
from functools import lru_cache
import hashlib
import json
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
sha = lambda body: hashlib.sha256(body).hexdigest()


@lru_cache(maxsize=1)
def _load():
    build = json.loads((ROOT / "fidelity/native-build.json").read_text())
    integrity = json.loads((ROOT / "fidelity/original-integrity.json").read_text())
    module = (ROOT / "dist/native/dune-native.mjs").read_bytes()
    payload = (ROOT / "dist/native/dune-native.data").read_bytes()
    for name, body in [("dune-native.mjs", module), ("dune-native.data", payload)]:
        if sha(body) != build["outputs"][name]:
            raise ValueError("Native package hash mismatch: " + name)
    matches = re.findall(rb'\n\s*loadPackage\((\{"files": [^\n]+\})\);', module)
    if len(matches) != 1:
        raise ValueError("Expected one static Emscripten preload metadata record")
    metadata = json.loads(matches[0])
    if metadata["remote_package_size"] != len(payload):
        raise ValueError("Preload length mismatch")
    originals = {row["name"].upper(): row["sha256"] for row in integrity["members"]}
    files = {}; records = []; cursor = 0
    for row in metadata["files"]:
        start, end = row["start"], row["end"]
        if (not re.fullmatch(r"/data/[^/]+", row["filename"]) or
                not isinstance(start, int) or not isinstance(end, int) or
                start != cursor or end < start or end > len(payload)):
            raise ValueError("Invalid preload file extent")
        name = row["filename"][6:]; key = name.upper()
        if key in files:
            raise ValueError("Duplicate preload name: " + name)
        body = payload[start:end]; digest = sha(body); expected = originals.get(key)
        if ((expected is not None and digest != expected) or
                (expected is None and key != "OPENDUNE.INI")):
            raise ValueError("Unexpected original data: " + name)
        files[key] = body
        records.append(dict(name=name, start=start, end=end, size=len(body),
                            sha256=digest, originalHashVerified=bool(expected)))
        cursor = end
    if cursor != len(payload):
        raise ValueError("Unaccounted preload bytes")
    return files, dict(packageSha256=sha(payload), bytes=len(payload), files=records)


def verify_preload():
    return _load()[1]


def read_preloaded_file(name):
    return _load()[0][name.upper()]


@lru_cache(maxsize=None)
def read_pak(name):
    raw = read_preloaded_file(name); entries = []; cursor = 0
    while True:
        if cursor + 4 > len(raw):
            raise ValueError("Truncated PAK directory: " + name)
        offset = struct.unpack_from("<I", raw, cursor)[0]; cursor += 4
        if not offset:
            break
        end = raw.find(b"\0", cursor)
        if end < cursor or end - cursor > 255:
            raise ValueError("Invalid PAK name: " + name)
        member_name = raw[cursor:end].decode("ascii"); cursor = end + 1
        if not re.fullmatch(r"[\x20-\x7e]+", member_name):
            raise ValueError("Non-ASCII PAK name: " + name)
        entries.append((member_name, offset))
    members = {}
    for index, (member_name, offset) in enumerate(entries):
        end = entries[index + 1][1] if index + 1 < len(entries) else len(raw)
        if offset < cursor or end < offset or end > len(raw):
            raise ValueError("Invalid PAK extent or duplicate: " + name + "/" + member_name)
        body = raw[offset:end]
        # Preserve first occurrences, as in the retained original resource audit.
        if member_name.upper() in members:
            continue
        members[member_name.upper()] = dict(name=member_name, offset=offset,
                                          size=len(body), sha256=sha(body), bytes=body)
    return members
