# Guide d'import CSV + images

Ce document décrit **comment réussir un import** et **les pièges spécifiques à nos données**.
Il accompagne la page *Back-office → Import des données* et l'endpoint `POST /api/import`.

---

## 1. Vue d'ensemble : 3 feuilles ≠ 3 fois la même chose

L'import attend **jusqu'à 3 fichiers CSV de natures différentes** + **1 ZIP d'images**.
Le type de chaque CSV est **détecté automatiquement à partir de ses en-têtes** (l'ordre des fichiers n'a aucune importance).

| Feuille | Type détecté | Table cible | En-têtes attendus |
|---------|--------------|-------------|-------------------|
| 1 | **Matériel (items)** | `items` | `Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User` |
| 2 | **Tickets** | `tickets` (+ `ticket_items`) | `Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items` |
| 3 | **Coûts / temps** | `ticket_costs` | `Num_Ticket, Duration_second, Time_Cost, Fixed_Cost` |

Règle de détection (`detectSheet`) :
- contient `Num_Ticket` + (`Duration_second` ou `Fixed_Cost`) → **costs**
- contient `Titre`/`Title` + (`Ref_Ticket` ou `Items`) → **tickets**
- contient `Item_Type`, ou `Name` + `Inventory_Number` → **items**
- sinon, présence d'un `Name`/`Nom` → **items** ; à défaut → **unknown** (ignoré, signalé).

---

## 2. Règles générales pour un import réussi

1. **Prévisualiser avant d'importer.** Le bouton *Prévisualiser* appelle `POST /api/import/preview` :
   il affiche, pour chaque fichier, le **type détecté**, les **en-têtes**, les **5 premières lignes**
   et les **avertissements** — sans rien écrire en base. Vérifiez que chaque feuille est bien
   reconnue (badge bleu/violet/orange) avant de lancer l'import.

2. **Respecter les noms d'en-têtes.** La reconnaissance des colonnes est insensible à la casse et
   aux accents, mais le **libellé doit correspondre** à un alias connu (voir tableau §4).
   Une colonne mal nommée = donnée silencieusement ignorée.

3. **Ordre d'import géré automatiquement.** Le serveur traite toujours **items → tickets → coûts**,
   car les tickets référencent des items (par `Name`) et les coûts référencent des tickets
   (par `Ref_Ticket`). Vous pouvez déposer les 3 fichiers ensemble.

4. **Encodage UTF-8.** Les CSV doivent être en UTF-8 (le BOM est toléré). Un fichier enregistré en
   ANSI/Windows-1252 affichera des accents cassés (`Comptabilité` → `Comptabilité`).

5. **Le ZIP d'images est facultatif** mais nécessaire pour lier les photos. Les images sont
   rattachées **par nom** : `PC-ADM-001.png` est associé à l'item dont `Name = PC-ADM-001`.

6. **Import idempotent (upsert).** Relancer le même import **ne crée pas de doublons** :
   - un **item** est identifié par son `Name` → mis à jour ;
   - un **ticket** par son `Ref_Ticket` → mis à jour, ses liens items reconstruits ;
   - les **coûts** d'un ticket sont purgés puis réinsérés (pas d'empilement).

7. **Lire le rapport d'import.** Après l'import, chaque fichier indique :
   `créés` / `mis à jour` / `ignorés` (avec **n° de ligne + raison**) + avertissements,
   et un bilan global (dont `images liées / extraites`).

---

## 3. Pièges spécifiques à NOS données (à connaître absolument)

> Ces points correspondent à des bugs réels de l'ancien import, désormais corrigés.
> Ils restent valables comme règles à respecter côté fichiers sources.

### 3.1 `Item_Type` ≠ `type`
La colonne de catégorie s'appelle **`Item_Type`** (et non `Type`). L'alias est géré, mais ne la
renommez pas en `Type` dans la feuille Matériel — `Type` est réservé aux **tickets**
(Incident/Request). Valeurs attendues : `Computer`, `Monitor`, …

### 3.2 Le numéro d'inventaire est dans `Inventory_Number`
Il alimente le champ `serial` **et** `inventory_number`. Il n'y a pas de colonne `Serial` dans nos
exports — ne pas s'attendre à ce mapping.

### 3.3 Aucune colonne « image » dans le CSV → lien par le NOM
La feuille Matériel **ne contient pas** de colonne image. Le rapprochement se fait sur le nom :
le fichier image doit s'appeler **exactement comme `Name`** (extension libre : `.png`, `.jpg`,
`.jpeg`, `.gif`, `.webp`). Ex. `MN-FORM-002.png` ↔ item `MN-FORM-002`.
Les items sans image correspondante génèrent un **avertissement** (pas une erreur).

