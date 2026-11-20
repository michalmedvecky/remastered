// Read-only presentation helpers. Native layout and ink decide what is visible.
import {mappedIndex} from './hd-core.mjs';
import {decodeNativeCharacter} from './native-text.mjs';

export function intersectRect(a, b) {
  const x = Math.max(a[0], b[0]), y = Math.max(a[1], b[1]);
  const right = Math.min(a[0] + a[2], b[0] + b[2]);
  const bottom = Math.min(a[1] + a[3], b[1] + b[3]);
  return right > x && bottom > y ? [x, y, right - x, bottom - y] : null;
}

export function insideRect(x, y, rect) {
  return x >= rect[0] && y >= rect[1] && x < rect[0] + rect[2] && y < rect[1] + rect[3];
}

export function glyphCharacter(value,encoding='cp437') {
  if (!Number.isInteger(value) || value < 32 || value === 127 || value > 255) return '';
  return decodeNativeCharacter(value,encoding);
}

export function glyphInkVisibility(glyph, pixels) {
  if (!pixels || pixels.length !== 64000 || !Array.isArray(glyph.ink)) return {visible: 0, total: 0, ratio: 0};
  const clip = intersectRect(glyph.clip ?? [0, 0, 320, 200], [0, 0, 320, 200]);
  let total = 0, visible = 0;
  for (const ink of glyph.ink) {
    const [localX, localY, index] = ink;
    const x = glyph.x + localX, y = glyph.y + localY;
    if (!clip || !insideRect(x, y, clip)) continue;
    total++;
    if (pixels[y * 320 + x] === index) visible++;
  }
  return {visible, total, ratio: total ? visible / total : 0};
}

/** Validate cached UI sprites against actual displayed pixels, not their age.
 * This also supports the v1 observer while a native v2 build is loading. */
export function uiSpriteVisibility(command, source, pixels) {
  if (!source || !pixels || pixels.length !== 64000 || command.width <= 0 || command.height <= 0) return {visible: 0, total: 0, ratio: 0};
  const rect = intersectRect([command.x, command.y, command.width, command.height], command.clip ?? [0, 0, 320, 200]);
  const clipped = rect && intersectRect(rect, [0, 0, 320, 200]);
  let total = 0, visible = 0;
  if (clipped) for (let y = clipped[1]; y < clipped[1] + clipped[3]; y++) for (let x = clipped[0]; x < clipped[0] + clipped[2]; x++) {
    let sx = Math.floor((x - command.x) * source.sourceW / command.width);
    let sy = Math.floor((y - command.y) * source.sourceH / command.height);
    if (command.flags & 1) sx = source.sourceW - 1 - sx;
    if (command.flags & 2) sy = source.sourceH - 1 - sy;
    const at = sy * source.sourceW + sx;
    if (!source.mask[at]) continue;
    total++;
    if (pixels[y * 320 + x] === mappedIndex(source, source.indices[at], command)) visible++;
  }
  return {visible, total, ratio: total ? visible / total : 0};
}

/** Merge only native-adjacent glyphs. Never reflow or invent semantic text. */
export function glyphRuns(glyphs,{encoding='cp437'}={}) {
  const runs = [];
  for (const glyph of [...glyphs].sort((a, b) => a.serial - b.serial)) {
    const char = glyphCharacter(glyph.char,encoding);
    if (!char || glyph.visibleInk === 0) continue;
    const previous = runs.at(-1);
    const style = [glyph.font, glyph.fontHeight ?? glyph.height, ...(glyph.colours ?? [])].join(':');
    const full = glyph.totalInk === undefined || glyph.visibleInk === glyph.totalInk;
    const gap = previous ? glyph.x - previous.nextX : 0;
    if (previous && previous.style === style && previous.y === glyph.y && gap === 0 && previous.full && full) {
      previous.text += char;
      previous.glyphs.push(glyph);
      previous.nextX = glyph.x + glyph.advance;
      previous.lastSourceSerial = glyph.sourceSerial;
      previous.width = Math.max(previous.width, glyph.x + glyph.width - previous.x);
      previous.clip = [previous.x, previous.y, previous.width, previous.height];
    } else {
      runs.push({text: char, x: glyph.x, y: glyph.y, width: glyph.width, height: glyph.height, nextX: glyph.x + glyph.advance, font: glyph.font, fontHeight: glyph.fontHeight ?? glyph.height, colours: glyph.colours, clip: glyph.clip ?? [0, 0, 320, 200], serial: glyph.serial, sourceSerial: glyph.sourceSerial, lastSourceSerial: glyph.sourceSerial, style, full, glyphs: [glyph]});
    }
  }
  return runs;
}

/** A cursor or a partial screen copy changes visibility, never the original
 * literal line or its layout. A missing glyph may have the same advance as a
 * space: reconstructing words from surviving ink cannot distinguish them. */
