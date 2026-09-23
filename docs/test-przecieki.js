/* Przecieki tłumaczeń — napisy, które nigdy nie przechodzą przez t().
   Uzasadnienie: docs/MODEL-AKUSTYCZNY.md, 6.7.

   Uruchomienie:  node docs/test-przecieki.js     (albo npm test)

   CZEGO NIE ŁAPIE test-jezyki.js. Tamten sprawdza, czy każdy ZNANY tekst ma
   tłumaczenie. Nie zobaczy zdania, które nigdy nie trafiło na listę — bo
   powstaje przez sklejanie w kodzie:

       $('sl3').textContent='dobrze (od '+SNR_AC_GOOD+' dB)';

   Takiego napisu ekstraktor nie widzi, więc nie ma go w słowniku, więc nie
   ma czego zgłosić jako brakujące. Na ekranie zostaje po polsku we wszystkich
   językach. Tak właśnie przeciekł podpis skali poziomu.

   JAK TO WYKRYWAMY. Bez listy polskich słów pisanej ręcznie i bez szukania
   ogonków — „dobrze (od 26 dB)" nie ma ani jednego znaku diakrytycznego,
   i dlatego wcześniejszy skan go przepuścił.

   Słownik sam mówi, co jest polskie: bierzemy wszystkie słowa z polskich
   kluczy i odejmujemy wszystkie słowa występujące w tłumaczeniach. Zostają
   słowa WYŁĄCZNIE POLSKIE — „dobrze", „zapisano", „wybierz". Nazwy własne
   (ALACER, NUO_WALL, REW, Bluetooth), jednostki i liczby odpadają same,
   bo stoją po obu stronach. Lista buduje się z projektu i starzeje się razem
   z nim.

   REGUŁA. Każdy napis w kodzie, który zawiera słowo wyłącznie polskie, musi
   albo przechodzić przez t(), albo stać w tablicy definicyjnej (skąd bierze
   go t() w wybor()), albo być wymieniony niżej jako polski Z ZAŁOŻENIA.

   Sama obecność w słowniku NIE wystarcza: klucz użyty bez t() to dokładnie
   ten przeciek, o który chodzi. Tak znalazł się nagłówek „Wybierz format",
   który tłumaczył się przy starcie strony, a potem wracał do polskiego przy
   każdym przerysowaniu listy wariantów. */
"use strict";
const fs=require('fs'), path=require('path'), cp=require('child_process');
const KAT=path.join(__dirname,'..');

let zle=0;
function sprawdz(w,opis){ if(w)console.log('  ok    '+opis);
  else {zle++;console.log('  BŁĄD  '+opis);} }

/*── polski Z ZAŁOŻENIA ──
  Nie każdy polski napis w kodzie jest do tłumaczenia. Te zostają i mają
  zostać; każda pozycja to decyzja, nie przeoczenie. */
const POLSKIE_Z_ZALOZENIA=new Set([
  /* Kontrakt danych: wartości zapisywane do JSON i czytane przez moduł
     doboru. Gdyby szły za językiem, ten sam pomiar dawałby trzy różne pliki.
     Tłumaczone są dopiero przy WYŚWIETLANIU, przez t(zmienna). */
  'brak pobudzenia','dobry','za mały zakres','zanik nieliniowy',
  'odstaje od sąsiadów','orientacyjny',
  'tor.zrodlo = phone (plik ze starszego silnika)',
  'tor.zrodlo = ext (plik ze starszego silnika)',
  'nie ustalono — przyjęto poglądowy',
  'do mikrofonu dotarło ',
  '% spodziewanego pola pogłosowego — dominuje dźwięk bezpośredni, C50/STI pominięte jako niewiarygodne',
  ' szt., powtorzyc badanie, w razie potrzeby dolozyc','widelki','liczba',
  /* Pochodzenie wartości α — pole `zrodlo` w propozycji. Opis dla tego, kto
     będzie sprawdzał rachunek, nie dla klienta. */
  'SZACUNEK: krzywa producenta dla wariantu 50 mm przeliczona na 100 mm — WARTOSCI TYMCZASOWE',
  'odczyt z wykresu alfa_p w ulotce NUO_WALL (muto, 10.2021) — WARTOSCI TYMCZASOWE, ',
  'do podmiany na tabele alfa_p od producenta',
  'model Mikiego, welna deklarowana 40-60 kg/m3, alfa najmniejsza z przedzialu ',
  'w kazdym pasmie — WARTOSCI TYMCZASOWE, do podmiany na tabele alfa_p od producenta welny',
  /* Identyfikatory: klucze magazynu, id opcji, wersje modułów, nazwy klas CSS. */
  'rt60-pomiar','dobor.html','dobór v4','dobor-v4',
  'biuro','lekcyjna','salon','wlasny','obie-za-slabe','oba','gdzie',
  'pomiar','plik','dobrze','uwaga',
  /* Nazwy plików w paczce — muszą być jednakowe we wszystkich językach,
     bo odwołuje się do nich czytaj-to.txt i moduł doboru. */
  'badanie-akustyczne-','badanie-akustyczne.json.','ir-punkt-N.wav',
  'wynik-','pomieszczenie'
]);

