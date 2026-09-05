# Reddit Pain Radar

Détecteur explicable d'opportunités business à partir de discussions Reddit. Preuve de concept (POC) développée
en TDD strict, en **Python 3.11+ standard library uniquement** (aucune dépendance pip), **sans clé API requise**.

## Sommaire

- [Architecture](#architecture)
- [Installation](#installation)
- [Commandes](#commandes)
- [Champs du rapport JSON](#champs-du-rapport-json)
- [Confidentialité et limites de l'API Reddit](#confidentialité-et-limites-de-lapi-reddit)
- [Avertissement TAM / SAM / SOM](#avertissement-tam--sam--som)
- [Ajouter l'OAuth Reddit plus tard](#ajouter-loauth-reddit-plus-tard)
- [Tests](#tests)

## Architecture

Le pipeline est une chaîne de modules purs, chacun testable indépendamment (voir `TDD_LOG.md` pour le détail du
développement en TDD, module par module) :

```
fixtures/sample_posts.json ─┐
                             ├─▶ painradar.ingest.load_posts_from_fixture ─▶ [Post]
painradar.live (RSS/Atom)  ─┘        (ou painradar.live.collect_live_posts)

[Post] ─▶ painradar.clustering.cluster_posts ─▶ [Cluster]
              (similarité de Jaccard sur tokens, déterministe, sans ML)

[Cluster] ─▶ painradar.opportunity.build_opportunities ─▶ [Opportunity]
              (utilise painradar.problem + painradar.scoring)

[Opportunity] ─┬─▶ painradar.report_json.build_report_dict ─▶ rapport JSON
               └─▶ painradar.report_html.render_html_report ─▶ rapport HTML autonome (FR)
```

Modules principaux (`painradar/`) :

| Module | Rôle |
|---|---|
| `models.py` | Dataclass `Post` typée + validation des champs requis (`id, title, selftext, subreddit, author, score, num_comments, created_utc, url`). |
| `ingest.py` | Chargement d'un fixture JSON offline. Erreurs explicites (`IngestError`) pour fichier manquant, JSON invalide, champ manquant ou de mauvais type. |
| `live.py` | Collecte **bornée** de posts publics via les flux RSS/Atom de subreddits (`https://www.reddit.com/r/<sub>/.rss`). |
| `textnorm.py` | Normalisation de texte (minuscules, suppression des URLs) et tokenisation (avec stopwords) pour le clustering. |
| `signals.py` | Détection de 5 catégories de signaux de douleur par règles regex transparentes et auditables. |
| `problem.py` | Extraction d'un énoncé de problème concis (phrase du post contenant un signal de douleur, sinon le titre). |
| `clustering.py` | Clustering déterministe par similarité de Jaccard sur les tokens (glouton, ordonné par id de post). |
| `scoring.py` | Score d'opportunité explicable (0–100), somme pondérée de 5 facteurs indépendants avec raisons en clair. |
| `opportunity.py` | Assemble un `Cluster` en `Opportunity` complète (ICP suggéré, idée de MVP, étapes de validation, preuves). |
| `report_json.py` / `report_html.py` | Génération des rapports structurés (JSON) et visuels (HTML autonome, échappement HTML strict). |
| `pipeline.py` | Orchestration bout-en-bout : posts → clusters → opportunités → rapports. |
| `cli.py` / `__main__.py` | Interface en ligne de commande (`python3 -m painradar`). |

## Installation

Aucune installation de dépendance n'est nécessaire : seule la bibliothèque standard de Python 3.11+ est utilisée.

```bash
python3 --version   # doit afficher Python 3.11 ou supérieur
```

## Commandes

### Mode offline (fixture, recommandé pour démarrer)

```bash
python3 -m painradar \
  --fixture fixtures/sample_posts.json \
  --out-json reports/demo.json \
  --out-html reports/demo.html
```

Ou via le Makefile :

```bash
make demo
```

### Mode live (flux RSS publics de subreddits, bornée et polie)

```bash
python3 -m painradar \
  --live smallbusiness,freelance,startups \
  --max-items 15 \
  --timeout 8 \
  --delay 2 \
  --out-json reports/live.json \
  --out-html reports/live.html
```

Ou via le Makefile :

```bash
make live
```

Paramètres de bornage (aucune clé API, aucun contournement) :

- `--max-items` : nombre maximum de posts récupérés par flux.
- `--timeout` : délai HTTP maximum en secondes par requête.
- `--delay` : pause en secondes entre deux flux consécutifs (politesse envers Reddit).
- `--user-agent` : User-Agent HTTP explicite envoyé à chaque requête (identifiable, pas de usurpation).

Toute erreur HTTP (429 trop de requêtes, 403 accès refusé), erreur réseau, ou flux XML malformé est interceptée et
rapportée en clair sur la sortie d'erreur, sans jamais faire planter la collecte des autres subreddits (résultats
partiels).

### Tests

```bash
make test
# équivaut à :
python3 -m unittest discover -s tests -v
```

## Champs du rapport JSON

```jsonc
{
  "generated_at": "2026-...T...Z",
  "source_description": "fixture: fixtures/sample_posts.json",
  "disclaimer": "…voir avertissement TAM/SAM/SOM…",
  "opportunities": [
    {
      "label": "facturation / paiements",
      "problem_statement": "Énoncé concis du problème",
      "confidence": "faible | moyenne | élevée",
      "suggested_icp": "Profil client suggéré",
      "mvp_idea": "Idée de produit minimal viable",
      "validation_steps": ["Étape 1", "Étape 2", "..."],
      "score": {
        "total": 0.0,
        "reasons": ["Raison explicable n°1", "..."],
        "market_evidence_state": "faible | modérée | forte"
      },
      "evidence": [
        {"post_id": "...", "author": "...", "subreddit": "...", "url": "...", "excerpt": "..."}
      ],
      "market_size_hypotheses": {
        "note": "Hypothèses non validées, à confirmer avec des sources externes.",
        "tam": "...", "sam": "...", "som": "..."
      }
    }
  ]
}
```

Le rapport HTML (`reports/demo.html`) présente les mêmes informations sous forme de cartes d'opportunités, en
français, avec liens et extraits vers les posts sources. Tout contenu provenant des posts (titre, auteur,
subreddit, extrait) est échappé via `html.escape` avant insertion dans la page, et les liens sont filtrés pour
n'accepter que les schémas `http`/`https` — aucune donnée utilisateur n'est interprétée comme du HTML/JS actif.

## Confidentialité et limites de l'API Reddit

- Ce POC n'utilise **aucune clé API Reddit** et **aucune authentification OAuth**. Le mode `--live` lit uniquement
  les flux RSS/Atom **publics** des subreddits (`https://www.reddit.com/r/<subreddit>/.rss`), au même titre qu'un
  lecteur de flux classique.
- Les données collectées sont des posts déjà publics ; aucune donnée privée, aucun message direct, aucun compte
  utilisateur authentifié n'est manipulé.
- Le mode `--live` respecte des limites strictes : timeout, nombre max d'items par flux, délai entre requêtes,
  User-Agent identifiable. Aucune tentative de contournement de blocage (pas de rotation d'IP/UA, pas de retry
  agressif en cas de 429/403).
- Reddit peut à tout moment limiter, ralentir ou bloquer l'accès aux flux RSS non authentifiés ; ce comportement
  est attendu et signalé proprement (voir gestion des erreurs dans `painradar/live.py`), jamais contourné.
- Pour un usage en production à plus grande échelle, il est recommandé de passer à l'API officielle Reddit avec
  authentification OAuth (voir section suivante) et de respecter les conditions d'utilisation et les limites de
  taux (rate limits) officielles de Reddit.

## Avertissement TAM / SAM / SOM

**Le nombre de posts, d'auteurs ou de subreddits mentionnés dans ce rapport ne constitue en aucun cas une
estimation de marché.** Le score d'opportunité (0–100) mesure uniquement la force et la récurrence d'un signal de
douleur observé sur Reddit (auteurs indépendants, diversité de subreddits, engagement, diversité des signaux de
douleur, récurrence). Toute section « TAM / SAM / SOM » affichée dans le rapport est explicitement labellisée comme
une **hypothèse de travail à valider** avec des sources externes (études sectorielles, données INSEE, enquêtes
utilisateurs, etc.) avant toute décision d'investissement ou de lancement produit.

## Ajouter l'OAuth Reddit plus tard

Le mode `--live` actuel se limite volontairement aux flux RSS publics (aucune clé requise). Pour évoluer vers
l'API officielle Reddit avec OAuth :

1. Créer une application sur https://www.reddit.com/prefs/apps (type "script" ou "web app").
2. Récupérer `client_id` et `client_secret`, et les fournir via des variables d'environnement (jamais en dur dans
   le code), par exemple `REDDIT_CLIENT_ID` et `REDDIT_CLIENT_SECRET`.
3. Implémenter un nouveau module (ex. `painradar/reddit_api.py`) qui obtient un token OAuth via
   `POST https://www.reddit.com/api/v1/access_token` (grant type adapté à l’application), puis interroge
   `https://oauth.reddit.com/r/<subreddit>/new` avec l’en-tête `Authorization: bearer <token>`.
4. Ce nouveau module devrait produire des objets `Post` (mêmes champs que `models.Post`) afin de rester compatible
   avec `painradar.clustering`, `painradar.scoring`, `painradar.opportunity` et les rapports sans aucune
   modification de ces derniers.
5. Ajouter un mode CLI supplémentaire (ex. `--live-oauth`) réutilisant les mêmes garde-fous que `--live` actuel :
   timeout, `max_items`, délai poli entre requêtes, gestion explicite des erreurs HTTP/429/403.
6. Respecter les règles de l’API Reddit : rate limits officiels, User-Agent conforme aux exigences Reddit, et ne
   jamais committer de secrets (`client_secret`, tokens) dans le dépôt — utiliser un fichier `.env` non versionné
   (déjà exclu par `.gitignore`).

## Tests

Le développement suit un TDD strict (RED → GREEN → REFACTOR) documenté intégralement dans `TDD_LOG.md` :
chaque module a été développé en écrivant d'abord le test, en constatant l'échec attendu, puis en implémentant le
code minimal pour le faire passer.

```bash
make test
```

Couverture : modèle de données, ingestion (fichier manquant, JSON invalide, champs manquants/mal typés), détection
des signaux de douleur, extraction de l'énoncé du problème, clustering déterministe, scoring explicable,
construction des opportunités, sérialisation JSON, rendu HTML (échappement anti-XSS), parsing de flux Atom/RSS
(y compris flux malformés et erreurs HTTP/réseau), pipeline bout-en-bout (fixture → rapport), et CLI complète.
