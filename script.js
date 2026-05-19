let balance = 1000;

const globalBalanceEl = document.getElementById("global-balance");
const resetCasinoBtn = document.getElementById("reset-casino");

function updateBalance() {
  globalBalanceEl.textContent = "$" + balance;
}

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = "message " + type;
}

document.querySelectorAll("[data-screen]").forEach(button => {
  button.addEventListener("click", () => {
    showScreen(button.dataset.screen);
  });
});

document.querySelectorAll(".back-btn").forEach(button => {
  button.addEventListener("click", () => {
    showScreen("menu-screen");
  });
});

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.toggle("active", screen.id === id);
  });

  if (id === "roulette-screen") {
    setTimeout(() => {
      buildRouletteLabels();
    }, 50);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* CARTAS */
const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  let deck = [];

  for (let suit of suits) {
    for (let rank of ranks) {
      deck.push({
        suit,
        rank,
        color: suit === "♥" || suit === "♦" ? "red" : "black"
      });
    }
  }

  return shuffle(deck);
}

function shuffle(array) {
  let arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    let random = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[random]] = [arr[random], arr[i]];
  }

  return arr;
}

function createCard(card, hidden = false) {
  let div = document.createElement("div");

  if (hidden) {
    div.className = "card back";
    return div;
  }

  div.className = "card " + (card.color === "red" ? "red" : "");
  div.innerHTML = `
    <div class="corner">${card.rank}<br>${card.suit}</div>
    <div class="center-suit">${card.suit}</div>
    <div class="corner bottom">${card.rank}<br>${card.suit}</div>
  `;

  return div;
}

function rankValue(rank) {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return Number(rank);
}

/* BLACKJACK */
const bj = {
  deck: [],
  dealer: [],
  player: [],
  bet: 0,
  active: false,
  hidden: true
};

const bjEls = {
  message: document.getElementById("bj-message"),
  bet: document.getElementById("bj-bet"),
  dealerCards: document.getElementById("bj-dealer-cards"),
  playerCards: document.getElementById("bj-player-cards"),
  dealerScore: document.getElementById("bj-dealer-score"),
  playerScore: document.getElementById("bj-player-score"),
  chips: document.querySelectorAll(".bj-chip"),
  clear: document.getElementById("bj-clear"),
  deal: document.getElementById("bj-deal"),
  hit: document.getElementById("bj-hit"),
  stand: document.getElementById("bj-stand"),
  double: document.getElementById("bj-double")
};