### 3.4 ZIP créé sur macOS = entrées parasites
Un ZIP fait sous macOS contient un dossier `__MACOSX/` et des fichiers `._NomImage` (resource
forks). L'import les **ignore** automatiquement (ainsi que tout fichier non-image). Inutile de les
nettoyer, mais ne vous fiez pas au nombre brut d'entrées du ZIP.

### 3.5 Colonne `Items` des tickets = tableau JSON de **noms**
Exemple : `["PC-ADM-001","MN-FORM-002"]`. Chaque nom est résolu vers un item existant pour créer le
lien `ticket_items`.
- Importez **la feuille Matériel d'abord** (fait automatiquement si les 3 fichiers sont déposés ensemble).
- Un nom inconnu n'échoue pas l'import : il produit un **avertissement** « item introuvable ».
- Format toléré en secours : liste séparée par `;`, `,` ou `|` si ce n'est pas du JSON valide.

### 3.6 Décimales à la française : `Time_Cost = "8,7"`
La feuille Coûts utilise la **virgule décimale** (`8,7`). Comme le séparateur CSV est aussi la
virgule, ces valeurs sont **entre guillemets** dans le fichier — ne retirez pas les guillemets.
Le parseur convertit `"8,7"` → `8.7` (et non `8`). Conservez ce format ou utilisez le point.

### 3.7 Plusieurs lignes de coût par ticket
Un même `Num_Ticket` peut apparaître sur **plusieurs lignes** (ex. ticket 1 = 2 lignes de coût).
C'est normal et conservé. À chaque ré-import, les coûts du ticket sont **remplacés** (pas additionnés).

### 3.8 Un coût orphelin est rejeté (pas perdu en silence)
Une ligne de coût dont le `Num_Ticket` ne correspond à aucun ticket importé est **listée dans
« lignes ignorées »** avec la raison « ticket réf. X introuvable ». Importez la feuille Tickets
avant (ou en même temps).

### 3.9 Lignes vides / sans clé
- Item sans `Name` → ignoré (raison « Nom (Name) manquant »).
- Ticket sans `Titre` → ignoré.
- Coût sans `Num_Ticket` → ignoré.
Toutes ces lignes apparaissent dans le rapport avec leur **numéro de ligne**.

---

## 4. Tableau des alias de colonnes reconnus

| Champ cible | Alias acceptés (insensible casse/accents) |
|-------------|-------------------------------------------|
| item.name | `name`, `nom`, `item`, `designation`, `libelle` |
| item.type | `item_type`, `type`, `category`, `categorie` |
| item.serial / inventory_number | `inventory_number`, `serial`, `serie`, `sn`, `serial number`, `numero de serie` |
| item.status | `status`, `statut`, `etat` |
| item.location | `location`, `lieu`, `emplacement` |
| item.manufacturer | `manufacturer`, `fabricant`, `marque` |
| item.model | `model`, `modele` |
| item.assigned_user | `user`, `utilisateur`, `assigned_user` |
| ticket.title | `titre`, `title`, `name`, `nom` |
| ticket.ref_ticket | `ref_ticket`, `ref`, `reference`, `num_ticket` |
| ticket.description | `description`, `desc`, `detail` |
| ticket.status | `status`, `statut`, `etat` |
| ticket.type | `type` |
| ticket.priority | `priority`, `priorite` |
| ticket items (liens) | `items`, `item`, `assets` |
| cost.ref | `num_ticket`, `ref_ticket`, `ticket`, `ref` |
| cost.duration_second | `duration_second`, `duration`, `duree` |
| cost.time_cost | `time_cost`, `cout_temps` |
| cost.fixed_cost | `fixed_cost`, `cout_fixe`, `cout` |

---

## 5. Checklist avant import

- [ ] Les 3 CSV sont en **UTF-8**.
- [ ] En-têtes conformes (`Item_Type`, `Inventory_Number`, `Ref_Ticket`, `Num_Ticket`…).
- [ ] Colonne `Items` des tickets = **tableau JSON de noms d'items existants**.
- [ ] Décimales des coûts entre guillemets (`"8,7"`) ou avec un point.
- [ ] Noms d'images = `Name` de l'item, dans `images.zip`.
- [ ] **Prévisualiser** : 3 badges corrects, 0 avertissement bloquant.
- [ ] Lancer l'import, puis **lire le rapport** (créés / mis à jour / ignorés / images liées).
