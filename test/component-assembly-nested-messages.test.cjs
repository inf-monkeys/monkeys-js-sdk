const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { resolve } = require('node:path');
const compiled = new Module(__filename, module); compiled.paths = module.paths;
compiled._compile(require('esbuild').buildSync({ stdin: { contents: `export * from './src/contracts/component-assembly'; export { compileComponentAssemblyValidator } from './src/runtime/component-assembly';`, resolveDir: resolve(__dirname, '..'), loader: 'ts' }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, __filename);
const { ComponentAssemblySchema, ComponentMessageSchema, compileComponentAssemblyValidator } = compiled.exports;
const text = { defaultLocale: 'en-US', values: { 'en-US': 'Name', 'zh-CN': '名称' } };
const definitions = { Column: { type: 'object', additionalProperties: false, required: ['id', 'label'], properties: { id: { type: 'string' }, label: { anyOf: [{type:'string', maxLength: 30}, {type:'null'}] }, type: { enum: ['text'] }, url: {type:'string',format:'uri'}, code:{type:'string',pattern:'^[A-Z]+$'}, count: {type:'number'} } } };
const prop = (name, schema, kind='property') => ({ name, schema, kind, required: false, type: 'JSON' });
const descriptor = { id: 'NestedLabels', version: 1, source: 'fixture.tsx', exports: [], props: [
 prop('labels',{type:'object',additionalProperties:{type:'string'}}),
 prop('columns',{type:'array',items:{$ref:'#/$defs/Column'}}),
 prop('children',undefined,'slot'), prop('onClick',undefined,'event'), prop('renderEditor',undefined,'renderer'), prop('host',undefined,'host'),
 prop('untyped',{type:'object',additionalProperties:true}),
] };
const validate = compileComponentAssemblyValidator(descriptor, definitions);
const base = () => ({contract:'ComponentAssembly',schemaVersion:1,props:{labels:{visibleColumns:'Visible columns'},columns:[{id:'name',label:'Name',type:'text',url:'https://example.com',code:'ABC',count:1}],children:'Heading'},messageBindings:[{path:['labels','visibleColumns'],message:{key:'table.columns',values:{count:7}}},{path:['columns',0,'label'],message:{textI18n:text}}]});
const withPath = path => ({...base(),messageBindings:[{path,message:'localized.value'}]});

test('nested labels and numeric column paths preserve all existing message variants and old shape',()=>{
 const parsed=validate(base()); assert.deepEqual(parsed.messageBindings,base().messageBindings);
 assert.equal(ComponentMessageSchema.safeParse({textI18n:text}).success,true);
 assert.equal(ComponentMessageSchema.safeParse({key:'legacy',values:{count:7,active:true}}).success,true);
 assert.equal(ComponentMessageSchema.safeParse('legacy.key').success,true);
 const old={contract:'ComponentAssembly',schemaVersion:1,props:{},events:{},slots:{},renderers:{},hosts:{},messages:{}};
 assert.deepEqual(ComponentAssemblySchema.parse(old),old);
 assert.equal(validate(withPath(['children'])).messageBindings.length,1);
});

test('bounded paths reject prototypes, malformed indexes, aliases, overlap and executable roots',()=>{
 for(const path of [[],[0],['columns',-1,'label'],['columns',0.5,'label'],['columns',Number.MAX_SAFE_INTEGER+1,'label'],['columns',1,'label'],['columns','0','label'],['columns','01','label'],['columns',0,'missing'],['labels','__proto__'],['labels','constructor'],['labels','prototype'],['labels','bad\u0000'],['labels','missing'],['onClick'],['renderEditor'],['host'],Array(17).fill('labels')]) assert.throws(()=>validate(withPath(path)),JSON.stringify(path));
 const duplicate=base();duplicate.messageBindings.push(duplicate.messageBindings[0]);assert.throws(()=>validate(duplicate));
 const overlap=base();overlap.messageBindings.push({path:['columns',0],message:'value'});assert.throws(()=>validate(overlap));
 const excessive=base();excessive.messageBindings=Array.from({length:257},(_,i)=>({path:['labels',String(i)],message:'value'}));assert.equal(ComponentAssemblySchema.safeParse(excessive).success,false);
});

test('only declared text leaves can be translated; structure, constraints and unknown schemas stay owned',()=>{
 for(const path of [['columns'],['columns',0],['columns',0,'id'],['columns',0,'type'],['columns',0,'url'],['columns',0,'code'],['columns',0,'count']]) assert.throws(()=>validate(withPath(path)),JSON.stringify(path));
 const untyped={...withPath(['untyped','anything']),props:{...base().props,untyped:{anything:'text'}}};assert.throws(()=>validate(untyped));
 const mixed=base();mixed.messageBindings[0].message={key:'key',textI18n:text};assert.throws(()=>validate(mixed));
 const functionValue=base();functionValue.props.labels.visibleColumns=()=>{};assert.throws(()=>validate(functionValue));
});

test('each dynamic model and the resolved localized props receive the same final schema validation',()=>{
 const initial=base();const snapshot=structuredClone(initial);validate(initial);
 const translated=structuredClone(initial);translated.props.labels.visibleColumns='显示 7 列';translated.props.columns[0].label='名称';assert.equal(validate(translated).props.columns[0].label,'名称');assert.deepEqual(initial,snapshot);
 const changed=base();changed.props.columns=[];assert.throws(()=>validate(changed));
 const invalid=base();invalid.props.columns[0].label=12;assert.throws(()=>validate(invalid));
 const tooLong=base();tooLong.props.columns[0].label='x'.repeat(31);assert.throws(()=>validate(tooLong));
 const denied=base();denied.messages={labels:'competing.owner'};assert.throws(()=>validate(denied));
});

test('legacy top-level messages cannot own an ancestor of a nested message binding',()=>{
 const collision={contract:'ComponentAssembly',schemaVersion:1,messages:{labels:'translated.labels'},messageBindings:[{path:['labels','visibleColumns'],message:'translated.visible'}]};
 assert.equal(ComponentAssemblySchema.safeParse(collision).success,false);
 const same={...collision,messageBindings:[{path:['labels'],message:'translated.labels'}]};assert.equal(ComponentAssemblySchema.safeParse(same).success,false);
 const siblings={...base(),messages:{other:'translated.other'}};assert.equal(ComponentAssemblySchema.safeParse(siblings).success,true);
 assert.throws(()=>validate({...base(),messages:{labels:'translated.labels'}}));
});
