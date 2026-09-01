/* Karta pomieszczenia i pętla „przed / po" — test regresyjny.
   Uzasadnienie: docs/MODEL-AKUSTYCZNY.md, 6.2.

   Uruchomienie:  node docs/test-karta.js       (albo npm test)

   Test przechodzi przez PRAWDZIWY kod obu stron i przez karta.js, na atrapie
   DOM i atrapie magazynu przeglądarki. */
"use strict";
const fs=require('fs'), path=require('path');
const KAT=path.join(__dirname,'..');
const zrodlo=f=>fs.readFileSync(path.join(KAT,f),'utf8').split('<script>\n')[1].split('</script>')[0];

let zle=0;
function sprawdz(w,opis){ if(w)console.log('  ok    '+opis);
  else {zle++;console.log('  BŁĄD  '+opis);} }

/*── atrapa magazynu przeglądarki ──*/
function magazyn(dziala){
  const d={};
  return {getItem:k=>{ if(!dziala)throw new Error('zablokowany'); return k in d?d[k]:null; },
          setItem:(k,v)=>{ if(!dziala)throw new Error('zablokowany'); d[k]=String(v); },
          removeItem:k=>{ if(!dziala)throw new Error('zablokowany'); delete d[k]; },
          _d:d};
}
function klasy(){return{_h:new Set(),add(c){this._h.add(c);},remove(c){this._h.delete(c);},
  toggle(c,v){v?this._h.add(c):this._h.delete(c);},has(c){return this._h.has(c);}};}
function el(){return{innerHTML:'',textContent:'',value:'',className:'',dataset:{},style:{},disabled:false,
  classList:klasy(),addEventListener(){},click(){},focus(){},getContext(){return null;},
  querySelectorAll(sel){
    if(sel!=='.opt')return[];
    if(this._html!==this.innerHTML){
      this._html=this.innerHTML;
      const ids=String(this.innerHTML).match(/data-id="[^"]+"/g)||[];
      this._opt=ids.map(a=>({dataset:{id:a.slice(9,-1)},classList:klasy(),onclick:null}));
    }
    return this._opt;
  }};}

function swiat(mag){
  const cache={};
  const doc={getElementById:id=>cache[id]||(cache[id]=el()),
    querySelectorAll:()=>[], querySelector:()=>el(), createElement:()=>el()};
  const win={localStorage:mag, sessionStorage:magazyn(true), scrollTo(){}, document:doc};
  win.window=win;
  global.window=win; global.document=doc;
  global.localStorage=mag; global.sessionStorage=win.sessionStorage;
  global.Blob=class{constructor(c){win._pobrane=c[0];}};
  global.URL={createObjectURL:()=>'blob:test',revokeObjectURL(){}};
  /* navigator w nowszym node jest tylko do odczytu — podstawiamy przez definiowanie. */
  try{ Object.defineProperty(global,'navigator',{value:{},configurable:true}); }catch(e){}
  delete require.cache[require.resolve(path.join(KAT,'karta.js'))];
  require(path.join(KAT,'karta.js'));
  return {cache, win, E:id=>doc.getElementById(id)};
}

/*═══════════════ 1. Sam magazyn kart ═══════════════*/
console.log('\nKarta pomieszczenia — magazyn');
let s=swiat(magazyn(true));
const K=()=>global.window.Karta;
const POK={L:5.2,W:3.0,H:2.55,V:39.75,typ:'salon'};
const badanie=(czas,Tmid,extra)=>Object.assign({
  czas:czas, wersja:'silnik-v15', charakter_pomiaru:'pelny', Tmid:Tmid,
  pomieszczenie:POK,
  pasma:[{fc:250,T_srednie:Tmid*1.08},{fc:1000,T_srednie:Tmid}]}, extra||{});

sprawdz(K().dostepna(),'magazyn dostępny, gdy przeglądarka pozwala');
sprawdz(K().dopiszPomiar(badanie('2026-09-01T10:00:00Z',0.376))===null,
  'pierwszy pomiar nie ma się z czym porównać');
const przedDrugim=K().dopiszPomiar(badanie('2026-09-20T10:00:00Z',0.298));
sprawdz(przedDrugim&&przedDrugim.pomiary.length===1&&przedDrugim.pomiary[0].Tmid===0.376,
  'drugi pomiar dostaje stan sprzed dopisania — to jest „co było przedtem"');
sprawdz(K().znajdz(POK).pomiary.length===2,'oba pomiary zostają w karcie');

/* Klient wpisuje wymiary za drugim razem na oko: 5,2 wraca jako 5,18. */
sprawdz(K().znajdz({L:5.18,W:3.02,H:2.55,typ:'salon'})!==null,
  'zaokrąglenie do 10 cm zszywa oba podejścia w jedną kartę');
sprawdz(K().znajdz({L:7.0,W:3.0,H:2.55,typ:'salon'})===null,
  'inne pomieszczenie ma osobną kartę');

K().dopiszPomiar(badanie('2026-09-20T10:00:00Z',0.298));
sprawdz(K().znajdz(POK).pomiary.length===2,
  'ten sam pomiar wczytany dwa razy nie udaje dwóch podejść');

