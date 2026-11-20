// Painted interface surfaces and vector typography over native UI observations.
// All input continues through the original 320x200 SDL canvas.
import {intersectRect, glyphCharacter, glyphInkVisibility, observedTextRuns, observedHelpScrollbar, observedSecurityEditBox, fitTextBox, uiSpriteVisibility, nineSlices} from './painted-ui-core.mjs';
import {effectiveHouse, recolourPainted, rgbaBytesBounded} from './painted-core.mjs';
import {createPaintedMedia} from './painted-media.mjs';
import {compileSceneRecognition, recognizePaintedScene, isAdvisorSprite,compileConfirmationRecognition,recognizeConfirmationHouse} from './painted-scenes.mjs';
import {CREDIT_COUNTER, creditDigitLayout, paintedCreditPanel, suppressNativeCreditBackground} from './painted-credits.mjs';
import {measurePeriodText, drawPeriodText} from './painted-typography.mjs';
import {remapTextRunClips,factoryCaptionRect} from './painted-text-layout.mjs';
import titleLogo from './painted-title-data.mjs';

const S = 4;
const surface = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rectOf = row => row.rect ?? [row.x, row.y, row.w, row.h];
const rgb = (palette, index) => { const p = (index & 255) * 3; return [0, 1, 2].map(c => (palette[p + c] * 65) >> 4); };
const css = colour => `rgb(${colour.join(',')})`;
const loadImage = src => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(Error('Missing painted interface atlas: ' + src)); im.src = new URL('./' + src, import.meta.url).href; });
const loadJSON = async name => { const r = await fetch(new URL('./painted/' + name + '.json', import.meta.url)); if (!r.ok) throw Error('Missing painted interface manifest: ' + name); return r.json(); };

