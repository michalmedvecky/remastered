#!/usr/bin/env python3
"""Compile actual patched functions and compare retained observed original DOS outputs.
This regression does not execute an emulator or any original machine code.
Adapters supply only the peripheral services declared by the original probes.
"""
from pathlib import Path
import argparse,ctypes,hashlib,json,shutil,subprocess,tempfile
HERE=Path(__file__).resolve().parent

def function(s,sig):
    a=s.index(sig);brace=s.index('{',a);depth=1;b=brace+1
    while depth:
        depth+=(s[b]=='{')-(s[b]=='}');b+=1
    return s[a:b]

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source_root',type=Path);args=p.parse_args();source=args.source_root.resolve()
    fixtures=HERE/'original-runtime-fixtures.json';pack=json.loads(fixtures.read_text());compiler='/usr/bin/clang'if Path('/usr/bin/clang').exists()else shutil.which('clang')
    results=[]
    with tempfile.TemporaryDirectory(prefix='dune-original-runtime-')as tmp:
        tmp=Path(tmp)
        for matrix in pack['matrices']:
            code=(HERE/matrix['template']).read_text();source_hashes={}
            for symbol,spec in matrix['substitutions'].items():
                text=(source/spec['source']).read_text()
                if 'signature'in spec:body=function(text,spec['signature'])
                else:
                    a=text.index(spec['declaration']);body=text[a:text.index(';',a)+1]
                source_hashes[symbol]=hashlib.sha256(body.encode()).hexdigest();code=code.replace('@@'+symbol+'@@',body)
            assert '@@'not in code
            c=tmp/(matrix['name']+'.c');c.write_text(code);libpath=tmp/(matrix['name']+'.dylib')
            subprocess.run([compiler,'-shared','-fPIC','-Wno-unused-parameter','-I',str(source/'include'),'-iquote',str(source/'src'),'-I',str(HERE),str(c)]+[str(source/t)for t in matrix['tables']]+['-o',str(libpath)],check=True,capture_output=True)
            lib=ctypes.CDLL(str(libpath));run=getattr(lib,matrix['entry']);run.argtypes=[ctypes.POINTER(ctypes.c_ushort)]*2
            for index,(inp,expected)in enumerate(matrix['fixtures']):
                args=(ctypes.c_ushort*matrix['inputWords'])(*inp);out=(ctypes.c_ushort*matrix['resultWords'])();run(args,out)
                assert list(out)==expected,{'matrix':matrix['name'],'index':index,'input':inp,'actual':list(out),'observedOriginal':expected}
            results.append({'matrix':matrix['name'],'fixtures':len(matrix['fixtures']),'mismatches':0,'actualSourceBodySha256':source_hashes})
    result={'passed':True,'originalCodeExecutedByThisRegression':False,'expectedValues':'retained actual DOSBox original-machine-code observations','fixtures':pack['totalFixtures'],'fixturePackSha256':hashlib.sha256(fixtures.read_bytes()).hexdigest(),'matrices':results,'limitations':pack['scope']}
    (HERE/'original-runtime-regression-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':True,'fixtures':pack['totalFixtures'],'mismatches':0}))
if __name__=='__main__':main()
