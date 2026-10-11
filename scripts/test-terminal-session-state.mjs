import assert from 'node:assert/strict';
import {TerminalSessionState} from '../src/terminal-session-state.ts';

const snap=(id,revision,patch={})=>({id,path:'C:/worktrees/task',pid:4100,agentSession:true,running:true,exitCode:null,exitError:null,output:'',outputTruncated:false,outputClosed:false,revision,closed:false,...patch});

// Events received during subscription are staged until the atomic backend snapshot arrives.
let current=[];const duringSubscribe=new TerminalSessionState(s=>current=s);
const completed=snap('pty-1',3,{running:false,exitCode:7,output:'rapid stdout\r\n',outputClosed:true});
duringSubscribe.event(completed);
duringSubscribe.bootstrap([snap('pty-1',2,{output:'rapid stdout\r\n'})]);
assert.deepEqual(current,[completed]);

// Event before snapshot and snapshot-before-event are both single-revision writes, never duplicates.
current=[];const snapshotRace=new TerminalSessionState(s=>current=s);
snapshotRace.event(completed);snapshotRace.bootstrap([completed]);
assert.equal(current.length,1);assert.equal(current[0].output,'rapid stdout\r\n');
snapshotRace.event(completed);assert.equal(current.length,1);
snapshotRace.event(snap('pty-1',4,{running:false,exitCode:7,output:'rapid stdout\r\nlate output',outputClosed:true}));
assert.equal(current[0].output,'rapid stdout\r\nlate output');
snapshotRace.event(snap('pty-1',5,{path:'C:/different-checkout',running:false,exitCode:7,output:'rewritten identity'}));
assert.equal(current[0].path,'C:/worktrees/task');assert.equal(current[0].output,'rapid stdout\r\nlate output');

// A view attached after process exit recovers the full backend history and exit code.
current=[];const delayedView=new TerminalSessionState(s=>current=s);
delayedView.bootstrap([completed]);assert.equal(current[0].exitCode,7);assert.equal(current[0].running,false);
const immutableId=current[0].id,immutablePath=current[0].path;
let selected='pty-1';selected='pty-2';selected='pty-1';
assert.equal(delayedView.current()[0].id,immutableId);assert.equal(delayedView.current()[0].path,immutablePath);
delayedView.event(snap('pty-2',1,{agentSession:false,path:immutablePath}));
assert.equal(delayedView.current().filter(item=>item.agentSession).length,1,'a regular terminal in the same checkout cannot replace the agent process identity');

// Failed launch creates no session; retry creates a distinct identity and close tombstones it.
current=[];const retry=new TerminalSessionState(s=>current=s);retry.bootstrap([]);
assert.equal(current.length,0);
retry.event(snap('pty-2',1,{output:'retry launched'}));assert.equal(current[0].id,'pty-2');
retry.event(snap('pty-2',2,{closed:true,running:false,output:'retry launched'}));assert.equal(current.length,0);
retry.event(snap('pty-2',3,{output:'closed process cannot reappear'}));assert.equal(current.length,0);
retry.event(snap('pty-3',1,{output:'second retry'}));assert.equal(current[0].id,'pty-3');

console.log('TERMINAL-SESSION-STATE 4 lifecycle groups passed');
