# ⛳ Golf Tracker App — Spec & Decision Log

## Maintenance Log
- **2026-09-11** — **"Short game on course": o Putting Course e o Chipping Course passam a contar.** Ideia da Jo: são o mais próximo de uma ronda real (cada buraco parte de uma situação real), por isso devem dizer se precisa de chipping e de onde, e como está o putting e a partir de que distâncias.
  **Decisões da Jo:** mostrar **nos dois sítios** (resumo no Dashboard, detalhe nos Insights); **alimenta a recomendação** com o ponto mais fraco (mínimo 5 buracos); janela **últimos 45 buracos + tendência** vs os 45 anteriores.
  **Análise (`services/shortGame.ts`, `analyzeShortGame(sessions)`):** ordena as sessões por data (o Dashboard guarda-as ao contrário). **Putting:** média de putts/buraco, 1-putt %, 3-putt %, e por distância do 1.º putt (desde a borda) **< 5 · 5–10 · 10–15 · 15 m+**; tendência na média (±0.1). **Chipping:** up & down %, média de strokes, **por lie** (Fairway/Rough/Bunker) e **por distância ao buraco** **< 5 · 5–10 · 10–20 · 20 m+**; tendência no up & down (±5 pts). Tendência só com ≥9 buracos na janela anterior.
  **Ponto fraco (um por drill):** Putting = banda com mais 3-putts %; Chipping = pior up & down % entre lie×distância, lie, ou distância (empate → o mais específico). Só grupos com **≥5 buracos** e com pelo menos uma falha. Cada um traz uma frase de treino ("lag putting from 10–15 m — aim to finish inside 1 m", "rough chips from 10–20 m — land it on the green, then hole the putt").
  **Insights:** cartão **⛳ Short Game on Course** (verde) antes do "Weakest Area", com barras por distância/lie (linhas com <5 buracos esbatidas, "N holes without a distance"); a **🎯 Recommendation** começa pelos pontos fracos (pior % de falha primeiro) e depois o texto antigo. Sem dados, mostra uma dica para jogar um dos percursos. **Dashboard (Practice):** caixa com putts/hole + 3-putt % e up & down % + sand, setas ▲▼, "🎯 Work on: …", toca para abrir os Insights.
  **Nota honesta:** falha de chipping (não fazer up & down) e 3-putt % não são a mesma escala — a ordem entre os dois pontos fracos é só indicativa. tsc + eslint limpos; análise testada (bandas, lies, foco, tendência, vazio). Não testado no browser.
- **2026-09-11** — **Chipping Course: o mesmo conceito do Putting Course, no Chipping — par 2 = up and down.** Ideia da Jo: em cada buraco chipar de fora do green e acabar o buraco, com distância e tipo de lie.
  **Decisões da Jo:** lies **Fairway · Rough · Bunker** (Rough foi sugestão aceite); distância **até ao buraco** (não até à borda, ao contrário do Putting Course); por buraco só **strokes até acabar** (1 = chip-in, 2 = up and down) — sem "metros que sobraram" nem clube.
  **Modelo:** `ChippingCourseHole { hole, distance, lie, strokes }`; guardado em `ProximityDrill.chipCourse` (sessões de Chipping gravam em `proximityDrills`), com `attempts` = buracos e `success` = **up-and-down %**. Rascunho: `DraftSession.pendingChipCourse`. Resumo `summarizeChippingCourse` / `chippingCourseLine`: strokes, ±par, up & down n/N (%), **sand saves** (bunker em ≤2), chip-ins, média de metros, e contagem por lie (`byLie`, ainda não mostrada).
  **Partilhado com o Putting Course:** a sessão ao vivo e o editor passaram a trabalhar com um formato comum `CourseEditorHole { hole, distance, strokes, lie? }` e conversores (`puttingToEditor`/`editorToPutting`/`chippingToEditor`/`editorToChipping`) — o Putting Course continua a gravar `putts`. `components/PuttingCourseEditor.tsx` ficou genérico (props `summary`, `strokesLabel`, `distanceLabel`, `lies`); o nome do ficheiro manteve-se.
  **Sessão:** toggle **🎯 Target drill / ⛳ Chipping Course**; botões de lie (o último escolhido fica para o buraco seguinte), metros até ao buraco, strokes 1–5+; chips mostram `H3 · BK`; tudo o resto igual ao Putting Course (tocar num buraco, ✏️ Edit holes, Undo, reabrir, resume). **Detalhe:** cartão com scorecard + lie, edição com lies, chip **⛳ Chipping Course** no + Add (sem seletor de clube). **Dashboard:** "⛳ Chipping Course N strokes (±par) · up & down X%"; fora da média "% on target". **Insights:** fora do typeScores de Chipping (o `success` mede outra coisa). Alvos adaptativos já filtravam `grid || buckets`.
  tsc + eslint limpos; resumo testado. Não testado no browser.
- **2026-09-11** — **Treinos, rondas e drills ordenados pela data em que foram jogados, não pela ordem em que foram registados (Jo reparou).** O Dashboard fazia só `.reverse()` da ordem gravada, por isso uma ronda de 2022 importada hoje aparecia no topo.
  **Decisão da Jo:** ordenar **os dados gravados** (não só as listas) — assim o handicap ("últimas 20 rondas", WHS) e os alvos adaptativos de chipping/pitching também passam a ser pela data real.
  **Implementação:** `sortByDate()` em `services/storage.ts` (estável: mesma data mantém a ordem de registo; data inválida vai para o início). `getSessions/getRounds/getRangeDrills` devolvem ordenado e `save*` grava ordenado, por isso o índice `length - 1 - index` do Dashboard e dos detalhes continua a apontar para o mesmo item. Não é preciso migração: os dados antigos ficam ordenados na leitura e gravam-se ordenados no próximo save.
  **Cuidado com edição de datas:** em `session-detail` e `range-drill-detail` (que ficam abertos depois de gravar) o `originalIndex` é recalculado com `sortByDate(all).indexOf(updated)` — senão o 2.º save/delete no mesmo ecrã acertava no item errado. No Dashboard, mudar a data fecha o cartão expandido. `round-detail` não edita datas, por isso fica igual.
  tsc + eslint limpos; `sortByDate` testado (ordem, empates estáveis, data inválida, idempotente).
- **2026-09-11** — **Putting Course: voltar atrás aos buracos (Jo testou e não conseguia).** Na sessão ao vivo os chips H1…Hn eram só leitura e só havia **↶ Undo** do último, por isso não dava para meter os metros depois. Jo escolheu **as duas formas** + **reabrir**:
  **Tocar num chip** → o painel passa a **"Editing hole N"** (azul) com metros e putts preenchidos; os botões de putts escolhem em vez de registar; **✓ Save hole / Cancel / 🗑**. Os metros que já estavam escritos para o buraco novo ficam guardados (`stashedDistance`) e voltam ao sair. Tocar outra vez no chip cancela.
  **✏️ Edit holes** → lista completa com o `PuttingCourseEditor` (metros, putts −/+, 🗑, + Add hole) e **✓ Done · back to hole N**; se havia um buraco em edição, é gravado antes.
  **Reabrir:** tocar na linha **⛳ Putting Course** já terminada (em cima, "✏️ tap to reopen") tira-a dos drills e devolve os buracos ao editor; bloqueado se já houver outro percurso a meio.
  Uma edição aberta e não gravada entra na mesma em **Finish course** e **End & Save** (`withPendingEdit`). tsc + eslint limpos; não testado no browser (npm bloqueado no container, build não corre na VM).
