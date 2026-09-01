# Model akustyczny — podstawy, progi i uzasadnienia

Dokument utrwala ustalenia, których nie widać w kodzie: **dlaczego** progi mają
takie wartości i skąd wzięły się liczby w module doboru paneli. Bez tego
kolejna osoba (albo my za pół roku) „uprości" walidację i wrócą błędy, które
już raz kosztowały tydzień.

Stan na sierpień 2026, silnik `v13`.

---

## Część 1. Silnik pomiarowy

### 1.1 Co zostało zweryfikowane

Rdzeń DSP przetestowano na sygnałach syntetycznych o **znanym** T60. Pełny
łańcuch sweep → nagranie → dekonwolucja → całka Schroedera → Lundeby odtwarza
zadaną wartość z błędem **poniżej 2 %** w zakresie 0,3–1,6 s. Fizyka i
matematyka są poprawne; wszystkie znalezione błędy leżały w warstwie walidacji
i raportowania.

### 1.2 Progi i ich uzasadnienie

| Stała | Wartość | Dlaczego akurat tyle |
|---|---|---|
| `SNR_AC_MIN` | 20 dB | Dolna granica sensowności pomiaru pasma. Poniżej — „brak pobudzenia". |
| `SNR_AC_GOOD` | 26 dB | Powyżej tej wartości wynik jest pełny, nie orientacyjny. |
| `SNR_SCALE` | 45 dB | Górny kraniec wskaźnika poziomu. Pasek rysuje się **z tych stałych**, nie z liczb wpisanych ręcznie — inaczej obraz rozjeżdża się z oceną (tak było do `v7`). |
| `XI_GOOD` / `XI_MAX` | 10 / 25 | Nieliniowość zaniku. Uwaga: kod liczy `1000·(1−r²)`, czyli mniej więcej **dwukrotność** parametru ξ z ISO 3382, który wynosi `1000·(1−r)`. |
| `PEAK_LOW_DBFS` | −40 | Ostrzeżenie o niskim poziomie bezwzględnym. |
| `PEAK_MIN_DBFS` | −50 | Blokada. Progi **nieskalibrowane terenowo**, celowo łagodne. |
| `POZNE_MIN` | 0,25 | Bramka metryk mowy — patrz 1.4. |
| `D50_MAX` | *usunięty* | Był błędny — patrz 1.4. |

### 1.3 Zakres dynamiki — pułapka całki Schroedera

`range` **nie może** być liczony jako `min()` krzywej Schroedera. Ogon całki
zbiega do energii pojedynczej próbki i zawyża zakres o kilkadziesiąt decybeli:
zmierzone 79 dB przy realnych 40 dB. Skutkiem było to, że progi ISO 3382
(35 dB dla T30, 25 dB dla T20) **nigdy nie działały**, a diagnoza „za mały
zakres" była nieosiągalna — każda odrzucona próbka dostawała etykietę „zanik
nieliniowy" niezależnie od przyczyny.

Poprawnie: `range = 10·log10(szczyt_obwiedni / podłoga_szumu)` wg Lundeby'ego.

Po poprawce pomiar 0,9 s przy SNR 25 dB poprawnie odmawia wyniku zamiast po
cichu podać zaniżone 0,80 s.

**Uwaga na przyszłość:** przy dekonwolucji sweepu `range` rutynowo wychodzi
70–100 dB, bo zysk przetwarzania spycha podłogę szumu daleko poniżej szumu
akustycznego. To jest poprawne, nie jest błędem — ale oznacza, że w praktyce
progi ISO rzadko są czynnikiem ograniczającym. Decyduje `xi`.

### 1.4 Bramka metryk mowy — dlaczego nie D50 > 85 %

Dla czystego zaniku wykładniczego udział energii z pierwszych 50 ms zależy
**wyłącznie** od czasu pogłosu:

```
D50_teoria(T) = 100 · (1 − 10^(−0,3/T))
```

Krzywa przecina 85 % dokładnie przy **T = 0,364 s**. Stały próg `D50 > 85 %`
był więc w przebraniu progiem na T — **każde poprawnie zmierzone wnętrze o
krótszym pogłosie traciło C50, D50 i STI bez powodu.** Im lepiej wytłumione
pomieszczenie, tym pewniejsza blokada.

Kryterium poprawne — udział pola późnego względem tego, co wynika z samego
zaniku:

```
udział = (100 − D50_zmierzone) / (100 − D50_teoria(T))
```

To w istocie stosunek pola bezpośredniego do pogłosowego, niezależny od T.

Kalibracja na sygnale syntetycznym:

