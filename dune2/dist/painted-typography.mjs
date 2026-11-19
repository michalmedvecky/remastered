// Deterministic Westwood-derived vector lettering. GPL-2.0-only.
// Native text remains authoritative for content, placement, clips and colour.
import fontData from './painted-font-data.mjs';

export const PERIOD_FONT_DATA = fontData;
export const DEFAULT_PERIOD_FACE = fontData.defaultFace;
const faceFor = name => fontData.faces[name] ?? fontData.faces[DEFAULT_PERIOD_FACE];
const capHeight = face => face.baseline-1;

/** Inspect a glyph without browser fonts or DOM state. Unknown input uses the
 * explicit source '?' silhouette; it can never trigger a system-font fallback. */
export function periodGlyph(character, {face=DEFAULT_PERIOD_FACE}={}) {
  const f=faceFor(face);
  return f.glyphs[character] ?? f.glyphs['?'];
}

function shape(value, options={}) {
  const face=faceFor(options.face),glyphs=[];
  let x=0,y=0,maxAdvance=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const character of String(value)){
    if(character==='\r')continue;
    if(character==='\n'){maxAdvance=Math.max(maxAdvance,x);x=0;y+=face.height;continue;}
    const glyph=character==='\t'?face.glyphs[' ']:periodGlyph(character,options);
    if(glyph.ink){
      const [left,top,right,bottom]=glyph.ink;
      minX=Math.min(minX,x+left);maxX=Math.max(maxX,x+right);
      minY=Math.min(minY,y+top-face.baseline);maxY=Math.max(maxY,y+bottom-face.baseline);
      glyphs.push({glyph,x,y:y-face.baseline});
    }
    x+=(character==='\t'?4:1)*(glyph.advance+(options.tracking??0));
  }
  maxAdvance=Math.max(maxAdvance,x);
  return {face,glyphs,width:maxAdvance,ink:Number.isFinite(minX)?[minX,minY,maxX,maxY]:null};
}

/** Canvas-compatible metrics for fitTextBox. Size is cap height in output
 * pixels. Spaces and punctuation retain deterministic native advances;
 * glyph visibility and cursor occlusion do not participate in measurement. */
export function measurePeriodText(value,size,options={}) {
  const shaped=shape(value,options),scale=size/capHeight(shaped.face),b=shaped.ink??[0,0,0,0];
  return {width:shaped.width*scale,actualBoundingBoxLeft:-b[0]*scale,
    actualBoundingBoxRight:b[2]*scale,actualBoundingBoxAscent:Math.max(0,-b[1]*scale),
    actualBoundingBoxDescent:Math.max(0,b[3]*scale)};
}

/** Paint merged vector contours directly, with no text APIs or raster scaling.
 * x/baseline use the exact same origin and metrics as measurePeriodText.
 * stroke is in output pixels, matching fitTextBox's measured outline allowance. */
export function drawPeriodText(ctx,value,x,baseline,size,{fill='#eee4ca',outline='#111921',stroke=0,...options}={}) {
  const shaped=shape(value,options),scale=size/capHeight(shaped.face);
  if(!(scale>0)||!Number.isFinite(scale)||!shaped.glyphs.length)return;
  ctx.save();ctx.translate(x,baseline);ctx.scale(scale,scale);ctx.beginPath();
  for(const {glyph,x:gx,y:gy} of shaped.glyphs)for(const contour of glyph.contours){
    if(!contour.length)continue;
    ctx.moveTo(gx+contour[0][0],gy+contour[0][1]);
    for(let i=1;i<contour.length;i++)ctx.lineTo(gx+contour[i][0],gy+contour[i][1]);
    ctx.closePath();
  }
  if(stroke>0&&outline){ctx.lineJoin='bevel';ctx.lineWidth=stroke/scale;ctx.strokeStyle=outline;ctx.stroke();}
  ctx.fillStyle=fill;ctx.fill('evenodd');ctx.restore();
}
