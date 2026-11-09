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


# ─────────────────────────────────────────────────────────────────────────────
# NUO_WALL: fornir MIKROPERFOROWANY na welnie, teoria Maa.
#
# Zwykly panel perforowany (otwory kilkumilimetrowe) to szereg rezonatorow
# Helmholtza: powietrze w otworze jest masa, pustka za nim sprezyna. Sam
# z siebie prawie nie tlumi i dziala waskopasmowo.
#
# Przy otworach PONIZEJ milimetra robi sie inaczej. Przy sciance kazdego otworu
# tworzy sie lepka warstwa przyscienna o grubosci delta = sqrt(2*eta/(rho*w)) —
# przy 1 kHz w powietrzu okolo 0,07 mm. Gdy promien otworu jest tego samego
# rzedu co kilka delta, powietrze przepychane przez otwor ociera sie o scianki
# i rozprasza energie W SAMYM OTWORZE. Panel staje sie wlasnym tlumikiem,
# a pochlanianie robi sie szerokopasmowe. Opisal to Dah-You Maa:
# "Microperforated-panel wideband absorbers" (1987) oraz "Potential of
# microperforated panel absorber", JASA 104 (1998).
#
# Nasz fornir: otwor 0,5 mm, czyli promien 0,25 mm — przy 1 kHz okolo 3,6
# grubosci warstwy przysciennej. Dokladnie ten zakres.
#
# Wejsciem sa TRZY liczby konstrukcyjne: srednica otworu, grubosc plyty
# i raster. Nic sie nie dopasowuje i nie zgaduje — i dlatego te wartosci
# wolno postawic przed klientem, czego nie mozna bylo powiedziec o krzywej
# pozyczonej z ulotki producenta, zmierzonej na innym wypelnieniu.
# ─────────────────────────────────────────────────────────────────────────────
ETA = 1.86e-5          # lepkosc dynamiczna powietrza [Pa*s]

def maa(f, d, t, b):
    """Znormalizowana impedancja plyty mikroperforowanej (Maa 1998).

    d — srednica otworu [m], t — grubosc plyty [m], b — raster [m].
    Zwraca (r + j*x) znormalizowane przez rho0*c0 oraz stopien perforacji.

    Opor: pierwszy czlon to przeplyw Poiseuille'a, pierwiastek poprawia go
    o cienienie warstwy przysciennej z czestotliwoscia, drugi czlon to straty
    na wlocie i wylocie otworu.
    Reaktancja: masa korka powietrza w kanale, poprawka na profil predkosci,
    oraz korekcja koncowa 0,85*d/t na powietrze tuz przed i za otworem, ktore
    porusza sie razem z korkiem.
    """
    w = 2 * math.pi * f
    sig = math.pi * d * d / (4 * b * b)
    k = d * math.sqrt(w * rho0 / (4 * ETA))        # stosunek promienia do delta
    r = (32 * ETA * t) / (sig * rho0 * c0 * d * d) * \
        (math.sqrt(1 + k * k / 32) + (math.sqrt(2) / 32) * k * d / t)
    x = (w * t) / (sig * c0) * (1 + (9 + k * k / 2) ** -0.5 + 0.85 * d / t)
    return complex(r, x), sig

def przez_powietrze(f, L, Zl):
    """Transformacja impedancji przez warstwe powietrza o grubosci L."""
    if L <= 0:
        return Zl
    k0 = 2 * math.pi * f / c0
    return Z0 * (Zl + 1j * Z0 * math.tan(k0 * L)) / (Z0 + 1j * Zl * math.tan(k0 * L))

def nuo(d_welny, rho, d=0.5e-3, t=0.8e-3, b=3.0e-3, pustka=0.0):
    """alfa(f) panelu NUO: fornir mikroperforowany + welna + sztywny tyl.

    Konstrukcja wg danych wytworcy: fornir z podklejona fizelina, przewiercone
    razem na wylot, lacznie 0,8 mm; otwory 0,5 mm w rastrze 3 mm; ramiak ze
    sklejki topolowej 30 mm glebokosci wchodzi w stalowa obudowe (70 mm przy
    welnie 50, 120 mm przy welnie 100), wiec welna dociska do spodu forniru
    i pustki miedzy nimi NIE MA — stad pustka=0.
    """
    out = {}
    for f in PASMA:
        Zw = impedancja(f, sigma_z_gestosci(rho), d_welny, 0.0)
        Zp, _ = maa(f, d, t, b)
        out[f] = alfa_rozproszone(Z0 * Zp + przez_powietrze(f, pustka, Zw))
    return out

