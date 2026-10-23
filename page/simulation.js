const LIGNES = DONNEES.lignes;
const GROUPES = DONNEES.groupes;
const AXES = { personne: "€ par personne", pct: "% du revenu", uc: "€ par unité de consommation", md: "milliards d'euros" };
const SUFFIXES = { personne: " €", pct: " %", uc: " €", md: " Md€" };
const CHIFFRES = { personne: 0, pct: 2, uc: 0, md: 1 };
const NETS = { variation: "Effet net", niveau: "Solde net" };
const HAUT = 36;
const BAS = 130;
const GAUCHE = 64;
const DROITE = 8;
const formulaire = document.getElementById("simulation");

function masses() {
  return LIGNES.map(function (ligne, i) {
    const valeur = document.getElementById("ligne" + i).valueAsNumber;
    return isNaN(valeur) ? ligne.defaut : valeur;
    });
  }

function part(valeur, total) {
  return total < 0.05 ? "" : Math.round(100 * valeur / total) + " %";
  }

function mettreAJourSoldes(valeurs) {
  const ecarts = LIGNES.map(function (ligne, i) { return -ligne.signe * (valeurs[i] - ligne.defaut); });
  const prelevements = somme(ecarts.filter(function (x, i) { return LIGNES[i].groupe === "prelevements"; }));
  const total = somme(ecarts);
  const depenses = total - prelevements;
  document.getElementById("economie").value = signe(total) + " Md€";
  document.getElementById("economie_prelevements").value = signe(prelevements) + " Md€";
  document.getElementById("economie_depenses").value = signe(depenses) + " Md€";
  document.getElementById("economie_prelevements_part").value = part(prelevements, total);
  document.getElementById("economie_depenses_part").value = part(depenses, total);
  LIGNES.forEach(function (ligne, i) {
    const ecart = valeurs[i] - ligne.defaut;
    const modif = document.getElementById("modif" + i);
    modif.hidden = Math.abs(ecart) < 0.05;
    modif.firstChild.textContent = signe(ecart);
    });
  }

function series(valeurs, ventilation, mode) {
  const resultat = [];
  LIGNES.forEach(function (ligne, i) {
    const rapport = valeurs[i] / ligne.defaut;
    if (mode === "variation" && Math.abs(rapport - 1) < 1e-9) return;
    const facteur = mode === "variation" ? rapport - 1 : rapport;
    resultat.push({
      groupe: ligne.groupe,
      libelle: ligne.libelle,
      couleur: ligne.couleur,
      montants: ventilation.profils[i].map(function (p) { return p * facteur; }),
      });
    });
  return resultat;
  }

function montant(valeur, unite, avecSigne) {
  const plus = avecSigne && valeur >= 0.5 * 10 ** -CHIFFRES[unite];
  return (plus ? "+" : "") + nombre(valeur, CHIFFRES[unite]);
  }

function ligneDetail(parent, classe, libelle, valeur, unite, avecSigne, couleur) {
  const ligne = html("div", classe, parent);
  const nom = html("span", "", ligne);
  if (couleur) html("span", "carre", nom).style.background = couleur;
  nom.append(libelle);
  html("span", "", ligne, montant(valeur, unite, avecSigne) + SUFFIXES[unite]);
  }

function remplirDetail(titre, piles, j, net, mode, unite) {
  const avecSigne = mode === "variation";
  detail.replaceChildren();
  html("div", "entete", detail, titre);
  ligneDetail(detail, "net", NETS[mode], net, unite, avecSigne);
  GROUPES.forEach(function (g) {
    const siennes = piles.filter(function (s) { return s.groupe === g.groupe; });
    if (siennes.length === 0) return;
    const total = somme(siennes.map(function (s) { return s.valeurs[j]; }));
    ligneDetail(detail, "groupe", g.titre, total, unite, avecSigne, g.couleur);
    siennes.forEach(function (s) { ligneDetail(detail, "dispositif", s.libelle, s.valeurs[j], unite, avecSigne); });
    });
  }

function regrouper(piles, n) {
  return GROUPES.map(function (g) {
    const siennes = piles.filter(function (s) { return s.groupe === g.groupe; });
    const valeurs = [];
    for (let j = 0; j < n; j++) valeurs.push(somme(siennes.map(function (s) { return s.valeurs[j]; })));
    return { couleur: g.couleur, valeurs: valeurs };
    });
  }

