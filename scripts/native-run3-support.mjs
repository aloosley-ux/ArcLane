import {fs,path,execFileSync,base} from './native-sprint-harness.mjs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
export function png(w,h,color){
 const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};
 const chunk=(kind,bytes)=>{const k=Buffer.from(kind),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(bytes.length);c.writeUInt32BE(crc(Buffer.concat([k,bytes])));return Buffer.concat([n,k,bytes,c])};
 const head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=2;const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)raw.set(color,y*(w*3+1)+1+x*3);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
export function state(repo){
 const git=(...args)=>execFileSync('git',['--literal-pathspecs','-C',repo,...args],{env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
 const tree=git('write-tree').toString();let index=git('rev-parse','--git-path','index').toString().trim();if(!path.isAbsolute(index))index=path.join(repo,index);
 const files={};const visit=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='.git')continue;const p=path.join(d,e.name);if(e.isDirectory())visit(p);else if(e.isFile())files[path.relative(repo,p)]=fs.readFileSync(p).toString('base64')}};visit(repo);
 return {head:git('rev-parse','HEAD').toString(),refs:git('show-ref').toString(),index:fs.readFileSync(index).toString('base64'),tree,status:git('status','--porcelain=v1','-z').toString(),files};
}
export function same(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Independent Git/file state differs: '+Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).join(','));}
export const invoke=(page,cmd,args)=>page.evaluate(([cmd,args])=>window.__TAURI_INTERNALS__.invoke(cmd,args),[cmd,args]);
export async function screenshot(page,name){await page.screenshot({path:path.join(base,'artifacts',name+'.png')});}
export async function viewport(page,w,h){const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});}
export function provenance(){const exe=path.join(base,'Build','Arclane.exe'),p=JSON.parse(fs.readFileSync(path.join(base,'artifacts','run3-provenance.json'),'utf8').replace(/^\uFEFF/,''));const sha=crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex').toUpperCase();if(p.sha256!==sha)throw Error('Package hash differs from build provenance');return {...p,observedHash:sha};}
