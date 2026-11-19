// Verified, in-memory resource overlays; original PAKs and desktop files are read-only.
export const ENGLISH_SHELL={
  graphics:'Graphics',painted:'HD · painted',original:'Original · 1992',music:'Music',language:'Language',saves:'Saved missions',manual:'Field manual',
  subtitle:'THE BATTLE FOR ARRAKIS',badge:'PAINTED HD',command:'IMPERIAL COMMAND · ARRAKIS',arrivalTitle:'The spice\nmust flow.',
  arrivalDescription:'Three Houses. One desert planet. Newly painted terrain, buildings and units.\nLead your House through the original campaigns, from the first spice harvest to the battle for Arrakis.',
  intro:'Play the opening cinematic',launch:'Enter Arrakis',loading:'Loading campaign data and HD artwork…',ready:'Campaign data ready.',active:'Arrakis command link active.',
  note:'Mouse and keyboard recommended. Your missions are saved in this browser. Use Saved missions to export a backup. Choose the language before entering the game.',
  fullscreen:'⛶ Full screen',collection:'← Remastered collection',artwork:'HD artwork',fidelity:'Fidelity & credits',source:'Sources & artwork',
  canvas:'Dune II interface. Left click to select and issue commands. F2 opens Options.',game:'Dune II game',controls:'Browser controls',planet:'Arrakis planet artwork',
  manualTitle:'Commander’s field manual',manualIntro:'The game uses its original interface and campaign progression.',
  manual1:'Left click a unit or building to select it. Choose an action in the command panel, then click its destination or target.',
  manual2:'Right click cancels a target command. Move the pointer to a map edge, or use the original direction keys, to scroll.',
  manual3:'Select the Construction Yard to build. Place concrete on rock before placing most structures.',
  manual4:'Refineries turn harvested spice into credits. Protect your harvesters and keep your Windtraps running.',
  manual5:'Press F2 or select Options to save, load, adjust game speed or return to the menu. F1 opens the Mentat.',
  manual6:'Use Space or a mouse click to advance the Mentat’s text, then select Proceed.',
  manual7:'Cutscenes can be skipped with a key or mouse button where the original sequence allows it.',
  manual8:'Use ASCII letters without accents for security answers.',
  manualSave:'Save using the original menu, then use Saved missions above the screen to export a backup. Imported native saves appear in the original Load Game menu.',
  return:'Return to command',saveIntro:'Export a native save, or import an original SAVE000.DAT or browser _save000.dat file. Imports use the next free slot.',
  import:'Import native save',close:'Close',noSaves:'No saved missions yet. Use the in-game Options menu to save.',
  imported:'Imported {names}. Open Load Game in the original menu.',storageError:'Persistent saves are unavailable in this browser. Export your saves before leaving.',
  engineError:'Engine stopped: {message}',saveError:'Save storage: {message}',localeBefore:'Choose the language before entering the game.',
};
export function shellText(locale,key,values={}){
  let text=locale?.shell?.[key]??ENGLISH_SHELL[key]??key;
  return text.replace(/\{([a-z]+)\}/g,(all,name)=>String(values[name]??all));
}
export function paintShellLocale(locale,root=document){
  for(const node of root.querySelectorAll('[data-i18n]'))node.textContent=shellText(locale,node.dataset.i18n);
  for(const node of root.querySelectorAll('[data-i18n-aria]'))node.setAttribute('aria-label',shellText(locale,node.dataset.i18nAria));
  root.documentElement.lang=locale.locale;
}
export async function loadNativeLocale(name,{fetcher=fetch,baseURL=new URL('./',import.meta.url)}={}){
  if(name==='en')return{schema:1,locale:'en',encoding:'cp437',files:[],resources:[],shell:ENGLISH_SHELL};
  if(name!=='cs')throw Error('Unsupported game language');
  const response=await fetcher(new URL('locales/cs.json',baseURL));
  if(!response.ok)throw Error('Český překlad se nepodařilo načíst.');
  const locale=await response.json();
  if(locale.schema!==1||locale.locale!=='cs'||locale.encoding!=='windows-1250'||locale.complete!==true||!Array.isArray(locale.files)||locale.files.length>40)throw Error('Neplatný nebo neúplný český překlad.');
  const names=new Set(),resources=[];
  for(const file of locale.files){
    if(!/^[A-Z0-9_-]+\.(ENG|FNT|CPS|SHP)$/.test(file.name)||names.has(file.name)||file.src!=='locales/cs/'+file.name||!Number.isSafeInteger(file.bytes)||file.bytes<=0||file.bytes>1024*1024||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Neplatný soubor českého překladu.');
    names.add(file.name);
    const result=await fetcher(new URL(file.src,baseURL));if(!result.ok)throw Error('Chybí soubor překladu: '+file.name);
    const bytes=new Uint8Array(await result.arrayBuffer());
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(bytes.length!==file.bytes||digest!==file.sha256)throw Error('Poškozený soubor překladu: '+file.name);
    resources.push({name:file.name,bytes});
  }
  return{...locale,resources};
}
export function applyNativeLocale(core,locale){
  if(!Array.isArray(locale.resources)||locale.resources.some(r=>!/^[A-Z0-9_-]+\.(ENG|FNT|CPS|SHP)$/.test(r.name)||!(r.bytes instanceof Uint8Array)))throw Error('Neplatné prostředky jazyka.');
  let config=null;
  // English suffixes select the Czech overlay. This byte is outside DUNE.CFG's checksum.
  if(locale.locale==='cs'){
    config=core.FS.readFile('/save/DUNE.CFG').slice();
    if(config.length!==10)throw Error('Neplatná konfigurace hry.');
    config[8]=0;
  }
  for(const resource of locale.resources)core.FS.writeFile('/data/'+resource.name,resource.bytes);
  if(config)core.FS.writeFile('/save/DUNE.CFG',config);
}
