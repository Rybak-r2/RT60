/* Bramka wiarygodności wejścia — test regresyjny modułu doboru.
   Uzasadnienie progów: docs/MODEL-AKUSTYCZNY.md, 5.3.

   Uruchomienie:  node docs/test-bramka.js       (albo npm test)

   Test wykonuje PRAWDZIWY kod z dobor.html na atrapie DOM, a nie jego kopię —
   inaczej próg poprawiony w jednym miejscu przestałby być sprawdzany
   w drugim. */
"use strict";
const fs=require('fs'), path=require('path');
const PLIK=path.join(__dirname,'..','dobor.html');
const src=fs.readFileSync(PLIK,'utf8').split('<script>\n')[1].split('</script>')[0];

/*── atrapa DOM: tylko to, czego strona faktycznie dotyka ──*/
function el(){return{innerHTML:'',textContent:'',value:'',className:'',dataset:{},style:{},
  classList:{_h:new Set(),add(c){this._h.add(c);},remove(c){this._h.delete(c);},
    toggle(c,v){v?this._h.add(c):this._h.delete(c);},has(c){return this._h.has(c);}},
  addEventListener(){},querySelectorAll(){return[];},click(){}};}
const cache={};
global.document={getElementById:id=>cache[id]||(cache[id]=el()),
  querySelectorAll:()=>[],createElement:()=>el()};
global.window={scrollTo(){}};
let pobrane=null;
global.Blob=class{constructor(cz){pobrane=cz[0];}};
global.URL={createObjectURL:()=>'blob:test',revokeObjectURL(){}};

const api=new Function(src+'\n;return {przyjmij:przyjmij,ST:ST};')();
const E=id=>document.getElementById(id);
const tekst=()=>E('m1').innerHTML.replace(/<[^>]+>/g,'');
const odrzucony=()=>E('podglad').classList.has('hide');

/* Plik badania w kształcie kontraktu z części 2. */
function plik(o){
  const j={pomieszczenie:{L:5.2,W:3.0,H:2.55,V:39.75,typ:'salon'},
    charakter_pomiaru:'pelny', nadaje_sie_do_doboru_adaptacji:true,
    pasma:Object.keys(o.T).map(fc=>({fc:+fc, T_srednie:o.T[fc],
      liczba_waznych_pozycji:3}))};
  if(o.wersja!==null) j.wersja=o.wersja||'silnik-v13';
  if(o.Tmid!=null) j.Tmid=o.Tmid;
  return j;
}

let zle=0;
function test(nazwa,j,oczekOdrzucenie,fraza){
  E('m1').innerHTML=''; E('podglad').classList.remove('hide');
  api.przyjmij(j);
  const t=tekst(), ok=odrzucony()===oczekOdrzucenie&&(!fraza||t.indexOf(fraza)>=0);
  if(!ok){zle++;console.log('  BŁĄD  '+nazwa+'\n         odrzucony='+odrzucony()+
    ', oczekiwano '+oczekOdrzucenie+'\n         → '+t.slice(0,200));}
  else console.log('  ok    '+nazwa);
}

console.log('\nPliki poprawne — muszą przejść');
/* realny pomiar z 31.08, rozrzut 1,27 */
test('silnik-v13 z 31.08 (rozrzut 1,27)', plik({
  T:{125:0.42,250:0.38,500:0.353,1000:0.345,2000:0.32,4000:0.30}}), false);
test('rozrzut 1,4 — górna granica dobrych plików', plik({
  T:{125:0.50,250:0.42,500:0.36,1000:0.34,2000:0.32,4000:0.30}}), false);
test('rozrzut 2,9 — tuż pod progiem', plik({
  T:{250:0.29,500:0.40,1000:0.55,2000:0.70,4000:0.84}}), false);
test('125 Hz odstaje 4× — poza kontrolą, patrz 5.3 pkt 1', plik({
  T:{125:1.60,250:0.40,500:0.38,1000:0.36,2000:0.35,4000:0.34}}), false);
test('silnik-v4 — pierwsza wersja z działającym zakresem', plik({wersja:'silnik-v4',
  T:{250:0.40,500:0.38,1000:0.36,2000:0.35,4000:0.34}}), false);

console.log('\nPliki, z których nie wolno liczyć');
['silnik-v1','silnik-v2','silnik-v3'].forEach(w=>
  test(w+' — brak działających progów ISO', plik({wersja:w,
    T:{250:0.40,500:0.38,1000:0.36,2000:0.35,4000:0.34}}), true, w));
/* przypadek opisany w 5.3: dawniej 38 paneli bez jednego ostrzeżenia */
test('realny plik z v2: 0,224 s przy 250 Hz i 2,001 s przy 1 kHz', plik({
  Tmid:1.251, T:{125:1.90,250:0.224,500:0.501,1000:2.001,2000:0.90,4000:0.70}}),
  true, 'rozjeżdżają się');
test('rozrzut 3,3 przy zgodnych pasmach mowy', plik({
  T:{250:0.30,500:0.42,1000:0.55,2000:0.80,4000:1.00}}), true, 'Wyniki pasmowe');
test('rozjazd mowy 2,5 — próg ostrzejszy niż na całym paśmie', plik({
  T:{500:0.36,1000:0.90}}), true, 'Pasma mowy');

console.log('\nPrzypadki brzegowe');
test('jedno pasmo w 250–4000 Hz — przechodzi z uwagą, nie po cichu', plik({
  T:{125:0.40,500:0.38}}), false, 'Za mało pasm');
test('brak pola wersja — ostrzeżenie, nie blokada', plik({wersja:null,
  T:{250:0.40,500:0.38,1000:0.36,2000:0.35,4000:0.34}}), false, 'nie podaje wersji');
/* odrzucenie nie może zostawić na ekranie podglądu z pliku poprzedniego */
api.przyjmij(plik({T:{250:0.40,500:0.38,1000:0.36,2000:0.35,4000:0.34}}));
const bylPodglad=!odrzucony();
api.przyjmij(plik({wersja:'silnik-v2',T:{250:0.40,500:0.38,1000:0.36,2000:0.35,4000:0.34}}));
if(bylPodglad&&odrzucony()) console.log('  ok    zły plik po dobrym chowa podgląd i „Dalej"');
else {zle++;console.log('  BŁĄD  zły plik po dobrym zostawia podgląd z poprzedniego');}

console.log('\nPełny przebieg — bramka nie może zepsuć rachunku');
api.przyjmij(plik({Tmid:0.353,
  T:{125:0.42,250:0.38,500:0.353,1000:0.345,2000:0.32,4000:0.30}}));
api.ST.cel=0.30;
E('b2').onclick(); E('b3').onclick(); E('bJson').onclick();
const w=JSON.parse(pobrane);
const przeszlo = w.kontrola_wejscia && w.kontrola_wejscia.przeszla===true &&
  w.kontrola_wejscia.rozrzut_pasm===1.27 &&
  w.zrodlo_pomiaru.wersja_silnika==='silnik-v13' && w.propozycja.sztuk>0;
if(przeszlo) console.log('  ok    propozycja policzona, ślad kontroli w eksporcie'+
  ' ('+w.propozycja.sztuk+' szt., rozrzut '+w.kontrola_wejscia.rozrzut_pasm+')');
else {zle++;console.log('  BŁĄD  eksport bez śladu kontroli albo bez propozycji\n         '+
  JSON.stringify(w.kontrola_wejscia));}

console.log(zle?'\n'+zle+' testów nie przeszło\n':'\nWszystkie testy przeszły\n');
process.exit(zle?1:0);
