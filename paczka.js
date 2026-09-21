/* Pakowanie wyniku i magazyn odpowiedzi impulsowych — wspólne dla obu programów.

   Po co wspólne: komplet powstaje dopiero NA KOŃCU DOBORU, bo dopiero tam
   wiadomo, jakie panele wybrano i jaki będzie czas pogłosu po adaptacji.
   Plik zapisany wcześniej mówi „to pomieszczenie ma 0,38 s" i jest prawdziwy,
   ale niekompletny — po miesiącu nikt nie odtworzy, którą wersję paneli klient
   właściwie wybierał. Zapis należy tam, gdzie decyzja jest domknięta.

   Problem: odpowiedzi impulsowe powstają w programie POMIAROWYM i żyją tylko
   w jego pamięci. Do doboru trzeba je jakoś przenieść, a to megabajty —
   pamięć sesji przeglądarki (limit ok. 5 MB, zapis synchroniczny) by tego nie
   uniosła i zacięłaby telefon. Stąd IndexedDB: trzyma dane binarne natywnie
   i ma wielokrotnie większy limit.

   ZASADA NADRZĘDNA, ta sama co przy karcie pomieszczenia: to jest DODATEK.
   Gdy IndexedDB zawiedzie — prywatne okno, brak miejsca, zablokowany zapis —
   paczka powstaje BEZ odpowiedzi impulsowych, a czytaj-to.txt mówi wprost,
   że ich nie ma i dlaczego. Nic się nie zawala.
*/
(function(global){
"use strict";

/*═════════════ PAKOWANIE WYNIKU ═════════════
  Jeden przycisk musi oddać komplet: wyniki i surowiec, z którego je policzono.
  Rozdzielenie na dwa pobrania oznaczało, że klient przyśle połowę — a bez
  odpowiedzi impulsowych nie da się niczego przeliczyć ani zweryfikować.
  ZIP zapisujemy sami, metodą "store" (bez kompresji): kilkadziesiąt linii
  zamiast biblioteki z CDN, dzięki czemu aplikacja zostaje jednym plikiem
  działającym bez sieci. */
const CRC_TAB=(()=>{const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}
  return t;})();
function crc32(u8){let c=0xFFFFFFFF;
  for(let i=0;i<u8.length;i++)c=CRC_TAB[(c^u8[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;}

function zip(pliki){                       // [{nazwa, dane:Uint8Array}]
  const enc=new TextEncoder(), lok=[], cen=[];
  let offset=0;
  pliki.forEach(p=>{
    const nm=enc.encode(p.nazwa), cr=crc32(p.dane), n=p.dane.length;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0,true);
    lh.setUint16(8,0,true); lh.setUint16(10,0,true); lh.setUint16(12,0x21,true);
    lh.setUint32(14,cr,true); lh.setUint32(18,n,true); lh.setUint32(22,n,true);
    lh.setUint16(26,nm.length,true); lh.setUint16(28,0,true);
    lok.push(new Uint8Array(lh.buffer),nm,p.dane);

    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true);
    ch.setUint16(8,0,true); ch.setUint16(10,0,true); ch.setUint16(12,0,true); ch.setUint16(14,0x21,true);
    ch.setUint32(16,cr,true); ch.setUint32(20,n,true); ch.setUint32(24,n,true);
    ch.setUint16(28,nm.length,true); ch.setUint32(42,offset,true);
    cen.push(new Uint8Array(ch.buffer),nm);
    offset+=30+nm.length+n;
  });
  const cenDl=cen.reduce((a,x)=>a+x.length,0);
  const eo=new DataView(new ArrayBuffer(22));
  eo.setUint32(0,0x06054b50,true);
  eo.setUint16(8,pliki.length,true); eo.setUint16(10,pliki.length,true);
  eo.setUint32(12,cenDl,true); eo.setUint32(16,offset,true);
  return new Blob([...lok,...cen,new Uint8Array(eo.buffer)],{type:'application/zip'});
}

/* Data i godzina w nazwie paczki. Bez tego kilka badań ląduje w pobranych jako
   badanie-akustyczne(1).zip, (2), (3) — a po stronie ALACER przychodzi kilka
   plików o tej samej nazwie i nie wiadomo, który dotyczy którego pomieszczenia.
   Czas lokalny, bo to on zgadza się z tym, co użytkownik pamięta. */
function stempel(){
  const d=new Date(), z=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+
         '-'+z(d.getHours())+z(d.getMinutes());
}

/* Odpowiedź impulsowa jako WAV 32-bit float — format, który wczytają REW, ARTA,
   Audacity i biblioteki pythonowe bez konwersji. */
function wav(ir,fs){
  const n=ir.length, b=new ArrayBuffer(44+n*4), v=new DataView(b);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  w(0,'RIFF');v.setUint32(4,36+n*4,true);w(8,'WAVEfmt ');
  v.setUint32(16,16,true);v.setUint16(20,3,true);v.setUint16(22,1,true);
  v.setUint32(24,fs,true);v.setUint32(28,fs*4,true);v.setUint16(32,4,true);v.setUint16(34,32,true);
  w(36,'data');v.setUint32(40,n*4,true);
  for(let i=0;i<n;i++)v.setFloat32(44+i*4,ir[i],true);
  return new Uint8Array(b);
}

/*═══════════════ MAGAZYN ODPOWIEDZI IMPULSOWYCH ═══════════════
  Jeden zestaw naraz — ostatni pomiar. Historii tu nie trzymamy: od tego jest
  karta pomieszczenia, a surowiec waży tysiąc razy więcej niż wynik. */
const BAZA='rt60-ir', SKLAD='ir', KLUCZ='ostatni';

function otworz(){
  return new Promise(function(ok,zle){
    try{
      if(!global.indexedDB) return zle(new Error('brak IndexedDB'));
      const z=global.indexedDB.open(BAZA,1);
      z.onupgradeneeded=function(){ z.result.createObjectStore(SKLAD); };
      z.onsuccess=function(){ ok(z.result); };
      z.onerror=function(){ zle(z.error||new Error('otwarcie bazy')); };
      z.onblocked=function(){ zle(new Error('baza zablokowana')); };
    }catch(e){ zle(e); }
  });
}

function operacja(tryb,praca){
  return otworz().then(function(db){
    return new Promise(function(ok,zle){
      const t=db.transaction(SKLAD,tryb), s=t.objectStore(SKLAD);
      let wynik=null;
      try{ wynik=praca(s); }catch(e){ zle(e); return; }
      t.oncomplete=function(){ db.close(); ok(wynik&&wynik.result!==undefined?wynik.result:wynik); };
      t.onerror=function(){ db.close(); zle(t.error); };
      t.onabort=function(){ db.close(); zle(t.error||new Error('przerwane')); };
    });
  });
}

const IR={
  /* Zapis po zakończeniu pomiaru. Float32Array idzie do IndexedDB jak jest —
     bez base64, bez kopii, bez rozdymania o jedną trzecią. */
  zapisz:function(lista,fs,pomieszczenie){
    return operacja('readwrite',function(s){
      return s.put({czas:new Date().toISOString(), fs:fs,
        pomieszczenie:pomieszczenie||null,
        ir:(lista||[]).filter(Boolean).map(function(x){ return new Float32Array(x); })
      }, KLUCZ);
    }).then(function(){ return true; }).catch(function(){ return false; });
  },
  /* Odczyt przy budowaniu paczki. Zwraca null, gdy czegokolwiek brakuje —
     wywołujący ma wtedy zbudować paczkę bez surowca i o tym napisać. */
  wczytaj:function(){
    return operacja('readonly',function(s){ return s.get(KLUCZ); })
      .then(function(d){ return (d&&d.ir&&d.ir.length)?d:null; })
      .catch(function(){ return null; });
  },
  wyczysc:function(){
    return operacja('readwrite',function(s){ return s.delete(KLUCZ); })
      .then(function(){ return true; }).catch(function(){ return false; });
  }
};

function dl(b,n){
  const a=global.document.createElement('a');
  a.href=global.URL.createObjectURL(b); a.download=n; a.click();
  setTimeout(function(){ global.URL.revokeObjectURL(a.href); },2000);
}

global.Paczka={zip:zip, wav:wav, stempel:stempel, dl:dl, IR:IR};
})(typeof window!=='undefined'?window:this);
