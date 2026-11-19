// Semantic click-ID boundaries become one smooth stroke network. Unlike
// separately outlining each region sprite, shared borders are drawn once.
export function campaignBoundaryPaths(indices,width=304,height=120){
 // Fill invalid-border cells only in a private visual working copy. The
 // authoritative click-ID bytes are never changed. Their nearest regions
 // define one shared boundary, including places without explicit zero cells.
 const labels=Uint8Array.from(indices),queue=new Int32Array(width*height);let head=0,tail=0;
 for(let n=0;n<labels.length;n++)if(labels[n])queue[tail++]=n;
 while(head<tail){const n=queue[head++],x=n%width,y=Math.floor(n/width);for(const next of[x? n-1:-1,x<width-1?n+1:-1,y?n-width:-1,y<height-1?n+width:-1])if(next>=0&&!labels[next]){labels[next]=labels[n];queue[tail++]=next;}}
 const nodes=new Map(),stride=width+1,size=stride*(height+1),add=(a,b)=>{if(!nodes.has(a))nodes.set(a,[]);if(!nodes.has(b))nodes.set(b,[]);nodes.get(a).push(b);nodes.get(b).push(a);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const n=y*width+x;if(x<width-1&&labels[n]!==labels[n+1])add(y*stride+x+1,(y+1)*stride+x+1);if(y<height-1&&labels[n]!==labels[n+width])add((y+1)*stride+x,(y+1)*stride+x+1);}
 const key=(a,b)=>Math.min(a,b)*size+Math.max(a,b),used=new Set(),paths=[];
 function trace(a,b){const points=[[a%stride,Math.floor(a/stride)]];let previous=a,current=b;used.add(key(a,b));for(let guard=0;guard<size;guard++){points.push([current%stride,Math.floor(current/stride)]);const choices=nodes.get(current);if(choices.length!==2)break;const next=choices.find(n=>n!==previous);if(next===undefined||used.has(key(current,next)))break;used.add(key(current,next));previous=current;current=next;}if(points.length>=2)paths.push(points);}
 for(const[n,neighbors]of nodes)if(neighbors.length!==2)for(const next of neighbors)if(!used.has(key(n,next)))trace(n,next);
 for(const[n,neighbors]of nodes)for(const next of neighbors)if(!used.has(key(n,next)))trace(n,next);
 const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
 function simplify(points){if(points.length<=2)return points;let maximum=0,at=0;for(let i=1;i<points.length-1;i++){const d=distance(points[i],points[0],points.at(-1));if(d>maximum){maximum=d;at=i;}}return maximum>.8?[...simplify(points.slice(0,at+1)).slice(0,-1),...simplify(points.slice(at))]:[points[0],points.at(-1)];}
 return paths.map(path=>{let points=simplify(path);for(let pass=0;pass<2;pass++){const next=[points[0]];for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1];next.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}next.push(points.at(-1));points=next;}return points;});
}
