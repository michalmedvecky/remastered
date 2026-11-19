// Deterministically pack retained whole-object ImageGen interface artwork.
// No game execution, network access, or original-resource mutation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodePNG,encodePNG} from './painted-png.mjs';
import {mapRecords} from './build-painted-icons-map.mjs';
import {campaignBoundaryPaths} from './painted-campaign-contours.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ART=path.join(ROOT,'art/hd-v3/interface'),OUT=path.join(ROOT,'dist/painted');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inventory=JSON.parse(fs.readFileSync(path.join(ART,'native-inventory.json'),'utf8'));
const raws={},provenance={};
for(const name of ['hud','factory','dialog','controls','herald','advisor-h','advisor-a','advisor-o','advisor-m','campaign-map','campaign-shell','campaign-planet','score-shell']){
 const bytes=fs.readFileSync(path.join(ART,'raw',name+'.png'));
 const meta=JSON.parse(fs.readFileSync(path.join(ART,'raw',name+'-generation.json'),'utf8'));
 if(sha(bytes)!==meta.sha256)throw Error('Raw ImageGen asset changed: '+name);
 const prompt='art/hd-v3/interface/raw/'+meta.prompt;
 raws[name]=decodePNG(bytes);provenance[name]={path:'art/hd-v3/interface/raw/'+name+'.png',sha256:sha(bytes),prompt,promptSHA256:sha(fs.readFileSync(path.join(ROOT,prompt))),dimensions:[raws[name].width,raws[name].height],method:'built-in-imagegen-whole-object'};
}
const surface=(w,h)=>({width:w,height:h,pixels:new Uint8Array(w*h*4)});
function blit(dest,source,[sx,sy,sw,sh],[dx,dy,dw,dh]){
 // Alpha-aware bilinear resampling only for whole generated components.
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
  const fx=sx+(x+.5)*sw/dw-.5,fy=sy+(y+.5)*sh/dh-.5;
  const x0=Math.max(sx,Math.min(sx+sw-1,Math.floor(fx))),y0=Math.max(sy,Math.min(sy+sh-1,Math.floor(fy)));
  const x1=Math.min(sx+sw-1,x0+1),y1=Math.min(sy+sh-1,y0+1),wx=Math.max(0,Math.min(1,fx-x0)),wy=Math.max(0,Math.min(1,fy-y0));
  let a=0,r=0,g=0,b=0;
  for(const[xx,yy,weight]of[[x0,y0,(1-wx)*(1-wy)],[x1,y0,wx*(1-wy)],[x0,y1,(1-wx)*wy],[x1,y1,wx*wy]]){const p=(yy*source.width+xx)*4,alpha=source.pixels[p+3]/255*weight;a+=alpha;r+=source.pixels[p]*alpha;g+=source.pixels[p+1]*alpha;b+=source.pixels[p+2]*alpha;}
  const p=((dy+y)*dest.width+dx+x)*4;if(a){dest.pixels[p]=Math.round(r/a);dest.pixels[p+1]=Math.round(g/a);dest.pixels[p+2]=Math.round(b/a);}dest.pixels[p+3]=Math.round(a*255);
 }
}
function clear(image,rect){const[x,y,w,h]=rect.map(v=>v*4);for(let yy=y;yy<y+h;yy++)image.pixels.fill(0,(yy*image.width+x)*4,(yy*image.width+x+w)*4);}
function nativeBlit(dest,source,src,rect){blit(dest,source,src,rect.map(v=>v*4));}
const atlas=surface(2560,2400),frames={},packing=[];
function add(id,image,rect,meta={}){blit(atlas,image,[0,0,image.width,image.height],rect);frames[id]={atlas:'chrome',rect,nativeRect:[0,0,image.width/4,image.height/4],kind:'painted-interface-surface',status:'painted-whole-object',...meta};packing.push({id,rect,...meta});}
const rawRect=name=>[0,0,raws[name].width,raws[name].height];
const buttonCrops=[[56,126,1428,168],[56,427,1428,168],[56,727,1428,168]];
const button=surface(312,64);blit(button,raws.controls,buttonCrops[0],[0,0,312,64]);
const hud=surface(1280,800);
nativeBlit(hud,raws.hud,[0,0,1586,85],[0,0,320,18]);
nativeBlit(hud,raws.hud,[0,85,1586,97],[0,18,320,22]);
nativeBlit(hud,raws.hud,[1150,182,78,810],[240,40,16,160]);
nativeBlit(hud,raws.hud,[1228,182,358,377],[256,40,64,85]);
nativeBlit(hud,raws.hud,[1228,559,358,38],[256,125,64,9]);
nativeBlit(hud,raws.hud,[1228,597,358,395],[256,134,64,66]);
nativeBlit(hud,button,[0,0,312,64],[16,1,78,16]);
nativeBlit(hud,button,[0,0,312,64],[104,1,78,16]);
nativeBlit(hud,raws.hud,[1200,0,386,85],[192,0,128,18]);
const wells=[{id:'mentat',nativeRect:[16,1,78,16]},{id:'options',nativeRect:[104,1,78,16]},{id:'credits',nativeRect:[192,0,128,19]},{id:'message',nativeRect:[8,21,304,14]},{id:'action-name',nativeRect:[256,42,64,9]},{id:'selection-picture',nativeRect:[258,51,32,24]},{id:'health',nativeRect:[293,52,24,7]},{id:'damage-label',nativeRect:[292,60,28,14]},{id:'actions',nativeRect:[258,76,60,46]},{id:'radar',nativeRect:[256,136,64,64]}];
const transparentRects=[[0,40,240,160],[256,136,64,64]];
for(const rect of transparentRects)clear(hud,rect);
add('hud-shell',hud,[0,0,1280,800],{nativeRect:[0,0,320,200],sourceResource:'SCREEN.CPS',housePaint:true,liveWells:wells,transparentRects,evidence:'GUI_DrawInterfaceAndRadar; g_table_gameWidgetInfo; g_widgetProperties'});
const frameOnly={...hud,pixels:hud.pixels.slice()};
const moreHoles=[[16,1,78,16],[104,1,78,16],[192,0,128,19],[8,21,304,14],[256,42,64,82]];
for(const rect of moreHoles)clear(frameOnly,rect);
add('hud-frame-only',frameOnly,[1280,0,1280,800],{nativeRect:[0,0,320,200],sourceResource:'SCREEN.CPS',housePaint:true,liveWells:wells,transparentRects:[...transparentRects,...moreHoles],status:'painted-whole-object-with-native-well-cutouts'});
const factory=surface(1280,800);
for(const[src,dst]of[[[0,0,285,270],[0,0,64,54]],[[0,270,285,426],[0,54,64,91]],[[0,696,285,296],[0,145,64,55]],[[285,0,270,992],[64,0,48,200]],[[550,0,25,992],[112,0,8,200]],[[555,0,1031,187],[120,0,200,40]],[[555,187,1031,609],[120,40,200,124]],[[555,796,1031,196],[120,164,200,36]]])nativeBlit(factory,raws.factory,src,dst);
clear(factory,[128,48,184,112]);
add('factory-shell',factory,[0,800,1280,800],{nativeRect:[0,0,320,200],sourceResource:'CHOAM.CPS',housePaint:true,transparentRects:[[128,48,184,112]],liveWells:[{id:'credits',nativeRect:[192,0,128,19]},{id:'order-list',nativeRect:[64,0,48,200]},{id:'selected-name',nativeRect:[128,18,184,20]},{id:'portrait-animation',nativeRect:[128,48,184,112]},{id:'factory-actions',nativeRect:[120,164,200,36]},{id:'upper-crest',nativeRect:[0,8,56,40]},{id:'lower-crest',nativeRect:[0,152,56,40]}],evidence:'GUI_FactoryWindow_Init; native WSA_DisplayFrame128,48'});
const herald=surface(1280,800);
// Original choice background is black. Retain that negative space and place
// each whole generated emblem/chain/nameplate in its exact native component.
for(let i=0;i<herald.pixels.length;i+=4){herald.pixels[i]=1;herald.pixels[i+1]=3;herald.pixels[i+2]=9;herald.pixels[i+3]=255;}
for(const[src,x]of[[[109,258,403,312],20],[[591,258,405,312],117],[[1075,258,403,312],214]])nativeBlit(herald,raws.herald,src,[x,54,82,76]);
for(const[src,x]of[[[137,570,345,66],26],[[621,570,343,66],123],[[1102,570,346,66],220]])nativeBlit(herald,raws.herald,src,[x,130,71,2]);
for(const[src,x]of[[[137,636,345,64],26],[[621,636,343,64],123],[[1102,636,346,64],220]])nativeBlit(herald,raws.herald,src,[x,132,71,13]);
const houseLabels=[{text:'Select your House',anchor:[160,18],align:'center',style:'serif-title'},{text:'Atreides',anchor:[61,133],align:'center',style:'serif-house'},{text:'Ordos',anchor:[158,133],align:'center',style:'serif-house'},{text:'Harkonnen',anchor:[255,133],align:'center',style:'serif-house'}];
add('house-choice',herald,[1280,800,1280,800],{nativeRect:[0,0,320,200],sourceResource:'HERALD.ENG',housePaint:false,labels:houseLabels,clickRegions:[{house:1,nativeRect:[16,56,96,104]},{house:2,nativeRect:[112,56,96,104]},{house:0,nativeRect:[208,56,96,104]}],evidence:'GUI_PickHouse l_houses; HERALD.ENG'});
const menu=surface(960,536);blit(menu,raws.dialog,[0,0,1642,202],[0,0,960,76]);blit(menu,raws.dialog,[0,202,1642,756],[0,76,960,460]);
add('menu-plate',menu,[0,1600,960,536],{nineSlice:[4,20,4,4],sourceResource:'GUI_DrawBorder',housePaint:true,titleBaseline:14,contentInsets:[5,21,5,5]});
const inset=surface(384,256);blit(inset,raws.factory,[557,188,1029,607],[0,0,384,256]);
add('widget-inset',inset,[960,1600,384,256],{nineSlice:[3,3,3,3],housePaint:false,sourceResource:'GUI_DrawBorder'});
const border={...inset,pixels:inset.pixels.slice()};clear(border,[3,3,90,58]);
add('frame-border',border,[1344,1600,384,256],{nineSlice:[3,3,3,3],transparentRects:[[3,3,90,58]],housePaint:false,sourceResource:'GUI_DrawBorder'});
for(const[i,id]of['widget-button','widget-button-pressed','widget-button-disabled'].entries()){
 const image=surface(312,64);blit(image,raws.controls,buttonCrops[i],[0,0,312,64]);add(id,image,[960,1856+i*64,312,64],{nineSlice:[8,4,8,4],housePaint:i!==2,sourceResource:'GUI_Widget_TextButton_Draw',nativeState:i===0?'normal':i===1?'pressed':'disabled'});
}
const message=surface(1280,80);blit(message,raws.hud,[0,85,1586,97],[0,0,1280,80]);
add('message-inset',message,[0,2136,1280,80],{nineSlice:[4,3,4,3],housePaint:false,sourceResource:'SCREEN.CPS'});
for(const[id,w,x]of[['house-confirm-question',208,0],['house-confirm-name',104,832]]){
 const image=surface(w*4,96);blit(image,raws.hud,[0,85,1586,97],[0,0,w*4,96]);add(id,image,[x,2216,w*4,96],{nineSlice:[4,3,4,3],housePaint:false,sourceResource:'MISC.ENG',status:'painted-reused-blank-surface',sourcePlacement:id.endsWith('question')?[0,0,208,24]:[0,24,104,24],destinationNativeRect:id.endsWith('question')?[0,0,208,24]:[208,0,104,24]});
}
const advisorAtlas=surface(2560,1600),advisorRows={h:{house:0,eyes:[32,88,48,24],mouth:[32,104,56,40],shoulder:[128,104,16,56]},a:{house:1,eyes:[40,80,48,16],mouth:[40,96,48,40],shoulder:[128,128,24,32],book:[72,152,96,48]},o:{house:2,eyes:[16,80,56,16],mouth:[16,96,64,40],shoulder:[128,128,24,32],ring:[88,144,16,16]},m:{house:5,eyes:[64,80,48,16],mouth:[56,96,56,48]}};
for(const[i,name]of['h','a','o','m'].entries()){
 const id='advisor-'+name,image=surface(1280,800),rect=[i%2*1280,Math.floor(i/2)*800,1280,800];blit(image,raws[id],rawRect(id),[0,0,1280,800]);blit(advisorAtlas,image,[0,0,1280,800],rect);
 fs.writeFileSync(path.join(ART,'review',id+'-base.png'),encodePNG(1280,800,image.pixels));
 frames[id]={atlas:'advisors',rect,nativeRect:[0,0,320,200],kind:'painted-whole-advisor',status:'painted-whole-object',housePaint:false,sourceResource:'MENTAT'+name.toUpperCase()+'.CPS',mediaWell:[128,48,184,112],nativePatches:advisorRows[name],paletteResource:name==='m'?'BENE.PAL':'IBM.PAL',evidence:'GUI_Mentat_Display; s_mentatSpritePositions; matched patches owned by icons bank'};
 packing.push({id,atlas:'advisors',rect});
}
const scenes=structuredClone(inventory.scenes);
const campaignAtlas=surface(2560,1600),campaignFrames={},campaignMap=surface(1216,480),campaignShell=surface(1280,800);blit(campaignMap,raws['campaign-map'],rawRect('campaign-map'),[0,0,1216,480]);blit(campaignShell,raws['campaign-shell'],rawRect('campaign-shell'),[0,0,1280,800]);clear(campaignShell,[8,24,304,120]);
const campaignLines=surface(1216,480),nativeRegions=[],vectorRegions=mapRecords({frames:inventory.campaign.shapes,palette:inventory.campaign.palette});
function strokeSegment(a,b){const x0=a[0]*4,y0=a[1]*4,x1=b[0]*4,y1=b[1]*4,dx=x1-x0,dy=y1-y0,length=dx*dx+dy*dy;for(let y=Math.max(0,Math.floor(Math.min(y0,y1)-2));y<Math.min(480,Math.ceil(Math.max(y0,y1)+2));y++)for(let x=Math.max(0,Math.floor(Math.min(x0,x1)-2));x<Math.min(1216,Math.ceil(Math.max(x0,x1)+2));x++){const t=length?Math.max(0,Math.min(1,((x+.5-x0)*dx+(y+.5-y0)*dy)/length)):0,d=Math.hypot(x+.5-x0-t*dx,y+.5-y0-t*dy),alpha=Math.round(Math.max(0,Math.min(1,1.7-d))*190),p=(y*1216+x)*4;if(alpha>campaignLines.pixels[p+3]){campaignLines.pixels[p]=45;campaignLines.pixels[p+1]=25;campaignLines.pixels[p+2]=12;campaignLines.pixels[p+3]=alpha;}}}
for(let region=1;region<=27;region++){const[x,y]=inventory.campaign.positions[region],record=vectorRegions.get(477+region),paths=record.evidence.paths.map(points=>points.map(p=>[p[0]+x,p[1]+y]));nativeRegions.push({region,spriteId:477+region,offset:[x,y],paths});}
const boundaryNetworkPaths=campaignBoundaryPaths(Buffer.from(inventory.campaign.semanticClickData.indicesBase64,'base64'));for(const points of boundaryNetworkPaths)for(let i=0;i<points.length-1;i++)strokeSegment(points[i],points[i+1]);
const divided={...campaignMap,pixels:campaignMap.pixels.slice()};for(let p=0;p<divided.pixels.length;p+=4){const a=campaignLines.pixels[p+3]/255;for(let c=0;c<3;c++)divided.pixels[p+c]=Math.round(divided.pixels[p+c]*(1-a)+campaignLines.pixels[p+c]*a);}
function addCampaign(id,image,rect,meta){blit(campaignAtlas,image,[0,0,image.width,image.height],rect);campaignFrames[id]={atlas:'campaign',rect,kind:'painted-campaign-interface',status:'painted-whole-object',housePaint:false,...meta};packing.push({id,atlas:'campaign',rect});}
addCampaign('campaign-shell',campaignShell,[0,0,1280,800],{nativeRect:[0,0,320,200],sourceResource:'MAPMACH.CPS',housePaint:true,transparentRects:[[8,24,304,120]],liveWells:[{id:'title',nativeRect:[8,0,304,24]},{id:'message',nativeRect:[64,164,192,18]},{id:'crest-left',nativeRect:[0,152,56,40]},{id:'crest-right',nativeRect:[264,152,56,40]}],labels:[{text:'Select your next conquest',anchor:[160,1],align:'center',style:'serif-title'}]});
addCampaign('campaign-undivided',campaignMap,[1280,0,1216,480],{nativeRect:[8,24,304,120],sourceResource:'DUNEMAP.CPS'});
addCampaign('campaign-regions',divided,[1280,480,1216,480],{nativeRect:[8,24,304,120],sourceResource:'DUNERGN.CPS',status:'painted-whole-map-with-native-vector-boundaries'});
addCampaign('campaign-region-lines',campaignLines,[0,800,1216,480],{nativeRect:[8,24,304,120],sourceResource:'PIECES.SHP + REGION?.INI',status:'analytic-native-vector-boundaries'});
const planetFull=surface(1280,800),planetCrop=surface(1216,480);blit(planetFull,raws['campaign-planet'],rawRect('campaign-planet'),[0,0,1280,800]);blit(planetCrop,planetFull,[32,96,1216,480],[0,0,1216,480]);addCampaign('campaign-planet',planetCrop,[1280,960,1216,480],{nativeRect:[8,24,304,120],sourceResource:'PLANET.CPS'});
Object.assign(frames,campaignFrames);
const scoreImage=surface(1280,800);nativeBlit(scoreImage,raws['score-shell'],[0,0,1568,130],[0,0,320,32]);nativeBlit(scoreImage,raws['score-shell'],[0,130,1568,140],[0,32,320,42]);nativeBlit(scoreImage,raws['score-shell'],[0,270,1568,733],[0,74,320,126]);nativeBlit(scoreImage,raws['score-shell'],[50,450,1450,220],[8,80,304,112]);nativeBlit(scoreImage,raws['score-shell'],[50,680,254,263],[0,8,56,56]);nativeBlit(scoreImage,raws['score-shell'],[50,680,254,263],[264,8,56,56]);
frames['score-shell']={atlas:'postgame',rect:[0,0,1280,800],nativeRect:[0,0,320,200],kind:'painted-postgame-interface',status:'painted-whole-object-composed-like-native-background',housePaint:true,sourceResource:'FAME.CPS',liveWells:[{id:'score-time',nativeRect:[64,10,192,20]},{id:'rank',nativeRect:[64,34,192,29]},{id:'scoreboard',nativeRect:[8,80,304,112]}],crestWells:[{nativeRect:[0,8,56,56],house:'player'},{nativeRect:[264,8,56,56],house:'player'}],evidence:'GUI_HallOfFame_DrawBackground copies selected native crest to upper corners then clears lower atlas crest bank; statistics and Hall-of-Fame text/bars are live native contents'};packing.push({id:'score-shell',atlas:'postgame',rect:[0,0,1280,800]});
Object.assign(scenes['SCREEN.CPS'],{asset:'hud-shell'});Object.assign(scenes['CHOAM.CPS'],{asset:'factory-shell'});Object.assign(scenes['HERALD.ENG'],{asset:'house-choice',labels:houseLabels});
Object.assign(scenes['TITLE.ENG'],{asset:null,render:'vector-title',labels:[{text:'DUNE II',anchor:[160,60],align:'center',style:'large-red-serif',nativeRect:[53,60,216,39]},{text:'The Building of a Dynasty',anchor:[160,106],align:'center',style:'red-serif',nativeRect:[52,106,216,13]}],note:'Original title contains lettering on black; root renders sharp vector lettering.'});
Object.assign(scenes['MISC.ENG'],{asset:null,render:'house-confirmation-strips',question:'Do you wish to join House',questionAsset:'house-confirm-question',nameAsset:'house-confirm-name',questionRect:[0,0,208,24],nameRect:[208,0,104,24],names:{0:'Harkonnen?',1:'Atreides?',2:'Ordos?'},sourceNameRects:{0:[0,24,104,24],1:[0,48,104,24],2:[0,72,104,24]}});
for(const name of['h','a','o','m'])Object.assign(scenes['MENTAT'+name.toUpperCase()+'.CPS'],{asset:'advisor-'+name,paletteResource:name==='m'?'BENE.PAL':'IBM.PAL',mediaWell:[128,48,184,112],housePaint:false});
Object.assign(scenes['MAPMACH.CPS'],{asset:'campaign-shell',displayNativeRect:[0,0,320,200]});Object.assign(scenes['DUNEMAP.CPS'],{asset:'campaign-undivided',displayNativeRect:[8,24,304,120]});Object.assign(scenes['DUNERGN.CPS'],{asset:'campaign-regions',displayNativeRect:[8,24,304,120],regionLinesAsset:'campaign-region-lines'});
Object.assign(scenes['PLANET.CPS'],{asset:'campaign-planet',displayNativeRect:[8,24,304,120]});
Object.assign(scenes['FAME.CPS'],{asset:'score-shell',displayNativeRect:[0,0,320,200],sourceComposition:'Selected crest is copied from source atlas y136 into upper corners [0,8,56,56] and[264,8,56,56]; original lower crest bank is cleared. All score/rank/list values remain native text.'});
const bytes=encodePNG(atlas.width,atlas.height,atlas.pixels),hash=sha(bytes),filename='interface-'+hash.slice(0,16)+'.png';fs.mkdirSync(OUT,{recursive:true});
const advisorBytes=encodePNG(advisorAtlas.width,advisorAtlas.height,advisorAtlas.pixels),advisorHash=sha(advisorBytes),advisorFilename='interface-advisors-'+advisorHash.slice(0,16)+'.png';
const campaignBytes=encodePNG(campaignAtlas.width,campaignAtlas.height,campaignAtlas.pixels),campaignHash=sha(campaignBytes),campaignFilename='interface-campaign-'+campaignHash.slice(0,16)+'.png';
const scoreBytes=encodePNG(scoreImage.width,scoreImage.height,scoreImage.pixels),scoreHash=sha(scoreBytes),scoreFilename='interface-postgame-'+scoreHash.slice(0,16)+'.png';
for(const file of fs.readdirSync(OUT))if(/^interface-(?:(?:advisors|campaign|postgame)-)?[a-f0-9]{16}\.png$/.test(file)&&file!==filename&&file!==advisorFilename&&file!==campaignFilename&&file!==scoreFilename)fs.unlinkSync(path.join(OUT,file));
fs.writeFileSync(path.join(OUT,filename),bytes);
fs.writeFileSync(path.join(OUT,advisorFilename),advisorBytes);
fs.writeFileSync(path.join(OUT,campaignFilename),campaignBytes);
fs.writeFileSync(path.join(OUT,scoreFilename),scoreBytes);
const result={schema:1,scale:4,baseHouse:1,purpose:'Whole-painted native interface chrome; original hitboxes, live native text and icons supplied separately',atlases:{chrome:{src:'painted/'+filename,sha256:hash,w:atlas.width,h:atlas.height}},frames,scenes,source:{archives:inventory.archives,resources:Object.fromEntries(inventory.backgrounds.map(r=>[r.resource,r.sha256])),art:provenance},windowLayouts:{options:{widget:16,nativeRect:[40,48,240,134]},gameControls:{widget:16,nativeRect:[40,48,240,134]},saveLoad:{widget:17,nativeRect:[24,36,288,148]},saveDescription:{widget:14,nativeRect:[16,89,288,60]},yesNo:{widget:18,nativeRect:[8,72,304,52]}},gameWidgets:inventory.gameWidgets,coverage:{paintedFrames:Object.keys(frames).length,indexedSceneReferences:Object.keys(scenes).length,nativeHitboxes:inventory.gameWidgets.length,allArchiveHashesVerified:true},limits:['Live minimap remains an indexed data visualization; its native resolution encodes map cells.','Factory WSA portrait/animation well is transparent and owned by the native media/art layer.','Window title and label contents are drawn from native semantic text, never baked into these surfaces.','Generated components are resized to native functional rectangles; this is new artwork, not literal pixel-palette reproduction.']};
result.atlases.advisors={src:'painted/'+advisorFilename,sha256:advisorHash,w:advisorAtlas.width,h:advisorAtlas.height};
result.atlases.campaign={src:'painted/'+campaignFilename,sha256:campaignHash,w:campaignAtlas.width,h:campaignAtlas.height};result.campaign={nativeRect:[8,24,304,120],regions:nativeRegions,boundaryNetworkPaths,boundaryAlgorithm:'One shared region-ID boundary network from original RGNCLK. Invalid-border cells assigned nearest regions in a private visual copy only; centreline simplification0.8nativepx with two local corner-rounding passes, antialiased stroke. Shared borders drawn once.',sourceSHA256:inventory.campaign.sourceSHA256,semanticClickData:inventory.campaign.semanticClickData,note:'RGNCLK remains authoritative unchanged data; source province boundaries are rendered as smooth antialiased paths over one continuous new terrain painting. No click geometry changes.'};
result.atlases.postgame={src:'painted/'+scoreFilename,sha256:scoreHash,w:1280,h:800};
const campaignComposition=JSON.parse(fs.readFileSync(path.join(ROOT,'art/hd-v3/media/motion/campaign/composition.json'),'utf8'));
for(const resource of campaignComposition.resources)if(result.scenes[resource.resource]&&result.scenes[resource.resource].sourceSHA256!==resource.sourceSha256)throw Error('Campaign composition source differs: '+resource.resource);
result.campaignComposition=campaignComposition;
const shellWitnesses=result.campaignComposition.witnesses['MAPMACH.CPS'];for(const point of result.scenes['MAPMACH.CPS'].witnesses){if(shellWitnesses.length>=48)break;const[x,y,v]=point;if((x<8||x>=312||y>=192)&&!(v>=144&&v<=159)&&v!==223&&v<251&&!shellWitnesses.some(p=>p[0]===x&&p[1]===y))shellWitnesses.push(point);}
for(const name of['MAPMACH.CPS','DUNEMAP.CPS','DUNERGN.CPS']){result.scenes[name].displayWitnesses=campaignComposition.witnesses[name];result.scenes[name].displayWitnessRequiresShell=name!=='MAPMACH.CPS';}
const planetWitnesses=result.scenes['PLANET.CPS'].witnesses;result.scenes['PLANET.CPS'].displayWitnesses=Array.from({length:48},(_,i)=>planetWitnesses[Math.floor(i*planetWitnesses.length/48)]);result.scenes['PLANET.CPS'].displayWitnessRequiresShell=true;
result.campaignComposition.witnesses['PLANET.CPS']=result.scenes['PLANET.CPS'].displayWitnesses;
result.crestCompositions=inventory.crestCompositions;
fs.writeFileSync(path.join(OUT,'interface.json'),JSON.stringify(result)+'\n');
fs.writeFileSync(path.join(ART,'packing.json'),JSON.stringify({schema:1,atlases:result.atlases,packing,raws:provenance},null,2)+'\n');
fs.writeFileSync(path.join(ART,'review/hud-shell.png'),encodePNG(hud.width,hud.height,hud.pixels));
fs.writeFileSync(path.join(ART,'review/house-choice.png'),encodePNG(herald.width,herald.height,herald.pixels));
fs.writeFileSync(path.join(ART,'review/campaign-regions.png'),encodePNG(divided.width,divided.height,divided.pixels));
fs.writeFileSync(path.join(ART,'review/score-shell.png'),scoreBytes);
console.log(JSON.stringify({manifest:'dist/painted/interface.json',atlas:filename,sha256:hash,frames:Object.keys(frames).length,scenes:Object.keys(scenes).length}));