def nuo_zakresu(d_welny, rho_min=40, rho_max=60, krok=5, **kw):
    """alfa najmniejsza w kazdym pasmie w calym przedziale gestosci welny —
    ta sama dyscyplina, co przy panelach tekstylnych (patrz krzywa_zakresu)."""
    krz = [nuo(d_welny, r, **kw) for r in range(int(rho_min), int(rho_max) + 1, krok)]
    return {f: min(k[f] for k in krz) for f in PASMA}

# ─────────────────────────────────────────────────────────────────────────────
# AW wg ISO 11654 — zeby model dalo sie porownac z tym, co producent DEKLARUJE.
# Deklaracja wlasciwosci uzytkowych welny podaje wylacznie AW (0,90 dla
# 50-80 mm, 1,00 dla 100-200 mm) i ani jednej wartosci pasmowej, wiec to
# jedyny punkt styku miedzy modelem a deklaracja producenta.
# ─────────────────────────────────────────────────────────────────────────────
PASMA_AW = [250, 500, 1000, 2000, 4000]
KRZYWA_ODN = {250: 0.80, 500: 1.00, 1000: 1.00, 2000: 1.00, 4000: 0.90}

def alfa_p(a):
    """alfa_p: alfa_s zaokraglone do kroku 0,05 (ISO 11654 p. 4.1)."""
    return {f: round(min(1.0, a[f]) * 20) / 20 for f in PASMA_AW}

def aw(a):
    """AW i wskazniki ksztaltu. Krzywa odniesienia przesuwana co 0,05 ku
    zmierzonej, az suma odchylek niekorzystnych spadnie do 0,10 lub nizej."""
    ap = alfa_p(a)
    przes = 0.0
    while przes < 1.0:
        odn = {f: KRZYWA_ODN[f] - przes for f in PASMA_AW}
        nieko = sum(max(0.0, odn[f] - ap[f]) for f in PASMA_AW)
        if nieko <= 0.10 + 1e-9:
            break
        przes += 0.05
    odn = {f: KRZYWA_ODN[f] - przes for f in PASMA_AW}
    ksztalt = ''
    if ap[250] >= odn[250] + 0.25: ksztalt += 'L'
    if any(ap[f] >= odn[f] + 0.25 for f in (500, 1000)): ksztalt += 'M'
    if any(ap[f] >= odn[f] + 0.25 for f in (2000, 4000)): ksztalt += 'H'
    return round(odn[500], 2), ksztalt

if __name__ == '__main__':
    print("\n=== AW z modelu wobec deklaracji producenta welny ===")
    print("    (deklarowane: AW 0,90 dla 50-80 mm, 1,00 dla 100-200 mm)\n")
    print(f"  {'wariant':<26}{'rho':>5}  " + "  ".join(f"{f:>4}" for f in PASMA_AW) +
          f"   {'AW model':>9}  {'karta':>6}")
    for nazwa, dw, dp, karta in [("50 mm na scianie", .050, 0, "0,90"),
                                 ("50 mm + 50 mm pustki", .050, .050, "0,90"),
                                 ("100 mm na scianie", .100, 0, "1,00")]:
        for gest, sig in [(30, 15000), (45, 28000), (60, 42000)]:
            a = krzywa(sig, dw, dp)
            ap = alfa_p(a)
            w, k = aw(a)
            print(f"  {nazwa:<26}{gest:>5}  " + "  ".join(f"{ap[f]:4.2f}" for f in PASMA_AW) +
                  f"   {w:>6.2f}{k:<3}  {karta:>6}")
        print()


