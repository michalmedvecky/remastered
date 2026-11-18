#!/usr/bin/env python3
"""Compare production ADL interpreter output with retained original DOS OPL.

Requires a local C++17 compiler; no original executable or driver is run.
"""
from pathlib import Path
import hashlib,json,subprocess,tempfile

HERE=Path(__file__).resolve().parent
WEB=HERE.parents[1]
MUSIC=WEB/'native/music'
golden=json.loads((HERE/'golden.json').read_text())
results=[];intro_results=[]
with tempfile.TemporaryDirectory(prefix='dune-opl-golden-') as temporary:
    temporary=Path(temporary)
    exe=temporary/'oracle'
    subprocess.run(['clang++','-std=c++17','-O2','-I',str(MUSIC/'vendor/adplug'),
                    str(HERE/'opldriver-oracle.cpp'),str(MUSIC/'vendor/adplug/adl.cpp'),
                    '-o',str(exe)],check=True)
    for c in golden['cases']+golden.get('introCases',[]):
        expected=(HERE/c['file']).read_bytes()
        assert hashlib.sha256(expected).hexdigest()==c['sha256'],c['file']
        output=temporary/(c['house']+'.opl')
        args=[str(exe),str(WEB/'dist/music/banks'/(c['bank']+'.ADL')),
              str(c['track']),str(c['ticks']),str(output)]
        args.extend(str(v) for event in c['effects'] for v in event)
        subprocess.run(args,check=True,capture_output=True)
        actual=output.read_bytes()[c.get('skipNativeEvents',0)*2:]
        assert actual==expected, (c['house'],len(actual),len(expected),
            next((i//2 for i,(a,b) in enumerate(zip(actual,expected)) if a!=b),'length mismatch'))
        result={'house':c['house'],'events':len(actual)//2,'sha256':hashlib.sha256(actual).hexdigest()}
        if 'fade' in c:
            fade=c['fade']
            fade_expected=(HERE/fade['file']).read_bytes()
            assert hashlib.sha256(fade_expected).hexdigest()==fade['sha256']
            args[3]=str(fade['tick']+100)
            args.extend([str(fade['tick']),str(fade['track'])])
            subprocess.run(args,check=True,capture_output=True)
            with_fade=output.read_bytes()
            assert with_fade[:len(expected)+len(fade_expected)]==expected+fade_expected,c['house']+' fade prefix'
            result.update({'fadePrefixEvents':len(fade_expected)//2,'fadePrefixSha256':fade['sha256']})
            results.append(result)
        else:
            intro_results.append(result)
report={'status':'passed','scope':golden['scope'],'cases':results,'introCases':intro_results,
        'interpreterSha256':hashlib.sha256((MUSIC/'vendor/adplug/adl.cpp').read_bytes()).hexdigest()}
(HERE/'test-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