| sytuacja | udział |
|---|---|
| czysty zanik pogłosowy, T = 0,25…1,6 s | 0,77 – 1,22 |
| przewaga dźwięku bezpośredniego 0 dB | 0,84 |
| +6 dB | 0,47 |
| +12 dB | 0,14 |
| +20 dB | 0,04 |

Próg **0,25** leży w luce między +6 a +12 dB, z ponad trzykrotnym zapasem od
najgorszego poprawnego pomiaru. Weryfikacja na dwóch pomiarach terenowych tego
samego pokoju: telefon **0,089** (blokuje), głośnik zewnętrzny **0,412**
(przepuszcza). Rozdzielenie 4,6-krotne.

### 1.5 Telefon kontra głośnik zewnętrzny

Sześć pomiarów terenowych salonu 5,2 × 3 × 2,5 m (V = 39 m³):

| | telefon | głośnik zewnętrzny |
|---|---|---|
| Tmid, średnia | 0,288 s | 0,376 s |
| powtarzalność | ±3,5 % | ±3 % |
| A_sabine | 22,05 m² Sab | 16,73 m² Sab |
| pasma z wynikiem | 3–4 z 7 | 6–7 z 7 |
| pasmo 500 Hz | **0 z 12 prób** | 5 z 6 |
| udział pola późnego | 0,09 | 0,41–0,49 |

**Telefon zaniża czas pogłosu o 20–30 %, czyli zawyża chłonność o jedną
trzecią.** Przyczyna jest konstrukcyjna: mikrofon i głośnik dzielą obudowę, do
mikrofonu dociera ok. 9 % pola pogłosowego. Nie da się tego obejść
oprogramowaniem.

Konsekwencja handlowa na tym konkretnym pokoju przy celu 0,30 s: telefon orzeka
„adaptacja niepotrzebna" (A = 22,05 wobec wymaganych 20,9), podczas gdy w
rzeczywistości brakuje ok. 5 m² paneli.

**Kontrola zewnętrzna:** Akulap firmy Dr. Jordan na tym samym telefonie w tym
samym pokoju podaje T20 = 0,04 s przy T30 = 0,22 s (krzywizna 450 % wobec kilku
procent dopuszczanych przez ISO 3382), D50 = 0 % razem z C50 = 0 dB (wzajemnie
sprzeczne) oraz STI = 1 (fizycznie niemożliwe) — i **raportuje to bez
ostrzeżenia**. Ta sama awaria u narzędzia profesjonalnego. Nasza przewaga nie
polega na dokładniejszym pomiarze, tylko na tym, że rozpoznajemy brak pomiaru i
mówimy o nim.

### 1.5.1 Czego wykrywanie Bluetootha nie potrafi

Opóźnienie toru mierzone z położenia szczytu splotu ma **stałe przesunięcie
300–400 ms zależne od urządzenia i przeglądarki** (telefon 342 i 435 ms,
Bluetooth 535 i 704 ms). Różnice są realne, wartości bezwzględne bezużyteczne.
Próg bezwzględny odpada.

Wykrywanie po zapasie przy 125 Hz **też odpada** — przy 80 Hz telefon nie
wypromieniuje dźwięku, ale obudowa drga i mikrofon odbiera to drogą
konstrukcyjną. Próba z `v6` dawała fałszywy alarm na samym telefonie i została
wycofana w `v7`.

Jeśli wykrywanie będzie potrzebne: **zwykłe pytanie do użytkownika** zadziała
bezbłędnie tam, gdzie obie heurystyki się przewracają.

---

## Część 2. Kontrakt danych

Eksport JSON (`silnik-v13`). Pola krytyczne dla modułu doboru:

```jsonc
{
  "charakter_pomiaru": "pogladowy" | "pelny",
  "nadaje_sie_do_doboru_adaptacji": false | true,   // false ⇒ NIE liczyć paneli
  "Tmid": 0.376,
  "Tmid_pasma": [500, 1000],                        // na ilu pasmach stoi
  "Tmid_jakosc": "orientacyjny" | "dobry",
  "A_sabine_m2": 16.73,                             // wejście do doboru
  "udzial_pola_poznego": 0.412,
  "zrozumialosc_wiarygodna": true,
  "pasma": [ { "fc": 500, "T_srednie": 0.416,
               "liczba_waznych_pozycji": 3,
               "pozycje": [ { "T": …, "estymator": "T30", "xi": …,
                              "zakres_dB": …, "snrAc_dB": …, "powod": null } ] } ]
}
```

**Zasady, których nie wolno złamać:**

1. `T` i `powód` muszą pochodzić z tego samego źródła. Do `v3` `T` brało się ze
   średniej, a `xi`/`powód` z pozycji 1 — plik potrafił podać czas pogłosu i
   zarazem twierdzić, że pomiar się nie udał.
