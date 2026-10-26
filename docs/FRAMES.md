# Créer un cadre

Un **cadre** est un dossier de deux fichiers que l'application interprète : ajouter un cadre,
c'est déposer ces fichiers, sans écrire de code. Les cadres livrés (marge unie, instantané,
35 mm, moyen format, cinéma, format réseaux) sont écrits exactement de cette façon : ils sont dans
[`src-tauri/frames/`](../src-tauri/frames) et servent d'exemples.

```
mon-cadre/
├─ frame.json   les réglages que le cadre propose (curseurs, couleurs, textes…)
└─ frame.svg    le dessin, avec un peu de calcul pour s'adapter à la taille de la photo
```

Pour l'utiliser : onglet **Cadre → Mes cadres → Importer** (une archive `.zip` de ces deux
fichiers, ou le dossier), ou dépose le `.zip` sur la fenêtre. Pendant que tu écris un cadre,
mets-le dans le dossier des cadres (**Ouvrir le dossier**) et clique sur **Recharger**.

## Démarrer le plus vite possible

1. Copie [`src-tauri/frames/padding/`](../src-tauri/frames/padding) (le plus court).
2. Change `id` et `name` dans `frame.json` : l'id doit être unique.
3. Modifie `frame.svg`, importe, regarde.

Si le cadre est refusé, l'application dit pourquoi (par exemple « il manque le repère photo »)
et le signale dans **Mes cadres**.

## Le dessin, `frame.svg`

C'est un SVG normal, où `{{ … }}` et `{% … %}` (syntaxe [Jinja](https://jinja.palletsprojects.com/))
calculent les dimensions. Tout est exprimé **en pixels, à partir de la taille de la photo** : le
même cadre sert à l'aperçu (1 800 px) et à l'export (24 Mpx) et garde les mêmes proportions.

```svg
{% set m = ((photo.short * p.width / 100) | round | int) %}
<svg xmlns="http://www.w3.org/2000/svg"
     width="{{ photo.w + m * 2 }}" height="{{ photo.h + m * 2 }}">
  <rect width="100%" height="100%" fill="{{ p.color }}"/>
  <rect id="photo" x="{{ m }}" y="{{ m }}" width="{{ photo.w }}" height="{{ photo.h }}" display="none"/>
</svg>
```

La taille du SVG (`width` et `height` de la racine) est la taille de l'image finale. Elle doit
contenir la photo, et rester raisonnable (au plus 4 fois le plus grand côté de la photo).

### Variables

|                             |                                                       |
| --------------------------- | ----------------------------------------------------- |
| `photo.w`, `photo.h`        | largeur et hauteur de la photo, en pixels             |
| `photo.short`, `photo.long` | le plus petit et le plus grand côté                   |
| `photo.portrait`            | vrai si la photo est verticale                        |
| `p.<réglage>`               | la valeur de chaque réglage déclaré dans `frame.json` |

### Repères : ce que l'application lit dans le SVG

Ce sont des `<rect>` **sans `transform`** (ni sur eux, ni sur leurs parents). Ajoute
`display="none"` : ils ne se dessinent pas.

| id               | rôle                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| `photo`          | **obligatoire.** Où poser la photo (`x`, `y`). Un `rx` arrondit ses coins. |
| `zone-<réglage>` | une zone sur laquelle on clique pour modifier ce réglage de type texte.    |
| `caption-area`   | où la légende se pose par défaut (c'est son centre qui compte).            |

### Dessous et dessus

Tout ce qui est dans le SVG se dessine **sous** la photo, sauf le groupe `<g id="over">`, dessiné
**par-dessus** (grain, poussière, bandes qui débordent sur la photo…). Ce groupe peut être
n'importe où dans le SVG, y compris dans le groupe qui enveloppe tout (c'est ce que fait Figma) :
les `transform` et `clip-path` de ses parents lui restent appliqués. Les `<defs>` et `<style>` sont
partagés par les deux calques. Le cadre « Cinéma » s'en sert pour ses bandes noires.

### Textes

Les polices disponibles sont celles de l'application. Utilise `font-family="Roboto Condensed"`,
`"Courier Prime"` ou `"Caveat"` (ou `font_family('condensed' | 'typewriter' | 'handwritten')`).
Le texte saisi par l'utilisateur est échappé automatiquement : `Tom & Jerry` ne casse pas le SVG.

### Images

Une texture ou un logo doivent être **intégrés** au SVG (`href="data:image/png;base64,…"`).
Les références à des fichiers (`file://`, chemins relatifs) sont ignorées : un cadre importé ne
peut rien lire sur ton disque.

### Fonctions utiles

|                                                |                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `text_width(texte, police, px, interlettrage)` | largeur d'un texte, pour le répéter le long d'une bande           |
| `em(police, px)`                               | le `font-size` SVG d'un texte dont la hauteur de ligne vaut `px`  |
| `ascent(police, px)`                           | distance du haut de la ligne à sa ligne de base                   |
| `font_family(police)`                          | le nom à mettre dans `font-family`                                |
| `is_dark(couleur)`                             | vrai si la couleur est sombre (choisir des perforations lisibles) |
| `barcode(graine, x, y, largeur, hauteur)`      | un code-barres de pellicule, qui prend le `fill` de son groupe    |
| filtre `frame_sequence`                        | `"24"` devient `"24    24A    25    25A"`                         |

