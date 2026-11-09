import os,subprocess,sys,json
from pathlib import Path
peer='.acceptance/issue17-sim-peer/config.json';owner='.acceptance/issue17-sim-owner/config.json'
env={**os.environ,'ISSUE17_PEER_CONFIG':peer,'ISSUE17_OWNER_CONFIG':owner,'ISSUE17_ENV':'simulator','ISSUE17_HTTP_RUN_ROOT':'.acceptance/issue17-sim-http/runs'}
def ui(plan,role='peer',run_id=None):
 config=peer if role=='peer' else owner
 subprocess.run(['npm','run','--silent','acceptance','--','--config',config,'run','--run-id',run_id or 'issue17-'+plan,'--font-scale','1.45','--plan','scripts/acceptance/plans/issue17-'+plan+'.json'],check=True,env=env)
def http(op):subprocess.run(['python3','.acceptance/issue17-checks.py',op],check=True,env=env)
def attach(config,run_id):subprocess.run(['python3','.acceptance/issue17-attach-runtime.py',config,run_id],check=True,env=env)
phase=sys.argv[1]
if phase=='cold':
 before=json.load(open('.acceptance/issue17-sim-peer/runtime.json'))
 attach(peer,'issue17-sim-peer-cold')
 after=json.load(open('.acceptance/issue17-sim-peer/runtime.json'));assert before['app_pid']!=after['app_pid']
 proof=Path('.acceptance/issue17-simulator/cold-proof.json');proof.write_text(json.dumps({'before_pid':before['app_pid'],'after_pid':after['app_pid'],'source':after['source'],'serial':after['serial'],'environment':'emulator'})+'\n');env['ISSUE17_COLD_PROOF']=str(proof)
 ui('cold-matrix');http('cold');http('records');http('pixels');ui('dog-social-readonly');http('dog-social')
elif phase=='cold-resume':
 env['ISSUE17_COLD_PROOF']='.acceptance/issue17-simulator/cold-proof.json';ui('cold-resume');http('cold');http('records');http('pixels');ui('dog-social-readonly');http('dog-social')
elif phase=='unavailable':ui('unavailable')
elif phase=='owner':
 ui('owner-notifications','owner');ui('owner-private','owner');http('private');ui('peer-private-boundary');ui('owner-public','owner');http('public');ui('peer-public-boundary');ui('owner-edit-delete','owner');http('edited');http('deleted')
else:raise ValueError('Unknown simulator phase')
