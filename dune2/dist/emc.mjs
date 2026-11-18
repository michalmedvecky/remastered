// EMC2 word interpreter reconstructed from DUNE2.EXE 23c4:0558.
// The native callback table is supplied explicitly; missing callbacks never return fake success.
export const EMC_VERSION = 1;
export const OPCODES = Object.freeze(['jump','set-return','push-return-or-frame','push','push-word','push-variable','push-local','push-argument','pop-return-or-frame','pop-variable','pop-local','pop-argument','release-stack','reserve-stack','native','jump-if-zero','unary','binary','return-interrupt']);
export const BINARY_OPERATORS = Object.freeze(['&&','||','==','!=','<','<=','>','>=','+','-','*','/','>>','<<','&','|','%','^']);
const word = n => n & 0xffff;
const signed = n => (n << 16) >> 16;
const byteSigned = n => (n << 24) >> 24;

function normalizeProgram(input) {
  if (Array.isArray(input)) return {words:input, orders:[0]};
  if (input && Array.isArray(input.words)) return input;
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  if (!bytes) throw new TypeError('EMC program requires words or byte data');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let data=bytes, orders=[0];
  const tag = at => String.fromCharCode(...bytes.subarray(at,at+4));
  if (bytes.length>=12 && tag(0)==='FORM') {
    if (tag(8)!=='EMC2') throw new Error('Expected FORM/EMC2');
    // Supplied Westwood EMC files store their whole extent in FORM's field.
    // Also admit conventional IFF length-minus-eight when importing other data.
    const declared=view.getUint32(4),end=declared===bytes.length?declared:declared+8;
    if(end>bytes.length || end<12)throw new Error('Invalid EMC container extent');
    data=null;
    for(let at=12;at+8<=end;) {
      const size=view.getUint32(at+4), begin=at+8, finish=begin+size;
      if(finish>end)throw new Error('EMC chunk exceeds container');
      const kind=tag(at);
      if(kind==='DATA')data=bytes.subarray(begin,finish);
      if(kind==='ORDR') {
        if(size&1)throw new Error('Odd ORDR length');
        orders=[];
        for(let off=begin;off<finish;off+=2)orders.push(view.getUint16(off));
      }
      at=finish+(size&1);
    }
    if(!data)throw new Error('EMC DATA chunk is missing');
  }
  if(data.length&1)throw new Error('Odd EMC DATA length');
  const words=[];
  for(let at=0;at<data.length;at+=2)words.push((data[at]<<8)|data[at+1]);
  return {words,orders};
}

export function decodeInstruction(input, pc) {
  const p=normalizeProgram(input), words=p.words;
  if(!Number.isInteger(pc)||pc<0||pc>=words.length)throw new RangeError('EMC instruction pointer outside DATA');
  const raw=word(words[pc]);let opcode=(raw>>>8)&31,operand=0,next=pc+1;
  if(raw&0x8000){opcode=0;operand=raw&0x7fff;}
  else if(raw&0x4000)operand=byteSigned(raw&255);
  else if(raw&0x2000){
    if(next>=words.length)throw new RangeError('Truncated EMC operand');
    operand=signed(words[next++]);
  }
  return {pc,raw,opcode,operand,next};
}

export function decodeProgram(input) {
  const source=normalizeProgram(input);
  if(source.words.length>0x8000)throw new RangeError('EMC DATA exceeds supported word extent');
  if(!source.words.every(n=>Number.isInteger(n)&&n>=0&&n<=0xffff))throw new Error('Invalid EMC word');
  const result={words:[...source.words],orders:[...(source.orders??[0])],instructions:[],usedNativeIds:[],errors:[]};
  const natives=new Set(),boundaries=new Set();
  for(let pc=0;pc<result.words.length;) {
    try {
      const ins=decodeInstruction(result,pc);
      result.instructions.push(ins);boundaries.add(pc);pc=ins.next;
      if(ins.opcode>18)result.errors.push({pc:ins.pc,reason:'unsupported-opcode',opcode:ins.opcode});
      if(ins.opcode===14)natives.add(ins.operand&255);
    } catch(error){result.errors.push({pc,reason:error.message});break;}
  }
  for(const entry of result.orders)if(!boundaries.has(entry))result.errors.push({entry,reason:'entry-not-on-instruction'});
  for(const ins of result.instructions)if((ins.opcode===0||ins.opcode===15)&&!boundaries.has(ins.operand&0x7fff))result.errors.push({pc:ins.pc,target:ins.operand&0x7fff,reason:'branch-not-on-instruction'});
  result.usedNativeIds=[...natives].sort((a,b)=>a-b);
  result.boundaries=[...boundaries];
  return result;
}

