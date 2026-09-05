# Journal TDD — Reddit Pain Radar

Chaque section correspond à une tranche verticale (vertical slice) développée en TDD strict :
RED (test écrit, exécuté, échec constaté) → GREEN (implémentation minimale, test passe) → REFACTOR (nettoyage, tests toujours au vert).

Commandes utilisées pour exécuter les tests d'un seul module :
`python3 -m unittest tests.test_<module> -v`

---

## Slice 1 — Modèle de données + ingestion fixture (`painradar/models.py`, `painradar/ingest.py`)

**RED**
```
python3 -m unittest tests.test_ingest -v
```
Résultat : `ModuleNotFoundError: No module named 'painradar.models'` (échec attendu, aucun code implémenté).

**GREEN**
Implémentation de `Post.from_dict` (dataclass typée, validation des champs requis) et `load_posts_from_fixture`
(chargement JSON, erreurs explicites via `IngestError` pour fichier manquant / JSON invalide / champ manquant).
Création de `fixtures/sample_posts.json` avec 15 posts synthétiques (`"synthetic": true`), dont un post hors-sujet
(bruit) pour valider que le futur détecteur de signaux ne remonte pas de faux positifs.

```
python3 -m unittest tests.test_ingest -v
```
Résultat : `Ran 4 tests in 0.002s — OK`.

**REFACTOR** : aucun nécessaire, code déjà minimal et lisible.

---

## Slice 2 — Normalisation de texte + détection des signaux de douleur (`painradar/textnorm.py`, `painradar/signals.py`)

**RED**
```
python3 -m unittest tests.test_signals -v
```
Résultat : `ModuleNotFoundError: No module named 'painradar.textnorm'` (échec attendu).

**GREEN**
Implémentation de `normalize_text` (minuscule, suppression des URLs, espaces normalisés) et `tokenize` (tokens
utiles pour le futur clustering). Implémentation de `detect_pain_signals` : règles regex explicites et lisibles,
regroupées en 5 catégories transparentes (`manual_work`, `expensive_tools`, `missing_solution`, `frustration`,
`willingness_to_pay`), avec le "pourquoi" du match conservé (`matched_phrases`) pour l'explicabilité du score.

```
python3 -m unittest tests.test_signals -v
```
Résultat : `Ran 7 tests in 0.000s — OK`.

**REFACTOR** : aucun nécessaire.

---

## Slice 3 — Extraction de l'énoncé du problème (`painradar/problem.py`)

**RED**
```
python3 -m unittest tests.test_problem -v
```
Résultat : `ModuleNotFoundError: No module named 'painradar.problem'` (échec attendu).

**GREEN**
`extract_problem_statement` découpe le corps du post en phrases, retient la première phrase contenant un signal de
douleur détecté (réutilise `detect_pain_signals`), et retombe sur le titre si aucune phrase ne matche. Troncature
propre à 220 caractères sur une limite de mot.

```
python3 -m unittest tests.test_problem -v
```
Résultat : `Ran 4 tests in 0.001s — OK`.

**REFACTOR** : aucun nécessaire.

---

## Slice 4 — Clustering déterministe par similarité de Jaccard (`painradar/clustering.py`)

**RED**
```
python3 -m unittest tests.test_clustering -v
```
Résultat : `ModuleNotFoundError: No module named 'painradar.clustering'` (échec attendu).

**GREEN**
`jaccard_similarity` (opérations pures sur sets) + `cluster_posts` : algorithme glouton stable (tri par id de post,
puis rattachement au premier cluster existant dont l'union de tokens dépasse `SIMILARITY_THRESHOLD=0.2`, sinon
nouveau cluster). Un `Cluster.label` dérive un intitulé lisible via un dictionnaire de mots-clés de catégories
(uniquement pour l'affichage, pas pour le calcul de similarité).

```
python3 -m unittest tests.test_clustering -v
```
Résultat : `Ran 7 tests in 0.000s — OK`.

**REFACTOR** : extension de la liste `STOPWORDS` dans `textnorm.py` (mots de remplissage supplémentaires) pour
réduire le bruit tokenisé sans casser les tests existants (`tests.test_signals` + `tests.test_clustering` relancés
en même temps : `Ran 14 tests — OK`).

---

## Slice 5 — Score d'opportunité explicable (`painradar/scoring.py`)

**RED**
```
python3 -m unittest tests.test_scoring -v
```
Résultat : `ModuleNotFoundError: No module named 'painradar.scoring'` (échec attendu).

**GREEN**
`score_cluster` combine 5 facteurs indépendants et pondérés (auteurs indépendants, diversité de subreddits,
engagement cumulé avec `log1p` pour éviter qu'un seul post viral écrase le score, diversité des catégories de
signaux de douleur, récurrence du cluster). Chaque facteur utilise une fonction saturante (`value/(value+half_point)`)
pour un rendement décroissant, borné à `MAX_SCORE=100`. `ScoreResult.reasons` documente chaque contribution en
français. `market_evidence_state` (faible/modérée/forte) reflète la robustesse de la preuve Reddit — jamais présenté
comme une taille de marché.

```
python3 -m unittest tests.test_scoring -v
```
Résultat : `Ran 6 tests in 0.002s — OK`.

**REFACTOR** : aucun nécessaire.

---

## Slice 6 — Construction des opportunités (`painradar/opportunity.py`)

**RED** : `python3 -m unittest tests.test_opportunity -v` → `ModuleNotFoundError: No module named 'painradar.opportunity'`.

**GREEN** : `build_opportunities` transforme chaque `Cluster` en `Opportunity` (énoncé du problème via `problem.py`,
score via `scoring.py`, confiance dérivée du score, ICP suggéré à partir des subreddits, idée de MVP, étapes de
validation génériques mais concrètes, preuves = extraits + liens vers les posts sources). Tri final par score
décroissant.

`python3 -m unittest tests.test_opportunity -v` → `Ran 4 tests in 0.001s — OK`.

**REFACTOR** : aucun nécessaire.

---

## Slice 7 — Rapport JSON structuré (`painradar/report_json.py`)

**RED** : `python3 -m unittest tests.test_report_json -v` → `ModuleNotFoundError: No module named 'painradar.report_json'`.

**GREEN** : `build_report_dict` sérialise la liste d'opportunités en dict JSON-safe (horodatage, description de la
source, avertissement TAM/SAM/SOM explicite, opportunités avec score/raisons/preuves/hypothèses de marché).