# ─────────────────────────────────────────────────────────────────────────────
# Welna jest kupowana NA SPEC, nie na jedna gestosc: operaty akustyczne opisuja
# ja przedzialem i tak tez ja zamawiamy. Rachunek musi wiec stac na najgorszym
# przypadku z tego przedzialu, pasmo po pasmie — inaczej obietnica trzyma sie
# tylko przy szczesliwej dostawie.
# ─────────────────────────────────────────────────────────────────────────────
def sigma_z_gestosci(rho):
    """sigma(rho) dopasowane do tablicy Biesa i Hansena uzytej wyzej.
    Zakotwiczone na (30, 15 000) i (60, 42 000); kontrola: 45 -> 27 400
    wobec tabelarycznych 28 000, 80 -> 64 400 wobec 63 000."""
    return 15000.0 * (rho / 30.0) ** 1.4854

def krzywa_zakresu(rho_min, rho_max, d_welny, d_pustki=0.0, krok=5):
    """alfa najmniejsza w kazdym pasmie w calym przedziale gestosci."""
    rho = list(range(int(rho_min), int(rho_max) + 1, krok))
    krz = [krzywa(sigma_z_gestosci(r), d_welny, d_pustki) for r in rho]
    return {f: min(k[f] for k in krz) for f in PASMA}

if __name__ == '__main__':
    print("\n=== Welna deklarowana 40-60 kg/m3 — najgorszy przypadek pasmowo ===\n")
    print(f"  {'wariant':<20}" + "  ".join(f"{f:>5}" for f in PASMA) + f"  {'AW':>6}")
    for nazwa, d in [("50 mm na scianie", .050), ("100 mm na scianie", .100)]:
        a = krzywa_zakresu(40, 60, d)
        w, k = aw(a)
        print(f"  {nazwa:<20}" + "  ".join(f"{a[f]:5.2f}" for f in PASMA) + f"  {w:5.2f}{k}")
    print("\n  Te wartosci ida do dobor.html.")

    # ── NUO_WALL: fornir mikroperforowany na welnie ──────────────────────────
    _, sig = maa(1000, 0.5e-3, 0.8e-3, 3.0e-3)
    print("\n=== NUO_WALL — fornir mikroperforowany, teoria Maa ===")
    print("    otwor 0,5 mm, raster 3 mm -> stopien perforacji %.2f %%, plyta 0,8 mm"
          % (100 * sig))
    print("    welna dociska do spodu forniru (ramiak 30 mm w obudowie 70/120 mm)\n")
    print(f"  {'wariant':<20}" + "  ".join(f"{f:>5}" for f in PASMA) + f"  {'AW':>6}")
    for nazwa, d in [("standard 50 mm", .050), ("premium 100 mm", .100)]:
        a = nuo_zakresu(d)
        w, ksz = aw(a)
        print(f"  {nazwa:<20}" + "  ".join(f"{a[f]:5.2f}" for f in PASMA) +
              f"  {w:5.2f}{ksz}")
    print("  %-20s" % "ulotka muto' (odczyt)" +
          "  ".join(f"{v:5.2f}" for v in (.10, .60, 1.00, 1.00, .75, .45)))
    print("""
    Ulotka opisuje panel muto' z ICH absorberem — pianka albo filc, nigdy nam
    tego nie powiedziano. My wypelniamy welna mineralna, wiec krzywa z ulotki
    opisuje inny wyrob. Model opisuje nasz, z jego wlasnej geometrii.

    Gdzie model potwierdza ulotke: zalamanie w gorze pasma. Reaktancja korkow
    powietrza w otworach rosnie od 0,60 przy 500 Hz do 4,46 przy 4 kHz — przy
    4 kHz otwory przestaja przepuszczac. Goła welna dalaby tam 0,92.""")
    print("\n  %8s %8s %8s" % ("f [Hz]", "opor r", "reakt. x"))
    for f in PASMA:
        Z, _ = maa(f, 0.5e-3, 0.8e-3, 3.0e-3)
        print("  %8d %8.2f %8.2f" % (f, Z.real, Z.imag))
    print("\n    Opor ponizej 1, czyli ponizej optimum Maa — sam fornir pochlania")
    print("    malo, robote robi welna, a perforacja dziala jak czesciowo")
    print("    przezroczyste lico. Rzadszy raster podnosi bas, ale scina srodek")
    print("    i gore: przy 5 mm alfa(1k) spada z 0,91 na 0,61. 3 mm jest")
    print("    najszerszym kompromisem z mozliwych.")
