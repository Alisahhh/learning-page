import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {differentialDrive,playbackPose} from '../simulation.js';

// Exercise the real playback controller with a clock that withholds animation frames.
// This is not a browser rendering test; it checks recovery and timer cleanup.
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const controller=source.slice(source.indexOf('function drawWheels('),source.indexOf('function bindExtras('));
const nodes=new Map();
const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',isConnected:true,setAttribute(name,value){this[name]=value;}});return nodes.get(id);};
for(const [id,value] of Object.entries({'wheel-left':'2','wheel-right':'4','wheel-dt':'.5','wheel-speed':'1'}))get('#'+id).value=value;
let now=0,serial=0;
const intervals=new Map(),frames=new Map();
const env={$:get,differentialDrive,playbackPose,performance:{now:()=>now},wheelAnimation:0,wheelWatchdog:0,wheelRunning:false,wheelFinish:null,
  requestAnimationFrame:callback=>{const id=++serial;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),
  setInterval:callback=>{const id=++serial;intervals.set(id,callback);return id;},clearInterval:id=>intervals.delete(id)};
runInNewContext(controller,env);
env.drawWheels(true);
assert.equal(get('#run-wheels').disabled,true);
now=1000;for(const callback of [...intervals.values()])callback();
assert.equal(get('#wheel-progress').value,1,'Clock must advance even if animation frames stop');
assert.equal(frames.size,1,'Fallback must replace, not duplicate, scheduled frames');
now=6100;for(const callback of [...intervals.values()])callback();
assert.equal(get('#wheel-progress').value,6);
assert.equal(get('#run-wheels').disabled,false);
assert.equal(get('#save-wheel').disabled,false);
assert.equal(intervals.size,0);assert.equal(frames.size,0);
env.drawWheels(true);env.wheelFinish();
assert.equal(get('#wheel-progress').value,6);assert.equal(intervals.size,0);
env.drawWheels(true);env.drawWheels(false);
assert.equal(get('#wheel-progress').value,0);assert.equal(get('#save-wheel').disabled,true);
assert.equal(intervals.size,0);assert.equal(frames.size,0);
env.drawWheels(true);get('#wheel-speed').value='4';now+=1500;
for(const callback of [...intervals.values()])callback();
assert.equal(get('#wheel-progress').value,6);assert.equal(intervals.size,0);
console.log('PASS: stalled animation recovery, timer cleanup, finish/reset and playback speed.');
