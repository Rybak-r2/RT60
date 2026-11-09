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

### 1.6 Zapas nad tłem a zakres dynamiki — skąd zysk sweepu

Pytanie wraca regularnie: instrukcja każe ustawić głośnik na trzy czwarte
skali, a wskaźnik uznaje za wystarczający sygnał wyraźnie cichszy. Wygląda to
na rozjazd założeń. Nie jest nim — to dwie różne wielkości.

**Zapas nad tłem** (`snrAc`) to stosunek energii nagrania do energii tła
w paśmie, liczony na SUROWYM nagraniu. Progi wskaźnika: `SNR_AC_MIN = 20 dB`
(„wystarczy"), `SNR_AC_GOOD = 26 dB` („dobrze").

**Zakres dynamiki zaniku** (`range`) to zapas szczytu obwiedni nad podłogą
szumu wyznaczoną metodą Lundeby'ego, liczony na odpowiedzi impulsowej PO
DEKONWOLUCJI. To na nim stoją progi ISO 3382: 35 dB dla T30, 25 dB dla T20.

Te dwie liczby dzieli **zysk przetwarzania sweepu**. Sweep rozkłada energię
na 1,5 sekundy i całe pasmo; dekonwolucja filtrem odwrotnym ściska ją z powrotem
w impuls, a szum — nieskorelowany ze sweepem — zostaje rozmazany. Zysk rośnie
z iloczynem szerokości pasma i czasu, więc jest tym większy, im wyższe pasmo
i im dłuższy sweep.

Zmierzone prawdziwym kodem silnika, na pokoju wzorcowym o znanym
T60 = 0,600 s (`docs/test-poziom.js`):

| zapas nad tłem, 1 kHz | zakres zaniku | wynik | odtworzone T |
|---|---|---|---|
| 15,2 dB | 49,8 dB | **pasmo odrzucone** | — |
| 23,1 dB | 57,8 dB | T30 | 0,590 s |
| 26,1 dB | 60,5 dB | T30 | 0,604 s |

Wnioski są trzy i warto je mieć zapisane.

**Cichy sygnał naprawdę wystarcza.** Przy 23 dB zapasu zakres zaniku wynosi
58 dB — próg ISO dla T30 przekroczony o 23 dB. Wskaźnik nie kłamie; po prostu
nie pokazuje, skąd bierze się margines.

**Próg 20 dB jest konserwatywny, nie liberalny.** Przy 15 dB program odrzuca
pasmo, choć zakres zaniku wyniósłby 50 dB, czyli aż nadto. Odrzuca celowo:
w teście tło jest BIAŁE, a realny hałas siedzi nisko i nie jest stały, więc
125 i 250 Hz wypadają w praktyce gorzej, niż pokazuje tabela. Test dowodzi
mechanizmu, nie tego, że każdy cichy pomiar jest dobry.

**Dlatego istnieje drugi próg, bezwzględny.** `PEAK_MIN_DBFS = −50` i
`PEAK_LOW_DBFS = −40` pilnują poziomu nagrania, a nie stosunku. Sam zapas
w bardzo cichym pokoju osiąga próg nawet przy sygnale ledwie słyszalnym —
i taki pomiar przewróci się od pierwszego trzaśnięcia drzwiami.

**Co z tego wynika dla treści.** Pozycja pokrętła nie mówi nic o poziomie
w pomieszczeniu — rozstrzyga pasek. „Trzy czwarte skali" jest punktem startu,
żeby pierwsze sprawdzenie nie wypadło absurdalnie, i tak jest teraz napisane.
Osobno rozdzielone zostały dwa warunki w komunikacie końcowym: „Poziom
prawidłowy, nie zmieniaj już głośności" należy się dopiero wtedy, gdy
spełnione są OBA — zapas i poziom bezwzględny. Wcześniej program przy cichym
sygnale mówił naraz „nie zmieniaj głośności" i „podgłośnienie da pewniejszy
pomiar", czyli dwa przeciwne polecenia w jednym zdaniu.

Progi zostają bez zmian. Komentarz przy nich mówi, że czekają na kalibrację
na realnych urządzeniach, a pomiar pokazał, że są raczej za ostre niż za
luźne — zmienianie ich bez danych z terenu byłoby zgadywaniem.

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

#### Sam wzrost nie wystarczy — poprawka kryterium

Do tej wersji ostrzeżenie wypadało, gdy stosunek rósł o 0,05 lub więcej.
To jest błędne w pomieszczeniach, w których **dół jest już przytłumiony mocniej
niż góra**. Przykład z testu: stosunek wyjściowy 0,65, panele podnoszą go
w stronę 1,0 — czyli **poprawiają** równowagę, a kryterium oparte na samej
różnicy krzyczało „przetłumione".

Warunek poprawny wymaga **obu** rzeczy naraz:

```
adaptacja psuje równowagę  ⟺  (T_po(250)/T_po(1k) − T_przed(250)/T_przed(1k) ≥ 0,05)
                               ∧  (T_po(250)/T_po(1k) > 1,05)
```

Czyli: stosunek rośnie **i** ląduje powyżej neutralnego 1,0 z zapasem progu.
Ruch w stronę 1,0 nigdy nie jest usterką, niezależnie od tego, z której strony
następuje.

#### Kryterium wskazuje wersję panelu

To samo sprawdzenie steruje **rekomendacją wersji** (6.5). Program liczy
równowagę po adaptacji osobno dla wersji Standard i Premium i wskazuje tę,
której to pomieszczenie potrzebuje — łącznie z przypadkiem, gdy wystarcza
tańsza. Werdykt i rekomendacja muszą stać na jednym progu, inaczej program
potrafiłby zalecić wersję, którą sam za chwilę oceni jako niewystarczającą.

### 3.4 Materiał — wełna kupowana na przedział, nie na liczbę

Wcześniejsze zalecenie brzmiało **60 kg/m³** i było wynikiem minimaksowym:
panel cienki na ścianie chce wełny gęstszej, panel z pustką — rzadszej.
Do tego dochodził argument sztywności: poniżej ~50 kg/m³ płyta ugina się
trzymana za krawędź.

**Przejście na panel ramowy unieważniło obie przesłanki.** Wariantu z pustką
nie ma — wszystko idzie bezpośrednio na ścianę. Wełna nie jest niczym trzymana:
leży w ramie z płyty drewnopochodnej, z litym tyłem, i nie musi nieść sama
siebie.

**Decyzja obowiązująca: wełna deklarowana przedziałem 40–60 kg/m³** — tak samo,
jak opisują ją operaty akustyczne, i tak samo jest zamawiana.

Konsekwencja rachunkowa jest ważniejsza, niż wygląda. Skoro materiał jest
kupowany na przedział, to **do rachunku wchodzi α najmniejsza z tego przedziału,
pasmo po paśmie** — nie środek i nie wartość nominalna. Inaczej obietnica
trzymałaby się tylko przy szczęśliwej dostawie.

Model Mikiego dla montażu przylegającego, tył sztywny, padanie rozproszone
(`docs/welna.py`, funkcja `krzywa_zakresu`):

