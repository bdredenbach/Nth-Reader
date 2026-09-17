/* Launch art: dismissal is bounded even if initialization fails. */
(()=>{
 const splash=document.getElementById("launch-splash"),started=performance.now();
 let leaving=false,fallback,readyTimer;
 const dismiss=()=>{if(leaving)return false;leaving=true;clearTimeout(fallback);clearTimeout(readyTimer);splash.classList.add("leaving");splash.setAttribute("aria-hidden","true");splash.tabIndex=-1;setTimeout(()=>splash.remove(),window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?0:460);return true;};
 window.NthDismissSplash=dismiss;
 splash.addEventListener("click",dismiss);
 splash.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();dismiss();}});
 window.addEventListener("nth:app-ready",()=>{if(!leaving)readyTimer=setTimeout(dismiss,Math.max(0,1400-(performance.now()-started)));},{once:true});
 fallback=setTimeout(dismiss,6000);
})();
