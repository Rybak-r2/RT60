/* Zbiera wszystkie teksty wymagające tłumaczenia — z wywołań t() w kodzie obu
   stron oraz z węzłów tekstowych statycznych znaczników (te są kluczami same
   z siebie, bo kluczem jest polski tekst).

   Uruchomienie:  node docs/zbierz-teksty.js          — lista
                  node docs/zbierz-teksty.js --brakujace  — tylko nieprzetłumaczone

   Służy do trzech rzeczy: do przygotowania słownika, do sprawdzenia
   kompletności po zmianach i do wydania tłumaczowi listy w jednym kawałku. */
"use strict";
const fs=require('fs'), path=require('path');
const KAT=path.join(__dirname,'..');

/* Znaczniki zapisane encjami (&rarr;, &nbsp;) docierają do DOM jako znaki,
   więc kluczem w czasie działania jest znak, nie encja. Dekodujemy te, które
   faktycznie występują. */
const ENCJE={'&rarr;':'\u2192','&larr;':'\u2190','&nbsp;':'\u00a0','&amp;':'&',
  '&lt;':'<','&gt;':'>','&quot;':'"','&middot;':'\u00b7','&sup2;':'\u00b2','&sup3;':'\u00b3'};
function odkoduj(s){
  return String(s).replace(/&[a-z]+;/g, e=>ENCJE[e]!==undefined?ENCJE[e]:e);
}

function zTagow(html){
  /* Bez zawartości <style> — to nie jest tekst dla użytkownika. */
  const markup=html.split('<script')[0].replace(/<style[\s\S]*?<\/style>/g,'');
  const out=[];
  /* Węzły tekstowe: wszystko poza znacznikami, po obcięciu białych znaków. */
  markup.replace(/>([^<]+)</g,(m,txt)=>{
    const s=txt.replace(/\s+/g,' ').trim();
    const d=odkoduj(s);
    if(d&&/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(d)) out.push(d);
    return m;
  });
  const ph=markup.match(/placeholder="([^"]*)"/g)||[];
  ph.forEach(x=>{const v=odkoduj(x.slice(13,-1)); if(v) out.push(v);});
  return out;
}

function zKodu(html){
  const sk=html.split('<script>\n')[1].split('</script>')[0];
  const out=[];
  /* t('...') i t("...") — pierwszy argument, z obsługą apostrofu uciekanego. */
  const re=/\bt\(\s*'((?:[^'\\]|\\.)*)'/g;
  let m; while((m=re.exec(sk))) out.push(m[1].replace(/\\'/g,"'"));

  /* Etykiety z tablic definicyjnych (WYK, FORMATY, CELE, listy montażu).
     Stoją tam jako zwykłe napisy, a przez t() przechodzą dopiero w wybor(),
     czyli jako zmienna — sam wzorzec t('…') ich nie widzi. Wypisujemy je
     po nazwach pól, żeby lista nie wymagała ręcznego dopisywania przy
     każdym nowym wariancie panelu. */
  const pola=/(?:^|[\s{,])(?:n|o|nazwa|opis|etykieta):\s*'((?:[^'\\]|\\.)*)'/g;
  while((m=pola.exec(sk))){
    const v=m[1].replace(/\\'/g,"'");
    /* Same wymiary ('640 × 420') to nie tekst do tłumaczenia — podobnie
       nazwy plików w paczce ('raport.html', 'ir-punkt-'), które muszą
       zostać jednakowe we wszystkich językach, bo odwołuje się do nich
       czytaj-to.txt i moduł doboru. */
    if(/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(v) && !/^[a-z0-9._-]+$/.test(v)) out.push(v);
  }
  return out;
}

const teksty=[];
['index.html','dobor.html'].forEach(f=>{
  const h=fs.readFileSync(path.join(KAT,f),'utf8');
  zTagow(h).concat(zKodu(h)).forEach(s=>{ if(teksty.indexOf(s)<0) teksty.push(s); });
});

/* Wartości przekazywane do t() dynamicznie — nazwy z definicji list wyboru,
   powody odrzucenia pasma, źródła rozpoznania. Kod woła t(zmienna), więc
   ekstraktor sam ich nie widzi. */
/* Identyfikatorów rodzajów wnętrz ('biuro', 'openspace', …) tu nie ma:
   nie przechodzą przez t(), tylko przez Jezyk.slug() w nazwie pliku.
   Etykietę do czytania daje nazwaTypu() z tablicy CELE. */
const DYNAMICZNE=[
  'dobry','orient.','brak pobudzenia','za mały zakres','zanik nieliniowy','odstaje od sąsiadów',
  'pole charakter_pomiaru','tor.zrodlo = phone (plik ze starszego silnika)',
  'tor.zrodlo = ext (plik ze starszego silnika)','nie ustalono — przyjęto poglądowy',
  'pomieszczenie','Cel własny','zalecane',
  'Pomiar z tego badania','Wczytaj inny plik','Wybierz plik z badania'
];
DYNAMICZNE.forEach(s=>{ if(teksty.indexOf(s)<0) teksty.push(s); });

if(process.argv.indexOf('--brakujace')>=0){
  const store={};
  global.window={localStorage:{getItem:()=>null,setItem(){}},
    document:{documentElement:{setAttribute(){}}}};
  ['jezyki.js','jezyk-en.js','jezyk-de.js'].forEach(f=>{
    const kod=fs.readFileSync(path.join(KAT,f),'utf8');
    new Function('window','self','globalThis',kod).call(global.window,global.window,global.window,global.window);
  });
  const sl=global.window.Jezyk.slownik;
  let brak=0;
  ['en','de'].forEach(k=>{
    const b=teksty.filter(x=>!sl[k][x]);
    console.log('\n=== '+k.toUpperCase()+': brakuje '+b.length+' z '+teksty.length+' ===');
    b.forEach(x=>console.log('  '+JSON.stringify(x)));
    brak+=b.length;
  });
  process.exit(brak?1:0);
}
console.log(JSON.stringify(teksty,null,1));
console.error('razem: '+teksty.length+' tekstów');
