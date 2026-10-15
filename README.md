# Labo-68K

Le labo pour viser 20/20 au contrôle d'architecture des ordinateurs (EPITA S3, assembleur Motorola 68000).
Une seule page, aucune installation, aucun serveur : tout tourne dans le navigateur.

## Ce qu'il y a dedans

| Section | Ce que tu fais |
|---|---|
| **Méthode 20/20** | La procédure pour chaque exercice du contrôle, les pièges, les tables Bcc / modes d'adressage, une référence d'instructions filtrable. |
| **Ex.1 Adressage** | Une instruction MOVE générée sur des valeurs initiales aléatoires. Tu donnes la mémoire et les registres. Correction avec la chaîne de calcul de l'adresse effective (`-7(A1) → (A1 − 7) → ($5008 − 7) → ($5001)`). |
| **Ex.2 Flags** | Additions sur 8, 16, 32 bits : résultat + N Z V C, explication signé / non signé. Soustractions en bonus. |
| **Ex.3 Cours** | Questions de cours. Les instructions sont corrigées par le vrai parseur : `MOVEM.L (SP)+,A4/A3/A2/A1` = `MOVEM.L (A7)+,A1-A4`. |
| **Ex.4 Programme** | Programmes générés avec les pièges du sujet (CMP signé, SUBQ.B, DBRA, rotations). Explication registre par registre. |
| **Labo** | Éditeur avec coloration, exécution, pas à pas, **pas arrière**, points d'arrêt, animation, registres, flags, mémoire, console `TRAP #15`. |
| **Moulinette** | 12 sous-programmes à écrire (Abs, StrLen, Atoi, Palindrome…). Les autres registres sont remplis au hasard : si tu ne sauvegardes pas avec `MOVEM`, c'est KO. |
| **Examen blanc** | 1 h (ou 20 min), 4 exercices, note sur 20, correction complète, historique. |

XP, niveaux, combos, badges et note estimée sont gardés dans le navigateur (localStorage).

## Fiabilité

Le simulateur reproduit exactement le corrigé du contrôle S3 2025/2026 et les exemples du chapitre 1 du cours :

```
npm test     # 37 tests du moteur + générateurs + solutions de référence des 12 défis
```

Instructions simulées : MOVE/MOVEA/MOVEQ/MOVEM/LEA/PEA, ADD/SUB/CMP (A, I, Q, X), MULU/MULS/DIVU/DIVS, AND/OR/EOR/NOT/NEG/CLR/TST/EXT/SWAP/EXG, tous les décalages et rotations, BTST/BSET/BCLR/BCHG, Bcc/DBcc/Scc, BRA/BSR/JMP/JSR/RTS/RTR, LINK/UNLK, TRAP #15 (tâches 0, 1, 3, 6, 9, 13, 14, 15). Directives ORG, EQU, DC, DS, END. Erreurs d'adresse impaire et division par zéro détectées.

## Mettre le site en ligne (GitHub Pages)

1. Sur GitHub : **Settings → Pages**.
2. Source : **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Le site est servi à `https://imowwgli.github.io/labo-68k/`.

## Modifier

Le code est dans `src/` :

- `src/engine.js` : assembleur + CPU 68000
- `src/gen.js` : générateurs d'exercices et défis de la moulinette
- `src/app.js`, `src/head.html`, `src/body.html` : interface

Après une modification : `sh build.sh` régénère `index.html`, puis `npm test`.