2. Wartość niewiarygodna jest `null` **z podanym powodem**, nigdy liczbą. Do
   `v3` eksport zawierał `STI: 0.989` mimo że interfejs ją ukrywał.
3. Brak danych nie jest dowodem jakości. Rozrzut międzypunktowy przy jednym
   punkcie to `null`, nie `0` — inaczej pasmo bez porównania wygląda w tabeli na
   najlepiej zmierzone.
4. `charakter_pomiaru: "pogladowy"` **zabrania podania pojedynczej liczby**,
   nie zabrania doboru. Decyzja z września 2026: pomiar telefonem prowadzi do
   doboru, ale wyłącznie na **widełkach od–do** (6.1). Pole
   `nadaje_sie_do_doboru_adaptacji: false` czytamy więc jako „nie wolno podać
   jednej liczby", a nie „nie licz".

---

## Część 3. Moduł doboru paneli

### 3.1 Zakres

Dwa wykończenia tego samego zadania akustycznego, oba montowane **bezpośrednio
do ściany albo sufitu**:

| | konstrukcja | charakter pochłaniania |
|---|---|---|
| **tekstylne** | wełna mineralna w ramie z płyty drewnopochodnej, lico obszyte tkaniną transparentną | absorber porowaty — szeroko, rosnąco ku górze pasma |
| **drewniane NUO_WALL** | fornir perforowany laserowo w ramie aluminiowej, absorber na odwrocie | układ rezonansowy — wąsko, szczyt 500–1000 Hz |

Katalog perforacji i płyt (ALFA 60, VG, Purin) **nie wchodzi** do tego modelu —
to układy płytowo-rezonansowe z litym tyłem, o jeszcze innej charakterystyce,
i zostają do adaptacji opartych na operatach akustycznych.


### 3.2 Wzór

```
T_po(f) = 0,161 · V / ( A_zmierzone(f) + Σ S_panel · α_panel(f) )
gdzie    A_zmierzone(f) = 0,161 · V / T_zmierzone(f)
```

Siła metody: `A_zmierzone` zawiera **wszystko**, co jest w pomieszczeniu —
meble, zasłony, ludzi, dywan, o którym klient nie wspomniał. Model NAR
modeluje pusty prostopadłościan z tabelarycznymi α. Różnica między nimi to
zmierzona niewiedza, pasmo po paśmie.

### 3.3 Dwa kryteria, nie jedno

1. **Ilość** — powierzchnia potrzebna do osiągnięcia celu Tmid. Robi to każdy
   kalkulator.
2. **Równowaga tonalna** — ostrzeżenie, gdy propozycja przetłumia górę.
   **Tego nie robi nikt**, a wynika wprost z danych, które już mamy.

Miara: `T(250 Hz) / T(1 kHz)`. Wzrost oznacza wnętrze głuche w górze i dudniące
w dole — klasyczna porażka cienkich absorberów. Klient dostaje pomieszczenie
wytłumione zgodnie z obietnicą i mimo to ma poczucie, że coś jest nie tak.

### 3.4 Materiał — gęstość wymaga ponownego rozstrzygnięcia

Dotychczasowe zalecenie brzmiało **60 kg/m³** i było wynikiem minimaksowym:
panel cienki na ścianie chce wełny gęstszej, panel z pustką — rzadszej, a 60 to
punkt, w którym najgorszy przypadek jest najmniejszy. Do tego dochodził argument
sztywności: poniżej ~50 kg/m³ płyta ugina się trzymana za krawędź.

**Przejście na panel ramowy unieważnia obie przesłanki.** Wariantu z pustką nie
ma — wszystko idzie bezpośrednio na ścianę. Wełna nie jest już niczym trzymana:
leży w ramie z płyty drewnopochodnej, z litym tyłem, i nie musi nieść sama
siebie.

Zostaje więc czysta akustyka. Model Mikiego dla **100 mm bezpośrednio na
ścianie**, padanie rozproszone, tył sztywny (σ wg Biesa i Hansena):

| ρ [kg/m³] | 125 | 250 | 500 | 1 k | 2 k | 4 k | α(250)/α(1 k) |
|---|---|---|---|---|---|---|---|
| 20 | 0,32 | 0,62 | 0,87 | 0,95 | 0,91 | 0,93 | 0,66 |
| 30 | 0,40 | 0,71 | 0,90 | 0,92 | 0,92 | 0,93 | 0,77 |
| **40** | 0,47 | **0,73** | 0,87 | 0,89 | 0,92 | 0,92 | **0,83** |
| **45** | 0,48 | 0,72 | 0,84 | 0,88 | 0,91 | 0,92 | **0,83** |
| 50 | 0,49 | 0,70 | 0,81 | 0,86 | 0,91 | 0,92 | 0,81 |
| 60 | 0,49 | 0,67 | 0,77 | 0,85 | 0,90 | 0,92 | 0,79 |
| 80 | 0,44 | 0,58 | 0,70 | 0,80 | 0,87 | 0,91 | 0,72 |

