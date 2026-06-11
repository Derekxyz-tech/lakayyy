# 🛍️ LakayMarket : Portail de Place de Marché pour l'Artisanat Haïtien

**LakayMarket** est une place de marché numérique full-stack, élégante, hautement sécurisée et optimisée pour connecter les artisans, créateurs et vendeurs haïtiens avec des acheteurs locaux et internationaux. 

Conçue avec une approche esthétique impeccable et une rigueur technique digne des plateformes de production d'entreprise, l'application intègre des fonctionnalités d'IA générative et gère l'inclusion financière haïtienne en intégrant la passerelle de paiement mobile **PlopPlop API v1.3** pour **MonCash** (Digicel) et **NatCash** (Natcom).

---

## 🛠️ Stack Technique & Architecture Globale

LakayMarket repose sur une architecture full-stack modulaire intégrant des technologies modernes et adaptées aux environnements réseau instables :

*   **Frontend (SPA)** :
    *   **React 19** & **TypeScript** : Typage strict de bout en bout et rendu réactif ultra-rapide.
    *   **Vite 6** : Compilateur ultra-performant et gestionnaire d'assets optimisé.
    *   **Tailwind CSS v4** : Styling moderne reposant entièrement sur des variables CSS de thèmatique unifiées au niveau de `@theme`.
    *   **Motion/React** (anciennement Framer Motion) : Animations de transition fluides, micro-interactions d'interface et retours visuels (drag & drop, switchers).
    *   **Lucide React** : Ensemble d'icônes vectoriels légers et harmonieux.
    *   **React Hot Toast** : Système de notifications toast élégantes et non-intrusives.

*   **Backend (Proxy Server)** :
    *   **Express.js (Node.js)** : Serveur d'API agissant comme proxy sécurisé pour masquer les clés secrètes et orchestrer les opérations complexes (ex: signatures HMAC).
    *   **esbuild** : Système de bundling qui compile l'intégralité du serveur TypeScript en un fichier unique CommonJS (`dist/server.cjs`) pour éliminer l'I/O disque et optimiser les démarrages à froid de conteneurs.
    *   **tsx** : Exécuteur TypeScript en direct utilisé dans l'environnement de développement local.

*   **Services Cloud & Base de Données** :
    *   **Firebase SDK Client & Firebase Admin SDK** : Connexions directes et sécurisées de données en temps réel.
    *   **Cloud Firestore** : Base de données NoSQL distribuée gérant les stocks, utilisateurs, studios et transactions financières.
    *   **Firebase Authentication** : Gestion sécurisée des sessions utilisateurs et gardes-fous d'accès.

---

## ⚙️ Comment Fonctionne le Projet (Architecture Fonctionnelle)

LakayMarket s'organise autour d'un double profil d'utilisation unifié dans une même interface par une transition d'écran fluide :

```
             ┌──────────────────────────────────────────┐
             │       LakayMarket Web Application        │
             └────────────┬────────────────────┬────────┘
                          │                    │
        [Acheteur/Client] │                    │ [Vendeur/Marchand]
                          ▼                    ▼
             ┌────────────────────────┐   ┌────────────────────────┐
             │  Catalogue d'Artisanat │   │   Studio de Création   │
             │   Panier Interactif    │   │  Tableau de Bord & IA  │
             │  Passerelle Paiement   │   │ Retraits Cryptograph.  │
             └───────────┬────────────┘   └────────────┬───────────┘
                         │                             │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │    Express API Proxy &     │
                         │    Firestore DB/Rules       │
                         └──────────────┬──────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
               [Gemini 3.5-flash AI]         [PlopPlop Gateway v1.3]
```