Les boucles (`{% for i in range(n) %}`), conditions (`{% if %}`), `{% set %}`, macros et filtres
usuels (`round`, `int`, `max`, `upper`…) de Jinja fonctionnent. Attention aux séquences `{{`, `{%` et
`{#`, qui sont de la syntaxe : si ton SVG en contient par hasard, écris `{{ '{{' }}`.

Un gabarit qui boucle sans fin est arrêté (budget d'instructions) : l'application ne gèle pas.

## Les réglages, `frame.json`

```json
{
  "id": "mon-cadre",
  "name": "Mon cadre",
  "description": "Une phrase pour s'y retrouver.",
  "author": "Moi",
  "params": [
    {
      "id": "width",
      "label": "Épaisseur",
      "type": "number",
      "min": 1,
      "max": 30,
      "step": 0.5,
      "unit": "%",
      "default": 4
    },
    { "id": "color", "label": "Couleur", "type": "color", "default": "#ffffff" }
  ]
}
```

Le panneau **construit ses contrôles à partir de cette liste** : pas d'interface à écrire.

### Types de réglages

| `type`   | contrôle      | champs                                                                 |
| -------- | ------------- | ---------------------------------------------------------------------- |
| `number` | curseur       | `min`, `max`, `step`, `default`, `unit` (affichée à côté de la valeur) |
| `color`  | pastille      | `default` (`#rrggbb`)                                                  |
| `bool`   | interrupteur  | `default`                                                              |
| `text`   | champ texte   | `default`, `maxLength` (80 par défaut, 500 au plus)                    |
| `choice` | menu ou liste | `options`, `default`, `display` (`"menu"` ou `"list"`)                 |

Les valeurs reçues sont **toujours revalidées** avant d'atteindre le gabarit : hors bornes, mauvais
type, couleur mal formée ou choix inconnu retombent sur du valide.

### Champs communs

| champ       | rôle                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `section`   | titre de la section du panneau (« Réglages » par défaut)                      |
| `visibleIf` | n'afficher que si `{ "param": "stock", "equals": "amber" }` ou `"notEquals"`  |
| `hidden`    | transmis au gabarit mais absent du panneau                                    |
| `persist`   | garde la valeur choisie quand on passe à un autre cadre qui a le même réglage |
| `fromLook`  | (texte) reçoit le nom du look appliqué, en majuscules                         |

### Choix qui règlent d'autres réglages

Une option peut imposer des valeurs à d'autres réglages avec `sets` : choisir une pellicule fixe
sa couleur de support, son encre et son texte. Le panneau les applique, puis l'utilisateur peut les
retoucher.

```json
{
  "id": "stock",
  "label": "Pellicule",
  "type": "choice",
  "display": "list",
  "default": "amber",
  "options": [
    {
      "id": "amber",
      "label": "Ambre",
      "sets": { "color": "#120f0c", "ink": "#f0a63c", "text": "PORTRAIT 400" }
    }
  ]
}
```

Les identifiants d'options (`id`) ne contiennent que lettres, chiffres, `-` et `_` (pas de point).

### Autres champs du manifeste

| champ             | rôle                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `captionDefaults` | réglages de la légende repris quand on choisit ce cadre : `{ "color": "#1a1a1a", "font": "handwritten", "size": 5 }`                                           |
| `rotatePortrait`  | le gabarit est dessiné pour une photo horizontale : les photos verticales sont tournées avant, et le résultat remis d'aplomb (une pellicule défile en travers) |

## Dessiner dans Figma

1. Crée un cadre Figma à la taille d'une photo type, par exemple 3000 × 2000, et dessine ton cadre
   autour d'un rectangle qui représente la photo.
2. Nomme ce rectangle **`photo`**, tes zones de texte **`zone-<réglage>`**, la zone de légende
   **`caption-area`**, et regroupe ce qui doit passer par-dessus la photo dans un groupe **`over`**.
3. **Export → SVG**, en cochant **Include "id" attribute** : les noms de calques deviennent des `id`.
   Mets les textes en contours si tu veux une forme exacte, ou laisse-les en texte et utilise l'une
   des trois polices.
4. Ouvre le SVG dans un éditeur de texte. Remplace les nombres qui doivent s'adapter par des
   expressions (`width="3000"` → `width="{{ photo.w + 2 * m }}"`), et garde les repères en
   `display="none"`.
5. Écris le `frame.json`, importe, ajuste : **Recharger** relit le dossier.

Conseil : fais d'abord marcher un cadre fixe (sans expression), puis remplace les nombres un à un.

## Ce qui est refusé

Un cadre qui ne passe pas la validation n'est jamais chargé, et l'application dit pourquoi :

- manifeste invalide (identifiant, bornes, couleur, choix, `sets` vers un réglage inconnu…) ;
- gabarit qui ne se compile pas, ou qui utilise une variable inconnue (les fautes de frappe sont des
  erreurs, pas des blancs) ;
- SVG illisible, repère `photo` absent, repère qui n'est pas un `<rect>`, en double ou à coordonnées
  non numériques, photo qui sort du cadre, dimensions déraisonnables ;
- fichiers trop gros (manifeste 256 Ko, SVG 8 Mo, archive 16 Mo) ;
- identifiant déjà pris par un cadre livré avec l'application.

À l'import, le cadre est rendu pour de bon sur une photo d'essai (en paysage et en portrait) : un
cadre accepté ne peut pas faire planter l'aperçu plus tard. Les archives sont lues sans jamais être
extraites sur le disque, et seuls `frame.json` et `frame.svg` sont lus.