function bjValue(rank) {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

function bjScore(hand) {
  let total = 0;
  let aces = 0;

  for (let card of hand) {
    total += bjValue(card.rank);
    if (card.rank === "A") aces++;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && bjScore(hand) === 21;
}

function renderBlackjack() {
  bjEls.dealerCards.innerHTML = "";
  bjEls.playerCards.innerHTML = "";

  bj.dealer.forEach((card, index) => {
    bjEls.dealerCards.appendChild(createCard(card, bj.hidden && index === 1));
  });

  bj.player.forEach(card => {
    bjEls.playerCards.appendChild(createCard(card));
  });

  if (bj.hidden && bj.dealer.length > 0) {
    bjEls.dealerScore.textContent = bjValue(bj.dealer[0].rank);
  } else {
    bjEls.dealerScore.textContent = bjScore(bj.dealer);
  }

  bjEls.playerScore.textContent = bjScore(bj.player);
  bjEls.bet.textContent = "$" + bj.bet;
}

function updateBlackjackButtons() {
  bjEls.chips.forEach(chip => {
    let value = Number(chip.dataset.value);
    chip.disabled = bj.active || balance < value;
  });

  bjEls.clear.disabled = bj.active || bj.bet === 0;
  bjEls.deal.disabled = bj.active || bj.bet === 0;
  bjEls.hit.disabled = !bj.active;
  bjEls.stand.disabled = !bj.active;
  bjEls.double.disabled = !bj.active || bj.player.length !== 2 || balance < bj.bet;
}

function bjPlaceChip(value) {
  if (bj.active || balance < value) return;

  balance -= value;
  bj.bet += value;

  updateBalance();
  renderBlackjack();
  updateBlackjackButtons();
  setMessage(bjEls.message, "Apostaste $" + bj.bet + ". Ya podés repartir.");
}

function bjClearBet() {
  if (bj.active) return;

  balance += bj.bet;
  bj.bet = 0;

  updateBalance();
  renderBlackjack();
  updateBlackjackButtons();
  setMessage(bjEls.message, "Apuesta limpiada.");
}

function bjDeal() {
  if (bj.bet <= 0) return;

  bj.deck = createDeck();
  bj.dealer = [bj.deck.pop(), bj.deck.pop()];
  bj.player = [bj.deck.pop(), bj.deck.pop()];
  bj.hidden = true;
  bj.active = true;

  renderBlackjack();
  updateBlackjackButtons();

  let playerBJ = isBlackjack(bj.player);
  let dealerBJ = isBlackjack(bj.dealer);

  if (playerBJ && dealerBJ) {
    bjFinish("push");
  } else if (playerBJ) {
    bjFinish("blackjack");
  } else if (dealerBJ) {
    bjFinish("dealerWin");
  } else {
    setMessage(bjEls.message, "Tu turno: pedí carta, plantate o doblá.");
  }
}

function bjHit() {
  if (!bj.active) return;

  bj.player.push(bj.deck.pop());
  renderBlackjack();

  if (bjScore(bj.player) > 21) {
    bjFinish("playerBust");
  } else {
    setMessage(bjEls.message, "Podés pedir otra o plantarte.");
  }

  updateBlackjackButtons();
}

function bjStand() {
  if (!bj.active) return;

  bj.hidden = false;

  while (bjScore(bj.dealer) < 17) {
    bj.dealer.push(bj.deck.pop());
  }

  let dealerScore = bjScore(bj.dealer);
  let playerScore = bjScore(bj.player);

  if (dealerScore > 21) {
    bjFinish("dealerBust");
  } else if (playerScore > dealerScore) {
    bjFinish("playerWin");
  } else if (playerScore < dealerScore) {
    bjFinish("dealerWin");
  } else {
    bjFinish("push");
  }
}

function bjDouble() {
  if (!bj.active || balance < bj.bet) return;

  balance -= bj.bet;
  bj.bet *= 2;

  bj.player.push(bj.deck.pop());
  updateBalance();
  renderBlackjack();

  if (bjScore(bj.player) > 21) {
    bjFinish("playerBust");
  } else {
    bjStand();
  }
}

function bjFinish(result) {
  bj.active = false;
  bj.hidden = false;

  renderBlackjack();

  if (result === "blackjack") {
    let pay = Math.floor(bj.bet * 2.5);
    balance += pay;
    setMessage(bjEls.message, "¡Blackjack! Ganaste $" + (pay - bj.bet), "win");
  }

  if (result === "playerWin") {
    let pay = bj.bet * 2;
    balance += pay;
    setMessage(bjEls.message, "Ganaste. Cobrás $" + pay, "win");
  }

  if (result === "dealerBust") {
    let pay = bj.bet * 2;
    balance += pay;
    setMessage(bjEls.message, "El dealer se pasó. Ganaste $" + pay, "win");
  }

  if (result === "push") {
    balance += bj.bet;
    setMessage(bjEls.message, "Empate. Recuperás tu apuesta.", "push");
  }

  if (result === "playerBust") {
    setMessage(bjEls.message, "Te pasaste de 21. Perdiste.", "lose");
  }

  if (result === "dealerWin") {
    setMessage(bjEls.message, "Gana el dealer. Perdiste.", "lose");
  }

  bj.bet = 0;

  updateBalance();
  renderBlackjack();
  updateBlackjackButtons();
}

bjEls.chips.forEach(chip => {
  chip.addEventListener("click", () => bjPlaceChip(Number(chip.dataset.value)));
});

bjEls.clear.addEventListener("click", bjClearBet);
bjEls.deal.addEventListener("click", bjDeal);
bjEls.hit.addEventListener("click", bjHit);
bjEls.stand.addEventListener("click", bjStand);
bjEls.double.addEventListener("click", bjDouble);

/* POKER TEXAS HOLD'EM */
/* POKER TEXAS HOLD'EM */
const pk = {
  deck: [],
  dealer: [],
  player: [],
  community: [],
  revealedCommunity: 0,

  bet: 0,
  dealerBet: 0,
  pot: 0,

  pendingRaise: 0,
  waitingPlayerCall: 0,

  phase: "betting",
  revealDealer: false,
  selected: new Set()
};

const pkEls = {
  message: document.getElementById("pk-message"),
  bet: document.getElementById("pk-bet"),
  dealerBet: document.getElementById("pk-dealer-bet"),
  pot: document.getElementById("pk-pot"),
  stage: document.getElementById("pk-stage"),
  dealerCards: document.getElementById("pk-dealer-cards"),
  playerCards: document.getElementById("pk-player-cards"),
  communityCards: document.getElementById("pk-community-cards"),
  dealerName: document.getElementById("pk-dealer-name"),
  playerName: document.getElementById("pk-player-name"),
  chips: document.querySelectorAll(".pk-chip"),
  clear: document.getElementById("pk-clear"),
  deal: document.getElementById("pk-deal"),
  draw: document.getElementById("pk-draw"),
  stand: document.getElementById("pk-stand")
};

function pokerMoney(value) {
  let rounded = Number(value.toFixed(2));

  if (Number.isInteger(rounded)) {
    return "$" + rounded;
  }

  return "$" + rounded.toFixed(2);
}

function resetPokerVisual() {
  pk.deck = [];
  pk.dealer = [];
  pk.player = [];
  pk.community = [];
  pk.revealedCommunity = 0;
  pk.pot = 0;
  pk.dealerBet = 0;
  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;
  pk.revealDealer = false;
  pk.selected.clear();

  pkEls.dealerName.textContent = "Cartas ocultas";
  pkEls.playerName.textContent = "Tus cartas";
}

function pokerStageName() {
  if (pk.phase === "betting") return "Esperando apuesta";
  if (pk.waitingPlayerCall > 0) return "Dealer subió";
  if (pk.phase === "showdown") return "Final";
  if (pk.revealedCommunity === 3) return "Flop";
  if (pk.revealedCommunity === 4) return "Turn";
  if (pk.revealedCommunity === 5) return "River";
  return "En juego";
}

function renderPoker() {
  pkEls.dealerCards.innerHTML = "";
  pkEls.playerCards.innerHTML = "";
  pkEls.communityCards.innerHTML = "";

  pk.dealer.forEach(card => {
    pkEls.dealerCards.appendChild(createCard(card, !pk.revealDealer));
  });

  pk.player.forEach(card => {
    pkEls.playerCards.appendChild(createCard(card));
  });

  pk.community.forEach((card, index) => {
    let hidden = index >= pk.revealedCommunity;
    pkEls.communityCards.appendChild(createCard(card, hidden));
  });

  pkEls.bet.textContent = pokerMoney(pk.bet);
  pkEls.dealerBet.textContent = pokerMoney(pk.dealerBet);
  pkEls.pot.textContent = pokerMoney(pk.pot);
  pkEls.stage.textContent = pokerStageName();
}

function updatePokerButtons() {
  let betting = pk.phase === "betting";
  let action = pk.phase === "action";

  pkEls.chips.forEach(chip => {
    let value = Number(chip.dataset.value);
    chip.disabled = !(betting || action) || pk.waitingPlayerCall > 0 || balance < value;
  });

  pkEls.clear.disabled = betting ? pk.bet === 0 : pk.pendingRaise === 0 || pk.waitingPlayerCall > 0;
  pkEls.deal.disabled = !betting || pk.bet === 0;
  pkEls.draw.disabled = !action;
  pkEls.stand.disabled = !action;

  pkEls.clear.textContent = action ? "Deshacer subida" : "Limpiar";

  if (pk.waitingPlayerCall > 0) {
    pkEls.draw.textContent = "Pagar subida " + pokerMoney(pk.waitingPlayerCall);
  } else {
    pkEls.draw.textContent = pk.pendingRaise > 0 ? "Confirmar apuesta" : "Pasar / seguir";
  }

  pkEls.stand.textContent = "Retirarse";
}

function pkPlaceChip(value) {
  if (balance < value) return;

  if (pk.phase === "betting") {
    if (pk.bet === 0 && pk.player.length > 0) {
      resetPokerVisual();
    }

    balance -= value;
    pk.bet += value;

    updateBalance();
    renderPoker();
    updatePokerButtons();

    setMessage(pkEls.message, "Apostaste " + pokerMoney(pk.bet) + ". Ya podés repartir.");
    return;
  }

  if (pk.phase === "action") {
    if (pk.waitingPlayerCall > 0) {
      setMessage(pkEls.message, "Primero tenés que pagar la subida del dealer o retirarte.", "push");
      return;
    }

    balance -= value;
    pk.bet += value;
    pk.pendingRaise += value;
    pk.pot += value;

    updateBalance();
    renderPoker();
    updatePokerButtons();

    setMessage(
      pkEls.message,
      "Subiste " + pokerMoney(pk.pendingRaise) + ". Ahora confirmá la apuesta."
    );
  }
}

function pkClearBet() {
  if (pk.phase === "betting") {
    balance += pk.bet;
    pk.bet = 0;

    updateBalance();
    renderPoker();
    updatePokerButtons();

    setMessage(pkEls.message, "Apuesta limpiada.");
    return;
  }

  if (pk.phase === "action" && pk.pendingRaise > 0 && pk.waitingPlayerCall === 0) {
    balance += pk.pendingRaise;
    pk.bet -= pk.pendingRaise;
    pk.pot -= pk.pendingRaise;
    pk.pendingRaise = 0;

    updateBalance();
    renderPoker();
    updatePokerButtons();

    setMessage(pkEls.message, "Subida cancelada.");
  }
}

function pkDeal() {
  if (pk.bet <= 0 || pk.phase !== "betting") return;

  pk.deck = createDeck();
  pk.player = [];
  pk.dealer = [];
  pk.community = [];

  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;
  pk.revealDealer = false;
  pk.revealedCommunity = 3;
  pk.phase = "action";

  pkEls.playerName.textContent = "Tus cartas";
  pkEls.dealerName.textContent = "Cartas ocultas";

  pk.player.push(pk.deck.pop());
  pk.player.push(pk.deck.pop());

  pk.dealer.push(pk.deck.pop());
  pk.dealer.push(pk.deck.pop());

  for (let i = 0; i < 5; i++) {
    pk.community.push(pk.deck.pop());
  }

  pk.dealerBet = pk.bet;
  pk.pot = pk.bet + pk.dealerBet;

  renderPoker();
  updatePokerButtons();

  setMessage(
    pkEls.message,
    "El dealer igualó tu apuesta inicial con " + pokerMoney(pk.dealerBet) + ". Se mostró el flop."
  );
}

function pkProceed() {
  if (pk.phase !== "action") return;

  if (pk.waitingPlayerCall > 0) {
    if (balance < pk.waitingPlayerCall) {
      setMessage(pkEls.message, "No tenés saldo para pagar la subida. Podés retirarte.", "lose");
      return;
    }

    balance -= pk.waitingPlayerCall;
    pk.bet += pk.waitingPlayerCall;
    pk.pot += pk.waitingPlayerCall;

    let paid = pk.waitingPlayerCall;
    pk.waitingPlayerCall = 0;

    updateBalance();

    setMessage(pkEls.message, "Pagaste la subida de " + pokerMoney(paid) + ".", "push");

    advancePokerStreet();
    return;
  }

  let dealerAction = dealerPokerAction();

  if (dealerAction.type === "fold") {
    pkWinByDealerFold();
    return;
  }

  if (dealerAction.type === "call") {
    pk.dealerBet += pk.pendingRaise;
    pk.pot += pk.pendingRaise;

    if (pk.pendingRaise > 0) {
      setMessage(
        pkEls.message,
        "El dealer pagó tu subida de " + pokerMoney(pk.pendingRaise) + ".",
        "push"
      );
    } else {
      setMessage(pkEls.message, "El dealer pasó.");
    }

    pk.pendingRaise = 0;
    advancePokerStreet();
    return;
  }

  if (dealerAction.type === "raise") {
    let dealerCall = pk.pendingRaise;
    let dealerRaise = dealerAction.amount;

    pk.dealerBet += dealerCall + dealerRaise;
    pk.pot += dealerCall + dealerRaise;

    pk.pendingRaise = 0;
    pk.waitingPlayerCall = dealerRaise;

    renderPoker();
    updatePokerButtons();

    setMessage(
      pkEls.message,
      "El dealer pagó y además subió " + pokerMoney(dealerRaise) + ". Pagá o retirate.",
      "push"
    );
    return;
  }
}

function advancePokerStreet() {
  pk.pendingRaise = 0;

  if (pk.revealedCommunity < 5) {
    pk.revealedCommunity++;

    renderPoker();
    updatePokerButtons();

    if (pk.revealedCommunity === 4) {
      setMessage(pkEls.message, "Se mostró el turn. Podés apostar más o pasar.");
    } else {
      setMessage(pkEls.message, "Se mostró el river. Última decisión antes de mostrar cartas.");
    }

    return;
  }

  finishPokerRound();
}

function pkFold() {
  if (pk.phase !== "action") return;

  pk.phase = "betting";
  pk.revealDealer = true;

  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;
  pk.bet = 0;
  pk.dealerBet = 0;
  pk.pot = 0;

  renderPoker();
  updatePokerButtons();

  setMessage(pkEls.message, "Te retiraste. Gana el dealer.", "lose");
}

function dealerPokerAction() {
  let visibleCards = [...pk.dealer, ...pk.community.slice(0, pk.revealedCommunity)];
  let dealerHand = evaluateBestHand(visibleCards);
  let handPower = dealerHand.rank;
  let random = Math.random();

  let possibleRaise = dealerRaiseAmount();

  if (pk.pendingRaise > 0) {
    if (handPower <= 1 && pk.pendingRaise >= 100 && random < 0.65) {
      return { type: "fold" };
    }

    if (handPower <= 2 && pk.pendingRaise >= 200 && random < 0.45) {
      return { type: "fold" };
    }

    if (handPower >= 4 && possibleRaise > 0 && random < 0.25) {
      return {
        type: "raise",
        amount: possibleRaise
      };
    }

    return { type: "call" };
  }

  if (possibleRaise > 0) {
    if (handPower >= 4 && random < 0.55) {
      return {
        type: "raise",
        amount: possibleRaise
      };
    }

    if (handPower >= 2 && random < 0.22) {
      return {
        type: "raise",
        amount: possibleRaise
      };
    }
  }

  return { type: "call" };
}

function dealerRaiseAmount() {
  let options = [25, 50, 100, 500].filter(value => value <= balance);

  if (options.length === 0) return 0;

  if (pk.revealedCommunity === 3) {
    return options.includes(50) ? 50 : options[0];
  }

  if (pk.revealedCommunity === 4) {
    return options.includes(100) ? 100 : options[options.length - 1];
  }

  return options[options.length - 1];
}

function pkWinByDealerFold() {
  pk.phase = "betting";
  pk.revealDealer = true;

  pkEls.dealerName.textContent = "Se retiró";
  pkEls.playerName.textContent = "Ganaste por fold";

  let winAmount = pk.pot;

  balance += pk.pot;

  pk.bet = 0;
  pk.dealerBet = 0;
  pk.pot = 0;
  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;

  updateBalance();
  renderPoker();
  updatePokerButtons();

  setMessage(pkEls.message, "El dealer se retiró. Ganaste " + pokerMoney(winAmount) + ".", "win");
}

function finishPokerRound() {
  pk.phase = "showdown";
  pk.revealDealer = true;
  pk.pendingRaise = 0;
  pk.waitingPlayerCall = 0;

  let playerBest = evaluateBestHand([...pk.player, ...pk.community]);
  let dealerBest = evaluateBestHand([...pk.dealer, ...pk.community]);
  let result = compareHands(playerBest, dealerBest);

  pkEls.playerName.textContent = playerBest.name;
  pkEls.dealerName.textContent = dealerBest.name;

  renderPoker();

  if (result > 0) {
    balance += pk.pot;
    setMessage(pkEls.message, "Ganaste con " + playerBest.name + ". Cobrás " + pokerMoney(pk.pot) + ".", "win");
  } else if (result < 0) {
    setMessage(pkEls.message, "Gana el dealer con " + dealerBest.name + ". Perdiste.", "lose");
  } else {
    let returned = Math.floor(pk.pot / 2);
    balance += returned;
    setMessage(pkEls.message, "Empate. Recuperás " + pokerMoney(returned) + ".", "push");
  }

  pk.bet = 0;
  pk.dealerBet = 0;
  pk.pot = 0;
  pk.phase = "betting";

  updateBalance();
  renderPoker();
  updatePokerButtons();
}

function evaluateBestHand(cards) {
  let best = null;

  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            let combo = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            let hand = evaluateHand(combo);

            if (!best || compareHands(hand, best) > 0) {
              best = hand;
            }
          }
        }
      }
    }
  }

  return best;
}

