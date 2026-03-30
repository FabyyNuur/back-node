# 🗄️ Nuur GYM - Backend API

Serveur d'API REST pour la plateforme **Nuur GYM**, construit avec Node.js, Express et une base de données SQLite.

---

## ⚙️ Installation & Démarrage

1.  **Installation des dépendances** :
    ```bash
    npm install
    ```
2.  **Démarrage du serveur** :
    ```bash
    npm start
    ```
    > 💡 **Important** : Le projet vous est fourni **avec sa base de données déjà pré-remplie** (le fichier `nuurgym.db`). Vous avez donc directement accès aux données de test sans aucune étape supplémentaire !

3. Le serveur sera alors accessible localement sur `http://localhost:4000`.

---

## Configuration (Variables d'Environnement)
Le fichier `.env` à la racine contient les paramètres de configuration :
-   `PORT` : Port d'écoute du serveur (par défaut 4000).
-   `API_PREFIX` : Préfixe de toutes les routes API (par défaut `/api`).
-   `SECRET_KEY` : Clé secrète utilisée pour signer les tokens JWT.
-   `NODE_ENV` : Mode d'exécution (development/production).

---

## Structure du Code
-   `app.js` : Initialisation d'Express et enregistrement des middlewares/routes.
-   `server.js` : Point d'entrée pour lancer le serveur.
-   `db.js` : Configuration de SQLite et schéma de la base de données.
-   `routes/` : Définition des points de terminaison (endpoints) de l'API.
-   `controllers/` : Logique métier associée à chaque route.
-   `middleware/` : Filtres de sécurité (ex: vérification du token JWT).

---

## 📊 Base de Données (SQLite)
Le projet utilise **better-sqlite3**. Vous n'avez **absolument rien à configurer**.
Le fichier (`nuurgym.db`) se trouve à la racine du projet et contient tout l'historique de test.

**Tables principales :**
-   `users` : Administrateurs et contrôleurs.
-   `activities` : Catalogue des sports et tarifs.
-   `clients` : Membres avec leurs informations et QR Codes.
-   `subscriptions` : Suivi des abonnements actifs.
-   `tickets` : Gestion des accès journaliers.
-   `transactions` : Historique financier complet.

---

## Accès Admin par Défaut
-   **URL** : `http://localhost:4000/api/auth/login` (via le front)
-   **User** : `admin@nuurgym.com`
-   **Password** : `admin123`
