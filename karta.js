/* Karta pomieszczenia — historia jednego wnętrza, wspólna dla obu programów.

   Po co: kalkulator akustyczny ma każdy. Dowodu, że obietnica się spełniła,
   nie ma nikt. Ten sam program, który policzył panele, potrafi zmierzyć wynik
   po ich powieszeniu i powiedzieć: cel osiągnięty albo brakuje jeszcze czterech.
   Żeby to zrobić, musi pamiętać, co było przedtem.

   Karta narasta: pomiar → propozycja → pomiar kontrolny. Format zaprojektowany
   jako narastający od początku, bo doklejanie tego później kosztowałoby
   przerobienie danych (docs/MODEL-AKUSTYCZNY.md, 6.2).

   Gdzie leży: localStorage tej przeglądarki. Nic nie idzie na serwer — to samo
   zobowiązanie, co przy pomiarze i doborze. Cena jest taka, że karta nie
   przenosi się między urządzeniami; od tego jest paczka ZIP z badania.

   ZASADA NADRZĘDNA: karta jest DODATKIEM. Każda operacja może się nie udać —
   prywatne okno, wyczyszczone dane, przepełniony magazyn, przeglądarka
   z zablokowanym zapisem — i wtedy program ma działać dokładnie tak jak
   wcześniej. Dlatego wszystko siedzi w try/catch i zwraca null zamiast rzucać.
   Pomiar nie może się zawalić dlatego, że historia się nie zapisała. */
(function(global){
  "use strict";

  var KLUCZ='rt60-karty-v1';
  var MAX_KART=20;        // starsze wypadają, żeby nie rozsadzić magazynu
  var MAX_POMIAROW=8;     // na kartę; do porównania „przed/po" starczy z zapasem

  function magazyn(){
    try{
      var m=global.localStorage;
      m.setItem(KLUCZ+'-test','1'); m.removeItem(KLUCZ+'-test');
      return m;
    }catch(e){ return null; }
  }

  function wczytajWszystkie(){
    var m=magazyn(); if(!m) return [];
    try{
      var t=m.getItem(KLUCZ); if(!t) return [];
      var d=JSON.parse(t);
      return (d&&d.karty&&d.karty.length)?d.karty:[];
    }catch(e){ return []; }
  }

  function zapiszWszystkie(karty){
    var m=magazyn(); if(!m) return false;
    try{
      karty.sort(function(a,b){ return (b.zmieniona||'').localeCompare(a.zmieniona||''); });
      m.setItem(KLUCZ, JSON.stringify({wersja:1, karty:karty.slice(0,MAX_KART)}));
      return true;
    }catch(e){ return false; }   // najczęściej QuotaExceeded
  }

  /* Tożsamość pomieszczenia: wymiary zaokrąglone do 10 cm plus przeznaczenie.
     Dokładniej się nie da — te same wymiary klient wpisuje za drugim razem
     „na oko" i 5,2 potrafi wrócić jako 5,18. Zaokrąglenie zszywa oba pomiary
     w jedną kartę. Skutek uboczny: dwa różne pomieszczenia o tych samych
     wymiarach i przeznaczeniu trafią do jednej karty, dlatego przy porównaniu
     ZAWSZE pokazujemy datę wcześniejszego pomiaru — żeby dało się to rozpoznać
     i zignorować. */
  function id(p){
    if(!p||!(p.L>0)||!(p.W>0)||!(p.H>0)) return null;
    var r=function(x){ return Math.round(x*10)/10; };
    return [r(p.L),r(p.W),r(p.H),p.typ||'?'].join('x');
  }

  function znajdz(p){
    var k=id(p); if(!k) return null;
    var w=wczytajWszystkie();
    for(var i=0;i<w.length;i++) if(w[i].id===k) return w[i];
    return null;
  }

  /* Skrót pomiaru — tyle, ile potrzeba do porównania „przed/po". Pełne dane
     zostają w paczce ZIP; karta ma być mała, bo dzieli magazyn z całą resztą
     tego, co przeglądarka trzyma dla tej domeny. */
  function skrot(w){
    if(!w||!w.pomieszczenie) return null;
    var pasma={};
    (w.pasma||[]).forEach(function(b){
      if(b&&b.fc&&b.T_srednie!=null) pasma[b.fc]=b.T_srednie;
    });
    return {
      czas:w.czas||new Date().toISOString(),
      silnik:w.wersja||null,
      charakter:w.charakter_pomiaru||null,
      Tmid:w.Tmid!=null?w.Tmid:null,
      A_sabine_m2:w.A_sabine_m2!=null?w.A_sabine_m2:null,
      udzial_pola_poznego:w.udzial_pola_poznego!=null?w.udzial_pola_poznego:null,
      pasma:pasma
    };
  }

  function pusta(p,k){
    return {id:k, utworzona:new Date().toISOString(), zmieniona:new Date().toISOString(),
      pomieszczenie:{L:p.L, W:p.W, H:p.H, V:p.V||(p.L*p.W*p.H), typ:p.typ||null},
      pomiary:[], propozycja:null};
  }

  /* Dopisanie pomiaru. Zwraca stan karty SPRZED dopisania, bo to jest to, co
     woła sens: „co było przedtem". Zwraca null, gdy zapis się nie udał albo
     wcześniejszego pomiaru nie było. */
  function dopiszPomiar(w){
    try{
      if(!w||!w.pomieszczenie) return null;
      var k=id(w.pomieszczenie); if(!k) return null;
      var s=skrot(w); if(!s) return null;
      var karty=wczytajWszystkie(), karta=null;
      for(var i=0;i<karty.length;i++) if(karty[i].id===k){ karta=karty[i]; break; }
      var przed=null;
      if(karta){
        przed={pomiary:karta.pomiary.slice(), propozycja:karta.propozycja,
               utworzona:karta.utworzona};
      }else{
        karta=pusta(w.pomieszczenie,k); karty.push(karta);
      }
      /* Ten sam pomiar wczytany dwa razy nie może udawać dwóch podejść. */
      var ostatni=karta.pomiary[karta.pomiary.length-1];
      if(ostatni&&ostatni.czas===s.czas) return przed;
      karta.pomiary.push(s);
      if(karta.pomiary.length>MAX_POMIAROW)
        karta.pomiary=karta.pomiary.slice(-MAX_POMIAROW);
      karta.zmieniona=new Date().toISOString();
      zapiszWszystkie(karty);
      return przed;
    }catch(e){ return null; }
  }

  function dopiszPropozycje(pomieszczenie, propozycja){
    try{
      var k=id(pomieszczenie); if(!k) return false;
      var karty=wczytajWszystkie(), karta=null;
      for(var i=0;i<karty.length;i++) if(karty[i].id===k){ karta=karty[i]; break; }
      if(!karta){ karta=pusta(pomieszczenie,k); karty.push(karta); }
      karta.propozycja=propozycja;
      karta.zmieniona=new Date().toISOString();
      return zapiszWszystkie(karty);
    }catch(e){ return false; }
  }

  function zapomnij(pomieszczenie){
    try{
      var k=id(pomieszczenie); if(!k) return false;
      return zapiszWszystkie(wczytajWszystkie().filter(function(x){ return x.id!==k; }));
    }catch(e){ return false; }
  }

  global.Karta={
    id:id, znajdz:znajdz, lista:wczytajWszystkie,
    dopiszPomiar:dopiszPomiar, dopiszPropozycje:dopiszPropozycje,
    zapomnij:zapomnij, dostepna:function(){ return !!magazyn(); }
  };
})(typeof window!=='undefined'?window:this);
