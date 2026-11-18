import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readPak} from '../tools/preload-data.mjs';
import {createScript,startScript,stepScript,runScript,decodeProgram,decodeInstruction,readArgument,interruptScript,validateScript,BINARY_OPERATORS} from '../dist/emc.mjs';

const imm=(op,n=0)=>0x4000|(op<<8)|(n&255);
const wide=(op,n)=>[0x2000|(op<<8),n&0xffff];
const jump=n=>0x8000|n;
const program=words=>({words,orders:[0]});
function evaluate(words,native={}) {const p=program([...words,imm(8,1)]),vm=createScript(p);runScript(vm,p,native,{},256);return vm;}

test('EMC operand encodings and container bounds',()=>{
  assert.deepEqual(decodeInstruction(program([imm(4,-8)]),0),{pc:0,raw:0x44f8,opcode:4,operand:-8,next:1});
  assert.equal(decodeInstruction(program(wide(4,0x8000)),0).operand,-32768);
  assert.equal(decodeInstruction(program([jump(7)]),0).opcode,0);
  assert.equal(decodeInstruction(program([jump(7)]),0).operand,7);
  assert.throws(()=>decodeInstruction(program([0x2400]),0),/Truncated/);
  assert.throws(()=>decodeProgram(Uint8Array.of(0)),/Odd/);
  assert.throws(()=>decodeProgram({words:[-1],orders:[0]}),/Invalid/);
  const parsed=decodeProgram({words:[imm(4,1),...wide(15,0)],orders:[0]});
  assert.deepEqual(parsed.boundaries,[0,1]);
  assert.deepEqual(parsed.errors,[]);
});

test('immediates, variables, return register and signed wrap',()=>{
  let vm=evaluate([imm(1,37),imm(2,0),imm(9,2),imm(5,2),imm(8,0)]);
  assert.equal(vm.returnValue,37);assert.equal(vm.variables[2],37);assert.equal(vm.reason,'returned');
  vm=evaluate([...wide(3,32767),imm(4,1),imm(17,8),imm(8,0)]);
  assert.equal(vm.returnValue,-32768);assert.equal(vm.sp,15);
  assert.ok(validateScript(vm,program([imm(8,1)])));
  vm.variables[1]=23;startScript(vm,program([imm(8,1)]));
  assert.equal(vm.variables[1],23);assert.equal(vm.sp,15);assert.equal(vm.bp,17);assert.equal(vm.halted,false);
});

test('call frames, argument-relative and local-relative operations',()=>{
  // Push argument 12, call setup, jump to procedure, copy argument into local,
  // replace it with 29, then copy back into argument; return releases the frame.
  const p=program([
    imm(4,12),imm(2,1),jump(5),imm(12,1),imm(8,1),
    imm(13,1),imm(7,1),imm(10,1),imm(4,29),imm(10,1),
    imm(6,1),imm(11,1),imm(7,1),imm(8,0),imm(12,1),imm(8,1)
  ]);
  const vm=createScript(p);runScript(vm,p,{}, {},128);
  assert.equal(vm.returnValue,29);assert.equal(vm.sp,15);assert.equal(vm.bp,17);
  assert.equal(vm.reason,'returned');
});

test('conditional branches pop conditions and distinguish zero',()=>{
  const falseCase=evaluate([imm(4,0),imm(15,4),imm(1,9),jump(5),imm(1,7)]);
  assert.equal(falseCase.returnValue,7);
  const trueCase=evaluate([imm(4,1),imm(15,4),imm(1,9),jump(5),imm(1,7)]);
  assert.equal(trueCase.returnValue,9);
});

