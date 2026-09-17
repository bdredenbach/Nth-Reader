(()=>{
 const dialog=document.getElementById("license-dialog"),text=document.getElementById("license-text");
 document.getElementById("menu-licenses-btn").addEventListener("click",async()=>{dialog.showModal();try{const r=await fetch("THIRD_PARTY_NOTICES.txt");if(!r.ok)throw Error("unavailable");text.textContent=await r.text();}catch(_){text.textContent="Licenses could not load. Please reopen the app and try again.";}});
 document.getElementById("license-close").addEventListener("click",()=>dialog.close());
})();
