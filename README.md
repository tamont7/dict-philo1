# La philosophie de A à Z

Dictionnaire de philosophie en français, prêt pour Vercel. Le site est entièrement statique : aucun serveur, aucune base de données et aucune clé API.

Il contient 955 entrées (721 notions et 234 auteurs), une recherche qui ignore les accents, un index par lettres, des filtres, des favoris enregistrés dans le navigateur, un thème sombre et des liens entre les notions. Chaque entrée possède une URL directe, par exemple `/entree/liberte`.

La présentation s’inspire légèrement du livre : titres de notions violets, titres d’auteurs ocres, sous-titres turquoise, encadrés de définition et renvois mis en valeur. La lecture reste fluide sur ordinateur et mobile. Le site utilise du texte HTML, du CSS et les polices du navigateur, sans images ni polices provenant du livre.

La définition du jour est la même pour tous les visiteurs et change à minuit, heure de Paris, y compris lors du passage à l’heure d’été ou d’hiver. Un onglet déjà ouvert se met à jour automatiquement. Aucun redéploiement ni tâche planifiée n’est nécessaire.

## Lancer le site

Node.js 20 ou plus récent est nécessaire.

```bash
npm install
npm run dev
```

Ouvrir **http://localhost:5173**. Le lancement génère automatiquement le site dans `dist/`. Pour choisir un autre port : `npm run dev -- --port 5174`.

Après une modification dans `src/`, lancer `npm run build` puis rafraîchir le navigateur. Le serveur sert les fichiers générés sans recompilation automatique.

## Héberger sur Vercel

1. Mettre le projet dans un dépôt Git, en incluant **`data/dictionary.json`**, `src/`, `scripts/`, `package.json`, `package-lock.json` et `vercel.json`.
2. Créer un projet dans Vercel et importer ce dépôt.
3. Utiliser la racine du projet comme **Root Directory**. `vercel.json` définit déjà :
   - **Framework Preset** : Other
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
4. Lancer le déploiement.

Le dossier XHTML original, ses images et ses polices **ne sont pas nécessaires** au déploiement. Il est ignoré par Git. Les entrées sont générées sous forme de vraies pages HTML : les liens directs fonctionnent sans réécriture vers la page d’accueil.

Depuis la racine du projet, on peut aussi lancer `npx vercel` pour créer un aperçu, puis `npx vercel --prod` pour publier en production.

Configuration documentée par Vercel : [Build Command et Output Directory](https://vercel.com/docs/builds/configure-a-build).

## Données et génération

```bash
npm run build
```

`data/dictionary.json` contient le texte des 955 entrées et leurs renvois. Ce fichier est la source de contenu du site et doit rester dans Git. Le build génère un index léger, les données individuelles des entrées et leurs pages HTML. Le dossier `dist/` est recréé à chaque génération ; ne pas le modifier directement.

Source : *La philosophie de A à Z, nouvelle édition*, Éditions Hatier, 2021. Les textes et citations restent ceux de l’ouvrage fourni. Les références de pages sont conservées.

Pour réimporter le texte, remettre le dossier de l’ouvrage contenant `OPS/` à la racine du projet, puis lancer :

```bash
npm run import
npm run build
```

Cette étape facultative remplace `data/dictionary.json`. L’import reconnaît les titres, reconstruit les paragraphes, rassemble les titres coupés sur plusieurs lignes et décode les caractères particuliers des polices grâce à `scripts/font-map.json`. Le build ordinaire utilise directement les données déjà importées.

## Vérifications

Après `npm run build` :

```bash
npm test
npm run test:browser
```

Les tests vérifient les entrées, la recherche, les renvois, le calendrier de la définition du jour et la génération sans le dossier XHTML. Les tests Chromium couvrent les parcours sur ordinateur et mobile : recherche, filtres, pagination, liens directs, favoris, thème et lecture des définitions.

Si Chromium n’est pas installé pour Playwright : `npx playwright install chromium`.

Les dépendances npm servent uniquement aux tests navigateur. La génération et le serveur local utilisent les modules intégrés de Node.js.
