/* Wersje językowe — wspólne dla obu programów.

   KLUCZEM JEST POLSKI TEKST. Nie wymyślamy nazw w rodzaju `btn.save.title`,
   tylko piszemy t('Zapisz wynik'). Trzy powody:

   1. Słownik wygląda jak {'Zapisz wynik': 'Save result'} — czyta go i poprawia
      tłumacz, bez zaglądania w kod i bez ryzyka, że podmieni nie to.
   2. Klucz nie może rozjechać się z tekstem, bo jest tekstem.
   3. Brak tłumaczenia pokazuje POLSKI, a nie pustkę ani `btn.save.title`.
      Usterka jest wtedy widoczna, ale nieszkodliwa.

   Cena: zmiana polskiego zdania unieważnia jego tłumaczenia. To jest cecha,
   nie wada — docs/test-jezyki.js wypisuje wtedy nowy tekst jako nieprzetłumaczony.

   PODSTAWIENIA: zdanie z liczbą musi być JEDNYM napisem z miejscem na wstawkę,
   a nie sklejką. Inaczej nie da się go przetłumaczyć na niemiecki, gdzie szyk
   zdania jest inny. Stąd t('Potrzeba {ile} paneli', {ile:7}), nie 'Potrzeba '+n+' paneli'.

   CZEGO NIE TŁUMACZYMY: kontraktu danych. Klucze i wartości w JSON —
   charakter_pomiaru, "pogladowy", T_srednie — czyta moduł doboru i leżą
   w każdej zapisanej paczce. Tłumaczymy to, co czyta człowiek; format danych
   zostaje jeden. */
