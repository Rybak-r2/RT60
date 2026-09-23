/* Próg zapasu nad tłem kontra progi ISO 3382 — test regresyjny.
   Uzasadnienie: docs/MODEL-AKUSTYCZNY.md, 1.6.

   Uruchomienie:  node docs/test-poziom.js       (albo npm test)

   PO CO TO JEST. Pasek poziomu pokazuje ZAPAS NAD TŁEM (stosunek energii
   sweepu do energii tła w paśmie, próg 20 dB). O tym, czy z pasma wyjdzie
   czas pogłosu, decyduje coś innego: ZAKRES DYNAMIKI ZANIKU liczony
   z odpowiedzi impulsowej po dekonwolucji, z progami ISO 3382 — 35 dB dla
   T30, 25 dB dla T20. Te dwie liczby dzieli zysk przetwarzania sweepu.

   Dopóki zysk jest duży, cichy sygnał naprawdę wystarcza i wskaźnik nie
   kłamie. Gdyby ktoś skrócił sweep, zwęził pasmo albo podniósł progi ISO,
   zysk by stopniał i próg 20 dB zacząłby przepuszczać pomiary, z których
   nic nie wyjdzie — użytkownik obszedłby trzy punkty na darmo. Ten test
   pilnuje właśnie tej relacji, na PRAWDZIWYM kodzie silnika.

   Pokój wzorcowy jest sztuczny i ma znany czas pogłosu, więc wszystko, co
   widać poza nim, pochodzi z szumu pomiarowego, a nie z akustyki. Tło jest
   BIAŁE — w prawdziwym pomieszczeniu hałas siedzi nisko, więc pasma 125
   i 250 Hz wypadają gorzej, niż wychodzi tutaj. Test dowodzi mechanizmu,
   nie tego, że każdy cichy pomiar jest dobry. */
"use strict";
const fs_=require('fs'), path=require('path');
const KAT=path.join(__dirname,'..');

let zle=0;
function sprawdz(w,opis){ if(w)console.log('  ok    '+opis);
  else {zle++;console.log('  BŁĄD  '+opis);} }

/*── atrapa DOM: silnik pomiarowy jest zwykłym skryptem strony ──*/
function klasy(){return{_h:new Set(),add(c){this._h.add(c);},remove(c){this._h.delete(c);},
  toggle(c,v){v?this._h.add(c):this._h.delete(c);},contains(c){return this._h.has(c);}};}
function el(){return{innerHTML:'',textContent:'',value:'',className:'',style:{cssText:''},
  disabled:false,classList:klasy(),addEventListener(){},querySelectorAll:()=>[]};}
function silnik(){
  const cache={};
  const doc={getElementById:id=>cache[id]||(cache[id]=el()),
    querySelectorAll:()=>[], querySelector:()=>el(), createElement:()=>el(),
    documentElement:{setAttribute(){}}};
  const win={document:doc, localStorage:{getItem:()=>null,setItem(){}},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}}, scrollTo(){}};
  win.window=win;
  global.window=win; global.document=doc;
  global.localStorage=win.localStorage; global.sessionStorage=win.sessionStorage;
  try{ Object.defineProperty(global,'navigator',{value:{},configurable:true}); }catch(e){}
  ['jezyki.js','jezyk-en.js','jezyk-de.js','paczka.js','karta.js'].forEach(f=>{
    const sc=path.join(KAT,f);
    delete require.cache[require.resolve(sc)];
    require(sc);
  });
  global.Jezyk=win.Jezyk; global.Paczka=win.Paczka;
  const src=fs_.readFileSync(path.join(KAT,'index.html'),'utf8')
    .split('<script>\n')[1].split('</script>')[0];
  return new Function(src+'\n;return {makeSweep:makeSweep, convolve:convolve,'+
    'bandFilter:bandFilter, bandEnergy:bandEnergy, decay:decay, judge:judge,'+
    'BANDS:BANDS, SNR_AC_MIN:SNR_AC_MIN, SNR_AC_GOOD:SNR_AC_GOOD};')();
}
const E=silnik();

/*── pokój wzorcowy: zanik idealnie wykładniczy o znanym T60 ──*/
const FS=48000, T60=0.60;
function losowy(ziarno){ let s=ziarno;
  return ()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x3fffffff-1; }; }
function pokoj(){
  const N=Math.round(FS*T60*3), h=new Float64Array(N);
  /* Obwiednia AMPLITUDY: poziom energii spada o 20*log10(e)*t/tau,
     czyli -60 dB wypada przy tau = T60/ln(1000). */
  const tau=T60/Math.log(1000), rnd=losowy(12345);
  for(let i=0;i<N;i++) h[i]=rnd()*Math.exp(-i/FS/tau);
  return h;
}
const SW=E.makeSweep(FS,1.5,80,16000);          /* sweep kontroli poziomu */
const CZYSTY=E.convolve(SW.sweep,pokoj());
const rnd=losowy(999);
const k1k=E.BANDS.indexOf(1000);

/* Jeden przebieg przy zadanym zapasie nad tłem w paśmie 1 kHz.

   Poziom szumu dobieramy w dwóch krokach. Pierwsze przybliżenie liczy się
   z energii sygnału, ale program mierzy zapas inaczej: bierze nagranie
   (sygnał RAZEM z szumem) wobec osobno nagranego tła, o innej realizacji
   losowej i innej długości. Stąd kilka dB rozjazdu. Drugi krok koryguje
   skalę o zmierzoną różnicę, żeby liczba w tabeli oznaczała to, co mówi
   nagłówek — inaczej test opowiadałby o progu, którego nie dotyka. */
