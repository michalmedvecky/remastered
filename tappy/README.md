# Tappy — vajíčkové dobrodružství pro tablet

Tappy je samostatná dětská varianta Flappy pro hráče přibližně od 9 let. Má vlastní aplikaci, soubory, grafiku, ovládání a lokální postup na cestě `/tappy/`. Původní Flappy zůstává na `/flappy/`.

Cílem je dostat světlé vajíčko na svítící hnízdo. Používá všech 200 původních místností z FLAPPY+4 a stejné zdivo, posouvání, gravitaci, kameny a uspávání nepřátel. Původ map popisuje [SOURCES.md](SOURCES.md).

## Pohodové hraní

- Výchozí režim **Po krocích** posune svět jednou s každým vstupem. Když ovladač pustíte, dění se zastaví; hráč má čas si situaci rozmyslet.
- Volitelný režim **Plynule** rozběhne svět po prvním pohybu pomalejším tempem. Je možné kdykoli použít pauzu.
- Tappy nemá časový limit ani ubývající životy. Neúspěšný pokus nabídne vrácení tahu nebo nový pokus.
- **Zpět** obnovuje až 80 posledních rozhodnutí včetně stavu nepřátel a bublinek.
- Barevné lesní postavičky, velké směrové ovladače a uspávací bubliny nahrazují technický vzhled původní hry.

První spuštění začíná úrovní 1. Poslední vybraná úroveň, dokončené úrovně a nastavení se ukládají jen v daném prohlížeči pod klíčem `tappy.progress.v1`. Nejsou potřeba účty. Přímý odkaz `?stage=9` otevře vybranou úroveň; neplatná hodnota začne na 1.

## Ovládání

| Ovladač | Co dělá |
| --- | --- |
| Velké šipky | Ťuknutí = krok; podržení = opakování |
| Ťuknutí do bludiště | Jeden krok směrem od kuřátka k místu dotyku; ťuknutí přímo na kuřátko nic neprovede |
| Přejetí po herní ploše | Jeden krok zvoleným směrem |
| Bublina | Pošle sebranou bublinu ve směru pohledu; umí uspat žabku nebo obláček |
| Zpět | Vrátí poslední rozhodnutí |
| Znovu | Spustí stejnou úroveň od začátku |
| Úroveň | Výběr kterékoliv z 200 místností |
| Šipky / WASD | Pohyb na klávesnici |
| Mezerník / Z / R / P | Bublina / zpět / znovu / pauza |

Herní rozhraní včetně popisků neumožňuje náhodný výběr textu, přetahování ani kontextové nabídky při podržení. Text návodu zůstává běžně označitelný. Pohyb a bublinu lze ovládat dvěma prsty současně. Zrušený dotyk, opuštění stránky a otevření dialogu uvolní ovladače. Plynulé hraní se při opuštění okna pozastaví. Přidání stránky na plochu tabletu používá vlastní relativní web manifest; offline režim není součástí této verze.

## Vývoj a ověření

Node.js 24+, bez instalace dalších balíčků:

```sh
npm --prefix tappy start
# http://127.0.0.1:4173/
npm --prefix tappy test
```

Z kořene celé kolekce funguje `npm start` a cesta `/tappy/`. Jediný společný image kolekce obsahuje aplikace odděleně; Tappy nepotřebuje běhové importy z `/flappy/`. Postup sestavení a k3s nasazení popisuje hlavní README a DEPLOYER.md.

Root `npm run snapshot` obnoví společné checksumy a lokální build metadata po záměrné změně runtime. Ověřte `npm test` a `npm run verify`. Původní data úrovní a základní engine zůstávají doložitelnou kopií Flappy; dětské změny a vracení kroků jsou v `tappy-engine.js`.

Jde o novou přístupnější adaptaci; hraní po krocích, bez časového limitu a s vracením tahů je záměrná změna původního herního rytmu. Původní autorské údaje zůstávají v podkladech. Původní remaster Flappy není touto aplikací nahrazen.