Optimum przesuwa się do **40–45 kg/m³**: najwyższe pochłanianie przy 250 Hz
i najlepsza równowaga tonalna. 60 kg/m³ traci przy 250 Hz około 7 % i jest
gorsze w bilansie góra–dół. Kierunek jest jednoznaczny, ale **decyzja
zakupowa należy do ALACER-a** — dopóki nie zapadnie, kalkulator liczy z 45 kg/m³
(σ = 28 000 Pa·s/m²), bo na tej wartości stały dotychczasowe liczby.

**Warto odnotować:** 100 mm przylegające do ściany daje przy 250 Hz α 0,72,
czyli tyle samo co dawne 50 mm odsunięte o 50 mm pustki (0,70), a przy 125 Hz
nawet więcej (0,48 wobec 0,40). **Rezygnacja z dystansów nie kosztowała nic
akustycznie** — grubość załatwia to, co wcześniej załatwiała pustka, i bez
listew.

**Kandydat: ROCKWOOL ROCKTON PREMIUM.** Płyta 1000 × 610 mm, grubości 50/100/
150/200 mm, `AW 0,90` (50–99 mm) i `AW 1,00` (100–200 mm), `CS(10)0,5`,
λD = 0,033 W/mK, klasa A1.

Deklaracja `RW-CEE-DoP-0205/M/20/w1` potwierdza: **100 mm jest grubością
katalogową** (R_D 3,00 m²K/W, AW 1,00), więc wariant domyślny da się kupić
wprost z oferty.

> **Brak w karcie:** `AFr` (oporność przepływu) zadeklarowana jako **NPD**, oraz
> gęstość (EN 13162 jej nie wymaga). To są dwie liczby do zdobycia — i dopiero
> one pozwolą sprawdzić, czy ROCKTON w ogóle trafia w 40–45 kg/m³.


### 3.5 Model α(f) i jego granica

Do wyliczania α wariantów montażu, których producent nie zbadał, służy model
**Mikiego** (1990) z transformacją impedancji przez warstwę i pustkę, w padaniu
rozproszonym (wzór Parisa). Wejście: jeden parametr — oporność przepływu σ.
Implementacja: `docs/welna.py`.

**Model jest systematycznie zaniżony o 0,10–0,15 w skali AW**, najbardziej przy
250 Hz. Przyczyna: komora pogłosowa mierzy próbkę 10–12 m², której krawędzie
podnoszą wynik (dlatego α_s bywa > 1), a model liczy powierzchnię nieskończoną.

#### Sprawdzenie wobec deklaracji ROCKTON PREMIUM

Deklaracja właściwości użytkowych `RW-CEE-DoP-0205/M/20/w1` (10.02.2021) podaje
**wyłącznie AW** — 0,90 dla grubości 50–80 mm i **1,00 dla 100–200 mm** — i ani
jednej wartości pasmowej. To jedyny punkt styku między modelem a deklaracją,
więc `docs/welna.py` liczy AW wg ISO 11654 (przesuwana krzywa odniesienia),
żeby porównanie było wprost, a nie „na oko":

| wariant | ρ | AW z modelu | karta |
|---|---|---|---|
| 50 mm na ścianie | 30 / 45 / 60 | 0,60 / 0,70 / 0,75 | 0,90 |
| 50 mm + pustka 50 mm | 30 / 45 / 60 | 0,85 / **0,90** / 0,85 | 0,90 |
| 100 mm na ścianie | 30 / 45 / 60 | 0,90 / 0,90 / 0,85 | 1,00 |

Wnioski, oba istotne handlowo:

1. **Deklarowane `AW 0,90` dla 50 mm jest odtwarzalne tylko z pustką za wełną.**
   Przy montażu przylegającym model daje 0,60–0,75, czyli o 0,15–0,30 mniej.
   Karta niemal na pewno opisuje montaż z pustką (ISO 354 dopuszcza kilka),
   a nasz panel przylega do litego tyłu.
   **Nie wolno przypisywać wariantowi tekstylnemu 50 mm wartości `AW 0,90`
   z karty** — to nie jest ten sam układ.
2. **Dla 100 mm różnica wynosi 0,10** i mieści się dokładnie w znanym zaniżeniu
   modelu przez pominięcie krawędzi próbki. Tu karta i model są zgodne co do
   kierunku, a rachunek pozostaje ostrożny.