### 1. Le Parcours Acheteur (Client)
*   **Navigation & Catalogue** : Les clients parcourent les œuvres artisanales filtrées par catégories avec un champ de recherche instantané.
*   **Panier sans friction** : Les utilisateurs peuvent ajouter des produits au panier pour planifier leur commande sans aucune exigence de connexion préalable ou de carte bancaire, agissant comme une wishlist interactive persistante localement (`localStorage`).
*   **Validation de Caisse (Checkout)** : Pour commander, l'acheteur saisit son numéro de téléphone local :
    *   **Validation des formats** : Les numéros MonCash doivent commencer par `3` (8 chiffres) et NatCash par `4` (8 chiffres).
    *   **Seuil minimal** : La passerelle de paiement impose un montant de transaction strict d'**au moins 20 HTG**. L'UI empêche les soumissions inférieures de manière proactive en guidant l'utilisateur.

### 2. Le Parcours Vendeur (Merchant Studio)
*   **Création de Studio d'Artisan** : En un clic, un utilisateur peut créer son espace de vente personnalisé incluant un nom de studio exclusif et une bannière.
*   **Génération de Fiche Produit assistée par IA (Gemini 3.5-Flash)** :
    *   Pour aider les artisans à rédiger des textes accrocheurs, nous avons intégré le SDK `@google/genai` côté serveur.
    *   En fournissant simplement le nom de leur création, l'artisan peut solliciter l'IA de Gemini qui lui génère en quelques secondes une description commerciale élégante, authentique et culturellement enrichie pour mettre en valeur le savoir-faire local.
*   **Console de Gestion de Stock & Médias** :
    *   Prise en charge du **Glisser-Déposer (Drag & Drop)** natif pour charger jusqu'à 15 photos par produit (maximum 2 Mo par image, conversion instantanée en Base64).
    *   Statistiques et graphiques financiers interactifs mis à jour en direct via des écouteurs Firestore.

---

## 🔒 Passerelle de Paiement & Mécanismes de Sécurité (PlopPlop API v1.3)

LakayMarket utilise l'API PlopPlop pour sécuriser ses transactions en ligne et ses virements d'argent.

### A. Flux de Facturation Client (Paiement)
1.  **Requête du client** : Le frontend initie une transaction vers l'Endpoint Express public `/api/payments/create-payment`.
2.  **Proxy de création (Sécurisé)** : Le backend intercepte la demande, vérifie le montant (minimum 20 HTG), injecte le `PLOPPLOP_CLIENT_ID` secret, et appelle de manière invisible l'API PlopPlop : `POST https://plopplop.solutionip.app/api/paiement-marchand`.
3.  **Redirection** : S'il est valide, PlopPlop retourne une URL de paiement sécurisée et un identifiant de transaction unique. L'application redirige l'acheteur vers ce portail de validation sécurisé.
4.  **Polling & Récupération automatique** :
    *   Pendant la redirection, le frontend interroge l'API `/api/payments/verify-payment` à intervalles réguliers (polling intelligent).
    *   Si le réseau coupe ou si l'utilisateur quitte l'onglet, le composant `PaymentRecoveryChecker` s'active au retour sur l'application. Il vérifie l'état d'avancement de la référence stockée en local.
    *   **Nettoyage robuste** : Si l'API retourne une erreur `404 Transaction not found` (indiquant que la transaction a expiré ou a été annulée côté passerelle), le composant nettoie proprement le stockage local pour éviter les boucles d'attente infinies.
5.  **Écriture Atomique (Anti-Double Spending)** : Une fois la confirmation reçue à l'état `ok`, l'application exécute une transaction Firestore atomique (`runTransaction`) :
    *   Déduction des produits achetés des stocks physiques des vendeurs.
    *   Incrémentation instantanée du solde financier du vendeur à hauteur exacte du prix payé.
    *   Enregistrement d'un relevé d'audit financier infalsifiable dans la collection `/transactions/`.

### B. Moteur de Retrait de Fonds Vendeur (Withdrawal Routing)
Pour permettre aux marchands d'empocher leurs revenus cumulés vers leur compte MonCash ou NatCash personnel, le serveur Express met en œuvre un processus d'authentification robuste en cascade en trois étapes, basé sur des signatures cryptographiques HMAC-SHA256 pour interdire toute falsification des montants ou des destinataires :

