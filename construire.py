import html
import json
import re
import shutil
import textwrap
from pathlib import Path

import openpyxl

ONGLET = "CND_2023"
REVENU = "Revenu élargi après transferts publics (=D+I+II+III)"
INDIVIDUS = "Nombre d'individus (en millions)"
UC = "Nombre d'unités de consommation (en millions)"

VENTILATIONS = [
    ("101", "niveau de vie (détaillé)"),
    ("102", "niveau de vie (groupes)"),
    ("103", "âge"),
    ("104", "diplôme"),
    ("105", "configuration familiale"),
    ("106", "sexe et parentalité"),
    ("107", "ville / campagne"),
    ("108", "profession de la personne de référence"),
    ("109", "profession du ménage"),
    ]

GROUPES = [
    ("prelevements", "Impôts et cotisations", "#c1121f"),
    ("prestations", "Allocations et pensions", "#1d70b8"),
    ("nature", "Services publics", "#52a02c"),
    ("monde", "Reste du monde", "#8a8580"),
    ]

DISPOSITIFS = [
    ("prelevements", "Taxes sur les produits (TVA, TICPE, acises, DMTO, etc.)"),
    ("prelevements", "Subventions sur les produits (transports, etc.)"),
    ("prelevements", "Taxes sur la production (taxes patronales, TF, etc.)"),
    ("prelevements", "Subventions sur la production (aides à l'apprentissage, aides sectorielles, etc.)"),
    ("prelevements", "Impôt sur les sociétés"),
    ("prelevements", "Contribution sociale généralisée (CSG)"),
    ("prelevements", "Impôt sur le revenu (IR)"),
    ("prelevements", "Autres impôts sur les revenus et le patrimoine (TH, ISF/IFI, CRDS, etc.)"),
    ("prelevements", "Cotisations sociales retraite"),
    ("prelevements", "Cotisations sociales chômage"),
    ("prelevements", "Cotisations sociales famille"),
    ("prelevements", "Autres cotisations sociales (maladie, invalidité, ATMP)"),
    ("prestations", "Pensions de retraite"),
    ("prestations", "Allocations chômage"),
    ("prestations", "Autres revenus de remplacement (IJ, ATMP)"),
    ("prestations", "Famille"),
    ("prestations", "Exclusion sociale"),
    ("prestations", "Invalidité"),
    ("prestations", "Remboursements des contrats collectifs de complémentaires santé"),
    ("nature", "Santé"),
    ("nature", "Enseignement"),
    ("nature", "Action sociale (dépendance, handicap, petite enfance, etc.)"),
    ("nature", "Culture et loisirs"),
    ("nature", "Aides au logement et chèque énergie"),
    ("nature", "Frais de fonctionnement de la Sécurité sociale"),
    ("nature", "Dépenses collectives (administration générale, défense, police, justice, etc.)"),
    ("monde", "Autres transferts et soldes avec le reste du monde"),
    ]

INTRO = (
    "Ce site permet de simuler les effets budgétaires (combien ça coûte ou rapporte) "
    "et redistributifs (qui gagne, qui perd) de modifier les prélèvements obligatoires, "
    "les prestations sociales et les services publics. "
    )

REFORME = ("Enseignement", 20)

VISITE = [
    INTRO.strip(),
    "Vous pouvez modifier les montants des prélèvements et des dépenses.",
    "Les effets par type de ménage sont calculés et affichés ici. Par exemple, une hausse de 20 Md€ "
    "des dépenses d'enseignement augmenterait le revenu élargi (services publics compris) "
    "des 5 % les moins aisés de {effet} %.",
    ]

METHODE = (
    '<p>Les données sont issues des '
    '<a href="https://www.insee.fr/fr/statistiques/8574663?sommaire=8574832#consulter">'
    'comptes nationaux établis par l\'Insee</a> distribués par catégorie de ménages, i.e. l\'ensemble '
    'des revenus, prélèvements, aides et services publics (transferts sociaux en nature et dépenses '
    'collectives) sont répartis entre les ménages de la population française.</p>'
    '<p>La simulation est un simple calcul arithmétique à partir des montants ventilés par catégorie '
    'de ménage : elle ne prend pas en compte les interactions entre dispositifs (par exemple, baisser '
    'les pensions ne change pas ici le montant d\'impôt sur le revenu payé sur ces pensions), ni les '
    'effets macroéconomiques. Lorsqu\'un montant est modifié, les montants de chaque catégorie sont '
    'modifiés proportionnellement au montant initial.</p>'
    )


