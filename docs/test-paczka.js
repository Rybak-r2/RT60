/* Paczka wyniku — test regresyjny.
   Uzasadnienie: docs/MODEL-AKUSTYCZNY.md, 6.6.

   Uruchomienie:  node docs/test-paczka.js       (albo npm test)

   Rzecz najważniejsza: archiwum ZIP piszemy RĘCZNIE, bez biblioteki. Test
   otwiera je NIEZALEŻNĄ implementacją (zipfile z Pythona) — gdyby nasz zapis
   był choćby o bajt nie taki, żadna przeglądarka ani żaden system by tego nie
   rozpakował, a dowiedzielibyśmy się o tym od klienta. */
"use strict";
const fs=require('fs'), path=require('path'), cp=require('child_process');
const KAT=path.join(__dirname,'..');
const TMP=process.env.SCRATCH||require('os').tmpdir();
const zrodlo=f=>fs.readFileSync(path.join(KAT,f),'utf8').split('<script>\n')[1].split('</script>')[0];

let zle=0;
function sprawdz(w,opis){ if(w)console.log('  ok    '+opis);
  else {zle++;console.log('  BŁĄD  '+opis);} }

function klasy(){return{_h:new Set(),add(c){this._h.add(c);},remove(c){this._h.delete(c);},
  toggle(c,v){v?this._h.add(c):this._h.delete(c);},has(c){return this._h.has(c);}};}
function el(){return{innerHTML:'',textContent:'',value:'',className:'',dataset:{},style:{},disabled:false,
  classList:klasy(),addEventListener(){},click(){},focus(){},
  querySelectorAll(sel){
    if(sel!=='.opt')return[];
    if(this._html!==this.innerHTML){
      this._html=this.innerHTML;
      const ids=String(this.innerHTML).match(/data-id="[^"]+"/g)||[];
      this._opt=ids.map(a=>({dataset:{id:a.slice(9,-1)},classList:klasy(),onclick:null}));
    }
    return this._opt;
  }};}

/* Blob sklejający bajty — żeby dało się zapisać archiwum na dysk i sprawdzić. */
function swiat(){
  const cache={}, stan={bajty:null, nazwa:null};
  const doc={getElementById:id=>cache[id]||(cache[id]=el()),
    querySelectorAll:()=>[], querySelector:()=>el(),
    createElement:()=>({set href(v){}, set download(v){stan.nazwa=v;}, click(){}, href:''})};
  const win={document:doc, scrollTo(){},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}}};
  win.window=win;
  global.window=win; global.document=doc;
  global.localStorage=win.localStorage; global.sessionStorage=win.sessionStorage;
  global.Blob=class{constructor(cz){
    stan.bajty=Buffer.concat((cz||[]).map(x=>Buffer.from(
      x instanceof Uint8Array?x:Buffer.from(String(x),'utf8'))));
  }};
  global.URL={createObjectURL:()=>'blob:test',revokeObjectURL(){}};
  /* paczka.js sięga po URL i Blob przez obiekt globalny strony, nie przez
     globalny node'a — w przeglądarce to jedno i to samo. */
  win.URL=global.URL; win.Blob=global.Blob;
  try{ Object.defineProperty(global,'navigator',{value:{},configurable:true}); }catch(e){}
  delete require.cache[require.resolve(path.join(KAT,'paczka.js'))];
  require(path.join(KAT,'paczka.js'));
  /* W przeglądarce window JEST obiektem globalnym, więc strona woła po prostu
     Paczka.zip(...). W node to dwa różne obiekty — odwzorowujemy tamto. */
  global.Paczka=win.Paczka;
  return {cache, stan, E:id=>doc.getElementById(id)};
}

/*═══════════════ 1. Wspólny moduł ═══════════════*/
console.log('\nPakowanie — wspólny moduł');
let s=swiat();
const P=()=>global.window.Paczka;
sprawdz(['zip','wav','stempel','dl','IR'].every(k=>P()[k]),
  'paczka.js udostępnia oba programom to samo narzędzie');

/* WAV 32-bit float: nagłówek 44 bajty, format 3 (IEEE float), potem próbki. */
const w=P().wav(new Float32Array([0,1,-1,0.5]),48000);
sprawdz(w.length===44+4*4&&String.fromCharCode(w[0],w[1],w[2],w[3])==='RIFF'&&
  String.fromCharCode(w[8],w[9],w[10],w[11])==='WAVE'&&w[20]===3&&w[34]===32,
  'WAV ma poprawny nagłówek 32-bit float — czytają go REW, ARTA i Audacity');