function proba(celSNR){
  const szum=new Float64Array(CZYSTY.length);
  for(let i=0;i<szum.length;i++) szum[i]=rnd();
  const eS=E.bandEnergy(CZYSTY,FS), eN=E.bandEnergy(szum,FS);
  let skala=Math.sqrt(eS[k1k]/eN[k1k]/Math.pow(10,celSNR/10));
  skala*=Math.pow(10,(zmierz(szum,skala)-celSNR)/20);
  const rec=new Float64Array(CZYSTY.length);
  for(let i=0;i<rec.length;i++) rec[i]=CZYSTY[i]+szum[i]*skala;
  const bg=new Float64Array(Math.round(1.6*FS));
  for(let i=0;i<bg.length;i++) bg[i]=rnd()*skala;
  const bgE=E.bandEnergy(bg,FS), recE=E.bandEnergy(rec,FS);
  const snrAc=E.BANDS.map((f,k)=>10*Math.log10(recE[k]/bgE[k]));

  /* dekonwolucja i okno — jak w runSweep */
  const full=E.convolve(rec,SW.inv);
  let pk=0,pi=0;
  for(let i=0;i<full.length;i++){const a=Math.abs(full[i]); if(a>pk){pk=a;pi=i;}}
  const from=Math.max(0,pi-Math.round(.005*FS));
  const to=Math.min(full.length,from+Math.round(1.45*FS));
  const ir=new Float64Array(to-from);
  for(let i=from;i<to;i++) ir[i-from]=full[i]/pk;

  const d=E.decay(E.bandFilter(ir,FS,1000),FS);
  return {snr:snrAc[k1k], zakres:d.range, wynik:E.judge(d,snrAc[k1k])};
}
/* Zapas tak, jak liczy go program: nagranie wobec osobno nagranego tła. */
function zmierz(szum,skala){
  const rec=new Float64Array(CZYSTY.length);
  for(let i=0;i<rec.length;i++) rec[i]=CZYSTY[i]+szum[i]*skala;
  const bg=new Float64Array(Math.round(1.6*FS));
  const r2=losowy(4242);
  for(let i=0;i<bg.length;i++) bg[i]=r2()*skala;
  return 10*Math.log10(E.bandEnergy(rec,FS)[k1k]/E.bandEnergy(bg,FS)[k1k]);
}

console.log('\nZapas nad tłem kontra zakres dynamiki zaniku');
console.log('  pokój wzorcowy T60 = '+T60.toFixed(3)+' s, sweep 1,5 s, tło białe\n');

/* Przy samym progu wskaźnika zakres musi z zapasem przebijać próg ISO dla
   T30 — inaczej „wystarczy" na pasku obiecuje coś, czego pomiar nie dowozi. */
const naProgu=proba(E.SNR_AC_MIN+3);
console.log('  zapas '+naProgu.snr.toFixed(1)+' dB  →  zakres '+naProgu.zakres.toFixed(1)+
  ' dB, T = '+(naProgu.wynik.T?naProgu.wynik.T.toFixed(3)+' s ('+naProgu.wynik.est+')':'—'));
sprawdz(naProgu.zakres>=45,
  'tuż nad progiem wskaźnika zakres zaniku ma co najmniej 10 dB zapasu nad progiem T30');
sprawdz(naProgu.wynik.est==='T30',
  'tuż nad progiem wskaźnika wychodzi T30, a nie awaryjne T20');
sprawdz(naProgu.wynik.T!=null && Math.abs(naProgu.wynik.T-T60)/T60<0.10,
  'odtworzony czas pogłosu mieści się w 10 % od prawdziwego');

const dobry=proba(E.SNR_AC_GOOD);
console.log('  zapas '+dobry.snr.toFixed(1)+' dB  →  zakres '+dobry.zakres.toFixed(1)+
  ' dB, T = '+(dobry.wynik.T?dobry.wynik.T.toFixed(3)+' s ('+dobry.wynik.est+')':'—'));
sprawdz(dobry.wynik.est==='T30' && Math.abs(dobry.wynik.T-T60)/T60<0.05,
  'na progu „dobrze" czas pogłosu odtworzony w 5 %');

/* Poniżej progu pasmo ma być ODRZUCONE, nawet gdy zakres wyglądałby dobrze —
   bo realny szum nie jest biały ani stały, a ten pokój jest przypadkiem
   idealnym. Test pilnuje, żeby nikt nie „poprawił" tego na przepuszczanie. */
const podProgiem=proba(E.SNR_AC_MIN-5);
console.log('  zapas '+podProgiem.snr.toFixed(1)+' dB  →  zakres '+podProgiem.zakres.toFixed(1)+
  ' dB, wynik: '+(podProgiem.wynik.why||podProgiem.wynik.est));
sprawdz(podProgiem.wynik.T===null && podProgiem.wynik.why==='brak pobudzenia',
  'poniżej progu pasmo jest odrzucane, choć zakres zaniku by wystarczył');

/* Kolejność progów: „dobrze" nie może leżeć pod „wystarczy", a skala paska
   musi obie pomieścić — rysunek liczy się z tych samych liczb. */
sprawdz(E.SNR_AC_GOOD>E.SNR_AC_MIN, 'próg „dobrze" leży nad progiem „wystarczy"');

console.log('\n'+(zle?zle+' BŁĘDÓW':'wszystko przeszło')+'\n');
process.exit(zle?1:0);
