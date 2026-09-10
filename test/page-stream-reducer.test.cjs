const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');const {resolve}=require('node:path');const m=new Module(__filename,module);m.paths=module.paths;m._compile(require('esbuild').buildSync({entryPoints:[resolve(__dirname,'../src/runtime/page-stream.ts')],bundle:true,packages:'external',platform:'node',format:'cjs',write:false}).outputFiles[0].text,__filename);
const {createPageStreamState:create,applyPageStreamEvent:apply}=m.exports;
const frame=(sequence,type,payload={})=>({contract:'PageStreamEvent',schemaVersion:1,streamId:'stream',sequence,cursor:'cursor_'+sequence,type,payload});
const snapshot=(seq=10)=>frame(seq,'snapshot',{model:{title:'initial'}});
const fails=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('first snapshot may start after resume cursor, deltas append, later snapshot resets both channels',()=>{let state=create('stream');fails(()=>apply(state,frame(10,'delta',{events:[]})),'PAGE_STREAM_SNAPSHOT_REQUIRED');state=apply(state,snapshot());const previous=state;state=apply(state,frame(11,'delta',{events:[{id:'one'}]}));assert.deepEqual(previous.events,[]);assert.deepEqual(state.model,{title:'initial'});assert.deepEqual(state.events,[{id:'one'}]);state=apply(state,frame(12,'snapshot',{model:{title:'reset'}}));assert.deepEqual(state.events,[]);assert.deepEqual(state.model,{title:'reset'});assert.equal(state.cursor,'cursor_12');});
test('duplicates are ignored, conflicts/gaps/foreign streams fail without changing state',()=>{const original=snapshot();const state=apply(create('stream'),original);assert.equal(apply(state,structuredClone(original)),state);fails(()=>apply(state,{...original,payload:{model:{title:'changed'}}}),'PAGE_STREAM_SEQUENCE_CONFLICT');fails(()=>apply(state,frame(12,'delta',{events:[]})),'PAGE_STREAM_SEQUENCE_GAP');fails(()=>apply(state,{...frame(11,'end'),streamId:'other'}),'PAGE_STREAM_ID_MISMATCH');assert.equal(state.sequence,10);});
test('end and error are terminal but identical final-frame replay remains harmless',()=>{for(const [type,payload]of [['end',{}],['error',{code:'DISCONNECTED',retryable:true}]]){const event=frame(11,type,payload);const state=apply(apply(create('stream'),snapshot()),event);assert.equal(state.status,type==='end'?'ended':'error');assert.equal(apply(state,event),state);fails(()=>apply(state,frame(12,'delta',{events:[]})),'PAGE_STREAM_TERMINATED');}});
test('event and UTF8 budgets reject atomically without dropping events',()=>{let state=apply(create('stream'),snapshot(1));for(let n=2;n<=9;n++)state=apply(state,frame(n,'delta',{events:Array.from({length:256},()=>({value:'ok'}))}));assert.equal(state.events.length,2048);fails(()=>apply(state,frame(10,'delta',{events:[{value:'extra'}]})),'PAGE_STREAM_CAPACITY_EXCEEDED');fails(()=>apply(state,frame(10,'snapshot',{model:{text:'x'.repeat(256*1024)}})),'PAGE_STREAM_INVALID_FRAME');let heavy=apply(create('stream'),snapshot(1));let rejected=false;for(let n=2;n<20;n++){try{heavy=apply(heavy,frame(n,'delta',{events:[{text:'x'.repeat(240*1024)}]}));}catch(e){assert.equal(e.code,'PAGE_STREAM_CAPACITY_EXCEEDED');rejected=true;break;}}assert.equal(rejected,true);assert.ok(heavy.retainedBytes<=2*1024*1024);});

test('long-running periodic snapshots retain only current fingerprint and replace the latest 200 events',()=>{
 let state=create('stream');
 for(let sequence=1;sequence<=4096;sequence++){
  const model={events:Array.from({length:200},(_,index)=>({id:String(index),generation:sequence,text:'current-event'}))};
  state=apply(state,frame(sequence,'snapshot',{model}));
  assert.deepEqual(Object.keys(state.seen),[String(sequence)]);
  assert.equal(state.model.events.length,200);assert.equal(state.events.length,0);assert.ok(state.retainedBytes<32768);
 }
 assert.equal(state.model.events[0].generation,4096);
 fails(()=>apply(state,frame(4095,'snapshot',{model:{events:[]}})),'PAGE_STREAM_SEQUENCE_CONFLICT');
});
test('delta fingerprint window is bounded without silently dropping business events',()=>{
 let state=apply(create('stream'),snapshot(1));
 state=apply(state,frame(2,'delta',{events:[{id:'must-retain'}]}));
 for(let sequence=3;sequence<=2050;sequence++)state=apply(state,frame(sequence,'delta',{events:[]}));
 assert.equal(Object.keys(state.seen).length,2048);assert.deepEqual(state.events,[{id:'must-retain'}]);
 assert.equal(apply(state,frame(2050,'delta',{events:[]})),state);
 fails(()=>apply(state,frame(2,'delta',{events:[{id:'must-retain'}]})),'PAGE_STREAM_SEQUENCE_CONFLICT');
 const replaced=apply(state,frame(2051,'snapshot',{model:{events:[{id:'fresh'}]}}));assert.deepEqual(Object.keys(replaced.seen),['2051']);assert.deepEqual(replaced.events,[]);
});
