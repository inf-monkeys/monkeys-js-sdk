const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');const {resolve}=require('node:path');
const compiled=new Module(__filename,module);compiled.paths=module.paths;compiled._compile(require('esbuild').buildSync({entryPoints:[resolve(__dirname,'../src/contracts/component-assembly.ts')],bundle:true,packages:'external',platform:'node',format:'cjs',write:false}).outputFiles[0].text,__filename);
const {ComponentAssemblySchema}=compiled.exports;
const assembly=textI18n=>({contract:'ComponentAssembly',schemaVersion:1,messages:{children:{textI18n}}});
test('component messages carry strict I18nText independently from translation-key messages',()=>{
 const text={defaultLocale:'en-US',values:{'en-US':'English','zh-CN':'中文标题'}};
 assert.deepEqual(ComponentAssemblySchema.parse(assembly(text)).messages.children,{textI18n:text});
 for(const messages of [{children:'heading.title'},{children:{key:'heading.title',values:{count:3}}}])assert.equal(ComponentAssemblySchema.safeParse({contract:'ComponentAssembly',schemaVersion:1,messages}).success,true);
});
test('raw locale maps, missing default values and mixed message variants are rejected',()=>{
 for(const value of [{'zh-CN':'中文标题'},{defaultLocale:'en-US',values:{'zh-CN':'中文'}},{defaultLocale:'en-US',values:{'en-US':' '}}])assert.equal(ComponentAssemblySchema.safeParse(assembly(value)).success,false);
 const value=assembly({defaultLocale:'en-US',values:{'en-US':'English'}});value.messages.children.key='forbidden-mixture';assert.equal(ComponentAssemblySchema.safeParse(value).success,false);
});
