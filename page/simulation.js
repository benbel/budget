const LIGNES = DONNEES.lignes;
const AXES = { personne: "€ par personne", pct: "% du revenu", uc: "€ par unité de consommation", md: "milliards d'euros" };
const SUFFIXES = { personne: " €", pct: " %", uc: " €", md: " Md€" };
const CHIFFRES = { personne: 0, pct: 2, uc: 0, md: 1 };
const NETS = { variation: "Effet net", niveau: "Solde net" };
const SVG = "http://www.w3.org/2000/svg";
const LARGEUR = 800;
const HAUTEUR = 520;
const HAUT = 36;
const BAS = 110;
const GAUCHE = 56;
const DROITE = 8;
const formulaire = document.getElementById("simulation");
const figure = document.getElementById("figure");

function nombre(x, chiffres) {
  const arrondi = Math.abs(x) < 0.5 * 10 ** -chiffres ? 0 : x;
  return arrondi.toLocaleString("fr-FR", { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres });
  }

function signe(x) {
  const texte = nombre(x, 1);
  return x >= 0.05 ? "+" + texte : texte;
  }

function choix(nom) {
  return document.querySelector("input[name=" + nom + "]:checked").value;
  }

function masses() {
  return LIGNES.map(function (ligne, i) {
    const valeur = document.getElementById("ligne" + i).valueAsNumber;
    return isNaN(valeur) ? ligne.defaut : valeur;
    });
  }

function somme(valeurs) {
  return valeurs.reduce(function (a, b) { return a + b; }, 0);
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
      libelle: ligne.libelle,
      couleur: ligne.couleur,
      montants: ventilation.profils[i].map(function (p) { return p * facteur; }),
      });
    });
  return resultat;
  }

function graduations(minimum, maximum) {
  const etendue = Math.max(maximum - minimum, 1e-9);
  const brut = etendue / 5;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map(function (k) { return k * puissance; }).find(function (p) { return p >= brut; });
  const resultat = [];
  for (let t = Math.ceil(minimum / pas) * pas; t <= maximum + 1e-9; t += pas) resultat.push(Math.round(t / pas) * pas);
  return resultat;
  }

function element(nom, attributs, parent, texte) {
  const noeud = document.createElementNS(SVG, nom);
  Object.keys(attributs).forEach(function (cle) { noeud.setAttribute(cle, attributs[cle]); });
  if (texte !== undefined) noeud.textContent = texte;
  parent.appendChild(noeud);
  return noeud;
  }

function infobulle(parent, libelle, categorie, valeur, unite) {
  element("title", {}, parent, libelle + "\n" + categorie + "\n" + nombre(valeur, CHIFFRES[unite]) + SUFFIXES[unite]);
  }

function dessiner(valeurs) {
  const ventilation = DONNEES.ventilations.find(function (v) { return v.code === choix("ventilation"); });
  const mode = choix("mode");
  const unite = choix("unite");
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
    return { libelle: s.libelle, couleur: s.couleur, valeurs: s.montants.map(enUnite) };
    });
  const nets = revenu.map(function (r, j) { return somme(piles.map(function (s) { return s.valeurs[j]; })); });
  const hauts = revenu.map(function (r, j) { return somme(piles.map(function (s) { return Math.max(s.valeurs[j], 0); })); });
  const bas = revenu.map(function (r, j) { return somme(piles.map(function (s) { return Math.min(s.valeurs[j], 0); })); });
  const vide = piles.length === 0;
  const extremes = vide ? [-1, 1] : [0].concat(hauts, bas, nets);
  const ticks = graduations(Math.min.apply(null, extremes), Math.max.apply(null, extremes));
  const minimum = Math.min(ticks[0], Math.min.apply(null, extremes));
  const maximum = Math.max(ticks[ticks.length - 1], Math.max.apply(null, extremes));
  const y = function (v) { return HAUT + (maximum - v) / (maximum - minimum) * (HAUTEUR - HAUT - BAS); };
  const bande = (LARGEUR - GAUCHE - DROITE) / n;
  const largeur = bande * 0.7;
  const x = function (j) { return GAUCHE + bande * j + (bande - largeur) / 2; };
  figure.replaceChildren();
  element("text", { x: 0, y: 14, class: "unite" }, figure, AXES[unite]);
  ticks.forEach(function (t) {
    element("text", { x: GAUCHE - 10, y: y(t), class: "graduation" }, figure, nombre(t, Number.isInteger(t) ? 0 : 1));
    });
  element("line", { x1: GAUCHE, x2: LARGEUR - DROITE, y1: y(0), y2: y(0), class: "zero" }, figure);
  ventilation.categories.forEach(function (lignes, j) {
    const extremites = ventilation.code === "101";
    const ancre = extremites && j === 0 ? "start" : extremites && j === n - 1 ? "end" : "middle";
    const abscisse = ancre === "start" ? x(j) : ancre === "end" ? x(j) + largeur : x(j) + largeur / 2;
    const etiquette = element("text", { x: abscisse, y: HAUTEUR - BAS + 20, class: "categorie", "text-anchor": ancre }, figure);
    lignes.forEach(function (ligne, k) {
      element("tspan", { x: abscisse, dy: k === 0 ? 0 : "1.2em" }, etiquette, ligne);
      });
    });
  revenu.forEach(function (r, j) {
    let positif = 0;
    let negatif = 0;
    piles.forEach(function (s) {
      const v = s.valeurs[j];
      const depart = v >= 0 ? positif : negatif;
      if (v >= 0) positif += v; else negatif += v;
      const rectangle = element("rect", {
        x: x(j),
        y: y(Math.max(depart, depart + v)),
        width: largeur,
        height: Math.abs(y(depart) - y(depart + v)),
        fill: s.couleur,
        class: "segment",
        }, figure);
      infobulle(rectangle, s.libelle, ventilation.survols[j], v, unite);
      });
    if (vide) return;
    const net = element("line", { x1: x(j) - 3, x2: x(j) + largeur + 3, y1: y(nets[j]), y2: y(nets[j]), class: "net" }, figure);
    infobulle(net, NETS[mode], ventilation.survols[j], nets[j], unite);
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
mettreAJour();
