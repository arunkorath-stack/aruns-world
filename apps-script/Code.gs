/**
 * Chapter Quiz Hub — Google Apps Script backend
 * University of Kalba · Dr Arun Korath
 *
 * Tabs created by setup(): Subjects, Chapters, Questions, Videos, Students, Attempts
 * Deploy: Extensions → Apps Script → paste → Deploy → New deployment → Web app
 *         Execute as: Me · Who has access: Anyone → copy the /exec URL into config.json
 * Then run setup() once from the editor (it creates the tabs and a teacher key).
 */

const SHEETS = {
  Subjects:  ['code','title','term','sort','active'],
  Chapters:  ['subject','chapter','title','clos','active'],
  Questions: ['id','subject','chapter','quiz','bloom','clo','sec','stem','opt1','opt2','opt3','opt4','answer','why','status','created'],
  Videos:    ['id','subject','chapter','title','url','minutes','added'],
  Students:  ['studentId','name','codename','subject','firstSeen','lastSeen'],
  Attempts:  ['attemptId','when','studentId','codename','subject','chapter','quiz','score','total','seconds','attemptNo','detail']
};
const ANIMALS = ['Falcon','Oryx','Gazelle','Dhow','Camel','Saker','Houbara','Pearl','Dune','Mangrove','Ghaf','Palm','Coral','Sidr','Oud','Sand','Wadi','Hawk','Ibex','Saluki'];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); sh.appendRow(SHEETS[name]); sh.setFrozenRows(1); }
  });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TEACHER_KEY')) {
    props.setProperty('TEACHER_KEY', Utilities.getUuid().replace(/-/g,'').slice(0,20));
  }
  Logger.log('TEACHER_KEY = ' + props.getProperty('TEACHER_KEY'));
  return 'Setup done. Teacher key: ' + props.getProperty('TEACHER_KEY');
}

/* ---------- helpers ---------- */
function sh(name){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function rows(name){ const s=sh(name); const v=s.getDataRange().getValues(); const h=v.shift(); return v.filter(r=>r.join('')!=='').map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]]))); }
function appendObj(name,obj){ sh(name).appendRow(SHEETS[name].map(k=>obj[k]===undefined?'':obj[k])); }
function out(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function teacherOK(p){ return p.key && p.key===PropertiesService.getScriptProperties().getProperty('TEACHER_KEY'); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }
function codenameFor(studentId){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(studentId).trim().toUpperCase());
  const n=((bytes[0]&255)<<8|(bytes[1]&255));
  return ANIMALS[n%ANIMALS.length]+'-'+String(10+(bytes[2]&255)%90);
}

/* ---------- entry points ---------- */
function doGet(e){ return handle(e.parameter||{}); }
function doPost(e){
  let p={}; try{ p=JSON.parse(e.postData.contents||'{}'); }catch(err){ p=e.parameter||{}; }
  return handle(p);
}
function handle(p){
  try{
    const a=p.action||'';
    const pub={subjects, register, getQuiz, submit, dashboard, myProgress, videos};
    const tch={seedQuestions, listQuestions, setQuestion, deleteQuestion, listStudents, exportAttempts, addVideo, deleteVideo, upsertSubject, upsertChapter, stats, voidAttempt};
    if(pub[a]) return out(pub[a](p));
    if(tch[a]){ if(!teacherOK(p)) return out({error:'teacher key required'}); return out(tch[a](p)); }
    return out({error:'unknown action',ok:false});
  }catch(err){ return out({error:String(err)}); }
}