| wariant | 125 | 250 | 500 | 1 k | 2 k | 4 k | AW |
|---|---|---|---|---|---|---|---|
| wełna 100 mm | 0,47 | 0,67 | 0,77 | 0,85 | 0,90 | 0,92 | 0,85 |
| wełna 50 mm | 0,14 | 0,36 | 0,67 | 0,88 | 0,89 | 0,92 | 0,65 |

Najgorszy przypadek nie leży przy jednej gęstości: dla 100 mm w paśmie mowy
wypada przy 60 kg/m³, a przy 125 Hz przy 40 kg/m³. Dlatego minimum liczy się
**osobno w każdym paśmie**, a nie przez wybór jednej „najgorszej" gęstości.

**Warto odnotować:** 100 mm przylegające do ściany daje przy 250 Hz α 0,67,
czyli praktycznie tyle samo co dawne 50 mm odsunięte o 50 mm pustki (0,70),
a przy 125 Hz wyraźnie więcej (0,47 wobec 0,40). **Rezygnacja z dystansów nie
kosztowała nic akustycznie** — grubość załatwia to, co załatwiała pustka,
i bez listew.

**Materiał:** wełna mineralna docinana do 1028 × 608 mm (lico panelu
pojedynczego) z płyty 1000 × 610 mm, grubości 50 i 100 mm,
klasa reakcji na ogień **A1**, λD = 0,033 W/mK, `CS(10)0,5`. Deklaracja
właściwości użytkowych wybranego wyrobu potwierdza `AW 0,90` dla 50–80 mm
i **`AW 1,00` dla 100–200 mm**, więc wariant domyślny jest grubością
katalogową i da się go kupić wprost z oferty.

> **Czego deklaracja nie podaje:** `AFr` (oporność przepływu) jest `NPD`,
> a gęstości EN 13162 nie wymaga. Przedział 40–60 kg/m³ jest więc założeniem
> zakupowym, nie wartością odczytaną z karty — i tak jest traktowany
> w rachunku.

### 3.5 Model α(f) i jego granica

Do wyliczania α wariantów montażu, których producent nie zbadał, służy model
**Mikiego** (1990) z transformacją impedancji przez warstwę i pustkę, w padaniu
rozproszonym (wzór Parisa). Wejście: jeden parametr — oporność przepływu σ.
Implementacja: `docs/welna.py`.

**Model jest systematycznie zaniżony o 0,10–0,15 w skali AW**, najbardziej przy
250 Hz. Przyczyna: komora pogłosowa mierzy próbkę 10–12 m², której krawędzie
podnoszą wynik (dlatego α_s bywa > 1), a model liczy powierzchnię nieskończoną.

#### Sprawdzenie wobec deklaracji producenta wełny

Deklaracja właściwości użytkowych wybranej wełny podaje **wyłącznie AW** —
0,90 dla grubości 50–80 mm i **1,00 dla 100–200 mm** — i ani jednej wartości
pasmowej. To jedyny punkt styku między modelem a deklaracją,
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
jest **tabela α_p w pasmach oktawowych 250–4000 Hz** od producenta wełny wraz
z podaniem montażu. Producent ją ma — `AW` jest z niej wyliczone wg ISO 11654.
Wtedy α dla montaży zbadanych bierzemy wprost, a model służy tylko do reszty,
**skalibrowany na punktach zbadanych**.

> Czego deklaracja **nie** rozstrzyga: `AFr` (oporność przepływu) to `NPD`,
> gęstości EN 13162 nie wymaga i jej nie ma. Dlatego 3.4 przyjmuje przedział
> 40–60 kg/m³ jako założenie zakupowe i liczy najgorszym przypadkiem z niego.

### 3.6 Panel — ramka MDF, dwa kartony, dwa różne pola

Wełna siedzi w **ramce ze sklejki albo MDF, 16 mm**; tkanina obszywa lico.
Wymiar zewnętrzny panelu jest więc o 32 mm większy od wełny w obu osiach.

**Tyłu nie ma.** Wełna przylega od frontu do tkaniny, a od tyłu wprost do
ściany. Dla rachunku nic to nie zmienia — model Mikiego i tak liczy warstwę
porowatą na podłożu sztywnym, a ścianą jest teraz dosłownie ściana, nie płyta
zamykająca ramkę. Zmienia natomiast masę panelu i to, co wolno napisać
o reakcji na ogień: palnego materiału jest w panelu tyle, ile go jest
w ramce.

**Liczymy w sztukach.** Przy panelu dzielonym jedna sztuka to **komplet**
dwóch paneli z jednej płyty — i tak trzeba to nazywać, bo klient musi wiedzieć,
ile paneli faktycznie dostanie: od tego zależy, co da się ułożyć na ścianie.

| sztuka | zawartość | wełna czynna | pole czynne | pole zewnętrzne |
|---|---|---|---|---|
| **panel pojedynczy** | 1060 × 640 | 1028 × 608 | 0,625 m² | 0,678 m² |
| **komplet dzielony** | 640 × 640 | 608 × 608 | 0,370 m² | 0,410 m² |
| | 640 × 420 | 608 × 388 | 0,236 m² | 0,269 m² |
| | **razem komplet** | | **0,606 m²** | **0,678 m²** |

Komplet powstaje z przecięcia płyty wzdłuż na 610 i 390 mm, a służy
**architekturze**: dwa formaty pozwalają układać na ścianie i suficie mozaikę,
zamiast rytmu opartego na jednym prostokącie.

**Panel pojedynczy ma 1060 mm, nie 1030 mm.** Wcześniejsza wersja miała
1030 mm i to tworzyło niewidoczny na pierwszy rzut oka problem montażowy:
komplet ustawiony jeden kawałek pod drugim ma długość 640 + 420 = 1060 mm,
czyli o 30 mm więcej niż miał wtedy panel pojedynczy. Przy łączeniu obu
formatów na jednej ścianie (rząd obok kolumny) krawędzie się rozjeżdżały —
nie o błąd rachunku, tylko o realną, fizyczną różnicę wynikającą z tego, że
komplet to dwa oddzielnie oprawione kawałki, każdy z własną ramką na styku,
podczas gdy panel pojedynczy miał tam ciągłą wełnę bez przerwy. Wydłużenie
panelu do 1060 mm (z liciem rosnącym razem z ramą, do 1028 × 608 mm) usuwa
tę niezgodność: **pole zewnętrzne obu formatów jest teraz identyczne, 0,678 m²
każdy** — 640 + 420 mm faktycznie zestawia się w linii z 1060 mm.

Do wyboru jest jeszcze **zestaw mieszany** — sztuki po połowie jednego
i drugiego rodzaju, przy nieparzystej liczbie z nadwyżką po stronie panelu
pojedynczego. Pole zewnętrzne obu formatów jest identyczne, więc przeplatanka
**nie zmienia zapotrzebowania na ścianę**. Pole czynne różni się o ok. 3 %
(patrz niżej), więc też **nie zmienia w praktyce liczby sztuk potrzebnych do
celu** — średnia z obu jest bliska każdemu z osobna.

**Formaty rozeszły się między wykończeniami (listopad 2026).** Przez pewien
czas oba wykończenia dzieliły tę samą tablicę formatów — świadomie, żeby dało
się mieszać tekstylia z NUO na jednej ścianie. Ze względów technologicznych
NUO przeszedł na 1000 × 500 mm i tej możliwości już nie ma: 1060 × 640 nie
zestawi się w linii z 1000 × 500. Szczegóły formatów NUO w 3.9.