export async function createPaintedUI({sourceFrames,locale=null}) {
  const [chrome, icons, media] = await Promise.all([loadJSON('interface'), loadJSON('icons'), createPaintedMedia()]);
  for(const[name,patch]of Object.entries(locale?.scenes??{}))if(chrome.scenes[name])chrome.scenes[name]={...chrome.scenes[name],...patch};
  const labelText=value=>locale?.presentationLabels?.[value]??value;
  const images = new Map(), variants = new Map(), textLayouts = new Map(), panelSurfaces=new Map();
  const indexedScenes = new Map(Object.entries(chrome.scenes ?? {}).filter(([, row]) => row.indicesBase64).map(([name, row]) => [name, Uint8Array.from(atob(row.indicesBase64), c => c.charCodeAt(0))]));
  const creditSource=indexedScenes.get('SCREEN.CPS'),creditRect=CREDIT_COUNTER.nativeClip;
  const creditIndices=creditSource&&Uint8Array.from({length:creditRect[2]*creditRect[3]},(_,i)=>creditSource[(creditRect[1]+Math.floor(i/creditRect[2]))*320+creditRect[0]+i%creditRect[2]]);
  const creditColours=creditIndices?[...new Set(creditIndices)]:[];
  let creditUnderlay=null,creditUnderlayKey=null;
  const sceneRecognition=compileSceneRecognition(chrome,{sourceFrames,indexedScenes});
  const confirmationRecognition=compileConfirmationRecognition(indexedScenes.get('MISC.ENG'),chrome.scenes['MISC.ENG']?.sourceNameRects);
  const crestCopies=Object.fromEntries(Object.entries(chrome.crestCompositions?.families??{}).map(([family,row])=>[family,Object.values(row.variants).flatMap(v=>v.copies).map(copy=>({...copy,expected:Uint8Array.from(atob(copy.expectedIndicesBase64),c=>c.charCodeAt(0))}))]));
  await Promise.all([['chrome', chrome], ['icons', icons]].flatMap(([bank, manifest]) => Object.entries(manifest.atlases).map(async ([key, row]) => images.set(bank + ':' + key, await loadImage(row.src)))));
  let rendered = 0, lastScene = 'native', glyphCount = 0, spriteCount = 0, borderCount = 0, skippedStale = 0, variantBytes = 0, evidence = {};
  let textSamples = [], textFitViolations = 0, recognizedScene=null, skippedAdvisorPatches=0,panelVariantBytes=0;

  function artImage(bank, descriptor, frame, tint = false) {
    const rect = rectOf(descriptor), atlas = images.get(bank + ':' + descriptor.atlas);
    if (!atlas || !rect.every(Number.isFinite)) return null;
    const house = tint && frame.playerHouse >= 0 && frame.playerHouse < 6 ? frame.playerHouse : 1;
    const key = [bank, descriptor.atlas, ...rect, house, ...(house === 1 ? [] : rgb(frame.palette, 148 + house * 16))].join(':');
    if (variants.has(key)) return variants.get(key);
    const image = surface(rect[2], rect[3]), context = image.getContext('2d', {willReadFrequently: true});
    context.drawImage(atlas, ...rect, 0, 0, image.width, image.height);
    if (house !== 1) { const data = context.getImageData(0, 0, image.width, image.height); data.data.set(recolourPainted(data.data, frame.palette, house)); context.putImageData(data, 0, 0); }
    variants.set(key, image); variantBytes = rgbaBytesBounded(variants, 96, 24 * 1024 * 1024);
    return image;
  }

  function frameArt(ctx, name, frame, target = null) {
    const descriptor = chrome.frames[name];
    if (!descriptor) return false;
    const im = artImage('chrome', descriptor, frame, descriptor.housePaint === true);
    if (!im) return false;
    const rect = target ?? descriptor.nativeRect ?? [0, 0, im.width / S, im.height / S];
    ctx.drawImage(im, rect[0] * S, rect[1] * S, rect[2] * S, rect[3] * S);
    return true;
  }

  function restoreCreditUnderlay(ctx,frame){
    if(!creditIndices)return;
    // The approved HUD has translucent paint. Its base must be the clean CPS,
    // rather than the live native digits at their wider original positions.
    const colours=creditColours.map(index=>rgb(frame.palette,index)),key=colours.flat().join(',');
    if(key!==creditUnderlayKey){
      creditUnderlay??=surface(creditRect[2],creditRect[3]);
      const context=creditUnderlay.getContext('2d'),data=context.createImageData(creditRect[2],creditRect[3]);
      const palette=new Map(creditColours.map((index,i)=>[index,colours[i]]));
      for(let i=0;i<creditIndices.length;i++){data.data.set(palette.get(creditIndices[i]),i*4);data.data[i*4+3]=255;}
      context.putImageData(data,0,0);creditUnderlayKey=key;
    }
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.drawImage(creditUnderlay,...creditRect.map(n=>n*S));ctx.restore();
  }

  function classifyScene(frame) {
    recognizedScene=recognizePaintedScene(frame,sceneRecognition);
    return recognizedScene.scene;
  }

  function drawCrests(ctx,frame,family){
    const image=artImage('chrome',chrome.frames['house-choice'],frame);
    if(!image)return;
    const pixels=frame.uiPixels??frame.pixels,drawn=new Set();
    for(const copy of crestCopies[family]??[]){
      const r=copy.destinationNativeRect,key=r.join(',');if(drawn.has(key))continue;
      let matches=0;
      for(let y=0;y<r[3];y++)for(let x=0;x<r[2];x++)if(pixels[(r[1]+y)*320+r[0]+x]===copy.expected[y*r[2]+x])matches++;
      if(matches/copy.expected.length<.98)continue;
      const source={0:[214,54,82,76],1:[20,54,82,76],2:[117,54,82,76]}[copy.sourceHouse];
      if(!source)continue;
      ctx.save();ctx.beginPath();ctx.rect(...r.map(n=>n*S));ctx.clip();
      ctx.fillStyle='#09121c';ctx.fillRect((r[0]+2)*S,(r[1]+1)*S,(r[2]-4)*S,(r[3]-2)*S);
      const ratio=Math.min((r[2]-4)/source[2],(r[3]-2)/source[3]),w=source[2]*ratio,h=source[3]*ratio;
      ctx.drawImage(image,...source.map(n=>n*S),(r[0]+(r[2]-w)/2)*S,(r[1]+(r[3]-h)/2)*S,w*S,h*S);ctx.restore();drawn.add(key);
    }
  }

  function panel(ctx, rect, frame, {button = false, pressed = false, borderOnly = false, compact = false} = {}) {
    const name = button ? (pressed ? 'widget-button-pressed' : 'widget-button') : 'menu-plate';
    const descriptor = chrome.frames[name] ?? chrome.frames['widget-inset'];
    const image = descriptor && artImage('chrome', descriptor, frame, descriptor.housePaint === true);
    if (!image) return;
    const margins = descriptor.sliceMargins ?? (descriptor.nineSlice ? descriptor.nineSlice.map(n => n * S) : [12, 12, 12, 12]);
    const destinationMargins = compact ? [Math.min(margins[0], 12), 4, Math.min(margins[2], 12), 4] : margins;
    const width=Math.max(1,Math.round(rect[2]*S)),height=Math.max(1,Math.round(rect[3]*S));
    const house=descriptor.housePaint&&Number.isInteger(frame.playerHouse)&&frame.playerHouse>=0&&frame.playerHouse<6?frame.playerHouse:1;
    const key=JSON.stringify([name,width,height,compact,borderOnly,house,...(house===1?[]:rgb(frame.palette,148+house*16))]);
    let raster=panelSurfaces.get(key);
    if(!raster){
      raster=surface(width,height);const pc=raster.getContext('2d',{willReadFrequently:true});pc.imageSmoothingEnabled=true;
      for (const part of nineSlices([0, 0, image.width, image.height], [0,0,width,height], margins, destinationMargins)) {
        if (borderOnly && part.source[0] > 0 && part.source[1] > 0 && part.source[0] + part.source[2] < image.width && part.source[1] + part.source[3] < image.height) continue;
        pc.drawImage(image, ...part.source, ...part.target);
      }
      // Freeze the resized rim once. Main/UI readbacks then copy identical
      // pixels rather than selecting another filtering path on the next draw.
      pc.putImageData(pc.getImageData(0,0,width,height),0,0);
      panelSurfaces.set(key,raster);panelVariantBytes=rgbaBytesBounded(panelSurfaces,48,12*1024*1024);
    }
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(raster,rect[0]*S,rect[1]*S,rect[2]*S,rect[3]*S);ctx.restore();
  }

  function textColour(palette, index) {
    const colour = rgb(palette, index), [r, g, b] = colour;
    if (index >= 232) return css(colour); // Native UI blink ramps remain authoritative.
    if (r > g * 1.6 && r > b * 1.5 && r > 65) return '#ed826c';
    if (g > r * 1.6 && g > b * 1.3 && g > 65) return '#a1d3ac';
    return '#eee4ca';
  }

  function text(ctx, value, rect, frame, options = {}) {
    if (!value || rect[2] <= 0 || rect[3] <= 0) return;
    ctx.save();
    const clip = intersectRect(options.clip ?? rect, rect);
    if (!clip) { ctx.restore(); return; }
    ctx.beginPath(); ctx.rect(clip[0] * S, clip[1] * S, clip[2] * S, clip[3] * S); ctx.clip();
    const face = options.face ?? 'NEW8P.FNT';
    const size = options.size ?? rect[3] * S * .97;
    const align = options.align ?? 'left', horizontalInset = Math.min(1, rect[2] / 4), insets = options.insets ?? [horizontalInset, 1, horizontalInset, 1];
    const localRect = [0, 0, rect[2] * S, rect[3] * S];
    const key = JSON.stringify([value, localRect[2], localRect[3], size, face, align, ...insets]);
    let layout = textLayouts.get(key);
    if (!layout) {
      layout = fitTextBox(fontSize => measurePeriodText(value,fontSize,{face}), localRect, {maxSize: size, padding: insets.map(n => n * S), align});
      if (layout) { textLayouts.set(key, layout); if (textLayouts.size > 1024) textLayouts.delete(textLayouts.keys().next().value); }
    }
    if (!layout) { ctx.restore(); return; }
    const [ix, iy, iw, ih] = layout.ink, [cx, cy, cw, ch] = layout.content;
    if (ix < cx - .001 || iy < cy - .001 || ix + iw > cx + cw + .001 || iy + ih > cy + ch + .001) textFitViolations++;
    if (textSamples.length < 100) textSamples.push({text:value,fontSize:Math.round(layout.fontSize*100)/100,nativeRect:rect.slice(),ink:layout.ink.map((n,i)=>(n+(i===0?rect[0]*S:i===1?rect[1]*S:0))/S),padding:insets.slice(),...(options.coverageClips?{coverageClips:options.coverageClips.map(r=>r.slice())}:{}),...(options.role?{role:options.role}:{})});
    const x = rect[0] * S + layout.x, y = rect[1] * S + layout.baseline;
    drawPeriodText(ctx,value,x,y,layout.fontSize,{face,stroke:layout.stroke,outline:'#111921',fill:options.colour ?? textColour(frame.palette, options.colourIndex ?? 15)});
    ctx.restore();
  }

  function drawGlyph(ctx, glyph, frame) {
    const char = glyphCharacter(glyph.char,locale?.encoding??'cp437');
    if (!char || glyph.visibleInk === 0) return;
    if (glyph.ink && glyphInkVisibility(glyph, frame.uiPixels??frame.pixels).ratio < .98) { skippedStale++; return; }
    const nativeHeight = glyph.fontHeight ?? glyph.height;
    const full = glyph.visibleInk === undefined || glyph.visibleInk === glyph.totalInk;
    const clip = full ? [glyph.x, glyph.y, glyph.width + 1, nativeHeight] : glyph.clip;
    text(ctx, char, [glyph.x, glyph.y, Math.max(glyph.width, glyph.advance), nativeHeight], frame, {clip, face:glyph.font===1?'NEW6P.FNT':'NEW8P.FNT', colourIndex: glyph.colours?.[1]});
    glyphCount++;
  }

  function drawRun(ctx, run, frame) {
    const pixels=frame.uiPixels??frame.pixels;
    if (run.stable && glyphInkVisibility(run,pixels).ratio < .98) { skippedStale++; return; }
    if (!run.stable && (!run.full || run.glyphs.some(g => glyphInkVisibility(g, pixels).ratio < .98))) {
      for (const glyph of run.glyphs) drawGlyph(ctx, glyph, frame);
      return;
    }
    let rect = [run.x, run.y, run.width, run.fontHeight];
    const options = {face:run.font===1?'NEW6P.FNT':'NEW8P.FNT', colourIndex: run.colours?.[1], size: run.fontHeight * S * .97};
    if(lastScene==='CHOAM.CPS'&&run.y===23){
      // The painted caption plate is higher than the native caption baseline.
      // Fixed name/quantity/cost lanes cannot reflow when another run is erased.
      rect=factoryCaptionRect(run);options.insets=[2,3,2,3];options.size=6*S;options.role='factory-caption';
    }
    else if (lastScene === 'hud' && run.y === 43 && run.x >= 256 && run.x + run.width <= 321) {
      rect = [258, 43, 60, 8]; options.align = 'center'; options.insets = [2, 1, 2, 1];options.role='object-heading';
    } else if (lastScene === 'hud' && run.x+run.width/2 >= 256 && run.x+run.width/2 < 320 && run.y >= 76 && run.y < 124) {
      const center=run.x+run.width/2;
      const button = (frame.borders ?? []).filter(b => b.fill !== false && b.x >= 256 && b.width <= 64 && b.height <= 40 && center >= b.x && center < b.x + b.width && run.y >= b.y && run.y < b.y + b.height).sort((a, b) => a.width * a.height - b.width * b.height)[0];
      if (button) {
        const portraitButton=button.height>16;
        rect = portraitButton ? [button.x + 2, button.y + button.height - 9, button.width - 4, 8] : [button.x, button.y, button.width, button.height];
        options.align = 'center'; options.insets = portraitButton?[4,1,4,1]:[4,2,4,2];options.size=(run.font===1?4.2:5.2)*S;options.role='command-button';
      }
    } else {
      const button=(frame.borders??[]).filter(b=>b.fill!==false&&b.width>=20&&b.height>=10&&b.height<=20&&run.x>=b.x&&run.x<b.x+b.width&&run.y>=b.y&&run.y<b.y+b.height).sort((a,b)=>a.width*a.height-b.width*b.height)[0];
      if(button){
        rect=[button.x,button.y,button.width,button.height];
        const compact=button.height<=12;
        options.insets=compact?[4,2,4,2]:[9,4,9,4];options.size=(compact?(run.font===1?4.2:5.2):5)*S;options.role='menu-button';
      }
    }
    ctx.save();
    const clips=run.stable?remapTextRunClips(run,rect):null;
    options.coverageClips=clips;
    if(clips){ctx.beginPath();for(const clip of clips)ctx.rect(...clip.map(n=>n*S));ctx.clip();}
    text(ctx, run.text, rect, frame, options);
    ctx.restore();
    glyphCount += run.glyphs.length;
  }

  function drawIcon(ctx, command, frame) {
    const source = sourceFrames.units[command.id] ?? sourceFrames.ui[command.id];
    const descriptor = icons.frames[command.id], semantic = icons.semanticFrames?.[command.id];
    if (!source || (!descriptor && !semantic)) return;
    const witness = command.ink ? glyphInkVisibility(command, frame.uiPixels??frame.pixels) : uiSpriteVisibility(command, source, frame.uiPixels??frame.pixels);
    if (witness.ratio < .98) { skippedStale++; return; }
    if(suppressNativeCreditBackground(command,lastScene))return;
    const credit=creditDigitLayout(command,lastScene);
    const rect = credit?.rect??[command.x, command.y, command.width, command.height];
    let clip = credit?credit.clip:intersectRect(command.clip??[0,0,320,200],[0,0,320,200]);
    if (!clip) return;
    ctx.save(); ctx.beginPath(); ctx.rect(...clip.map(n => n * S)); ctx.clip();
    if (semantic) {
      const label = locale?.bitmapLabels?.[command.id]??labelText(semantic.label??semantic.glyph??'');
      const digit = command.id >= 14 && command.id <= 23;
      if (command.id === 13) { ctx.restore(); return; }
      if (command.id >= 7 && command.id <= 10 && lastScene === 'hud') rect[2] = 78;
      if (command.id === 12) {
        ctx.fillStyle = '#111b24'; ctx.fillRect(...rect.map(n => n * S));
      } else if (!digit) panel(ctx, rect, frame, {button: true, pressed: semantic.state === 'pressed' || semantic.state === 'selected'});
      text(ctx, credit?.label??label, rect, frame, {align: 'center', ...(!digit?{size:Math.min(rect[3]*S*.97,5.2*S),role:'bitmap-button'}:{}), colour: digit ? '#f2d69b' : '#eee1ba', clip, insets: credit?.insets??(digit ? [.75, .75, .75, .75] : [9, 4, 9, 4])});
    } else if(command.id>=355&&command.id<=358){
      const pressed=command.id%2===0,up=command.id<=356;
      panel(ctx,rect,frame,{button:true,pressed});
      const cx=(rect[0]+rect[2]/2)*S,cy=(rect[1]+rect[3]/2+(pressed?.5:0))*S,half=3.8*S;
      ctx.beginPath();ctx.moveTo(cx,cy+(up?-half:half));ctx.lineTo(cx-half*1.25,cy+(up?half:-half));ctx.lineTo(cx+half*1.25,cy+(up?half:-half));ctx.closePath();ctx.fillStyle=pressed?'#f2db9c':'#bacbd0';ctx.fill();
    } else {
      const house = effectiveHouse(source, {...command, house: frame.playerHouse}, frame.playerHouse);
      const image = artImage('icons', descriptor, {...frame, playerHouse: house}, source.paletteMode === 'local16');
      if (image) {
        ctx.translate(command.x * S, command.y * S);
        if (command.flags & 1) { ctx.translate(command.width * S, 0); ctx.scale(-1, 1); }
        if (command.flags & 2) { ctx.translate(0, command.height * S); ctx.scale(1, -1); }
        ctx.drawImage(image, 0, 0, command.width * S, command.height * S);
      }
    }
    ctx.restore(); spriteCount++;
  }

  function drawBorder(ctx, border, frame) {
    const rect = [border.x, border.y, border.width, border.height];
    if (!intersectRect(rect, [0, 0, 320, 200])) return;
    const fullWorld = rect[0] === 0 && rect[1] === 40 && rect[2] >= 240 && rect[3] === 160;
    if (fullWorld || border.widgetIndex === 0 || border.widgetIndex === 3) return;
    if (border.fill === false) {
      ctx.save(); ctx.strokeStyle = border.pressed ? '#607585' : '#c7c5b2'; ctx.lineWidth = 1.5;
      ctx.strokeRect(rect[0] * S + .75, rect[1] * S + .75, rect[2] * S - 1.5, rect[3] * S - 1.5);
      ctx.restore(); borderCount++; return;
    }
    const hudButton = lastScene === 'hud' && border.x >= 256 && border.y >= 40 && border.y < 124 && border.width <= 64;
    panel(ctx, rect, frame, {button: border.height <= 20 || hudButton, pressed: border.pressed, compact: hudButton||border.height<=12}); borderCount++;
  }

  function cropMatches(frame, indices, source, destination) {
    if (!indices) return 0;
    let matches = 0, tested = 0;
    for (let y = 2; y < source[3] - 1; y += 3) for (let x = 2; x < source[2] - 1; x += 4) {
      const index = indices[(source[1] + y) * 320 + source[0] + x];
      if (!index) continue;
      tested++; if ((frame.uiPixels??frame.pixels)[(destination[1] + y) * 320 + destination[0] + x] === index) matches++;
    }
    return tested > 12 ? matches / tested : 0;
  }

  function staticLabels(ctx, descriptor, frame) {
    for (const label of descriptor?.labels ?? []) {
      const title = /title/.test(label.style), width = title ? 296 : 96, height = title ? 17 : 12;
      const house=/house/.test(label.style);
      const rect = house?[label.anchor[0]-35.5,132,71,13]:[label.anchor[0] - width / 2, label.anchor[1] - height / 2, width, height];
      text(ctx, labelText(label.text), rect, frame, {align: 'center', colour: '#e9d6a6', ...(house?{insets:[3,2,3,2]}:{})});
    }
  }

  function houseConfirmation(ctx, frame) {
    const scene = chrome.scenes['MISC.ENG'], indices = indexedScenes.get('MISC.ENG');
    if (!scene || cropMatches(frame, indices, [0, 0, 208, 24], [0, 0]) < .9) return;
    const house=recognizeConfirmationHouse(frame,confirmationRecognition);
    if(house===null)return;
    frameArt(ctx, 'house-confirm-question', frame, [0, 0, 208, 24]);
    text(ctx, labelText(scene.question), [6, 5, 198, 15], frame, {serif: true, align: 'center'});
    frameArt(ctx, 'house-confirm-name', frame, [208, 0, 104, 24]);
    text(ctx, labelText(scene.names[house]), [210, 5, 100, 15], frame, {align:'center'});
  }

  function titleScreen(ctx, frame, scene) {
    ctx.fillStyle = '#020304'; ctx.fillRect(0, 0, 1280, 800);
    const points = scene.witnesses ?? [], colours = points.map(([x, y]) => rgb(frame.palette, frame.pixels[y * 320 + x]));
    const brightness = Math.min(1, Math.max(0, ...colours.flat()) / 200);
    ctx.save(); ctx.globalAlpha = brightness;
    // Keep the real period logo as its own traced shape, rather than typing the
    // game's proper name with either a modern office font or a large UI glyph.
    ctx.save();ctx.translate(titleLogo.nativeRect[0]*S,titleLogo.nativeRect[1]*S);ctx.scale(S,S);ctx.beginPath();
    for(const path of titleLogo.contours){ctx.moveTo(...path[0]);for(const point of path.slice(1))ctx.lineTo(...point);ctx.closePath();}
    ctx.fillStyle='#b72c21';ctx.fill('evenodd');ctx.restore();
    for (const label of scene.labels ?? []) if(label.text!=='DUNE II')text(ctx, labelText(label.text), label.nativeRect, frame, {align: 'center', colour: '#b72c21', size: label.nativeRect[3] * S * 1.13});
    ctx.strokeStyle = '#b72c21'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8 * S, 101 * S); ctx.lineTo(312 * S, 101 * S); ctx.stroke();
    ctx.restore();
  }

  function healthMeter(ctx, frame) {
    const x = 293, y = 55;
    let width = 0, colour = 0;
    for (let i = 0; i < 24; i++) {
      const value = (frame.uiPixels??frame.pixels)[y * 320 + x + i];
      if (![4, 5, 8].includes(value)) break;
      width++; colour = value;
    }
    if (!width) return;
    ctx.fillStyle = '#0d171e'; ctx.fillRect(292 * S, 51 * S, 26 * S, 9 * S);
    const gradient = ctx.createLinearGradient(0, 52 * S, 0, 59 * S);
    const shades = colour === 8 ? ['#ec9a78', '#a84535'] : colour === 5 ? ['#ead799', '#ad8437'] : ['#add4a9', '#598f75'];
    gradient.addColorStop(0, shades[0]); gradient.addColorStop(1, shades[1]);
    ctx.fillStyle = gradient; ctx.fillRect(x * S, 52 * S, width * S, 7 * S);
    ctx.strokeStyle = '#b7b8a3'; ctx.lineWidth = 1; ctx.strokeRect(292 * S + .5, 51 * S + .5, 26 * S - 1, 9 * S - 1);
  }

  function draw(ctx, frame) {
    rendered++; glyphCount = 0; spriteCount = 0; borderCount = 0; skippedStale = 0;
    textSamples = []; textFitViolations = 0;skippedAdvisorPatches=0;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    const scene = classifyScene(frame); lastScene = scene;
    evidence = {
      glyphs: (frame.textGlyphs ?? []).map(g => ({char: glyphCharacter(g.char), x: g.x, y: g.y, width: g.width, height: g.height, visible: g.visibleInk, total: g.totalInk, serial: g.serial})),
      portraits: (frame.uiCommands ?? []).filter(c => c.id >= 65 && c.id <= 110).map(c => ({id:c.id,x:c.x,y:c.y,width:c.width,height:c.height,clip:c.clip,visible:c.visibleInk,total:c.totalInk,serial:c.serial})),
      borders: (frame.borders ?? []).map(b => ({x:b.x,y:b.y,width:b.width,height:b.height,widget:b.widgetIndex,serial:b.serial})),
      ledgerOverflow: frame.uiLedgerOverflow ?? 0,
      textRuns: (frame.textRuns??[]).map(r=>({text:r.text,x:r.x,y:r.y,width:r.width,height:r.height,runId:r.runId,visibleInk:r.visibleInk,clips:r.clips})),
    };
    const campaign=['MAPMACH.CPS','DUNEMAP.CPS','DUNERGN.CPS','PLANET.CPS'].includes(scene);
    let advisorBasePainted=false;
    const advisorResource=/^MENTAT[AHOM]\.CPS$/.test(scene)?scene.replace('MENTAT','MENSHP').replace('.CPS','.SHP'):null;
    if (scene === 'hud') {restoreCreditUnderlay(ctx,frame);frameArt(ctx, 'hud-shell', frame);}
    else if(campaign){
      ctx.save();ctx.beginPath();for(const r of [[0,0,320,24],[0,24,8,120],[312,24,8,120],[0,144,320,56]])ctx.rect(...r.map(n=>n*S));ctx.clip();frameArt(ctx,'campaign-shell',frame);ctx.restore();
      if(scene!=='MAPMACH.CPS')frameArt(ctx,chrome.scenes[scene].asset,frame,chrome.scenes[scene].displayNativeRect);
    }
    else if (chrome.scenes[scene]?.asset) {
      if(scene==='HERALD.ENG'){ctx.fillStyle='#010309';ctx.fillRect(0,0,1280,800);}
      const drawn=frameArt(ctx, chrome.scenes[scene].asset, frame);
      advisorBasePainted=drawn&&chrome.frames[chrome.scenes[scene].asset]?.kind==='painted-whole-advisor';
      staticLabels(ctx, chrome.scenes[scene], frame);
    } else if (scene === 'TITLE.ENG') titleScreen(ctx, frame, chrome.scenes[scene]);
    const creditPanel=paintedCreditPanel(scene);if(creditPanel)panel(ctx,creditPanel,frame);
    const commands = [
      ...(frame.uiBorders ?? frame.borders ?? []).map(value => ({kind: 'border', value})),
      ...(frame.uiCommands ?? []).filter(c => c.screen === 0).map(value => ({kind: 'sprite', value})),
      ...observedTextRuns(frame).map(value => ({kind: 'glyph-run', value})),
    ].sort((a, b) => a.value.serial - b.value.serial || (a.value.sourceSerial ?? 0) - (b.value.sourceSerial ?? 0));
    const mediaRect = media.manifest.nativeRect ?? [128, 48, 184, 112], parentBorders = new Set();
    if (!frame.worldVisible) for (const {kind, value} of commands) {
      if (kind !== 'border' || value.fill === false) continue;
      if (value.x <= mediaRect[0] && value.y <= mediaRect[1] && value.x + value.width >= mediaRect[0] + mediaRect[2] && value.y + value.height >= mediaRect[1] + mediaRect[3]) {
        drawBorder(ctx, value, frame); parentBorders.add(value);
      }
    }
    const pointer = frame.cursor, cursorSource = pointer && (sourceFrames.ui[pointer.id] ?? sourceFrames.units[pointer.id]);
    const cursorOccluder = pointer?.visible && cursorSource ? {x:pointer.x-pointer.hotX,y:pointer.y-pointer.hotY,width:cursorSource.sourceW,height:cursorSource.sourceH,mask:cursorSource.mask} : null;
    const mediaResult = media.draw(ctx, frame, {scene, occluders: cursorOccluder});
    if(campaign)drawCrests(ctx,frame,'campaign');
    else if(scene==='CHOAM.CPS')drawCrests(ctx,frame,'factory');
    else if(scene==='FAME.CPS')drawCrests(ctx,frame,'score');
    let regionLines=false;
    for (const {kind, value} of commands) {
      if(scene==='DUNERGN.CPS'&&!regionLines&&kind==='sprite'&&value.id>=505&&value.id<=513){frameArt(ctx,'campaign-region-lines',frame,chrome.scenes[scene].displayNativeRect);regionLines=true;}
      if (kind === 'border') { if (!mediaResult.drawn || !parentBorders.has(value)) drawBorder(ctx, value, frame); }
      else if (kind === 'sprite') {
        if(isAdvisorSprite(value,sceneRecognition)&&(!advisorBasePainted||sourceFrames.ui[value.id]?.resource!==advisorResource)){skippedAdvisorPatches++;continue;}
        drawIcon(ctx, value, frame);
      }
      else drawRun(ctx, value, frame);
    }
    if(scene==='DUNERGN.CPS'&&!regionLines)frameArt(ctx,'campaign-region-lines',frame,chrome.scenes[scene].displayNativeRect);
    if(/^MENTAT/.test(scene)){
      const scrollbar=observedHelpScrollbar(frame);
      if(scrollbar){
        const r=scrollbar.track;ctx.fillStyle='#101922';ctx.fillRect(...r.map(n=>n*S));ctx.strokeStyle='#596b78';ctx.lineWidth=1.5;ctx.strokeRect(r[0]*S+.75,r[1]*S+.75,r[2]*S-1.5,r[3]*S-1.5);
        const t=scrollbar.thumb;
        if(t){const gradient=ctx.createLinearGradient(t.x*S,0,(t.x+t.width)*S,0);gradient.addColorStop(0,'#788b98');gradient.addColorStop(.4,t.colour===10?'#c3b888':'#c5d0d2');gradient.addColorStop(1,'#4b5b68');ctx.fillStyle=gradient;ctx.fillRect(t.x*S,t.y*S,t.width*S,t.height*S);}
      }
      const editBox=observedSecurityEditBox(frame,{cursorWidth:locale?.fonts?.['NEW8P.FNT']?.chars?.[87]?.width??10});
      evidence.editBox=editBox;
      if(editBox?.cursor){ctx.fillStyle=textColour(frame.palette,15);ctx.fillRect(...editBox.cursor.map(n=>n*S));}
    }
    if (scene === 'hud') healthMeter(ctx, frame);
    if (!frame.worldVisible) houseConfirmation(ctx, frame);
    ctx.restore();
  }

  function cursor(ctx, frame) {
    const pointer = frame.cursor;
    if (!pointer?.visible || pointer.id < 0 || pointer.id > 6) return false;
    const descriptor = icons.frames[pointer.id];
    if (!descriptor) return false;
    const image = artImage('icons', descriptor, frame);
    if (!image) return false;
    ctx.drawImage(image, (pointer.x - pointer.hotX) * S, (pointer.y - pointer.hotY) * S, descriptor.sourceW * S, descriptor.sourceH * S);
    return true;
  }

  function suppressionRects(frame) {
    const result = [];
    for (const glyph of frame.textGlyphs ?? []) if (glyph.visibleInk !== 0) result.push([glyph.x, glyph.y, glyph.width, glyph.fontHeight ?? glyph.height]);
    for (const command of frame.uiCommands ?? []) if (icons.frames[command.id] || icons.semanticFrames?.[command.id]) result.push([command.x, command.y, command.width, command.height]);
    for (const border of frame.borders ?? []) {
      if (border.widgetIndex === 0 || border.widgetIndex === 3 || (border.x === 0 && border.y === 40 && border.width >= 240 && border.height === 160)) continue;
      result.push([border.x, border.y, border.width, border.height]);
    }
    const pointer = frame.cursor;
    const source = pointer && (sourceFrames.ui[pointer.id] ?? sourceFrames.units[pointer.id]);
    if (pointer?.visible && source) result.push([pointer.x - pointer.hotX, pointer.y - pointer.hotY, source.sourceW, source.sourceH]);
    return result;
  }

  function worldControl(ctx, command, frame) {
    const descriptor = icons.frames[command.id];
    if (!descriptor) return false;
    const im = artImage('icons', descriptor, frame);
    if (!im) return false;
    ctx.save();
    const clip = command.clip ?? [0, 40, 240, 160];
    ctx.beginPath(); ctx.rect(...clip.map(n => n * S)); ctx.clip();
    ctx.drawImage(im, command.x * S, command.y * S, command.width * S, command.height * S);
    ctx.restore(); return true;
  }

  return {draw, cursor, worldControl, suppressionRects, manifests: {chrome, icons}, diagnostics: () => ({ready: true, frames: rendered, scene: lastScene, sceneRecognition:recognizedScene, skippedAdvisorPatches, glyphs: glyphCount, sprites: spriteCount, borders: borderCount, skippedStale, variantBytes:variantBytes+panelVariantBytes,panelVariantBytes, iconCoverage: icons.coverage, media:media.diagnostics(),textFit:{violations:textFitViolations,labels:textSamples},evidence})};
}
