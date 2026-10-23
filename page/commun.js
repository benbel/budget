const SVG = "http://www.w3.org/2000/svg";
const figure = document.getElementById("figure");
const detail = document.getElementById("detail");

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

function somme(valeurs) {
  return valeurs.reduce(function (a, b) { return a + b; }, 0);
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

function html(nom, classe, parent, texte) {
  const noeud = document.createElement(nom);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  parent.appendChild(noeud);
  return noeud;
  }

function placerDetail(evenement) {
  const marge = 16;
  const largeur = detail.offsetWidth;
  const hauteur = detail.offsetHeight;
  let gauche = evenement.clientX + marge;
  if (gauche + largeur > window.innerWidth - 8) gauche = evenement.clientX - marge - largeur;
  const haut = Math.min(Math.max(8, evenement.clientY - hauteur / 2), window.innerHeight - hauteur - 8);
  detail.style.left = Math.max(8, gauche) + "px";
  detail.style.top = Math.max(8, haut) + "px";
  }
