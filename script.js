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

const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

const rt = {
  bet: 0,
  target: null,
  spinning: false,
  rotation: 0
};

const rtEls = {
  message: document.getElementById("rt-message"),
  bet: document.getElementById("rt-bet"),
  target: document.getElementById("rt-target"),
  result: document.getElementById("roulette-result"),
  rotor: document.getElementById("roulette-rotor"),
  labels: document.getElementById("roulette-labels"),
  board: document.getElementById("number-board"),
  chips: document.querySelectorAll(".rt-chip"),
  clear: document.getElementById("rt-clear"),
  spin: document.getElementById("rt-spin"),
  quickBets: document.querySelectorAll(".quick-bet")
};

function rouletteColor(number) {
  if (number === 0) return "green";
  return redNumbers.has(number) ? "red" : "black";
}

function updateRouletteInfo() {
  rtEls.bet.textContent = "$" + rt.bet;
  rtEls.target.textContent = getTargetName(rt.target);
}

function getTargetName(target) {
  if (!target) return "Ninguna";

  if (target.type === "number") return "Número " + target.value;

  let names = {
    red: "Rojo",
    black: "Negro",
    even: "Par",
    odd: "Impar",
    low: "1 - 18",
    high: "19 - 36"
  };

  return names[target.value];
}

function updateRouletteButtons() {
  rtEls.chips.forEach(chip => {
    let value = Number(chip.dataset.value);
    chip.disabled = rt.spinning || !rt.target || balance < value;
  });

  rtEls.clear.disabled = rt.spinning || rt.bet === 0;
  rtEls.spin.disabled = rt.spinning || rt.bet === 0 || !rt.target;
}

function selectRouletteTarget(type, value, element) {
  document.querySelectorAll(".quick-bet, .num-btn").forEach(btn => {
    btn.classList.remove("selected");
  });

  element.classList.add("selected");

  rt.target = {
    type,
    value: type === "number" ? Number(value) : value
  };

  updateRouletteInfo();
  updateRouletteButtons();
  setMessage(rtEls.message, "Apuesta elegida: " + getTargetName(rt.target) + ".");
}

function rtPlaceChip(value) {
  if (rt.spinning || !rt.target || balance < value) return;

  balance -= value;
  rt.bet += value;

  updateBalance();
  updateRouletteInfo();
  updateRouletteButtons();
  setMessage(rtEls.message, "Cargaste $" + rt.bet + " a " + getTargetName(rt.target) + ".");
}

function rtClearBet() {
  if (rt.spinning) return;

  balance += rt.bet;
  rt.bet = 0;

  updateBalance();
  updateRouletteInfo();
  updateRouletteButtons();
  setMessage(rtEls.message, "Apuesta limpiada.");
}

function isRouletteWin(number) {
  if (!rt.target) return false;

  if (rt.target.type === "number") return number === rt.target.value;
  if (rt.target.value === "red") return rouletteColor(number) === "red";
  if (rt.target.value === "black") return rouletteColor(number) === "black";
  if (rt.target.value === "even") return number !== 0 && number % 2 === 0;
  if (rt.target.value === "odd") return number % 2 === 1;
  if (rt.target.value === "low") return number >= 1 && number <= 18;
  if (rt.target.value === "high") return number >= 19 && number <= 36;

  return false;
}

function rtSpin() {
  if (rt.spinning || rt.bet <= 0 || !rt.target) return;

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

    if (isRouletteWin(winnerNumber)) {
      let multiplier = rt.target.type === "number" ? 36 : 2;
      let pay = rt.bet * multiplier;

      balance += pay;
      setMessage(rtEls.message, "Salió " + winnerNumber + ". Ganaste $" + (pay - rt.bet) + ".", "win");
    } else {
      setMessage(rtEls.message, "Salió " + winnerNumber + ". Perdiste la apuesta.", "lose");
    }

    rt.bet = 0;
    rt.spinning = false;

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

  for (let i = 0; i <= 36; i++) {
    let btn = document.createElement("button");
    let color = rouletteColor(i);

    btn.className = "num-btn " + color;
    btn.textContent = i;

    btn.addEventListener("click", () => {
      selectRouletteTarget("number", i, btn);
    });

    rtEls.board.appendChild(btn);
  }
}

rtEls.quickBets.forEach(button => {
  button.addEventListener("click", () => {
    selectRouletteTarget(button.dataset.type, button.dataset.value, button);
  });
});

rtEls.chips.forEach(chip => {
  chip.addEventListener("click", () => rtPlaceChip(Number(chip.dataset.value)));
});

rtEls.clear.addEventListener("click", rtClearBet);
rtEls.spin.addEventListener("click", rtSpin);

window.addEventListener("resize", () => {
  buildRouletteLabels();
});
/* COIN MINER */
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