Co z tamtej decyzji zostaje: **oba wykończenia liczą się z lica.** Panele
drewniane miały wcześniej pole czynne równe zewnętrznemu, bo ich α pochodziło
z badania komorowego gotowego panelu w dużych ramach producenta (2440 × 1220),
gdzie rama zajmowała ułamek powierzchni. Przy naszych formatach rama to już
8–17 % i tamto założenie obiecywałoby więcej, niż panel daje.

**Akustycznie obie sztuki są w przybliżeniu takie same — 0,625 wobec
0,606 m², różnica ok. 3 %.** Panel pojedynczy jest teraz nieco większy (żeby
zejść się z kompletem na ścianie), więc pochłania odrobinę więcej wełny —
to jest realna, choć drobna różnica, nie tylko inny zapis tej samej rzeczy.
Trzy procent to dużo mniej niż niepewność samego pomiaru telefonem (20–30 %,
patrz 1.5), więc dla klienta wybór formatu **wciąż jest przede wszystkim**
decyzją o wyglądzie ściany, a nie o pochłanianiu — tylko już nie dosłownie
co do metra.

#### Dwa różne pola, i mylenie ich było błędem

To jest poprawka, którą wymusiła ramka:

- **Pole czynne** — powierzchnia, do której stosuje się α. To sama wełna;
  ramka nie pochłania.
- **Pole zewnętrzne** — tyle miejsca panel faktycznie zajmuje na ścianie.

Sprawdzenie „czy panele się zmieszczą" musi iść z pola **zewnętrznego**.
Do tej wersji szło z czynnego, przez co **zaniżało zapotrzebowanie na miejsce
o 8 % przy panelu dużym i o 13 % przy małym**.

**Zapas z obszycia krawędzi (+26 % powierzchni) przestał istnieć** wraz
z przejściem na konstrukcję ramową. Wcześniej był świadomym marginesem —
obiecywaliśmy mniej, niż panel dawał. Trzeba wiedzieć, że go nie ma.

Margines nie zniknął całkiem: **zaniżenie samego modelu Mikiego o 0,10–0,15
w skali AW** (3.5), wzmocnione liczeniem najgorszej gęstości z przedziału
(3.4), jest wielokrotnie większe od utraconych krawędzi i działa w tę samą,
bezpieczną stronę.

> **Do odnotowania, drugiego rzędu:** panel **zakrywa** powierzchnię, która
> sama coś pochłaniała — i zakrywa ją całym polem zewnętrznym, razem z ramką.
> Rachunek dodaje `S_czynne · α_panel`, nie
> odejmując `S_zewn · α_ściany`. Dla tynku malowanego (α ≈ 0,02–0,05) to
> zawyżenie zysku o 2–5 %, czyli mniej niż zaniżenie modelu.

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
| tekstylny, wełna 100 mm, 1060 × 640 | 2,66 m² | 5 |
| tekstylny, wełna 50 mm, 1060 × 640 | 2,87 m² | 5 |
| NUO_WALL 100 mm, 1000 × 500 | 2,57 m² | 6 |
| NUO_WALL 50 mm, 1000 × 500 | 2,60 m² | 6 |

NUO wypada powierzchniowo niewiele oszczędniej od tekstyliów, ale **sztuk
potrzeba więcej**, bo panel jest mniejszy. To nie znaczy, że jest gorszym
wyborem — o tym, kiedy jest lepszy, mówi 3.9.

### 3.9 NUO_WALL — α liczone z geometrii, nie pożyczone

Fornir drewniany mikroperforowany laserowo, naciągnięty na ramiak, z wełną
mineralną w stalowej obudowie. System firmy **muto' GmbH** (Karlsruhe); ALACER
jest tu odsprzedawcą, nie wytwórcą — inaczej niż przy panelach tekstylnych.

#### Konstrukcja

| element | wymiar |
|---|---|
| fornir z podklejoną fizeliną, przewiercone razem na wylot | 0,8 mm |
| mikroperforacja | otwór **0,5 mm**, raster **3 mm** w obu osiach |
| stopień perforacji | **2,18 %** |
| ramiak ze sklejki topolowej | 30 × 18 mm — **18 mm widać**, 30 mm wchodzi w obudowę |
| obudowa stalowa | 70 mm przy wełnie 50 mm, 120 mm przy wełnie 100 mm |

Fizelina stabilizuje fornir przy naciąganiu; jest przewiercona razem z nim,
więc nie jest warstwą oporową — kanał otworu ma 0,8 mm na całej długości.

**Wełna dociska do spodu forniru i pustki między nimi nie ma.** Wynika to
z wymiarów: ramiak wchodzi w obudowę na 30 mm, a 30 + 50 = 80 wobec 70 i
30 + 100 = 130 wobec 120 — w obu wariantach 10 mm nadmiaru. Zgodność w obu
grubościach nie wygląda na przypadek.

#### Formaty — dwie opcje zakupu

| sztuka | zewnętrzny | lico czynne | pole czynne | pole zajmowane |
|---|---|---|---|---|
| panel duży | 1000 × 500 | 964 × 464 | 0,4473 m² | 0,5000 m² |
| komplet: | 500 × 500 | 464 × 464 | 0,2153 m² | |
| | 2 × 500 × 250 | 464 × 214 | 2 × 0,0993 m² | |
| | **razem** | | **0,4139 m²** | **0,5000 m²** |
| zestaw mieszany | po połowie | | 0,4306 m² | 0,5000 m² |

Trzy kawałki kompletu składają się z powrotem **dokładnie** w panel duży:
500 + 250 + 250 = 1000 mm, wszystkie 500 mm wysokie, pole zewnętrzne
identyczne. Wariant dwuczęściowy (500 × 500 + 500 × 250) dawałby 0,375 m²
i 750 mm — czyli ten sam rozjazd krawędzi, który w panelach tekstylnych
kosztował zmianę 1030 → 1060 mm.

**Różnica wobec tekstyliów, którą trzeba znać:** tam komplet tracił 3 % pola
czynnego i wybór formatu był praktycznie decyzją o wyglądzie. Tutaj komplet
to **trzy ramiaki zamiast jednego**, więc traci **7,5 %** — i po raz pierwszy
w tym produkcie wybór formatu realnie zmienia liczbę sztuk.

#### α — model Maa, nie ulotka

Do listopada 2026 stała tu krzywa odczytana z ulotki muto' (1,00 przy 500
i 1000 Hz), a wariant 100 mm był szacunkiem przeskalowanym z niej modelem.
**Obie wartości zostały zastąpione rachunkiem z własnej geometrii panelu.**

Powód jest zasadniczy: ulotka opisuje panel muto' z **ich** absorberem —
pianką melaminową albo filcem, nigdy nam tego nie powiedziano — a my
wypełniamy wełną mineralną. To był inny wyrób, a nie ta sama rzecz
z niepewnym pomiarem.

