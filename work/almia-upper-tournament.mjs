const players = (value) => value.split("|");
const results = (value) => value.split("|").map((entry) => {
  const separator = entry.lastIndexOf(":");
  return [entry.slice(0, separator), Number(entry.slice(separator + 1))];
});
const room = (number, host, value) => ({ room: number, host, results: results(value) });

export const almiaUpperTournament = {
  name: "Almia Upper Result",
  date: "2026-08-15",
  ratingCutoff: "2026-08-15T16:01:00Z",
  registeredPlayers: players("Snickers|Dudu|HypeSpeed|her mit|Nuke|Bally|MattAUS|zyoshi|Nikola Tesla|Azn|KMNZ|Klover|Joey|Edwin|Isaac Newton|sealion|jay|pttmxrx|Prin|sousui|Jawdyn|Toddy|Cypher|Quinn|Zyra|Fox|Cormac|Black|pam2024mode|mayuka|NUBBLY|swofg|Paul Youngblood|fifi|crack|coco day2|ilip|Danyy|runo|noob bugha|Kasperinos|ousmane|Browks|Wohrld|smash|jojo|zilla|EDavid|Cynda|Kenny|studio ghibli|season|Nlaw|jaro|ish|White|Patrick Mcalpine|dy|Tony Vlachos|kevin|holy|nefer|deez|Ramiel|Kiroh|DarkChaos|py|Tectrox|Leon|brisk|lr|Theodor|Moroha|embrez|barney|Kyon|josh|Misa|Himari Sanada|tosa|Alysa Liu|Sepi|Leb|tobun|kali"),
  rounds: [
    { round: 1, label: "Round 1", format: "2 GP", rooms: [
      room(1, "kevin", "kevin:77|barney:61|Tectrox:59|Browks:59|embrez:57|fifi:53|ilip:46|Kyon:43|Ramiel:40|Alysa Liu:39|Paul Youngblood:26|brisk:24"),
      room(2, "Cormac", "ish:80|Cormac:69|noob bugha:53|ousmane:53|jaro:48|Kiroh:45|tobun:44|tosa:43|MattAUS:41|Leon:38|Azn:36|Klover:34"),
      room(3, "Bally", "Black:81|Misa:74|sousui:65|Tony Vlachos:56|jojo:50|zilla:50|Sepi:47|Edwin:39|Zyra:38|Bally:37|smash:22|HypeSpeed:19"),
      room(4, "Fox", "swofg:92|Wohrld:58|Fox:54|pttmxrx:51|dy:46|zyoshi:46|Patrick Mcalpine:40|mayuka:39|EDavid:37|deez:25|KMNZ:0|studio ghibli:0"),
      room(5, "Nikola Tesla", "Kasperinos:68|Nikola Tesla:60|Prin:59|sealion:59|White:56|coco day2:40|Snickers:35|Himari Sanada:31|NUBBLY:21|Joey:15|Cypher:0|jay:0"),
      room(6, "DarkChaos", "Isaac Newton:78|Nlaw:71|Leb:57|crack:53|Kenny:52|Moroha:51|josh:47|Theodor:43|holy:43|lr:36|Danyy:29|DarkChaos:24"),
      room(7, "pam2024mode", "pam2024mode:70|py:61|season:56|Toddy:56|Quinn:56|Nuke:54|nefer:51|Cynda:40|runo:37|Jawdyn:28|Dudu:19|her mit:0"),
    ]},
    { round: 2, label: "Round 2", format: "3 GP", rooms: [
      room(1, "kevin", "noob bugha:104|Patrick Mcalpine:90|Isaac Newton:84|kevin:83|Fox:79|Kenny:71|Prin:68|Kasperinos:66|Moroha:62|Kiroh:62|jojo:60|sealion:47"),
      room(2, "pam2024mode", "ousmane:102|pam2024mode:100|Misa:88|season:81|White:73|coco day2:71|sousui:69|Browks:67|ish:62|zilla:49|tobun:48|fifi:10"),
      room(3, "Cormac", "jaro:105|Cormac:97|Black:92|Nuke:88|Quinn:73|Nlaw:71|Tony Vlachos:68|Tectrox:66|nefer:60|Wohrld:55|embrez:48|ilip:45"),
      room(4, "Nikola Tesla", "barney:110|Toddy:102|Nikola Tesla:100|crack:85|py:74|dy:73|pttmxrx:69|swofg:65|Leb:65|Sepi:53|josh:46|zyoshi:34"),
    ]},
    { round: 3, label: "Semifinal", format: "3 GP", rooms: [
      room(1, "pam2024mode", "White:107|Nikola Tesla:100|pam2024mode:98|coco day2:95|Patrick Mcalpine:82|Fox:78|noob bugha:73|Isaac Newton:62|Nuke:58|dy:58|jaro:34|season:31"),
      room(2, "Cormac", "Black:92|Kenny:91|barney:84|kevin:83|Toddy:74|Cormac:73|py:69|crack:64|Quinn:60|ousmane:58|Misa:58|Nlaw:55"),
    ]},
    { round: 4, label: "Final", format: "3 GP", rooms: [
      room(1, "Nikola Tesla", "Cormac:107|Nikola Tesla:92|Black:84|kevin:80|Kenny:79|Fox:68|pam2024mode:67|White:64|Toddy:64|coco day2:61|Patrick Mcalpine:56|barney:54"),
    ]},
  ],
};
