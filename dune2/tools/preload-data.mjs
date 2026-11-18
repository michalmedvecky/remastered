// Static resource access for portable checks; never imports or runs the game.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let cache;
const paks = new Map();

function load() {
  if (cache) return cache;
  const build = JSON.parse(readFileSync(new URL('fidelity/native-build.json', root)));
  const integrity = JSON.parse(readFileSync(new URL('fidelity/original-integrity.json', root)));
  const moduleBytes = readFileSync(new URL('dist/native/dune-native.mjs', root));
  const bytes = readFileSync(new URL('dist/native/dune-native.data', root));
  for (const [name, body] of [['dune-native.mjs', moduleBytes], ['dune-native.data', bytes]]) {
    if (sha(body) !== build.outputs[name]) throw Error(`Native package hash mismatch: ${name}`);
  }
  const matches = [...moduleBytes.toString('utf8').matchAll(/\n\s*loadPackage\((\{"files": [^\n]+\})\);/g)];
  if (matches.length !== 1) throw Error('Expected one static Emscripten preload metadata record');
  const metadata = JSON.parse(matches[0][1]);
  if (metadata.remote_package_size !== bytes.length) throw Error('Preload length mismatch');
  const originals = new Map(integrity.members.map(row => [row.name.toUpperCase(), row.sha256]));
  const files = new Map(), records = [];
  let cursor = 0;
  for (const row of metadata.files) {
    if (!/^\/data\/[^/]+$/.test(row.filename) || !Number.isSafeInteger(row.start) ||
        !Number.isSafeInteger(row.end) || row.start !== cursor || row.end < row.start || row.end > bytes.length) {
      throw Error('Invalid preload file extent');
    }
    const name = row.filename.slice(6), key = name.toUpperCase();
    if (files.has(key)) throw Error(`Duplicate preload name: ${name}`);
    const body = bytes.subarray(row.start, row.end), digest = sha(body), expected = originals.get(key);
    if (expected ? digest !== expected : key !== 'OPENDUNE.INI') throw Error(`Unexpected original data: ${name}`);
    files.set(key, body);
    records.push({name, start: row.start, end: row.end, size: body.length, sha256: digest, originalHashVerified: !!expected});
    cursor = row.end;
  }
  if (cursor !== bytes.length) throw Error('Unaccounted preload bytes');
  cache = {files, report: {packageSha256: sha(bytes), bytes: bytes.length, files: records}};
  return cache;
}

export function verifyPreload() { return structuredClone(load().report); }
export function readPreloadedFile(name) {
  const bytes = load().files.get(String(name).toUpperCase());
  if (!bytes) throw Error(`Missing preloaded file: ${name}`);
  return Buffer.from(bytes);
}

export function readPak(name) {
  const key = String(name).toUpperCase();
  if (paks.has(key)) return paks.get(key);
  const raw = readPreloadedFile(key), entries = [], members = new Map();
  let cursor = 0;
  for (;;) {
    if (cursor + 4 > raw.length) throw Error(`Truncated PAK directory: ${name}`);
    const offset = raw.readUInt32LE(cursor); cursor += 4;
    if (!offset) break;
    const end = raw.indexOf(0, cursor);
    if (end < cursor || end - cursor > 255) throw Error(`Invalid PAK name: ${name}`);
    const memberName = raw.toString('ascii', cursor, end); cursor = end + 1;
    if (!/^[\x20-\x7e]+$/.test(memberName)) throw Error(`Non-ASCII PAK name: ${name}`);
    entries.push({name: memberName, offset});
  }
  for (let index = 0; index < entries.length; index++) {
    const row = entries[index], end = entries[index + 1]?.offset ?? raw.length;
    if (row.offset < cursor || end < row.offset || end > raw.length ) {
      throw Error(`Invalid PAK extent or duplicate: ${name}/${row.name}`);
    }
    const bytes = raw.subarray(row.offset, end);
    // Keep the first occurrence, matching the retained resource audit. Some
    // shipped voice archives repeat a name with a later, different body.
    if (!members.has(row.name.toUpperCase())) members.set(row.name.toUpperCase(), {...row, size: bytes.length, sha256: sha(bytes), bytes});
  }
  paks.set(key, members);
  return members;
}

const cp437High = "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00a2\u00a3\u00a5\u20a7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u2310\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0";

export function parseIni(bytes) {
  const sections = {};
  let section;
  for (const rawLine of bytes.toString('latin1').replace(/[\u0080-\u00ff]/g, char => cp437High[char.charCodeAt(0) - 128]).replace(/\0.*$/s, '').split(/\r?\n/)) {
    const line = rawLine.split(';', 1)[0].trim();
    if (!line) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1);
    } else if (section && line.includes('=')) {
      const at = line.indexOf('='); sections[section] ??= {};
      sections[section][line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
  }
  return sections;
}