/* Magazyn surowca bez IndexedDB ma milczeć, nie wybuchać. */
P().IR.wczytaj().then(r=>{
  sprawdz(r===null,'brak IndexedDB nie przewraca odczytu surowca');

  /*═══════════════ 2. Paczka z doboru ═══════════════*/
  console.log('\nPaczka wyniku z modułu doboru');
  const o=swiat();
  const api=new Function(zrodlo('dobor.html')+
    '\n;return {przyjmij:przyjmij,ST:ST,raportHTML:raportHTML};')();
  api.przyjmij({wersja:'silnik-v15',charakter_pomiaru:'pelny',Tmid:0.376,
    czas:'2026-09-21T10:00:00Z',
    pomieszczenie:{L:5.2,W:3.0,H:2.55,V:39.75,typ:'salon'},
    pasma:[125,250,500,1000,2000,4000].map((fc,i)=>
      ({fc,T_srednie:[0.45,0.41,0.38,0.37,0.34,0.32][i]}))});
  api.ST.cel=0.30; o.E('b2').onclick(); o.E('b3').onclick();
  o.E('bWynik').onclick();

  setTimeout(()=>{
    sprawdz(o.stan.bajty&&o.stan.bajty.length>0,'przycisk „Zapisz wynik" zbudował archiwum');
    sprawdz(/^wynik-salon-.*\.zip$/.test(o.stan.nazwa||''),
      'nazwa pliku niesie pomieszczenie, wariant i godzinę: '+o.stan.nazwa);

    const plik=path.join(TMP,'rt60-test-wynik.zip');
    fs.writeFileSync(plik, o.stan.bajty);

    /* Sprawdzenie NIEZALEŻNĄ implementacją — nasz ZIP musi otworzyć ktoś inny. */
    let lista=[];
    try{
      lista=JSON.parse(cp.execSync('python3 -c "'+
        'import zipfile,json,sys;'+
        'z=zipfile.ZipFile(sys.argv[1]);'+
        'print(json.dumps({n:len(z.read(n)) for n in z.namelist()}))'+
        '" '+JSON.stringify(plik),{encoding:'utf8'}));
    }catch(e){ lista=null; }
    sprawdz(lista!==null,'archiwum otwiera się niezależną implementacją (zipfile)');

    if(lista){
      const nazwy=Object.keys(lista);
      sprawdz(nazwy.indexOf('raport.html')>=0&&lista['raport.html']>2000,
        'w paczce jest raport do czytania, nie sama surówka');
      sprawdz(nazwy.indexOf('propozycja-adaptacji.json')>=0,'jest propozycja w postaci danych');
      sprawdz(nazwy.indexOf('badanie-akustyczne.json')>=0,
        'jest plik badania — da się wrócić i przeliczyć adaptację na nowo');
      sprawdz(nazwy.indexOf('czytaj-to.txt')>=0,'jest opis zawartości');
      /* Bez IndexedDB surowca nie ma — i paczka musi to powiedzieć wprost. */
      sprawdz(!nazwy.some(n=>/\.wav$/.test(n)),'bez magazynu surowca nie ma plików WAV');
      let opis='';
      try{ opis=cp.execSync('python3 -c "'+
        'import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read(\'czytaj-to.txt\').decode())'+
        '" '+JSON.stringify(plik),{encoding:'utf8'}); }catch(e){}
      sprawdz(opis.indexOf('NIE MA odpowiedzi impulsowych')>=0&&opis.indexOf('Zeby miec komplet')>=0,
        'opis mówi wprost, czego brakuje i jak zdobyć komplet');
    }

    /*── raport: dokument, nie zrzut danych ──*/
    const r=api.raportHTML();
    sprawdz(r.indexOf('<!DOCTYPE html>')===0&&r.indexOf('window.print()')>0,
      'raport jest samodzielną stroną z własnym przyciskiem zapisu do PDF');
    sprawdz(/Czas pogłosu <b>0,38 s<\/b> &rarr; <b>0,3\d s<\/b>/.test(r),
      'raport pokazuje obietnicę: ile jest teraz i ile będzie po adaptacji');
    sprawdz(r.indexOf('@media print')>0,'raport ma arkusz do druku');
    sprawdz(r.indexOf('OBLICZONY, nie zmierzony')<0&&r.indexOf('obliczony, nie zmierzony')>0,
      'raport mówi wprost, że czas po adaptacji jest obliczony, a nie zmierzony');

    /*═══════════════ 3. Zapis surowca z ekranu badania ═══════════════
      Ta droga zostaje dla kogoś, kto zmierzył i nie idzie do doboru: bo tylko
      sprawdzał, albo bo pomiar się nie udał i chce przysłać surowiec. */
    console.log('\nZapis surowca na ekranie badania');
    const m=swiat();
    const pom=new Function(zrodlo('index.html')+'\n;return {ST:ST};')();
    Object.assign(pom.ST,{L:5.2,W:3.0,H:2.55,V:39.75,type:'salon',src:'ext',
      fs:48000,set:{},bg:-60,pos:[{bands:{},D50:60,C50:2,mtis:[]}],
      irs:[new Float32Array(2400),new Float32Array(2400)],
      Tmid:0.376,midF:[500,1000],midQ:['dobry','dobry'],D50:60,pozny:0.5,
      avg:{125:.45,250:.41,500:.38,1000:.37,2000:.34,4000:.32}});
    m.E('bZapisz').onclick({preventDefault(){}});
    const plik2=path.join(TMP,'rt60-test-surowiec.zip');
    sprawdz(m.stan.bajty&&m.stan.bajty.length>0,'ekran badania nadal zapisuje paczkę z surowcem');
    if(m.stan.bajty){
      fs.writeFileSync(plik2,m.stan.bajty);
      let n2=null;
      try{ n2=JSON.parse(cp.execSync('python3 -c "'+
        'import zipfile,json,sys;print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))'+
        '" '+JSON.stringify(plik2),{encoding:'utf8'})); }catch(e){}
      sprawdz(n2&&n2.filter(x=>/\.wav$/.test(x)).length===2,
        'paczka z badania zawiera odpowiedzi impulsowe z każdego punktu');
      sprawdz(n2&&n2.indexOf('badanie-akustyczne.json')>=0&&n2.indexOf('czytaj-to.txt')>=0,
        'oraz wyniki i opis zawartości');
    }

    console.log(zle?'\n'+zle+' testów nie przeszło\n':'\nWszystkie testy przeszły\n');
    process.exit(zle?1:0);
  },50);
});