| wariant | 125 | 250 | 500 | 1 k | 2 k | 4 k |
|---|---|---|---|---|---|---|
| ulotka muto' (do 11.2026) | 0,10 | 0,60 | 1,00 | 1,00 | 0,75 | 0,45 |
| **standard, wełna 50 mm** | 0,17 | 0,46 | **0,85** | **0,91** | 0,73 | 0,37 |
| **premium, wełna 100 mm** | 0,51 | 0,71 | **0,85** | **0,93** | 0,73 | 0,38 |

Źródło liczb: `docs/welna.py`, funkcja `nuo_zakresu()` — uruchamialne.

**Dlaczego teoria Maa.** Zwykły panel perforowany (otwory kilkumilimetrowe)
to szereg rezonatorów Helmholtza: powietrze w otworze jest masą, pustka za nim
sprężyną; sam z siebie prawie nie tłumi. Przy otworach **poniżej milimetra**
robi się inaczej: przy ściance każdego otworu tworzy się lepka warstwa
przyścienna o grubości √(2η/ρω) — przy 1 kHz w powietrzu około 0,07 mm. Gdy
promień otworu jest rzędu kilku takich warstw, powietrze ociera się o ścianki
i **rozprasza energię w samym otworze**. Opisał to Dah-You Maa (1987, 1998).
Nasz otwór ma promień 0,25 mm, czyli przy 1 kHz około 3,6 grubości warstwy —
dokładnie ten zakres.

Wejściem są trzy liczby konstrukcyjne: średnica otworu, grubość płyty, raster.
Nic się nie dopasowuje i nie zgaduje. Wełnę za fornirem liczy model Mikiego,
z tą samą dyscypliną **najgorszej gęstości z przedziału 40–60 kg/m³, pasmo po
paśmie**, co przy panelach tekstylnych (3.4). Oba wykończenia stoją więc
wreszcie na jednej podstawie.

**Gdzie model potwierdza ulotkę.** Załamanie w górze pasma. Reaktancja korków
powietrza w otworach rośnie z 0,60 przy 500 Hz do **4,46 przy 4 kHz** — otwory
przestają przepuszczać. Model daje tam 0,37, ulotka 0,45, goła wełna miałaby
0,92. Mechanizm i rząd wielkości się zgadzają, więc model nie zmyśla — a przy
okazji to jest fizyczna przyczyna tego, co handlowo nazywamy „NUO zostawia górę
pasma żywą".

**Cena przejścia na model:** około **trzy sztuki więcej** w typowym
pomieszczeniu (26 zamiast 23 w biurze 8 × 5 × 2,8 m przy celu 0,60 s). Kierunek
jest bezpieczny, bo model Mikiego zaniża o 0,10–0,15 w skali AW (3.5), a pomiar
komorowy ma krawędzie próbki, których model nie liczy. Prawda leży zatem
między ulotką a modelem, bliżej modelu.

#### Co z tego wynika dla sprzedaży

| sytuacja | co powiedzieć |
|---|---|
| pomieszczenie dudni w dole pasma | NUO ustępuje wełnie. Standard daje przy 125 Hz 0,17 wobec 0,47 dla tekstylnego 100 mm. Premium nadrabia do 0,51 i jest wtedy wyborem obowiązkowym. |
| wnętrze ma pozostać żywe w górze | To **zaleta** NUO. Przy 4 kHz 0,37 wobec 0,92 — nie wygłusza wnętrza na głucho. |
| grubość a liczba sztuk | **Grubość wełny nie zmienia liczby sztuk NUO.** W pasmach mowy oba warianty wypadają tak samo (0,85/0,91 wobec 0,85/0,93). Zmienia dół pasma — tam różnica jest trzykrotna. Przy tekstylnych Premium potrzeba *mniej* — ta asymetria zostaje. |
| wybór formatu | Komplet wymaga o 2 sztuki więcej niż panel duży (28 wobec 26 w przykładzie). Przy tekstylnych ta różnica była pomijalna, tutaj nie jest. |

#### Czego nadal brakuje

| | dlaczego to blokuje |
|---|---|
| pomiar własny gotowego panelu wg ISO 354 | jedyna droga do wartości zmierzonych; producent badań nie ma i mieć nie będzie. Obecnie nieplanowany |
| ceny i terminy dostaw | bez nich nie ma zamówienia |
| klasa ogniowa | NUO to **B1 wg DIN 4102, z badania orientacyjnego**. To nie jest klasa europejska: klasyfikacja wg PN-EN 13501-1, której wymagają polskie przepisy, nie wynika z niej automatycznie |

**Zamknięte od 11.2026:** stopień perforacji, grubość płyty, raster, materiał
wypełnienia i to, czy między fornirem a wełną jest pustka. Te pytania stały
w poprzedniej wersji tej części jako blokujące — odpowiedzi przyszły od
wytwórcy i siedzą w rachunku.

**Obserwacja z rachunku, nie decyzja:** raster 3 mm jest dobrze dobrany.
Rzadszy podnosi bas, ale ścina środek i górę — przy 5 mm α(1 kHz) spada
z 0,91 na 0,61. 3 mm to najszerszy kompromis z możliwych.

Druga obserwacja: fizelina pozostawiona **lita**, jako warstwa oporowa za
fornirem, podniosłaby 125 Hz z 0,17 na około 0,34 i 4 kHz z 0,37 na 0,42,
praktycznie nie ruszając pasm mowy — czyli **bez zmiany liczby sztuk**.
Poprawiłaby dokładnie te dwa pasma, w których NUO jest najsłabszy. Czy
technologia naciągania na to pozwala, to pytanie do wytwórcy, nie do modelu.


### 3.10 Flizelina na wełnie — warstwa, której model nie liczył

W obu wyrobach wełna jest **owijana flizeliną**, żeby nie pyliła. To nie jest
to samo, co flizelina podklejona pod fornir NUO: tamta jest przewiercona razem
z nim i kanał otworu ma 0,8 mm na całej długości, więc nie stawia oporu.
Welon na wełnie jest ciągły i **jest warstwą oporową** — leży dokładnie tam,
gdzie fala wchodzi w materiał porowaty.

Model tego nie uwzględniał. Do impedancji powierzchniowej wełny dochodzi opór
przepływu welonu `Rs`, więc `Zs = Zs_wełny + Rs`.

| wyrób | wariant | 125 | 250 | 500 | 1 k | 2 k | 4 k |
|---|---|---|---|---|---|---|---|
| tekstylny 50 mm | bez welonu (w programie) | 0,14 | 0,36 | 0,67 | 0,88 | 0,89 | 0,92 |
| | `Rs` 200 | **0,19** | **0,46** | **0,76** | 0,88 | 0,90 | 0,93 |
| tekstylny 100 mm | bez welonu (w programie) | 0,47 | 0,67 | 0,77 | 0,85 | 0,90 | 0,92 |
| | `Rs` 200 | 0,51 | 0,67 | 0,77 | 0,85 | 0,90 | 0,93 |
| NUO 50 mm | bez welonu (w programie) | 0,17 | 0,46 | 0,85 | 0,91 | 0,73 | 0,37 |
| | `Rs` 200 | **0,22** | **0,54** | 0,85 | 0,91 | 0,75 | **0,43** |
| NUO 100 mm | bez welonu (w programie) | 0,51 | 0,71 | 0,85 | 0,93 | 0,73 | 0,38 |
| | `Rs` 200 | 0,53 | 0,70 | 0,82 | 0,90 | 0,76 | **0,44** |

