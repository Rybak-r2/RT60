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
function klasy(){return{_h:new Set(),add(c){this._h.add(c);},remove(c){this._h.delete(c);},
  toggle(c,v){v?this._h.add(c):this._h.delete(c);},has(c){return this._h.has(c);}};}
function el(){return{innerHTML:'',textContent:'',value:'',className:'',dataset:{},style:{},
  classList:klasy(),addEventListener(){},click(){},
  /* Listy wyboru rysują się przez innerHTML, a potem strona przypina onclick do
     zwróconych elementów. Atrapa odtwarza je z data-id i TRZYMA te same obiekty,
     dopóki treść się nie zmieni — inaczej test klikałby w co innego niż strona. */
  querySelectorAll(sel){
    if(sel!=='.opt')return[];
    if(this._html!==this.innerHTML){
      this._html=this.innerHTML;
      const ids=String(this.innerHTML).match(/data-id="[^"]+"/g)||[];
      this._opt=ids.map(a=>({dataset:{id:a.slice(9,-1)},classList:klasy(),onclick:null}));
    }
    return this._opt;
  }};}
const cache={};
global.document={getElementById:id=>cache[id]||(cache[id]=el()),
  querySelectorAll:()=>[],createElement:()=>el()};
global.window={scrollTo(){}};
let pobrane=null;
global.Blob=class{constructor(cz){pobrane=cz[0];}};
global.URL={createObjectURL:()=>'blob:test',revokeObjectURL(){}};

const E=id=>document.getElementById(id);
/* Kliknięcie w pozycję listy — przez tę samą drogę, którą idzie użytkownik. */
function klik(pojemnik,id){
  const o=E(pojemnik).querySelectorAll('.opt').filter(x=>x.dataset.id===id)[0];
  if(!o||!o.onclick) throw new Error('brak pozycji '+id+' w liście '+pojemnik);
  o.onclick();
}

/* Każde uruchomienie to świeża instancja skryptu strony na czystej atrapie DOM.
   Bez tego handlery przycisków zostawały przy poprzednim egzemplarzu stanu ST,
   a test ustawiał pola na obiekcie, którego nikt już nie czytał — i przechodził
   albo padał z powodu, który nie miał nic wspólnego ze stroną. */
let api;
function uruchom(pomiar){
  const mem={};
  global.sessionStorage={getItem:k=>k in mem?mem[k]:null,
    setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];}};
  if(pomiar) mem['rt60-pomiar']=JSON.stringify(pomiar);
  for(const k in cache) delete cache[k];
  api=new Function(src+'\n;return {przyjmij:przyjmij,ST:ST};')();
  return api;
}
uruchom(null);
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

console.log('\nPrzejęcie pomiaru wprost z badania');
/* Przekazanie z pomiaru nie może być wejściem bocznym omijającym bramkę.
   Uruchamiamy skrypt strony jeszcze raz, z pomiarem czekającym w pamięci. */
function zPamieci(j){
  uruchom(j);
  return {odrzucony:E('podglad').classList.has('hide'),
          tekst:E('m1').innerHTML.replace(/<[^>]+>/g,''),
          skad:E('skad').innerHTML.replace(/<[^>]+>/g,''),
          zrodlo:E('zrodloWej').innerHTML.replace(/<[^>]+>/g,' ')};
}
let r=zPamieci(plik({Tmid:0.353,
  T:{125:0.42,250:0.38,500:0.353,1000:0.345,2000:0.32,4000:0.30}}));
if(!r.odrzucony&&r.zrodlo.indexOf('Pomiar z tego badania')>=0&&
   r.zrodlo.indexOf('Wczytaj inny plik')>=0)
  console.log('  ok    pomiar przejęty bez pliku, z możliwością wczytania innego');
else {zle++;console.log('  BŁĄD  przejęcie poprawnego pomiaru nie zadziałało\n         '+r.zrodlo);}

r=zPamieci(plik({wersja:'silnik-v2',
  T:{250:0.40,500:0.38,1000:0.36,2000:0.35,4000:0.34}}));
if(r.odrzucony&&r.tekst.indexOf('silnik-v2')>=0)
  console.log('  ok    zły pomiar przejęty z badania blokowany tak samo jak plik');
else {zle++;console.log('  BŁĄD  przejęcie omija bramkę wiarygodności — wejście boczne');}

