# AUDIT DE SÉCURITÉ ET HARDENING ENTERPRISE (LAKAY MARKET)

Le tableau de bord visuel de sécurité a été **supprimé** car il simulait des contrôles qui doivent exister au niveau de l'infrastructure réelle, et non sur le client React.

Actuellement, l'application est une **Single Page Application (SPA)** serverless reposant intégralement sur le client web React (Vite) et Firebase (Firestore, Auth, Storage) via le SDK client (`@firebase/firestore`). Il n'y a pas de serveur Node.js / Express intermédiaire dans l'architecture présente.

Par conséquent, de nombreuses protections de niveau "Enterprise", "Zero Trust" ou "Fintech" ne peuvent être mises en place uniquement via le code React, et requièrent la configuration de services Cloud externes réels, que vous devrez effectuer manuellement.

Voici ce qui doit être mis en place dans l'infrastructure pour obtenir une vraie sécurité "Production-Grade" :

## 1. Protections Réseaux et WAF (via Cloudflare)
**Action requise : DNS et proxy externe (TODO)**
*   **HSTS, TLS 1.3 Forcé & Redirection HTTPS** : Doivent être activé dans le tableau de bord Cloudflare > SSL/TLS > Edge Certificates.
*   **WAF, Rate Limiting & Anti-DDoS** : Configurez des règles WAF (Web Application Firewall) sous Cloudflare > Security > WAF.
*   **Anti-Bot & Proxy/TOR Blocking** : Activez le mode "Bot Fight Mode" de Cloudflare.

## 2. Content Security Policy (CSP) et Headers HTTP
**Action requise : Configuration Firebase Hosting (TODO)**
*   Il faut modifier le fichier `firebase.json` (ou la config de votre CDN) pour envoyer les véritables headers HTTP `Content-Security-Policy`, `X-Frame-Options`, et `X-Content-Type-Options`. Un réglage côté client dans React n'est pas suffisant (il ne protège pas du chargement initial).

## 3. Sandboxing / Analyse Antivirus des Uploads (ClamAV)
**Action requise : Cloud Functions ou Serveur Dédié (TODO)**
*   Actuellement, les fichiers sont envoyés directement `Firebase Storage` via le navigateur.
*   Pour une vraie sécurité, vous devez configurer une **Google Cloud Function** déclenchée sur l'événement `storage.object.create` (ou un webhook).
*   Cette fonction téléchargera le fichier dans un container isolé isolé de prod, l'analysera avec l'API ClamAV, et le mettra en quarantaine ou l'approuvera.

## 4. Architecture "Zero Trust" et Queue Sécurisée (BullMQ/Redis)
**Action requise : Déploiement d'un Backend Node.js / Python (TODO)**
*   Une architecture Zero-Trust / Microservices isolés nécessite de sortir de la logique "Serverless Frontend" où le client effectue lui-même les appels `setDoc` ou `deleteDoc`.
*   Vous devez créer un ou plusieurs serveurs d'API isolés, par exemple hébergés sur Google Cloud Run/GKE, avec des VPC privés. Le client React appellera ce backend qui, lui, validera les JWT, interagira avec la base de données et avec une file d'attente comme Redis / RabbitMQ, avant de traiter les paiements.

## 5. Chiffrement (AES-256) au repos explicite et Keys KMS
**Action requise : Configuration Google Cloud (GCP) (TODO)**
*   Firestore chiffre déjà par défaut toutes les données au repos (AES-256), mais avec des clés gérées par Google.
*   Si vous souhaitez utiliser des **Vrais Customer-Managed Encryption Keys (CMEK)**, cela doit être activé depuis Google Cloud console pour ce projet Firestore. De plus, pour chiffrer des données sensibles "Côté Client" avant l'envoi en DB (chiffrement de bout-en-bout), vous devriez configurer une API de KMS.

## 6. Rotation Automatique JWT / Anti-Enum Auth
**Action requise : Firebase Auth (TODO)**
*   Firebase Auth s'occupe de la rotation interne des ID Tokens et de l'invalidation des sessions.
*   Pour bloquer l'énumération par email (savoir si un email est déjà enregistré), il faut activer l'option "Email Enumeration Protection" directement depuis les paramètres du projet Firebase Auth de Google Cloud Console.

## 7. Backups Chiffrés
**Action requise : Configuration GCP Datastore (TODO)**
*   Pour protéger la base de données (Firestore) contre de potentielles suppressions accidentelles ou ransomware, vous devez activer les exports planifiés (Managed Export) de Firestore vers un bucket Cloud Storage distant, immuable (avec versioning activé dans GCP).

## 8. Mode Maintenance & "Kill Switch"
**Action requise : Edge Middleware / CDN (TODO)**
*   Le "kill switch" ne peut pas être un simple booléen récupéré par le client depuis Firestore, car si le compte est compromis ou l'API malveillante, elle bypassera l'UI frontend. Un vrai kill switch doit être configuré au niveau de l'Edge router (Cloudflare Workers) pour retourner systématiquement 503 sans jamais toucher les serveurs backend.

---
**En conclusion:** Les mocks visuels ont été retirés. L'application est actuellement fonctionnelle en l'état (standard Frontend + Backend-as-a-service Firestore) mais les features de niveau de sécurité Enterprise et Fintech citées par la vérification requièrent un provisioning externe, serveur et GCP/Cloudflare, qui est en attente de configuration.
