from pathlib import Path
import sys,json
sys.path.insert(0,'scripts/acceptance')
from runtime import read_json,execute,Report,write_json
p=Path('.acceptance/photo-debug-owner');c=read_json(p/'config.json');r=Report(p/'runs/original-data','original-data-comparison')
try:
 values=[]
 for container in ['metvage-issue17-phone-api','metvage-photo-debug-owner-api']:
  source=(p/'verify-originals.php').read_text().removeprefix('<?php');values.append(json.loads(execute(['docker','exec','-i',container,'php','-r',source],data=json.dumps({'username':c['profileUsername']}).encode())))
 assert values[0]==values[1], 'Isolated original pets, record/photo bytes or selected identity differ'
 assert values[0]['pet_count']==2 and values[0]['current_pet_id']==1
 write_json(p/'original-data.json',{'status':'pass','original_pets_records_photo_bytes_equal_to_protected_server':True,'original_selected_pet_restored':True,'only_original_two_pets_remain_in_clone':True})
 r.finish('pass',original_pet_count=2,original_photo_bytes_equal=True)
except BaseException as e:r.finish('fail',error=str(e));raise
