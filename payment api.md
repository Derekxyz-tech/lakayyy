Logo
PLOP PLOP
Portail API
API Paiement & Retrait Marchand v1.3
Documentation complète • Dernière mise à jour:

💳 API Paiement
🔒 API Retrait Marchand
Cette documentation décrit les endpoints destinés à l'intégration paiement et retrait marchand : création de transactions, vérification d'état, et retraits sécurisés. Les réponses sont en JSON UTF-8.

Base URL : https://plopplop.solutionip.app/
💳 API Paiement
POST
api/paiement-marchand
Créer une nouvelle transaction marchand et obtenir une URL de redirection pour compléter le paiement (MonCash, Kashpaw, NatCash, etc.).

En-têtes Recommandés
Content-Type: application/json
Corps (JSON)
Champ	Type	Obligatoire	Description
client_id	string	Oui	Identifiant marchand fourni par la plateforme.
refference_id	string	Oui	Identifiant unique de référence (doit être inédit).
montant	number	Oui	Montant de la transaction (>= 20 HTG).
payment_method	string	Oui	Méthode : moncash, kashpaw, natcash, all.
Codes de Réponse
200 OK Transaction créée.
400 Paramètre manquant / montant invalide.
404 Client introuvable ou référence déjà utilisée.
405 Méthode HTTP non autorisée.
429 Trop de requêtes.
503 Erreur interne.
Exemple Requête
POST /api/paiement-marchand
Content-Type: application/json

{
  "client_id": "MARCHAND123",
  "refference_id": "CMD-20250001",
  "montant": 250,
  "payment_method": "moncash"
}Copy
Réponse Succès (200)
{
  "status": true,
  "message": "success",
  "url": "https://redirect-paiement...",
  "transaction_id": "173763124912345"
}Copy
POST
api/paiement-verify
Vérifier l'état d'une transaction précédemment créée.

Corps (JSON)
Champ	Type	Obligatoire	Description
client_id	string	Oui	Identifiant marchand.
refference_id	string	Oui	Référence envoyée à la création.
Réponse Succès (200)
{
  "status": true,
  "message": "success",
  "montant": 250,
  "trans_status": "no",
  "id_transaction": "173763124912345",
  "date": "2025-09-22",
  "heure": "14:53:11",
  "method": "moncash",
  "id_client": null
}Copy
Le champ trans_status vaut no (en attente) ou ok (confirmé).
🔒 API Retrait Marchand
Les paiements clients créditent votre solde marchand (prépayé). Cette API sert à retirer ces fonds vers MonCash ou NatCash.

L'API utilise trois étapes et une signature HMAC-SHA256 pour garantir qu'aucun montant ni destinataire ne peut être modifié sans le client_secret.

POST
api/auth/marchand
Étape 1 : Authentification avec client_id et client_secret. Retourne un marchand_token valable ~1 minute.

Corps (JSON)
Champ	Type	Obligatoire	Description
client_id	string	Oui	Identifiant marchand (format : pp_...)
client_secret	string	Oui	Clé secrète marchand (64 caractères)
Réponse Succès (200)
{
  "success": true,
  "message": "Authentification réussie",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "marchand": {
    "id": 123,
    "pseudo": "BoutiqueExemple",
    "nom": "Dupont",
    "prenom": "Marie",
    "email": "contact@exemple.ht",
    "telephone": "50912345678",
    "entreprise": "Mon commerce",
    "client_id": "pp_1234567890abcdef"
  },
  "expires_in": 300
}Copy
Codes de Réponse
200 OK Authentification réussie.
400 Paramètres manquants.
401 Identifiants invalides.
403 Compte inactif.
POST
api/auth/marchand/withdrawal-token
Étape 2 : Générer un jeton de retrait signé, lié au montant, destinataire, méthode et référence. Nécessite le marchand_token (étape 1) et une signature HMAC-SHA256.

