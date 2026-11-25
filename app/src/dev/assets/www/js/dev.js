/* Brawl Rush — ÉDITION DÉVELOPPEUR : active d'office le menu développeur (le même que celui du compte développeur,
   avec le menu professionnel : modes de test, éditeurs, diagnostics, outils multijoueur, comptes de test, avancé).
   Les actions en ligne restent vérifiées par le serveur (compte développeur requis). */
(function () {
  const G = window.G;
  window.addEventListener('load', () => setTimeout(() => {
    if (!G.DevTools) return;
    G.DevTools.activate(true, 'ÉDITION DÉVELOPPEUR');
    // ressources de départ seulement pour une partie invité (jamais sur un vrai compte en ligne)
    const S = G.Save.data, A = G.Account;
    if (G.Dev && !S.devInit && !(A && A.loggedIn && A.loggedIn())) { S.devInit = true; S.coins += 99999; S.gems += 9999; S.boxes = (S.boxes || 0) + 10; G.Dev.unlockAll(); G.Save.commit(); }
  }, 0));
})();