To jest kolejny, niezależny argument za tym, żeby **100 mm było wariantem
domyślnym** — i jedyny wariant, w którym deklaracja producenta wspiera nasze
liczby zamiast im przeczyć.

**Wniosek niezmieniony: kalkulatora nie wolno budować na modelu.** Potrzebna
jest **tabela α_p w pasmach oktawowych 250–4000 Hz** od Rockwoola wraz
z podaniem montażu. Rockwool ją ma — `AW` jest z niej wyliczone wg ISO 11654.
Wtedy α dla montaży zbadanych bierzemy wprost, a model służy tylko do reszty,
**skalibrowany na punktach zbadanych**.

> Czego deklaracja **nie** rozstrzyga: `AFr` (oporność przepływu) to `NPD`,
> gęstości EN 13162 nie wymaga i jej nie ma. Oba pytania z Części 4 zostają
> otwarte, a wybór gęstości z 3.4 nie ma się o co oprzeć poza modelem.

### 3.6 Panel — konstrukcja ramowa, pochłania samo lico

**Formatka 1000 × 610 mm — wymiar płyty wełny, zero odpadu przy cięciu.**
Wariant połówkowy 500 × 610 mm, jedno cięcie, również bez odpadu.

> Odrzucone: **600 × 600 mm**. Z płyty 1000 × 610 zostaje niewykorzystany pas
> 400 × 610 — **41 % odpadu**, czyli o 67 % więcej materiału na metr panelu.

Wełna siedzi w ramie z płyty drewnopochodnej, z litym tyłem; tkanina obszywa
**samo lico**. Boki i tył nie pochłaniają.

**Zapas z obszycia krawędzi (+26 % powierzchni) przestał istnieć** razem z tą
zmianą konstrukcji. Wcześniej był świadomym marginesem bezpieczeństwa —
obiecywaliśmy mniej, niż panel dawał. Trzeba wiedzieć, że go nie ma.

Margines nie zniknął jednak całkiem: **zaniżenie samego modelu Mikiego o
0,10–0,15 w skali AW** (3.5) jest wielokrotnie większe od utraconych krawędzi
i działa w tę samą, bezpieczną stronę.

> **Do odnotowania, drugiego rzędu:** panel z litym tyłem **zakrywa**
> powierzchnię, która sama coś pochłaniała. Rachunek dodaje `S · α_panel`, nie
> odejmując `S · α_ściany`. Dla tynku malowanego (α ≈ 0,02–0,05) to zawyżenie
> zysku o 2–5 %, czyli mniej niż zaniżenie modelu. Do policzenia dokładnie,
> gdy pojawi się tabela α_p od producenta.


### 3.7 Tkanina — specyfikacja zakupowa

Oporność przepływu tkaniny wpływa na wynik i **musi trafić do specyfikacji**:

| Rf [Pa·s/m] | rodzaj | zmiana α (500–2 k) |
|---|---|---|
| 0–100 | siatka, tkanina akustyczna | 0 do +0,5 % |
| 250 | gęstsza dekoracyjna | −0,2 % |
| 600 | meblowa | **−5,4 %** |
| 1500 | zbita lub powlekana | **−21,5 %** |

**Wymóg: Rf < 250 Pa·s/m, docelowo < 100.** Do ok. 250 tkanina jest obojętna, a
przy 100 nawet minimalnie pomaga w dole pasma. Powyżej 600 zaczyna kasować to,
za co klient płaci.

### 3.8 Orientacyjne ilości

**Do przeliczenia.** Tabela z poprzedniej wersji stała na wariantach „na
ścianie / na dystansach" i na panelu z doliczanymi krawędziami — obu tych
rzeczy już nie ma. Liczby z bieżącego modelu podaje sam kalkulator; osobnej
tabeli w dokumencie nie odtwarzam, żeby nie utrwalać drugiego, rozjeżdżającego
się źródła.

Punkt odniesienia z testu regresyjnego (salon 39,75 m³, Tmid 0,353 s, cel
0,30 s, rozmieszczenie na ścianach i suficie):

| wariant | powierzchnia | sztuk |
|---|---|---|
| tekstylny, wełna 100 mm, 1000 × 610 | 2,66 m² | 5 |
| tekstylny, wełna 50 mm, 1000 × 610 | 2,87 m² | 5 |
| NUO_WALL 950 × 950 | 2,28 m² | 3 |

NUO wypada powierzchniowo najoszczędniej, bo w pasmach mowy ma α ≈ 1,00.
To nie znaczy, że jest najlepszym wyborem — patrz 3.9.

### 3.9 NUO_WALL — co wiemy i czego nie

