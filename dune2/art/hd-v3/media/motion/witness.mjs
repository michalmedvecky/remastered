/* Pure indexed-frame identification; never turns original pixels into HD art. */
export function matchPortraitWitness(pixels,bank,{screenWidth=320,rect=bank.nativeRect,occluded=null,resource=null,minSamples=8}={}){
  if(!pixels||!bank?.coordinates?.length)return{status:'unknown',reason:'missing-source'};
  const visible=[];
  for(let i=0;i<bank.coordinates.length;i++){
    const [lx,ly]=bank.coordinates[i],x=rect[0]+lx,y=rect[1]+ly,at=y*screenWidth+x;
    if(at<0||at>=pixels.length)continue;
    if(typeof occluded==='function'?occluded(x,y):occluded?.[at])continue;
    visible.push([i,pixels[at]]);
  }
  if(visible.length<minSamples)return{status:'unknown',reason:'insufficient-unoccluded-witnesses',samples:visible.length};
  const candidates=[];
  for(const frame of bank.frames){
    if(resource&&frame.resource!==resource)continue;
    const signature=Uint8Array.from(atob(frame.signatureBase64),c=>c.charCodeAt(0));
    if(visible.every(([i,value])=>signature[i]===value))candidates.push(frame);
  }
  if(!candidates.length)return{status:'unknown',reason:'no-exact-native-match',samples:visible.length};
  const distinct=new Set(candidates.map(f=>f.pixelSha256));
  return{status:distinct.size===1?'matched':'ambiguous',samples:visible.length,
    distinctImages:distinct.size,frames:candidates.map(({resource,frame,pixelSha256})=>({resource,frame,pixelSha256}))};
}