function evaluateHand(hand) {
  let values = hand.map(card => rankValue(card.rank)).sort((a, b) => b - a);
  let suitsInHand = hand.map(card => card.suit);
  let counts = {};

  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });

  let groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  let flush = suitsInHand.every(suit => suit === suitsInHand[0]);
  let straightHigh = getStraightHigh(values);

  if (flush && straightHigh === 14 && values.includes(10)) {
    return { rank: 10, name: "Royal Flush", points: [14] };
  }

  if (flush && straightHigh) {
    return { rank: 9, name: "Straight Flush", points: [straightHigh] };
  }

  if (groups[0].count === 4) {
    let kicker = groups.find(group => group.count === 1).value;
    return { rank: 8, name: "Poker", points: [groups[0].value, kicker] };
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return { rank: 7, name: "Full House", points: [groups[0].value, groups[1].value] };
  }

  if (flush) {
    return { rank: 6, name: "Color", points: values };
  }

  if (straightHigh) {
    return { rank: 5, name: "Escalera", points: [straightHigh] };
  }

  if (groups[0].count === 3) {
    let kickers = groups
      .filter(group => group.count === 1)
      .map(group => group.value)
      .sort((a, b) => b - a);

    return { rank: 4, name: "Trío", points: [groups[0].value, ...kickers] };
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    let pairs = groups
      .filter(group => group.count === 2)
      .map(group => group.value)
      .sort((a, b) => b - a);

    let kicker = groups.find(group => group.count === 1).value;

    return { rank: 3, name: "Doble pareja", points: [...pairs, kicker] };
  }

  if (groups[0].count === 2) {
    let kickers = groups
      .filter(group => group.count === 1)
      .map(group => group.value)
      .sort((a, b) => b - a);

    return { rank: 2, name: "Pareja", points: [groups[0].value, ...kickers] };
  }

  return { rank: 1, name: "Carta alta", points: values };
}

