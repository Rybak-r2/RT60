/* Wersje językowe — test kompletności i spójności słowników.
   Uzasadnienie: docs/MODEL-AKUSTYCZNY.md, 6.7.

   Uruchomienie:  node docs/test-jezyki.js      (albo npm test)

   Test nie sprawdza, czy tłumaczenie jest ładne — tego maszyna nie oceni.
   Sprawdza to, co da się sprawdzić i co realnie psuje program:
   brakujące hasło, hasło po zmianie polskiego zdania osierocone, zgubione
   podstawienie {…} i zgubiony znacznik HTML. */
"use strict";
const fs=require('fs'), path=require('path'), cp=require('child_process');
const KAT=path.join(__dirname,'..');

let zle=0;
function sprawdz(w,opis){ if(w)console.log('  ok    '+opis);
  else {zle++;console.log('  BŁĄD  '+opis);} }

/*── prawdziwe jezyki.js + prawdziwe słowniki, na atrapie przeglądarki ──*/
function wczytaj(){
  const mag={};
  const win={localStorage:{getItem:k=>k in mag?mag[k]:null,setItem:(k,v)=>{mag[k]=String(v);}},
             document:{documentElement:{setAttribute(){}}}};
  win.window=win;
  global.window=win;
  ['jezyki.js','jezyk-en.js','jezyk-de.js'].forEach(f=>{
    const kod=fs.readFileSync(path.join(KAT,f),'utf8');
    new Function('window','self','globalThis', kod).call(win,win,win,win);
  });
  return win.Jezyk;
}
const Jezyk=wczytaj();

/* Lista tekstów prosto z ekstraktora — tego samego, który wypisuje braki.
   Dzięki temu test nie ma własnej, rozjeżdżającej się kopii listy. */
const TEKSTY=JSON.parse(cp.execFileSync('node',[path.join(__dirname,'zbierz-teksty.js')],
  {encoding:'utf8', stdio:['ignore','pipe','ignore']}));

const JEZYKI=['en','de'];

console.log('\nWersje językowe — słowniki ('+TEKSTY.length+' tekstów)\n');

/*── 1. kompletność ──*/
JEZYKI.forEach(kod=>{
  const S=Jezyk.slownik[kod];
  const brak=TEKSTY.filter(t=>!S[t]);
  sprawdz(brak.length===0, kod+': wszystkie teksty mają tłumaczenie'+
    (brak.length?' (brakuje '+brak.length+', np. '+JSON.stringify(brak[0])+')':''));
});

/*── 2. brak haseł osieroconych ──
  Zmiana polskiego zdania unieważnia klucz. Stare hasło zostaje wtedy w pliku
  i nigdy się nie pokaże — a wygląda, jakby tłumaczenie było. */
const zbior=new Set(TEKSTY);
JEZYKI.forEach(kod=>{
  const osierocone=Object.keys(Jezyk.slownik[kod]).filter(k=>!zbior.has(k));
  sprawdz(osierocone.length===0, kod+': żadne hasło nie jest osierocone'+
    (osierocone.length?' (jest '+osierocone.length+', np. '+JSON.stringify(osierocone[0])+')':''));
});

/*── 3. podstawienia ──
  {ile} zgubione w tłumaczeniu znaczy, że użytkownik nie zobaczy liczby;
  {ile} dopisane znaczy, że zobaczy surowe „{ile}". */
const pod=s=>(String(s).match(/\{[a-zA-Z0-9_]+\}/g)||[]).slice().sort().join(',');
JEZYKI.forEach(kod=>{
  const S=Jezyk.slownik[kod];
  const zle2=TEKSTY.filter(t=>S[t]&&pod(t)!==pod(S[t]));
  sprawdz(zle2.length===0, kod+': podstawienia {…} zgadzają się w każdym haśle'+
    (zle2.length?' (rozjazd w '+zle2.length+', np. '+JSON.stringify(zle2[0])+')':''));
});

