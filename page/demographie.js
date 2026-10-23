const LIGNES = DONNEES.lignes;
const CANAUX = DONNEES.canaux;
const ANNEES = DONNEES.annees;
const AXES = { md: "milliards d'euros de 2023", pct: "points de revenu primaire", personne: "€ par personne" };
const SUFFIXES = { md: " Md€", pct: " pt", personne: " €" };
const CHIFFRES = { md: 1, pct: 2, personne: 0 };
const REPERES = [2030, 2050, 2070];
const DATES = [1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040, 2050, 2060, 2070];
const REFERENCE = ANNEES.indexOf(2023);
const HAUT = 36;
const BAS = 40;
const GAUCHE = 64;
const DROITE = 150;
const formulaire = document.getElementById("simulation");

function scenario() {
  return DONNEES.scenarios[[choix("fecondite"), choix("mortalite"), choix("migrations")].join("-")];
  }

function ecart(serie, s, j, unite) {
  const r = REFERENCE;
  if (unite === "pct") return 100 * (serie[j] / s.primaire[j] - serie[r] / s.primaire[r]);
  if (unite === "personne") return 1000 * (serie[j] / s.individus[j] - serie[r] / s.individus[r]);
  return serie[j] - serie[r];
  }

function totaux(s) {
  return ANNEES.map(function (a, j) { return somme(s.lignes.map(function (ligne) { return ligne[j]; })); });
  }

function montant(valeur, unite) {
  const plus = valeur >= 0.5 * 10 ** -CHIFFRES[unite];
  return (plus ? "+" : "") + nombre(valeur, CHIFFRES[unite]);
  }

function remplirIndicateurs(s) {
  const corps = document.getElementById("indicateurs");
  const nets = totaux(s);
  const rangs = REPERES.map(function (a) { return ANNEES.indexOf(a); });
  const rangees = [
    ["Population (millions)", function (j) { return nombre(s.individus[j], 1); }],
    ["Part des 65 ans ou plus", function (j) { return nombre(100 * s.age65[j], 1) + " %"; }],
    ["Revenu primaire par personne", function (j) { return signe(100 * (s.primaire[j] / s.individus[j] / (s.primaire[REFERENCE] / s.individus[REFERENCE]) - 1)) + " %"; }],
    ["Effet sur le solde public (Md€)", function (j) { return signe(nets[REFERENCE] - nets[j]); }],
    ["en points de revenu primaire", function (j) { return signe(-ecart(nets, s, j, "pct")); }],
    ["en euros par personne", function (j) { return montant(-ecart(nets, s, j, "personne"), "personne"); }],
    ];
  corps.replaceChildren();
  rangees.forEach(function (rangee) {
    const ligne = html("tr", "", corps);
    html("th", "", ligne, rangee[0]);
    rangs.forEach(function (j) { html("td", "", ligne, rangee[1](j)); });
    });
  }

function effets(s, unite) {
  return LIGNES.map(function (ligne, i) {
    return {
      libelle: ligne.libelle,
      canal: ligne.canal,
      recette: ligne.groupe === "prelevements",
      valeurs: ANNEES.map(function (a, j) { return -ecart(s.lignes[i], s, j, unite); }),
      };
    });
  }

function cumul(effets, filtre) {
  const siens = effets.filter(filtre);
  return ANNEES.map(function (a, j) { return somme(siens.map(function (e) { return e.valeurs[j]; })); });
  }

function couches(parCanal) {
  const positif = ANNEES.map(function () { return 0; });
  const negatif = ANNEES.map(function () { return 0; });
  const resultat = [];
  parCanal.forEach(function (c) {
    ["haut", "bas"].forEach(function (cote) {
      const base = cote === "haut" ? positif : negatif;
      const avant = base.slice();
      c.valeurs.forEach(function (v, j) {
        if (cote === "haut" && v > 0) base[j] += v;
        if (cote === "bas" && v < 0) base[j] += v;
        });
      resultat.push({ couleur: c.couleur, avant: avant, apres: base.slice() });
      });
    });
  return resultat;
  }