test('all unary and binary operations follow signed 16-bit instruction semantics',()=>{
  for(const [mode,value,expected]of [[0,0,1],[0,7,0],[1,3,-3],[2,0,-1]]) {
    assert.equal(evaluate([imm(4,value),imm(16,mode),imm(8,0)]).returnValue,expected);
  }
  const expected=[1,1,0,1,0,0,1,1,10,4,21,2,0,56,3,7,1,4];
  for(let op=0;op<BINARY_OPERATORS.length;op++) {
    assert.equal(evaluate([imm(4,7),imm(4,3),imm(17,op),imm(8,0)]).returnValue,expected[op],BINARY_OPERATORS[op]);
  }
  assert.equal(evaluate([imm(4,-7),imm(4,3),imm(17,11),imm(8,0)]).returnValue,-2);
  assert.equal(evaluate([imm(4,-7),imm(4,3),imm(17,16),imm(8,0)]).returnValue,-1);
  assert.equal(evaluate([imm(4,-8),imm(4,2),imm(17,12),imm(8,0)]).returnValue,-2);
});

test('native argument access, return values, delays and explicit unknowns',()=>{
  const p=program([imm(4,9),imm(14,3),imm(12,1),imm(8,1)]),vm=createScript(p);
  const result=runScript(vm,p,{3:(state,ctx)=>({value:readArgument(state)*ctx.factor,delay:6})},{factor:7});
  assert.equal(vm.returnValue,63);assert.equal(vm.delay,6);assert.equal(result.reason,'delay');assert.equal(vm.nativeCalls,1);
  vm.delay=0;runScript(vm,p);assert.equal(vm.reason,'returned');
  const unknown=evaluate([imm(14,42)]);
  assert.equal(unknown.reason,'unbound-native');assert.equal(unknown.error.id,42);
  assert.equal(evaluate([imm(14,3)],{3:()=>undefined}).reason,'invalid-state');
});

test('interrupt entry and return preserve previous instruction and return register',()=>{
  const p={words:[imm(1,8),imm(8,1),imm(1,27),imm(4,99),imm(8,0),imm(18,0)],orders:[0,2]},vm=createScript(p);
  stepScript(vm,p);assert.equal(vm.returnValue,8);
  assert.equal(interruptScript(vm,p,1),true);assert.equal(interruptScript(vm,p,1),false);
  runScript(vm,p);assert.equal(vm.returnValue,8);assert.equal(vm.reason,'returned');assert.equal(vm.interrupt,false);
});

test('bounded loops, malformed stacks and division faults fail predictably',()=>{
  const p=program([jump(0)]),vm=createScript(p);
  assert.deepEqual(runScript(vm,p,{}, {},32),{executed:32,halted:false,yielded:true,reason:'budget'});
  assert.equal(vm.steps,32);
  assert.equal(evaluate([imm(8,0)]).reason,'invalid-state');
  assert.equal(evaluate([imm(4,1),imm(4,0),imm(17,11)]).reason,'invalid-state');
  assert.equal(evaluate([...wide(4,-32768),imm(4,-1),imm(17,11)]).reason,'invalid-state');
  assert.equal(evaluate([imm(5,5)]).reason,'invalid-state');
  // Native byte stack arithmetic wraps before bounds checking.
  const wrap=evaluate([imm(12,-1),imm(4,1),imm(12,2)]);
  assert.equal(wrap.sp,15);assert.equal(wrap.reason,'returned');
});

test('all supplied original EMC instructions, entries and branches decode',()=>{
  const members=readPak('DUNE.PAK');
  const expected={BUILD:[19,502],UNIT:[27,2700],TEAM:[6,153]};
  for(const [name,[entries,count]]of Object.entries(expected)) {
    const member=members.get(`${name}.EMC`);
    const p=decodeProgram(member.bytes);
    assert.equal(p.orders.length,entries);assert.equal(p.words.length,count);assert.deepEqual(p.errors,[],name);
    for(let entry=0;entry<p.orders.length;entry++)assert.ok(validateScript(createScript(p,entry),p));
    assert.ok(p.usedNativeIds.length>0);
  }
  const content=JSON.parse(fs.readFileSync(new URL('../dist/assets/content.json',import.meta.url),'utf8'));
  for(const [name,[entries,count]]of Object.entries(expected)) {
    const p=decodeProgram(content.scripts[name]);
    assert.equal(p.orders.length,entries);assert.equal(p.words.length,count);assert.deepEqual(p.errors,[],`imported ${name}`);
  }
});