**Kierunek jest korzystny i nic nie trzeba wycofywać.** Welon podnosi dół
pasma, a w pasmach mowy — z których liczy się liczba sztuk — niczego nie psuje.
Obecne wartości w programie są więc **zaniżone, czyli bezpieczne**: sprzedajemy
mniej, niż panel daje, a nie więcej.

Gdzie to widać najmocniej: tekstylny 50 mm przy 500 Hz idzie z 0,67 na 0,76,
co przy średniej z pasm mowy oznacza około 6 % więcej chłonności, czyli
w typowym pomieszczeniu jedną sztukę mniej. Przy NUO liczba sztuk się nie
zmienia, bo pasma mowy zostają bez ruchu; rośnie za to 4 kHz z 0,37 na 0,43.

**Optimum nie leży w nieskończoności.** Przy `Rs` 500 góra pasma zaczyna
tracić: tekstylny 50 mm spada przy 1 kHz z 0,88 na 0,84, a przy 2 kHz z 0,89
na 0,86. Sensowny zakres całkowitego oporu powierzchniowego to mniej więcej
**200–300 Pa·s/m**.

> **Konsekwencja dla specyfikacji tkaniny (3.7), i to jest usterka.** Wymóg
> `Rf < 250, docelowo < 100` postawiono przy założeniu, że tkanina jest
> **jedyną** warstwą oporową na licu. Przy panelach tekstylnych welon leży pod
> nią, więc liczy się **suma**: welon plus tkanina. Jeżeli welon ma 200, to
> tkanina o `Rf` 250 daje razem 450 i wychodzimy poza zakres korzystny.
> Wymóg trzeba przeredagować na sumę, gdy tylko poznamy `Rs` welonu.

**Czego brakuje:** jednej liczby — `Rs` flizeliny, albo jej gramatury
i rodzaju, z których da się ją oszacować z dokładnością wystarczającą do
rachunku. Dopóki jej nie ma, w programie zostają wartości bez welonu, bo mylą
się w stronę bezpieczną.


## Część 4. Otwarte

1. **Tabela α_p od producenta wełny** — blokuje wiarygodność kalkulatora. Bez
   niej liczby są ostrożnym oszacowaniem, nie deklaracją. Deklaracja
   właściwości użytkowych tego nie zastępuje: podaje samo AW, bez pasm i bez
   montażu (3.5). **Prosić trzeba o raport z badania ISO 354 wraz z opisem
   montażu.**
2. **Pomiar własny panelu NUO_WALL** — producent innych badań nie ma (3.9),
   a od 11.2026 α liczymy z geometrii panelu, nie z jego wykresu. Pomiar
   komorowy pozostaje jedyną drogą do wartości **zmierzonych** zamiast
   policzonych, i jedynym sprawdzianem modelu Maa na tym wyrobie.
3. **Potwierdzenie gęstości dostarczanej wełny** — przedział 40–60 kg/m³ jest
   założeniem zakupowym (3.4), nie wartością z karty; `AFr` producent podaje
   jako `NPD`.
4. **Terminy dostaw** obu wykończeń — do odpowiedzi na zapytanie (6.3).
5. **Weryfikacja przyrządem odniesienia** — jeden pomiar równolegle z REW i
   UMIK-1. Wiemy, że 0,376 s jest lepiej ugruntowane niż 0,288, ale nie mamy
   dowodu, że jest prawdziwe.
6. **Drugie pomieszczenie** — różnica 32 % pochodzi z jednego salonu o krótkim
   pogłosie. Kierunek pewny, skala niekoniecznie.
7. **Oporność przepływu flizeliny owijającej wełnę** — w obu wyrobach wełna
   jest owijana flizeliną, żeby nie pyliła. Welon leży na powierzchni wełny
   i jest warstwą oporową, której model dotąd nie uwzględniał (3.10).
   Kierunek jest korzystny — brak tej warstwy w rachunku zaniża wynik — więc
   nic się dziś nie sprzedaje na wyrost. Do policzenia na nowo potrzebna jest
   jedna liczba: `Rs` welonu albo jego gramatura i rodzaj.

---

## Część 5. Stan prac — przekazanie

Stan na 31 sierpnia 2026, po wdrożeniu bramki wiarygodności wejścia.

### 5.1 Co stoi gdzie

| gałąź | zawartość |
|---|---|
| `main` | **produkcja** — silnik pomiarowy `v15`, `dobór v5`, trzy wersje językowe (6.7) |
| `claude/rt60-model-akustyczny-5-4-xgg0qk` | gałąź robocza: `dobór v5` — własne formaty NUO i α z modelu Maa (3.9) |

Kolejność jest stała i nie skraca się jej: wszystko powstaje na gałęzi
roboczej, jest sprawdzane na linku podglądowym, a przeniesienie na produkcję
to osobna decyzja podejmowana po sprawdzeniu, nigdy razem z nim.

**Zasada obowiązująca:** `dobor.html` powstał jako **osobny plik**, żeby
rozbudowa nie mogła zepsuć działającego pomiaru. Zmiany w `index.html`
ograniczają się do zakończenia badania — rdzeń DSP pozostaje nietknięty.

### 5.2 Co działa

Silnik pomiarowy `v15` — rdzeń zweryfikowany na dziewięciu pomiarach terenowych,
w tym `silnik-v13` z 31.08 (salon 39,75 m³, głośnik zewnętrzny, Tmid 0,353 s,
udział pola późnego 0,513, wszystkie siedem pasm z wynikiem). Kończy się
działaniem zależnym od jakości pomiaru (6.1), nie samym zapisem pliku.

Karta pomieszczenia `karta.js` — historia jednego wnętrza w `localStorage`,
wspólna dla obu programów, z porównaniem „przed / po" po montażu (6.2).

Moduł doboru `dobór v5` — przejmuje pomiar wprost z badania albo z wczytanego
pliku, sprawdza wiarygodność wejścia (5.3), liczy powierzchnię i liczbę paneli
w wybranym wykończeniu i formacie, przełącza Sabine/Eyring, sprawdza równowagę
tonalną, podaje widełki przy pomiarze poglądowym.

Testy regresyjne `npm test` — 82 przypadki na kodzie obu stron i na
`karta.js`, uruchamianym na atrapie DOM i atrapie magazynu przeglądarki:
`docs/test-bramka.js` (bramka, wykończenia, cel, rekomendacja),
`docs/test-karta.js` (karta i pętla przed/po) oraz `docs/test-paczka.js`
(paczka wyniku i raport — archiwum otwierane **niezależną implementacją**,
bo ZIP piszemy ręcznie i błąd o jeden bajt wyszedłby dopiero u klienta).

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

1. **Przycisk „Złóż zamówienie"** — zapytanie ofertowe do ALACER-a (6.3).
   Wymaga funkcji serwerowej i przygotowania RODO; to jedyna część
   wyprowadzająca dane poza przeglądarkę. Docelowo staje się działaniem
   głównym na końcu doboru, a „Zapisz wynik" schodzi na drugi plan.
2. **Tabela α_p od producenta wełny** — bez niej kolumna tekstylna jest
   oszacowaniem z modelu. Dla NUO takiej tabeli nie będzie (3.9).
