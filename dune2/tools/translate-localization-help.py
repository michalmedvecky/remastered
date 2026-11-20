#!/usr/bin/env python3
"""Retained Czech Mentat translation source, including each house's own voice."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TITLES={'Spice Silos':'Sila na koření','Ordos Raider':'Ordoský Raider','Specials':'Zvláštní jednotky','Vehicles':'Vozidla','Wor':'Dům WOR',
'Briefing':'Zadání mise','Advice':'Rada','Orders':'Rozkazy','Houses':'Rody','House Atreides':'Rod Atreidů','House Harkonnen':'Rod Harkonnenů','House Ordos':'Rod Ordosů','Structures':'Budovy','Barracks':'Kasárna','Concrete Slab':'Betonová deska','Construction Yard':'Stavební dvůr','Heavy Factory':'Těžká továrna','High-Tech Factory':'Letecká továrna','IX':'IX','Light Factory':'Lehká továrna','Outpost':'Radar','Palace':'Palác','Refinery':'Rafinérie','Repair Facility':'Opravna','Rocket Turret':'Raketová věž','Spice Silo':'Silo','Starport':'Kosmodrom','Turret':'Obranná věž','Wall':'Zeď','Wind Trap':'Větrná elektrárna','Windtrap':'Větrná elektrárna','WOR':'Dům WOR','Units':'Jednotky','Carryall':'Nosič','Combat Tank':'Bojový tank','Harvester':'Sklízeč','Heavy Troopers':'Těžká pěchota','Light Infantry':'Lehká pěchota','MCV':'MSV','Raider Trike':'Útočná tříkolka','Ornithopter':'Ornitoptéra','Quad':'Čtyřkolka','Rocket Tank':'Raketový tank','Siege Tank':'Obléhací tank','Trike':'Tříkolka','Special Weapons':'Zvláštní zbraně','Death Hand':'Ruka smrti','Devastator':'Devastátor','Deviator':'Deviátor','Fremen':'Fremeni','Saboteur':'Sabotér','Sand Worm':'Písečný červ','Sonic Tank':'Sonický tank','Ordos Deviator':'Ordoský deviátor',
'Infantry Barracks':'Kasárna pěchoty','Heavy Vehicle Factory':'Těžká továrna','IX Research Center':'Výzkumné centrum IX','Light Vehicle Factory':'Lehká továrna','Radar Outpost':'Radar','Spice Refinery':'Rafinérie koření','Vehicle Repair Facility':'Opravna vozidel','Spice Storage Silo':'Silo na koření','Base Defense Turret':'Obranná věž','Hardened Wall':'Zpevněná zeď','Power Generator':'Větrná elektrárna','Trooper Barracks':'Kasárna těžké pěchoty','Combat Quad':'Bojová čtyřkolka','Combat Trike':'Bojová tříkolka','Ordos Raider Trike':'Ordoská útočná tříkolka','Shai-Hulud':'Šaj-hulúd','Caladan:':'Caladan:','Giedi Prime:':'Giedi Prime:','Name: Unknown':'Název: neznámý','Self-Powered':'Vlastní zdroj energie','No Known Weakness':'Bez známé slabiny','(Harsh climate model)':'(Do drsného podnebí)','(Desert model)':'(Pouštní model)',
}
NARRATIVES={
'MENTATA.ENG':{
4:'Naším dávným domovem je bujná planeta Caladan. Vybudovali jsme civilizovanou společnost a vážíme si života i práv všech lidí. Nevěříme ve zbytečné násilí a s původními fremenskými obyvateli Duny jsme uzavřeli obranné spojenectví.',
5:'Harkonnenové pocházejí z temné planety Giedi Prime. Jsou krutí a zlomyslní; čestnému jednání ani lidskému životu nepřikládají velkou cenu. Jejich cílem je zjevně vojenské dobytí Duny.',
6:'Rod Ordosů původně založila skupina nejistých bohatých rodin. Vyrostl v mocný kartel hnaný touhou po kreditech, nadvládě a manipulaci. Často se živí krádežemi místo práce.',
8:'Kasárna cvičí naši odvážnou lehkou pěchotu. Budovy jsou poměrně odolné a poskytnou vám dostatek sil k obraně těžby koření.',
9:'Betonové desky tvoří pevné základy našich budov a umožňují jim pracovat s nejvyšší účinností.',
10:'Stavební dvůr je nezbytný ke stavbě jakýchkoli budov.',
11:'Těžká továrna vyrábí všechna velká vozidla, například sklízeče a těžší stroje používané k obraně. Samotná budova je mimořádně dobře pancéřovaná.',
12:'Letecká továrna vyrábí vyspělá letadla, například nosiče.',
13:'IX je technologickým centrem světa. Je vrcholným zdrojem nových, úžasných technologií, které nám pomohou dosáhnout našich cílů.',
14:'Lehká továrna vyrábí lehce obrněné tříkolky a čtyřkolky, které chrání naše rafinérie a sila.',
15:'Předsunutou základnu využívejte kvůli jejímu radaru. Radar vám umožní sledovat sklízeče i nepřátele v okolí.',
16:'Získat palác je čest vyhrazená těm, kdo při plnění misí prokázali odvahu a píli. Palác je nejlépe zpracovaná a nejlépe pancéřovaná budova, jakou můžete mít.',
17:'Rafinérie přeměňuje koření na kredity. Bez ní nemůžete těžbou koření získávat nové kredity.',
18:'Opravna slouží k opravám všech těžebních a obranných vozidel.',
19:'Raketová věž je vylepšením běžné věže. Přidané rakety s dlouhým dosahem zajišťují lepší obranu obvodu základny.',
20:'Sila slouží ke skladování vytěženého koření. Nejsou tak odolná jako některé naše další budovy, proto se doporučují časté opravy.',
21:'Kosmodrom nám umožní obchodovat prostřednictvím mezihvězdných obchodních cest. Díky tomu můžeme posílit naše vozidla i budovy.',
22:'Věže jsou nepohyblivou obranou základny, mimořádně přesnou na krátkou vzdálenost.',
23:'Zdi jsou dokonalou pasivní obranou. Používejte je k opevnění sil a dalších slabých budov.',
24:'Větrné elektrárny elegantně a účinně využívají ohromnou sílu větru a zachycují vzácnou vlhkost. Přestože jsou poměrně pevné, mějte záložní elektrárny pro případ nehody nebo sabotáže.',
25:'Dům WOR dokáže cvičit těžkou pěchotu. Na rozdíl od ostatních rodů nevěříme ve zbytečné násilí při dosahování cílů, a proto nepředpokládám, že tuto technologii budeme potřebovat.',
27:'Nosič dokáže přepravovat sklízeč mezi poli koření a rafinérií. Nemá žádné útočné schopnosti ani zbraně a jeho pancíř je pouze lehký.',
28:'Bojový tank má dostatečnou výzbroj a hodí se k obraně. Lze jej použít k ochraně obvodu základny i sklízečů.',
29:'Sklízeče jsou velké a dobře pancéřované; vyrábí je těžká továrna. Pro těžbu koření jsou nepostradatelné, protože jako jediné mohou koření sbírat a vozit z naleziště do rafinérie.',
30:'Těžká pěchota má silné zbraně a odolnou zbroj.',
31:'Lehká pěchota je přiměřeně chráněná a vyzbrojená. Dokáže bránit naše zařízení.',
32:'Mobilní stavební vozidlo umožňuje budovat nové stavby, které nemusí navazovat na ostatní budovy v oblasti. Další rafinérie ve vzdálených místech by vám například umožnily účinnější těžbu.',
33:'Ordosové vyrábějí tříkolku zvanou Raider. Podobá se naší tříkolce, je však rychlejší, obratnější a pohyblivější, zato má slabší pancíř.',
34:'Ornitoptéra je lehce pancéřované a velmi obratné letadlo, které výborně poskytuje obrannou vzdušnou podporu sklízečům, tříkolkám a čtyřkolkám.',
35:'Čtyřkolky jsou vozidla se čtyřmi koly, silným pancířem a účinnými zbraněmi. Stejně jako tříkolky představují účinnou obranu. S čtyřkolkami a tříkolkami byste měli odrazit většinu útoků.',
36:'Raketový tank má dobrý pancíř, je rychlejší než běžné tanky a dokáže útočit na velkou vzdálenost. Výborně podporuje obranu lehké pěchoty i oddílů tříkolek a čtyřkolek.',
37:'Obléhací tank je těžce pancéřovaný a má velmi silné zbraně. K obraně sklízečů a zařízení vám bohatě postačí.',
38:'Tříkolku vyrábí lehká továrna. Je rychlá, dobře pancéřovaná a k obraně nese lehké zbraně. Tříkolky lze využívat proti nepřátelským nájezdům i k hledání polí koření.',
40:'Ruka smrti je víceúčelová raketa. Její výbušná hlavice zasahuje rozsáhlou oblast a dokáže napáchat mnohem větší škody než běžná raketa.',
41:'Tento mohutný tank patří k nejnovějším válečným strojům Harkonnenů. Má téměř neprůstřelný pancíř, ohromnou palebnou sílu a dokáže zničit téměř jakoukoli překážku v cestě.',
42:'Deviátor odpaluje rakety s nebezpečným nervovým plynem, který vážně narušuje vnímání zasažených vojáků a může vyvolat i úplnou vzpouru.',
43:'Původní obyvatelé této planety jsou vynikající partyzánští bojovníci. Fremeni jsou nám nakloněni, protože s nimi rod Atreidů vždy jednal poctivě a jako se sobě rovnými.',
44:'Ordosové často využívají skupinu místních teroristů zvaných sabotéři. Tito muži ovládají sabotáž a snadno pronikají obranným obvodem k budovám, které hodlají zničit. Jakmile je odhalíte, ihned na ně zaútočte a zabijte je.',
45:'Tyto obrovské tvory přitahují otřesy povrchu. Často napadají a požírají vojáky i vozidla. Jedinou jistou ochranou před nimi je skála.',
46:'Sonický tank patří k našim jedinečným zbraním. Místo střel vypouští výboje zvukové energie. Je vynikající při obranných misích a zvlášť účinný proti nepřátelské pěchotě.',
},
'MENTATH.ENG':{
4:'Atreidové pocházejí z vlhké tropické planety Caladan. Prosluli slabostmi, jako jsou čestnost a laskavost. Zjevně nevěří ve válku a vojenským střetům se zpravidla vyhýbají. Spřátelili se s obyvateli Duny, a tak lze čekat, že do obrany zapojí místní fremenské vlastence.',
5:'My Harkonnenové jsme přišli z planety Giedi Prime. Nyní chceme vlastnit Dunu. Naše zbraně jsou dostatečně mocné, aby odrazily každý nepřátelský útok. Celý rod Harkonnenů se soustředí na tento úkol a zastavit nás může už jen pohroma.',
6:'Tento kartel chamtivých rodin spojila touha po moci. Nejspíš budou příliš zaměstnáni vzájemnými hádkami, než aby se vážně zabývali našimi silami.',
8:'Tyto prosté malé budovy cvičí pěchotu. Samotná budova má slušný pancíř a její údržba je poměrně levná. My Harkonnenové však pro tak slabé síly nemáme využití.',
9:'Desky zajišťují stabilní základy budov. Zjistili jsme, že vše postavené na holé skále rychle chátrá.',
10:'Stavební dvůr musíte mít. Poskytne vám prostředky ke stavbě dalších budov.',
11:'Abyste mohli stavět naše těžké tanky, musíte mít těžkou továrnu.',
12:'Letecká továrna vyrábí naše nosiče.',
13:'IX vám poskytne zdroj vojensky vyspělých zbraní.',
14:'Lehká továrna vyrábí pouze lehce pancéřovaná vozidla. Je jen prvním krokem na cestě k vojenské převaze.',
15:'Předsunutá základna ukrývá radarové vybavení. Radar vám pomůže hlídat vlastní území i blízkou nepřátelskou činnost.',
16:'Rod Harkonnenů může udělit palác těm, kdo prokázali, že jsou takové cti hodni. Pokud darovaný palác ztratíte, vaše mise skončí neúspěchem.',
17:'Rafinérie přeměňuje vytěžené koření na kredity.',
18:'V této poušti nelze provozovat stroje bez poškození. Musíte mít opravnu, která se o poškozená vozidla postará.',
19:'Raketová věž je výborná zbraň. Přestože ji nelze přesouvat, hodí se k obraně na velkou i malou vzdálenost.',
20:'Ke skladování vytěženého koření musíte postavit sila. Naneštěstí jsou málo odolná a potřebují časté opravy.',
21:'Kosmodrom vás spojuje se skladišti za hranicemi této planety. S kosmodromem můžete nakupovat mocné zbraně a vozidla.',
22:'Věže jsou přesné a účinné zbraně. Přestože se nemohou pohybovat, považujte je za nezbytné posílení vašich sil.',
23:'Zdi jsou výbornou volbou pro posílení obrany. Stejně jako betonové desky se vyrábějí levně.',
24:'Tyto budovy zásobují vaši základnu energií a vodou. Jsou poněkud křehké, a proto důrazně doporučujeme postavit více než jednu.',
25:'Dům WOR vycvičí těžkou pěchotu.',
27:'Toto dopravní letadlo dokáže převážet velká vozidla, například sklízeče, k cíli účinněji, než kdyby se tam potulovala sama.',
28:'Bojový tank bude vaším prvním tankem a má přiměřený pancíř i palebnou sílu. Pamatujte však, že máte k dispozici i mocnější zbraně.',
29:'Toto velké, pomalé a sotva ovladatelné vozidlo těží surové koření a vozí je do rafinérie. Přestože nemá zbraně, jeho železný pancíř a pásy lze účinně využít k rozdrcení malých skupin pěchoty.',
30:'Těžká pěchota představuje vynikající bojové jednotky. Je dobře obrněná a má silné zbraně.',
31:'Lehká pěchota vám sotva postačí. Je pomalá, špatně chráněná a často míjí své cíle. Spoléhejte se na mohutnější těžkou pěchotu.',
32:'Mobilní stavební vozidlo vám umožní rozšířit území. S jeho pomocí můžete stavět vzdálené budovy, které nemusí sousedit s vaší hlavní základnou.',
33:'Tohle je žalostný malý stroj. Ordosové z nějakého důvodu věří, že tato přerostlá tříkolka dokáže naše čtyřkolky překonat v obratnosti i palbě.',
34:'Toto křehké letadélko je pouhou nepříjemností. Jeho jemný pancíř se našim válečným zbraním nemůže rovnat.',
35:'Čtyřkolka je mnohem lepší vozidlo než menší tříkolka. Má výrazně lepší pancíř a je mnohem silnější.',
36:'Raketový tank účinně útočí na velkou vzdálenost. Dobře jej chraňte, protože zblízka je neúčinný.',
37:'Obléhací tank překonává bojový tank. Jeho pancíř a výzbroj mají sílu, kterou potřebujete k dokončení dobytí této planety.',
38:'Přestože jsou tato lehce pancéřovaná tříkolová vozidla použitelná, důrazně doporučujeme nasazovat větší a silnější stroje.',
40:'Naše Ruka smrti je překrásná zbraň, kterou lze zaměřit k úderům na velkou vzdálenost. Těsně před dopadem vypouští řadu výbušných prstů, které rozsévají zkázu po rozsáhlé oblasti.',
41:'Devastátor je další z jedinečných a mocných zbraní v našem úžasném arzenálu. Jeho pancíř a výzbroj nemají obdoby. Na bojišti se nemusí obávat jiných, slabších tanků.',
42:'Fremeni jsou sotva něčím víc než otroky Atreidů. Tito nevzdělaní domorodci občas za Atreidy bojují a na oplátku dostávají jídlo a zásoby.',
43:'Tento tank vypouští silný nervový plyn, který může přimět vaše vojáky slabší vůle, aby se obrátili proti vám.',
44:'Ordosové spoléhají na skupinu teroristů zvaných sabotéři. Pokud tyto mazané škůdce nezastavíte, způsobí vašim budovám velké škody. Doporučuji sabotéry zlikvidovat ihned při setkání.',
45:'Tyto obrovské místní červy je téměř nemožné zabít. Přitahují je otřesy povrchu a všem pozemním jednotkám hrozí, že je pozřou. Jedinou jistou ochranou je skála.',
46:'Atreidové věří, že nalezli humánní způsob likvidace nepřátel. Jejich sonický tank střílí místo raket rázové vlny.',
},
'MENTATO.ENG':{
4:'Atreidové pocházejí z Caladanu. Teplé podnebí této planety a přebujelé zemědělství bezpochyby vedou její občany k laskavosti a nenásilí. V tom spočívá jejich slabost.',
5:'Giedi Prime je domovem Harkonnenů. Nenechte se zmást jejich slepou nenávistí a krvežíznivostí. Jsou lstiví a prohnaní; musíte je pečlivě sledovat!',
6:'Ordosové pocházejí z mnoha různých domovů. Díky této rozmanitosti jsme silní a dobře organizovaní. Víme, kdy je nutné využít zdroje a kdy si potřebný materiál přivlastnit. Naše organizace je vysoce účinná a výkonná.',
8:'Tyto budovy cvičí lehkou pěchotu, která patří k nejdůležitějším bojovým složkám našeho vojenského systému.',
9:'Betonové desky jsou účinným a levným materiálem pro základy. Budovy bez základů potřebují časté opravy, a tím plýtvají cenným časem i penězi.',
10:'Stavební dvůr vám umožní postavit další budovy.',
11:'Těžká továrna vyrábí všechna velká pásová vozidla, například tanky a sklízeče.',
12:'Letecká továrna využívá technologii k výrobě vyspělých letadel.',
13:'IX vám umožní vytvářet lepší, rychlejší a účinnější stroje. Poskytne prostředky k výrobě některých našich nejvýjimečnějších vozidel.',
14:'Lehká továrna vyrábí naše útočné tříkolky Raider i čtyřkolky.',
15:'Radarové schopnosti předsunuté základny jsou pro vaše operace zásadní. S radarem můžete sledovat pohyb ostatních rodů a připravovat obranné i útočné strategie.',
16:'Až vám rod udělí palác, poznáte, že jste jej potěšili. Pokud palác někdy padne do rukou nepřítele, vaše mise zajisté skončí neúspěchem.',
17:'Rafinérie je nezbytná k přeměně koření na kredity. Bez ní nemůžete těžbou získávat nové kredity.',
18:'Bez opravny nebudete moci opravovat poškozená vozidla. Nedostanou-li poškozená vozidla opravy, přijdete o ně úplně.',
19:'Raketová věž je stejně jako běžná věž nepohyblivá. Má však větší dosah. Dohromady by měly zajistit vynikající palbu na krátkou i dlouhou vzdálenost.',
20:'Sila se používají ke skladování koření. Jsou slabší a snadněji zničitelná než sklízeče nebo rafinérie. Využijte tohoto poznatku ve svůj prospěch.',
21:'Mezigalaktická nákupní síť přístupná přes kosmodrom vám umožní pořizovat výzbroj ve velkých objednávkách.',
22:'Věže jsou velmi přesné zbraně. Jejich jedinou nevýhodou je, že se po postavení nemohou přemísťovat.',
23:'Zdi mohou zajistit slušnou obranu po obvodu komplexu.',
24:'Větrné elektrárny jsou na Duně jediným účinným zdrojem energie. Přestože jsou poměrně silné, snadno se poškodí. Je rozumné mít vždy v provozu více než jednu.',
25:'Dům WOR slouží k výcviku těžké pěchoty.',
27:'Nosič dokáže nasazovat i vyzvedávat velká pásová vozidla, například sklízeče. Použití nosičů je mnohem rychlejší než čekat, až se sklízeč sám vrátí.',
28:'Tento pomalý tank s jedinou hlavní podává přiměřený výkon. Jsou však dostupné i mnohem rychlejší a účinnější tanky.',
29:'Sklízeče jsou velká pomalá vozidla, která hledají pole koření a po nalezení surového koření začnou těžit. Jde zjevně o velmi neúčinný postup. Podporujeme proto velitele, aby si přivlastňovali i již vytěžený materiál; je to jistě rychlejší a účinnější způsob získávání koření.',
30:'Těžká pěchota má silnější zbroj, a přesto je rychlejší než lehká pěchota. Její schopnosti se dobře hodí k pozemním útokům a průzkumným misím.',
31:'Lehká pěchota poskytuje postradatelné vojáky. Nasadíte-li je ve velkém počtu, jsou téměř neporazitelní.',
32:'Mobilní stavební vozidlo nabízí účinný způsob rozšiřování ovládaného území. Dokáže podpořit výstavbu nových zařízení v určité vzdálenosti od stávajících budov.',
33:'Raider je mnohem lepší než běžná tříkolka. Je rychlejší a má výborné zbraně. Díky obratnosti je nejlepším vozidlem pro mise, v nichž se musíte spolehnout na rychlost a pohyblivost.',
34:'Ornitoptéra je rychlé a obratné letadlo. Je účinná při strategických úderech, ale její pancíř byl obětován ve prospěch rychlosti a pohyblivosti.',
35:'Toto čtyřkolové vozidlo našim potřebám příliš nevyhovuje. Přestože má dobrý pancíř, není dostatečně obratné a nedosahuje požadované rychlosti.',
36:'Přestože je raketový tank rychlejší než bojový a dokáže střílet na velkou vzdálenost, dáváme přednost užitečnějším tankům. Doporučuji proti raketovým tankům vyslat vaše Raidery.',
37:'Obléhací tank má více než dvojnásobnou palebnou sílu oproti bojovému tanku. Přes veškerou sílu a pancíř je však poměrně pomalý.',
38:'Tříkolová vozidla ostatních rodů mají mnoho nedostatků. Na rozdíl od našeho Raideru nedokážou udržet rychlosti, které požadujeme. Za toto zrychlení jsme bohužel museli obětovat pancíř.',
40:'Harkonnenové vlastní tyto rakety, které dokážou doručit několik hlavic do jediné cílové oblasti. Navzdory děsivému jménu jsou naštěstí velmi nepřesné.',
41:'Harkonnenové vytvořili nový tank schopný těžce poškodit i nejlépe chráněná vozidla a budovy. Přes všechnu palebnou sílu a pancíř je však mimořádně pomalý a lze jej snadno přelstít manévrováním.',
42:'Náš Deviátor vypouští nervový plyn, který dokáže zvrátit mysl nepřátelských vojáků. Některé z našich nejlepších pluků tvoří převážně někdejší nepřátelé, přeprogramovaní působením tohoto plynného argumentu.',
43:'Místní fremenští obyvatelé Duny jsou prostí, ale zruční bojovníci. Atreidové je nyní využívají k boji. Při správné motivaci by je snad bylo možné přesvědčit, aby se místo toho přidali k našim silám.',
44:'Sabotér je společné označení této jednotky vojáků specializovaných na sabotáž. Jsou účinní při ničení určených cílů a sídlí ve všech našich palácích.',
45:'Tyto nestvůry pocházející z písků Duny přitahují vibrace a dokážou jediným kousnutím zničit velká vozidla. Jedinou jistou obranou je skála.',
46:'Atreidové vyvinuli sonický tank, který místo střel vypouští zvukové výboje. V jeho blízkosti buďte opatrní; jeho výboje působí na velkou vzdálenost.',
}}

def header(value):
 trailing=' 'if value.endswith(' ')else'';parts=[]
 for line in value.rstrip().split('\r'):
  if line in TITLES:parts.append(TITLES[line]);continue
  if line.startswith('Power Needs: '):parts.append(line.replace('Power Needs: ','Spotřeba: '));continue
  if line.startswith('Power Output: '):parts.append(line.replace('Power Output: ','Výkon: '));continue
  if line.startswith('Mobility: '):parts.append('Pohon: '+{'Jet':'tryskový','Tracked':'pásy','Wheeled':'kola','Foot':'pěší','Winged':'křídla','Flight':'let'}[line[10:]]);continue
  if line.startswith('Firepower: '):parts.append('Palebná síla: '+{'none':'žádná','light':'lehká','Light':'lehká','medium':'střední','Medium':'střední','heavy':'těžká','Heavy':'těžká','Very Heavy':'velmi těžká','Unknown':'neznámá','unknown':'neznámá','Brainwash Gas':'ovládající plyn'}[line[11:]]);continue
  raise ValueError(('Unknown help header',line))
 return'\r'.join(parts)+trailing

def main():
 corpus=json.loads((ROOT/'art/localization/en.json').read_text());translations={}
 for r in corpus['records']:
  if r['kind']=='help-subject':
   if r['text']not in TITLES:raise ValueError(('Missing Czech help title',r['text']))
   translations[r['id']]=TITLES[r['text']]
  elif r['kind']=='help-body':
   if r['text']=='NO Desc ':translations[r['id']]='BEZ POPISU ';continue
   title,narrative=r['text'].split('\f');translated=NARRATIVES[r['resource']][r['index']]
   translations[r['id']]=header(title)+'\f'+translated+(' 'if narrative.endswith(' ')else'')
 result=dict(schema=1,locale='cs',translations=translations,notes=['Every house retains its own source viewpoint and description.','Native WSA prefixes, help selectors, campaign gates and offsets are immutable metadata, rebuilt separately.'])
 (ROOT/'art/localization/cs-help.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'records':len(translations),'resources':{n:sum(k.startswith(n+':')for k in translations)for n in NARRATIVES}}))

if __name__=='__main__':main()
