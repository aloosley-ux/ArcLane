// Compare the real Win32 client/WebView2 HWND bounds with the packaged page viewport
// at cold launch and after changing the native window size.
import {launch,fixture,fs,path,base,execFileSync,wait,expect} from './native-sprint-harness.mjs';

const f=fixture('native-window-bounds'),{repo,git,write}=f;
write('tracked.txt','window bounds fixture\n');git('add','--all');git('commit','-qm','Window bounds fixture');
const profile=fs.mkdtempSync(path.join(base,'artifacts','native-window-bounds-profile-'));
fs.writeFileSync(path.join(profile,'repos.json'),JSON.stringify([repo]));
const native=(pid,width=0,height=0)=>{
 const ps=`$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public static class ArcLaneBounds {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left,top,right,bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x,y; }
 public delegate bool EnumProc(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h,ref POINT p);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,EnumProc cb,IntPtr l);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int cx,int cy,uint flags);
 public static IntPtr[] Children(IntPtr h){var a=new List<IntPtr>();EnumChildWindows(h,(c,l)=>{a.Add(c);return true;},IntPtr.Zero);return a.ToArray();}
 public static string Class(IntPtr h){var s=new StringBuilder(256);GetClassName(h,s,s.Capacity);return s.ToString();}
}
'@
$p=Get-Process -Id ${pid};$h=$p.MainWindowHandle
if($h -eq [IntPtr]::Zero){throw 'ArcLane top-level HWND not found'}
if(${width} -gt 0 -and -not [ArcLaneBounds]::SetWindowPos($h,[IntPtr]::Zero,0,0,${width},${height},0x0002 -bor 0x0004 -bor 0x0010)){throw 'SetWindowPos failed'}
$cr=New-Object ArcLaneBounds+RECT;if(-not [ArcLaneBounds]::GetClientRect($h,[ref]$cr)){throw 'GetClientRect failed'}
$origin=New-Object ArcLaneBounds+POINT;[void][ArcLaneBounds]::ClientToScreen($h,[ref]$origin)
$children=@(foreach($c in [ArcLaneBounds]::Children($h)){$r=New-Object ArcLaneBounds+RECT;if([ArcLaneBounds]::GetWindowRect($c,[ref]$r)){[pscustomobject]@{class=[ArcLaneBounds]::Class($c);visible=[ArcLaneBounds]::IsWindowVisible($c);x=$r.left-$origin.x;y=$r.top-$origin.y;width=$r.right-$r.left;height=$r.bottom-$r.top}}})
[pscustomobject]@{pid=$p.Id;client=@{width=$cr.right-$cr.left;height=$cr.bottom-$cr.top};dpi=[ArcLaneBounds]::GetDpiForWindow($h);children=$children}|ConvertTo-Json -Compress -Depth 5`;
 const encoded=Buffer.from(ps,'utf16le').toString('base64');
 return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-EncodedCommand',encoded],{encoding:'utf8'}));
};
const session=await launch(repo,'native-window-bounds',9501,{},profile);const {page}=session;
const viewport=()=>page.evaluate(()=>({width:document.documentElement.clientWidth,height:document.documentElement.clientHeight,innerWidth,innerHeight,dpr:devicePixelRatio}));
const verify=(label,state)=>{
 const webview=state.native.children.find(c=>c.class==='WRY_WEBVIEW'&&c.visible);
 if(!webview)throw Error(label+': visible WRY_WEBVIEW HWND is missing');
 const client=state.native.client,view=state.webview,scale=state.native.dpi/96;
 if(webview.x!==0||webview.y!==0||webview.width!==client.width||webview.height!==client.height)throw Error(label+': WebView HWND does not cover the Win32 client rect: '+JSON.stringify(state));
 if(Math.abs(view.innerWidth*scale-client.width)>2||Math.abs(view.innerHeight*scale-client.height)>2||Math.abs(view.width-view.innerWidth)>1||Math.abs(view.height-view.innerHeight)>1)throw Error(label+': WebView2 viewport differs from scaled Win32 client bounds: '+JSON.stringify(state));
};
try{
 const pid=JSON.parse(fs.readFileSync(path.join(profile,'launch.json'),'utf8')).pid;
 await wait(600);const startup={native:native(pid),webview:await viewport()};verify('startup',startup);await page.screenshot({path:path.join(base,'artifacts','native-window-bounds-startup.png')});
 await native(pid,1096,719);await expect.poll(async()=>{const p=await viewport();return p.innerWidth},{timeout:5000}).toBe(1080);await wait(300);
 const resizedCompact={native:native(pid),webview:await viewport()};verify('compact resize',resizedCompact);
 await native(pid,1552,997);await expect.poll(async()=>{const p=await viewport();return p.innerWidth},{timeout:5000}).toBe(1536);await wait(300);
 const resizedExpanded={native:native(pid),webview:await viewport()};verify('expanded resize',resizedExpanded);await page.screenshot({path:path.join(base,'artifacts','native-window-bounds-expanded.png')});
 const checks=['startup WRY_WEBVIEW HWND fills actual Win32 client rect and WebView2 viewport matches DPI-scaled bounds','resize to 1080x680 client updates Win32 child and WebView2 viewport','resize back to 1536x958 client updates Win32 child and WebView2 viewport'];
 const evidence={repo,checks,startup,resizedCompact,resizedExpanded,errors:session.errors};
 fs.writeFileSync(path.join(base,'artifacts','native-window-bounds-accept.json'),JSON.stringify(evidence,null,2));
 console.log('NATIVE-WINDOW-BOUNDS',checks.length,JSON.stringify({startup,resizedCompact,resizedExpanded}));
}finally{await session.close();}