/* ---------- public ---------- */
function subjects(){
  const subs=rows('Subjects').filter(s=>String(s.active).toLowerCase()!=='false').sort((a,b)=>(+a.sort||0)-(+b.sort||0));
  const chs=rows('Chapters'), qs=rows('Questions'), vids=rows('Videos');
  return {subjects:subs.map(s=>{
    const chapters=chs.filter(c=>c.subject===s.code && String(c.active).toLowerCase()!=='false').sort((a,b)=>(+a.chapter)-(+b.chapter)).map(c=>{
      const q=qs.filter(x=>x.subject===s.code&&+x.chapter===+c.chapter&&x.status==='published');
      return {chapter:+c.chapter,title:c.title,clos:c.clos,q1:q.filter(x=>+x.quiz===1).length,q2:q.filter(x=>+x.quiz===2).length,videos:vids.filter(v=>v.subject===s.code&&(+v.chapter===+c.chapter)).length};
    });
    return {code:s.code,title:s.title,term:s.term,chapters,generalVideos:vids.filter(v=>v.subject===s.code&&(v.chapter===''||+v.chapter===0)).length};
  })};
}
function register(p){
  const id=String(p.studentId||'').trim(), name=String(p.name||'').trim(), subject=String(p.subject||'').trim();
  if(!id||!name) return {error:'studentId and name required'};
  const s=sh('Students'); const data=s.getDataRange().getValues(); const now=new Date();
  for(let i=1;i<data.length;i++){ if(String(data[i][0]).trim().toUpperCase()===id.toUpperCase()){ s.getRange(i+1,6).setValue(now); if(!data[i][1]&&name) s.getRange(i+1,2).setValue(name); return {codename:data[i][2],studentId:data[i][0]}; } }
  const codename=uniqueCodename(id);
  appendObj('Students',{studentId:id,name,codename,subject,firstSeen:now,lastSeen:now});
  return {codename,studentId:id};
}
function uniqueCodename(id){
  const used=new Set(rows('Students').map(r=>r.codename)); let c=codenameFor(id), k=0;
  while(used.has(c)){ k++; c=codenameFor(id+'#'+k); }
  return c;
}
function getQuiz(p){
  const subject=p.subject, chapter=+p.chapter, quiz=+p.quiz, n=+(p.n||10);
  const pool=rows('Questions').filter(q=>q.subject===subject&&+q.chapter===chapter&&+q.quiz===quiz&&q.status==='published');
  if(pool.length<4) return {error:'This quiz is not published yet.'};
  const pick=shuffle(pool.slice()).slice(0,Math.min(n,pool.length));
  // salt + SHA-256 of the correct option lets the page give instant feedback without sending answers in clear text
  const salt=Utilities.getUuid();
  const h=(s)=>Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+'|'+s,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  return {salt,questions:pick.map(q=>({id:q.id,stem:q.stem,bloom:q.bloom,clo:q.clo,sec:q.sec,options:shuffle([q.opt1,q.opt2,q.opt3,q.opt4].map(String)),h:h(String(q['opt'+(+q.answer+1)])),why:q.why})),poolSize:pool.length};
}
function submit(p){
  const id=String(p.studentId||'').trim(); if(!id) return {error:'studentId required'};
  const st=rows('Students').find(r=>String(r.studentId).trim().toUpperCase()===id.toUpperCase()); if(!st) return {error:'Please sign in first.'};
  const subject=p.subject, chapter=+p.chapter, quiz=+p.quiz;
  const bank={}; rows('Questions').filter(q=>q.subject===subject&&+q.chapter===chapter&&+q.quiz===quiz).forEach(q=>bank[q.id]=q);
  const answers=Array.isArray(p.answers)?p.answers:[];
  let score=0; const items=answers.map(a=>{
    const q=bank[a.id]; if(!q) return null;
    const correct=String(q['opt'+(+q.answer+1)]); const ok=String(a.chosen||'')===correct; if(ok) score++;
    return {id:q.id,stem:q.stem,sec:q.sec,clo:q.clo,bloom:q.bloom,chosen:a.chosen||'',correct,ok,why:q.why};
  }).filter(Boolean);
  const total=items.length;
  const prev=rows('Attempts').filter(r=>String(r.studentId).trim().toUpperCase()===id.toUpperCase()&&r.subject===subject&&+r.chapter===chapter&&+r.quiz===quiz);
  const attemptNo=prev.length+1;
  const best=Math.max(score,...prev.map(r=>+r.score));
  appendObj('Attempts',{attemptId:Utilities.getUuid(),when:new Date(),studentId:st.studentId,codename:st.codename,subject,chapter,quiz,score,total,seconds:+(p.seconds||0),attemptNo,detail:JSON.stringify(items.map(i=>({id:i.id,chosen:i.chosen,ok:i.ok})))});
  const byClo={}; items.forEach(i=>{byClo[i.clo]=byClo[i.clo]||{ok:0,n:0}; byClo[i.clo].n++; if(i.ok)byClo[i.clo].ok++;});
  return {score,total,attemptNo,best,codename:st.codename,byClo,items};
}
function myProgress(p){
  const id=String(p.studentId||'').trim().toUpperCase();
  const at=rows('Attempts').filter(r=>String(r.studentId).trim().toUpperCase()===id&&(!p.subject||r.subject===p.subject));
  const prog={}; at.forEach(r=>{const k=r.chapter+'-'+r.quiz; prog[k]=prog[k]||{best:0,attempts:0,total:+r.total}; prog[k].attempts++; prog[k].best=Math.max(prog[k].best,+r.score); prog[k].total=+r.total;});
  return {progress:prog};
}
function videos(p){ return {videos:rows('Videos').filter(v=>v.subject===p.subject).map(v=>({id:v.id,chapter:v.chapter===''?0:+v.chapter,title:v.title,url:String(v.url),minutes:v.minutes}))}; }
function dashboard(p){
  const subject=p.subject; const at=rows('Attempts').filter(r=>r.subject===subject).sort((a,b)=>new Date(a.when)-new Date(b.when));
  const chs=rows('Chapters').filter(c=>c.subject===subject).sort((a,b)=>+a.chapter-+b.chapter);
  // per student per quiz: first & best (as %)
  const per={}; at.forEach(r=>{const k=r.codename+'|'+r.chapter+'|'+r.quiz; const pct=+r.total?100*(+r.score)/(+r.total):0; if(!per[k]) per[k]={codename:r.codename,chapter:+r.chapter,quiz:+r.quiz,first:pct,best:pct,n:0}; per[k].n++; per[k].best=Math.max(per[k].best,pct);});
  const rowsP=Object.values(per);
  const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length):null;
  const chapters=chs.map(c=>{const q1=rowsP.filter(r=>r.chapter===+c.chapter&&r.quiz===1), q2=rowsP.filter(r=>r.chapter===+c.chapter&&r.quiz===2);
    return {chapter:+c.chapter,title:c.title,q1best:avg(q1.map(r=>r.best)),q1first:avg(q1.map(r=>r.first)),q2best:avg(q2.map(r=>r.best)),q2first:avg(q2.map(r=>r.first)),students:new Set([...q1,...q2].map(r=>r.codename)).size,attempts:[...q1,...q2].reduce((s,r)=>s+r.n,0)};});
  const byStudent={}; rowsP.forEach(r=>{byStudent[r.codename]=byStudent[r.codename]||{codename:r.codename,best:[],first:[],attempts:0,chapters:{}}; byStudent[r.codename].best.push(r.best); byStudent[r.codename].first.push(r.first); byStudent[r.codename].attempts+=r.n; byStudent[r.codename].chapters[r.chapter]=Math.round(((byStudent[r.codename].chapters[r.chapter]||0)+r.best)/( byStudent[r.codename].chapters[r.chapter]?2:1));});
  const leaderboard=Object.values(byStudent).map(s=>({codename:s.codename,bestAvg:avg(s.best),firstAvg:avg(s.first),quizzesDone:s.best.length,attempts:s.attempts,chapters:s.chapters})).sort((a,b)=>b.bestAvg-a.bestAvg||b.quizzesDone-a.quizzesDone);
  // weakest sections from detail
  const secStat={}; const qmap={}; rows('Questions').filter(q=>q.subject===subject).forEach(q=>qmap[q.id]=q);
  at.forEach(r=>{let d=[];try{d=JSON.parse(r.detail)}catch(e){} d.forEach(x=>{const q=qmap[x.id]; if(!q)return; const k='Ch '+q.chapter+' §'+q.sec; secStat[k]=secStat[k]||{ok:0,n:0}; secStat[k].n++; if(x.ok)secStat[k].ok++;});});
  const weakest=Object.entries(secStat).filter(([k,v])=>v.n>=5).map(([k,v])=>({sec:k,pct:Math.round(100*v.ok/v.n),n:v.n})).sort((a,b)=>a.pct-b.pct).slice(0,5);
  return {subject,students:Object.keys(byStudent).length,attempts:at.length,classAvgBest:avg(rowsP.map(r=>r.best)),classAvgFirst:avg(rowsP.map(r=>r.first)),chapters,leaderboard,weakest};
}

