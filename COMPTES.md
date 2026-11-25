# Comptes joueurs (Supabase) — mise en service

Le jeu contient déjà tout le système de comptes : inscription (e-mail ou pseudo), connexion, « rester connecté », mot de passe oublié, profil/avatar et **sauvegarde en ligne de la progression**. Il ne manque que **votre** projet Supabase (gratuit, sans carte bancaire). Comptez ~10 minutes.

## 1. Créer le projet
1. Allez sur https://supabase.com → *Start your project* → connectez-vous (GitHub ou e-mail).
2. *New project* : nom `brawl-rush`, mot de passe de base de données (gardez-le pour vous), région *Europe (Paris/Frankfurt)*.

## 2. Créer la base (copier-coller)
*SQL Editor* → *New query* → collez **tout** le fichier `supabase/schema.sql` → *Run*. Vous devez voir « Success ».
Cela crée la table des profils, les **règles de sécurité** (chaque joueur ne peut lire et modifier que sa propre ligne), la création automatique du profil à l'inscription, et le classement public (pseudo + trophées uniquement).

## 3. Réglages d'authentification
*Authentication* → *Sign In / Providers* → *Email* :
- **Confirm email : désactivé** (recommandé pour un jeu). Sinon, chaque joueur doit cliquer un lien reçu par e-mail avant de jouer, et **les comptes « pseudo » (sans e-mail) ne peuvent pas être créés**.

## 4. Mot de passe oublié (code à 6 chiffres)
1. *Authentication* → *Emails* → *Templates* → **Reset Password** : remplacez le contenu par par exemple
   `Votre code Brawl Rush : <b>{{ .Token }}</b> (valable 1 heure).`
2. **Envoi des e-mails** : le service d'e-mails inclus dans Supabase n'envoie qu'aux adresses des membres de votre équipe Supabase et est limité à quelques messages par heure. Pour que **tous** les joueurs reçoivent leur code, configurez un SMTP : *Authentication* → *Emails* → *SMTP Settings* (par exemple **Resend**, 3 000 e-mails/mois gratuits, ou **Brevo**).
   Sans SMTP, tout le reste (inscription, connexion, sauvegarde) fonctionne normalement.

## 5. Récupérer les deux valeurs à intégrer au jeu
*Project Settings* → *API* (ou *Data API*) :
- **Project URL** (ex. `https://abcdefgh.supabase.co`)
- **clé `anon` / `public`** (longue chaîne qui commence par `eyJ`).

⚠ **Ne donnez jamais la clé `service_role`** : elle contourne toutes les règles de sécurité. La clé `anon` est faite pour être intégrée dans une application.

## 6. Mettre les valeurs dans le jeu (au choix)
- **Le plus simple** : envoyez-moi l'URL et la clé `anon` ; je les intègre, je recompile l'APK et je teste l'inscription, la connexion et la sauvegarde **sur votre vrai projet**.
- **Vous-même** : dans `app/src/main/assets/www/js/data.js`, remplissez `G.SUPABASE = { url: '…', key: '…' }` puis recompilez (`./build-apk.sh`).
- **Sans recompiler (pour tester)** : en jeu, *Réglages → Serveur de comptes → Configurer*.

## Fonctionnement
| Fonction | Détail |
|---|---|
| Inscription e-mail | e-mail + pseudo + mot de passe (8 caractères min., lettres + chiffres) |
| Inscription pseudo | pseudo + mot de passe, sans e-mail (⚠ pas de récupération possible du mot de passe) |
| Connexion | e-mail **ou** pseudo + mot de passe |
| Rester connecté | session mémorisée (stockage natif Android à écriture immédiate), renouvelée automatiquement |
| Progression | sauvegardée en ligne quelques secondes après chaque changement et à la mise en arrière-plan ; récupérée à l'identique sur un autre téléphone |
| Invité | possible ; à la création du compte, la progression invité est rattachée au compte |
| Déconnexion | la progression reste en ligne ; le téléphone repart en invité |

## Limites honnêtes
- La sauvegarde est écrite par le téléphone du joueur : un tricheur expérimenté pourrait modifier sa propre progression. Pour un jeu compétitif, il faudra faire valider les récompenses par le serveur de jeu (prochaine étape possible).
- Tests réalisés : 20 vérifications de bout en bout à travers la vraie interface (inscription, synchronisation, réouverture, autre téléphone, pseudo, erreurs, récupération, « rester connecté ») + 1 test d'expiration de session (`tools/test-session-refresh.js`) contre une imitation fidèle de l'API Supabase (`tools/supabase-mock.js`, `tools/test-accounts.js`). **Un test sur votre vrai projet Supabase reste à faire** dès que vous m'aurez donné l'URL et la clé `anon`.