Fornir drewniany perforowany laserowo, w ramie aluminiowej, z absorberem na
odwrocie. System firmy **muto' GmbH** (Karlsruhe); ALACER jest tu odsprzedawcą,
nie wytwórcą — inaczej niż przy panelach tekstylnych.

**Formaty ram:** 950 × 950, 2480 × 950 i 2440 × 1220 mm. Profile 40 lub 80 mm.
Moduły są duże, więc liczba sztuk skacze skokowo — przy małym pomieszczeniu
sensowny jest właściwie tylko format 950 × 950.

**α — odczytane z wykresu w ulotce** (muto', NUO_WALL, 10.2021), z dokładnością
do kroku 0,05 wymaganego przez ISO 11654:

| | 125 | 250 | 500 | 1 k | 2 k | 4 k |
|---|---|---|---|---|---|---|
| α_p NUO_WALL | 0,10 | 0,60 | 1,00 | 1,00 | 0,75 | 0,45 |

To **odczyt z obrazka, nie tabela producenta** — dokładnie ta sama rezerwa co
przy modelu Mikiego, i tak samo do zastąpienia przed rozmową z klientem.

**Charakter: absorber wąskopasmowy.** Ulotka mówi wprost „particularly in
frequencies between 400 Hz and 1250 Hz" i wykres to potwierdza. Konsekwencje
handlowe, które trzeba umieć powiedzieć klientowi:

1. **Przy dudniącym dole NUO nie zastąpi wełny.** Przy 250 Hz daje 0,60 wobec
   0,72 wełny 100 mm, a przy 125 Hz 0,10 wobec 0,48 — pięciokrotnie mniej.
2. **Przy 4 kHz zostawia górę żywą** (0,45 wobec 0,92). To bywa **zaletą**:
   wełna potrafi wygłuszyć wnętrze na głucho, NUO nie.
3. Sprawdzenie równowagi tonalnej (3.3) wyłapuje jedno i drugie samo, bez
   osobnej reguły w kodzie.

**Czego brakuje — do zdobycia od muto':**

| | dlaczego to blokuje |
|---|---|
| tabela α_p w pasmach oktawowych | jak wyżej: dziś mamy odczyt z wykresu |
| **który absorber** — pianka melaminowa czy filc akustyczny | ulotka podaje jedną krzywą dla obu, a to dwa różne materiały |
| **która głębokość profilu** — 40 czy 80 mm | głębokość zmienia α układu rezonansowego, a krzywa jest jedna |
| ceny i terminy dostaw | bez nich nie ma zamówienia |
| klasa ogniowa | NUO to **B1 wg DIN 4102, i to z badania orientacyjnego**; wełna jest A1. W obiektach użyteczności publicznej potrafi to rozstrzygnąć wybór za klienta |


## Część 4. Otwarte

1. **Tabela α_p od Rockwoola** — blokuje wiarygodność kalkulatora. Bez niej
   liczby są ostrożnym oszacowaniem, nie deklaracją. Deklaracja właściwości
   użytkowych tego nie zastępuje: podaje samo AW, bez pasm i bez montażu
   (3.5). **Prosić trzeba o raport z badania ISO 354 wraz z opisem montażu.**
2. **Tabela α_p i dane techniczne NUO_WALL od muto'** — 3.9. Dziś α tego
   wykończenia pochodzi z odczytu wykresu w ulotce.
3. **Gęstość wełny do rozstrzygnięcia na nowo** — 3.4. Konstrukcja ramowa
   unieważniła argumenty za 60 kg/m³; model wskazuje 40–45.
4. **Gęstość i AFr wybranej wełny** — do zamknięcia modelu i do sprawdzenia,
   czy ROCKTON trafia w ten przedział.
5. **Ceny i terminy** obu wykończeń — bez nich nie ma zamówienia (6.3).
4. **Weryfikacja przyrządem odniesienia** — jeden pomiar równolegle z REW i
   UMIK-1. Wiemy, że 0,376 s jest lepiej ugruntowane niż 0,288, ale nie mamy
   dowodu, że jest prawdziwe.
5. **Drugie pomieszczenie** — różnica 32 % pochodzi z jednego salonu o krótkim
   pogłosie. Kierunek pewny, skala niekoniecznie.

---

## Część 5. Stan prac — przekazanie

Stan na 31 sierpnia 2026, po wdrożeniu bramki wiarygodności wejścia.

### 5.1 Co stoi gdzie

| gałąź | zawartość |
|---|---|
| `main` | **produkcja** — silnik pomiarowy `v15`, `dobor.html` w wersji `dobór v1` |
| `claude/rt60-model-akustyczny-5-4-xgg0qk` | gałąź robocza: `v15` + bramka wiarygodności + przekazanie pomiaru do doboru + dwa wykończenia (`dobór v3`) |

`main` nie jest ruszany. Wszystko idzie na gałąź roboczą i tam podlega
sprawdzeniu; przeniesienie na produkcję to osobna, świadoma decyzja.

**Zasada obowiązująca:** `dobor.html` powstał jako **osobny plik**, żeby
rozbudowa nie mogła zepsuć działającego pomiaru. Zmiany w `index.html`
ograniczają się do zakończenia badania — rdzeń DSP pozostaje nietknięty.

### 5.2 Co działa

Silnik pomiarowy `v15` — rdzeń zweryfikowany na dziewięciu pomiarach terenowych,
w tym `silnik-v13` z 31.08 (salon 39,75 m³, głośnik zewnętrzny, Tmid 0,353 s,
udział pola późnego 0,513, wszystkie siedem pasm z wynikiem). Kończy się
działaniem zależnym od jakości pomiaru (6.1), nie samym zapisem pliku.

Moduł doboru `dobór v3` — przejmuje pomiar wprost z badania albo z wczytanego
pliku, sprawdza wiarygodność wejścia (5.3), liczy powierzchnię i liczbę paneli
w wybranym wykończeniu i formacie, przełącza Sabine/Eyring, sprawdza równowagę
tonalną, podaje widełki przy pomiarze poglądowym.

Test regresyjny `npm test` — 24 przypadki na kodzie obu stron, uruchamianym na
atrapie DOM.

### 5.3 Bramka wiarygodności wejścia — wdrożona

Luka, którą zamyka: moduł liczył z każdego pliku, który dało się sparsować.
Plik z `silnik-v2` (sprzed naprawy zakresu dynamiki, 1.3) zawierał `T` = 0,224 s
przy 250 Hz i 2,001 s przy 1 kHz — dziewięciokrotny skok, w jednym
pomieszczeniu fizycznie niemożliwy. `Tmid` wyszło 1,251 s, a kalkulator
policzył z tego **38 paneli i nie zgłosił niczego**. Rachunek był poprawny;
wejście nie.

Trzy kontrole, w `dobor.html`, funkcja `kontrolaWejscia()`:

| kontrola | próg | skutek |
|---|---|---|
| wersja silnika | `silnik-v1…v3` | **blokada** — brak działających progów ISO, plik może podawać czasy, których nikt nie zmierzył |
| rozrzut międzypasmowy 250–4000 Hz | krotność > **3** | **blokada** |
| rozjazd pasm mowy 500 Hz / 1 kHz | krotność > **2** | **blokada** |

Blokada jest **twarda i bez obejścia**: podgląd wejścia i przycisk „Dalej" się
nie pokazują. Narzędzie sprzedażowe, które przepuszcza taki plik „z
ostrzeżeniem", i tak pokaże klientowi liczbę — a liczba zostaje w głowie
dłużej niż ostrzeżenie.

**Decyzje przy wdrożeniu, warte zapamiętania:**

1. **125 Hz jest poza kontrolą rozrzutu.** W małym pomieszczeniu dół pasma
   rządzi się modami i potrafi odstawać kilkakrotnie bez żadnego błędu
   pomiaru. Wciągnięty do rozrzutu dawał fałszywe alarmy na poprawnych
   plikach.
2. **Kontrola idzie przed uzupełnieniem braków wartością `Tmid`.** Pasma
   uzupełnione mają z definicji rozrzut zerowy i przykryłyby każdy rozjazd.
   Sprawdzane są wyłącznie pasma faktycznie zmierzone.
3. **Rozjazd pasm mowy ma ostrzejszy próg niż całe pasmo**, bo 500 Hz i 1 kHz
   wchodzą wprost do `Tmid`, czyli do powierzchni paneli — bez uśrednienia
   z resztą.
4. **Za mało pasm to nie to samo co zgodność.** Gdy w 250–4000 Hz wiarygodny
   wynik dało jedno pasmo albo żadne, rozrzutu nie ma z czym porównać —
   moduł przepuszcza plik, ale mówi wprost, że propozycja stoi na jednym
   odczycie. To ta sama zasada co reguła 3 kontraktu danych: brak danych nie
   jest dowodem jakości.
5. **Brak pola `wersja` nie blokuje**, tylko ostrzega — kontrole liczbowe
   działają niezależnie od tego, czym plik został zrobiony.
6. Ślad kontroli idzie do eksportu (`kontrola_wejscia`: progi, zmierzone
   krotności, uwagi). Propozycja bez tego pola pochodzi z `dobór v1` i nie
   wiadomo, na czym stała.

**Sprawdzone** (harness na atrapie DOM, uruchamia kod strony, nie kopię):
plik z 31.08 przechodzi z rozrzutem **1,27**; rozrzut 1,4 i 2,9 przechodzą;
125 Hz odstające 4× nie wywołuje alarmu; wszystkie trzy złe wersje silnika
blokują, `silnik-v4` nie; realny plik z v2 zostaje odrzucony z krotnością
**8,9**; odrzucenie po wcześniejszym pliku poprawnym chowa podgląd i „Dalej".

### 5.4 Kolejność dalszych prac

1. **Tabele α_p — od Rockwoola i od muto'** — bez nich obie kolumny liczb są
   oszacowaniem z modelu i z odczytu wykresu.
2. **Rozstrzygnięcie gęstości wełny** — 3.4, decyzja zakupowa.
3. **Karta pomieszczenia** jako format narastający — 6.2, zanim dojdzie pomiar
   kontrolny, bo później kosztuje przerobienie danych.
4. **Pomiar kontrolny „przed / po"** — domknięcie pętli z 6.2.
5. **Formularz kontaktowy i zamówienie** — 6.3; wymaga funkcji serwerowej
   i przygotowania RODO.
6. **Rozrysowanie rozmieszczenia** paneli na ścianach i suficie — ze wskazaniem,
   że to wskazówka montażowa, a nie rachunek: model Sabine'a nie rozróżnia,
   na której powierzchni leży chłonność.

Decyzja podjęta i obowiązująca: przy pomiarze poglądowym **widełki od–do**,
nie pojedyncza liczba i nie blokada.

---

## Część 6. Kształt produktu — decyzje

Ustalenia z rozmowy z 1 września 2026. Zapisane tutaj, bo wyznaczają, co wolno
programowi robić — i tego nie widać w kodzie.

### 6.1 Pomiar prowadzi do doboru, także z telefonu

Pomiar nie kończy się zapisem pliku. Zapis to archiwizacja, nie działanie;
klient nie chce pliku, chce wiedzieć, co zrobić.

Zakończenie **niesie jakość pomiaru**, zamiast jednego przycisku dla wszystkich:

| co zmierzono | działanie główne |
|---|---|
| pomiar pełny | „Dobierz panele" — konkretna liczba |
| telefon | „Dobierz panele" — **widełki od–do**, obok równorzędne „Powtórz z głośnikiem zewnętrznym" |
| pomiar nieudany | dobór niedostępny — nie ma z czego liczyć |

Decyzja co do telefonu zapadła świadomie: **prowadzi do doboru, ale nigdy do
pojedynczej liczby.** Uzasadnienie w 1.5 — telefon zawyża chłonność o jedną
trzecią i potrafi orzec „adaptacja niepotrzebna" tam, gdzie brakuje 5 m² paneli.

### 6.2 Docelowo pętla, nie linia

```
zmierz → zdiagnozuj → dobierz → zamontuj → zmierz ponownie → pokaż, że zadziałało
```

Ostatni krok jest tym, czego nie robi nikt. Kalkulator akustyczny ma każdy;
dowód, że obietnica się spełniła, nie ma nikt. Ten sam program, który policzył
panele, potrafi zmierzyć wynik po montażu i powiedzieć: cel osiągnięty albo
brakuje jeszcze czterech.

Konsekwencja projektowa: **karta pomieszczenia zamiast luźnych plików.** Paczka
z `v15` (JSON + odpowiedzi impulsowe) jest jej zalążkiem; ma narastać —
pomiar → dobór → montaż → pomiar kontrolny. Doklejanie tego później będzie
kosztować przerobienie formatu danych, więc format projektujemy jako narastający
od początku.

### 6.3 Formularz kontaktowy i zamówienie

Mają być w programie. To jedyna część, która **wymaga funkcji serwerowej** —
dziś projekt jest w całości statyczny — i jedyna, która wyprowadza dane poza
przeglądarkę. Dwie rzeczy wynikają z tego wprost:

1. Obietnica „nic nie jest nigdzie wysyłane" przestaje być prawdziwa bez
   zastrzeżenia. Musi zabrzmieć: **wyniki pomiaru zostają w przeglądarce;
   wychodzi tylko to, co świadomie wysyłasz w zamówieniu.**
2. Dane osobowe w zamówieniu to administrator, obowiązek informacyjny i zgoda
   (RODO). To nie jest opcjonalne i trzeba to przygotować **zanim** formularz
   ruszy.

Do rozstrzygnięcia: czy „zamówienie" znaczy **zapytanie ofertowe** (bez cen,
odpowiedź handlowca), czy **sprzedaż z ceną i płatnością**. Różnica przechodzi
przez cały moduł: bez cennika obu wykończeń drugi wariant nie jest możliwy.