r=zPamieci(plik({Tmid:1.251,
  T:{125:1.90,250:0.224,500:0.501,1000:2.001,2000:0.90,4000:0.70}}));
if(r.odrzucony&&r.tekst.indexOf('rozjeżdżają się')>=0)
  console.log('  ok    rozjazd pasm wykrywany także na drodze przejęcia');
else {zle++;console.log('  BŁĄD  rozjazd pasm przepuszczony przy przejęciu');}

console.log('\nWykończenia — wybór musi wchodzić do rachunku');
/* Ten sam pomiar, ten sam cel, trzy warianty paneli. Liczby muszą się różnić
   zgodnie z alfa i polem modulu, a nie byc przepisane z jednego wzorca. */
function policz(wyk,mont,format){
  uruchom(null);
  api.przyjmij(plik({Tmid:0.353,
    T:{125:0.42,250:0.38,500:0.353,1000:0.345,2000:0.32,4000:0.30}}));
  api.ST.cel=0.30; E('b2').onclick();
  api.ST.wyk=wyk; api.ST.mont=mont; api.ST.format=format;
  E('b3').onclick(); E('bJson').onclick();
  const o=JSON.parse(pobrane);
  return {szt:o.propozycja.sztuk, pow:o.propozycja.powierzchnia_m2,
          czynne:o.panel.pole_czynne_sztuki_m2, zewn:o.panel.pole_zewnetrzne_sztuki_m2,
          panele:o.panel.panele_w_sztuce, alfa:o.alfa_panelu, sklad:o.panel.sklad,
          wariant:o.panel.wariant, zrodlo:o.alfa_zrodlo};
}
const w100=policz('tex','w100','k1');
const mozaika=policz('tex','w100','k2');
const mieszany2=policz('tex','w100','k3');
const w50 =policz('tex','w50','k1');
const nuo =policz('nuo','n100','k1');
const nuo50=policz('nuo','n50','k1');
console.log('        tekstylny 100 mm, 1000×610 : '+w100.szt+' szt., '+w100.pow+' m²');
console.log('        tekstylny  50 mm, 1000×610 : '+w50.szt +' szt., '+w50.pow +' m²');
console.log('        NUO_WALL 100 mm, 950×950   : '+nuo.szt +' szt., '+nuo.pow +' m²');
console.log('        NUO_WALL  50 mm, 950×950   : '+nuo50.szt+' szt., '+nuo50.pow+' m²');

function sprawdz(warunek,opis){ if(warunek)console.log('  ok    '+opis);
  else {zle++;console.log('  BŁĄD  '+opis);} }
sprawdz(w100.czynne===0.61&&nuo.czynne===0.61,
  'formaty są wspólne dla obu wykończeń — to samo pole czynne');
/* Ramka MDF nie pochłania, ale zajmuje ścianę. Mylenie tych dwóch pól
   zaniżało zapotrzebowanie na miejsce o 8–13 %. */
sprawdz(w100.zewn===0.659&&w100.czynne===0.61,
  'panel tekstylny zajmuje więcej ściany, niż pochłania');
/* NUO liczy się teraz z lica tak samo jak tekstylne. Przy formacie 1030 × 640
   rama zajmuje około 8 % powierzchni panelu, więc przypisanie jej α zmierzonego
   na próbce 2440 × 1220 obiecywałoby więcej, niż panel da. */
sprawdz(nuo.zewn===0.659&&nuo.czynne===0.61,
  'NUO liczy się z lica tak samo jak tekstylne — rama nie pochłania');
/* Oba kartony to jedna płyta wełny pocięta bez odpadu, więc akustycznie
   są niemal równoważne — wybór kartonu jest decyzją o wyglądzie. */
sprawdz(mozaika.panele.length===2&&mozaika.czynne===w100.czynne&&mozaika.szt===w100.szt,
  'komplet dzielony pochłania dokładnie tyle samo co panel pojedynczy');
sprawdz(mozaika.zewn>w100.zewn,
  'komplet dzielony zajmuje więcej ściany — dwie ramki zamiast jednej');
/* Zestaw mieszany to kartony po połowie jednego i drugiego rodzaju. Skoro oba
   mają identyczne pole czynne, przeplatanka nie może zmienić liczby kartonów. */
