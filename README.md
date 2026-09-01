# RT60 – Badanie akustyki pomieszczeń i dobór adaptacji

Dwa programy w przeglądarce, połączone jedną drogą:

```
zmierz → zdiagnozuj → dobierz panele → zamontuj → zmierz ponownie → pokaż, że zadziałało
```

| plik | co robi |
|---|---|
| `index.html` | pomiar czasu pogłosu (RT60) telefonem lub komputerem |
| `dobor.html` | dobór paneli szerokopasmowych na podstawie tego pomiaru |
| `karta.js` | historia pomieszczenia — pozwala porównać stan przed montażem i po nim |

## Funkcjonalność

- 📱 Pomiar RT60 w przeglądarce, bez instalacji
- 🎵 Głośnik zewnętrzny (pomiar właściwy) albo telefon (wyłącznie poglądowo)
- 📊 Analiza w 7 pasmach częstotliwości, z oceną wiarygodności każdego z nich
- 🧱 Dobór paneli w dwóch wykończeniach i dwóch wersjach, z rekomendacją opartą na pomiarze
- 🔁 Pomiar kontrolny po montażu z werdyktem, czy cel został osiągnięty
- 💾 Paczka ZIP z wynikami i odpowiedziami impulsowymi

Nic z pomiaru nie jest nigdzie wysyłane — cały rachunek dzieje się w przeglądarce.

## Testy

```bash
npm test
```

Uruchamiają prawdziwy kod obu stron na atrapie DOM: bramkę wiarygodności wejścia,
model doboru, rekomendację wersji oraz kartę pomieszczenia i pętlę „przed / po".

## Uruchamianie lokalnie

```bash
npm run dev
# Otwórz http://localhost:3000
```

## Deploy

Aplikacja jest hostowana na Vercel i automatycznie deployuje się po push'ach do `main`.

## Architektura

- HTML5 + Web Audio API
- FFT (szybka transformata Fouriera)
- Analiza zaniku energii (T20, T30)
- Wskaźniki zrozumiałości (C50, D50, STI)

## Dokumentacja

`docs/MODEL-AKUSTYCZNY.md` — dlaczego progi mają takie wartości, skąd wzięły się
liczby w module doboru i czego świadomie nie robimy. Bez tego kolejna osoba
„uprości" walidację i wrócą błędy, które już raz kosztowały tydzień.

## Wersja

Silnik pomiarowy `v15`, moduł doboru `dobór v3`.
