from pathlib import Path
import sys,re,json,base64
sys.path.insert(0,'scripts/acceptance')
from runtime import read_json,Report,write_json,execute
from fixtures import FixtureRun
from device import Device
p=Path('.acceptance/photo-debug');c=read_json(p/'config.json');assert c['serial']=='<owned-emulator>';r=Report(p/'runs/finalize','photo-debug-cleanup');d=Device(c,r);f=FixtureRun(c,p/'fixtures','photo-debug-20261110',r)
def check(v,name,**extra):
 r.event('assertion',name=name,result='pass' if v else 'fail',**extra)
 if not v:raise AssertionError(name)
def local(op,**extra):
 source=(p/'cleanup-local.php').read_text().removeprefix('<?php');return json.loads(execute(['docker','exec','-i',c['serverContainer'],'php','-r',source],data=json.dumps({'operation':op,'username':c['profileUsername'],'account_id':f.state['account_id'],**extra}).encode()))
try:
 raw=d.call('exec-out','run-as',d.package,'cat','files/mmkv/mmkv.default',binary=True);tokens=list(dict.fromkeys(re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',raw)));check(len(tokens)==1,'One owned actual App OAuth token');f.token=tokens[0].decode();r.secrets.append(f.token)
 payload=f.token.split('.')[1];claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)));check(int(claims['sub'])==f.state['account_id'],'App subject matches dedicated generated fixture owner')
 protected_before=local('protected');pets={x['id'] for x in f.state['pets']};check({x['id'] for x in f.pets()['pets']}==pets,'Only this run generated pets exist in dedicated account')
 for entry in f.state['records']:
  if entry['id'] is None:continue
  value=f.request('GET',f'/records/{entry["id"]}')['record'];check(value['pet_id'] in pets,'Reassociated generated record remains in owned fixture pet set',record_id=entry['id']);entry['pet_id']=value['pet_id']
 f.save();allowed=set(f.admin('owned_records',records=f.state['records'])['ids']);check(allowed=={x['id'] for x in f.state['records']},'Every eligible record has exact run request marker',count=len(allowed))
 f.cleanup();check(not f.pets()['pets'] and f.pets()['current_pet_id'] is None,'Dedicated account restored to empty original pet state')
 check(local('protected')==protected_before,'All other users and their pets/records/photo metadata unchanged by cleanup')
 result=local('revoke',jti=claims['jti'],aud=claims['aud']);check(all(result.values()),'Only this simulator OAuth session revoked; other token states preserved')
 write_json(p/'data-cleanup.json',{'status':'pass','generated_pets_removed':len(pets),'generated_records_removed':len(allowed),'dedicated_account_empty':True,'other_users_data_unchanged':True,**result})
 r.finish('pass')
except BaseException as e:r.finish('fail',error=str(e));raise
