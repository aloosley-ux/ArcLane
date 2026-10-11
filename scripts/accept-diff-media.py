"""Read-only staged/worktree/history inspection with independent byte invariants."""
from fixture_support import *
import struct,zlib,base64
from PIL import Image
from io import BytesIO
checks=[];fixtures=[]
def check(name,condition):assert condition,name;checks.append(name);print('PASS',name,flush=True)
def png(w,h,color):
    def chunk(k,b):return struct.pack('>I',len(b))+k+b+struct.pack('>I',zlib.crc32(k+b)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+bytes(color)*w)*h))+chunk(b'IEND',b'')
f=Fixture('media');fixtures.append(f);a=png(32,24,(200,30,40));b=png(48,32,(30,150,200));c=png(64,48,(50,200,80));f.write('image.png',a);f.write('zero.bin',b'');f.write('code.ts',b'\xef\xbb\xbfconst n = 1;\r\n\r\nlast');f.commit();base=f.git('rev-parse','HEAD').decode().strip();f.write('image.png',b);f.git('add','image.png');f.write('image.png',c)
state=f.state()
for staged,left,right in [(True,a,b),(False,b,c)]:
    m=f.call('media',{'file':'image.png','staged':staged})
    check(('Staged' if staged else 'Unstaged')+' image sides exact',m['before']['sha256']==hashlib.sha256(left).hexdigest() and m['after']['sha256']==hashlib.sha256(right).hexdigest() and m['after']['kind']=='image')
    payload=base64.b64decode(m['after']['preview'].split(',')[1]);check('Verified bounded PNG preview '+str(staged),payload.startswith(b'\x89PNG') and len(payload)<=2_000_000)
    check('Dimensions from decoded bytes '+str(staged),m['after']['width']==(48 if staged else 64))
check('Image inspection preserves all Git/file bytes',f.state()==state)
f.write('image.png',b);f.git('commit','-qm','image change');sha=f.git('rev-parse','HEAD').decode().strip();state=f.state()
m=f.call('media',{'file':'image.png','commit':sha});check('Historical sides exact',m['before']['sha256']==hashlib.sha256(a).hexdigest() and m['after']['sha256']==hashlib.sha256(b).hexdigest())
r=f.call('review_revisions',{'to':sha,'file':'image.png'});check('Revision review uses genuine media fallback',r['media']['after']['kind']=='image' and r['comparison'] is None)
check('Historical inspection preserves state',f.state()==state)
for format in ['JPEG','GIF','WEBP']:
    buf=BytesIO();Image.new('RGB',(28,19),(80,150,200)).save(buf,format=format);data=buf.getvalue();name='mislabelled-'+format+'.txt';f.write(name,data);state=f.state();m=f.call('media',{'file':name});check('Verified bytes override misleading extension '+format,m['after']['kind']=='image' and m['after']['width']==28 and m['after']['height']==19);check('Independent format inspection is read-only '+format,f.state()==state)
f.write('dimension-limit.png',png(4097,1,(1,2,3)));m=f.call('media',{'file':'dimension-limit.png'});check('Dimension limit refuses decoding preview',m['after']['kind']=='binary' and 'preview' not in m['after'])
buf=BytesIO();Image.new('RGB',(12,12),(200,20,40)).save(buf,format='GIF',save_all=True,append_images=[Image.new('RGB',(12,12),(20,200,40))],duration=100,loop=0);f.write('animated.gif',buf.getvalue());m=f.call('media',{'file':'animated.gif'});decoded=Image.open(BytesIO(base64.b64decode(m['after']['preview'].split(',')[1])));check('Animation truthfully becomes verified static first frame',m['after']['kind']=='image' and decoded.n_frames==1 and 'first frame' in m['after']['reason'])
for name,data,kind in [('fake.png',b'MZ\x00executable','binary'),('nonutf.bin',b'\xff\xfe','binary'),('document.pdf',b'%PDF-1.7\x00','binary'),('corrupt.png',b'\x89PNG\r\n\x1a\n','binary'),('oversize.bin',b'X'*2_000_001,'binary'),('active.svg',b'<svg onload="alert(1)"></svg>','text'),('zero.bin',b'','text')]:
    f.write(name,data);state=f.state();m=f.call('media',{'file':name});check('Truthful fallback '+name,m['after']['exists'] and m['after']['size']==len(data) and m['after']['kind']==kind and 'preview' not in m['after']);check('Read-only fallback '+name,f.state()==state)
f.write('new.png',a);m=f.call('media',{'file':'new.png'});check('New image absent old side',not m['before']['exists'] and m['after']['kind']=='image')
f.git('add','new.png');m=f.call('media',{'file':'new.png','staged':True});check('Staged new image',not m['before']['exists'] and m['after']['kind']=='image');f.git('commit','-qm','new image');(f.repo/'new.png').unlink();m=f.call('media',{'file':'new.png'});check('Deleted worktree image',m['before']['kind']=='image' and not m['after']['exists']);f.git('add','new.png');m=f.call('media',{'file':'new.png','staged':True});check('Staged deleted image',m['before']['kind']=='image' and not m['after']['exists']);f.git('commit','-qm','delete image');m=f.call('media',{'file':'new.png','commit':f.git('rev-parse','HEAD').decode().strip()});check('Historical deletion',m['before']['kind']=='image' and not m['after']['exists'])
m=f.call('media',{'file':'image.png'});check('Identical image bytes truthfully classified',m['identical'])
f.write('renamed [é].png',b);f.git('mv','image.png','old.png');f.git('mv','old.png','renamed.png');m=f.call('media',{'file':'renamed.png','staged':True});check('Staged rename maps old path',m['before']['sha256']==m['after']['sha256'])
text=b'\xef\xbb\xbfconst n = 1;\r\n\r\nlast';f.write('code.ts',text);m=f.call('compare',{'file':'code.ts'});check('BOM CRLF blank EOF preserved exactly',m['before'].encode()==text and m['after'].encode()==text)
f.write('code.ts',b'const n = 2;\n\r\nlast\n');m=f.call('compare',{'file':'code.ts'});check('Mixed endings exact',m['after'].encode()==b'const n = 2;\n\r\nlast\n')
f.write('long.txt',b'line\n'*30000);m=f.call('compare',{'file':'long.txt'});check('Long text read within bound',m['linesAfter']==30000)
for name in ['../outside','-evil',str(f.repo/'code.ts'),'.git/config']:
    state=f.state();f.call('media',{'file':name},ok=False);check('Unsafe path refused '+name,f.state()==state)
save('diff-media-acceptance',checks,fixtures)