sprawdz(mieszany2.czynne===w100.czynne&&mieszany2.szt===w100.szt,
  'zestaw mieszany pochłania tyle samo i daje tę samą liczbę sztuk');
sprawdz(mieszany2.zewn>w100.zewn&&mieszany2.zewn<mozaika.zewn,
  'zestaw mieszany zajmuje ściany pomiędzy jednym a drugim formatem');
sprawdz(mieszany2.sklad.indexOf('1030 × 640')>=0&&mieszany2.sklad.indexOf('640 × 420')>=0,
  'skład zestawu mieszanego wymienia panele obu rodzajów');
sprawdz(w100.alfa[250]===0.67&&w50.alfa[250]===0.36&&nuo50.alfa[250]===0.6&&nuo.alfa[250]===0.85,
  'do rachunku idzie α wybranego wariantu, nie jedna tabela dla wszystkich');
/* Wełna kupowana na spec 40–60 kg/m³: α musi być najgorsza z przedziału,
   inaczej obietnica trzyma się tylko przy szczęśliwej dostawie. */
sprawdz(w100.alfa[500]===0.77&&w100.alfa[1000]===0.85,
  'wełna liczona najgorszym przypadkiem z przedziału 40–60 kg/m³');
/* Grubość absorbera NUO zmienia dół pasma, a nie liczbę paneli: oba warianty
   nasycają się na 1,00 w pasmach mowy, z których liczy się Tmid. */
sprawdz(nuo.szt===nuo50.szt&&nuo.pow===nuo50.pow,
  'grubość absorbera NUO nie zmienia liczby paneli, tylko dół pasma');
sprawdz(w50.pow>w100.pow,'wełna 50 mm wymaga większej powierzchni niż 100 mm');
sprawdz(nuo.pow<w100.pow,'NUO wymaga mniejszej powierzchni — α 1,00 w pasmach mowy');
sprawdz(nuo50.zrodlo.indexOf('NUO_WALL')>=0&&nuo.zrodlo.indexOf('SZACUNEK')>=0&&
  w100.zrodlo.indexOf('Mikiego')>=0,
  'eksport podaje właściwe źródło α — także to, że 100 mm NUO jest szacunkiem');
/* Format z poprzedniego wykończenia nie może wywrócić rachunku — wybór cofa
   się wtedy do pierwszego formatu wykończenia właśnie wybranego. */
const mieszany=policz('nuo','n100','k1');
sprawdz(mieszany.czynne===0.61&&mieszany.szt>0,
  'format wspólny dla obu wykończeń liczy się tak samo');

console.log('\nRekomendacja wersji — ma wskazywać pomiar, nie cennik');
/* Wersję wybiera równowaga tonalna po adaptacji, liczona osobno dla obu
   wersji. Rekomendacja, która czasem mówi „Standard wystarczy", jest brana
   serio, gdy mówi „potrzeba Premium". */
function rekomendacja(T,cel){
  uruchom(null);
  api.przyjmij(plik({T:T}));
  api.ST.cel=cel; E('b2').onclick();
  return {typ:api.ST.rekom&&api.ST.rekom.typ, wersja:api.ST.mont};
}
const rowny  =rekomendacja({125:0.45,250:0.40,500:0.38,1000:0.37,2000:0.35,4000:0.33},0.30);
const lagodny=rekomendacja({125:0.45,250:0.40,500:0.38,1000:0.37,2000:0.35,4000:0.33},0.35);
const martwy =rekomendacja({125:0.28,250:0.26,500:0.38,1000:0.40,2000:0.42,4000:0.44},0.30);
const bezPasma=rekomendacja({125:0.45,500:0.38,1000:0.37,2000:0.35,4000:0.33},0.30);

sprawdz(rowny.typ==='premium'&&rowny.wersja==='w100',
  'ambitny cel przy równym dole — zalecane Premium');
sprawdz(lagodny.typ==='standard'&&lagodny.wersja==='w50',
  'łagodny cel — program mówi, że Standard wystarczy, i sam go wybiera');
/* To jest przypadek, na ktorym poprzednie kryterium sie mylilo: dol juz
   przytlumiony mocniej niz gora, panele podnosza stosunek W STRONE 1,0,
   czyli poprawiaja rownowage. Ostrzezenie bylo tam falszywe. */
sprawdz(martwy.typ==='standard',
  'gdy dół jest już przytłumiony, wzrost stosunku to poprawa, nie usterka');