En-têtes Requis
Authorization: Bearer {marchand_token}
Content-Type: application/json
Corps (JSON)
Champ	Type	Obligatoire	Description
amount	number	Oui	Montant du retrait (HTG)
method	string	Oui	moncash ou natcash
recipient	string	Oui	Numéro de téléphone (509XXXXXXXX)
reference	string	Oui	Référence unique de la transaction
timestamp	integer	Oui	Heure Unix actuelle (secondes) — rejeté si > ± 5 min
withdrawal_signature	string	Oui	HMAC-SHA256 du payload signé avec votre client_secret (voir formule ci-dessous)
Formule de signature :
withdrawal_signature = HMAC-SHA256("amount|method|recipient|reference|timestamp", client_secret)
Les valeurs doivent être dans cet ordre exact, séparées par |.
Exemple de calcul de signature (PHP)
$payload = implode('|', [$amount, $method, $recipient, $reference, $timestamp]);
$signature = hash_hmac('sha256', $payload, $client_secret);Copy
Exemple de calcul de signature (JavaScript / Node.js)
const crypto = require('crypto');
const payload = [amount, method, recipient, reference, timestamp].join('|');
const signature = crypto.createHmac('sha256', clientSecret).update(payload).digest('hex');Copy
Exemple Requête
POST /api/auth/marchand/withdrawal-token
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
Content-Type: application/json

{
  "amount": 500.00,
  "method": "natcash",
  "recipient": "50912345678",
  "reference": "CMD-2026-001",
  "timestamp": 1715691234,
  "withdrawal_signature": "a3f8b1c2d4e6..."
}Copy
Réponse Succès (200)
{
  "success": true,
  "message": "Jeton de retrait généré avec succès.",
  "withdrawal_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "authorized_for": {
    "amount": 500,
    "method": "natcash",
    "recipient": "50912345678",
    "reference": "CMD-2026-001"
  },
  "expires_in": 120,
  "expires_at": "2026-05-14 14:32:00"
}Copy
Codes de Réponse
200 OK Jeton de retrait généré.
400 Champ manquant / timestamp expiré / montant invalide.
401 Jeton d'authentification invalide ou expiré.
403 Signature invalide (INVALID_SIGNATURE) ou client_secret non configuré.
Codes d'Erreur Spécifiques
Code	Signification	Solution
INVALID_SIGNATURE	La signature HMAC ne correspond pas	Recalculer avec la formule exacte ci-dessus
TIMESTAMP_EXPIRED	Timestamp trop ancien ou trop avancé (> 5 min)	Utiliser l'heure Unix courante
NO_CLIENT_SECRET	client_secret non configuré côté serveur	Contacter l'administrateur
POST
api/withdraw/marchand
Étape 3 : Exécuter le retrait avec le withdrawal_token de l'étape 2. Les paramètres du corps doivent être strictement identiques à ceux utilisés à l'étape 2. Le retrait est exécuté immédiatement — le statut est success ou failed dans la réponse.

En-têtes Requis
Authorization: Bearer {withdrawal_token}
Content-Type: application/json
Corps (JSON)
Champ	Type	Obligatoire	Description
amount	number	Oui	Identique au jeton (étape 2)
method	string	Oui	Identique au jeton
recipient	string	Oui	Identique au jeton
reference	string	Oui	Identique au jeton
Réponse Succès (200)
{
  "success": true,
  "message": "Retrait NatCash effectué avec succès.",
  "data": {
    "transaction_id": "API_WD_NA_1715691234_abc123",
    "api_reference": "NC_TX_9876543210",
    "amount": 500,
    "fee": 12.5,
    "total": 512.5,
    "recipient": "50912345678",
    "reference": "CMD-2026-001",
    "balance_before": 5000,
    "balance_after": 4487.5,
    "status": "success"
  }
}Copy
Réponse Échec (400)
{
  "success": false,
  "message": "Échec du retrait NatCash : Numéro NatCash invalide",
  "data": {
    "transaction_id": "API_WD_NA_1715691234_abc123",
    "status": "failed"
  },
  "error_code": "API_TRANSFER_FAILED"
}Copy
Codes de Réponse
200 OK Retrait exécuté avec succès.
400 Solde insuffisant / méthode non configurée / échec API externe.
401 Jeton invalide ou expiré.
403 Jeton déjà utilisé / paramètres incorrects / type de jeton invalide.
404 Marchand introuvable.
429 Cooldown IP (120 secondes entre retraits).
Codes d'Erreur Spécifiques
Code	Signification	Solution
INVALID_TOKEN_TYPE	Mauvais type de jeton (jeton de connexion au lieu du jeton de retrait)	Utiliser le withdrawal_token de l'étape 2
PARAMETER_MISMATCH	Les paramètres ne correspondent pas au jeton	Utiliser exactement les mêmes valeurs qu'à l'étape 2
TOKEN_ALREADY_USED	Le jeton a déjà été utilisé	Générer un nouveau jeton (étapes 1 + 2)
WITHDRAWAL_COOLDOWN	Trop de retraits depuis cette IP	Attendre ~120 secondes
METHOD_NOT_CONFIGURED	Méthode non active dans moyen_paiement	Activer la méthode dans le panneau admin
INSUFFICIENT_BALANCE	Solde prépayé insuffisant	Recharger le compte
API_TRANSFER_FAILED	L'API MonCash/NatCash a rejeté le transfert	Vérifier le numéro destinataire et réessayer
🔐 Sécurité :
L'étape 2 exige une signature HMAC-SHA256 avec votre client_secret — un jeton de connexion volé ne suffit pas
Le timestamp est vérifié (± 5 minutes) — les requêtes rejouées sont rejetées
Le jeton de retrait expire après 2 minutes et ne peut être utilisé qu'une seule fois
Toute modification des paramètres par rapport au jeton est rejetée
Cooldown de 120 secondes entre retraits depuis la même IP
Flux Complet cURL (v1.3)
# ── Étape 1 : Authentification ──────────────────────────────────────────────
curl -X POST https://plopplop.solutionip.app/api/auth/marchand \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "pp_1234567890abcdef",
    "client_secret": "votre_secret_64_caracteres"
  }'