- **2026-09-11** — **Putting Course: um percurso inteiro só a putar.** Exercício da Jo: percorrer um campo (Par 3), e em cada green putar **só a partir da borda mais longe**, contando os putts — **par 2 por buraco** (o mesmo `PUTTS_PER_HOLE` que o Range Drill assume). É o espelho do Range Drill: aquele conta pancadas até ao green e *assume* 2 putts; este conta só os putts.
  **Decisões da Jo:** vive **dentro da sessão de Putting** (não é um ecrã novo nem ligado a um campo da base de dados); em **cada buraco** mete os **metros desde a borda** (primeiro putt) e o número de putts.
  **Modelo:** `Drill.course?: PuttingCourseHole[]` com `{ hole, distance: number | null, putts }`. `success` = % de buracos em ≤2 putts. Resumo em `summarizePuttingCourse()` / `puttingCourseLine()` (`constants/scoring.ts`): putts, ±par, 1-putts, 3-putts+, média de metros.
  **Sessão (`session.tsx`):** toggle **🎯 Grid drill / ⛳ Putting Course** (só Putting). Por buraco: metros (−/+ ou escrever, aceita vírgula) → tocar **1 2 3 4 5+** regista o buraco e passa ao seguinte (metros limpam). Chips H1…Hn coloridos (verde 1-putt, cinza par, laranja 3+), **↶ Undo**, botão **✓ Finish course · add drill**. Buracos em curso vão para o rascunho (`DraftSession.pendingCourse`) e o banner de Resume mostra "⛳ course on hole N". "End & Save" junta um percurso por acabar automaticamente.
  **Detalhe (`session-detail.tsx`):** cartão com mini-scorecard; ✏️ abre `components/PuttingCourseEditor.tsx` (metros + putts −/+ + 🗑 por buraco, **+ Add hole**); no **+ Add** há o chip **⛳ Putting Course** para registar um percurso depois (ex.: o de ontem). Delete como os outros drills.
  **Dashboard:** o cartão mostra "⛳ Putting Course N putts (±par)"; o putting course **fica fora da média "% holed"** porque o `success` mede outra coisa. Insights não mexe (já só contava drills made/attempts). tsc + eslint limpos; não testado no browser (o build web não corre na VM Linux — binário lightningcss é do Mac).
  **Jo concordou com todas as escolhas** (success = % buracos em ≤2 putts, fora da média "% holed"; "5+" grava 5; metros opcionais).
- **2026-09-11** — **Range Drill passa a usar a média real de putts do Putting Course em vez dos 2 fixos.** Ideia que saiu do Putting Course; Jo aprovou.
  **Decisões da Jo:** fonte = **Putting Courses** (não as rondas — sabendo que partir da borda mais longe torna a estimativa mais dura/conservadora); **congelado por drill** — cada drill guarda o valor com que foi jogado, os scores antigos nunca mudam.
  **Regra:** `puttingCourseAverage(sessions)` (`constants/scoring.ts`) — média de putts/buraco nos **últimos 45 buracos** de Putting Course (sessões ordenadas por data), arredondada a 1 casa; **`null` com menos de 9 buracos** → fica o `PUTTS_PER_HOLE` (2).
  **Modelo:** `RangeDrill.puttsPerHole?` + `puttsSampleHoles?` (e o mesmo no `DraftRangeDrill`). O valor é fixado **quando o drill começa** (`startDrill`) e vai para o rascunho e para o save; ao retomar um rascunho antigo sem valor, fixa a média atual. Drills antigos sem campo = 2 (`drillPuttsPerHole()`); a edição no detalhe preserva o campo (`...drill`).
  **Scores com decimais:** buraco = pancadas + putts/buraco (ex. 3 + 1.8 = 4.8), totais e ±par arredondados a 1 casa (`round1`) — Complete, detalhe e cartão do Dashboard. A legenda diz de onde vem: "(1.8/hole · your last 27 putting-course holes)" ou "default until 9 putting-course holes".
  tsc + eslint limpos; lógica testada (janela, mínimo, ordenação). Não testado no browser.
- **2026-09-07** — **Rondas qualifying vs treino, e dois índices em vez de um.** A Jo regista **todas** as rondas na app, treino incluído; na NGF regista **só as que escolhe** como qualifying. Os dois índices medem coisas diferentes de propósito, e a app mostrava um número só, que se confundia com o oficial (nesse dia: app 23.7 · NGF 23.5 → 23.2 depois da ronda; a proximidade é coincidência dos registos se sobreporem, não sinal de correção).
  **Modelo:** `Round.qualifying?: boolean`. Rondas novas nascem com `qualifying: false` (`round.tsx`) — treino por omissão, marca-se depois de registada. O toggle vive no **detalhe da ronda**, por baixo do tempo, e grava logo (é um campo, não faz parte do fluxo de edição de buracos), por isso **as rondas antigas também se marcam** sem re-introduzir nada. Badge verde `✅ qualifying` no cartão do dashboard, ao lado do `📥 imported`.
  **Insights:** `calcHandicap(qualifyingOnly = false)` filtra a fonte antes do `enrichRound`. O cartão passa a ter duas colunas — **ALL ROUNDS** e **QUALIFYING** — e a segunda mostra `—` com `n/3 rounds marked` enquanto não houver três. Só a coluna qualifying é comparável com o índice da federação, e o cartão di-lo.
  **A saber:** com exatamente 3, 4 ou 6 rondas qualifying entra o ajuste WHS para registos finos (−2.0 / −1.0 / −1.0), por isso a coluna qualifying vai parecer artificialmente baixa no início e **sobe** quando chegar a 7. Não é bug.
- **2026-09-07** — **Rondas importadas mostram 0% de fairways e 0 GIR — e isso não é o jogo dela.** Rondas com `imported: true` entram só com o score (`round-import.tsx`): o `holeData` tem par e totais mas **nenhum array `strokes`**. Tudo o que deriva de pancadas cai a zero e é apresentado como se tivesse sido medido. Afeta De Purmer 19-08 (0/13 fairways, 0/18 GIR), Westepark, Beloura, as três do ONE Hills e a ShortGolf de 23-03. **Só 6 rondas têm dados reais de pancadas:** as cinco do ShortGolf não importadas e o Campo Real de 07-09. Os putts são a exceção — esses são introduzidos na importação e são reais.
  Eu li esses zeros como desempenho e contei à Jo uma história errada sobre a ronda do De Purmer ("0 greens em 18 buracos, o jogo curto safou-te"). **Antes de ler um número de fairways ou GIR como desempenho, verificar `imported` e se `holeData[].strokes` tem conteúdo.** Um zero numa ronda importada é um valor em falta, não um valor mau.
  **A corrigir na app:** o dashboard e o detalhe da ronda deviam mostrar "—" em vez de 0% quando não há dados de pancadas, e a distinção importada/registada devia ver-se no cartão. Ainda não falado com a Jo.
