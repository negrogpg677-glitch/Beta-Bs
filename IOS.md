# Version iPhone (.ipa)

Le projet iOS (`ios/`) est prêt, mais **un .ipa ne peut se compiler que sur macOS (Xcode)** : je ne peux pas le produire depuis Linux. Deux solutions :

## 1. Le plus simple, sans .ipa : l'app web installable (PWA)
Quand le serveur est hébergé, ouvrez son adresse dans **Safari** → Partager → *Sur l'écran d'accueil*. Plein écran, icône, hors-ligne.

## 2. Un vrai .ipa, compilé automatiquement sur un Mac GitHub (gratuit)
1. Poussez ce dépôt sur GitHub (l'accès de Claude au dépôt doit d'abord être réparé, ou faites le push vous-même).
2. *Actions → Compiler l'IPA (iPhone) → Run workflow*. Le fichier `BrawlRush-unsigned.ipa` est téléchargeable à la fin.
3. **Signature obligatoire** : Apple n'autorise l'installation que d'apps signées.
   - Gratuit : installez **AltStore** ou **Sideloadly** (PC/Mac) avec votre identifiant Apple ; ils signent l'IPA et l'installent (à renouveler tous les 7 jours).
   - Payant (99 $/an, compte développeur) : TestFlight / App Store depuis Xcode.