function getStraightHigh(values) {
  let unique = [...new Set(values)].sort((a, b) => a - b);

  if (unique.length !== 5) return null;

  let normalStraight = true;

  for (let i = 1; i < unique.length; i++) {
    if (unique[i] !== unique[i - 1] + 1) {
      normalStraight = false;
      break;
    }
  }

  if (normalStraight) return unique[4];

  let lowAceStraight = [2, 3, 4, 5, 14];
  let isLowAceStraight = unique.every((value, index) => value === lowAceStraight[index]);

  if (isLowAceStraight) return 5;

  return null;
}

function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;

  let maxLength = Math.max(a.points.length, b.points.length);

  for (let i = 0; i < maxLength; i++) {
    let valueA = a.points[i] || 0;
    let valueB = b.points[i] || 0;

    if (valueA !== valueB) return valueA > valueB ? 1 : -1;
  }

  return 0;
}

pkEls.chips.forEach(chip => {
  chip.addEventListener("click", () => pkPlaceChip(Number(chip.dataset.value)));
});

pkEls.clear.addEventListener("click", pkClearBet);
pkEls.deal.addEventListener("click", pkDeal);
pkEls.draw.addEventListener("click", pkProceed);
pkEls.stand.addEventListener("click", pkFold);
/* RULETA */
const rouletteOrder = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
  6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26
];

const rouletteBoardOrder = [
  0,
  3, 2, 1,
  6, 5, 4,
  9, 8, 7,
  12, 11, 10,
  15, 14, 13,
  18, 17, 16,
  21, 20, 19,
  24, 23, 22,
  27, 26, 25,
  30, 29, 28,
  33, 32, 31,
  36, 35, 34
];

const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

const rt = {
  bets: {},
  selectedTargets: {},
  spinning: false,
  rotation: 0
};

const rtEls = {
  message: document.getElementById("rt-message"),
  bet: document.getElementById("rt-bet"),
  target: document.getElementById("rt-target"),
  betsList: document.getElementById("rt-bets-list"),
  result: document.getElementById("roulette-result"),
  rotor: document.getElementById("roulette-rotor"),
  labels: document.getElementById("roulette-labels"),
  board: document.getElementById("number-board"),
  chips: document.querySelectorAll(".rt-chip"),
  clear: document.getElementById("rt-clear"),
  spin: document.getElementById("rt-spin"),
  quickBets: document.querySelectorAll(".quick-bet")
};

function rouletteMoney(value) {
  let rounded = Number(value.toFixed(2));

  if (Number.isInteger(rounded)) {
    return "$" + rounded;
  }

  return "$" + rounded.toFixed(2);
}

function rouletteColor(number) {
  if (number === 0) return "green";
  return redNumbers.has(number) ? "red" : "black";
}

function rouletteBetKey(target) {
  return target.type + "-" + target.value;
}

function rouletteTargetName(target) {
  if (!target) return "Ninguna";

  if (target.type === "number") return "Número " + target.value;

  if (target.type === "dozen") {
    if (target.value === 1) return "1 - 12";
    if (target.value === 2) return "13 - 24";
    if (target.value === 3) return "25 - 36";
  }

  let names = {
    red: "Rojo",
    black: "Negro",
    even: "Par",
    odd: "Impar"
  };

  return names[target.value];
}

function rouletteMultiplier(target) {
  if (target.type === "number") return 36;
  if (target.type === "dozen") return 3;
  return 2;
}

function rouletteTotalBet() {
  return Object.values(rt.bets).reduce((total, bet) => {
    return total + bet.amount;
  }, 0);
}

function selectedTargetsArray() {
  return Object.values(rt.selectedTargets);
}

function updateRouletteInfo() {
  let total = rouletteTotalBet();
  let selected = selectedTargetsArray();

  rtEls.bet.textContent = rouletteMoney(total);

  if (selected.length === 0) {
    rtEls.target.textContent = "Ninguna";
  } else {
    rtEls.target.textContent = selected.map(rouletteTargetName).join(", ");
  }

  if (!rtEls.betsList) return;

  let bets = Object.values(rt.bets);

  if (bets.length === 0) {
    rtEls.betsList.textContent = "Sin apuestas";
    return;
  }

  rtEls.betsList.innerHTML = "";

  bets.forEach(bet => {
    let item = document.createElement("div");
    item.className = "rt-bet-item";

    item.innerHTML = `
      <span>${rouletteTargetName(bet.target)}</span>
      <strong>${rouletteMoney(bet.amount)}</strong>
    `;

    rtEls.betsList.appendChild(item);
  });
}

function updateRouletteButtons() {
  let selectedCount = selectedTargetsArray().length;

  rtEls.chips.forEach(chip => {
    let value = Number(chip.dataset.value);
    let totalCost = value * selectedCount;

    chip.disabled = rt.spinning || selectedCount === 0 || balance < totalCost;
  });

  rtEls.clear.disabled = rt.spinning || rouletteTotalBet() === 0;
  rtEls.spin.disabled = rt.spinning || rouletteTotalBet() === 0;

  markRouletteButtons();
}

function toggleRouletteTarget(type, value, element) {
  if (rt.spinning) return;

  let target = {
    type,
    value: type === "number" || type === "dozen" ? Number(value) : value
  };

  let key = rouletteBetKey(target);

  if (rt.selectedTargets[key]) {
    delete rt.selectedTargets[key];
    element.classList.remove("selected");
  } else {
    rt.selectedTargets[key] = target;
    element.classList.add("selected");
  }

  updateRouletteInfo();
  updateRouletteButtons();

  let selectedCount = selectedTargetsArray().length;

  if (selectedCount === 0) {
    setMessage(rtEls.message, "No hay selecciones. Marcá números u opciones para apostar.");
  } else {
    setMessage(
      rtEls.message,
      "Tenés " + selectedCount + " selección/es. Tocá una ficha para apostar en todas."
    );
  }
}

function rtPlaceChip(value) {
  if (rt.spinning) return;

  let selected = selectedTargetsArray();

  if (selected.length === 0) {
    setMessage(rtEls.message, "Primero seleccioná uno o más números u opciones.", "push");
    return;
  }

  let totalCost = value * selected.length;

  if (balance < totalCost) {
    setMessage(rtEls.message, "No tenés saldo suficiente para apostar esa ficha en todas las selecciones.", "lose");
    return;
  }

  balance -= totalCost;

  selected.forEach(target => {
    let key = rouletteBetKey(target);

    if (!rt.bets[key]) {
      rt.bets[key] = {
        target: { ...target },
        amount: 0
      };
    }

    rt.bets[key].amount += value;
  });

  updateBalance();
  updateRouletteInfo();
  updateRouletteButtons();

  setMessage(
    rtEls.message,
    "Apostaste " + rouletteMoney(value) + " en cada selección. Total: " + rouletteMoney(totalCost) + "."
  );
}

