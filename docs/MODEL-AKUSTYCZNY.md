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
4. `charakter_pomiaru: "pogladowy"` **blokuje** wejście do modułu doboru.

---

## Część 3. Moduł doboru paneli

### 3.1 Zakres

Wyłącznie **panele z wełny mineralnej obszyte tkaniną transparentną**. Katalog
perforacji i płyt (ALFA 60, VG, Purin) **nie wchodzi** do tego modelu — to
układy płytowo-rezonansowe z litym tyłem, o zupełnie innej charakterystyce, i
zostają do adaptacji opartych na operatach akustycznych.

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

### 3.4 Materiał

**Wełna: gęstość docelowa ok. 60 kg/m³.** To wynik minimaksowy, nie
uśrednienie. Dwa warianty montażu ciągną gęstość w przeciwne strony:

| ρ [kg/m³] | strata α(250 Hz) na ścianie | strata z pustką | najgorszy przypadek |
|---|---|---|---|
| 45 | −18,6 % | 0,0 % | −18,6 % |
| **60** | **−5,2 %** | **−4,7 %** | **−5,2 %** ← minimum |
| 70 | −1,0 % | −10,9 % | −10,9 % |
| 80 | 0,0 % | −17,5 % | −17,5 % |

Panel cienki na ścianie chce wełny gęstszej, panel z pustką — rzadszej. 60 to
punkt, w którym najgorszy przypadek jest najmniejszy. Sztywność prowadzi do tej
samej liczby: poniżej ~50 kg/m³ płyta ugina się trzymana za krawędź.

**Kandydat: ROCKWOOL ROCKTON PREMIUM.** Płyta 1000 × 610 mm, grubości 50/100/
150/200 mm, `AW 0,90` (50–99 mm) i `AW 1,00` (100–200 mm), `CS(10)0,5`,
λD = 0,033 W/mK, klasa A1.

> **Brak w karcie:** `AFr` (oporność przepływu) zadeklarowana jako **NPD**, oraz
> gęstość (EN 13162 jej nie wymaga). To są dwie liczby do zdobycia.

### 3.5 Model α(f) i jego granica

Do wyliczania α wariantów montażu, których producent nie zbadał, służy model
**Mikiego** (1990) z transformacją impedancji przez warstwę i pustkę, w padaniu
rozproszonym (wzór Parisa). Wejście: jeden parametr — oporność przepływu σ.
Implementacja: `docs/welna.py`.

**Model jest systematycznie zaniżony o 0,10–0,15 w skali AW**, najbardziej przy
250 Hz. Przyczyna: komora pogłosowa mierzy próbkę 10–12 m², której krawędzie
podnoszą wynik (dlatego α_s bywa > 1), a model liczy powierzchnię nieskończoną.

Sprawdzenie wobec deklaracji ROCKTON PREMIUM:

| | model | karta |
|---|---|---|
| 50 mm na ścianie | AW 0,75 | — |
| 50 mm + pustka 50 mm | AW 0,90 | **0,90** ✓ |
| 100 mm, dowolny montaż | max AW 0,90 | **1,00** ✗ |

Model trafia w `0,90` tylko z pustką, a `1,00` nie osiąga w żadnej konfiguracji.

**Wniosek: kalkulatora nie wolno budować na modelu.** Potrzebna jest
**tabela α_p w pasmach oktawowych 250–4000 Hz** od Rockwoola wraz z podaniem
montażu. Rockwool ją ma — `AW` jest z niej wyliczone wg ISO 11654. Wtedy α dla
montaży zbadanych bierzemy wprost, a model służy tylko do reszty,
**skalibrowany na punktach zbadanych**.

### 3.6 Panel

**Formatka 1000 × 610 × 50 mm — wymiar płyty, zero odpadu przy cięciu.**
Wariant połówkowy 500 × 610 mm, jedno cięcie, również bez odpadu.

> Odrzucone: **600 × 600 mm**. Z płyty 1000 × 610 zostaje niewykorzystany pas
> 400 × 610 — **41 % odpadu**, czyli o 67 % więcej materiału na metr panelu.

Obszycie tkaniną **ze wszystkich stron, łącznie z krawędzią 50 mm**, odsłania
dodatkową powierzchnię pochłaniającą:

| format | lico | krawędzie | przyrost |
|---|---|---|---|
| 1000 × 610 | 0,610 m² | 0,161 m² | +26 % |
| 500 × 610 | 0,305 m² | 0,111 m² | +36 % |

**Kalkulator liczy wyłącznie lico.** Krawędzie zostają jako zapas — to właściwy
kierunek pomyłki dla narzędzia sprzedażowego: obiecujemy mniej, niż klient
dostanie. Ich rzeczywistą skuteczność trzeba zmierzyć, nie zakładać.

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

Wełna σ ≈ 30 000 Pa·s/m², formatka 1000 × 610, liczone **z samego lica**:

| wnętrze | cel | na ścianie | na dystansach 50 mm |
|---|---|---|---|
| salon 39 m³, T 0,38 s | 0,30 s | 9 szt. (5,3 m²) | 9 szt. (4,9 m²) |
| biuro otwarte 120 m³, T 0,90 s | 0,60 s | 23 szt. (13,5 m²) | 21 szt. (12,4 m²) |
| sala konferencyjna 200 m³, T 1,10 s | 0,60 s | 51 szt. (30,6 m²) | 46 szt. (28,1 m²) |

Różnica ilościowa między wariantami montażu jest **niewielka (ok. 10 %)**.
Argumentem za montażem na dystansach nie jest oszczędność materiału, tylko
równowaga tonalna — patrz 3.3.

---

## Część 4. Otwarte

1. **Tabela α_p od Rockwoola** — blokuje wiarygodność kalkulatora. Bez niej
   liczby są ostrożnym oszacowaniem, nie deklaracją.
2. **Gęstość i AFr wybranej wełny** — do zamknięcia modelu.
3. **Jedna płyta w rękach** — `CS(10)0,5` to najniższa klasa; czy formatka
   1000 × 610 × 50 trzyma kształt, rozstrzyga dotyk, nie rachunek.
4. **Weryfikacja przyrządem odniesienia** — jeden pomiar równolegle z REW i
   UMIK-1. Wiemy, że 0,376 s jest lepiej ugruntowane niż 0,288, ale nie mamy
   dowodu, że jest prawdziwe.
5. **Drugie pomieszczenie** — różnica 32 % pochodzi z jednego salonu o krótkim
   pogłosie. Kierunek pewny, skala niekoniecznie.

---

## Część 5. Stan prac — przekazanie

Stan na 31 sierpnia 2026, koniec pierwszej serii rozmów.

### 5.1 Co stoi gdzie

| gałąź | commit | zawartość |
|---|---|---|
| `main` | `75b0daa` | **produkcja** — `index.html`, silnik pomiarowy `v13` |
| `claude/repository-changes-dir4kw` | `16160d1` | main + ta dokumentacja + `dobor.html` |

`rt-60.vercel.app` serwuje `main`. Podgląd gałęzi testowej:
`rt-60-git-claude-repository-changes-dir4kw-rutra-fisher.vercel.app`, moduł
doboru pod `/dobor.html`.

**Zasada obowiązująca:** `dobor.html` powstał jako **osobny plik**, żeby
rozbudowa nie mogła zepsuć działającego pomiaru. `index.html` nie był ruszany
od `v13`. Wpięcie jednego w drugie jest świadomie odłożone.

### 5.2 Co działa

Silnik pomiarowy `v13` — zweryfikowany na dziewięciu pomiarach terenowych,
w tym `silnik-v13` z 31.08 (salon 39,75 m³, głośnik zewnętrzny, Tmid 0,353 s,
udział pola późnego 0,513, wszystkie siedem pasm z wynikiem).

Moduł doboru `dobór v1` — wczytuje JSON, liczy powierzchnię i liczbę paneli
1000 × 610, przełącza Sabine/Eyring, sprawdza równowagę tonalną, podaje widełki
przy pomiarze poglądowym wraz z zaleceniem „zacznij od X, dołóż w razie
potrzeby". Cztery błędy wykryte testami na realnych plikach zostały naprawione
przed commitem — opis w treści commita `16160d1`.

### 5.3 Znana luka, nienaprawiona

**Moduł doboru nie sprawdza wiarygodności wejścia.** Plik z `silnik-v2`
(sprzed naprawy zakresu dynamiki) zawierał `T` = 0,224 s przy 250 Hz i 2,001 s
przy 1 kHz — dziewięciokrotny skok, fizycznie niemożliwy. `Tmid` wyszło 1,251 s,
a kalkulator policzył z tego 38 paneli. Wynik był poprawny; wejście nie.

Projektowana bramka, do wdrożenia:

```
WERSJE_NIEUFNE   = ['silnik-v1','silnik-v2','silnik-v3']   // brak działających progów ISO
MAX_ROZRZUT_PASM = 3    // krotność między najdłuższym a najkrótszym pasmem 250–4000 Hz
MAX_ROZJAZD_MOWY = 2    // krotność między 500 Hz a 1 kHz, z których liczy się Tmid
```

Sprawdzone na dobrych plikach: rozrzut pasmowy wynosi tam 1,2–1,4, więc próg 3
nie generuje fałszywych alarmów.

### 5.4 Kolejność dalszych prac

1. **Bramka wiarygodności wejścia** — 5.3, blokuje przed pokazaniem komukolwiek.
2. **Tabela α_p od Rockwoola** — bez niej liczby są oszacowaniem z modelu.
3. **Wpięcie `dobor.html` w `index.html`** — żeby klient nie przerzucał pliku ręcznie.
4. **Kolorystyka i formularz kontaktowy** — wymaga funkcji serwerowej, dziś projekt
   jest statyczny.
5. **Rozrysowanie rozmieszczenia** paneli na ścianach i suficie.

Decyzja podjęta i obowiązująca: przy pomiarze poglądowym **widełki od–do**,
nie pojedyncza liczba i nie blokada.
