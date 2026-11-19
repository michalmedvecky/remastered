// Native indexed text observations for the focused Canvas regression only.
// This file is not imported by the game runtime.
const all=[0,0,320,200];
const raw=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const overlap=(a,b)=>{const x=Math.max(a[0],b[0]),y=Math.max(a[1],b[1]),r=Math.min(a[0]+a[2],b[0]+b[2]),d=Math.min(a[1]+a[3],b[1]+b[3]);return r>x&&d>y?[x,y,r-x,d-y]:null;};
const inside=(x,y,r)=>x>=r[0]&&y>=r[1]&&x<r[0]+r[2]&&y<r[1]+r[3];
export function nativeWidth(font,value,encode,offset){return [...encode(value)].reduce((n,c)=>n+font.chars[c].width+offset,0);}
export function blankFrame(indices,palette,worldVisible=false){return{version:2,pixels:indices.slice(),palette:palette.slice(),worldVisible,worldAvailable:worldVisible,playerHouse:1,textEncoding:'windows-1250',textRuns:[],textGlyphs:[],uiCommands:[],borders:[],cursor:{visible:false,id:0,x:0,y:0,hotX:0,hotY:0},_owners:new Int32Array(64000).fill(-1),_glyphs:[],_serial:0};}
export function addBorder(frame,[x,y,width,height],widgetIndex=19){for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++)if(inside(xx,yy,all))frame.pixels[yy*320+xx]=12;frame.borders.push({x,y,width,height,widgetIndex,fill:true,pressed:false,screen:0,serial:++frame._serial,sourceSerial:frame._serial});}
export function addText(frame,{font,value,encode,fontId=1,offset=-1,x,y,centerX=null,foreground=15,shadow=true,copyRect=all}){
 const textBytes=[...encode(value)],advance=nativeWidth(font,value,encode,offset);if(centerX!==null)x=centerX-Math.floor(advance/2);
 const start=x,colours=[0,foreground,shadow?12:0,0,...Array(12).fill(0)],run={text:value,textBytes,x,y,width:0,height:font.height,fontHeight:font.height,font:fontId,colours,runId:++frame._serial,serial:frame._serial,sourceSerial:frame._serial,glyphs:[],visibleInk:0,totalInk:0,ink:[],clips:[]};
 for(const[index,char]of textBytes.entries()){
  const g=font.chars[char],data=raw(g.nibblesBase64),glyph={char,index,x,y,width:g.width,height:font.height,fontHeight:font.height,font:fontId,advance:g.width+offset,colours,serial:run.serial+index/4294967296,sourceSerial:run.serial+index,visibleInk:0,totalInk:0,ink:[],_id:frame._glyphs.length,_points:[]};
  for(let yy=0;yy<g.usedLines;yy++)for(let xx=0;xx<g.width;xx++){
   const colour=colours[data[yy*g.width+xx]];if(!colour)continue;glyph.totalInk++;
   const sx=x+xx,sy=y+g.unusedLines+yy;if(!inside(sx,sy,all)||!inside(sx,sy,copyRect))continue;
   frame.pixels[sy*320+sx]=colour;frame._owners[sy*320+sx]=glyph._id;glyph._points.push([xx,g.unusedLines+yy,colour]);
  }
  frame._glyphs.push(glyph);run.glyphs.push(glyph);run.width=Math.max(run.width,x+g.width-start);x+=glyph.advance;
 }
 const clipped=overlap([run.x,run.y,run.width,run.fontHeight],copyRect);run.clips=clipped?[clipped]:[];run.clip=clipped;frame.textRuns.push(run);return run;
}
export function addSprite(frame,source,id,x,y){
 const command={id,x,y,width:source.sourceW,height:source.sourceH,flags:0,screen:0,serial:++frame._serial,sourceSerial:frame._serial,nativeClip:all.slice(),ink:[],totalInk:0};
 for(let yy=0;yy<source.sourceH;yy++)for(let xx=0;xx<source.sourceW;xx++)if(source.mask[yy*source.sourceW+xx]){
  const index=source.indices[yy*source.sourceW+xx],value=source.paletteMode==='local16'?source.palette[index]:index,sx=x+xx,sy=y+yy;if(!inside(sx,sy,all))continue;frame.pixels[sy*320+sx]=value;command.ink.push([xx,yy,value]);command.totalInk++;
 }
 command.visibleInk=command.ink.length;const xs=command.ink.map(p=>p[0]),ys=command.ink.map(p=>p[1]),l=Math.min(...xs),t=Math.min(...ys);command.clip=[x+l,y+t,Math.max(...xs)-l+1,Math.max(...ys)-t+1];frame.uiCommands.push(command);return command;
}
export function finishFrame(frame){
 for(const run of frame.textRuns){for(const glyph of run.glyphs){glyph.ink=glyph._points.filter(([x,y])=>frame._owners[(glyph.y+y)*320+glyph.x+x]===glyph._id);glyph.visibleInk=glyph.ink.length;glyph.clip=[glyph.x,glyph.y,glyph.width,glyph.height];run.totalInk+=glyph.totalInk;run.visibleInk+=glyph.visibleInk;for(const[x,y,v]of glyph.ink)run.ink.push([glyph.x+x-run.x,glyph.y+y-run.y,v]);if(glyph.visibleInk)frame.textGlyphs.push(glyph);delete glyph._points;delete glyph._id;}}
 frame.uiPixels=frame.pixels.slice();delete frame._owners;delete frame._glyphs;delete frame._serial;return frame;
}
export function widenTextCoverage(frame){return{...frame,textRuns:frame.textRuns.map(run=>({...run,clips:[all.slice()],clip:all.slice()})),uiCommands:frame.uiCommands.map(c=>({...c,clip:[c.x,c.y,c.width,c.height]}))};}
export function blankCaptions(frame){return{...frame,textRuns:frame.textRuns.map(run=>({...run,text:' '.repeat([...run.text].length)}))};}
