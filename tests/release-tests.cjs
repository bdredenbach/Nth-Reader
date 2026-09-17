const {parseHTML}=require('linkedom'),vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
function fixture(){const {window}=parseHTML(html);let now=0,id=0;const timers=new Map();const ctx=vm.createContext({window,document:window.document,performance:{now:()=>now},setTimeout:(cb,ms)=>{timers.set(++id,{cb,at:now+ms});return id;},clearTimeout:i=>timers.delete(i),console});return{window,ctx,advance(ms){now+=ms;for(const [i,t] of [...timers])if(t.at<=now){timers.delete(i);t.cb();}},timers};}
for(const scenario of ['ready','timeout','tap']){
 const f=fixture();vm.runInContext(fs.readFileSync('js/launch.js','utf8'),f.ctx);
 if(scenario==='ready'){f.window.dispatchEvent(new f.window.Event('nth:app-ready'));f.advance(1400);}
 if(scenario==='timeout')f.advance(6000);
 if(scenario==='tap')f.window.document.querySelector('#launch-splash').click();
 ok(f.window.document.querySelector('#launch-splash').classList.contains('leaving'),scenario+' dismisses splash');
 ok(f.window.NthDismissSplash()===false,'dismissal is idempotent');f.advance(460);ok(!f.window.document.querySelector('#launch-splash'),'splash removed');
}
const f=fixture();vm.runInContext(fs.readFileSync('js/reading-style.js','utf8'),f.ctx);const proto=f.window.ReadingStyleController.prototype;proto.applyVariables=()=>{};proto.updateUI=()=>{};const style=new f.window.ReadingStyleController({});
for(const [old,next] of Object.entries({'libre-baskerville':'newsreader',lora:'petrona',merriweather:'fraunces',lexend:'atkinson'})){ok(style.validate({...style.defaults,font:old}).font===next,'saved font migrates');ok(!style.fonts[old]&&!fs.existsSync('assets/fonts/'+old+'.woff'),'removed font absent');}
for(const key of ['bodoni-moda','newsreader','fraunces','petrona','gloock','instrument-serif']){ok(!!style.fonts[key]&&!!f.window.document.querySelector('option[value="'+key+'"]')&&fs.existsSync('assets/fonts/'+key+'.woff'),'new font fully connected');}
const sw=fs.readFileSync('sw.js','utf8');const files=sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/)[1].match(/"([^\"]+)"/g).map(x=>JSON.parse(x));for(const path of files)ok(fs.existsSync(path.split('?')[0]),'cache path exists: '+path);
(async()=>{
 const dialog=f.window.document.querySelector('#license-dialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;f.ctx.fetch=async()=>({ok:true,text:async()=>fs.readFileSync('THIRD_PARTY_NOTICES.txt','utf8')});
 vm.runInContext(fs.readFileSync('js/licenses.js','utf8'),f.ctx);f.window.document.querySelector('#menu-licenses-btn').click();await new Promise(resolve=>setImmediate(resolve));
 ok(dialog.open,'licenses open');ok(f.window.document.querySelector('#license-text').textContent.includes('pako'),'notices load');f.window.document.querySelector('#license-close').click();ok(!dialog.open,'licenses close');console.log(checks+' release checks passed (simulated DOM; not visual validation)');
})().catch(e=>{console.error(e);process.exitCode=1;});