export function observedTextRuns(frame) {
  if (!Array.isArray(frame.textRuns)) return glyphRuns(frame.textGlyphs ?? [],{encoding:frame.textEncoding??'cp437'});
  return frame.textRuns.filter(run => typeof run.text === 'string' && run.text.length && run.visibleInk > 0 && run.width > 0 && (run.fontHeight ?? run.height) > 0 && Array.isArray(run.clips) && run.clips.length)
    .map(run => ({...run, stable: true, full: true}));
}

export function witnessScore(pixels,points){
  if(!pixels||pixels.length!==64000||!Array.isArray(points)||points.length<12)return 0;
  let tested=0,matches=0;
  for(const[x,y,index]of points)if(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<320&&y>=0&&y<200){tested++;if(pixels[y*320+x]===index)matches++;}
  return tested>=12?matches/tested:0;
}

/** Campaign CPS sources are cropped and composed, rather than shown as whole
 * 320x200 source atlases. Require independent outer chrome AND map witnesses. */
const campaignPoints=new WeakMap();
export function campaignScene(frame,scenes){
  const pixels=frame.uiPixels??frame.pixels,shell=scenes?.['MAPMACH.CPS'];
  if(witnessScore(pixels,shell?.displayWitnesses)<.9)return null;
  const obscured=new Uint8Array(64000);
  for(const item of [...(frame.uiCommands??[]),...(frame.textGlyphs??[]),...(frame.borders??[])])for(const[x,y]of item.ink??[]){const px=item.x+x,py=item.y+y;if(px>=0&&px<320&&py>=0&&py<200)obscured[py*320+px]=1;}
  let scene='MAPMACH.CPS',score=.9;
  for(const name of ['PLANET.CPS','DUNEMAP.CPS','DUNERGN.CPS']){
    const source=scenes[name];if(!source)continue;
    let points=campaignPoints.get(source);
    if(!points){
      if(source.indicesBase64){const indices=Uint8Array.from(atob(source.indicesBase64),c=>c.charCodeAt(0));points=[];for(let y=25;y<144;y+=3)for(let x=9;x<312;x+=3)points.push([x,y,indices[y*320+x]]);}
      else points=(source.displayWitnesses??[]).filter(p=>p[2]!==0);
      campaignPoints.set(source,points);
    }
    const visible=points.filter(([x,y])=>!obscured[y*320+x]);
    // Zero-valued province lines distinguish DUNERGN from DUNEMAP, but zeros
    // alone cannot identify anything in an initially cleared black well.
    const nonzero=visible.filter(p=>p[2]!==0),match=nonzero.length>=12&&witnessScore(pixels,nonzero)>=.9?witnessScore(pixels,visible):0;
    if(match>=score){scene=name;score=match;}
  }
  return scene;
}

/** Native help widget15: parent8+[168,24,8,72]. Its thumb is an
 * actual filled15/10 rectangle; do not infer list position from labels. */
export function observedHelpScrollbar(frame){
  if(!observedTextRuns(frame).some(r=>r.text==='Select Subject:'))return null;
  const pixels=frame.uiPixels??frame.pixels;if(pixels?.length!==64000)return null;
  const groups=[];let current=null;
  for(let y=73;y<143;y++){
    const values=[298,299,300,301].map(x=>pixels[y*320+x]);
    const colour=values[0],thumb=(colour===15||colour===10)&&values.every(v=>v===colour);
    if(thumb){if(current&&current.y+current.height===y&&current.colour===colour)current.height++;else{current={x:297,y,width:6,height:1,colour};groups.push(current);}}else current=null;
  }
  return{track:[296,72,8,72],thumb:groups.sort((a,b)=>b.height-a.height)[0]??null};
}

/** Native Security_Show schemas1/2 enclose the edit widget [16,176,288,11].
 * Its blink is a raw filled rectangle, not a text/border observation. Recover
 * only a complete FG15 cursor block from cursor-free native pixels; letters
 * cannot fill every row of the eleven-pixel input cell. No private state/timer. */
export function observedSecurityEditBox(frame,{cursorWidth=10}={}){
  const borders=frame.uiBorders??frame.borders??[],pixels=frame.uiPixels??frame.pixels;
  const has=r=>borders.some(b=>b.x===r[0]&&b.y===r[1]&&b.width===r[2]&&b.height===r[3]);
  if(!has([10,170,300,23])||!has([14,174,292,15])||pixels?.length!==64000||!Number.isInteger(cursorWidth)||cursorWidth<1)return null;
  const rect=[16,176,288,11];let start=null,cursor=null;
  for(let x=rect[0];x<=rect[0]+rect[2];x++){
    let solid=x<rect[0]+rect[2];
    for(let y=rect[1];solid&&y<rect[1]+rect[3];y++)if(pixels[y*320+x]!==15)solid=false;
    if(solid){if(start===null)start=x;}
    else if(start!==null){if(x-start===cursorWidth){if(cursor)return{rect,cursor:null};cursor=[start,rect[1],cursorWidth,rect[3]];}start=null;}
  }
  return{rect,cursor};
}

/** Exact cache comparison. World-only pixels and the separate physical cursor
 * do not change a HUD layer; every other native pixel and DAC byte does. */