# → Enregistrer le champ "token" comme AUTH_TOKEN

# ── Calculer la signature (exemple PHP en ligne) ──────────────────────────
php -r "
  \$amount = 500; \$method = 'natcash';
  \$recipient = '50912345678'; \$reference = 'CMD-001';
  \$timestamp = time();
  \$payload = \$amount.'|'.\$method.'|'.\$recipient.'|'.\$reference.'|'.\$timestamp;
  echo hash_hmac('sha256', \$payload, 'votre_secret_64_caracteres').'\n';
  echo 'timestamp='.\$timestamp.'\n';
"

# ── Étape 2 : Générer le jeton de retrait ────────────────────────────────
curl -X POST https://plopplop.solutionip.app/api/auth/marchand/withdrawal-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {AUTH_TOKEN}" \
  -d '{
    "amount": 500,
    "method": "natcash",
    "recipient": "50912345678",
    "reference": "CMD-001",
    "timestamp": 1715691234,
    "withdrawal_signature": "a3f8b1c2d4e6..."
  }'
# → Enregistrer le champ "withdrawal_token" comme WITHDRAWAL_TOKEN

# ── Étape 3 : Exécuter le retrait ────────────────────────────────────────
curl -X POST https://plopplop.solutionip.app/api/withdraw/marchand \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {WITHDRAWAL_TOKEN}" \
  -d '{
    "amount": 500,
    "method": "natcash",
    "recipient": "50912345678",
    "reference": "CMD-001"
  }'Copy
Bonnes Pratiques
Conserver le couple (refference_id, transaction_id) côté marchand.
Relancer périodiquement paiement-verify jusqu'au passage à ok.
Utiliser HTTPS en production.
Recalculer la signature côté serveur (jamais côté navigateur) — le client_secret ne doit jamais être exposé.
Générer un nouveau jeton de retrait (étapes 1+2) pour chaque opération.
Gérer explicitement les codes INSUFFICIENT_BALANCE, TOKEN_ALREADY_USED, API_TRANSFER_FAILED.
Le statut de la transaction est success ou failed dans la réponse — pas besoin de polling supplémentaire.
Changelog
1.3 () Sécurité renforcée : l'étape 2 exige une signature HMAC-SHA256 (withdrawal_signature + timestamp). Réponse étape 3 : statut success/failed immédiat. Frais calculés depuis moyen_paiement. Suppression du champ note dans les réponses.
1.2 (2026-04-29) Ajout du menu de navigation.
1.1 (2026-04-29) Ajout de l'API retrait marchand.
1.0 Initialisation.
© API Paiement & Retrait Marchand. Tous droits réservés.
© 2026 PLOP PLOP – Documentation API.