function rtClearBet() {
  if (rt.spinning) return;

  let total = rouletteTotalBet();

  balance += total;
  rt.bets = {};
  rt.selectedTargets = {};

  document.querySelectorAll(".quick-bet, .num-btn").forEach(button => {
    button.classList.remove("selected", "has-bet");
  });

  updateBalance();
  updateRouletteInfo();
  updateRouletteButtons();

  setMessage(rtEls.message, "Apuestas limpiadas.");
}

function isRouletteWin(target, number) {
  if (target.type === "number") {
    return number === target.value;
  }

  if (target.type === "dozen") {
    if (target.value === 1) return number >= 1 && number <= 12;
    if (target.value === 2) return number >= 13 && number <= 24;
    if (target.value === 3) return number >= 25 && number <= 36;
  }

  if (target.value === "red") return rouletteColor(number) === "red";
  if (target.value === "black") return rouletteColor(number) === "black";
  if (target.value === "even") return number !== 0 && number % 2 === 0;
  if (target.value === "odd") return number % 2 === 1;

  return false;
}

function rtSpin() {
  if (rt.spinning || rouletteTotalBet() <= 0) return;

  rt.spinning = true;
  updateRouletteButtons();

  let winnerIndex = Math.floor(Math.random() * rouletteOrder.length);
  let winnerNumber = rouletteOrder[winnerIndex];

  let segment = 360 / rouletteOrder.length;
  let targetRotation = 360 - winnerIndex * segment;

  let currentRotation = ((rt.rotation % 360) + 360) % 360;
  let extraRotation = targetRotation - currentRotation;

  if (extraRotation < 0) {
    extraRotation += 360;
  }

  rt.rotation += 360 * 7 + extraRotation;

  rtEls.rotor.style.transform = "rotate(" + rt.rotation + "deg)";
  rtEls.result.textContent = "?";

  setMessage(rtEls.message, "La ruleta está girando...");

  setTimeout(() => {
    rtEls.result.textContent = winnerNumber;

    let totalBet = rouletteTotalBet();
    let totalPayout = 0;
    let wonBets = [];

    Object.values(rt.bets).forEach(bet => {
      if (isRouletteWin(bet.target, winnerNumber)) {
        let multiplier = rouletteMultiplier(bet.target);
        let payout = bet.amount * multiplier;

        totalPayout += payout;

        wonBets.push(
          rouletteTargetName(bet.target) + " +" + rouletteMoney(payout - bet.amount)
        );
      }
    });

    if (totalPayout > 0) {
      balance += totalPayout;

      let net = totalPayout - totalBet;

      setMessage(
        rtEls.message,
        "Salió " + winnerNumber + ". Ganaste: " + wonBets.join(", ") + ". Neto: " + rouletteMoney(net) + ".",
        "win"
      );
    } else {
      setMessage(
        rtEls.message,
        "Salió " + winnerNumber + ". Perdiste " + rouletteMoney(totalBet) + ".",
        "lose"
      );
    }

    rt.bets = {};
    rt.selectedTargets = {};
    rt.spinning = false;

    document.querySelectorAll(".quick-bet, .num-btn").forEach(button => {
      button.classList.remove("selected", "has-bet");
    });

    updateBalance();
    updateRouletteInfo();
    updateRouletteButtons();
  }, 4900);
}

function buildRouletteWheel() {
  let segment = 360 / rouletteOrder.length;
  let gradientParts = [];

  rouletteOrder.forEach((number, index) => {
    let color = rouletteColor(number);
    let realColor = color === "red" ? "#dc2626" : color === "black" ? "#111827" : "#16a34a";

    let start = index * segment - segment / 2;
    let end = start + segment;

    gradientParts.push(realColor + " " + start + "deg " + end + "deg");
  });

  rtEls.rotor.style.background = "conic-gradient(" + gradientParts.join(", ") + ")";
  buildRouletteLabels();
}

function buildRouletteLabels() {
  if (!rtEls.labels) return;

  rtEls.labels.innerHTML = "";

  let wheel = document.querySelector(".roulette-wheel");
  if (!wheel || wheel.offsetWidth === 0) return;

  let segment = 360 / rouletteOrder.length;
  let radius = wheel.offsetWidth / 2 - 45;

  rouletteOrder.forEach((number, index) => {
    let label = document.createElement("div");
    let color = rouletteColor(number);
    let angle = index * segment;

    label.className = "wheel-number " + color;
    label.textContent = number;

    label.style.transform =
      "rotate(" + angle + "deg) translateY(-" + radius + "px) rotate(-" + angle + "deg)";

    rtEls.labels.appendChild(label);
  });
}

function buildNumberBoard() {
  rtEls.board.innerHTML = "";

  rouletteBoardOrder.forEach(number => {
    let btn = document.createElement("button");
    let color = rouletteColor(number);

    btn.className = "num-btn " + color;
    btn.textContent = number;
    btn.dataset.type = "number";
    btn.dataset.value = number;

    if (number === 0) {
      btn.classList.add("zero");
    }

    btn.addEventListener("click", () => {
      toggleRouletteTarget("number", number, btn);
    });

    rtEls.board.appendChild(btn);
  });
}

function markRouletteButtons() {
  document.querySelectorAll(".quick-bet, .num-btn").forEach(button => {
    button.classList.remove("has-bet");

    let type = button.dataset.type;
    let value = button.dataset.value;

    if (!type || value === undefined) return;

    let target = {
      type,
      value: type === "number" || type === "dozen" ? Number(value) : value
    };

    let key = rouletteBetKey(target);

    if (rt.bets[key]) {
      button.classList.add("has-bet");
    }
  });
}

rtEls.quickBets.forEach(button => {
  button.addEventListener("click", () => {
    toggleRouletteTarget(button.dataset.type, button.dataset.value, button);
  });
});

rtEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    rtPlaceChip(Number(chip.dataset.value));
  });
});

rtEls.clear.addEventListener("click", rtClearBet);
rtEls.spin.addEventListener("click", rtSpin);

window.addEventListener("resize", () => {
  buildRouletteLabels();
});
/* COIN MINER / GOLD MINER */
const cm = {
  bet: 0,
  baseBet: 0,
  profit: 0,
  active: false,
  board: [],
  safeFlipped: 0,
  bombs: 3
};

const cmEls = {
  message: document.getElementById("cm-message"),
  bet: document.getElementById("cm-bet"),
  profit: document.getElementById("cm-profit"),
  total: document.getElementById("cm-total"),
  next: document.getElementById("cm-next"),
  safe: document.getElementById("cm-safe"),
  board: document.getElementById("cm-board"),
  chips: document.querySelectorAll(".cm-chip"),
  bombsInput: document.getElementById("cm-bombs-input"),
  bombsApply: document.getElementById("cm-bombs-apply"),
  clear: document.getElementById("cm-clear"),
  start: document.getElementById("cm-start"),
  cashout: document.getElementById("cm-cashout")
};

function formatMoney(value) {
  let rounded = Number(value.toFixed(2));

  if (Number.isInteger(rounded)) {
    return "$" + rounded;
  }

  return "$" + rounded.toFixed(2);
}

function getCoinPercent() {
  let basePercent = cm.bombs + 2;
  let growthPercent = cm.safeFlipped * 1.25;

  return Number((basePercent + growthPercent).toFixed(2));
}

function createCoinMinerBoard() {
  let cards = [];

  for (let i = 0; i < cm.bombs; i++) {
    cards.push({
      type: "bomb",
      revealed: false
    });
  }

  for (let i = cm.bombs; i < 25; i++) {
    cards.push({
      type: "coin",
      revealed: false
    });
  }

  return shuffle(cards);
}