function chemin(points) {
  return points.map(function (p, k) { return (k === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("");
  }

function ligneDetail(parent, classe, libelle, valeur, unite, couleur) {
  const ligne = html("div", classe, parent);
  const nom = html("span", "", ligne);
  if (couleur) html("span", "carre", nom).style.background = couleur;
  nom.append(libelle);
  html("span", "", ligne, montant(valeur, unite) + SUFFIXES[unite]);
  }

function remplirDetail(j, liste, parCanal, cotes, unite) {
  detail.replaceChildren();
  html("div", "entete", detail, ANNEES[j] + " (écart à 2023)");
  ligneDetail(detail, "net", "Effet sur le solde public", cotes.solde[j], unite);
  ligneDetail(detail, "dispositif", "Variation des dépenses", -cotes.depenses[j], unite);
  ligneDetail(detail, "dispositif", "Variation des recettes", cotes.recettes[j], unite);
  parCanal.forEach(function (c) {
    ligneDetail(detail, "groupe", c.titre, c.valeurs[j], unite, c.couleur);
    liste.filter(function (e) { return e.canal === c.canal && Math.abs(e.valeurs[j]) >= 0.5 * 10 ** -CHIFFRES[unite]; })
      .forEach(function (e) { ligneDetail(detail, "dispositif", e.libelle, e.valeurs[j], unite); });
    });
  }

function dessiner() {
  const s = scenario();
  const unite = choix("unite");
  const liste = effets(s, unite);
  const parCanal = CANAUX.map(function (c) {
    return { canal: c.canal, titre: c.titre, couleur: c.couleur, valeurs: cumul(liste, function (e) { return e.canal === c.canal; }) };
    });
  const cotes = {
    solde: cumul(liste, function () { return true; }),
    depenses: cumul(liste, function (e) { return !e.recette; }),
    recettes: cumul(liste, function (e) { return e.recette; }),
    };
  const empilement = couches(parCanal);
  const largeurFigure = figure.clientWidth;
  const hauteurFigure = figure.clientHeight;
  figure.setAttribute("viewBox", "0 0 " + largeurFigure + " " + hauteurFigure);
  const extremes = [0].concat(
    empilement[empilement.length - 2].apres,
    empilement[empilement.length - 1].apres,
    cotes.depenses,
    cotes.recettes,
    );
  const ticks = graduations(Math.min.apply(null, extremes), Math.max.apply(null, extremes));
  const minimum = Math.min(ticks[0], Math.min.apply(null, extremes));
  const maximum = Math.max(ticks[ticks.length - 1], Math.max.apply(null, extremes));
  const y = function (v) { return HAUT + (maximum - v) / (maximum - minimum) * (hauteurFigure - HAUT - BAS); };
  const x = function (j) { return GAUCHE + j / (ANNEES.length - 1) * (largeurFigure - GAUCHE - DROITE); };
  figure.replaceChildren();
  detail.hidden = true;
  element("text", { x: 0, y: 14, class: "unite" }, figure, AXES[unite]);
  ticks.forEach(function (t) {
    element("text", { x: GAUCHE - 10, y: y(t), class: "graduation" }, figure, nombre(t, Number.isInteger(t) ? 0 : 1));
    });
  let precedente = -Infinity;
  DATES.forEach(function (annee) {
    const j = ANNEES.indexOf(annee);
    if (x(j) - precedente < 44) return;
    precedente = x(j);
    element("text", { x: x(j), y: hauteurFigure - BAS + 20, class: "categorie", "text-anchor": "middle" }, figure, annee);
    });
  empilement.forEach(function (c) {
    const dessus = c.apres.map(function (v, j) { return [x(j), y(v)]; });
    const dessous = c.avant.map(function (v, j) { return [x(j), y(v)]; }).reverse();
    element("path", { d: chemin(dessus.concat(dessous)) + "Z", fill: c.couleur, class: "aire" }, figure);
    });
  element("line", { x1: GAUCHE, x2: largeurFigure - DROITE, y1: y(0), y2: y(0), class: "zero" }, figure);
  element("line", { x1: x(REFERENCE), x2: x(REFERENCE), y1: HAUT - 14, y2: hauteurFigure - BAS, class: "reference" }, figure);
  element("text", { x: x(REFERENCE) - 6, y: HAUT - 8, class: "periode", "text-anchor": "end" }, figure, "observé");
  element("text", { x: x(REFERENCE) + 6, y: HAUT - 8, class: "periode", "text-anchor": "start" }, figure, "projeté");
  const traces = [
    ["depenses", "Dépenses", "cote depenses", -1],
    ["recettes", "Recettes", "cote recettes", 1],
    ["solde", "Solde", "solde-ligne", 1],
    ];
  const fin = ANNEES.length - 1;
  const ordre = traces.slice().sort(function (a, b) { return cotes[b[0]][fin] - cotes[a[0]][fin]; });
  let dernier = -Infinity;
  ordre.forEach(function (trace) {
    const points = cotes[trace[0]].map(function (v, j) { return [x(j), y(v)]; });
    element("path", { d: chemin(points), class: trace[2] }, figure);
    const position = Math.max(y(cotes[trace[0]][fin]), dernier + 16);
    dernier = position;
    const etiquette = element("text", { x: x(fin) + 8, y: position, class: "etiquette" }, figure, trace[1] + " ");
    element("tspan", { class: "montant" }, etiquette, montant(trace[3] * cotes[trace[0]][fin], unite) + SUFFIXES[unite]);
    });
  const curseur = element("line", { x1: 0, x2: 0, y1: HAUT, y2: hauteurFigure - BAS, class: "curseur", visibility: "hidden" }, figure);
  const zone = element("rect", { x: GAUCHE, y: HAUT, width: largeurFigure - GAUCHE - DROITE, height: hauteurFigure - HAUT - BAS, class: "zone continue" }, figure);
  const survoler = function (evenement) {
    const cadre = figure.getBoundingClientRect();
    const position = (evenement.clientX - cadre.left - GAUCHE) / (largeurFigure - GAUCHE - DROITE);
    const j = Math.min(Math.max(Math.round(position * fin), 0), fin);
    curseur.setAttribute("x1", x(j));
    curseur.setAttribute("x2", x(j));
    curseur.setAttribute("visibility", "visible");
    remplirDetail(j, liste, parCanal, cotes, unite);
    detail.hidden = false;
    placerDetail(evenement);
    };
  zone.addEventListener("pointerenter", survoler);
  zone.addEventListener("pointermove", survoler);
  zone.addEventListener("pointerleave", function (evenement) {
    curseur.setAttribute("visibility", "hidden");
    if (evenement.pointerType === "mouse") detail.hidden = true;
    });
  }

function mettreAJour() {
  remplirIndicateurs(scenario());
  dessiner();
  }

formulaire.addEventListener("change", mettreAJour);
document.querySelector(".graphique").addEventListener("change", mettreAJour);
document.addEventListener("pointerdown", function (evenement) {
  if (!evenement.target.classList.contains("zone")) detail.hidden = true;
  });
new ResizeObserver(dessiner).observe(figure);
mettreAJour();