(function(global){
"use strict";

const JEZYKI=[
  {kod:'pl', nazwa:'Polski',  html:'pl', locale:'pl-PL', przecinek:true},
  {kod:'en', nazwa:'English', html:'en', locale:'en-GB', przecinek:false},
  {kod:'de', nazwa:'Deutsch', html:'de', locale:'de-DE', przecinek:true}
];
const KLUCZ='rt60-jezyk';

/* Słowniki wypełniane niżej, w osobnych blokach — po jednym na język, żeby
   dało się je przeglądać i poprawiać niezależnie. */
const SLOWNIK={en:{}, de:{}};

let biezacy=JEZYKI[0];

function znajdz(kod){
  for(let i=0;i<JEZYKI.length;i++) if(JEZYKI[i].kod===kod) return JEZYKI[i];
  return null;
}

/* Tłumaczenie z podstawieniami. Brak wpisu → polski oryginał. */
function t(pl, pod){
  let s=pl;
  if(biezacy.kod!=='pl'){
    const w=SLOWNIK[biezacy.kod];
    if(w && typeof w[pl]==='string' && w[pl]) s=w[pl];
  }
  if(pod) for(const k in pod) s=s.split('{'+k+'}').join(pod[k]);
  return s;
}

/* Liczba z separatorem właściwym dla języka. Polski i niemiecki mają przecinek,
   angielski kropkę — i dotyczy to też tego, co użytkownik WPISUJE. */
function liczba(v, miejsca){
  if(v==null||!isFinite(v)) return '—';
  const s=v.toFixed(miejsca==null?2:miejsca);
  return biezacy.przecinek?s.replace('.',','):s;
}
/* Odwrotność: tekst z pola na liczbę, przyjmując oba separatory niezależnie
   od języka. Ktoś przełączy język w trakcie wpisywania i nie może stracić danych. */
function naLiczbe(s){
  const c=String(s==null?'':s).trim().replace(/\s/g,'').replace(',','.');
  return /^\d*\.?\d+$/.test(c)?parseFloat(c):NaN;
}
function separator(){ return biezacy.przecinek?',':'.'; }
/* Porządkowanie tego, co użytkownik wpisuje w locie: wszystkie znaki, które
   mogą wyjść spod klawiatury jako separator dziesiętny, sprowadzamy do tego
   właściwego dla języka, resztę usuwamy. Bez tego pole z type="text" przyjmuje
   „5,2" po angielsku i „5.2" po polsku, a użytkownik nie wie, co jest nie tak. */
function normalizuj(tekst){
  const sep=separator();
  let s=String(tekst==null?'':tekst).replace(/[.,·˙٫․‧]/g, sep);
  s=s.replace(sep==','?/[^0-9,]/g:/[^0-9.]/g, '');
  const i=s.indexOf(sep);
  if(i>=0) s=s.slice(0,i+1)+s.slice(i+1).split(sep).join('');
  return s;
}

function data(iso){
  try{ return new Date(iso).toLocaleDateString(biezacy.locale); }catch(e){ return null; }
}

/* Odmiana przez liczbę. Polski ma trzy formy z wyjątkiem na nastki,
   angielski i niemiecki po dwie. */
function ilu(n, poj, mno, dop){
  if(biezacy.kod!=='pl') return n===1?poj:(mno||dop||poj);
  const d=n%10, s=n%100;
  return n===1?poj:(d>=2&&d<=4&&!(s>=12&&s<=14)?mno:dop);
}

/* Znaki diakrytyczne wszystkich trzech języków — do nazw plików. */
const DIAKRYTY={'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
                'ä':'ae','ö':'oe','ü':'ue','ß':'ss'};
function slug(txt){
  return String(txt||'').toLowerCase()
    .replace(/[ąćęłńóśźżäöüß]/g, c=>DIAKRYTY[c]||c)
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function ustaw(kod, przeladuj){
  const j=znajdz(kod); if(!j) return false;
  biezacy=j;
  try{ global.localStorage.setItem(KLUCZ,kod); }catch(e){}
  try{ global.document.documentElement.setAttribute('lang', j.html); }catch(e){}
  if(przeladuj!==false && global.location && global.location.reload) global.location.reload();
  return true;
}

/* Odtworzenie wyboru przy wejściu. Domyślny jest polski — świadomie, bez
   zgadywania po ustawieniach przeglądarki. */
function start(){
  let kod=null;
  try{ kod=global.localStorage.getItem(KLUCZ); }catch(e){}
  const j=znajdz(kod); if(j) biezacy=j;
  try{ global.document.documentElement.setAttribute('lang', biezacy.html); }catch(e){}
  return biezacy.kod;
}

/* Przełącznik: nazwy języków, nie flagi. Flaga to kraj, nie język — angielski
   to nie tylko Wielka Brytania, a niemiecki to też Austria i Szwajcaria. */
function przelacznik(idPojemnika){
  let el=null;
  try{ el=global.document.getElementById(idPojemnika); }catch(e){}
  if(!el) return;
  el.innerHTML=JEZYKI.map(j=>
    '<button type="button" class="jez'+(j.kod===biezacy.kod?' sel':'')+
    '" data-jez="'+j.kod+'" lang="'+j.html+'">'+j.nazwa+'</button>').join('');
  const guziki=el.querySelectorAll('button');
  for(let i=0;i<guziki.length;i++) guziki[i].onclick=function(){
    const kod=this.getAttribute('data-jez');
    if(kod!==biezacy.kod) ustaw(kod);
  };
}

/* Tłumaczenie STATYCZNYCH znaczników bez dotykania ich w pliku. Skoro kluczem
   jest polski tekst, to ten, który już stoi w HTML, jest gotowym kluczem —
   nie trzeba go przenosić ani oznaczać. Chodzimy po węzłach tekstowych
   i podmieniamy zawartość.

   Uruchamiane RAZ, przy starcie. Treści budowane potem przez kod idą przez t()
   jawnie — inaczej groziłoby podwójne tłumaczenie tego samego zdania. */
function tlumaczDOM(korzen){
  if(biezacy.kod==='pl') return;
  let el=null;
  try{ el=korzen||global.document.body; }catch(e){}
  if(!el||!global.document.createTreeWalker) return;
  try{
    const w=global.document.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */, null);
    const doZmiany=[];
    let n;
    while((n=w.nextNode())){
      const rdzen=n.nodeValue.trim();
      if(!rdzen) continue;
      const przetlumaczony=t(rdzen);
      if(przetlumaczony!==rdzen) doZmiany.push([n, n.nodeValue.replace(rdzen, przetlumaczony)]);
    }
    doZmiany.forEach(function(x){ x[0].nodeValue=x[1]; });

    /* Podpowiedzi w polach też są tekstem widzianym przez użytkownika. */
    const pola=global.document.querySelectorAll('[placeholder]');
    for(let i=0;i<pola.length;i++){
      const v=pola[i].getAttribute('placeholder');
      if(v) pola[i].setAttribute('placeholder', t(v));
    }
  }catch(e){}
}

global.Jezyk={t:t, tlumaczDOM:tlumaczDOM, przelacznik:przelacznik, ustaw:ustaw, start:start, biezacy:function(){return biezacy.kod;},
  lista:JEZYKI, liczba:liczba, naLiczbe:naLiczbe, separator:separator, normalizuj:normalizuj, data:data,
  ilu:ilu, slug:slug, slownik:SLOWNIK};
})(typeof window!=='undefined'?window:this);