3. **Rozrysowanie rozmieszczenia** paneli na ścianach i suficie — ze wskazaniem,
   że to wskazówka montażowa, a nie rachunek: model Sabine'a nie rozróżnia,
   na której powierzchni leży chłonność.
4. **Przeniesienie karty pomieszczenia między urządzeniami** — dziś siedzi
   w jednej przeglądarce. Naturalna droga to wczytanie paczki ZIP z badania
   po stronie pomiaru, tak jak dobór wczytuje JSON.

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

**Wdrożone** (`karta.js`, wrzesień 2026). Karta pomieszczenia narasta:
pomiar → propozycja → pomiar kontrolny. Leży w `localStorage` przeglądarki —
nic nie idzie na serwer, to samo zobowiązanie co przy pomiarze i doborze.
Cena: karta nie przenosi się między urządzeniami; od tego jest paczka ZIP.

**Zasada nadrzędna: karta jest DODATKIEM.** Prywatne okno, wyczyszczone dane,
przepełniony magazyn, przeglądarka z zablokowanym zapisem — każda z tych
rzeczy ma skutkować tym, że program działa dokładnie jak wcześniej. Dlatego
wszystko w `karta.js` siedzi w `try/catch` i zwraca `null` zamiast rzucać.
**Pomiar nie może się zawalić dlatego, że historia się nie zapisała.**

**Tożsamość pomieszczenia:** wymiary zaokrąglone do 10 cm plus przeznaczenie.
Dokładniej się nie da — te same wymiary klient wpisuje za drugim razem na oko
i 5,2 potrafi wrócić jako 5,18. Zaokrąglenie zszywa oba podejścia w jedną
kartę. Skutek uboczny: dwa różne wnętrza o tych samych wymiarach trafią do
jednej karty, dlatego przy porównaniu **zawsze pokazujemy datę** wcześniejszego
pomiaru, a obok stoi odnośnik „to nie jest to samo pomieszczenie".

**Czego porównanie nie zrobi:** jeśli oba pomiary wykonano różnymi źródłami
dźwięku, zamiast werdyktu leci ostrzeżenie. Telefon zaniża czas pogłosu
o 20–30 % (1.5), więc „poprawa" mogłaby pochodzić z samej zmiany sposobu
pomiaru. Dowód wymaga dwóch pomiarów tego samego rodzaju.

**Czego porównanie nie liczy:** brakującej liczby paneli. Byłby to drugi model
obok tego z modułu doboru i oba zaczęłyby się rozjeżdżać. Zamiast tego wynik
kieruje do doboru, który policzy uzupełnienie z **nowego** pomiaru, czyli
z tego, co w pomieszczeniu jest teraz.

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

**Rozstrzygnięte: „zamówienie" znaczy zapytanie ofertowe.** Bez cen, bez
płatności — klient wysyła propozycję wraz z danymi pomieszczenia, odpowiada
handlowiec. To upraszcza moduł: cennik obu wykończeń nie jest potrzebny do
uruchomienia, a funkcja serwerowa sprowadza się do przyjęcia formularza
i przesłania go dalej.

Do zapytania powinna iść **cała podstawa rachunku**, nie sama liczba sztuk:
pomiar, cel, wykończenie, wariant i format. Handlowiec dostaje wtedy komplet
i nie musi niczego odtwarzać z klientem przez telefon.

### 6.6 Zapis wyniku — jeden, na końcu, kompletny

**Zapis należy tam, gdzie decyzja jest domknięta.** Pomiar nie zmienia się przy
przymierzaniu wariantów, ale **wynik po adaptacji już tak**: Standard i Premium
dają inny przewidywany czas pogłosu. Plik zapisany przed wyborem paneli mówi
prawdę, ale niekompletną — po miesiącu nikt nie odtworzy, którą wersję klient
właściwie wybierał.

Dlatego komplet powstaje na końcu **doboru**, nie badania:

```
KONIEC BADANIA          [ Dobierz panele → ]  [ Powtórz… ]
                        zapisz surowe dane pomiaru     ← mały odnośnik

KONIEC DOBORU           [ Zmień panele ]  [ Zapisz wynik ]
```

Odnośnika na ekranie badania **nie da się usunąć** i to nie jest niedoróbka:
ktoś, kto zmierzył i dalej nie idzie — bo tylko sprawdzał, albo bo pomiar się
nie udał i chce przysłać surowiec do diagnozy — musi mieć jak zapisać. Ale
przestaje konkurować z działaniem głównym.

**Zawartość paczki** `wynik-<pomieszczenie>-<wariant>-<data>.zip`:

| plik | dla kogo |
|---|---|
| `raport.html` | klient i architekt — dokument z własnym przyciskiem zapisu do PDF |
| `propozycja-adaptacji.json` | archiwum; to samo jedzie z zapytaniem ofertowym |
| `badanie-akustyczne.json` | moduł doboru — powrót i przeliczenie bez powtarzania badania |
| `ir-punkt-N.wav` | akustyk — weryfikacja niezależnym narzędziem |
| `czytaj-to.txt` | każdy — co jest czym |

Nazwa niesie wariant i godzinę, więc trzy zapisy przy przymierzaniu Standard
i Premium nie zleją się w jeden plik.

**PDF bez biblioteki.** Raport jest samodzielną stroną HTML z arkuszem do
druku i przyciskiem `window.print()`. Wciągnięcie jsPDF oznaczałoby 200–300 kB
obcego kodu w projekcie, który dotąd nie ma ani jednej zewnętrznej zależności.
Osobnego przycisku „Zapisz PDF" nie ma — raport siedzi w paczce.

#### Dlaczego odpowiedzi impulsowe jadą przez IndexedDB

Powstają w programie pomiarowym i żyją **tylko w pamięci tej strony** — giną
przy każdym przeładowaniu. Żeby komplet dało się spakować na końcu doboru,
muszą przejechać. To 4–6 MB: pamięć sesji (limit ok. 5 MB, zapis
synchroniczny) by tego nie uniosła i zacięła telefon. IndexedDB trzyma dane
binarne natywnie i ma wielokrotnie większy limit.

**Zasada ta sama co przy karcie pomieszczenia: to jest dodatek.** Gdy
IndexedDB zawiedzie, paczka powstaje **bez** surowca, a `czytaj-to.txt` mówi
wprost, czego brakuje i jak zdobyć komplet. Dobór działa tak samo.

Surowiec dołącza się tylko wtedy, gdy **wymiary w magazynie zgadzają się
z wymiarami liczonego pomieszczenia**. Inaczej do paczki trafiłyby odpowiedzi
impulsowe z zupełnie innego pomiaru — co byłoby gorsze niż ich brak.

#### Czego w paczce nie ma i dlaczego

`propozycja-adaptacji.json` **zniknęła z interfejsu jako osobne pobranie**.
Sprawdzenie, kto ją czyta, dało odpowiedź: nikt. Architekt nie miał z niej
pożytku, żaden program jej nie wczytywał. Została jako plik **w paczce**
i jako załącznik zapytania — tam ma sens.

### 6.4 Cel adaptacji — nic nie podstawia się samo

