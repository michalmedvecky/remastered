#!/usr/bin/env python3
"""Preserve all supplied VOC PCM and silence blocks in OpenDUNE's SDL DSP.

Only src/audio/dsp_sdl.c changes. The legacy DSP API supplies no buffer length;
this patch retains that interface and accepts the statically audited game data.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

WEB=Path(__file__).resolve().parents[1]
MARKER="/* V1.07 VOC PCM/silence fidelity patch. */"
DECODER=r'''/* V1.07 VOC PCM/silence fidelity patch. */
/* VOC time constants represent 1000000/(256-tc) samples/second.
 * Silence has its own time constant. Convert its duration to the active
 * PCM rate, rounding to the nearest sample, rather than copying its count.
 * The shipped 223 files contain only block types 1 (PCM), 3 (silence), 0.
 * Bound the number of records and aggregate size; DSP_Play's historical API
 * does not provide the source allocation length. */
static bool DSP_DecodeVOC(const uint8 *block, uint8 *output, uint32 *frequency, uint32 *length)
{

 uint32 total = 0;
 uint32 rate = 0;
 uint16 records;

 for (records = 0; records < 256; records++) {
  uint8 type = *block++;
  uint32 size;
  uint32 count;

  if (type == 0) {
   *frequency = rate;
   *length = total;
   return rate != 0 && total != 0;
  }

  size = (uint32)block[0] | ((uint32)block[1] << 8) | ((uint32)block[2] << 16);
  block += 3;
  if (size > 10000000) return false;

  if (type == 1) {
   uint32 blockRate;
   if (size < 2 || block[1] != 0) return false;
   blockRate = 1000000 / (256 - block[0]);
   if (rate == 0) rate = blockRate;
   if (rate != blockRate) return false; /* absent from supplied data */
   count = size - 2;
   if (count > 10000000 - total) return false;
   if (output != NULL) memcpy(output + total, block + 2, count);
  } else if (type == 3) {
   uint32 ticks;
   if (size != 3) return false;
   ticks = (uint32)READ_LE_UINT16(block) + 1;
   if (rate == 0) rate = 1000000 / (256 - block[2]);
   /* 64-bit intermediate prevents overflow for 65536-sample silence. */
   count = (uint32)(((unsigned long long)ticks * (256 - block[2]) * rate + 500000) / 1000000);
   if (count > 10000000 - total) return false;
   if (output != NULL) memset(output + total, 0x80, count);
  } else {
   return false; /* no unsupported block is silently interpreted as PCM */
  }
  total += count;
  block += size;
 }
 return false;
}
'''
PLAY=r'''void DSP_Play(const uint8 *data)
{
 uint32 frequency;
 uint32 decodedLength;
 uint16 offset;

 DSP_Stop();
 if (data == NULL || memcmp(data, "Creative Voice File\x1a", 20) != 0) return;
 offset = READ_LE_UINT16(data + 20);
 if (offset < 26 || offset > 1024) return;
 data += offset;

 if (!DSP_DecodeVOC(data, NULL, &frequency, &decodedLength)) return;
 if (s_dataLen < decodedLength) {
  uint8 *next = realloc(s_data, decodedLength);
  if (next == NULL) return;
  s_data = next;
  s_dataLen = decodedLength;
 }
 if (!DSP_DecodeVOC(data, s_data, &frequency, &decodedLength)) return;
 s_bufferLen = decodedLength;
 DSP_ConvertAudio(frequency);

 s_buffer = s_data;
 s_status = 2;
 SDL_PauseAudio(0);
}
'''


def patch(source):
    if MARKER in source:
        # Reapplying the same patch is harmless; reject a divergent marked body.
        assert DECODER.strip() in source and PLAY.strip() in source, "marked DSP patch differs"
        return source
    start=re.search(r"\bvoid DSP_Play\(const uint8 \*data\)\s*\{",source)
    assert start,"DSP_Play signature changed"
    depth=1;end=start.end()
    while depth:
        ch=source[end];end+=1
        if ch=="{":depth+=1
        elif ch=="}":depth-=1
    return source[:start.start()]+DECODER+"\n"+PLAY+source[end:]


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("root",type=Path)
    p.add_argument("--write",action="store_true")
    p.add_argument("--report",type=Path)
    args=p.parse_args()
    path=args.root/"src/audio/dsp_sdl.c"
    before=path.read_text();after=patch(before)
    report=dict(path=str(path),mode="write" if args.write else "preview",changed=before!=after,
        beforeSha256=hashlib.sha256(before.encode()).hexdigest(),afterSha256=hashlib.sha256(after.encode()).hexdigest(),
        supportedVocBlocks=[0,1,3],silenceDuration="(LE16(count)+1)*(256-timeConstant)/1000000 seconds; nearest active-rate sample")
    if args.write and before!=after:path.write_text(after)
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))


if __name__=="__main__":main()
