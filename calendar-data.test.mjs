import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const source = await readFile(new URL('./src/calendarData.js', import.meta.url), 'utf8');
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const {localDateKey, monthRange, withReadTimeout, readCalendarMonth, calendarLoadMessage} = await import(moduleUrl);
const deferred = () => {let resolve, reject; const promise = new Promise((yes,no) => {resolve=yes; reject=no;}); return {promise,resolve,reject};};
const snapshot = (...items) => ({docs: items.map(([id, data]) => ({id, data:()=>data}))});

for (const zone of ['America/Phoenix', 'America/Denver', 'Asia/Bangkok']) {
  test(`date keys stay on the chosen local day in ${zone}`, () => {
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module','-e', `
      const {localDateKey,monthRange}=await import(${JSON.stringify(moduleUrl)});
      console.log(JSON.stringify({
        late:localDateKey(new Date(2026,10,23,23,59)),
        early:localDateKey(new Date(2026,10,23,0,1)),
        leap:monthRange(new Date(2028,1,15)),
        dst:monthRange(new Date(2026,2,15))
      }));`], {env:{...process.env,TZ:zone},encoding:'utf8'}));
    assert.equal(result.late, '2026-11-23');
    assert.equal(result.early, '2026-11-23');
    assert.deepEqual(result.leap,{from:'2028-02-01',to:'2028-02-29'});
    assert.deepEqual(result.dst,{from:'2026-03-01',to:'2026-03-31'});
  });
}

test('December and January ranges stay within the requested year', () => {
  assert.deepEqual(monthRange(new Date(2026,11,24)),{from:'2026-12-01',to:'2026-12-31'});
  assert.deepEqual(monthRange(new Date(2027,0,1)),{from:'2027-01-01',to:'2027-01-31'});
});

test('protocol and month-log reads start together, remain user scoped, and never request older history', async () => {
  const protocols=deferred(),logs=deferred(),requests=[];
  const api={collection:(_db,name)=>({name}),where:(...args)=>args,query:(ref,...filters)=>({...ref,filters}),getDocsFromServer:q=>{requests.push(q);return q.name==='protocols'?protocols.promise:logs.promise;}};
  const result=readCalendarMonth({},'fictional-user',new Date(2026,10,23),api);
  assert.equal(requests.length,2);
  assert.deepEqual(requests[1].filters,[['userId','==','fictional-user'],['date','>=','2026-11-01'],['date','<=','2026-11-30']]);
  protocols.resolve(snapshot(['p-1',{name:'Fictional protocol',id:'wrong-data-id'}]));
  logs.resolve(snapshot(['l-1',{date:'2026-11-23',taken:true}]));
  assert.deepEqual(await result,{protocols:[{id:'p-1',name:'Fictional protocol'}],logs:[{id:'l-1',date:'2026-11-23',taken:true}]});
});

test('missing identity performs no database reads', async () => {
  let called=false;
  await assert.rejects(readCalendarMonth({},null,new Date(),{getDocsFromServer:()=>{called=true;}}),/Sign in/);
  assert.equal(called,false);
});

test('failed reads reject rather than manufacture an empty successful calendar', async () => {
  const api={collection:(_db,name)=>({name}),where:(...x)=>x,query:x=>x,getDocsFromServer:()=>Promise.reject(Object.assign(Error('denied'),{code:'permission-denied'}))};
  await assert.rejects(readCalendarMonth({},'fictional-user',new Date(),api),{code:'permission-denied'});
  assert.match(calendarLoadMessage({code:'permission-denied'}),/sign in again/);
  assert.match(calendarLoadMessage({code:'failed-precondition'}),/setup needs attention/);
});

test('a stalled read ends in a timeout and a late result cannot resolve it again', async () => {
  const pending=deferred();
  const result=withReadTimeout(pending.promise,5);
  await assert.rejects(result,{code:'calendar/timeout'});
  pending.resolve('late');
  await assert.rejects(result,{code:'calendar/timeout'});
});

test('successful and rejected reads preserve their original result', async () => {
  assert.equal(await withReadTimeout(Promise.resolve('ready'),100),'ready');
  const error=Error('offline');
  await assert.rejects(withReadTimeout(Promise.reject(error),100),e=>e===error);
});