export function createScript(program, entry=0) {
  const p=normalizeProgram(program),ip=p.orders?.[entry]??(p.orders?null:entry);
  const vm={version:EMC_VERSION,entry,ip:ip??null,bp:17,sp:15,stack:Array(15).fill(0),variables:Array(5).fill(0),returnValue:0,interrupt:false,delay:0,halted:false,reason:null,error:null,steps:0,nativeCalls:0,last:null};
  if(!Number.isInteger(ip)||ip<0||ip>=p.words.length)stop(vm,'invalid-entry',{entry});
  return vm;
}

// Changing an object's action resets its frame, not its persistent variables.
export function startScript(vm,program,entry=0) {
  const p=normalizeProgram(program),target=p.orders?.[entry];
  vm.entry=entry;vm.bp=17;vm.sp=15;vm.interrupt=false;vm.delay=0;vm.reason=null;vm.error=null;vm.halted=false;vm.ip=target??null;
  if(!Number.isInteger(target)||target<0||target>=p.words.length)stop(vm,'invalid-entry',{entry});
  return vm;
}

function stop(vm,reason,detail=null) {
  vm.halted=true;vm.reason=reason;vm.ip=null;
  if(detail)vm.error={reason,...detail};
  return vm;
}
function stackIndex(vm,index) {
  if(!Number.isInteger(index)||index<0||index>=15)throw new RangeError('EMC stack access outside 15-word stack');
  return index;
}
function push(vm,value){vm.sp--;vm.stack[stackIndex(vm,vm.sp)]=signed(value);}
function pop(vm){const v=vm.stack[stackIndex(vm,vm.sp)];vm.sp++;return signed(v);}
function variableIndex(index){if(!Number.isInteger(index)||index<0||index>=5)throw new RangeError('EMC variable outside five-word array');return index;}
function jump(vm,p,target) {
  const pc=target&0xffff;
  if(pc>=p.words.length)throw new RangeError('EMC branch outside DATA');
  vm.ip=pc;
}
export function readArgument(vm,index=0){return signed(vm.stack[stackIndex(vm,vm.sp+index)]);}

function binary(op,lhs,rhs) {
  switch(op) {
    case 0:return Number(lhs!==0&&rhs!==0);case 1:return Number(lhs!==0||rhs!==0);
    case 2:return Number(lhs===rhs);case 3:return Number(lhs!==rhs);case 4:return Number(lhs<rhs);case 5:return Number(lhs<=rhs);case 6:return Number(lhs>rhs);case 7:return Number(lhs>=rhs);
    case 8:return lhs+rhs;case 9:return lhs-rhs;case 10:return Math.imul(lhs,rhs);
    case 11:case 16:
      if(rhs===0)throw new RangeError('EMC signed division by zero');
      if(lhs===-32768&&rhs===-1)throw new RangeError('EMC signed division overflow');
      return op===11?Math.trunc(lhs/rhs):lhs%rhs;
    case 12:return lhs>>(rhs&31);case 13:return lhs<<(rhs&31);
    case 14:return lhs&rhs;case 15:return lhs|rhs;case 17:return lhs^rhs;
    default:throw new RangeError('Unknown EMC binary operator');
  }
}