def lire_feuille(code):
    classeur = openpyxl.load_workbook(f"sources/T_CND_{code}.xlsx", data_only=True)
    lignes = list(classeur[ONGLET].iter_rows(values_only=True))
    valeurs = {
        str(ligne[0]).strip(): list(ligne[1:])
        for ligne in lignes[1:]
        if ligne[0] is not None
        }
    return lignes[0][1:], valeurs


def nom_categorie(brut):
    nom = re.sub(r"^V", "", str(brut).strip())
    nom = re.sub(r"^[0-9]+[a-z]?\. ", "", nom)
    return re.sub(r"^[IVX]+ - ", "", nom)


def etiquette(code, brut, individus):
    nom = nom_categorie(brut)
    if code == "101" and nom == "1":
        return ["5 % les plus", "pauvres"]
    if code == "101" and nom == "20":
        return ["5 % les plus", "aisés"]
    if code == "101":
        return []
    effectif = f"{individus:.1f}".replace(".", ",")
    return textwrap.wrap(f"{nom} ({effectif} millions de personnes)", 18)


def eclaircir(couleur, t):
    composantes = [int(couleur[k:k + 2], 16) for k in (1, 3, 5)]
    return "#" + "".join(f"{round(c + (255 - c) * t):02x}" for c in composantes)


def nuances(couleur, n):
    return [eclaircir(couleur, 0.6 * i / max(n - 1, 1)) for i in range(n)]


def preparer_lignes(valeurs_101):
    lignes = []
    for groupe, _, couleur in GROUPES:
        siens = [libelle for g, libelle in DISPOSITIFS if g == groupe]
        for libelle, teinte in zip(siens, nuances(couleur, len(siens))):
            ensemble = valeurs_101[libelle][-1]
            lignes.append({
                "groupe": groupe,
                "libelle": libelle,
                "defaut": round(abs(ensemble), 1),
                "signe": 1 if ensemble > 0 else -1,
                "couleur": teinte,
                })
    return lignes


def nom_survol(code, brut, individus):
    nom = nom_categorie(brut)
    if code == "101":
        rang = int(nom)
        suffixe = "er" if rang == 1 else "e"
        return f"{rang}{suffixe} vingtième (entre {5 * (rang - 1)}% et {5 * rang}%)"
    return " ".join(etiquette(code, brut, individus))


def preparer_ventilation(code, lignes):
    entete, valeurs = lire_feuille(code)
    return {
        "code": code,
        "survols": [
            nom_survol(code, brut, individus)
            for brut, individus in zip(entete[:-1], valeurs[INDIVIDUS])
            ],
        "categories": [
            etiquette(code, brut, individus)
            for brut, individus in zip(entete[:-1], valeurs[INDIVIDUS])
            ],
        "profils": [valeurs[ligne["libelle"]][:-1] for ligne in lignes],
        "revenu": valeurs[REVENU][:-1],
        "individus": valeurs[INDIVIDUS][:-1],
        "uc": valeurs[UC][:-1],
        }


def e(texte):
    return html.escape(texte, quote=True)


def ligne_saisie(indice, ligne):
    return (
        f'<div class="ligne">'
        f'<label for="ligne{indice}">{e(ligne["libelle"])}</label>'
        f'<input type="number" id="ligne{indice}" name="ligne{indice}" step="0.1" min="0" value="{ligne["defaut"]}">'
        f'<span class="modif" id="modif{indice}" hidden>'
        f'<span></span>'
        f'<button type="button" data-ligne="{indice}" title="Revenir à la valeur actuelle">×</button>'
        f'</span>'
        f'</div>'
        )


def bloc_saisie(groupe, titre, lignes):
    entete = f'<div class="ligne titre"><h2>{e(titre)}</h2><span>Md€</span><span></span></div>'
    contenu = [ligne_saisie(i, ligne) for i, ligne in enumerate(lignes) if ligne["groupe"] == groupe]
    return entete + "".join(contenu)


def ligne_solde(identifiant, libelle):
    return (
        f'<div class="solde"><span>{e(libelle)}</span>'
        f'<output id="{identifiant}"></output><output id="{identifiant}_part"></output></div>'
        )


