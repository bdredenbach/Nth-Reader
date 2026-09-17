const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window={};global.document={createElement:()=>({})};
vm.runInThisContext(fs.readFileSync('js/voice-reader.js','utf8'));
const r=Object.create(window.VoiceReader.prototype);
let voices=[],spoken=[];
Object.assign(r,{supported:true,nativeAvailable:false,voiceUri:'online',synth:{getVoices:()=>voices,speak:u=>spoken.push(u)},els:{voice:{value:'',replaceChildren(){}}},sentences:[{text:'test'}],sentenceIndex:0,rateValue:1,generation:0,
 cancelSpeech(){},clearHighlight(){},setStatus(){},updateControls(){},highlight(){},setSentenceStatus(){}});
global.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
const remote={voiceURI:'online',name:'Online',localService:false,default:true},local={voiceURI:'local',name:'Local',lang:'en',localService:true};
voices=[remote];r.playing=true;r.speakCurrent();assert.equal(spoken.length,0);assert.equal(r.playing,false);
voices=[remote,local];r.playing=true;r.speakCurrent();assert.equal(spoken[0].voice,local);
voices=[];r.playing=true;r.speakCurrent();assert.equal(spoken.length,1);assert.equal(r.voiceUri,'');
console.log('PASS: browser blocks online-only and removed voices; migrates saved network choice to local');
