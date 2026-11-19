// Painted interface surfaces and vector typography over native UI observations.
// All input continues through the original 320x200 SDL canvas.
import {intersectRect, glyphCharacter, glyphInkVisibility, observedTextRuns, campaignScene, observedHelpScrollbar, fitTextBox, uiSpriteVisibility, nineSlices} from './painted-ui-core.mjs';
import {effectiveHouse, recolourPainted, rgbaBytesBounded} from './painted-core.mjs';
import {createPaintedMedia} from './painted-media.mjs';

const S = 4;
const surface = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rectOf = row => row.rect ?? [row.x, row.y, row.w, row.h];
const rgb = (palette, index) => { const p = (index & 255) * 3; return [0, 1, 2].map(c => (palette[p + c] * 65) >> 4); };
const css = colour => `rgb(${colour.join(',')})`;
const loadImage = src => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(Error('Missing painted interface atlas: ' + src)); im.src = new URL('./' + src, import.meta.url).href; });
const loadJSON = async name => { const r = await fetch(new URL('./painted/' + name + '.json', import.meta.url)); if (!r.ok) throw Error('Missing painted interface manifest: ' + name); return r.json(); };

export async function createPaintedUI({sourceFrames}) {
  const [chrome, icons, media] = await Promise.all([loadJSON('interface'), loadJSON('icons'), createPaintedMedia()]);
  const images = new Map(), variants = new Map(), textLayouts = new Map();
  const indexedScenes = new Map(Object.entries(chrome.scenes ?? {}).filter(([, row]) => row.indicesBase64).map(([name, row]) => [name, Uint8Array.from(atob(row.indicesBase64), c => c.charCodeAt(0))]));
  const crestCopies=Object.fromEntries(Object.entries(chrome.crestCompositions?.families??{}).map(([family,row])=>[family,Object.values(row.variants).flatMap(v=>v.copies).map(copy=>({...copy,expected:Uint8Array.from(atob(copy.expectedIndicesBase64),c=>c.charCodeAt(0))}))]));
  await Promise.all([['chrome', chrome], ['icons', icons]].flatMap(([bank, manifest]) => Object.entries(manifest.atlases).map(async ([key, row]) => images.set(bank + ':' + key, await loadImage(row.src)))));
  let rendered = 0, lastScene = 'native', glyphCount = 0, spriteCount = 0, borderCount = 0, skippedStale = 0, variantBytes = 0, evidence = {};
  let textSamples = [], textFitViolations = 0;

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

  function classifyScene(frame) {
    if (frame.worldVisible) return 'hud';
    const campaign=campaignScene(frame,chrome.scenes);if(campaign)return campaign;
    let best = '', score = 0;
    for (const [name, scene] of Object.entries(chrome.scenes ?? {})) {
      const points = scene.witnesses ?? scene.witness ?? scene.points ?? [];
      let matches = 0, tested = 0;
      for (const point of points) { const [x, y, index] = point; if (x < 0 || y < 0 || x >= 320 || y >= 200) continue; tested++; if ((frame.uiPixels??frame.pixels)[y * 320 + x] === index) matches++; }
      const ratio = tested >= 12 ? matches / tested : 0;
      if (ratio > score) { score = ratio; best = scene.kind ?? name; }
    }
    return score >= .72 ? best : 'native';
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
    for (const part of nineSlices([0, 0, image.width, image.height], rect.map(n => n * S), margins, destinationMargins)) {
      if (borderOnly && part.source[0] > 0 && part.source[1] > 0 && part.source[0] + part.source[2] < image.width && part.source[1] + part.source[3] < image.height) continue;
      ctx.drawImage(image, ...part.source, ...part.target);
    }
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
    const family = options.serif ? 'Georgia,serif' : '"Trebuchet MS",Arial,sans-serif';
    const size = options.size ?? rect[3] * S * .97, weight = options.weight ?? 700;
    const align = options.align ?? 'left', horizontalInset = Math.min(1, rect[2] / 4), insets = options.insets ?? [horizontalInset, 1, horizontalInset, 1];
    const localRect = [0, 0, rect[2] * S, rect[3] * S];
    const key = JSON.stringify([value, localRect[2], localRect[3], size, weight, family, align, ...insets]);
    let layout = textLayouts.get(key);
    if (!layout) {
      layout = fitTextBox(fontSize => { ctx.font = `${weight} ${fontSize}px ${family}`; ctx.textAlign = 'left'; return ctx.measureText(value); }, localRect, {maxSize: size, padding: insets.map(n => n * S), align});
      if (layout) { textLayouts.set(key, layout); if (textLayouts.size > 1024) textLayouts.delete(textLayouts.keys().next().value); }
    }
    if (!layout) { ctx.restore(); return; }
    const [ix, iy, iw, ih] = layout.ink, [cx, cy, cw, ch] = layout.content;
    if (ix < cx - .001 || iy < cy - .001 || ix + iw > cx + cw + .001 || iy + ih > cy + ch + .001) textFitViolations++;
    if (textSamples.length < 100) textSamples.push({text:value,fontSize:Math.round(layout.fontSize*100)/100,nativeRect:rect.slice(),ink:layout.ink.map((n,i)=>(n+(i===0?rect[0]*S:i===1?rect[1]*S:0))/S),padding:insets.slice()});
    ctx.font = `${weight} ${layout.fontSize}px ${family}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const x = rect[0] * S + layout.x, y = rect[1] * S + layout.baseline;
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#111921'; ctx.lineWidth = layout.stroke;
    ctx.strokeText(value, x, y);
    ctx.fillStyle = options.colour ?? textColour(frame.palette, options.colourIndex ?? 15);
    ctx.fillText(value, x, y);
    ctx.restore();
  }

  function drawGlyph(ctx, glyph, frame) {
    const char = glyphCharacter(glyph.char);
    if (!char || glyph.visibleInk === 0) return;
    if (glyph.ink && glyphInkVisibility(glyph, frame.uiPixels??frame.pixels).ratio < .98) { skippedStale++; return; }
    const nativeHeight = glyph.fontHeight ?? glyph.height;
    const full = glyph.visibleInk === undefined || glyph.visibleInk === glyph.totalInk;
    const clip = full ? [glyph.x, glyph.y, glyph.width + 1, nativeHeight] : glyph.clip;
    text(ctx, char, [glyph.x, glyph.y, Math.max(glyph.width, glyph.advance), nativeHeight], frame, {clip, serif: glyph.font === 0, colourIndex: glyph.colours?.[1], weight: glyph.font === 0 ? 600 : 700});
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
    const options = {serif: run.font === 0, colourIndex: run.colours?.[1], weight: run.font === 0 ? 600 : 700, size: run.fontHeight * S * .97};
    if(lastScene==='CHOAM.CPS'&&run.y===23){options.insets=[1,1,1,3];}
    else if (lastScene === 'hud' && run.y === 43 && run.x >= 256 && run.x + run.width <= 321) {
      rect = [258, 43, 60, 8]; options.align = 'center'; options.insets = [2, 1, 2, 1];
    } else if (lastScene === 'hud' && run.x >= 256 && run.y >= 76 && run.y < 124) {
      const button = (frame.borders ?? []).filter(b => b.fill !== false && b.x >= 256 && b.width <= 64 && b.height <= 40 && run.x >= b.x && run.x + run.width <= b.x + b.width + 1 && run.y >= b.y && run.y + run.height <= b.y + b.height + 1).sort((a, b) => a.width * a.height - b.width * b.height)[0];
      if (button) {
        rect = button.height > 16 ? [button.x + 2, button.y + button.height - 9, button.width - 4, 8] : [button.x, button.y, button.width, button.height];
        options.align = 'center'; options.insets = [2, 1, 2, 1];
      }
    }
    ctx.save();
    if(run.stable){ctx.beginPath();for(const clip of run.clips)ctx.rect(...clip.map(n=>n*S));ctx.clip();}
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
    const rect = [command.x, command.y, command.width, command.height];
    const hudDigit = command.id >= 14 && command.id <= 23 && lastScene === 'hud' && command.x >= 260 && command.x <= 310 && command.y < 20;
    let clip = intersectRect((hudDigit ? command.nativeClip : command.clip) ?? [0, 0, 320, 200], [0, 0, 320, 200]);
    if (hudDigit) clip = clip && intersectRect(clip, [256, 3, 60, 11]);
    if (!clip) return;
    ctx.save(); ctx.beginPath(); ctx.rect(...clip.map(n => n * S)); ctx.clip();
    if (semantic) {
      const label = semantic.label ?? semantic.glyph ?? '';
      const digit = command.id >= 14 && command.id <= 23;
      if (command.id === 13) { ctx.restore(); return; }
      if (command.id === 12 && lastScene === 'hud') { ctx.restore(); return; }
      if (command.id >= 7 && command.id <= 10 && lastScene === 'hud') rect[2] = 78;
      if (hudDigit) rect[0] = 260 + Math.round((command.x - 260) / 10) * 9;
      if (command.id === 12) {
        ctx.fillStyle = '#111b24'; ctx.fillRect(...rect.map(n => n * S));
      } else if (!digit) panel(ctx, rect, frame, {button: true, pressed: semantic.state === 'pressed' || semantic.state === 'selected'});
      text(ctx, label, rect, frame, {align: 'center', serif: !digit, colour: digit ? '#f2d69b' : '#eee1ba', clip, insets: digit ? [.75, .75, .75, .75] : [4, 4, 4, 4]});
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
    panel(ctx, rect, frame, {button: border.height <= 20 || hudButton, pressed: border.pressed, compact: hudButton}); borderCount++;
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
      const rect = [label.anchor[0] - width / 2, label.anchor[1] - height / 2, width, height];
      text(ctx, label.text, rect, frame, {align: 'center', serif: true, colour: '#e9d6a6', weight: 600});
    }
  }

  function houseConfirmation(ctx, frame) {
    const scene = chrome.scenes['MISC.ENG'], indices = indexedScenes.get('MISC.ENG');
    if (!scene || cropMatches(frame, indices, [0, 0, 208, 24], [0, 0]) < .9) return;
    frameArt(ctx, 'house-confirm-question', frame, [0, 0, 208, 24]);
    text(ctx, scene.question, [6, 5, 198, 15], frame, {serif: true, align: 'center'});
    for (const [id, source] of Object.entries(scene.sourceNameRects)) if (cropMatches(frame, indices, source, [208, 0]) > .9) {
      frameArt(ctx, 'house-confirm-name', frame, [208, 0, 104, 24]);
      text(ctx, scene.names[id], [210, 5, 100, 15], frame, {serif: true, align: 'center'});
      break;
    }
  }

  function titleScreen(ctx, frame, scene) {
    ctx.fillStyle = '#020304'; ctx.fillRect(0, 0, 1280, 800);
    const points = scene.witnesses ?? [], colours = points.map(([x, y]) => rgb(frame.palette, frame.pixels[y * 320 + x]));
    const brightness = Math.min(1, Math.max(0, ...colours.flat()) / 200);
    ctx.save(); ctx.globalAlpha = brightness;
    for (const label of scene.labels ?? []) text(ctx, label.text, label.nativeRect, frame, {serif: true, weight: 600, align: 'center', colour: '#b72c21', size: label.nativeRect[3] * S * 1.13});
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
    textSamples = []; textFitViolations = 0;
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
    if (scene === 'hud') frameArt(ctx, 'hud-shell', frame);
    else if(campaign){
      ctx.save();ctx.beginPath();for(const r of [[0,0,320,24],[0,24,8,120],[312,24,8,120],[0,144,320,56]])ctx.rect(...r.map(n=>n*S));ctx.clip();frameArt(ctx,'campaign-shell',frame);ctx.restore();
      if(scene!=='MAPMACH.CPS')frameArt(ctx,chrome.scenes[scene].asset,frame,chrome.scenes[scene].displayNativeRect);
    }
    else if (chrome.scenes[scene]?.asset) {
      frameArt(ctx, chrome.scenes[scene].asset, frame);
      staticLabels(ctx, chrome.scenes[scene], frame);
    } else if (scene === 'TITLE.ENG') titleScreen(ctx, frame, chrome.scenes[scene]);
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
      else if (kind === 'sprite') drawIcon(ctx, value, frame);
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

  return {draw, cursor, worldControl, suppressionRects, manifests: {chrome, icons}, diagnostics: () => ({ready: true, frames: rendered, scene: lastScene, glyphs: glyphCount, sprites: spriteCount, borders: borderCount, skippedStale, variantBytes, iconCoverage: icons.coverage, media:media.diagnostics(),textFit:{violations:textFitViolations,labels:textSamples},evidence})};
}