`python3 -m unittest tests.test_report_json -v` → `Ran 1 test in 0.000s — OK`.

**REFACTOR** : aucun nécessaire.

---

## Slice 8 — Rapport HTML autonome en français, avec échappement strict (`painradar/report_html.py`)

**RED** : `python3 -m unittest tests.test_report_html -v` → `ModuleNotFoundError: No module named 'painradar.report_html'`.

**GREEN** : `render_html_report` construit une page HTML autonome (CSS inline, pas de dépendance externe). Toute
donnée provenant des posts (auteur, subreddit, extrait, URL) passe par `html.escape(..., quote=True)` via le
helper `_e`. Les URLs sont en plus filtrées par `_safe_href` (seuls les schémas http/https sont autorisés comme
`href`, sinon `#`) pour bloquer les payloads `javascript:`. Premier run : échec sur le test de contenu français
(`assertIn("Opportunités", html)`) car le titre utilisait un "o" minuscule — corrigé en une ligne.

```
python3 -m unittest tests.test_report_html -v
```
Résultat après correction : `Ran 4 tests in 0.001s — OK`.

**REFACTOR** : aucun nécessaire au-delà de la correction de casse ci-dessus.

---

## Slice 9 — Collecte live bornée via flux RSS/Atom Reddit (`painradar/live.py`)

**RED** : `python3 -m unittest tests.test_live -v` → `ModuleNotFoundError: No module named 'painradar.live'`.

**GREEN** : `fetch_subreddit_feed` récupère `https://www.reddit.com/r/<sub>/.rss` via `urllib.request` (stdlib
seule), avec User-Agent explicite, timeout obligatoire, et parsing via `xml.etree.ElementTree` gérant à la fois
Atom (`<feed><entry>`) et RSS 2.0 (`<rss><channel><item>`). Toutes les erreurs sont interceptées et renvoyées sous
forme de données (`FeedResult.ok=False` + message en français), jamais levées : XML malformé, HTTP 429 (rate limit),
HTTP 403 (accès refusé), erreurs réseau (`URLError`). `collect_live_posts` orchestre plusieurs subreddits avec un
délai poli (`delay_seconds`) entre requêtes et continue même si un flux échoue (résultats partiels + erreurs par
subreddit). Aucun contournement de blocage (pas de rotation d'IP/UA, pas de retry agressif).

```
python3 -m unittest tests.test_live -v
```
Résultat : `Ran 10 tests in 0.003s — OK` (implémentation correcte dès la première passe GREEN, aucun refactor requis).

**REFACTOR** : suppression d'un import redondant (`urllib.request` en plus de `from urllib.request import ...`).

---

## Slice 10 — Orchestration pipeline + CLI (`painradar/pipeline.py`, `painradar/cli.py`, `painradar/__main__.py`)

**RED (pipeline)** : `python3 -m unittest tests.test_pipeline -v` → `ModuleNotFoundError: No module named 'painradar.pipeline'`.

**GREEN (pipeline)** : `run_pipeline` enchaîne `cluster_posts -> build_opportunities -> build_report_dict` +
`render_html_report`. `python3 -m unittest tests.test_pipeline -v` → `Ran 2 tests in 0.005s — OK`.

**RED (cli)** : `python3 -m unittest tests.test_cli -v` → échec avec
`No module named painradar.__main__; 'painradar' is a package and cannot be directly executed` (le module CLI
n'existait pas encore — échec attendu conforme à la RED).

**GREEN (cli)** : `argparse` avec mode fixture par défaut (`--fixture`) et mode live optionnel (`--live
sub1,sub2` avec `--max-items`, `--timeout`, `--delay`, `--user-agent`). Écrit les rapports JSON/HTML sur disque
(création des dossiers parents si besoin). Les erreurs d'ingestion (`IngestError`) sont interceptées et
affichées proprement sur stderr avec code de sortie 1, sans trace Python brute.

```
python3 -m unittest tests.test_cli -v
```
Résultat : `Ran 2 tests in 0.134s — OK`.

**REFACTOR** : aucun nécessaire.

---

## Slice 11 — Exclusion des posts sans signal de douleur

**RED** : ajout de `test_posts_without_pain_signals_are_excluded`, puis exécution ciblée. Le test échoue comme
attendu : un fil promotionnel neutre produisait encore une opportunité.

```bash
python3 -m unittest tests.test_pipeline.TestRunPipeline.test_posts_without_pain_signals_are_excluded -v
```

Résultat RED : `FAILED (failures=1)`.

**GREEN** : `run_pipeline` filtre désormais les posts dont le titre et le corps ne déclenchent aucune catégorie
explicite de `detect_pain_signals` avant le clustering.

Résultat GREEN ciblé : `Ran 1 test — OK`.

Vérification complète : `make test` → `Ran 55 tests — OK`; `make demo` → 15 posts analysés et 13 opportunités.
Le nouveau run live borné a analysé 5 posts et produit 0 opportunité plutôt que des faux positifs.
