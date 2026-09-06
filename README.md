# Reddit Pain Radar

Détecteur explicable d'opportunités business à partir de discussions Reddit. Développé en **TDD strict**, en
**TypeScript (mode strict) sur Node.js 22+**, avec seulement deux dépendances de développement
(`typescript`, `@types/node`) — aucune dépendance d'exécution, aucun SDK Reddit tiers.

## Sommaire

- [Architecture](#architecture)
- [Installation](#installation)
- [Commandes](#commandes)
- [Champs du rapport JSON](#champs-du-rapport-json)
- [Prérequis Reddit et variables d'environnement](#prérequis-reddit-et-variables-denvironnement)
- [Confidentialité, rétention et limites de l'API Reddit](#confidentialité-rétention-et-limites-de-lapi-reddit)
- [Avertissement TAM / SAM / SOM](#avertissement-tam--sam--som)
- [Tests](#tests)

## Architecture

Le pipeline est une chaîne de modules purs, chacun testé indépendamment (voir `TDD_LOG.md` pour le détail du
développement en TDD, tranche par tranche) :

```
fixtures/sample_posts.json ─┐
                             ├─▶ src/ingest.ts (loadPostsFromFixture) ─▶ Post[]
src/redditApi.ts (OAuth)   ─┘        (collectRedditPosts, mode --live)

Post[] ─▶ src/clustering.ts (clusterPosts) ─▶ Cluster[]
              (similarité de Jaccard sur tokens, déterministe, sans ML)

Cluster[] ─▶ src/opportunity.ts (buildOpportunities) ─▶ Opportunity[]
              (utilise src/problem.ts + src/scoring.ts)

Opportunity[] ─┬─▶ src/reportJson.ts (buildReportDict) ─▶ rapport JSON
               └─▶ src/reportHtml.ts (renderHtmlReport) ─▶ rapport HTML autonome (FR)
```

Modules principaux (`src/`) :

| Module | Rôle |
|---|---|
| `models.ts` | Type `Post` + `postFromRecord` : validation et coercition typée des champs requis (`id, title, selftext, subreddit, author, score, num_comments, created_utc, url`). |
| `ingest.ts` | Chargement d'un fixture JSON offline. Erreurs explicites (`IngestError`) pour fichier manquant, JSON invalide, champ manquant ou de mauvais type. |
| `redditApi.ts` | Adaptateur **Reddit OAuth Data API** (application-only, `client_credentials`), `fetch` natif uniquement, validation runtime stricte des listings et transport injectable pour les tests. Voir section dédiée ci-dessous. |
| `textnorm.ts` | Normalisation de texte (minuscules, suppression des URLs) et tokenisation (avec stopwords) pour le clustering. |
| `signals.ts` | Détection de 5 catégories de signaux de douleur par règles regex transparentes et auditables. |
| `problem.ts` | Extraction d'un énoncé de problème concis (phrase du post contenant un signal de douleur, sinon le titre). |
| `clustering.ts` | Clustering déterministe par similarité de Jaccard sur les tokens (glouton, ordonné par id de post). |
| `scoring.ts` | Score d'opportunité explicable, fini et borné (0–100), somme pondérée de 5 facteurs indépendants avec raisons en clair. Les contributions d'engagement négatives sont ramenées à zéro. |
| `opportunity.ts` | Assemble un `Cluster` en `Opportunity` complète (ICP suggéré, idée de MVP, étapes de validation, preuves). |
| `reportJson.ts` / `reportHtml.ts` | Génération des rapports structurés (JSON) et visuels (HTML autonome, échappement HTML strict). |
| `pipeline.ts` | Orchestration bout-en-bout : posts → clusters → opportunités → rapports. |
| `cli.ts` | Interface en ligne de commande (`node dist/src/cli.js`) avec validation des temporisations et des chemins de sortie avant lecture ou réseau. |

## Installation

```bash
node --version    # doit afficher v22 ou supérieur
npm install       # installe uniquement les devDependencies (typescript, @types/node)
npm run build     # compile src/ et test/ vers dist/
```

## Commandes

### Mode offline (fixture, recommandé pour démarrer — aucune clé requise)

```bash
npm run demo
# équivaut à :
npm run build
node dist/src/cli.js --fixture fixtures/sample_posts.json --out-json reports/demo.json --out-html reports/demo.html
```

### Mode live (Reddit OAuth Data API, application-only, bornée)

Nécessite une application Reddit approuvée et des identifiants (voir section suivante).

```bash
npm run live
# équivaut à :
npm run build
node dist/src/cli.js --live smallbusiness,freelance,startups \
  --max-items 15 --timeout 8000 --delay 2000 \
  --out-json reports/live.json --out-html reports/live.html
```

Paramètres de bornage (aucun contournement de blocage, aucun retry agressif) :

- `--max-items` : nombre maximum de posts récupérés par subreddit (borné à 100 côté API Reddit).
- `--timeout` : délai HTTP maximum en millisecondes par requête (`AbortController`), de 1 à 2 147 483 647 ms.
- `--delay` : pause en millisecondes entre deux subreddits consécutifs (politesse envers Reddit), de 0 à 2 147 483 647 ms.

Les chemins `--out-json` et `--out-html` doivent désigner deux fichiers distincts après résolution et normalisation ;
le CLI refuse sinon l'exécution avant toute lecture, écriture ou requête réseau.

Toute erreur HTTP (401 non autorisé, 403 accès refusé, 429 trop de requêtes), erreur réseau, réponse JSON invalide
ou enfant de listing mal formé est interceptée et rapportée en clair sur la sortie d'erreur, sans jamais faire
planter la collecte des autres subreddits (résultats partiels). Les champs numériques sont validés sans coercition
32 bits et les en-têtes de limite absents, mal formés ou non finis sont exposés comme `null`.

### Typecheck

```bash
npm run typecheck
```

### Tests

```bash
make test
# équivaut à :
npm test
# qui compile puis exécute :
node --test dist/test/*.js
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
subreddit, extrait) est échappé avant insertion dans la page, et les liens sont filtrés pour n'accepter que les
schémas `http`/`https` — aucune donnée utilisateur n'est interprétée comme du HTML/JS actif.

## Prérequis Reddit et variables d'environnement

Le mode `--live` utilise l'**API officielle Reddit (Data API) en OAuth**, et non plus un flux RSS public. Cela
suppose un accès explicitement approuvé par Reddit :

1. Demander l'accès via le formulaire officiel :
   https://support.reddithelp.com/hc/en-us/requests/new?ticket_form_id=14868593862164. La création d'un client
   OAuth ne vaut pas approbation.
2. Après approbation, créer le client indiqué par Reddit sur https://www.reddit.com/prefs/apps. Un client
   confidentiel capable d'utiliser `client_credentials` est requis pour ce mode application-only.
3. L'accès gratuit éligible est actuellement limité à 100 requêtes par minute et par client OAuth, moyennées sur
   une fenêtre de dix minutes. Tout usage commercial nécessite l'autorisation écrite de Reddit et peut nécessiter
   un contrat, même sous cette limite — **ce dépôt ne contourne ni ne masque cette exigence**.
4. Définir exactement ces trois variables d'environnement (jamais en dur dans le code, jamais committées) :

   ```bash
   export REDDIT_CLIENT_ID="..."
   export REDDIT_CLIENT_SECRET="..."
   export REDDIT_USER_AGENT="votre-app/1.0 (contact: vous@example.com)"
   ```

   Aucune autre variable n'est lue. Si l'une des trois manque, `--live` échoue immédiatement avec un message
   explicite sur stderr, sans écrire de rapport partiel.

5. `src/redditApi.ts` obtient un jeton via `POST https://www.reddit.com/api/v1/access_token`
   (`grant_type=client_credentials`, application-only : pas de compte utilisateur, pas de données privées),
   puis interroge `GET https://oauth.reddit.com/r/<subreddit>/new` avec `Authorization: Bearer <token>`.
   Le nom de subreddit est validé par une expression régulière stricte avant toute construction d'URL, pour
   qu'aucune valeur ne puisse détourner la requête vers un autre hôte ou chemin.

## Confidentialité, rétention et limites de l'API Reddit

- Les identifiants (`client_id`, `client_secret`) et le jeton OAuth obtenu ne sont **jamais loggés ni persistés
  sur disque** : ils ne vivent qu'en mémoire pour la durée d'une exécution du CLI.
- Seules des données déjà publiques sont collectées (posts publics via l'API officielle) ; aucune donnée
  privée, aucun message direct, aucun compte utilisateur authentifié n'est manipulé (grant application-only).
- Tout contenu supprimé de Reddit doit aussi être supprimé des copies locales. Reddit recommande en outre de
  purger systématiquement les données et contenus stockés sous 48 heures. Les rapports générés en mode `--live`
  (`reports/live.json`, `reports/live.html`) sont exclus du contrôle de version (voir `.gitignore`) ; cet outil ne
  les supprime pas automatiquement, la politique de purge reste donc la responsabilité de l'opérateur.
- Le mode `--live` respecte des limites strictes : timeout HTTP, nombre max d'items par subreddit, délai entre
  requêtes, User-Agent identifiable, lecture et exposition des en-têtes `x-ratelimit-*`. Les réponses
  401 (jeton invalide/expiré), 403 (accès refusé) et 429 (limite de débit) sont interceptées et rapportées
  explicitement, **sans retry automatique ni contournement** (pas de rotation d'identifiants, pas de
  falsification de User-Agent).
- L'usage gratuit de l'API Reddit est soumis à des quotas et est réservé à un usage non commercial ; un usage
  commercial ou à plus grand volume nécessite un accord Reddit dédié (voir section précédente). Ce dépôt ne
  fournit aucune fonctionnalité de contournement de ces limites.

## Avertissement TAM / SAM / SOM

**Le nombre de posts, d'auteurs ou de subreddits mentionnés dans ce rapport ne constitue en aucun cas une
estimation de marché.** Le score d'opportunité (0–100) mesure uniquement la force et la récurrence d'un signal de
douleur observé sur Reddit (auteurs indépendants, diversité de subreddits, engagement, diversité des signaux de
douleur, récurrence). Toute section « TAM / SAM / SOM » affichée dans le rapport est explicitement labellisée comme
une **hypothèse de travail à valider** avec des sources externes (études sectorielles, données INSEE, enquêtes
utilisateurs, etc.) avant toute décision d'investissement ou de lancement produit.

## Tests

Le développement suit un TDD strict (RED → GREEN → REFACTOR) documenté intégralement dans `TDD_LOG.md` :
chaque module a été développé en écrivant d'abord le test TypeScript, en constatant l'échec attendu (module
introuvable ou erreur de compilation), puis en implémentant le code minimal pour le faire passer.

```bash
make test
```

Couverture (84 tests) : modèle de données, ingestion (fichier manquant, JSON invalide, champs manquants/mal
typés), détection des signaux de douleur, extraction de l'énoncé du problème, clustering déterministe, scoring
explicable borné malgré les engagements négatifs, construction des opportunités, sérialisation JSON, rendu HTML (échappement anti-XSS, neutralisation
des URLs non http/https), adaptateur Reddit OAuth Data API (jeton, erreurs 401/403/429, nom de subreddit
invalide, validation runtime des enfants et champs numériques, en-têtes de rate limit mal formés, échecs partiels —
transport HTTP entièrement simulé, **aucun appel réseau réel ni identifiant requis pour lancer les tests**), pipeline
bout-en-bout (fixture → rapport), et CLI complète (temporisations bornées et prévention des alias entre fixture et
sorties ou entre sorties : chemins normalisés, liens symboliques, parents symboliques, composants symboliques
suivis de `..` et liens physiques).