export function stepScript(vm,program,native={},context={}) {
  if(vm.halted||vm.delay>0)return vm;
  const p=normalizeProgram(program);
  try {
    const ins=decodeInstruction(p,vm.ip);vm.ip=ins.next;vm.last=ins;vm.steps++;
    const n=ins.operand;
    switch(ins.opcode) {
      case 0:jump(vm,p,n);break;
      case 1:vm.returnValue=signed(n);break;
      case 2:
        if(n===0)push(vm,vm.returnValue);
        else if(n===1){push(vm,vm.ip+1);push(vm,vm.bp);vm.bp=vm.sp+2;}
        else stop(vm,'invalid-push-mode',{mode:n});
        break;
      case 3:case 4:push(vm,n);break;
      case 5:push(vm,vm.variables[variableIndex(n)]);break;
      case 6:push(vm,vm.stack[stackIndex(vm,vm.bp-n-2)]);break;
      case 7:push(vm,vm.stack[stackIndex(vm,vm.bp+n-1)]);break;
      case 8:
        if(n===0)vm.returnValue=pop(vm);
        else if(n===1){if(vm.sp===15)stop(vm,'returned');else {vm.bp=pop(vm)&255;jump(vm,p,pop(vm));}}
        else stop(vm,'invalid-pop-mode',{mode:n});
        break;
      case 9:vm.variables[variableIndex(n)]=pop(vm);break;
      case 10:{const index=stackIndex(vm,vm.bp-n-2),value=pop(vm);vm.stack[index]=value;break;}
      case 11:{const index=stackIndex(vm,vm.bp+n-1),value=pop(vm);vm.stack[index]=value;break;}
      case 12:vm.sp=(vm.sp+(n&255))&255;if(vm.sp>15)throw new RangeError('EMC stack release outside bounds');break;
      case 13:vm.sp=(vm.sp-(n&255))&255;if(vm.sp>15)throw new RangeError('EMC stack reserve outside bounds');break;
      case 14:{
        const id=n&255,fn=native instanceof Map?native.get(id):native[id];
        if(typeof fn!=='function'){stop(vm,'unbound-native',{id,pc:ins.pc});break;}
        vm.nativeCalls++;
        const result=fn(vm,context);
        if(result===undefined)throw new Error(`EMC native ${id} returned no value`);
        if(result&&typeof result==='object') {
          if(!Number.isInteger(result.value))throw new Error(`EMC native ${id} returned invalid value`);
          vm.returnValue=signed(result.value);
          if(result.delay!==undefined){if(!Number.isInteger(result.delay)||result.delay<0)throw new Error('Invalid script delay');vm.delay=result.delay;}
          if(result.halt)stop(vm,'native-halt');
        } else {
          if(!Number.isInteger(result))throw new Error(`EMC native ${id} returned invalid value`);
          vm.returnValue=signed(result);
        }
        break;
      }
      case 15:if(pop(vm)===0)jump(vm,p,n&0x7fff);break;
      case 16:{const value=pop(vm);if(n<0||n>2)throw new RangeError('Unknown EMC unary operator');push(vm,n===0?Number(value===0):n===1?-value:~value);break;}
      case 17:{const rhs=pop(vm),lhs=pop(vm);push(vm,binary(n,lhs,rhs));break;}
      case 18:
        if(vm.sp===15)stop(vm,'returned');
        else{vm.returnValue=pop(vm);const target=pop(vm);vm.interrupt=false;jump(vm,p,target);}
        break;
      default:stop(vm,'invalid-opcode',{opcode:ins.opcode,pc:ins.pc});
    }
  } catch(error){stop(vm,'invalid-state',{message:String(error.message??error)});}
  return vm;
}

export function runScript(vm,program,native={},context={},budget=64) {
  if(!Number.isInteger(budget)||budget<0||budget>65536)throw new RangeError('Invalid EMC instruction budget');
  let executed=0;
  while(executed<budget&&!vm.halted&&vm.delay===0){stepScript(vm,program,native,context);executed++;}
  return {executed,halted:vm.halted,yielded:!vm.halted,reason:vm.reason??(vm.delay>0?'delay':executed===budget?'budget':null)};
}

export function interruptScript(vm,program,entry) {
  if(vm.halted||vm.interrupt)return false;
  const p=normalizeProgram(program),target=p.orders?.[entry];
  if(!Number.isInteger(target)||target<0||target>=p.words.length)return false;
  try{push(vm,vm.ip);push(vm,vm.returnValue);vm.interrupt=true;vm.ip=target;return true;}
  catch(error){stop(vm,'invalid-state',{message:error.message});return false;}
}

export function validateScript(vm,program) {
  const p=normalizeProgram(program);
  return Boolean(vm&&vm.version===EMC_VERSION&&Array.isArray(vm.stack)&&vm.stack.length===15&&vm.stack.every(n=>Number.isInteger(n)&&n>=-32768&&n<=32767)&&Array.isArray(vm.variables)&&vm.variables.length===5&&vm.variables.every(n=>Number.isInteger(n)&&n>=-32768&&n<=32767)&&Number.isInteger(vm.sp)&&vm.sp>=0&&vm.sp<=15&&Number.isInteger(vm.bp)&&vm.bp>=0&&vm.bp<=255&&Number.isInteger(vm.returnValue)&&vm.returnValue>=-32768&&vm.returnValue<=32767&&Number.isInteger(vm.delay)&&vm.delay>=0&&(vm.halted?vm.ip===null:Number.isInteger(vm.ip)&&vm.ip>=0&&vm.ip<p.words.length));
}