for(let i=0;i<12;i++) K().dopiszPomiar(badanie('2026-10-'+(10+i)+'T10:00:00Z',0.3+i/100));
sprawdz(K().znajdz(POK).pomiary.length<=8,'liczba pomiarów w karcie jest ograniczona');

sprawdz(K().zapomnij(POK)&&K().znajdz(POK)===null,'kartę da się usunąć');

/*── magazyn zablokowany: program ma działać jak wcześniej ──*/
s=swiat(magazyn(false));
sprawdz(K().dostepna()===false,'zablokowany magazyn jest rozpoznany, nie rzuca');
sprawdz(K().dopiszPomiar(badanie('2026-09-01T10:00:00Z',0.376))===null&&
        K().dopiszPropozycje(POK,{cel_Tmid_s:0.3})===false&&
        K().znajdz(POK)===null&&K().lista().length===0,
  'przy zablokowanym magazynie wszystko zwraca pustkę zamiast wybuchać');

/*═══════════════ 2. Pętla przez oba programy ═══════════════*/
console.log('\nPętla: pomiar → dobór → pomiar kontrolny');
const mag=magazyn(true);

/* a) pomiar wyjściowy zapisany przez stronę badania */
function pomiar(Tmid, src, czas){
  const w=swiat(mag);
  const api=new Function(zrodlo('index.html')+
    '\n;return {ST:ST,budujJSON:budujJSON,zapiszDoKarty:zapiszDoKarty,pokazPrzedPo:pokazPrzedPo};')();
  const T=Tmid;
  Object.assign(api.ST,{L:5.2,W:3.0,H:2.55,V:39.75,type:'salon',src:src||'ext',
    fs:48000,set:{},bg:-60,pos:[{bands:{},D50:60,C50:2,mtis:[]}],
    Tmid:T, midF:[500,1000], midQ:['dobry','dobry'], D50:60, pozny:0.5,
    avg:{125:T*1.2,250:T*1.08,500:T,1000:T,2000:T*0.9,4000:T*0.85}});
  api.ST.czasNadpisany=czas;
  const oryg=api.budujJSON;
  const wynik=oryg(); wynik.czas=czas;
  const przed=global.window.Karta.dopiszPomiar(wynik);
  api.ST.Tmid=T;
  api.pokazPrzedPo(przed);
  return {tekst:w.E('rPrzedPo').innerHTML.replace(/<[^>]+>/g,' '), przed:przed};
}

const p1=pomiar(0.376,'ext','2026-09-01T10:00:00Z');
sprawdz(p1.tekst.trim()==='','pierwszy pomiar nie pokazuje porównania — nie ma z czym');

/* b) dobór zapisuje propozycję z celem */
(function(){
  const w=swiat(mag);
  const api=new Function(zrodlo('dobor.html')+'\n;return {przyjmij:przyjmij,ST:ST};')();
  api.przyjmij({wersja:'silnik-v15',charakter_pomiaru:'pelny',Tmid:0.376,
    pomieszczenie:POK,
    pasma:[125,250,500,1000,2000,4000].map((fc,i)=>
      ({fc,T_srednie:[0.45,0.41,0.38,0.37,0.34,0.32][i]}))});
  api.ST.cel=0.30; w.E('b2').onclick(); w.E('b3').onclick();
})();
const karta=global.window.Karta.znajdz(POK);
sprawdz(karta&&karta.propozycja&&karta.propozycja.cel_Tmid_s===0.30&&karta.propozycja.sztuk>0,
  'dobór dopisuje propozycję z celem do karty tego pomieszczenia');

/* c) pomiar kontrolny po montażu */
const osiagniety=pomiar(0.285,'ext','2026-10-01T10:00:00Z');
sprawdz(osiagniety.tekst.indexOf('osiągnięty')>=0&&osiagniety.tekst.indexOf('nieosiągnięty')<0,
  'pomiar po montażu poniżej celu mówi wprost: cel osiągnięty');
sprawdz(/Tmid 0,38 → 0,28 s/.test(osiagniety.tekst.replace(/\s+/g,' '))&&
  osiagniety.tekst.indexOf('-24 %')>=0,
  'porównanie pokazuje obie wartości i zmianę procentową');
sprawdz(osiagniety.tekst.indexOf('1.09.2026')>=0,
  'porównanie podaje datę wcześniejszego badania — po niej poznaje się pomyłkę');

const zaSlaby=pomiar(0.34,'ext','2026-10-05T10:00:00Z');
sprawdz(zaSlaby.tekst.indexOf('jeszcze nieosiągnięty')>=0,
  'pomiar powyżej celu mówi, że celu jeszcze nie ma, i o ile');

/* d) zmiana toru pomiarowego unieważnia porównanie */
const innyTor=pomiar(0.28,'phone','2026-10-09T10:00:00Z');
sprawdz(innyTor.tekst.indexOf('innym źródłem')>=0&&innyTor.tekst.indexOf('osiągnięty')<0,
  'pomiar innym źródłem nie jest dowodem — zamiast werdyktu leci ostrzeżenie');

console.log(zle?'\n'+zle+' testów nie przeszło\n':'\nWszystkie testy przeszły\n');
process.exit(zle?1:0);
