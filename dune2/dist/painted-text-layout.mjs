// Presentation coverage for native text whose painted widget geometry differs.
// GPL-2.0-only. Literal text and native ink witnesses remain authoritative.
const validRect=rect=>Array.isArray(rect)&&rect.length>=4&&rect.slice(0,4).every(Number.isFinite)&&rect[2]>0&&rect[3]>0;

/** Fixed caption lanes reserve quantity even when that native run is erased.
 * GUI_FactoryWindow_DrawCaption anchors names at128, quantity left of the
 * fixed price template, and prices near264/268 for Czech/English. Layout must
 * never expand a neighbouring word because one observed field is absent. */
export function factoryCaptionRect(run){
  if(!Number.isFinite(run?.x))return null;
  return run.x<220?[132,14,94,16]:run.x<252?[230,14,31,16]:[264,14,44,16];
}

/** Move coverage from the complete immutable native line into its painted box.
 * The source is full line geometry, never a surviving-ink bounding box. This
 * keeps the same affine map through cursor movement, erasure and partial copies.
 * Gaps stay gaps. Fractional clip edges are intentional: rounding outward could
 * resurrect erased text, while rounding inward could remove an initial letter.
 * This transforms presentation coverage, not native glyph pixel positions or
 * their witness values. No valid coverage means no destination coverage.
 */
export function remapTextRunClips(run,targetRect){
  const source=[run?.x,run?.y,run?.width,run?.fontHeight??run?.height];
  if(!validRect(source)||!validRect(targetRect)||!Array.isArray(run?.clips))return[];
  const [sx,sy,sw,sh]=source,[tx,ty,tw,th]=targetRect;
  const identity=sx===tx&&sy===ty&&sw===tw&&sh===th;
  const result=[];
  for(const clip of run.clips){
    if(!validRect(clip))continue;
    const [cx,cy,cw,ch]=clip;
    const left=Math.max(sx,cx),top=Math.max(sy,cy),right=Math.min(sx+sw,cx+cw),bottom=Math.min(sy+sh,cy+ch);
    if(right<=left||bottom<=top)continue;
    const clamped=left===cx&&top===cy&&right===cx+cw&&bottom===cy+ch?clip.slice(0,4):[left,top,right-left,bottom-top];
    if(identity)result.push(clamped);
    else result.push([tx+(left-sx)*tw/sw,ty+(top-sy)*th/sh,clamped[2]*tw/sw,clamped[3]*th/sh]);
  }
  return result;
}
