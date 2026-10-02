// Ideal planar differential drive; deliberately excludes contact and actuator dynamics.
// Display only: interpolate between Euler samples without changing the simulated result.
export function playbackPose(result,time) {
  const samples=result.samples,t=Math.max(0,Math.min(result.duration,time));
  let lo=0,hi=samples.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(samples[mid].t<=t)lo=mid;else hi=mid-1;}
  const a=samples[lo],b=samples[Math.min(lo+1,samples.length-1)];
  const fraction=b.t>a.t?Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))):0;
  return {index:lo,t,x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,theta:a.theta+(b.theta-a.theta)*fraction};
}
export function differentialDrive({left=2,right=2,dt=.02,duration=6,radius=.1,track=.5}={}) {
  if(![left,right,dt,duration,radius,track].every(Number.isFinite)||dt<=0||dt>1||duration<=0||duration>60||radius<=0||track<=0)throw Error('Invalid simulation parameters');
  const v=radius*(left+right)/2,omega=radius*(right-left)/track;
  let x=0,y=0,theta=0,t=0;const samples=[{t,x,y,theta}];
  while(t<duration-1e-10){const h=Math.min(dt,duration-t);x+=v*Math.cos(theta)*h;y+=v*Math.sin(theta)*h;theta+=omega*h;t+=h;samples.push({t,x,y,theta});}
  const exact=Math.abs(omega)<1e-10?{x:v*duration,y:0}:{x:v/omega*Math.sin(omega*duration),y:v/omega*(1-Math.cos(omega*duration))};
  return {left,right,dt,duration,radius,track,v,omega,samples,final:{x,y,theta},exact,error:Math.hypot(x-exact.x,y-exact.y)};
}