/*── 4. znaczniki HTML ──
  Kilkanaście zdań ma w środku <b>. Tekst trafia tam przez innerHTML, więc
  niezamknięty znacznik rozjeżdża układ strony, a nie tylko jedno zdanie. */
const tagi=s=>(String(s).match(/<\/?[a-z]+>/g)||[]).slice().sort().join(',');
JEZYKI.forEach(kod=>{
  const S=Jezyk.slownik[kod];
  const zle2=TEKSTY.filter(t=>S[t]&&tagi(t)!==tagi(S[t]));
  sprawdz(zle2.length===0, kod+': znaczniki HTML zgadzają się w każdym haśle'+
    (zle2.length?' (rozjazd w '+zle2.length+', np. '+JSON.stringify(zle2[0])+')':''));
});

/*── 5. polskie znaki w obcym tłumaczeniu ──
  Najczęstsza pomyłka przy przepisywaniu: hasło zostało skopiowane, a nie
  przetłumaczone. „ó" pomijamy — nie ma go w niemieckim, ale bywa w nazwach. */
JEZYKI.forEach(kod=>{
  const S=Jezyk.slownik[kod];
  const zle2=TEKSTY.filter(t=>S[t]&&/[ąćęłńśźż]/i.test(S[t]));
  sprawdz(zle2.length===0, kod+': żadne tłumaczenie nie zawiera polskich znaków'+
    (zle2.length?' (jest '+zle2.length+', np. '+JSON.stringify(S[zle2[0]])+')':''));
});

/*── 6. zachowanie silnika ──*/
console.log('\nSilnik tłumaczeń\n');

Jezyk.ustaw('pl',false);
sprawdz(Jezyk.t('Zapisz wynik')==='Zapisz wynik', 'po polsku wraca oryginał');
sprawdz(Jezyk.liczba(0.6,2)==='0,60', 'polski: separator przecinek');

Jezyk.ustaw('en',false);
sprawdz(Jezyk.t('Zapisz wynik')==='Save the result', 'angielski: hasło ze słownika');
sprawdz(Jezyk.t('Zdanie, którego nikt nie tłumaczył')==='Zdanie, którego nikt nie tłumaczył',
  'angielski: brak hasła → polski oryginał, nie pustka');
sprawdz(Jezyk.liczba(0.6,2)==='0.60', 'angielski: separator kropka');
sprawdz(Jezyk.naLiczbe('0,6')===0.6 && Jezyk.naLiczbe('0.6')===0.6,
  'oba separatory przyjmowane niezależnie od języka');
sprawdz(Jezyk.t('Zacznij od {ile} szt.',{ile:7})==='Start with 7 pcs.',
  'angielski: podstawienie trafia w tłumaczone zdanie');

Jezyk.ustaw('de',false);
sprawdz(Jezyk.t('Zapisz wynik')==='Ergebnis speichern', 'niemiecki: hasło ze słownika');
sprawdz(Jezyk.liczba(0.6,2)==='0,60', 'niemiecki: separator przecinek');
sprawdz(Jezyk.slug('Wände und Decke')==='waende-und-decke',
  'niemieckie znaki w nazwie pliku sprowadzone do ASCII');

Jezyk.ustaw('pl',false);
sprawdz(Jezyk.ilu(1,'panel','panele','paneli')==='panel' &&
        Jezyk.ilu(3,'panel','panele','paneli')==='panele' &&
        Jezyk.ilu(12,'panel','panele','paneli')==='paneli' &&
        Jezyk.ilu(22,'panel','panele','paneli')==='panele',
  'polska odmiana przez liczbę, z wyjątkiem na nastki');
Jezyk.ustaw('en',false);
sprawdz(Jezyk.ilu(1,'panel','panels','panels')==='panel' &&
        Jezyk.ilu(5,'panel','panels','panels')==='panels',
  'angielski: dwie formy');
Jezyk.ustaw('pl',false);

console.log('\n'+(zle?zle+' BŁĘDÓW':'wszystko przeszło')+'\n');
process.exit(zle?1:0);
