"""Cold-launch another owned test package against the same acknowledged Metro."""
import sys,json,time
from pathlib import Path
sys.path.insert(0,'scripts/acceptance')
from runtime import Report,interruptible,read_json,write_json
from device import Device
from launch import source_fingerprint,metro_process,proof_server
from doctor import diagnose
config_path=Path(sys.argv[1]);run_id=sys.argv[2];c=read_json(config_path)
c['runtimeJournal']=str(config_path.resolve().parent/'runtime.json')
if Path('.acceptance/issue17-phone-released.json').exists():assert c['serial'] in ['emulator-5556','emulator-5558'],'Physical device has been released'
root=Path(c['runRoot']);root=(config_path.resolve().parent/root).resolve() if not root.is_absolute() else root
out=root/run_id;r=Report(out,'attach-runtime');d=Device(c,r)
try:
 with interruptible(),d.session(out):
  diagnose(c,r,d);identity=metro_process(c['mobileRoot'],c['metroPort']);assert identity
  env=dict(x.split(b'=',1) for x in Path(f'/proc/{identity["pid"]}/environ').read_bytes().split(b'\0') if b'=' in x)
  callback=json.loads(env[b'EXPO_PUBLIC_METVAGE_ACCEPTANCE_PROOF']);source=source_fingerprint(c['mobileRoot']);assert callback['source']==source
  port=int(c.get('proofPort',18082));assert callback['url']==f'http://localhost:{port}/proof'
  expected={k:callback[k] for k in ['nonce','source']}
  # Package IDs match on these two fresh emulators; only the target may forward proof.
  for other in ['emulator-5556','emulator-5558']:
   if other!=d.serial:
    from runtime import execute
    assert not any(line.split()[1:2]==[f'tcp:{port}'] for line in execute(['adb','-s',other,'reverse','--list']).splitlines()),'Proof endpoint is also forwarded by another test emulator'
  with proof_server(port,expected,d.package) as accepted:
   journal=read_json(out/'device.json');mapping=f'tcp:{port}'
   if mapping not in journal['changed_ports']:journal['changed_ports'].append(mapping);write_json(out/'device.json',journal)
   d.call('reverse',mapping,mapping);scheme=d.installed_scheme()
   d.call('shell','am','force-stop',d.package);d.call('shell','am','start','-a','android.intent.action.VIEW','-d',scheme+':///','-p',d.package)
   assert accepted.wait(90),'Fresh native package acknowledgement required'
   d.wait_condition({'label':c.get('readyLabel','搜索宠物笔记')},timeout=60)
   assert source_fingerprint(c['mobileRoot'])==source and metro_process(c['mobileRoot'],c['metroPort'])==identity
   proof={'source':source,'scheme':scheme,'package':d.package,'serial':d.serial,'app_pid':d.call('shell','pidof',d.package),'metro':identity,'metro_pid':identity['pid']}
   write_json(c['runtimeJournal'],proof);r.event('runtime_verified',source=source,scheme=scheme,metro_pid=identity['pid'],same_metro=True)
 r.finish('pass')
except BaseException as error:r.finish('fail',error=str(error));raise
