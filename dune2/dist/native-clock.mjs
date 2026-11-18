// Foreground emulated clock: hiding a tab pauses the browser hardware layer.
export function createClock(read=()=>performance.now()){
  const epoch=read();let pause=null,excluded=0,last=0;
  return {now:()=>last=Math.max(last,(pause??read())-epoch-excluded),visibility(hidden){const time=read();if(hidden&&pause===null)pause=time;else if(!hidden&&pause!==null){excluded+=time-pause;pause=null;}}};
}
