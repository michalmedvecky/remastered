#!/usr/bin/env python3
"""Generate twelve full production-UI mission-outcome composition cases.

Reuses the source-bound native actor/text fixture construction from the advisor
review without modifying that generator. No server, WASM or DOS code is run.
"""
from pathlib import Path
import argparse, base64, hashlib, importlib.util, json

ROOT = Path(__file__).resolve().parents[2]
BASE = Path(__file__).with_name('advisor-canvas-review.py')
spec = importlib.util.spec_from_file_location('whole_advisor_fixture', BASE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def template():
    source = module.TEMPLATE
    start = source.index(' const cases=[];')
    end = source.index(' const canvas=surface()', start)
    source = source[:start] + r'''
 const outcomeManifest=await json('media'),outcomeAtlas=await sourceAtlas(outcomeManifest.atlases.outcomeBases.src),outcomeExpected=new Map();
 for(const resource of ['WIN1.WSA','WIN2.WSA','LOSTBILD.WSA','LOSTVEHC.WSA']){
  const c=surface(),x=c.getContext('2d',{willReadFrequently:true}),entry=outcomeManifest.resources[resource].frames[0];
  x.drawImage(outcomeAtlas,...entry.rect,512,192,736,448);outcomeExpected.set(resource,x.getImageData(0,0,1280,800).data);
 }
 const cases=[];
 for(const resource of ['WIN1.WSA','WIN2.WSA','LOSTBILD.WSA','LOSTVEHC.WSA'])for(const advisor of ['a','h','o']){
  cases.push({name:advisor+' whole outcome '+resource,advisor,mode:'briefing',pose:2,resource,phase:0,gallery:true});
 }
 const reviewSelect=document.getElementById('review-case'),advisorNames={a:'Atreides',h:'Harkonnen',o:'Ordos'};
 for(const[index,spec]of cases.entries()){
  const option=document.createElement('option');option.value=String(index);option.textContent=advisorNames[spec.advisor]+' — '+spec.resource;reviewSelect.append(option);
 }
 const updateReview=()=>{
  const wanted=reviewSelect.value;galleryElement.classList.toggle('single',wanted!=='all');
  for(const figure of galleryElement.children)figure.hidden=wanted!=='all'&&figure.dataset.case!==wanted;
 };
 reviewSelect.addEventListener('change',updateReview);
''' + source[end:]
    marker = '  if(spec.unknown){'
    assert source.count(marker) == 1
    source = source.replace(marker, r'''
  row.buttons=diagnostic.textFit.labels.filter(label=>['Proceed','Repeat'].includes(label.text)).map(label=>label.text);
  if(!row.buttons.includes('Proceed')||!row.buttons.includes('Repeat'))errors.push(spec.name+': native Proceed/Repeat controls were not painted');
  // Native actor/shoulder/book patches end at x168 in all three advisors.
  // Compare every byte in the remaining144x112 preview against the independent
  // new-art atlas crop, in addition to exact indexed resource recognition.
  row.preview=compareRegion(actual,outcomeExpected.get(spec.resource),[168,48,144,112]);
  if(row.preview.differentBytes)errors.push(spec.name+': mixed/partial outcome preview '+row.preview.differentBytes+' differing bytes');
''' + marker)
    old = 'coverage:{advisorResources:4,briefingPoses:20,helpScreens:4,houseConfirmations:9,unknownBaseCases:1,crossAdvisorCases:1,cases:results.length}'
    assert old in source
    source = source.replace(old, 'coverage:{advisorResources:3,outcomeResources:4,wholeBaseComparisons:12,exactOutcomeMatches:12,independentPreviewComparisons:12,proceedRepeatPairs:12,cases:results.length}')
    source = source.replace('<title>Whole advisor composition QA</title>', '<title>Whole mission outcome UI QA</title>')
    source = source.replace('<h1>Whole advisor composition</h1>', '<h1>Whole mission outcome UI</h1><p><label>Review scene <select id="review-case"><option value="all">All twelve scenes</option></select></label></p>')
    source = source.replace('</style>', '#gallery.single{display:block;max-width:1280px;margin:0 auto}#review-case{font:inherit;padding:6px;max-width:90vw}figure[hidden]{display:none}</style>', 1)
    source = source.replace('figure.append(caption,copy);galleryElement.append(figure);', 'figure.dataset.case=String(cases.indexOf(spec));figure.append(caption,copy);galleryElement.append(figure);')
    source = source.replace(' const output={pass:', " reviewSelect.value='0';updateReview();\n const output={pass:", 1)
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    frames = {}
    source = ROOT / 'art/hd-v3/media/outcome-motion'
    inventory = json.loads((source / 'inventory.json').read_text())
    for resource in inventory['resources']:
        assert resource['frameCount'] == 1
        row = resource['frames'][0]
        raw = (source / row['indexFile']).read_bytes()
        assert len(raw) == 184 * 112 and hashlib.sha256(raw).hexdigest() == row['pixelSha256']
        frames[resource['resource'] + ':0'] = base64.b64encode(raw).decode()
    assert len(frames) == 4
    fonts = json.loads((ROOT / 'art/hd-v3/icons/fonts.json').read_text())
    fonts['fonts'] = {k:v for k,v in fonts['fonts'].items() if k in ['NEW6P.FNT','NEW8P.FNT']}
    names = ['dist/painted/native.json', 'dist/painted/interface.json', 'dist/painted/icons.json',
             'dist/painted/media.json', 'art/hd-v3/icons/fonts.json', 'dist/painted-ui.mjs',
             'dist/painted-scenes.mjs', 'dist/painted-media.mjs',
             'art/hd-v3/media/outcome-motion/inventory.json',
             'art/hd-v3/media/outcome-motion/global-frame-witnesses.json',
             'fidelity/painted-polish/advisor-canvas-review.py',
             'fidelity/painted-polish/outcome-advisor-canvas-review.py']
    hashes = {name:hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in names}
    destination = args.output.resolve()
    assert destination.parent == (ROOT / 'dist').resolve(), 'Temporary fixture must be directly inside dune2/dist'
    destination.write_text(template().replace('__FIXTURES__', json.dumps(frames,separators=(',',':')))
                           .replace('__FONTS__', json.dumps(fonts,separators=(',',':')))
                           .replace('__HASHES__', json.dumps(hashes)))
    print(json.dumps(dict(output=str(destination),nativeOutcomeFrames=4,wholeAdvisorCases=12,
                          originalActors=True,productionUI=True,executesDos=False,launchesServer=False)))


if __name__ == '__main__':
    main()