1.  **Vérification Locale** : L'API `/api/withdrawals/request` vérifie d'abord que le marchand dispose de fonds suffisants dans Firestore et respecte le seuil minimal de retrait (ex: 2 500 HTG).
2.  **Authentification API (Étape 1)** : Établit un canal chiffré temporaire avec la passerelle en lui transmettant le couple `client_id` et `client_secret` pour obtenir en retour un `marchand_token` à durée de vie très courte (1 minute).
3.  **Génération du Jeton de Retrait Signé (Étape 2)** :
    *   Pour s'assurer que les valeurs d'opération (destinataire, montant, référence, timestamp) ne sont pas modifiées durant le transit, le serveur crée une signature HMAC-SHA256 :
        ```typescript
        const payload = [amount, method, recipient, reference, timestamp].join('|');
        const signature = crypto.createHmac('sha256', CLIENT_SECRET).update(payload).digest('hex');
        ```
    *   L'Express de LakayMarket envoie ces paramètres à PlopPlop qui retourne un `withdrawal_token` unique.
4.  **Exécution Finale (Étape 3)** : Le serveur transmet finalement ce jeton à usage unique à l'API de décaissement de PlopPlop, effectuant immédiatement l'envoi de l'argent de manière sécurisée vers le téléphone de l'artisan et déduisant son solde local de la base de données.

---

## 📁 Plan du Répertoire de Fichiers Importants

*   `/server.ts` : Point d'entrée de notre architecture full-stack. Gère les API proxy sécurisées, l'appel cryptographique pour les retraits PlopPlop, l'automatisation de Gemini AI 3.5-flash, et monte le middleware de développement de Vite.
*   `/src/main.tsx` & `/src/App.tsx` : Points d'ancrage de la SPA React. Gèrent l'arborescence globale, les overlays de notification globaux et le basculement d'interfaces.
*   `/src/components/CheckoutModal.tsx` : Boîte de dialogue finale de validation d'achat. Gère le choix de la méthode (MonCash/NatCash), les validations de format de téléphone haïtien et applique les limites minimales de montants (>= 20 HTG).
*   `/src/components/PaymentRecoveryChecker.tsx` : Mécanisme résilient d'interrogations réseaux réactives permettant de récupérer et clore les sessions d'achats suspendues ou inachevées.
*   `/firestore.rules` : Règles pare-feu strictes basées sur les attributs (ABAC) pour isoler les données personnelles et interdire toute mise à jour non autorisée de la comptabilité financière.
*   `/firebase-blueprint.json` : Modèle conceptuel formel spécifiant le schéma attendu de la base de données et la structure des objets stockés.

---

## 🚀 Guide de Démarrage Rapide

### Configuration requise
Générez un fichier de configuration `.env` à la racine (basé sur `.env.example`) listant les variables requises :
```env
# Clé secrète de développement Gemini AI
GEMINI_API_KEY=votre_cle_gemini_ici

# Identifiants de la passerelle de test PlopPlop
PLOPPLOP_CLIENT_ID=pp_ae2a6beaf6c8bdb82aed6060088f
PLOPPLOP_CLIENT_SECRET=b8472b1a35ca0b50acc96b15a15eab5c0e0121d783aa021f8e88916fe4d1822a
```

### Installation et exécution locale

1.  **Installer les dépendances** :
    ```bash
    npm install
    ```

2.  **Lancer le serveur de développement full-stack** (Vite + Express via `tsx`) :
    ```bash
    npm run dev
    ```
    L'application démarrera et sera accessible sur le port unique et standard `http://localhost:3000`.

3.  **Vérification de la syntaxe et des types** (Linter) :
    ```bash
    npm run lint
    ```

4.  **Compiler le projet pour la production** :
    ```bash
    npm run build
    ```
    Cette commande va transpiler le frontend statique dans le sous-dossier `/dist` et empaqueter le serveur Express backend en un build unique CommonJS `/dist/server.cjs` à l'aide d'esbuild.

5.  **Démarrer en mode production** :
    ```bash
    npm run start
    ```
