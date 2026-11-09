import json,sys,time,re,shlex,subprocess,hashlib,datetime,xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0,'scripts/acceptance')
from device import Device
from runtime import Report,interruptible,AcceptanceError
c=json.load(open('.acceptance/issue17-peer/config.json'));r=Report(Path('.acceptance/issue17-peer/runs')/sys.argv[1],'android-test-file-picker');d=Device(c,r)
filename='metvage-issue17-generated-cat.png';path='/sdcard/Download/'+filename
where="relative_path='Download/' AND _display_name='"+filename+"'"
query='content query --uri content://media/external/images/media --projection _id:_display_name:date_modified --where '+shlex.quote(where)
metadata=d.call('shell',query);assert metadata.count('Row:')==1
stamp=int(re.search(r'date_modified=(\d+)',metadata)[1]);date=datetime.datetime.fromtimestamp(stamp,datetime.timezone(datetime.timedelta(hours=8)));label=f'照片，{date.year}年{date.month}月{date.day}日 {date:%H:%M:%S}'
# Ensure no other file in this album has the same timestamp.
unique=d.call('shell','content query --uri content://media/external/images/media --projection _id --where '+shlex.quote("relative_path='Download/' AND date_modified="+str(stamp)));assert unique.count('Row:')==1
source=Path('.acceptance')/next(x for x in c['fixtures'] if x['key']=='cat')['image'];expected=hashlib.sha256(source.read_bytes()).hexdigest();assert d.call('shell','sha256sum',path).split()[0]==expected
r.event('verified_test_asset',filename=filename,sha256=expected,modified=stamp,locator=label)
def nodes():
 window=d.call('shell','dumpsys','window');assert re.search(r'mCurrentFocus=.*?\bu0 com.android.photopicker/',window),'Expected Xiaomi system photo picker'
 xml='/sdcard/metvage-issue17-picker.xml';d.call('shell','uiautomator','dump',xml)
 try:root=ET.fromstring(d.call('shell','cat',xml))
 finally:d.call('shell','rm','-f',xml)
 d.ui_reads+=1;return [n for n in root.iter('node') if n.get('package')=='com.android.photopicker']
def tap(node,target):
 b=list(map(int,re.findall(r'\d+',node.get('bounds',''))));assert len(b)==4 and b[2]>b[0] and b[3]>b[1];assert node.get('enabled')!='false';d.call('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));r.event('picker_control',target=target)
try:
 with interruptible(),d.session(r.directory):
  chosen=False;visited=set();deadline=time.monotonic()+45
  while time.monotonic()<deadline:
   try:d.foreground();d.wait_condition({'label':'移除第 1 张照片'});r.event('selection',filename=filename,test_app_photo_count=1);break
   except AcceptanceError:pass
   ns=nodes()
   if chosen:
    buttons=[n for n in ns if n.get('resource-id')=='com.android.photopicker:id/confirm_button'];assert len(buttons)==1;tap(buttons[0],'confirm-one-generated-image')
    # Confirmation can return through a transient window before the App regains focus.
    wait=time.monotonic()+10
    while True:
     try:d.foreground();break
     except AcceptanceError:
      if time.monotonic()>wait:raise
      time.sleep(.1)
    continue
   downloads=[n for n in ns if n.get('text')=='下载内容']
   in_downloads=any(n.get('resource-id','').endswith(':id/action_bar_title') for n in downloads)
   if in_downloads:
    matches=[n for n in ns if n.get('content-desc')==label];assert len(matches)==1,'Test image must have one timestamp match in Downloads'
    checkboxes=[n for n in matches[0].iter('node') if n.get('resource-id')=='com.android.photopicker:id/checkbox'];assert len(checkboxes)==1;tap(checkboxes[0],'verified-generated-image');chosen=True;continue
   for text in ['下载内容','影集','相册']:
    match=[n for n in ns if text in [n.get('text'),n.get('content-desc')]]
    if match and text not in visited:
     # Prefer the text node when parent and child share an accessibility label.
     match.sort(key=lambda n:0 if n.get('class','').endswith('TextView') else 1)
     tap(match[0],text);visited.add(text);break
   else:raise AcceptanceError('Verified Downloads route missing; no image selected')
  else:raise AcceptanceError('Test photo selection timed out')
 r.finish('pass')
except BaseException as e:r.finish('fail',error=str(e));raise