export function sameUIPixels(a,b){
  if(!a||!b||a.worldVisible!==b.worldVisible||a.playerHouse!==b.playerHouse)return false;
  const ap=a.uiPixels??a.pixels,bp=b.uiPixels??b.pixels;
  if(ap?.length!==64000||bp?.length!==64000||a.palette?.length!==768||b.palette?.length!==768)return false;
  for(let i=0;i<768;i++)if(a.palette[i]!==b.palette[i])return false;
  for(let y=0;y<200;y++)for(let x=a.worldVisible&&y>=40?240:0;x<320;x++)if(ap[y*320+x]!==bp[y*320+x])return false;
  return true;
}

const paintEpochKeys=new Set(['serial','sourceSerial','runId','placementId','slot','runIndex']);
export function uiPresentationSignature(frame){
  // Preserve combined painter ORDER, plus literal text, source identity, exact
  // copy clips and surviving ink. Epoch numbers can change on an equivalent
  // redraw; same-valued native overwrites still invalidate via changed ownership.
  const borders=(frame.uiBorders??frame.borders??[]).filter(b=>b.widgetIndex!==0&&b.widgetIndex!==3&&!(b.x===0&&b.y===40&&b.width>=240&&b.height===160));
  const entries=[...borders.map(value=>({kind:'border',value})),...(frame.uiCommands??[]).filter(c=>c.screen===0&&(c.id<=110||c.id>=355)).map(value=>({kind:'sprite',value})),...observedTextRuns(frame).map(value=>({kind:'text',value}))]
    .sort((a,b)=>a.value.serial-b.value.serial||(a.value.sourceSerial??0)-(b.value.sourceSerial??0));
  return JSON.stringify([entries,frame.worldVisible?null:frame.cursor],(key,value)=>paintEpochKeys.has(key)?undefined:value);
}

/** Fit the actual glyph ink, including descenders and stroke, inside a box.
 * A font's nominal point size is not its visible ascent or line height. */
export function fitTextBox(measure, rect, {maxSize = rect[3], padding = [0, 0, 0, 0], align = 'left'} = {}) {
  const [left, top, right, bottom] = padding;
  const content = [rect[0] + left, rect[1] + top, Math.max(0, rect[2] - left - right), Math.max(0, rect[3] - top - bottom)];
  if (!content[2] || !content[3]) return null;
  const metricsAt = size => {
    const m = measure(size), ascent = Math.max(0, m.actualBoundingBoxAscent ?? size * .8), descent = Math.max(0, m.actualBoundingBoxDescent ?? size * .2);
    return {left: m.actualBoundingBoxLeft ?? 0, right: m.actualBoundingBoxRight ?? m.width, ascent, descent, stroke: Math.max(.8, size / 18)};
  };
  const fits = m => m.left + m.right + m.stroke <= content[2] && m.ascent + m.descent + m.stroke <= content[3];
  let low = .25, high = Math.max(.25, maxSize);
  for (let n = 0; n < 18; n++) { const mid = (low + high) / 2; if (fits(metricsAt(mid))) low = mid; else high = mid; }
  const m = metricsAt(low), halfStroke = m.stroke / 2;
  if (!fits(m)) return null;
  const x = align === 'center' ? content[0] + content[2] / 2 + (m.left - m.right) / 2 : align === 'right' ? content[0] + content[2] - m.right - halfStroke : content[0] + m.left + halfStroke;
  const baseline = content[1] + (content[3] - m.ascent - m.descent) / 2 + m.ascent;
  return {fontSize: low, x, baseline, stroke: m.stroke, content, ink: [x - m.left - halfStroke, baseline - m.ascent - halfStroke, m.left + m.right + m.stroke, m.ascent + m.descent + m.stroke]};
}

/** Nine-slicing keeps small bevels crisp and avoids stretching corner art. */
export function nineSlices(source, target, margins = [12, 12, 12, 12], destinationMargins = margins) {
  const [sx, sy, sw, sh] = source, [dx, dy, dw, dh] = target;
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return [];
  const [l, t, r, b] = margins.map(v => Math.max(0, v));
  const [dl, dt, dr, db] = destinationMargins;
  const scale = Math.min(1, dw / (dl + dr || 1), dh / (dt + db || 1));
  const left = dl * scale, right = dr * scale, top = dt * scale, bottom = db * scale;
  const xs = [sx, sx + l, sx + sw - r, sx + sw], ys = [sy, sy + t, sy + sh - b, sy + sh];
  const xd = [dx, dx + left, dx + dw - right, dx + dw], yd = [dy, dy + top, dy + dh - bottom, dy + dh];
  const result = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    if (xs[x + 1] > xs[x] && ys[y + 1] > ys[y] && xd[x + 1] > xd[x] && yd[y + 1] > yd[y]) result.push({source: [xs[x], ys[y], xs[x + 1] - xs[x], ys[y + 1] - ys[y]], target: [xd[x], yd[y], xd[x + 1] - xd[x], yd[y + 1] - yd[y]]});
  }
  return result;
}
