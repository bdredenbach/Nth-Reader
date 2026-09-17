// DOM/controller regression suite. Layout and animation frames are simulated;
// this suite does not replace real browser or device visual verification.
const {parseHTML} = require('linkedom');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'page-deck.html'),'utf8');
const {window} = parseHTML(html);
const {document,HTMLElement} = window;
HTMLElement.prototype.getBoundingClientRect = function() {
 let width = parseFloat(this.style.width), height = parseFloat(this.style.height);
 if(this.id==='fixture'){width ||= 390;height ||= 700;}
 if(!width || this.style.width==='100%') width=this.parentElement?.getBoundingClientRect().width||390;
 if(!height || this.style.height==='100%') height=this.parentElement?.getBoundingClientRect().height||700;
 return {width,height,left:0,top:0,right:width,bottom:height};
};
Object.defineProperties(HTMLElement.prototype,{
 clientWidth:{get(){return this.getBoundingClientRect().width}},
 clientHeight:{get(){return this.getBoundingClientRect().height}}
});
// Canvas operations are recorded; pixels and html2canvas layout require a device.
window.HTMLCanvasElement.prototype.getContext=function(){
 if(this._ctx)return this._ctx;
 const calls=[];this._ctx={calls,createLinearGradient(){return {addColorStop(){}}}};
 for(const name of ['setTransform','clearRect','drawImage','beginPath','lineTo','moveTo','closePath','clip','save','restore','fillRect','transform','scale'])this._ctx[name]=(...args)=>calls.push([name,...args]);
 return this._ctx;
};
window.getComputedStyle=()=>({length:0});
window.html2canvas=async copy=>{const c=document.createElement('canvas');c.width=390;c.height=700;c.textContent=copy.textContent;return c;};
const context=vm.createContext({window,document,HTMLElement,Node:window.Node,console,performance,setTimeout,clearTimeout,requestAnimationFrame:cb=>setTimeout(cb,8),cancelAnimationFrame:clearTimeout});
for(const name of ['nth-page-deck','page-mode']){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),context);
 context.NthPageDeck=window.NthPageDeck;
 context.LongboxPageMode=window.LongboxPageMode;
}
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
vm.runInContext(script,context);
(async()=>{
 await document.querySelector('#run').onclick();
 const results=document.querySelector('#results').textContent;
 console.log(results);
 if(!results.includes('ALL TESTS PASSED'))process.exitCode=1;
})();
