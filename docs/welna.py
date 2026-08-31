"""alfa(f) warstwy welny mineralnej z fizyki, nie z tabeli.

Model Mikiego (1990) - poprawiona wersja Delany-Bazley, szeroko stosowana dla
materialow wloknistych. Wejsciem jest JEDEN parametr materialu: opornosc
przeplywu sigma [Pa*s/m2]. Reszta to grubosc i ewentualna pustka za panelem.

Tkanina transparentna akustycznie nie wchodzi do rachunku - i o to chodzi.
"""
import cmath, math

rho0, c0 = 1.2, 343.0
Z0 = rho0 * c0
PASMA = [125, 250, 500, 1000, 2000, 4000]

def miki(f, sigma):
    X = 1000.0 * f / sigma
    Zc = Z0 * (1 + 5.50 * X**-0.632 - 1j * 8.43 * X**-0.632)
    k = (2 * math.pi * f / c0) * (1 + 7.81 * X**-0.618 - 1j * 11.41 * X**-0.618)
    return Zc, k

def impedancja(f, sigma, d_welny, d_pustki):
    """Impedancja powierzchniowa: welna na pustce powietrznej na sztywnej scianie."""
    if d_pustki > 0:
        k0 = 2 * math.pi * f / c0
        Zb = -1j * Z0 / cmath.tan(k0 * d_pustki)
    else:
        Zb = complex(1e12, 0)                      # sciana sztywna
    Zc, k = miki(f, sigma)
    kd = k * d_welny
    return Zc * (Zb * cmath.cos(kd) + 1j * Zc * cmath.sin(kd)) \
              / (Zc * cmath.cos(kd) + 1j * Zb * cmath.sin(kd))

def alfa_rozproszone(Zs, N=400):
    """Padanie rozproszone (wzor Parisa) - to mierzy ISO 354, nie padanie prostopadle."""
    s = 0.0
    for i in range(N):
        th = (i + 0.5) * (math.pi / 2) / N
        R = (Zs * math.cos(th) - Z0) / (Zs * math.cos(th) + Z0)
        s += (1 - abs(R)**2) * math.sin(2 * th) * (math.pi / 2) / N
    return max(0.0, min(1.0, s))

def krzywa(sigma, d_welny, d_pustki=0.0):
    return {f: alfa_rozproszone(impedancja(f, sigma, d_welny, d_pustki)) for f in PASMA}

# Typowe opornosci przeplywu welny mineralnej wg gestosci (Bies & Hansen)
GESTOSCI = [(30, 15000), (45, 28000), (60, 42000), (80, 63000)]

print("=== alfa(f) w padaniu rozproszonym, z modelu Mikiego ===\n")
print("  gestosc  sigma      wariant              " +
      "  ".join(f"{f:>5}" for f in PASMA) + "    alfa_sr(500-2k)")
for gest, sig in GESTOSCI:
    for nazwa, dw, dp in [("50 mm na scianie", .050, 0),
                          ("50 mm + 50 mm pustki", .050, .050),
                          ("100 mm na scianie", .100, 0)]:
        a = krzywa(sig, dw, dp)
        sr = sum(a[f] for f in (500, 1000, 2000)) / 3
        print(f"  {gest:>3} kg/m3 {sig:>6}   {nazwa:<22}" +
              "  ".join(f"{a[f]:5.2f}" for f in PASMA) + f"      {sr:.2f}")
    print()

print("=== Kontrola modelu wobec wartosci spotykanych w badaniach ISO 354 ===")
print("  Welna 45 kg/m3, 50 mm na scianie:")
a = krzywa(28000, .050)
print("   model:      " + "  ".join(f"{a[f]:.2f}" for f in PASMA))
print("   typowo lab: 0.10  0.35  0.78  0.97  1.00  1.00")
print("   (lab bywa wyzej: proba 10-12 m2 ma krawedzie, model ich nie liczy)")

print("\n=== Wrazliwosc na sigma: o ile zmienia sie wynik przy 500 Hz ===")
for dw, dp, nazwa in [(.050, 0, "50 mm na scianie"), (.050, .050, "50 mm + pustka"), (.100, 0, "100 mm")]:
    w = [krzywa(s, dw, dp)[500] for _, s in GESTOSCI]
    print(f"  {nazwa:<20} alfa(500) od {min(w):.2f} do {max(w):.2f}  "
          f"(rozrzut {100*(max(w)-min(w))/max(w):.0f} % w calym zakresie gestosci)")