function createEmptyMinerBoard() {
  let empty = [];

  for (let i = 0; i < 25; i++) {
    empty.push({
      type: "coin",
      revealed: false
    });
  }

  return empty;
}

function renderCoinMiner() {
  cmEls.board.innerHTML = "";

  cm.board.forEach((tile, index) => {
    let button = document.createElement("button");

    button.className = "miner-tile";

    if (tile.revealed) {
      button.classList.add("revealed", tile.type);
    } else {
      button.classList.add("hidden");
    }

    button.disabled = !cm.active || tile.revealed;

    button.addEventListener("click", () => {
      flipCoinMinerTile(index);
    });

    cmEls.board.appendChild(button);
  });

  let nextPercent = getCoinPercent();
  let safeTotal = 25 - cm.bombs;

  cmEls.bet.textContent = formatMoney(cm.bet);
  cmEls.profit.textContent = formatMoney(cm.profit);
  cmEls.total.textContent = formatMoney(cm.bet + cm.profit);
  cmEls.next.textContent = "+" + nextPercent + "%";
  cmEls.safe.textContent = cm.safeFlipped + "/" + safeTotal;
}

function updateCoinMinerButtons() {
  cmEls.chips.forEach(chip => {
    let value = Number(chip.dataset.value);
    chip.disabled = cm.active || balance < value;
  });

  cmEls.bombsInput.disabled = cm.active;
  cmEls.bombsApply.disabled = cm.active;

  cmEls.clear.disabled = cm.active || cm.bet === 0;
  cmEls.start.disabled = cm.active || cm.bet === 0;
  cmEls.cashout.disabled = !cm.active || cm.safeFlipped === 0;
}

function applyBombAmount() {
  if (cm.active) return;

  let amount = Number(cmEls.bombsInput.value);

  if (!Number.isInteger(amount)) {
    amount = Math.floor(amount);
  }

  if (amount < 1) amount = 1;
  if (amount > 24) amount = 24;

  cm.bombs = amount;
  cmEls.bombsInput.value = amount;

  cm.safeFlipped = 0;
  cm.profit = 0;
  cm.board = createEmptyMinerBoard();

  renderCoinMiner();
  updateCoinMinerButtons();

  setMessage(
    cmEls.message,
    "Elegiste " + cm.bombs + " bombas. La próxima moneda paga +" + getCoinPercent() + "%."
  );
}

function cmPlaceChip(value) {
  if (cm.active || balance < value) return;

  balance -= value;
  cm.bet += value;
  cm.baseBet = cm.bet;

  updateBalance();
  renderCoinMiner();
  updateCoinMinerButtons();

  setMessage(cmEls.message, "Apostaste " + formatMoney(cm.bet) + ". Ya podés iniciar.");
}

function cmClearBet() {
  if (cm.active) return;

  balance += cm.bet;

  cm.bet = 0;
  cm.baseBet = 0;
  cm.profit = 0;
  cm.safeFlipped = 0;
  cm.board = createEmptyMinerBoard();

  updateBalance();
  renderCoinMiner();
  updateCoinMinerButtons();

  setMessage(cmEls.message, "Apuesta limpiada.");
}

function cmStartGame() {
  if (cm.active || cm.bet <= 0) return;

  applyBombAmount();

  cm.active = true;
  cm.baseBet = cm.bet;
  cm.profit = 0;
  cm.safeFlipped = 0;
  cm.board = createCoinMinerBoard();

  renderCoinMiner();
  updateCoinMinerButtons();

  setMessage(
    cmEls.message,
    "Partida iniciada con " + cm.bombs + " bombas. Primera moneda paga +" + getCoinPercent() + "%."
  );
}

function flipCoinMinerTile(index) {
  if (!cm.active) return;

  let tile = cm.board[index];

  if (tile.revealed) return;

  tile.revealed = true;

  if (tile.type === "bomb") {
    cmLose();
    return;
  }

  let percent = getCoinPercent();
  let gain = cm.baseBet * (percent / 100);

  cm.profit = Number((cm.profit + gain).toFixed(2));
  cm.safeFlipped++;

  renderCoinMiner();
  updateCoinMinerButtons();

  if (cm.safeFlipped === 25 - cm.bombs) {
    cmCashout(true);
    return;
  }

  setMessage(
    cmEls.message,
    "🪙 Moneda. Sumaste " + formatMoney(gain) + " (" + percent + "%). La próxima paga +" + getCoinPercent() + "%.",
    "win"
  );
}

function cmLose() {
  let lost = cm.bet;

  cm.active = false;
  cm.bet = 0;
  cm.baseBet = 0;
  cm.profit = 0;

  cm.board.forEach(tile => {
    tile.revealed = true;
  });

  renderCoinMiner();
  updateCoinMinerButtons();

  setMessage(cmEls.message, "💣 Tocaste bomba. Perdiste " + formatMoney(lost) + ".", "lose");
}

function cmCashout(perfect = false) {
  if (!cm.active) return;

  let payout = Number((cm.bet + cm.profit).toFixed(2));

  balance = Number((balance + payout).toFixed(2));

  cm.active = false;
  cm.bet = 0;
  cm.baseBet = 0;
  cm.profit = 0;

  cm.board.forEach(tile => {
    tile.revealed = true;
  });

  updateBalance();
  renderCoinMiner();
  updateCoinMinerButtons();

  if (perfect) {
    setMessage(cmEls.message, "Limpiaste todo el tablero. Cobraste " + formatMoney(payout) + ".", "win");
  } else {
    setMessage(cmEls.message, "Cobraste " + formatMoney(payout) + ". Bien jugado.", "win");
  }
}

cmEls.bombsApply.addEventListener("click", applyBombAmount);

cmEls.bombsInput.addEventListener("change", applyBombAmount);

cmEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    cmPlaceChip(Number(chip.dataset.value));
  });
});

cmEls.clear.addEventListener("click", cmClearBet);
cmEls.start.addEventListener("click", cmStartGame);
cmEls.cashout.addEventListener("click", () => cmCashout(false));

cm.board = createEmptyMinerBoard();
renderCoinMiner();
updateCoinMinerButtons();
/* CHICKEN ROAD */
const cr = {
  bet: 0,
  active: false,
  step: 0,
  crashedLane: null
};

const crMultipliers = [1.20, 1.45, 1.75, 2.10, 2.65, 3.30, 4.20, 5.40, 7.00, 10.00];

const crLoseChances = [0.18, 0.23, 0.28, 0.34, 0.40, 0.47, 0.54, 0.61, 0.68, 0.75];
const crEls = {
  message: document.getElementById("cr-message"),
  bet: document.getElementById("cr-bet"),
  multiplier: document.getElementById("cr-multiplier"),
  cash: document.getElementById("cr-cash"),
  step: document.getElementById("cr-step"),
  road: document.getElementById("cr-road"),
  chips: document.querySelectorAll(".cr-chip"),
  clear: document.getElementById("cr-clear"),
  start: document.getElementById("cr-start"),
  go: document.getElementById("cr-go"),
  cashout: document.getElementById("cr-cashout")
};

function crMoney(value) {
  return "$" + Math.round(value);
}

function crCurrentMultiplier() {
  if (cr.step <= 0) return 1;
  return crMultipliers[cr.step - 1];
}

function crCashValue() {
  if (cr.step <= 0) return 0;
  return Math.round(cr.bet * crCurrentMultiplier());
}

