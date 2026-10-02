"""Minimal differential-drive contact simulation. Educational model, not a real robot twin.

Install: python -m pip install mujoco==3.14.0
Run:     python labs/sim-first.py --left 2 --right 4 --output result.json
Headless: add --headless. On macOS GUI use mjpython instead of python.
"""
import argparse
import json
import math
import platform
import time
from contextlib import nullcontext
from pathlib import Path

import mujoco
import mujoco.viewer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--left', type=float, default=2)
    parser.add_argument('--right', type=float, default=2)
    parser.add_argument('--seconds', type=float, default=6)
    parser.add_argument('--dt', type=float, default=0.002)
    parser.add_argument('--friction', type=float, default=1)
    parser.add_argument('--headless', action='store_true')
    parser.add_argument('--output', type=Path, default=Path('result.json'))
    args = parser.parse_args()
    values = [args.left, args.right, args.seconds, args.dt, args.friction]
    if not all(math.isfinite(v) for v in values) or not 0.0001 <= args.dt <= 0.01 or not 0 < args.seconds <= 120 or not 0 <= args.friction <= 5 or max(abs(args.left), abs(args.right)) > 10:
        parser.error('Use finite values: |wheel speed| <= 10, dt in [0.0001, 0.01], seconds in (0,120], friction in [0,5].')
    if args.output.exists():
        parser.error('Output already exists. Choose a new filename to preserve earlier evidence.')
    xml = f'''<mujoco model="learning_cart">
      <option timestep="{args.dt}" gravity="0 0 -9.81" integrator="implicitfast"/>
      <visual><global azimuth="130" elevation="-30"/></visual>
      <asset><texture name="grid" type="2d" builtin="checker" width="256" height="256" rgb1=".83 .86 .92" rgb2=".95 .96 .98"/><material name="floor" texture="grid" texrepeat="10 10"/></asset>
      <worldbody>
        <light pos="0 0 4" diffuse=".9 .9 .9"/>
        <geom name="floor" type="plane" size="8 8 .1" material="floor" friction="{args.friction} .005 .0001"/>
        <body name="base" pos="0 0 .11">
          <freejoint/>
          <geom type="box" size=".16 .12 .035" pos="0 0 .07" mass="2" rgba=".14 .28 .84 1"/>
          <geom type="box" size=".05 .07 .005" pos=".1 0 .11" mass=".01" rgba="1 1 1 1" contype="0" conaffinity="0"/>
          <geom name="front_support" type="sphere" size=".04" pos=".13 0 -.06" mass=".02" friction=".001 .00001 .00001" priority="1" rgba=".3 .35 .45 1"/>
          <geom name="rear_support" type="sphere" size=".04" pos="-.13 0 -.06" mass=".02" friction=".001 .00001 .00001" priority="1" rgba=".3 .35 .45 1"/>
          <body name="left_wheel" pos="0 .25 0"><joint name="left" type="hinge" axis="0 1 0" damping=".01"/><geom type="cylinder" size=".1 .025" euler="90 0 0" mass=".2" friction="{args.friction} .005 .0001" rgba=".12 .15 .2 1"/></body>
          <body name="right_wheel" pos="0 -.25 0"><joint name="right" type="hinge" axis="0 1 0" damping=".01"/><geom type="cylinder" size=".1 .025" euler="90 0 0" mass=".2" friction="{args.friction} .005 .0001" rgba=".12 .15 .2 1"/></body>
        </body>
      </worldbody>
      <actuator><velocity name="left_speed" joint="left" kv="1" ctrlrange="-10 10" forcerange="-5 5"/><velocity name="right_speed" joint="right" kv="1" ctrlrange="-10 10" forcerange="-5 5"/></actuator>
    </mujoco>'''
    model = mujoco.MjModel.from_xml_string(xml)
    data = mujoco.MjData(model)
    for _ in range(round(1 / args.dt)):
        mujoco.mj_step(model, data)
    start_time = float(data.time)
    start_xy = data.qpos[:2].copy()
    data.ctrl[:] = [args.left, args.right]
    samples = []
    context = nullcontext(None) if args.headless else mujoco.viewer.launch_passive(model, data)
    with context as viewer:
        if viewer:
            viewer.cam.lookat[:] = [0, 0, 0]
            viewer.cam.distance = 3
        next_sample = 0.0
        while data.time - start_time < args.seconds - 1e-9:
            if viewer and not viewer.is_running():
                break
            tick = time.perf_counter()
            mujoco.mj_step(model, data)
            elapsed = float(data.time - start_time)
            if elapsed >= next_sample:
                w, xq, yq, zq = data.qpos[3:7]
                yaw = math.atan2(2 * (w * zq + xq * yq), 1 - 2 * (yq * yq + zq * zq))
                samples.append({'t': elapsed, 'x': float(data.qpos[0] - start_xy[0]), 'y': float(data.qpos[1] - start_xy[1]), 'yaw': yaw, 'contacts': int(data.ncon)})
                next_sample += .02
                if viewer:
                    viewer.sync()
            if viewer:
                time.sleep(max(0, args.dt - (time.perf_counter() - tick)))
    result = {'kind':'mujoco-contact-simulation','mujoco_version':mujoco.__version__,'python':platform.python_version(),'platform':platform.system(),'config':{k:str(v) if isinstance(v,Path) else v for k,v in vars(args).items()},'completed_seconds':float(data.time-start_time),'model_limits':['Rigid simplified cart; supports are low-friction sliding spheres, not modeled caster assemblies.','No sensors, ROS, learned policy, calibrated motor or real robot validation.'],'samples':samples}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'output':str(args.output),'samples':len(samples),'final':samples[-1] if samples else None},ensure_ascii=False))


if __name__ == '__main__':
    main()