Cel wybiera się z listy rodzajów wnętrza albo podaje własny. **Cel własny jest
pozycją listy**, nie polem stojącym zawsze obok niej.

Poprzednio pole z podpowiedzią `0,60` wyglądało na wypełnione i sugerowało
wartość, której nikt nie wybrał. Gorzej: przy przeznaczeniu spoza listy
(`inne`) program **podstawiał 0,60 po cichu** i liczył z tego panele, nie pytając
nikogo o zdanie. Teraz brak wyboru zatrzymuje przejście dalej z komunikatem,
bo cel jest wartością, którą ktoś musi świadomie wskazać — od niej zależy cała
propozycja.

### 6.5 Wersje Standard i Premium — wskazuje je pomiar

Oba wykończenia występują w dwóch wersjach, różniących się grubością
pochłaniacza: **Standard 50 mm** i **Premium 100 mm**. Etykieta niesie treść
techniczną, nie samą kategorię handlową — „Premium · wełna 100 mm, **mocniej
w dole pasma**" — żeby „Standard wystarczy" czytało się jako *nie potrzebujesz
dodatkowego pochłaniania w dole*, a nie jako *dostałeś tańszy produkt*.

**Wersję wskazuje pomiar, nie cennik.** Program liczy równowagę tonalną po
adaptacji osobno dla obu wersji (3.3) i ustawia zalecaną jako **domyślnie
wybraną**, dopóki użytkownik sam czegoś nie kliknie. Cztery rozstrzygnięcia:

| sytuacja | zalecenie |
|---|---|
| Standard utrzymuje równowagę | **Standard** — i program mówi wprost, że Premium nie jest potrzebne |
| Standard psuje, Premium utrzymuje | **Premium**, z dwiema liczbami z tego pokoju |
| żadna nie utrzymuje | **Premium** jako lepsza, ale z zastrzeżeniem, że panele same dudnienia nie naprawią |
| brak pasma 250 Hz lub 1 kHz | **Premium** — bez tych pasm nie da się ocenić, a Premium w dole niczym nie ryzykuje |

To nie jest uprzejmość wobec klienta, tylko warunek wiarygodności:
rekomendacja, która **czasem odradza droższą wersję**, jest brana serio, gdy
zaleca droższą. Lista, na której Premium zawsze wygrywa, jest odczytywana jako
gadanie sprzedawcy — i słusznie.

**Wybór wbrew rekomendacji nie znika.** Widać go w propozycji i idzie do
zapytania razem z uzasadnieniem, bo handlowiec musi wiedzieć, że klient wybrał
inaczej, niż program radził.

**Czego wersje nie zmieniają:** przy panelach NUO grubość absorbera **nie
wpływa na liczbę paneli** — oba warianty mają α 1,00 w pasmach mowy, z których
liczy się Tmid. Przy panelach tekstylnych Premium potrzeba nieco **mniej**.
Handlowiec musi znać tę asymetrię, bo zdanie „grubszy pochłania więcej, więc
sztuk mniej" jest prawdziwe tylko dla tekstylnych.

### 6.7 Wersje językowe — polski, angielski, niemiecki

Wybór języka stoi na pierwszym ekranie obu programów, jako **nazwy języków**,
nie flagi. Flaga oznacza kraj, nie język: angielski to nie tylko Wielka
Brytania, a niemiecki to też Austria i Szwajcaria. Domyślny jest polski —
świadomie, bez zgadywania po ustawieniach przeglądarki; wybór zapamiętuje się
w `localStorage` i obowiązuje w obu programach, bo przejście z pomiaru do
doboru nie może gubić języka.

**Kluczem słownika jest polskie zdanie.** Nie `btn.save.title`, tylko
`t('Zapisz wynik')`. Trzy powody:

1. Słownik wygląda jak `{'Zapisz wynik': 'Save the result'}` — czyta go i
   poprawia tłumacz, bez zaglądania w kod.
2. Klucz nie może rozjechać się z tekstem, bo **jest** tekstem.
3. Brak tłumaczenia pokazuje polski oryginał, a nie pustkę ani identyfikator.
   Usterka jest widoczna, ale nieszkodliwa — program nigdy się nie rozsypie
   przez brakujące hasło.

Cena: zmiana polskiego zdania unieważnia jego tłumaczenia. To jest cecha, nie
wada — `docs/test-jezyki.js` wypisuje wtedy nowy tekst jako nieprzetłumaczony,
a stary jako osierocony.

**Podstawienia zamiast sklejania.** Zdanie z liczbą jest jednym napisem
z miejscem na wstawkę: `t('Zacznij od {ile} szt.', {ile:20})`. Sklejka
`'Zacznij od '+n+' szt.'` jest nieprzetłumaczalna na niemiecki, gdzie szyk
zdania bywa inny. Test pilnuje, żeby zbiór podstawień w tłumaczeniu zgadzał
się ze zbiorem w oryginale — zgubione `{ile}` to zniknięta liczba, dopisane
to surowe „{ile}" na ekranie.

**Czego nie tłumaczymy: kontraktu danych.** Klucze i wartości w JSON —
`charakter_pomiaru`, `"pogladowy"`, `T_srednie`, kody powodów odrzucenia pasma —
czyta moduł doboru i leżą w każdej zapisanej paczce. Tłumaczymy to, co czyta
człowiek; format danych zostaje jeden, niezależnie od języka. Tak samo nazwy
plików w paczce (`raport.html`, `czytaj-to.txt`, `ir-punkt-N.wav`): odwołuje
się do nich `czytaj-to.txt` i moduł doboru.

Identyfikator rodzaju wnętrza (`biuro`) należy do kontraktu danych, więc
zostaje po polsku. Etykieta do czytania bierze się z tablicy `CELE`
(`nazwaTypu()`) i przechodzi przez `t()`.

**Liczby.** Polski i niemiecki mają przecinek dziesiętny, angielski kropkę —
i dotyczy to także tego, co użytkownik **wpisuje**. `Jezyk.naLiczbe()`
przyjmuje oba separatory niezależnie od języka, żeby przełączenie języka
w trakcie wpisywania nie kasowało danych.

**Co stoi gdzie**

| plik | zawartość |
|---|---|
| `jezyki.js` | silnik: `t()`, liczby, daty, odmiana przez liczbę, przełącznik, tłumaczenie statycznych znaczników |
| `jezyk-en.js`, `jezyk-de.js` | słowniki, po jednym na język — generowane, ale poprawki wpisuje się wprost w nich |
| `docs/zbierz-teksty.js` | zbiera teksty z wywołań `t()`, ze znaczników i z tablic definicyjnych; `--brakujace` wypisuje nieprzetłumaczone |
| `docs/test-jezyki.js` | kompletność, hasła osierocone, podstawienia, znaczniki HTML, polskie znaki w obcym tłumaczeniu |
| `docs/test-przecieki.js` | napisy, które nigdy nie przechodzą przez `t()` — sklejane w kodzie albo używane jako klucz bez wywołania |