- **2026-09-07** — **A ronda terminava no último buraco da lista, mesmo com buracos por jogar (Jo apanhou).** Jo jogou os 10-18 no Campo Real mas **começou no 12**; ao gravar o 18 a ronda fechou-se sozinha com 7 buracos, e o 10 e o 11 ficaram num rascunho no telemóvel. Saltar de buraco nunca esteve partido — a tira de chips no topo do `round-hole.tsx` já navega para qualquer buraco. O que estava errado era o avanço: `holeNumbers.indexOf(hole) + 1` dá `undefined` no fim da lista → `/round-complete`.
  **Correção:** `saveHoleAndContinue` passa a procurar o **próximo buraco sem registo**, rodando a lista a partir do atual (`order.slice(start+1)` + `order.slice(0,start)`), e só termina quando `find` não devolve nada — ou seja, quando todos os buracos têm registo. Quem quiser acabar mais cedo usa o **Save & Finish** que já existia no menu ⚙. Testado em 8 cenários (começo a meio, regravar um buraco anterior, volta de 18 normal, fim de ronda).
  **Segunda correção, no mesmo trabalho:** `scoreVsPar` comparava com `round.coursePar` (o par dos 9 ou 18 completos), por isso a ronda de 7 buracos mostrava **+1 em vez de +9**. Passa a somar o par dos buracos com registo, em `round-complete.tsx` **e** `round-detail.tsx` (senão editar uma ronda revertia o cálculo).
  **Efeito colateral que era preciso apanhar:** `insights.tsx` reconstruía o gross como `coursePar + scoreVsPar` — o que deixa de ser verdade numa ronda parcial. Agora lê `stats.totalStrokes` diretamente. Verificado nas 12 rondas do histórico: `totalStrokes === coursePar + scoreVsPar` em todas, logo **o index não mexe** (23.7 antes e depois).
  **Ainda por corrigir:** a grelha de direção mistura *onde a bola ficou* com *que distância fez* — um drive curto mas no fairway conta como fairway falhado (ver entrada abaixo). E a percentagem no cabeçalho usa `hole / total`, que dá 200% no buraco 18 de uma volta de 9.
- **2026-09-07** — **Fairways falhados que não eram fairways falhados.** A grelha 3×3 do `round-hole.tsx` tem no centro `Fairway` / `Green` / `On Target` e à volta Short / Long / Left / Right; `fairwayHit` sai de `firstStroke.direction === 'Fairway' || 'Green'`. **A Jo lê a grelha inteira em relação ao GREEN, em todos os buracos** (palavras dela: "o short long no fairway, não me apercebi. Percebi como em referência ao Green"). Num par 4, um drive que fica no fairway a 150 m é "Short" — verdade quanto ao green, falso quanto ao fairway. O rótulo do centro muda de `Green` (par 3) para `Fairway` (par 4/5) sem que as células à volta digam alguma vez **em relação a quê**. Passou despercebido meses porque **num par 3 as duas leituras coincidem**, e 5 das 6 rondas com dados de pancadas são no ShortGolf Par 3 — os modelos só divergiram quando ela jogou um campo completo. Nada disto afeta o GIR, que sai de `strokes.length <= par - 2`, sem direções. Resumindo: **Short e Long descrevem a distância ao alvo, não a bola fora do fairway** — na ronda de 07-09 todas as bolas ficaram no fairway (só o bunker do buraco 10 não) e mesmo assim o cartão dizia 1/7 fairways. Os dados dessa ronda foram corrigidos à mão no Supabase (`fairwayHit=true`, `missDirection=null` nos sete par-4/5; direções intactas) → 7/7. **Atenção: a app recalcula `fairwayHit` a partir da direção sempre que um buraco é regravado, por isso reabrir esses buracos reverte a correção.** A solução de fundo é separar *lie* (fairway / rough / bunker / hazard) de *distância* (curta / no alvo / longa) em vez de sobrecarregar uma grelha só — decisão adiada pela Jo a 07-09.
- **2026-08-27** — **New course: The ONE Hills Lisbon City Golf (formerly Clube de Golfe Paco do Lumiar).** Jo knew it by the old name; the FPG rates it under the new one, so the app uses **The ONE Hills Lisbon City Golf** (id `the-one-hills-lisbon`) — search the old name and you will not find it in the federation data. Urban short course in Lisbon, **par 58 over 18 holes**: 14 par 3s and 4 par 4s. Source: scoring-pt.datagolf.pt calculator + scorecard `ncourse=064`, read 27-08-2026.
  **It is the same nine played twice** — holes 1-9 and 10-18 share pars and distances; only the Stroke Index differs (odds out, evens in). Modelled as 18 holes anyway, because that is how it is rated. Front and back nine ratings are therefore exactly half the 18 with identical slope. **Senhoras:**

  | Tee | 18 | Front 9 | Back 9 | Length |
  |---|---|---|---|---|
  | White | 59,3 / 105 | 29,7 / 105 | 29,7 / 105 | 3.122 m |
  | Yellow | 58,4 / 103 | 29,2 / 103 | 29,2 / 103 | 2.918 m |
  | Red | 57,5 / 101 | 28,8 / 101 | 28,8 / 101 | 2.704 m |

  Homens for reference: White 58,2/97 · Yellow 57,5/96 · Red 56,9/94. Verified against the card's subtotals: OUT and IN both 1.561/1.459/1.352 par 29, TOT 3.122/2.918/2.704 par 58 — all match. Stroke Index seeded, so Adjusted Gross Score works from the first round.
  **Worth knowing when reading the index:** par 58 with slope ~101-105 produces materially lower differentials than Campo Real or Beloura for equivalent golf. That is the WHS working as designed, but a good round here moves the index more than one elsewhere.
  **Finding a course id on datagolf:** there is no search. `show_card.asp?ncourse=NNN-1&stat=Y&Club=ALL&ack=8428ACK987` was fetched same-origin in a loop over 001-140 from the calculator page (6 workers) and grepped for the club name — took seconds and found `064`. Reuse that trick rather than guessing.
- **2026-08-27** — **New course: Quinta da Beloura (Sintra, Portugal).** Added `quinta-da-beloura` to `data/courses.ts` from the official FPG data (calculator + scorecard `ncourse=003`), read 27-08-2026. Par 72. **Senhoras** table, all three tees rated:

  | Tee | 18 | Front 9 | Back 9 | Length |
  |---|---|---|---|---|
  | White (Brancas) | 76,9 / 135 | 39,1 / 135 | 37,8 / 135 | 5.727 m |
  | Yellow (Amarelas) | 74,8 / 131 | 37,9 / 131 | 36,9 / 131 | 5.395 m |
  | Red (Vermelhas) | 71,7 / 124 | 36,5 / 124 | 35,2 / 124 | 4.876 m |

  Unlike Campo Real, Beloura's published **Slope is the same for 18, front and back** off each tee — only the Course Rating splits. That is what the federation publishes, not a data-entry slip. Homens for reference: White 70,8/127 · Yellow 69,1/124 · Red 66,6/119.
  Full per-hole par, three-tee distances and **Stroke Index** (F9 3,13,15,11,17,9,1,5,7 / B9 4,12,18,10,16,8,2,14,6) are seeded, so Adjusted Gross Score works there from the first round. Verified against the card's own subtotals: OUT 2.974/2.787/2.549 par 36, IN 2.753/2.608/2.327 par 36, TOT 5.727/5.395/4.876 par 72 — all match. Default `distance` per hole is the Yellow value, matching the Campo Real convention. Portugal now has two courses, so the round screen's 🇵🇹 tab lists both.