function dessiner(valeurs) {
  const ventilation = DONNEES.ventilations.find(function (v) { return v.code === choix("ventilation"); });
  const mode = choix("mode");
  const unite = choix("unite");
  const largeurFigure = figure.clientWidth;
  const hauteurFigure = figure.clientHeight;
  figure.setAttribute("viewBox", "0 0 " + largeurFigure + " " + hauteurFigure);
  const revenu = ventilation.revenu;
  const n = revenu.length;
  const enUnite = function (montant, j) {
    if (unite === "personne") return 1000 * montant / ventilation.individus[j];
    if (unite === "uc") return 1000 * montant / ventilation.uc[j];
    if (unite === "pct") return 100 * montant / revenu[j];
    return montant;
    };
  const brutes = series(valeurs, ventilation, mode);
  const piles = brutes.map(function (s) {
    return { groupe: s.groupe, libelle: s.libelle, couleur: s.couleur, valeurs: s.montants.map(enUnite) };
    });
  const blocs = mode === "variation" ? piles : regrouper(piles, n);
  const nets = revenu.map(function (r, j) { return somme(blocs.map(function (s) { return s.valeurs[j]; })); });
  const hauts = revenu.map(function (r, j) { return somme(blocs.map(function (s) { return Math.max(s.valeurs[j], 0); })); });
  const bas = revenu.map(function (r, j) { return somme(blocs.map(function (s) { return Math.min(s.valeurs[j], 0); })); });
  const vide = piles.length === 0;
  const extremes = vide ? [-1, 1] : [0].concat(hauts, bas, nets);
  const ticks = graduations(Math.min.apply(null, extremes), Math.max.apply(null, extremes));
  const minimum = Math.min(ticks[0], Math.min.apply(null, extremes));
  const maximum = Math.max(ticks[ticks.length - 1], Math.max.apply(null, extremes));
  const y = function (v) { return HAUT + (maximum - v) / (maximum - minimum) * (hauteurFigure - HAUT - BAS); };
  const bande = (largeurFigure - GAUCHE - DROITE) / n;
  const largeur = bande * 0.7;
  const x = function (j) { return GAUCHE + bande * j + (bande - largeur) / 2; };
  figure.replaceChildren();
  detail.hidden = true;
  element("text", { x: 0, y: 14, class: "unite" }, figure, AXES[unite]);
  ticks.forEach(function (t) {
    element("text", { x: GAUCHE - 10, y: y(t), class: "graduation" }, figure, nombre(t, Number.isInteger(t) ? 0 : 1));
    });
  element("line", { x1: GAUCHE, x2: largeurFigure - DROITE, y1: y(0), y2: y(0), class: "zero" }, figure);
  ventilation.categories.forEach(function (lignes, j) {
    const extremites = ventilation.code === "101";
    const ancre = extremites && j === 0 ? "start" : extremites && j === n - 1 ? "end" : "middle";
    const abscisse = ancre === "start" ? x(j) : ancre === "end" ? x(j) + largeur : x(j) + largeur / 2;
    const etiquette = element("text", { x: abscisse, y: hauteurFigure - BAS + 40, class: "categorie", "text-anchor": ancre }, figure);
    lignes.forEach(function (ligne, k) {
      element("tspan", { x: abscisse, dy: k === 0 ? 0 : "1.2em" }, etiquette, ligne);
      });
    });
  revenu.forEach(function (r, j) {
    let positif = 0;
    let negatif = 0;
    blocs.forEach(function (s) {
      const v = s.valeurs[j];
      const depart = v >= 0 ? positif : negatif;
      if (v >= 0) positif += v; else negatif += v;
      element("rect", {
        x: x(j),
        y: y(Math.max(depart, depart + v)),
        width: largeur,
        height: Math.abs(y(depart) - y(depart + v)),
        fill: s.couleur,
        class: "segment",
        "data-colonne": j,
        }, figure);
      });
    if (vide) return;
    element("line", { x1: x(j) - 3, x2: x(j) + largeur + 3, y1: y(nets[j]), y2: y(nets[j]), class: "net", "data-colonne": j }, figure);
    const texte = montant(nets[j], unite, mode === "variation");
    const valeur = element("text", { x: x(j) + largeur / 2, y: hauteurFigure - BAS + 18, class: "valeur", "data-colonne": j }, figure, texte);
    if (valeur.getComputedTextLength() > bande - 2) valeur.remove();
    });
  if (figure.querySelector(".valeur")) element("text", { x: GAUCHE - 10, y: hauteurFigure - BAS + 18, class: "graduation nets" }, figure, NETS[mode]);
  if (vide) return;
  revenu.forEach(function (r, j) {
    const zone = element("rect", { x: GAUCHE + bande * j, y: HAUT, width: bande, height: hauteurFigure - HAUT, class: "zone" }, figure);
    zone.addEventListener("pointerenter", function (evenement) {
      remplirDetail(ventilation.survols[j], piles, j, nets[j], mode, unite);
      detail.hidden = false;
      placerDetail(evenement);
      });
    zone.addEventListener("pointermove", placerDetail);
    zone.addEventListener("pointerleave", function (evenement) {
      if (evenement.pointerType === "mouse") detail.hidden = true;
      });
    });
  }

function mettreAJour() {
  const valeurs = masses();
  mettreAJourSoldes(valeurs);
  dessiner(valeurs);
  }

formulaire.addEventListener("input", mettreAJour);
formulaire.addEventListener("reset", function () { setTimeout(mettreAJour); });
formulaire.addEventListener("click", function (evenement) {
  const indice = evenement.target.dataset.ligne;
  if (indice === undefined) return;
  const saisie = document.getElementById("ligne" + indice);
  saisie.value = saisie.defaultValue;
  mettreAJour();
  });