**Trzecia klasa usterek: silnik trafia obok klucza.** Zdanie zawinięte
w źródle HTML na kilka linii trafia do DOM razem ze złamaniami i wcięciami,
a klucz w słowniku ma pojedyncze spacje, bo ekstraktor je ściąga. Jeżeli
`tlumaczDOM()` normalizuje inaczej niż ekstraktor, takie zdanie nie trafia
w żaden klucz i zostaje po polsku we wszystkich językach — przy czym
**oba poprzednie testy milczą**: słownik jest kompletny, a w kodzie nic nie
omija `t()`. Tak przeciekło zdanie „Trzymaj telefon w wyciągniętej ręce,
mikrofonem w górę…" w kroku 3 pomiaru.

`test-jezyki.js` bierze dlatego **prawdziwe węzły tekstowe z obu stron**,
puszcza na nich **prawdziwy** `Jezyk.tlumaczDOM()` i porównuje wynik z tym,
co daje bezpośrednie zajrzenie do słownika. Każda rozbieżność między silnikiem
a ekstraktorem wychodzi od razu, niezależnie od tego, co ją spowodowało.

Statyczne znaczniki nie wymagały żadnej zmiany: skoro kluczem jest polski
tekst, to ten, który już stoi w HTML, jest gotowym kluczem. `Jezyk.tlumaczDOM()`
chodzi po węzłach tekstowych raz, przy starcie, i podmienia zawartość.

**Dwie klasy usterek, dwa testy.** `test-jezyki.js` pilnuje, żeby każdy ZNANY
tekst miał tłumaczenie. Nie zobaczy zdania, które nigdy nie trafiło na listę,
bo powstaje przez sklejanie w kodzie:

```js
$('sl3').textContent='dobrze (od '+SNR_AC_GOOD+' dB)';
```

Ekstraktor takiego napisu nie widzi, więc nie ma go w słowniku, więc nie ma
czego zgłosić jako brakujące — a na ekranie zostaje po polsku we wszystkich
językach. Tak przeciekł podpis skali poziomu.

Pierwszy skan szukał polskich znaków diakrytycznych i dlatego go przepuścił:
„dobrze (od 26 dB)" nie ma ani jednego ogonka. `test-przecieki.js` nie szuka
ogonków i nie ma ręcznej listy polskich słów — **wyprowadza ją ze słowników**.
Bierze wszystkie słowa z polskich kluczy i odejmuje wszystkie słowa
występujące w tłumaczeniach; zostają słowa wyłącznie polskie (1065 z 1171).
Nazwy własne (ALACER, NUO_WALL, REW, Bluetooth), jednostki i liczby odpadają
same, bo stoją po obu stronach. Lista buduje się z projektu i starzeje razem
z nim.

Reguła: **każdy napis w kodzie zawierający słowo wyłącznie polskie musi albo
przechodzić przez `t()`, albo stać w tablicy definicyjnej, albo być wymieniony
jako polski z założenia** (kontrakt danych, identyfikatory, nazwy plików, klasy
CSS). Sama obecność w słowniku nie wystarcza — klucz użyty bez `t()` to
dokładnie ten przeciek, o który chodzi. Tak znalazł się nagłówek „Wybierz
format", który tłumaczył się przy starcie strony, a potem wracał do polskiego
przy każdym przerysowaniu listy wariantów.

Lista wyjątków ma pozostać krótka; test pilnuje i tego. Gdyby puchła,
znaczyłoby to, że kontrakt danych rozlewa się na treść widzianą przez
użytkownika.

**Do weryfikacji:** tłumaczenia są techniczne i przed produkcją powinien je
przejrzeć native speaker znający akustykę — zwłaszcza niemieckie, gdzie
terminologia normowa (*Nachhallzeit*, *Absorptionsgrad*, *Diffusfeld*) jest
ustalona i rozjazd z nią będzie widoczny dla projektanta.

### 6.8 Wybór źródła jest deklaracją, nie przełącznikiem

Ekran „Wybierz źródło dźwięku" nie przełącza wyjścia i nigdy nie przełączał.
Web Audio gra tam, gdzie wskazuje system operacyjny; `ST.src` wpływa wyłącznie
na dolną granicę sweepu (200 Hz dla telefonu, 80 Hz dla zewnętrznego), na
rysunek planu, na treść komunikatów i na pole `charakter_pomiaru` w pliku.
Telefon z podłączonym głośnikiem Bluetooth wskazuje ten głośnik — więc po
wybraniu „głośnik telefonu" sygnał i tak wychodzi przez Bluetooth, a program
opisuje ograniczenia, których w tym pomiarze nie ma.

**Dlaczego nie da się tego naprawić routingiem.** `AudioContext.setSinkId()`
nie istnieje w Safari (czyli na całym iOS), na Androidzie jest w praktyce
niedostępne, a nawet tam, gdzie działa, system nie wystawia stronie wbudowanego
głośnika telefonu jako osobnego wyjścia przy podłączonym Bluetoothie. Na
urządzeniu docelowym ta droga jest zamknięta. Jedyne, co program może zrobić,
to poprosić o rozłączenie — i to robi, w dwóch miejscach: w panelu po wyborze
telefonu i w podpowiedzi nad przyciskiem kontroli poziomu.

**Ile kosztuje fałszywa deklaracja.** Kierunki nie są symetryczne:

| deklaracja | co gra naprawdę | skutek |
|---|---|---|
| telefon | głośnik Bluetooth | pomiar dobry, ale dostaje korektę ×1,15–1,45 → **za dużo paneli** i widełki, których nie powinno być |
| zewnętrzny | głośnik telefonu | pomiar zaniżony o 20–30 % i **bez korekty** → za mało paneli, cel nieosiągnięty po montażu |

Druga jest groźna i **jest już wykrywana**: udział pola późnego poniżej
`POZNE_MIN = 0,25` oznacza mikrofon leżący na obudowie źródła i program o tym
ostrzega. Pierwsza nie jest wykrywana, choć ten sam wskaźnik by ją złapał —
prawdziwy pomiar telefonem praktycznie zawsze wypada poniżej progu, więc
**zadeklarowany telefon przy normalnym udziale pola późnego jest podejrzany**.
To ta sama liczba i ten sam próg, tylko druga strona nierówności.

**Do zrobienia, w tej kolejności.** Ostrzeżenie tekstowe jest wdrożone. Drugim
krokiem jest sprawdzenie w kontroli poziomu — ostrzegające, nie blokujące,
z opóźnieniem toru (`ST.lat`, typowo 130–260 ms dla Bluetootha wobec poniżej
30 ms dla własnego głośnika) jako potwierdzeniem, zgodnie z rolą, jaką
przypisuje mu komentarz przy `runSweep`. Wymaga kalibracji na realnych
telefonach, bo sama latencja ma ±85 ms niepewności z bufora ScriptProcessora,
a głośnik przewodowy ma opóźnienie bliskie zeru — dlatego głównym sędzią
zostaje udział pola późnego, a latencja tylko go potwierdza.

Docelowo deklaracja powinna zniknąć: kontrola poziomu i tak gra sweep i liczy
wszystko, co potrzebne do rozstrzygnięcia. Wystarczy zagrać ją zawsze od 200 Hz
(bezpieczne dla obu przypadków), rozpoznać źródło z wyniku, a właściwy pomiar
puścić od 80 Hz dopiero wtedy, gdy wyszło, że to głośnik zewnętrzny. Wtedy plik
opisuje to, co się wydarzyło, a nie to, co ktoś kliknął.
