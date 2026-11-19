#!/usr/bin/env python3
"""Verify and safely reconstruct all corresponding-source volumes."""
import argparse,json
from pathlib import Path
from source_package import verify_packages

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--archives-dir',type=Path);parser.add_argument('--extract-to',type=Path,help='Optional empty reconstruction directory; otherwise use a temporary directory');parser.add_argument('--no-current-check',action='store_true',help='Verify downloaded volumes without comparing the current source tree');args=parser.parse_args();print(json.dumps(verify_packages(args.root,args.archives_dir,args.extract_to,not args.no_current_check)))
if __name__=='__main__':main()