document.querySelector(".graphique").addEventListener("change", mettreAJour);
document.addEventListener("pointerdown", function (evenement) {
  if (!evenement.target.classList.contains("zone")) detail.hidden = true;
  });
new ResizeObserver(function () { dessiner(masses()); }).observe(figure);

const visite = document.getElementById("visite");
const carte = visite.querySelector(".carte");
const zones = { panneau: formulaire, graphique: document.querySelector(".graphique") };
const ETAPES = [
  { floutes: ["panneau", "graphique"], bouton: "Suivant →" },
  { floutes: ["graphique"], cible: "panneau", bouton: "Suivant →" },
  { floutes: ["panneau"], cible: "graphique", bouton: "OK" },
  ];
let etape = 0;

function effetReforme() {
  const ventilation = DONNEES.ventilations.find(function (v) { return v.code === "101"; });
  const ligne = LIGNES[DONNEES.reforme.ligne];
  const effet = ventilation.profils[DONNEES.reforme.ligne][0] * DONNEES.reforme.ecart / ligne.defaut;
  return nombre(Math.abs(100 * effet / ventilation.revenu[0]), CHIFFRES.pct);
  }

function visible(rectangle) {
  return rectangle.bottom > 0 && rectangle.top < window.innerHeight;
  }

function hauteurVisible(rectangle) {
  return Math.max(0, Math.min(rectangle.bottom, window.innerHeight) - Math.max(rectangle.top, 0));
  }

function placerCarte() {
  const floutes = ETAPES[etape].floutes;
  const rectangle = floutes.length === 1 ? zones[floutes[0]].getBoundingClientRect() : null;
  carte.style.left = "";
  carte.style.top = "";
  carte.style.bottom = "";
  if (rectangle && !visible(rectangle)) {
    carte.style.left = (window.innerWidth - carte.offsetWidth) / 2 + "px";
    carte.style.bottom = "16px";
    return;
    }
  const haut = rectangle ? Math.max(rectangle.top, 0) : 0;
  const bas = rectangle ? Math.min(rectangle.bottom, window.innerHeight) : window.innerHeight;
  const centreX = rectangle ? (rectangle.left + rectangle.right) / 2 : window.innerWidth / 2;
  const gauche = Math.min(Math.max(centreX - carte.offsetWidth / 2, 16), window.innerWidth - carte.offsetWidth - 16);
  const sommet = Math.min(Math.max((haut + bas - carte.offsetHeight) / 2, 16), window.innerHeight - carte.offsetHeight - 16);
  carte.style.left = gauche + "px";
  carte.style.top = sommet + "px";
  }

function afficherEtape() {
  const courante = ETAPES[etape];
  Object.keys(zones).forEach(function (nom) {
    zones[nom].classList.toggle("floute", courante.floutes.includes(nom));
    });
  figure.classList.toggle("mise-en-avant", etape === 2);
  if (etape === 2) {
    ["mode_variation", "ventilation_101", "unite_pct"].forEach(function (id) { document.getElementById(id).checked = true; });
    mettreAJour();
    }
  if (courante.cible && hauteurVisible(zones[courante.cible].getBoundingClientRect()) < window.innerHeight / 2) {
    zones[courante.cible].scrollIntoView({ block: "start" });
    }
  carte.querySelector("p").textContent = DONNEES.visite[etape].replace("{effet}", effetReforme());
  carte.querySelector("button").textContent = courante.bouton;
  visite.hidden = false;
  placerCarte();
  carte.querySelector("button").focus();
  }

function terminerVisite() {
  visite.hidden = true;
  figure.classList.remove("mise-en-avant");
  Object.keys(zones).forEach(function (nom) { zones[nom].classList.remove("floute"); });
  retenirVisite();
  }

function visiteVue() {
  try {
    return localStorage.getItem("visite_vue") === "1";
    }
  catch (erreur) {
    return false;
    }
  }

function retenirVisite() {
  try {
    localStorage.setItem("visite_vue", "1");
    return true;
    }
  catch (erreur) {
    return false;
    }
  }

function commencerVisite() {
  etape = 0;
  afficherEtape();
  }

carte.querySelector("button").addEventListener("click", function () {
  if (etape === ETAPES.length - 1) {
    terminerVisite();
    }
  else {
    etape += 1;
    afficherEtape();
    }
  });
document.addEventListener("keydown", function (evenement) {
  if (evenement.key === "Escape" && !visite.hidden) terminerVisite();
  });
window.addEventListener("resize", function () { if (!visite.hidden) placerCarte(); });
document.getElementById("revoir").addEventListener("click", function (evenement) {
  evenement.preventDefault();
  commencerVisite();
  });

const reforme = document.getElementById("ligne" + DONNEES.reforme.ligne);
reforme.value = Math.round(10 * (LIGNES[DONNEES.reforme.ligne].defaut + DONNEES.reforme.ecart)) / 10;
mettreAJour();
if (!visiteVue()) commencerVisite();