function renderChickenRoad() {
  crEls.road.innerHTML = "";

  crMultipliers.forEach((multi, index) => {
    let lane = document.createElement("div");
    lane.className = "road-lane";

    let icon = "🚗";

    if (cr.crashedLane === index) {
      lane.classList.add("crash");
      icon = "💥";
    } else if (index < cr.step) {
      lane.classList.add("safe");
      icon = "✅";
    } else if (cr.active && index === cr.step) {
      lane.classList.add("current");
      icon = "🐔";
    } else {
      lane.classList.add("car");
      icon = "🚗";
    }

    lane.innerHTML = `
      <div class="lane-multiplier">x${multi.toFixed(2)}</div>
      <div class="lane-road-lines"></div>
      <div class="lane-icon">${icon}</div>
    `;

    crEls.road.appendChild(lane);
  });

  crEls.bet.textContent = crMoney(cr.bet);
  crEls.multiplier.textContent = "x" + crCurrentMultiplier().toFixed(2);
  crEls.cash.textContent = crMoney(crCashValue());
  crEls.step.textContent = cr.step + "/" + crMultipliers.length;
}

function updateChickenButtons() {
  crEls.chips.forEach(chip => {
    let value = Number(chip.dataset.value);
    chip.disabled = cr.active || balance < value;
  });

  crEls.clear.disabled = cr.active || cr.bet === 0;
  crEls.start.disabled = cr.active || cr.bet === 0;
  crEls.go.disabled = !cr.active;
  crEls.cashout.disabled = !cr.active || cr.step === 0;
}

function crPlaceChip(value) {
  if (cr.active || balance < value) return;

  balance -= value;
  cr.bet += value;

  updateBalance();
  renderChickenRoad();
  updateChickenButtons();

  setMessage(crEls.message, "Apostaste " + crMoney(cr.bet) + ". Tocá Iniciar para jugar.");
}

function crClearBet() {
  if (cr.active) return;

  balance += cr.bet;

  cr.bet = 0;
  cr.step = 0;
  cr.crashedLane = null;

  updateBalance();
  renderChickenRoad();
  updateChickenButtons();

  setMessage(crEls.message, "Apuesta limpiada.");
}

function crStartGame() {
  if (cr.active || cr.bet <= 0) return;

  cr.active = true;
  cr.step = 0;
  cr.crashedLane = null;

  renderChickenRoad();
  updateChickenButtons();

  setMessage(crEls.message, "El pollito está listo. Tocá Avanzar para cruzar.");
}

function crGoForward() {
  if (!cr.active) return;

  let crashChance = crLoseChances[cr.step] || 0.75;
  let crashed = Math.random() < crashChance;

  if (crashed) {
    crCrash();
    return;
  }

  cr.step++;

  renderChickenRoad();
  updateChickenButtons();

  if (cr.step >= crMultipliers.length) {
    crCashout(true);
    return;
  }

  setMessage(
    crEls.message,
    "Cruzaste bien. Multiplicador actual: x" + crCurrentMultiplier().toFixed(2) + ". Podés seguir o cobrar.",
    "win"
  );
}
function crCrash() {
  let lost = cr.bet;

  cr.crashedLane = cr.step;
  cr.active = false;
  cr.bet = 0;

  renderChickenRoad();
  updateChickenButtons();

  setMessage(crEls.message, "💥 Pasó un auto. Perdiste " + crMoney(lost) + ".", "lose");
}

function crCashout(perfect = false) {
  if (!cr.active) return;

  let payout = crCashValue();

  balance += payout;

  cr.active = false;
  cr.bet = 0;
  cr.crashedLane = null;

  updateBalance();
  renderChickenRoad();
  updateChickenButtons();

  if (perfect) {
    setMessage(crEls.message, "¡Cruzaste todo! Cobraste " + crMoney(payout) + ".", "win");
  } else {
    setMessage(crEls.message, "Cobraste " + crMoney(payout) + ". Te salvaste a tiempo.", "win");
  }
}

crEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    crPlaceChip(Number(chip.dataset.value));
  });
});

crEls.clear.addEventListener("click", crClearBet);
crEls.start.addEventListener("click", crStartGame);
crEls.go.addEventListener("click", crGoForward);
crEls.cashout.addEventListener("click", () => crCashout(false));

/* PLINKO */
const pl = {
  bet: 0,
  rows: 10,
  risk: "medium",
  dropping: false,
  lastMultiplier: 0,
  lastWin: 0
};

const plEls = {
  message: document.getElementById("pl-message"),
  bet: document.getElementById("pl-bet"),
  risk: document.getElementById("pl-risk"),
  rows: document.getElementById("pl-rows"),
  riskLabel: document.getElementById("pl-risk-label"),
  rowsLabel: document.getElementById("pl-rows-label"),
  lastMultiplier: document.getElementById("pl-last-multiplier"),
  lastWin: document.getElementById("pl-last-win"),
  stage: document.getElementById("plinko-stage"),
  chips: document.querySelectorAll(".pl-chip"),
  clear: document.getElementById("pl-clear"),
  drop: document.getElementById("pl-drop")
};

const plinkoTables = {
  8: {
    low:    [5.6, 2.1, 1.1, 0.7, 0.5, 0.7, 1.1, 2.1, 5.6],
    medium: [9,   3,   1.6, 0.9, 0.5, 0.9, 1.6, 3,   9],
    high:   [18,  5,   2,   0.4, 0.2, 0.4, 2,   5,   18]
  },
  10: {
    low:    [8, 3, 1.5, 1.1, 0.8, 0.5, 0.8, 1.1, 1.5, 3, 8],
    medium: [12, 5, 2, 1.4, 0.9, 0.5, 0.9, 1.4, 2, 5, 12],
    high:   [24, 8, 3, 1.3, 0.6, 0.2, 0.6, 1.3, 3, 8, 24]
  },
  12: {
    low:    [10, 4, 2, 1.5, 1.1, 0.8, 0.5, 0.8, 1.1, 1.5, 2, 4, 10],
    medium: [16, 6, 3, 1.8, 1.2, 0.7, 0.4, 0.7, 1.2, 1.8, 3, 6, 16],
    high:   [33, 11, 5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5, 11, 33]
  }
};

function plMoney(value) {
  let rounded = Number(value.toFixed(2));

  if (Number.isInteger(rounded)) return "$" + rounded;
  return "$" + rounded.toFixed(2);
}

function getPlinkoMultipliers() {
  return plinkoTables[pl.rows][pl.risk];
}

function getRiskLabel(value) {
  if (value === "low") return "Riesgo bajo";
  if (value === "high") return "Riesgo alto";
  return "Riesgo medio";
}

function updatePlinkoInfo() {
  plEls.bet.textContent = plMoney(pl.bet);
  plEls.riskLabel.textContent = getRiskLabel(pl.risk);
  plEls.rowsLabel.textContent = String(pl.rows);
  plEls.lastMultiplier.textContent = "x" + pl.lastMultiplier.toFixed(2);
  plEls.lastWin.textContent = plMoney(pl.lastWin);
}

function updatePlinkoButtons() {
  plEls.chips.forEach(chip => {
    let value = Number(chip.dataset.value);
    chip.disabled = pl.dropping || balance < value;
  });

  plEls.clear.disabled = pl.dropping || pl.bet === 0;
  plEls.drop.disabled = pl.dropping || pl.bet === 0;
  plEls.risk.disabled = pl.dropping;
  plEls.rows.disabled = pl.dropping;
}

function getSlotClass(multiplier) {
  if (multiplier >= 3) return "high";
  if (multiplier >= 1) return "mid";
  return "low";
}

