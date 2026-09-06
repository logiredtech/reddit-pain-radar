# Journal TDD — Reddit Pain Radar (TypeScript)

Migration complète de Python vers TypeScript, en TDD strict par tranche verticale :
RED (test écrit dans `test/`, `tsc` échoue avec « Cannot find module »/erreur de compilation) →
GREEN (implémentation minimale dans `src/`, `npm test` passe) → REFACTOR si nécessaire.

Commande utilisée pour un run complet : `npm test` (compile puis exécute `node --test dist/test/*.js`).

---

## Slice 1 — Modèle de données + ingestion fixture (`src/models.ts`, `src/ingest.ts`)

RED : `test/test_ingest.ts` ajouté → `tsc` échoue avec
`Cannot find module '../src/models.js'` / `'../src/ingest.js'`.

GREEN : `postFromRecord` (validation des champs requis + coercition typée) et
`loadPostsFromFixture` (erreurs explicites via `IngestError` pour fichier manquant,
JSON invalide, JSON non-liste, champ manquant ou de mauvais type). 7 tests OK.

## Slice 2 — Normalisation de texte + signaux de douleur (`src/textnorm.ts`, `src/signals.ts`)

RED : `tsc` échoue, modules absents. GREEN : `normalizeText`/`tokenize` (stopwords)
et `detectPainSignals` (5 catégories regex identiques au POC Python). 8 tests OK.

## Slice 3 — Extraction de l'énoncé du problème (`src/problem.ts`)

RED → GREEN : `extractProblemStatement` découpe en phrases, retient la première
phrase à signal de douleur, sinon retombe sur le titre ; troncature à 220 caractères.
4 tests OK.

## Slice 4 — Clustering déterministe par similarité de Jaccard (`src/clustering.ts`)

RED → GREEN : `jaccardSimilarity` + `clusterPosts` (glouton, trié par id de post,
seuil `SIMILARITY_THRESHOLD = 0.2`), `Cluster.label` dérivé de mots-clés. 7 tests OK.

## Slice 5 — Score d'opportunité explicable (`src/scoring.ts`)

RED → GREEN : `scoreCluster` combine 5 facteurs saturants pondérés (auteurs,
subreddits, engagement `log1p`, diversité de signaux, récurrence), borné à 100,
raisons explicables en français, `marketEvidenceState`. Une régression RED (`totalScore` était `NaN`) borne maintenant
chaque contribution d'engagement à zéro avant `log1p`, affiche le total non négatif effectif dans les raisons et
garantit un résultat fini entre 0 et 100. 7 tests OK.

## Slice 6 — Construction des opportunités (`src/opportunity.ts`)

RED → GREEN : `buildOpportunities` assemble chaque `Cluster` en `Opportunity`
(problème, score, confiance, ICP, idée de MVP, étapes de validation, preuves),
triées par score décroissant. 4 tests OK.

## Slice 7 — Rapport JSON structuré (`src/reportJson.ts`)

RED → GREEN : `buildReportDict` sérialise en objet JSON-safe avec avertissement
TAM/SAM/SOM explicite. 1 test OK.

## Slice 8 — Rapport HTML autonome, échappement strict (`src/reportHtml.ts`)

RED → GREEN : `renderHtmlReport` échappe tout contenu utilisateur (`escapeHtml`)
et neutralise les URLs non http/https (`safeHref`, retombe sur `#`). 5 tests OK,
dont un test XSS explicite sur `javascript:` en tant qu'URL de preuve.

## Slice 9 — Pipeline bout-en-bout (`src/pipeline.ts`)

RED → GREEN : `runPipeline` enchaîne filtrage des posts sans signal de douleur →
clustering → opportunités → rapports JSON/HTML. 3 tests OK, y compris l'exclusion
des posts neutres et le cas liste vide.

## Slice 10 — Adaptateur Reddit OAuth Data API (`src/redditApi.ts`)