sprawdz(bezPasma.typ==='nieocenialna'&&bezPasma.wersja==='w100',
  'bez pasma 250 Hz wersji nie da się wskazać — domyślnie bezpieczniejsze Premium');

/* Wybor wbrew rekomendacji nie moze zniknac — handlowiec ma go widziec. */
uruchom(null);
api.przyjmij(plik({T:{125:0.45,250:0.40,500:0.38,1000:0.37,2000:0.35,4000:0.33}}));
api.ST.cel=0.30; E('b2').onclick();
api.ST.mont='w50'; api.ST.montRecznie=true;
E('b3').onclick(); E('bJson').onclick();
const zr=JSON.parse(pobrane).rekomendacja;
sprawdz(zr&&zr.zalecana==='w100'&&zr.wybrana==='w50'&&zr.zgodna===false&&
  zr.uzasadnienie.length>0,
  'rozbieżność wyboru z rekomendacją idzie do zapytania wraz z uzasadnieniem');

console.log('\nCel adaptacji — wybór zamiast pola z podpowiedzią');
/* Pole „cel własny" stało zawsze obok listy z podpowiedzią 0,60 i wyglądało
   na wypełnione. Przy przeznaczeniu spoza listy program liczył z 0,60, nie
   pytając nikogo o zdanie. Teraz cel własny jest pozycją listy. */
uruchom(null);
api.przyjmij(plik({T:{125:0.45,250:0.40,500:0.38,1000:0.37,2000:0.35,4000:0.33}}));
sprawdz(api.ST.celId==='salon'&&api.ST.cel===0.45,
  'przeznaczenie z pliku wybiera pozycję listy i jej wartość');
sprawdz(E('celWlBox').classList.has('hide'),
  'pole celu własnego jest schowane, dopóki nie zostanie wybrane');

klik('cele','wlasny');
sprawdz(!E('celWlBox').classList.has('hide')&&api.ST.cel==null,
  'wybór celu własnego odsłania pole i nie podstawia żadnej wartości');
E('m2').innerHTML=''; E('b2').onclick();
sprawdz(E('m2').innerHTML.indexOf('Wpisz docelowy czas')>=0,
  'pusty cel własny zatrzymuje przejście dalej z jasnym komunikatem');

E('celWl').value='0,45';
/* Odczyt pola idzie przez zdarzenie input, którego atrapa nie wywołuje —
   liczy się tu sama walidacja przy komplecie danych. */
api.ST.cel=0.45; E('m2').innerHTML=''; E('b2').onclick();
sprawdz(E('m2').innerHTML.indexOf('Wpisz')<0,'cel własny z wartością przepuszcza dalej');

klik('cele','biuro');
sprawdz(api.ST.cel===0.60&&E('celWlBox').classList.has('hide'),
  'powrót do pozycji z listy chowa pole i przywraca jej wartość');

/* Przeznaczenie spoza listy nie może po cichu podstawić 0,60. */
uruchom(null);
const bezTypu=plik({T:{125:0.45,250:0.40,500:0.38,1000:0.37,2000:0.35,4000:0.33}});
bezTypu.pomieszczenie.typ='inne';
api.przyjmij(bezTypu);
sprawdz(api.ST.cel==null,'przeznaczenie spoza listy nie podstawia celu za użytkownika');
E('m2').innerHTML=''; E('b2').onclick();
sprawdz(E('m2').innerHTML.indexOf('Wybierz rodzaj wnętrza')>=0,
  'brak wybranego celu zatrzymuje przejście dalej');

console.log('\nJednostka — sztuki, a przy panelu dzielonym komplet');
const jedn=policz('tex','w100','k1'), kompl=policz('tex','w100','k2');
sprawdz(jedn.sklad.indexOf('panel 1030 × 640')>=0&&jedn.sklad.indexOf('komplet')<0,
  'panel pojedynczy opisany jako panel');
sprawdz(kompl.sklad.indexOf('komplet')>=0&&/\(\d+ panel/.test(kompl.sklad)&&
  kompl.szt===jedn.szt,
  'panel dzielony opisany jako komplet, z liczbą paneli w środku i tą samą liczbą sztuk');

console.log(zle?'\n'+zle+' testów nie przeszło\n':'\nWszystkie testy przeszły\n');
process.exit(zle?1:0);
