// Byte encodings used by the original engine and the Czech virtual resources.
const CP437='ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const czechDecoder=new TextDecoder('windows-1250',{fatal:true});
export function decodeNativeText(bytes,encoding='cp437'){
  if(!bytes||typeof bytes[Symbol.iterator]!=='function')throw Error('Invalid native text bytes');
  const values=Array.from(bytes);
  if(values.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Invalid native character');
  if(encoding==='windows-1250')return czechDecoder.decode(Uint8Array.from(values));
  if(encoding!=='cp437')throw Error('Unsupported native text encoding');
  return values.map(v=>v<128?String.fromCharCode(v):CP437[v-128]).join('');
}
export function decodeNativeCharacter(byte,encoding='cp437'){
  return decodeNativeText([byte],encoding);
}