Remplace intégralement l'ancien collecteur RSS (`painradar/live.py`, supprimé).
RED → GREEN, avec transport HTTP injecté (`FetchLike`) pour ne jamais appeler
Reddit pendant les tests :

- `loadCredentialsFromEnv` : lit uniquement `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`,
  `REDDIT_USER_AGENT` ; lève `RedditAuthError` si un de ces trois manque.
- `fetchAccessToken` : `POST https://www.reddit.com/api/v1/access_token` en
  `grant_type=client_credentials` (application-only), en-tête `Authorization: Basic`
  construit à partir des identifiants, jamais loggé ni persisté.
- `fetchSubredditListing` : `GET https://oauth.reddit.com/r/<sub>/new`, valide le nom
  de subreddit par une regex stricte (`^[A-Za-z0-9_]{1,21}$`) avant de construire
  l'URL (aucune injection possible), borne `limit` à 100, parse les en-têtes
  `x-ratelimit-used/remaining/reset` (valeur absente, mal formée ou non finie → `null`), valide chaque enfant et
  ses champs sans coercition 32 bits (`score` entier sûr éventuellement négatif, `num_comments` entier sûr positif
  ou nul, `created_utc` fini positif ou nul, champs texte requis et valeurs Reddit nullables admises), et rapporte
  explicitement 401/403/429 et toute erreur réseau/JSON sans jamais relancer de requête automatiquement.
- `collectRedditPosts` : un seul jeton pour plusieurs subreddits, délai poli entre
  requêtes, résultats partiels conservés si un subreddit échoue.

Les régressions RED observaient l'acceptation d'un enfant mal typé et des valeurs `NaN`/`Infinity` dans les en-têtes.
18 tests OK (jeton, échec d'authentification, credentials manquants, nom de
subreddit invalide, parsing de listing borné par `maxItems`, 401, 403, 429 sans
retry, erreur réseau, validation runtime et collecte multi-subreddits poursuivie après enfant mal formé).

## Slice 11 — CLI (`src/cli.ts`)

RED : `test/test_cli.ts` spawn `node dist/src/cli.js` → `Cannot find module
'dist/src/cli.js'`. GREEN : parseur d'arguments minimal (`--fixture`, `--live`,
`--max-items`, `--timeout`, `--delay`, `--out-json`, `--out-html`), mode fixture
par défaut, mode `--live` utilisant `redditApi` avec un `fetch` borné par
`AbortController`/timeout. Les erreurs (`IngestError`, `RedditAuthError`) sont
interceptées et écrites sur stderr avec un code de sortie non nul, sans trace
Node brute. Les régressions de revue refusent avant lecture/écriture/réseau les alias entre sorties et, en mode
fixture, entre fixture et sortie. RED observé pour l'égalité directe fixture/sortie, deux liens symboliques (y
compris pendants) vers une même cible et deux liens physiques ; la résolution couvre aussi les parents symboliques
avec feuille inexistante via le plus proche ancêtre existant. Une régression RED supplémentaire reproduit un composant
de répertoire symbolique suivi de `..`, pour une paire sortie/sortie prospective et pour fixture/sortie avec vérification
bout-en-bout de non-écrasement. La canonicalisation suit la sémantique native du système de fichiers avant de normaliser
les segments encore inexistants, puis compare `dev` + `ino` pour les fichiers existants.
Le mode `--live` ignore volontairement le fixture puisqu'il n'est pas lu. Les temporisations `--timeout` et
`--delay` restent bornées à 2 147 483 647 ms. 20 tests CLI OK, dont la vérification bout-en-bout qu'un fixture alias
reste intact et celle que le mode `--live` sans identifiants échoue explicitement en mentionnant
`REDDIT_CLIENT_ID`.

---

**Total : 84 tests, `npm test` (build + `node --test dist/test/*.js`) → 84/84 OK.**
Aucun test n'appelle Reddit en direct ni ne nécessite d'identifiants : tout le
transport HTTP est injecté et simulé.
