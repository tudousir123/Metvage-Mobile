"""Owned emulator -> loopback test API; no credential/body logging."""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
import urllib.request,urllib.error,json,time,re,threading
lock=threading.Lock()
root=Path('.acceptance/photo-debug')
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
class Handler(BaseHTTPRequestHandler):
 def handle_request(self):
  if not self.path.startswith('/') or self.path.startswith('//'):self.send_error(400);return
  match=re.fullmatch(r'/api/v1/metvage/records/(\d+)(?:\?.*)?',self.path)
  delay=0
  if self.command=='GET' and match:
   state=json.loads((root/'fixtures/fixtures.json').read_text());ids={x.get('id') for x in state['records']}
   if int(match[1]) in ids:delay=json.loads((root/'latency.json').read_text())['seconds']
  data=self.rfile.read(int(self.headers.get('Content-Length','0'))) if self.headers.get('Content-Length') else None
  headers={k:v for k,v in self.headers.items() if k.lower() not in ['host','connection','content-length']}
  request=urllib.request.Request('http://127.0.0.1:18080'+self.path,data=data,headers=headers,method=self.command)
  try:response=urllib.request.build_opener(NoRedirect).open(request,timeout=20)
  except urllib.error.HTTPError as e:response=e
  raw=response.read()
  if match:
   with lock:
    with (root/'proxy-events.jsonl').open('a') as out:out.write(json.dumps({'method':self.command,'record_id':int(match[1]),'status':response.status,'delivery_delay':delay,'captured_at':time.time()})+'\n')
  time.sleep(delay);self.send_response(response.status)
  for k,v in response.headers.items():
   if k.lower() not in ['connection','content-length','transfer-encoding']:self.send_header(k,v)
  self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 do_GET=do_POST=do_PATCH=do_PUT=do_DELETE=handle_request
 def log_message(self,*args):pass
ThreadingHTTPServer(('127.0.0.1',18081),Handler).serve_forever()
