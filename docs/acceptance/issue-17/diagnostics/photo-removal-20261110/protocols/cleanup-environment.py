from pathlib import Path
import sys,json,os,signal,time,shutil,subprocess
sys.path.insert(0,'scripts/acceptance')
from runtime import Report,read_json,write_json,execute,exclusive_lock
from device import Device
from launch import metro_process
p=Path('.acceptance/photo-debug');owner=Path('.acceptance/photo-debug-owner');c=read_json(owner/'config.json');env=read_json(p/'environment.json');r=Report(p/'runs/environment-cleanup','photo-debug-environment-cleanup');d=Device(c,r)
def check(v,name):
 r.event('assertion',name=name,result='pass' if v else 'fail')
 if not v:raise AssertionError(name)
try:
 check(c['serial']=='<owned-emulator>' and env['avd']=='Codex_Metvage_PhotoDebug_20261110','Exact owned emulator identity')
 with exclusive_lock('device:'+d.serial):
  check(d.call('emu','avd','name').splitlines()[0]==env['avd'],'Console matches newly created AVD')
  d.call('shell','am','force-stop',d.package);d.call('uninstall',d.package)
  d.call('shell','settings','put','system','font_scale',env['original_font']);check(d.call('shell','settings','get','system','font_scale')==env['original_font'],'Original emulator font restored')
  for port,target in [('8081','8081'),('18080','18084')]:
   lines=[x.split() for x in d.call('reverse','--list').splitlines()]
   match=[x for x in lines if len(x)>=3 and x[1]=='tcp:'+port]
   check(len(match)==1 and match[0][2]=='tcp:'+target,'Mapping still belongs to this diagnosis: '+port);d.call('reverse','--remove','tcp:'+port)
  check(not d.call('reverse','--list'),'Owned emulator reverse mappings restored empty')
  d.call('emu','kill')
 end=time.monotonic()+25
 while Path('/proc/'+str(env['pid'])+'/stat').exists():
  state=Path('/proc/'+str(env['pid'])+'/stat').read_text().rsplit(')',1)[1].split()[0]
  if state=='Z':break
  if time.monotonic()>end:raise AssertionError('Owned emulator did not stop')
  time.sleep(.2)
 execute(['/home/x/Android/Sdk/cmdline-tools/latest/bin/avdmanager','delete','avd','--name',env['avd']])
 identity=metro_process(c['mobileRoot'],c['metroPort']);proof=read_json(owner/'runtime.json')
 check(identity==proof['metro'],'Metro process still matches recorded owned launch')
 os.killpg(identity['pid'],signal.SIGTERM)
 proxy=read_json(p/'proxy-process.json');cmd=Path('/proc/'+str(proxy['pid'])+'/cmdline')
 if cmd.exists():
  check(b'.acceptance/photo-debug/latency-proxy.py' in cmd.read_bytes(),'Exact owned latency proxy process');os.kill(proxy['pid'],signal.SIGTERM)
 clone=Path('<isolatedServerRoot>');check(clone.resolve()==clone and clone.is_dir(),'Exact owned isolated Server copy')
 inspect=json.loads(execute(['docker','inspect','metvage-photo-debug-owner-api']))[0]
 check(any(x['Source']==str(clone) and x['Destination']=='/var/www/html' for x in inspect['Mounts']),'Container mount belongs to isolated copy')
 execute(['docker','rm','-f','metvage-photo-debug-owner-api','metvage-photo-debug-redis']);execute(['docker','network','rm','metvage-photo-debug-20261110']);shutil.rmtree(clone)
 write_json(p/'environment-cleanup.json',{'status':'pass','owned_avd_deleted':True,'owned_app_uninstalled':True,'emulator_font_restored':True,'emulator_reverse_mappings_restored':True,'owned_metro_stopped':True,'owned_proxy_stopped':True,'isolated_containers_network_and_files_removed':True,'physical_device_used':False})
 r.finish('pass')
except BaseException as e:r.finish('fail',error=str(e));raise