- **2026-08-27** — **"Only the Dutch courses can be used to log a round" — scroll position, not the courses (Jo reported it twice; I mis-diagnosed it twice).** `app/round.tsx` lists all 18 courses in one flat, unsorted list ~1,500px tall. Selecting a course **collapses that list to a single card**, so everything below jumps up by more than a screen — but the ScrollView keeps its scroll offset. Pick a course from the top of the list (all the Dutch ones — Campo Real is 11th) and nothing moves, so it works. Pick one further down and the collapse leaves you looking at Weather and a greyed-out **Start Round**, with the tee picker scrolled off the top of the screen. It reads as "this course doesn't work". Reproduced on the live site: real scroll to Campo Real → real click → landed on the disabled Start Round button with tees invisible above.
  Fix: `scrollRef` on the outer ScrollView, `scrollTo({ y: 0, animated: true })` in the course card's `onPress`. `app/round-import.tsx` is not affected — its course list lives in a bounded `maxHeight: 200` inner ScrollView, so collapsing it barely moves the page.
  **Diagnostic lesson:** two earlier readings of this report were wrong — first "the round screen filters courses" (it doesn't), then "the course editor hides tees" (a real bug, but a different one). What settled it was measuring the DOM: the course cards ran to y=1485 inside a 599px-tall scroller, and clicking one mid-list left the viewport stranded. **Check scroll offset and layout height before concluding a control is broken.** Also: a synthetic `element.click()` on React Native Web does not reliably fire `TouchableOpacity` — use a real mouse click at coordinates when verifying in Chrome.
  **Follow-up, same day (Jo said yes):** the round screen now has the same 🇳🇱/🇵🇹 country tabs and club sub-tabs as Manage Courses. Rather than copy the logic, it was extracted to **`services/courseGroups.ts` → `groupCourses(courses, activeCountry, activeClub)`** (returning `countries`, `activeCountryKey`, `clubTabs`, `hasClubTabs`, `activeClubKey`, `visibleCourses`) plus the shared `COUNTRY_FLAG`; `app/courses.tsx` was refactored onto it and its local copies deleted. Deliberate: the two screens drifting apart is precisely what hid Campo Real's tees earlier today, so country/club grouping now has exactly one definition. Tabs only render when there is more than one country / more than one club, so nothing changes for a single-country list. Campo Real is now one tap (Portugal) instead of a scroll past ten Dutch courses.
- **2026-08-27** — **Manage Courses hid any tee outside a hardcoded five-colour list (Jo spotted it).** `app/courses.tsx` had its own local `TEE_COLOURS` const (Blue, White, Yellow, Red, Orange) and rendered tee rows from *that*, not from the course's own `tees`. So Campo Real's **Black, Green and Purple** tees were invisible on the course screen — their CR/Slope could not be viewed or edited — while an **Orange** row it doesn't have was shown instead. Rounds could still be played off those tees, because `app/round.tsx` renders `Object.keys(course.tees)` and was always correct; verified on the live site (all 7 Campo Real tees select fine, "Par 72 · CR 65.3 · Slope 123" shows). The bug also made the new 9-hole rating editor unreachable for 3 of Campo Real's 7 tees.
  Fix: local `TEE_COLOURS` deleted; `courses.tsx` now imports the shared `TEE_COLOUR_MAP` from `constants/theme.ts` (which already had Black/Gold/Green/Purple) and builds rows via `teeRowsFor(course)` = **every tee the course actually has, plus the five standard options it doesn't**, sorted by `TEE_ORDER` (Black, Gold, White, Yellow, Blue, Red, Orange, Green, Purple — longest to shortest), with unrecognised names appended alphabetically. Campo Real now lists Black, White, Yellow, Blue, Red, Orange, Green, Purple; Dutch 4-tee courses are unchanged apart from the more natural ordering. **Rule of thumb: never render a course's tees from a fixed list — always from `Object.keys(course.tees)` plus additions.** tsc + eslint clean.
- **2026-08-27** — **Official front-9 / back-9 CR & Slope, and Campo Real corrected to the Dames table.** Jo asked for separate 9-hole ratings at Campo Real. Two things came out of it.
  **(1) Campo Real was carrying the FPG _Homens_ table.** Seeded values (Black 71,5/136 · Red 65,3/123) match the men's table exactly. Jo plays off Dames, so every Campo Real round was being rated against an easier course. Replaced with the official **Senhoras** table read from the FPG course-handicap calculator (`scoring-pt.datagolf.pt/scripts/calcplayhcp_general.asp?calctype=PT&gender=F`, read 27-08-2026 — the `classif` dropdown option values encode `PAR18|CR18|SL18|PAR9F|CR9F|SL9F|PAR9B|CR9B|SL9B` as a 27-digit string, ×10 on the CRs):

  | Tee | 18 | Front 9 | Back 9 |
  |---|---|---|---|
  | White (Brancas) | 75,8 / 138 | 38,3 / 134 | 37,5 / 141 |
  | Yellow (Amarelas) | 74,2 / 134 | 37,5 / 131 | 36,7 / 137 |
  | Blue (Azuis) | 72,0 / 130 | 36,4 / 126 | 35,6 / 133 |
  | Red (Vermelhas) | 70,4 / 126 | 35,6 / 123 | 34,8 / 129 |
  | Green (Verdes) | 63,4 / 111 | 31,6 / 106 | 31,9 / 117 |
  | Purple (Roxas) | 60,9 / 106 | 30,5 / 102 | 30,4 / 111 |

  **Pretas (Black) is not rated for women** — it now carries `rating: null, slope: null` and shows the existing amber warning. Effect on the index: an 18-hole 104 off Red goes from differential 35,6 (men's 65,3/123) to **30,1** (women's 70,4/126) — her index will *drop*, because she was being scored against the wrong table.
  **(2) `TeeData` gained optional `front9` / `back9`** (`NineRating = { par, rating, slope }`), and `Round` gained `nine?: 'front' | 'back'`. New `services/rating.ts` → `ratingForPlay(teeData, holes, nine, isNineHoleCourse)` is the single place that decides which CR/Slope apply; it returns `isOfficialNine` so the UI can say "Official back nine rating" vs "Estimated". **Fallback is unchanged** for courses without 9-hole data (halve the 18-hole CR, keep the 18-hole Slope), so De Purmer etc. behave exactly as before.
  Why it matters beyond tidiness: a nine's CR is *not* half the 18-hole CR and its Slope differs. Off Red, front is 35,6/123 and back is 34,8/129 — the back nine is rated easier but plays more variable. The two diverge either side of a gross ~52 (a 46 differs by 0,2; a 64 by 0,5).
  **Front 9 / Back 9 toggle added to the live round screen** (`app/round.tsx`) — it only existed on import. A back-nine round now stores holes **10–18**, not 1–9, so `app/round-hole.tsx` no longer assumes holes run `1..total`: it reads the actual hole numbers from `draft.courseHoles` and navigates by index (`prevHole`/`nextHole`), and the progress strip shows H10–H18. `enrichRound` in Insights infers `nine` for pre-existing rounds from the recorded hole numbers, and an official 9-hole rating now **overrides** whatever a round stored (older rounds saved a halved estimate).
  **Course editor** (`app/courses.tsx`) has a collapsible "9-hole ratings (optional)" block per tee — F9 and B9 CR + Slope. A nine is only saved when **both** its CR and Slope are filled, since a half-filled one would be silently dropped by the handicap maths anyway. The tee row shows `F9 35.6/123 · B9 34.8/129` underneath when present.
  **Seed override.** The tee merge in `services/seed.ts` is `stored.rating ?? seed.rating`, which protects user edits but would have kept the wrong men's numbers forever. Added `TEE_RESEED_VERSION` (`'2026-08-27-camporeal-women'`, AsyncStorage key `teeReseedVersion`) + `TEE_RESEED_COURSE_IDS = ['campo-real']`: listed courses take the seed's tees once, then the marker is written. **Holes are deliberately not force-replaced** — stored holes are kept and only a missing `strokeIndex` is filled in, so any distances Jo edited survive.
  **Stroke Index finally exists for one course.** Campo Real's SI came off the same FPG scorecard (`show_card.asp?ncourse=075-1`): 11,3,7,13,17,1,5,9,15 / 6,16,12,14,10,4,18,8,2. This switches on **Adjusted Gross Score** (net double bogey capping) for Campo Real rounds — the long-standing "still open" item from 22-08. Caveat: the FPG card publishes a single SI column, presumably the men's; if the club's Dames card differs, it needs re-entering.
  tsc + eslint clean.
- **2026-08-22** — **De Purmer rounds merged into one rated 18 (data change, no code change).** Follow-up to the entry below. The club's official tables (NGF, 04-03-2025, `De-Purmer-Handicaptabellen-grote-baan.pdf`) rate the **18-hole loop combinations**, not Rode/Witte as standalone 9s — the only 9-hole tables are for the Gele lus. Jo played Rode then Witte off Yellow, which is exactly the rated **Wit-Rood** 18. So the two 9-hole entries were replaced by one 18-hole round: new course `purmer-wit-rood-18` ("Golfpark De Purmer — Wit-Rood (18)", par 71), **Dames** tees Geel 77,6/148 · Blauw 73,8/142 · Rood 72,5/135; round = holes 1–9 Rode + 10–18 Witte, gross 109 (+38), 40 putts. Differential **24.0** — nearly her best, because Wit-Rood off yellow is CR 77.6 / SR 148 for women. **Index 21.6 → 23.1** on best 2 of 7. Ratings cross-checked algebraically against the doubled-loop tables (2×Geel = 75.9 → 9-hole Geel 38.0, matching the printed 9-hole table exactly; Geel+Rood = 75.5 ✓), so the figures are sound. Derived Dames 9-hole values if the single loops are ever needed: **Rode lus** Geel 37.6/140, Blauw 35.6/134, Rood 35.0/128; **Witte lus** Geel ≈40.0 — slope unknown and likely >155 (above the WHS maximum), which is why the 18-hole merge is the honest option. Pre-change snapshots saved as Supabase rows `backup-20260822-premerge` in both `rounds` and `courses`. Gender matters: Heren Wit-Rood off Geel is 71,4/133 — a completely different index.
- **2026-08-22** — **Rounds silently dropped from the Handicap Index (Jo spotted it).** The two 19 Aug rounds (Golfpark De Purmer — Rode lus / Witte lus, Yellow) never reached the index: `calcHandicap` requires CR + Slope, and both `purmer-rode-lus` and `purmer-witte-lus` had `rating: null, slope: null` on every tee (only par was saved). Card kept showing **21.6 · best 2 of 6** while 8 rounds were logged. Root cause of the confusion: `app/courses.tsx` rendered `Par {par} · CR {rating} · Slope {slope}` unconditionally — null renders as nothing in RN, so a blank tee read as "Par 36 · CR · Slope" and *looked* filled in. Two fixes: (1) courses tee row now shows `CR — · Slope —` in amber plus "⚠️ CR/Slope needed for handicap" when either is missing (`teeDetailsIncomplete` style); (2) `calcHandicap` now returns `skippedCount` + `skippedNames`, and the Insights handicap card shows a tappable amber line — "⚠️ N of M logged rounds not counted — missing Course Rating / Slope (course names). Tap to add them." — routing to `/courses`. Jo enters the real De Purmer CR/Slope herself. **Expected once entered:** index moves 21.6 → ~22.6 on "best 2 of 8" — it *rises* because the WHS thin-record adjustment (−1.0) only applies at 3, 4 and 6 rounds, not at 7+. Correct behaviour, just counterintuitive. **Still open:** no course has Stroke Index filled in, so Adjusted Gross Score (net double bogey) never runs — the 10 on Witte lus counts in full (≈3 strokes of differential). tsc + eslint clean.
- **2026-08-17** — **Range Drill: tee colour selection.** The drill used the generic `hole.distance` and ignored `distanceByTee`, so an 18-hole simulation always played the same length regardless of tee. Now: tapping a course opens the start modal with **tee colour chips first** (colours from `TEE_COLOUR_MAP`, each showing that tee's total metres), then the hole-count buttons — the modal now also appears for ≤9-hole courses (single "Start drill · N holes" button) so a tee can still be chosen. Jo's calls: tee picker **inside the hole-count modal** (not inline chips like `/round`), and **silent fallback** to `hole.distance` when a course has no per-tee distances. Implementation: new `holesForTee()` helper resolves each hole's distance once at `startDrill`, so the running distance-to-green, `courseDistance`, and the draft all work unchanged downstream. `tee` added to `RangeDrill` + `DraftRangeDrill` (optional — old drills keep working); shown on the active header, Complete screen, resume banner, Dashboard Drills card, and drill detail. tsc clean. **Par does not vary by tee** (Jo confirmed) — only distance does, so `HoleDefinition.par` stays a single value per hole and no per-tee par is needed anywhere.
- **2026-07-15** — **"Empty data" again — project was PAUSED (free-tier auto-pause).** Restored from the dashboard; data intact. Key facts for next time:
  - **Where the project lives:** org **MatchMind Studio** → project **Golf-tracker** (ref `xhvqfnqeitmiqjlcrxpg`, AWS eu-central-1). This org is only reachable from the **Safari** session. Jo has several Supabase logins — Chrome is signed into `sportsmanagementjb@gmail.com` (orgs: Memorias do Carvalhal, Personal Training-Hub) and there's also a `birdiesports@gmail.com` org. Opening a project URL while signed into the wrong account silently bounces to that account's project list, which looks like "can't get in".
  - **Diagnostic correction:** a paused Supabase project **loses its DNS record** — `xhvqfnqeitmiqjlcrxpg.supabase.co` returned NXDOMAIN from both Google and Cloudflare resolvers while paused. Do **not** read NXDOMAIN as "project deleted" (Claude did, wrongly). Symptom chain: paused → NXDOMAIN → `TypeError: Failed to fetch` → storage reads return null → every screen empty.
  - **Why it pauses:** free-tier projects pause after ~1 week without API traffic, and a free org has a cap on simultaneously active projects (MatchMind Studio also holds *Training Hub*). Prevention: use the app weekly, upgrade the org to Pro, or pause/remove the unused project.
  - **Outstanding risk (not yet fixed):** `saveToSupabase` writes whatever is in memory. If a read fails (paused/outage) and returns `[]`, the next save **overwrites the real row with an empty array** — a genuine data-loss path. Proposed: refuse writes when the last read failed, plus a local export/backup.
- **2026-07-14** — **Range Drill: overshoot-aware distance to green** (Jo spotted a 100m shot on a 58m hole showing "⛳ On / near the green"). Remaining distance now "bounces": each shot does `remaining = |remaining − distance|`, so overshooting leaves you the overshoot distance from the green on the far side, shown amber as "⚠️ Xm past the green" (last shot flew past) vs blue "🎯 Xm to the green". "⛳ On / near the green" now requires remaining ≤ `NEAR_GREEN_M` (10m, new constant in `constants/scoring.ts` — roughly a green's radius) instead of the old ≤0m rule. Jo's calls: 10m threshold + bounce-back (not warn-only). Manual "On the Green" button unchanged.
- **2026-07-14** — **Connection-error banner** (follow-up to today's outage): Supabase read failures no longer look like an empty account. `storage.ts` counts failed reads (`readFailures`) and exposes `consumeReadError()` — returns true if any read failed since last call, then resets. New shared `components/LoadErrorBanner.tsx` ("⚠️ Couldn't load your data — check your connection. Your data is safe in the cloud." + Retry button) shown on **Dashboard**, **Insights**, and **Club Distances** when their load routine consumed an error; Retry re-runs the screen's load. Home screen untouched (only reads local drafts). Lint + tsc clean.
- **2026-07-14** — **"Empty data" outage — no code change.** App showed empty everywhere because the Supabase REST API (`xhvqfnqeitmiqjlcrxpg.supabase.co`) was unreachable during a Supabase platform incident (dashboard showed the project itself as Healthy throughout; a resolved multi-day capacity incident ended 2026-07-13). When reads fail, `getFromSupabase` logs the error and returns `null` → screens render empty arrays, so an outage looks like data loss. Verified after recovery: `sessions` and `rounds` singleton rows intact. Note for next time: check https://status.supabase.com and the project dashboard (org **MatchMind Studio** → Golf-tracker) before debugging code. Possible future improvement: distinguish "fetch failed" from "no data yet" in the UI (e.g. an offline/error banner instead of silent empty state).
- **2026-06-30** — Closed two CRUD gaps (per Jo's edit/save/resume/delete rule). (1) **Dashboard Drills card** now has an **✏️ Edit** button that opens `range-drill-detail` straight into edit mode via `autoEdit=1`. (2) **Practice sessions now autosave + resume**: new `DraftSession` type + `getDraftSession`/`saveDraftSession`/`clearDraftSession` (AsyncStorage `draftSession`). `session.tsx` autosaves committed drills + notes (timer captured, not per-tick) whenever drills/notes change, clears on save/discard, and hydrates when launched with `resume=1`. Home screen shows an amber **Resume {type} session** banner (with ✕ discard). Note: only committed drills are saved, not a half-counted current grid/bucket.
- **2026-06-30** — Range Drill **full editing** on `range-drill-detail.tsx` (per Jo's rule: every record should have edit/save/resume/delete). Added an Edit mode: change the date (web `<input>` / native `DateTimePicker`), notes, and per-hole shots — change club via a picker modal, edit distance, remove, or add shots. Save validates every shot has a distance and every hole ≥1 shot, then writes back at the original (reversed) index; score recalculates live. Delete is also available here (confirm → splice → back). Range drills now have the complete set: save + resume (drill flow), edit + delete (detail).
- **2026-06-30** — Range Drill scoring: **estimated full-hole score** adds a flat `PUTTS_PER_HOLE` (2, in new `constants/scoring.ts`) to each hole's shots-to-green. This is now the **main** strokes & vs-par number on the drill Complete screen, `range-drill-detail.tsx`, and the Dashboard Drills card (shown as "est N"). Per-hole scorecard strokes = shots + 2; a caption shows the shots/putts breakdown. Rationale: par includes putting, so comparing raw shots-to-green against par was flattering — adding 2 putts makes vs-par a fair comparison (Jo's insight). Shots-to-green still visible via the caption + the clubs/shot lists.
- **2026-06-30** — Range Drill: fixed "couldn't save / couldn't stop" on multi-hole courses.
  - Root cause: the active drill only reached the Save screen after completing **every** hole the course defines (`holeIndex + 1 >= totalHoles`). On an 18-hole course you couldn't stop after 9 — only Discard. There is no 9/18 selector; the drill always expects the full course.
  - Added a **🏁 Finish Drill** button (active phase, shown once ≥1 hole is completed) that ends the drill and saves the holes played so far. If the current hole has shots logged but isn't marked "On the Green", it prompts to include or drop that hole.
  - Hardened save: `saveToSupabase` now optionally throws (`throwOnError`); `saveRangeDrills` opts in. `saveDrill` shows a "Save failed" alert and keeps the scorecard on screen instead of silently navigating away on error. Added a `saving` guard so the button can't double-fire. Other tables keep the old non-throwing behavior.
  - Verified: `range_drills` table exists in Supabase with correct schema (`id` text, `data` jsonb), unrestricted — DB was never the problem.
  - Added a **9/18 length picker**: tapping a course with >9 holes now opens a modal (Full round / Front 9 [holes 1–9] / Back 9 [last 9]). ≤9-hole courses start immediately. The chosen subset drives the whole drill (`selectedHoles` state replaces the old `selectedCourse.holes`); holes are sorted by hole number before slicing. Saved drill records the actual hole numbers played.
  - Added a **saved-drills view**: new **🎯 Drills** tab on the Dashboard lists past range drills (course, date, holes, strokes vs par, duration) with View/Delete; added a "Drills" count to the summary bar. New screen `app/range-drill-detail.tsx` shows the full scorecard with tap-to-expand per-hole shot lists. Index mapping mirrors session/round detail (`orig = all.length - 1 - index`). Route cast `as any` like `/range-drill` to dodge the stale typed-routes cache.
  - Added **drill-data → club distances** (reverse of club suggestions): the Club Distances screen now aggregates every saved drill shot by club (avg / count / min–max) and shows it per club as a separate **📊 From drills** line. Per Jo's calls, it's kept in its own field (new `drillAvg` / `drillCount` / `drillUpdatedAt` on `ClubDistance` — Carry/Total untouched) and only applied on approval via a one-tap **Save/Update drill avg** button (shown when the live average differs from the saved one). Fixed a latent bug where editing a club via the form wiped `direction`/`note` (now preserves existing fields).
  - Added **measured-vs-real gap flags** on each club: compares the live drill average against Trackman **Total only** and flags any gap ≥ `GAP_THRESHOLD` (10m) — amber ⚠️ "shorter", green ✅ "longer", e.g. "⚠️ 12m shorter than Total (228 vs 240m)". Needs ≥ `MIN_DRILL_SHOTS` (3) drill shots before flagging to avoid noise. Both constants live at the top of `clubs.tsx`. **Total-only by design:** a drill logs only the ball's end distance (= total), so comparing against carry would just reflect roll, not performance (Jo's call).
  - Added **live "distance to the green"**: during a hole, remaining = hole length − sum of shot distances, shown both in the hole card (under the 📏 length) and as a bar above the shot input. Once remaining ≤ 0 it shows "⛳ On / near the green". Requires the hole to have a distance; otherwise hidden. To keep the number accurate, **shot distance is now required** when adding a shot (`addShot` rejects blank/0/non-numeric with a "Distance required" prompt) — per Jo's call that every shot must have a distance.
  - Added **autosave + resume + discard** for in-progress drills (mirrors Draft Round). New `DraftRangeDrill` type + `getDraftRangeDrill`/`saveDraftRangeDrill`/`clearDraftRangeDrill` in storage (AsyncStorage key `draftRangeDrill`, per-device, like `draftRound`). The drill autosaves after every shot/hole during the active phase (timer `seconds` excluded from effect deps to avoid per-tick writes). The selecting screen shows an orange **Resume drill** banner (with ✕ to discard) when a draft exists; resuming restores course, hole subset, hole index, completed holes, current shots, seconds, and notes. Draft is cleared on successful save and on discard. **Note:** the lost Westpark drill predates this and is unrecoverable — autosave only protects drills going forward.
- **2026-06-25** — Chipping logging reworked to **proximity buckets**: per drill, count ≤1m / ≤2m / ≤3m / Out (>3m) / Mishit (+ drill name + club). Success = % within the day's adaptive target; feeds dashboard + Insights. Putting & Pitching keep the direction grid. Old grid-based chipping drills still display/edit as grids (backward compatible). Reason: the direction grid couldn't capture proximity, so detail was being lost in free-text notes.
- **2026-06-23** — Code health pass:
  - Fixed crash bug in `session.tsx` (undefined `threshold` → `actualThreshold` in the live grid summary).
  - Fixed `(tabs)/dashboard.tsx` `flatMap` union typing.
  - Renamed helper `useGridInput` → `isGridType` in `session-detail.tsx` (the `use` prefix made the linter treat it as a hook).
  - Deleted stray untracked `app/dashboard.tsx` (old AsyncStorage version that collided with the tabbed dashboard on `/dashboard`).
  - Cleaned all lint warnings → 0 (ternary-statements to if/else, unused imports, run-once `useEffect` documented with eslint-disable).
  - **Note:** 2 remaining tsc errors for `/session-detail` come from a stale Expo Router type cache (`.expo/types/router.d.ts`). They clear automatically on the next `npx expo start` — not a code bug.

## Overview
A personal golf training tracker app built with **React Native + Expo**, designed for use on iPhone during practice sessions and rounds. Built collaboratively by Jo and Claude, learning to code along the way.

---

## Tech Stack
- **Framework**: React Native with Expo (managed workflow)
- **Routing**: Expo Router (file-based — each file in `/app` = a screen)
- **Language**: TypeScript (.tsx files)
- **Storage**: **Supabase** (cloud) for all saved data — sessions, rounds, courses, club distances, range drills. **AsyncStorage** only for the transient draft round (per device). Keys/URL in `.env.local` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- **Hosting**: **Vercel** — the app runs as a deployed **web app** (used in the phone browser).
- **Dev tools**: Node.js, VS Code

---

## Running & Deploying

**Primary usage:** the **deployed Vercel web app**, opened in the phone browser.

**To ship a change:** commit and push to `main` — Vercel auto-deploys on push.
```bash
git add -A && git commit -m "..." && git push
```

**Local preview (optional):**
```bash
cd golf-tracker
npx expo start --web     # run in a browser on the Mac
```

**Manual web build (what Vercel runs):**
```bash
npx expo export --platform web   # outputs to dist/
```

---

## File Structure
```
app/
├── index.tsx          # Home screen
├── session.tsx        # Practice session screen
├── dashboard.tsx      # Dashboard (sessions + rounds)
├── insights.tsx       # Insights + handicap
├── round.tsx          # Round setup
├── round-hole.tsx     # Hole-by-hole tracker
├── round-complete.tsx # End of round, save
├── round-detail.tsx   # Round detail view
├── courses.tsx        # Course database manager
└── clubs.tsx          # Club distances (Trackman reference)
```

---

## Screens & Features

### 🏠 Home (`index.tsx`)
- Select practice type: Putting / Short Game / Long Game
- Navigate to: Start Session, Dashboard, Insights, Log a Round, My Courses, My Club Distances

### 🏋️ Practice Session (`session.tsx`)
- Live timer (MM:SS)
- **Pre-loaded drill chips** (horizontal scroll) — tap to auto-fill name + attempts
- Manual drill entry: name, made, total → calculates success %
- **Session notes** — free text field above "End & Save Session"
- Notes shown on dashboard session cards with 📝 icon
- **⛳ Chipping Course** (Chipping only) — toggle next to the target drill: per hole pick lie (Fairway/Rough/Bunker), metres to the hole, tap strokes to hole out (1–5+); par 2 (up and down); shows up & down % and sand saves; same edit/reopen/resume flow as the Putting Course
- **⛳ Putting Course** (Putting only) — toggle next to the grid drill: per hole enter metres from the green's far edge + tap putts (1–5+); par 2/hole; undo; resumable; edit per hole in session detail
- Saves to AsyncStorage under `sessions` key
- Drills sourced from practice PDF (all distances in metres):
  - **Putting**: Short Putts 1m (×25), 2m (×15), Lag 6/9/12m (×10), Pressure Ladder
  - **Short Game**: Basic Chips, Pitch Low/High, Up & Down Challenge (all ×10)
  - **Long Game**: Wedge 45/70/90m, Trajectory Drill (×15), Mid Irons Solid/Target, Fairway Finder, Shape Practice

### 📊 Dashboard (`dashboard.tsx`)
- Summary bar: total sessions, rounds, practice time
- **Practice tab**: sessions list with type, date, duration, drill results, notes
- **Rounds tab**: rounds list with course, tee, score vs par, FIR/GIR/putts
- **Tap any card** to expand → shows:
  - 📅 Edit Date (DD/MM/YYYY format)
  - 📋 Details (rounds only → navigates to round-detail)
  - 🗑 Delete (with confirmation alert)
- Uses `Pressable` instead of `TouchableOpacity` for cards (better tap handling on iOS inside ScrollView)

### 🧠 Insights (`insights.tsx`)
- **Training Handicap Index** (WHS formula):
  - Differential = `(Gross Score − Course Rating) × 113 ÷ Slope Rating`
  - 9-hole rounds: differential × 2
  - Uses best N differentials from last 20 rounds (WHS table)
  - Multiplied by 0.96
  - Requires minimum 3 rounds with CR + Slope saved
- Weakest area (lowest drill success %)
- Recommendation based on weakest area
- Practice distribution (sessions per type)
- Overall drill success %
- Total practice time

### 🏌️ Round Setup (`round.tsx`)
- Select saved course from database
- Select tee colour → auto-fills Par, CR, Slope
- **9 or 18 holes** — par automatically halved for 9-hole rounds
- Weather: Wind / Sky / Ground conditions
- Saves draft to `draftRound` key

### 🕳️ Hole Tracker (`round-hole.tsx`)
- Par selector (3/4/5)
- Fairway hit Yes/No (hidden on Par 3)
- **Tee miss direction**: Left / Right / Short / Long (shown when fairway missed)
- Penalties: Water / OB / Hazard / Other + optional comment
- Clubs per stroke (Driver → Putter) with undo
- Putts counter
- GIR auto-detected: strokes ≤ par − 2
- **Approach miss direction**: Left / Right / Short / Long — shown when putts > 0 AND GIR missed (i.e. after you're on the green, looking back at where the approach landed)
- Score vs par shown live
- Saves hole data to `draftRound`, navigates to next hole
- **⚙ Round Options menu** (top of screen, available at any moment) — modal with three clear actions, consistent on web + phone:
  - **Resume** → close menu, keep playing
  - **Save & Finish** → go to round-complete (saves round to dashboard)
  - **Discard Round** → two-step confirm, then `clearDraftRound()` and back home — never added to the dashboard
  - Replaced the old "✕ Exit Round" link, which on web could only save (forcing save-then-delete to abandon a round)

### 🏁 Round Complete (`round-complete.tsx`)
- Auto-calculates: total strokes, score vs par, FIR%, GIR%, putts/hole, Par 3 GIR
- Hole-by-hole summary
- Free-text round notes
- Saves to `rounds` key, clears `draftRound`

### 📋 Round Detail (`round-detail.tsx`)
- Full breakdown of a saved round
- Header: course, date, tee, weather
- Score card (green): total strokes + vs par label
- Stats grid: Fairways, GIR, Putts, Par 3 GIR
- Hole-by-hole table: score, +/-, FIR, GIR, putts
  - Colour coded: birdie=green, bogey=red, eagle=blue, double+=dark red
- Under each hole: clubs used, tee miss direction, approach miss direction, penalties
- Round notes

### ⛳ Course Database (`courses.tsx`)
- Add / delete courses
- Each course has 5 tee colours: **Blue, White, Yellow, Red, Orange**
- Each tee stores: Par (18-hole), Course Rating (CR), Slope
- Colour-coded tee badges, expandable cards, inline editing
- Saves to `courses` key

### 🏌️ My Club Distances (`clubs.tsx`)
- Full list of clubs: Driver, 3W, 5W, 4H, 5H, 4i–9i, PW, GW, SW, LW
- Tap any club to log Trackman data: **Carry (m)**, **Total (m)**, **Ball Speed (km/h)**
- Shows last updated date per club
- Used as an on-course reference for club selection
- Saves to `clubDistances` key

---

## AsyncStorage Keys
| Key | Contents |
|-----|----------|
| `sessions` | Array of practice sessions |
| `rounds` | Array of completed rounds |
| `draftRound` | Current round in progress |
| `courses` | Array of saved courses with tee data |
| `clubDistances` | Club carry/total/ball speed from Trackman |

---

## Data Structures

### Practice Session
```json
{
  "type": "Putting",
  "duration": 3600,
  "date": "2026-03-27T10:00:00.000Z",
  "notes": "Felt good on short putts today",
  "drills": [
    { "name": "Short Putts 1m", "made": "23", "attempts": "25", "success": 92 },
    { "name": "Putting Course", "success": 67,
      "course": [ { "hole": 1, "distance": 12, "putts": 2 }, { "hole": 2, "distance": 8.5, "putts": 1 }, { "hole": 3, "distance": null, "putts": 3 } ] }
  ]
}
```

### Round
```json
{
  "courseName": "Quinta do Peru",
  "tee": "White",
  "holes": 18,
  "coursePar": 72,
  "courseRating": 71.2,
  "slopeRating": 130,
  "weather": { "wind": "Light Wind", "sky": "Sunny", "ground": "Dry" },
  "date": "2026-03-27T10:00:00.000Z",
  "notes": "...",
  "holeData": [
    {
      "hole": 1,
      "par": 4,
      "strokes": ["Driver", "7i"],
      "putts": 2,
      "totalStrokes": 4,
      "fairwayHit": true,
      "missDirection": null,
      "approachMiss": null,
      "gir": true,
      "penalties": []
    }
  ],
  "stats": {
    "totalStrokes": 85,
    "totalPutts": 34,
    "puttsPerHole": "1.9",
    "fairwaysHit": 9,
    "fairwayTotal": 14,
    "fairwayPct": 64,
    "girCount": 7,
    "girPct": 39,
    "par3Gir": 2,
    "par3Total": 4,
    "scoreVsPar": 13
  }
}
```

### Course
```json
{
  "id": "1234567890",
  "name": "Quinta do Peru",
  "tees": {
    "White": { "par": 72, "rating": 71.2, "slope": 130 },
    "Yellow": { "par": 72, "rating": 69.5, "slope": 125 },
    "Red": { "par": 72, "rating": 67.0, "slope": 118 }
  }
}
```

### Club Distances
```json
{
  "Driver": { "carry": "210", "total": "230", "ballSpeed": "155", "updatedAt": "2026-03-27T10:00:00.000Z" },
  "7 Iron": { "carry": "145", "total": "155", "ballSpeed": "120", "updatedAt": "2026-03-27T10:00:00.000Z" }
}
```

---

## Key Design Decisions
- **Distances in metres** (not yards/feet) throughout the app
- **9-hole par** = course par ÷ 2 (auto-calculated on round start)
- **AsyncStorage is device-specific** — data logged on phone won't appear on web and vice versa. Always use phone for real data.
- **Expo Go** requires Mac server running + same WiFi (or tunnel mode). Not usable on course without Mac running.
- **FlatList replaced with .map()** inside ScrollView to avoid "VirtualizedLists nested in ScrollView" error
- **KeyboardAvoidingView** used on session + round-complete screens to prevent keyboard covering inputs
- **Pressable** used instead of TouchableOpacity for cards inside ScrollView (better tap handling on iOS)
- **addPenalty** function must be at component scope, not nested inside saveHoleAndContinue
- **Approach miss direction** shown only when putts > 0 (not while still logging strokes) — avoids confusion about which stroke it refers to
- **TextInput** must be explicitly imported in each file that uses it

---

## WHS Handicap Table (differentials to use)
| Rounds | Best N |
|--------|--------|
| 3–5 | 1 |
| 6–8 | 2 |
| 9–11 | 3 |
| 12–14 | 4 |
| 15–16 | 5 |
| 17–18 | 6 |
| 19 | 7 |
| 20 | 8 |

---

## Completed Features
- [x] Practice session tracking with timer and drill logging
- [x] Pre-loaded drills from practice PDF (in metres)
- [x] Session notes
- [x] Round tracking hole-by-hole (par, clubs, fairway, GIR, putts, penalties)
- [x] Tee miss direction (Left/Right/Short/Long when fairway missed)
- [x] Approach miss direction (Left/Right/Short/Long when GIR missed, shown after first putt)
- [x] Course database with 5 tee colours and CR/Slope per tee
- [x] 9 vs 18 holes (par auto-adjusted)
- [x] Weather tracking per round
- [x] Dashboard with Practice + Rounds tabs
- [x] Edit date and delete for sessions and rounds
- [x] Round detail view with hole-by-hole breakdown and colour-coded scores
- [x] Training Handicap Index (WHS formula)
- [x] Insights: weakest area, recommendations, practice distribution
- [x] My Club Distances (Trackman reference — carry, total, ball speed)

## Pending / Future Features
- [ ] Home screen quick stats (last session, current handicap)
- [ ] Miss pattern analysis in insights (e.g. "you miss left 68% off the tee")
- [ ] Progress charts (handicap trend, FIR%/GIR% over last 10 rounds)
- [ ] Build standalone app (requires Apple Developer account, €99/year)
- [ ] Re-edit full round hole by hole
- [ ] Export data (CSV / PDF)