/* ---------- teacher ---------- */
function seedQuestions(p){
  const bank=p.bank; if(!bank||!bank.questions) return {error:'bank missing'};
  const status=p.status||'published';
  const s=sh('Questions'); const existing=new Set(rows('Questions').map(q=>q.id));
  if(p.replaceChapter){ const data=s.getDataRange().getValues(); for(let i=data.length-1;i>=1;i--){ if(data[i][1]===bank.subject&&+data[i][2]===+bank.chapter) s.deleteRow(i+1);} existing.clear(); rows('Questions').forEach(q=>existing.add(q.id)); }
  let added=0,skipped=0; const now=new Date();
  bank.questions.forEach(q=>{ if(existing.has(q.id)){skipped++;return;} appendObj('Questions',{id:q.id,subject:bank.subject,chapter:bank.chapter,quiz:q.quiz,bloom:q.bloom,clo:q.clo,sec:q.sec,stem:q.stem,opt1:q.options[0],opt2:q.options[1],opt3:q.options[2],opt4:q.options[3],answer:q.answer,why:q.why,status:status,created:now}); added++; });
  if(bank.title) upsertChapter({subject:bank.subject,chapter:bank.chapter,title:bank.title,clos:(bank.clos||[]).join(', ')});
  return {added,skipped};
}
function listQuestions(p){ return {questions:rows('Questions').filter(q=>(!p.subject||q.subject===p.subject)&&(!p.chapter||+q.chapter===+p.chapter))}; }
function setQuestion(p){
  const s=sh('Questions'); const data=s.getDataRange().getValues(); const h=data[0];
  for(let i=1;i<data.length;i++){ if(data[i][0]===p.id){ Object.keys(p.fields||{}).forEach(k=>{const c=h.indexOf(k); if(c>=0) s.getRange(i+1,c+1).setValue(p.fields[k]);}); return {ok:true}; } }
  if(p.fields&&p.fields.stem){ const f=p.fields; appendObj('Questions',{id:p.id||('Q-'+Utilities.getUuid().slice(0,8)),subject:f.subject,chapter:f.chapter,quiz:f.quiz,bloom:f.bloom||'Apply',clo:f.clo||'',sec:f.sec||'',stem:f.stem,opt1:f.opt1,opt2:f.opt2,opt3:f.opt3,opt4:f.opt4,answer:+f.answer||0,why:f.why||'',status:f.status||'draft',created:new Date()}); return {ok:true,created:true}; }
  return {error:'not found'};
}
function deleteQuestion(p){ const s=sh('Questions'); const data=s.getDataRange().getValues(); for(let i=data.length-1;i>=1;i--){ if(data[i][0]===p.id){ s.deleteRow(i+1); return {ok:true}; } } return {error:'not found'}; }
function listStudents(p){ return {students:rows('Students').filter(s=>!p.subject||s.subject===p.subject||true)}; }
function exportAttempts(p){ return {attempts:rows('Attempts').filter(r=>!p.subject||r.subject===p.subject), students:rows('Students')}; }
function addVideo(p){ const id='V-'+Utilities.getUuid().slice(0,8); appendObj('Videos',{id,subject:p.subject,chapter:p.chapter||'',title:p.title,url:p.url,minutes:p.minutes||'',added:new Date()}); return {ok:true,id}; }
function deleteVideo(p){ const s=sh('Videos'); const data=s.getDataRange().getValues(); for(let i=data.length-1;i>=1;i--){ if(data[i][0]===p.id){ s.deleteRow(i+1); return {ok:true}; } } return {error:'not found'}; }
function upsertSubject(p){ const s=sh('Subjects'); const data=s.getDataRange().getValues(); for(let i=1;i<data.length;i++){ if(data[i][0]===p.code){ s.getRange(i+1,1,1,5).setValues([[p.code,p.title,p.term||data[i][2],p.sort||data[i][3],p.active===undefined?data[i][4]:p.active]]); return {ok:true}; } } appendObj('Subjects',{code:p.code,title:p.title,term:p.term||'',sort:p.sort||99,active:true}); return {ok:true,created:true}; }
function upsertChapter(p){ const s=sh('Chapters'); const data=s.getDataRange().getValues(); for(let i=1;i<data.length;i++){ if(data[i][0]===p.subject&&+data[i][1]===+p.chapter){ s.getRange(i+1,3,1,3).setValues([[p.title||data[i][2],p.clos||data[i][3],p.active===undefined?data[i][4]:p.active]]); return {ok:true}; } } appendObj('Chapters',{subject:p.subject,chapter:+p.chapter,title:p.title||('Chapter '+p.chapter),clos:p.clos||'',active:true}); return {ok:true,created:true}; }
function voidAttempt(p){ const s=sh('Attempts'); const data=s.getDataRange().getValues(); for(let i=data.length-1;i>=1;i--){ if(data[i][0]===p.attemptId){ s.deleteRow(i+1); return {ok:true}; } } return {error:'not found'}; }
function stats(){ return {subjects:rows('Subjects').length,chapters:rows('Chapters').length,questions:rows('Questions').length,published:rows('Questions').filter(q=>q.status==='published').length,videos:rows('Videos').length,students:rows('Students').length,attempts:rows('Attempts').length}; }
