const { createDeck } = require('./deck');

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = []; // { id, name, cards: [], connected: true }
    this.state = 'WAITING'; // WAITING, INITIAL_PEEK, PLAYING, GAME_OVER
    this.deck = [];
    this.discardPile = [];
    this.turnIndex = 0;
    this.caboCalledBy = null;
    this.turnState = null; // null, DRAW_CHOICE, DRAWN_FROM_DECK, USING_PEEK, USING_SPY, USING_SWAP_1, USING_SWAP_2
    this.drawnCard = null;
    this.swapPendingCardIndex = null; // For 2-step swap
    this.lastRound = false;
    this.logs = [];
    this.queenData = null;
    this.finishedInitialPeek = new Set();
  }

  addLog(message) {
    this.logs.push(message);
    if (this.logs.length > 50) this.logs.shift(); // keep last 50 logs
  }

  addPlayer(id, name) {
    if (this.state !== 'WAITING') return false;
    if (this.players.length >= 4) return false;
    this.players.push({
      id,
      name,
      cards: [], // Each card: { ...cardDetails, faceUp: false }
      score: 0
    });
    return true;
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
    if (this.players.length === 0) return true; // Room empty
    return false;
  }

  startGame() {
    if (this.players.length < 2) return false;
    this.state = 'INITIAL_PEEK';
    this.finishedInitialPeek = new Set();
    const numDecks = this.players.length > 4 ? 2 : 1;
    this.deck = createDeck(numDecks);
    this.discardPile = [];
    
    // Deal 4 cards to each player
    this.players.forEach(p => {
      p.cards = [];
      for (let i = 0; i < 4; i++) {
        p.cards.push({ ...this.deck.pop(), faceUp: false });
      }
    });
    
    // Top card to discard pile
    const firstDiscard = this.deck.pop();
    firstDiscard.faceUp = true;
    this.discardPile.push(firstDiscard);
    
    this.turnIndex = 0;
    this.addLog("Game started. Initial peek phase.");
    return true;
  }

  setPlayerFinishedInitialPeek(playerId) {
    if (this.state !== 'INITIAL_PEEK') return false;
    this.finishedInitialPeek.add(playerId);
    
    if (this.finishedInitialPeek.size === this.players.length) {
      this.finishInitialPeek();
      return true; // All finished
    }
    return false; // Still waiting
  }

  finishInitialPeek() {
    this.state = 'PLAYING';
    this.turnState = 'DRAW_CHOICE';
    this.addLog("Playing phase started.");
    this.addLog(`It's ${this.getActivePlayer().name}'s turn.`);
  }

  getActivePlayer() {
    return this.players[this.turnIndex];
  }

  nextTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.turnState = 'DRAW_CHOICE';
    
    this.addLog(`It's ${this.getActivePlayer().name}'s turn.`);
    
    if (this.lastRound && this.players[this.turnIndex].id === this.caboCalledBy) {
      this.endGame();
    }
  }

  // Action: Draw from Deck
  drawFromDeck(playerId) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'DRAW_CHOICE') return false;
    if (this.deck.length === 0) {
      // Reshuffle discard pile into deck, leaving top card
      const topDiscard = this.discardPile.pop();
      this.deck = [...this.discardPile].map(c => ({...c, faceUp: false})).sort(() => Math.random() - 0.5);
      this.discardPile = [topDiscard];
    }
    this.drawnCard = { ...this.deck.pop(), faceUp: true };
    this.turnState = 'DRAWN_FROM_DECK';
    this.addLog(`${this.getActivePlayer().name} drew a card from the deck.`);
    return true;
  }

  // Action: Draw from Discard and swap with one of hand cards
  drawFromDiscardAndSwap(playerId, cardIndex) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'DRAW_CHOICE') return false;
    const player = this.getActivePlayer();
    
    const discardCard = this.discardPile.pop();
    const myOldCard = player.cards[cardIndex];
    
    myOldCard.faceUp = true;
    this.discardPile.push(myOldCard);
    
    discardCard.faceUp = false; // Put face down in hand
    player.cards[cardIndex] = discardCard;
    
    this.addLog(`${player.name} drew the top discard and swapped it with their card.`);
    this.nextTurn();
    return true;
  }

  // Action: Call Cabo
  callCabo(playerId) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'DRAW_CHOICE') return false;
    if (this.caboCalledBy) return false; // Already called
    
    this.caboCalledBy = playerId;
    this.lastRound = true;
    this.addLog(`🚨 ${this.getActivePlayer().name} called CABO! Last round!`);
    this.nextTurn();
    return true;
  }

  // Action: Swap drawn deck card with a hand card
  swapDrawnCard(playerId, cardIndex) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'DRAWN_FROM_DECK') return false;
    const player = this.getActivePlayer();
    
    const myOldCard = player.cards[cardIndex];
    myOldCard.faceUp = true;
    this.discardPile.push(myOldCard);
    
    this.drawnCard.faceUp = false;
    player.cards[cardIndex] = this.drawnCard;
    
    this.drawnCard = null;
    this.addLog(`${player.name} swapped the drawn card with one of their cards.`);
    this.nextTurn();
    return true;
  }

  // Action: Discard drawn card and potentially use power
  discardDrawnCard(playerId, usePower = false) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'DRAWN_FROM_DECK') return false;
    
    this.discardPile.push(this.drawnCard);
    
    if (usePower) {
      const val = this.drawnCard.value;
      if (val === 7 || val === 8) {
        this.turnState = 'USING_PEEK';
        this.addLog(`${this.getActivePlayer().name} discarded a ${val} and is using the Peek power.`);
        return true;
      } else if (val === 9 || val === 10) {
        this.turnState = 'USING_SPY';
        this.addLog(`${this.getActivePlayer().name} discarded a ${val} and is using the Spy power.`);
        return true;
      } else if (val === 11) {
        this.turnState = 'USING_SWAP_1';
        this.addLog(`${this.getActivePlayer().name} discarded a 11 and is using the Swap power.`);
        return true;
      } else if (val === 12) {
        this.turnState = 'USING_QUEEN_PEEK';
        this.queenData = {};
        this.addLog(`${this.getActivePlayer().name} discarded a Queen to use the special Queen power.`);
        return true;
      }
    }
    
    this.addLog(`${this.getActivePlayer().name} discarded their drawn card.`);
    this.drawnCard = null;
    this.nextTurn();
    return true;
  }

  // Action: Special Power Peek
  usePeek(playerId, cardIndex) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'USING_PEEK') return false;
    // Server just allows it, the client reveals the card locally.
    this.drawnCard = null;
    this.addLog(`${this.getActivePlayer().name} peeked at their card.`);
    this.nextTurn();
    return true;
  }

  // Action: Special Power Spy
  useSpy(playerId, targetPlayerId, cardIndex) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'USING_SPY') return false;
    const target = this.players.find(p => p.id === targetPlayerId);
    this.drawnCard = null;
    this.addLog(`${this.getActivePlayer().name} spied on ${target?.name}'s card.`);
    this.nextTurn();
    return true;
  }

  // Action: Special Power Swap
  useSwap(playerId, myCardIndex, targetPlayerId, targetCardIndex) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'USING_SWAP_1') return false;
    
    const me = this.getActivePlayer();
    const target = this.players.find(p => p.id === targetPlayerId);
    if (!target || target.id === me.id) return false;

    const myCard = me.cards[myCardIndex];
    const theirCard = target.cards[targetCardIndex];

    me.cards[myCardIndex] = theirCard;
    target.cards[targetCardIndex] = myCard;

    this.drawnCard = null;
    this.addLog(`${me.name} swapped a card with ${target.name}.`);
    this.nextTurn();
    return true;
  }

  useQueenPeek(playerId, cardIndex) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'USING_QUEEN_PEEK') return false;
    this.queenData.myCardIndex = cardIndex;
    this.turnState = 'USING_QUEEN_SPY';
    this.addLog(`${this.getActivePlayer().name} peeked at their card via Queen power.`);
    return true;
  }

  useQueenSpy(playerId, targetPlayerId, cardIndex) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'USING_QUEEN_SPY') return false;
    this.queenData.targetPlayerId = targetPlayerId;
    this.queenData.targetCardIndex = cardIndex;
    this.turnState = 'USING_QUEEN_SWAP';
    const target = this.players.find(p => p.id === targetPlayerId);
    this.addLog(`${this.getActivePlayer().name} spied on ${target?.name}'s card via Queen power.`);
    return true;
  }

  useQueenSwap(playerId, doSwap) {
    if (this.getActivePlayer().id !== playerId || this.turnState !== 'USING_QUEEN_SWAP') return false;
    
    if (doSwap) {
      const me = this.getActivePlayer();
      const target = this.players.find(p => p.id === this.queenData.targetPlayerId);
      
      const myCard = me.cards[this.queenData.myCardIndex];
      const theirCard = target.cards[this.queenData.targetCardIndex];

      me.cards[this.queenData.myCardIndex] = theirCard;
      target.cards[this.queenData.targetCardIndex] = myCard;
      this.addLog(`${me.name} used Queen power to swap cards!`);
    } else {
      this.addLog(`${this.getActivePlayer().name} used Queen power but decided NOT to swap.`);
    }

    this.queenData = null;
    this.nextTurn();
    return true;
  }

  // Action: Match out-of-turn discard
  matchCard(playerId, cardIndex) {
    if (this.state !== 'PLAYING') return false;
    if (this.discardPile.length === 0) return false;

    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;
    if (cardIndex < 0 || cardIndex >= player.cards.length) return false;

    const topDiscard = this.discardPile[this.discardPile.length - 1];
    const cardToMatch = player.cards[cardIndex];
    const isMatch = cardToMatch.rank === topDiscard.rank;

    if (isMatch) {
      // Success! Remove card from hand, put on discard pile.
      cardToMatch.faceUp = true;
      this.discardPile.push(cardToMatch);
      player.cards.splice(cardIndex, 1);
      this.addLog(`✅ ${player.name} successfully matched the discard pile!`);
    } else {
      // Failure! Player keeps their card and draws a penalty card.
      if (this.deck.length === 0) {
        // Reshuffle discard into deck leaving top card
        const topD = this.discardPile.pop();
        this.deck = [...this.discardPile].map(c => ({...c, faceUp: false})).sort(() => Math.random() - 0.5);
        this.discardPile = [topD];
      }
      const penaltyCard = this.deck.pop();
      penaltyCard.faceUp = false;
      player.cards.push(penaltyCard);
      this.addLog(`❌ ${player.name} failed to match the discard pile and drew a penalty card.`);
    }
    
    return { success: true, isMatch, cardToMatch };
  }

  endGame() {
    this.state = 'GAME_OVER';
    this.addLog("Game Over! Calculating scores...");
    // Reveal all cards
    this.players.forEach(p => {
      p.cards.forEach(c => c.faceUp = true);
    });

    // Calculate scores
    let minScore = Infinity;
    this.players.forEach(p => {
      p.score = p.cards.reduce((sum, c) => sum + c.value, 0);
      if (p.score < minScore) minScore = p.score;
    });
  }

  getPublicState() {
    return {
      roomId: this.roomId,
      state: this.state,
      turnIndex: this.turnIndex,
      turnState: this.turnState,
      caboCalledBy: this.caboCalledBy,
      lastRound: this.lastRound,
      drawnCard: this.drawnCard,
      discardTop: this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null,
      deckCount: this.deck.length,
      logs: this.logs,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        cards: p.cards.map(c => c.faceUp ? c : { id: c.id, faceUp: false }) // Hide face down cards but keep ID
      }))
    };
  }
}

module.exports = Room;