function renderPlinkoBoard() {
  if (!plEls.stage) return;

  plEls.stage.innerHTML = "";

  const stage = plEls.stage;
  const width = stage.clientWidth || 760;
  const height = stage.clientHeight || 660;

  const rows = pl.rows;
  const multipliers = getPlinkoMultipliers();

  const topPadding = 40;
  const bottomPadding = 80;
  const usableHeight = height - topPadding - bottomPadding;
  const rowGap = usableHeight / rows;
  const centerX = width / 2;

  for (let row = 0; row < rows; row++) {
    const pegsInRow = row + 1;
    const spread = Math.min(width * 0.72, 80 + row * 46);
    const startX = centerX - spread / 2;

    for (let i = 0; i < pegsInRow; i++) {
      const peg = document.createElement("div");
      peg.className = "plinko-peg";
      peg.style.left = (pegsInRow === 1 ? centerX : startX + (spread / (pegsInRow - 1)) * i) + "px";
      peg.style.top = (topPadding + rowGap * row + 25) + "px";
      stage.appendChild(peg);
    }
  }

  const slotsCount = multipliers.length;
  const slotY = height - 52;
  const slotWidth = width / slotsCount;

  for (let i = 0; i < slotsCount; i++) {
    const slot = document.createElement("div");
    slot.className = "plinko-slot " + getSlotClass(multipliers[i]);
    slot.style.left = (i * slotWidth + 2) + "px";
    slot.style.width = (slotWidth - 4) + "px";
    slot.textContent = "x" + multipliers[i];
    stage.appendChild(slot);
  }

  for (let i = 1; i < slotsCount; i++) {
    const line = document.createElement("div");
    line.className = "plinko-guide-line";
    line.style.left = i * slotWidth + "px";
    stage.appendChild(line);
  }

  updatePlinkoInfo();
}

function plPlaceChip(value) {
  if (pl.dropping || balance < value) return;

  balance -= value;
  pl.bet += value;

  updateBalance();
  updatePlinkoInfo();
  updatePlinkoButtons();

  setMessage(plEls.message, "Apostaste " + plMoney(pl.bet) + ". Ya podés soltar la bola.");
}

function plClearBet() {
  if (pl.dropping) return;

  balance += pl.bet;
  pl.bet = 0;

  updateBalance();
  updatePlinkoInfo();
  updatePlinkoButtons();

  setMessage(plEls.message, "Apuesta limpiada.");
}

function getPlinkoPath() {
  const stage = plEls.stage;
  const width = stage.clientWidth || 760;
  const height = stage.clientHeight || 660;
  const rows = pl.rows;

  const topPadding = 40;
  const bottomPadding = 80;
  const usableHeight = height - topPadding - bottomPadding;
  const rowGap = usableHeight / rows;
  const centerX = width / 2;

  let x = centerX;
  let rights = 0;

  const path = [];
  path.push({ x: centerX, y: 14 });

  for (let row = 0; row < rows; row++) {
    const stepSize = Math.min(22 + row * 3.5, 42);
    const goRight = Math.random() < 0.5;

    if (goRight) {
      x += stepSize;
      rights++;
    } else {
      x -= stepSize;
    }

    const y = topPadding + rowGap * row + 25;
    path.push({ x, y });
  }

  const slotIndex = rights;
  const slotCount = rows + 1;
  const slotWidth = width / slotCount;
  const finalX = slotIndex * slotWidth + slotWidth / 2;
  const finalY = height - 26;

  path.push({ x: finalX, y: finalY });

  return {
    path,
    slotIndex
  };
}

function animateBall(path, onDone) {
  const stage = plEls.stage;
  const ball = document.createElement("div");
  ball.className = "plinko-ball";
  stage.appendChild(ball);

  let index = 0;
  let progress = 0;
  const speed = 0.06;

  function step() {
    if (index >= path.length - 1) {
      ball.style.left = path[path.length - 1].x + "px";
      ball.style.top = path[path.length - 1].y + "px";

      setTimeout(() => {
        ball.remove();
        onDone();
      }, 180);
      return;
    }

    const a = path[index];
    const b = path[index + 1];

    progress += speed;

    if (progress >= 1) {
      progress = 0;
      index++;
    }

    const currentA = path[index];
    const currentB = path[Math.min(index + 1, path.length - 1)];

    const x = currentA.x + (currentB.x - currentA.x) * progress;
    const y = currentA.y + (currentB.y - currentA.y) * progress;

    ball.style.left = x + "px";
    ball.style.top = y + "px";

    requestAnimationFrame(step);
  }

  step();
}

function plDropBall() {
  if (pl.dropping || pl.bet <= 0) return;

  pl.dropping = true;
  updatePlinkoButtons();

  const { path, slotIndex } = getPlinkoPath();
  const multipliers = getPlinkoMultipliers();

  animateBall(path, () => {
    const multiplier = multipliers[slotIndex];
    const payout = Number((pl.bet * multiplier).toFixed(2));

    balance = Number((balance + payout).toFixed(2));
    pl.lastMultiplier = multiplier;
    pl.lastWin = payout;

    updateBalance();
    updatePlinkoInfo();

    if (multiplier >= 1) {
      setMessage(
        plEls.message,
        "La bola cayó en x" + multiplier + ". Cobraste " + plMoney(payout) + ".",
        "win"
      );
    } else {
      setMessage(
        plEls.message,
        "La bola cayó en x" + multiplier + ". Cobraste " + plMoney(payout) + ".",
        "push"
      );
    }

    pl.bet = 0;
    pl.dropping = false;

    updatePlinkoInfo();
    updatePlinkoButtons();
  });
}

plEls.chips.forEach(chip => {
  chip.addEventListener("click", () => {
    plPlaceChip(Number(chip.dataset.value));
  });
});

plEls.clear.addEventListener("click", plClearBet);
plEls.drop.addEventListener("click", plDropBall);

plEls.risk.addEventListener("change", () => {
  pl.risk = plEls.risk.value;
  renderPlinkoBoard();
  updatePlinkoInfo();
});

plEls.rows.addEventListener("change", () => {
  pl.rows = Number(plEls.rows.value);
  renderPlinkoBoard();
  updatePlinkoInfo();
});

window.addEventListener("resize", () => {
  renderPlinkoBoard();
});

renderPlinkoBoard();
updatePlinkoInfo();
updatePlinkoButtons();
/* RESET GENERAL */
resetCasinoBtn.addEventListener("click", () => {
  balance = 1000;

  bj.bet = 0;
  bj.active = false;
  bj.dealer = [];
  bj.player = [];
  bj.hidden = true;

  pk.bet = 0;
  pk.phase = "betting";
  pk.player = [];
  pk.dealer = [];
  pk.reveal = false;
  pk.selected.clear();

  rt.bet = 0;
  rt.target = null;
  rt.spinning = false;

  document.querySelectorAll(".selected").forEach(el => {
    el.classList.remove("selected");
  });

  updateBalance();

  renderBlackjack();
  updateBlackjackButtons();
  setMessage(bjEls.message, "Elegí fichas y tocá Repartir.");

  renderPoker();
  updatePokerButtons();
  pkEls.playerName.textContent = "—";
  pkEls.dealerName.textContent = "—";
  setMessage(pkEls.message, "Elegí fichas y tocá Repartir mano.");

  updateRouletteInfo();
  updateRouletteButtons();
  rtEls.result.textContent = "?";
  setMessage(rtEls.message, "Elegí una apuesta, cargá fichas y girá.");
});

/* INICIO */
updateBalance();

renderBlackjack();
updateBlackjackButtons();

renderPoker();
updatePokerButtons();

buildRouletteWheel();
buildNumberBoard();
updateRouletteInfo();
updateRouletteButtons();