/*── słowa wyłącznie polskie, wyprowadzone ze słowników ──*/
global.window={localStorage:{getItem:()=>null,setItem(){}},
  document:{documentElement:{setAttribute(){}}}};
['jezyki.js','jezyk-en.js','jezyk-de.js'].forEach(f=>{
  new Function('window','self','globalThis',fs.readFileSync(path.join(KAT,f),'utf8'))
    .call(global.window,global.window,global.window,global.window);});
const SL=global.window.Jezyk.slownik;
const TEKSTY=JSON.parse(cp.execFileSync('node',[path.join(__dirname,'zbierz-teksty.js')],
  {encoding:'utf8',stdio:['ignore','pipe','ignore']}));

const slowa=s=>String(s).toLowerCase().match(/[a-ząćęłńóśźż]{3,}/g)||[];
const PL=new Set();   TEKSTY.forEach(t=>slowa(t).forEach(w=>PL.add(w)));
const OBCE=new Set();
['en','de'].forEach(k=>Object.keys(SL[k]).forEach(t=>slowa(SL[k][t]).forEach(w=>OBCE.add(w))));
const TYLKO_PL=new Set([...PL].filter(w=>!OBCE.has(w)));

console.log('\nPrzecieki tłumaczeń');
console.log('  słów w polskich tekstach: '+PL.size+', w tłumaczeniach: '+OBCE.size+
            ', wyłącznie polskich: '+TYLKO_PL.size+'\n');
sprawdz(TYLKO_PL.size>200,
  'zbiór słów wyłącznie polskich jest na tyle duży, żeby coś wykryć');
sprawdz(TYLKO_PL.has('dobrze')&&TYLKO_PL.has('zapisano')&&TYLKO_PL.has('wybierz'),
  'rozpoznaje słowa z przecieków, które już wystąpiły');
sprawdz(!TYLKO_PL.has('bluetooth')&&!TYLKO_PL.has('premium')&&!TYLKO_PL.has('standard'),
  'nazw własnych i słów wspólnych nie bierze za polskie');

/* Napisy przepuszczane: pierwszy argument t() oraz etykiety z tablic
   definicyjnych. Te drugie zbieramy CAŁYMI LINIAMI, bo bywają w wyrażeniu
   warunkowym (n:warunek?'A':'B'), a nie tuż za dwukropkiem. */
function dozwolone(sk){
  const ok=new Set(); let m;
  const re=/\bt\(\s*'((?:[^'\\]|\\.)*)'/g;
  while((m=re.exec(sk))) ok.add(m[1].replace(/\\'/g,"'"));
  sk.split('\n').forEach(linia=>{
    if(!/\b(?:n|o|nazwa|opis|etykieta)\s*:/.test(linia)) return;
    (linia.match(/'((?:[^'\\]|\\.)*)'/g)||[]).forEach(l=>
      ok.add(l.slice(1,-1).replace(/\\'/g,"'")));
  });
  return ok;
}
/* Z napisu zostawiamy sam tekst dla człowieka: reguły CSS i znaczniki HTML
   bywają zapisane po polsku (class="uwaga") i nie są do tłumaczenia. */
const oczysc=v=>v.replace(/[.#][\w-]+\s*\{[^}]*\}/g,' ')
                 .replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/g,' ');

let znalezione=0;
['index.html','dobor.html'].forEach(f=>{
  const cala=fs.readFileSync(path.join(KAT,f),'utf8');
  const sk=cala.split('<script>\n')[1].split('</script>')[0];
  const ok=dozwolone(sk);
  /* komentarze są po polsku z założenia i nie trafiają na ekran */
  const kod=sk.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1');
  const przecieki=[];
  (kod.match(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)||[]).forEach(l=>{
    const v=l.slice(1,-1).replace(/\\'/g,"'").replace(/\\"/g,'"');
    if(ok.has(v)||POLSKIE_Z_ZALOZENIA.has(v)) return;
    const tr=slowa(oczysc(v)).filter(w=>TYLKO_PL.has(w));
    if(tr.length&&!przecieki.some(x=>x.v===v)) przecieki.push({v:v,w:tr.join(', ')});
  });
  znalezione+=przecieki.length;
  sprawdz(przecieki.length===0, f+': żaden napis nie omija t()');
  przecieki.forEach(x=>console.log('         '+JSON.stringify(x.v)+'\n           ← '+x.w));
});

/* Lista wyjątków ma pozostać krótka i świadoma. Gdyby puchła, znaczyłoby to,
   że kontrakt danych rozlewa się na treść widzianą przez użytkownika. */
sprawdz(POLSKIE_Z_ZALOZENIA.size<=45,
  'lista napisów polskich z założenia nie rozrasta się ('+POLSKIE_Z_ZALOZENIA.size+')');

console.log('\n'+(zle?zle+' BŁĘDÓW':'wszystko przeszło')+'\n');
process.exit(zle?1:0);