def bascule(nom, valeur, libelle, coche):
    attribut = " checked" if coche else ""
    return (
        f'<label><input type="radio" name="{nom}" id="{nom}_{valeur}" value="{valeur}"{attribut}>'
        f'<span>{e(libelle)}</span></label>'
        )


def groupe_bascules(nom, options, intitule=""):
    debut = f'<span class="intitule">{e(intitule)}</span>' if intitule else ""
    contenu = [bascule(nom, valeur, libelle, i == 0) for i, (valeur, libelle) in enumerate(options)]
    return f'<div class="bascules">{debut}{"".join(contenu)}</div>'


def element_legende(classe, texte, couleur, mode):
    style = f' style="background: {couleur}"' if couleur else ""
    return f'<span class="{mode}"><span class="{classe}"{style}></span>{e(texte)}</span>'


def page(lignes, ventilations):
    groupes = [{"groupe": groupe, "titre": titre, "couleur": couleur} for groupe, titre, couleur in GROUPES]
    reforme = {"ligne": next(i for i, ligne in enumerate(lignes) if ligne["libelle"] == REFORME[0]), "ecart": REFORME[1]}
    donnees = json.dumps(
        {"groupes": groupes, "lignes": lignes, "ventilations": ventilations, "reforme": reforme, "visite": VISITE},
        ensure_ascii=False,
        )
    legende = [element_legende("carre", titre, couleur, "") for _, titre, couleur in GROUPES]
    legende.append(element_legende("trait", "Effet net", "", "variation"))
    legende.append(element_legende("trait", "Solde net", "", "niveau"))
    return (
        '<!doctype html>'
        '<html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>Le budget dont vous êtes le héros</title>'
        '<link rel="stylesheet" href="style.css">'
        '</head><body><div class="page">'
        '<form class="panneau" id="simulation">'
        '<h1>Le budget dont vous êtes le héros</h1>'
        f'<p class="intro">{e(INTRO)}[<a href="#methode">voir méthode</a>] '
        '[<a href="#" id="revoir">présentation</a>]</p>'
        '<div class="soldes">'
        + ligne_solde("economie", "Économie budgétaire")
        + ligne_solde("economie_prelevements", "dont impôts et cotisations")
        + ligne_solde("economie_depenses", "dont dépenses")
        + '</div>'
        '<div class="actions"><button type="reset">Tout réinitialiser</button></div>'
        + "".join(bloc_saisie(groupe, titre, lignes) for groupe, titre, _ in GROUPES)
        + f'<section class="methode" id="methode"><h2>Méthode</h2>{METHODE}</section>'
        '</form>'
        '<div class="graphique">'
        + groupe_bascules("mode", [("variation", "Effets des réformes"), ("niveau", "Nouveaux montants avec les réformes")])
        + groupe_bascules("ventilation", VENTILATIONS, "Voir les résultats par")
        + groupe_bascules(
            "unite",
            [
                ("personne", "€ par personne"),
                ("pct", "% du revenu"),
                ("uc", "€ par unité de consommation"),
                ("md", "milliards d'euros"),
                ],
            "Unité :",
            )
        + '<svg id="figure" role="img"></svg>'
        + '<div id="detail" hidden></div>'
        + f'<div class="legende">{"".join(legende)}</div>'
        '</div>'
        '</div>'
        '<div id="visite" hidden><div class="carte" role="dialog" aria-modal="true" aria-live="polite">'
        '<p></p><button type="button"></button></div></div>'
        f'<script>const DONNEES = {donnees};</script>'
        '<script src="simulation.js"></script>'
        '</body></html>'
        )


def construire():
    _, valeurs_101 = lire_feuille("101")
    absents = [libelle for _, libelle in DISPOSITIFS if libelle not in valeurs_101]
    if absents:
        raise SystemExit("Lignes absentes : " + " ; ".join(absents))
    lignes = preparer_lignes(valeurs_101)
    ventilations = [preparer_ventilation(code, lignes) for code, _ in VENTILATIONS]
    sortie = Path("site")
    sortie.mkdir(exist_ok=True)
    (sortie / "index.html").write_text(page(lignes, ventilations), encoding="utf-8")
    shutil.copy("page/style.css", sortie / "style.css")
    shutil.copy("page/simulation.js", sortie / "simulation.js")


construire()
