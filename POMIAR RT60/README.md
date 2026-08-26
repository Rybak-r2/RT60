# RT60 – Badanie akustyki pomieszczeń

Aplikacja webowa do pomiaru czasu pogłosu (RT60) w pomieszczeniach przy użyciu smartfona lub komputera.

## Funkcjonalność

- 📱 Pomiar RT60 w przeglądarce (bez instalacji)
- 🎵 Wsparcie dla głośnika telefonu lub zewnętrznego
- 📊 Analiza w 7 pasmach częstotliwości
- 📥 Export wyników do JSON
- 💾 Pobieranie odpowiedzi impulsowej (WAV)

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

## Wersja

v3.0 — Silnik pomiarowy z pełną analizą pasmową
