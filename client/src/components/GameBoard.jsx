import React, { useState, useEffect } from 'react';
import Card from './Card';

const GameBoard = ({ socket, gameState, myId, revealedCards }) => {
  const [selectedCards, setSelectedCards] = useState([]);
  const [message, setMessage] = useState('');
  const [isMatching, setIsMatching] = useState(false);

  const getCardProps = (playerId, cardIndex, originalCard) => {
    const revealed = revealedCards?.find(rc => rc.playerId === playerId && rc.cardIndex === cardIndex);
    if (revealed) {
      return { card: revealed.card, isFaceUp: true };
    }
    return { card: originalCard, isFaceUp: originalCard.faceUp };
  };

  const me = gameState.players.find(p => p.id === myId);
  const opponents = gameState.players.filter(p => p.id !== myId);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === myId;

  // Handle Initial Peek state
  useEffect(() => {
    if (gameState.state === 'INITIAL_PEEK') {
      setMessage('Select 2 of your cards to peek at.');
    } else if (isMatching) {
      setMessage('Match Mode: Select one of your cards to match the top discard card.');
    } else if (isMyTurn) {
      if (gameState.turnState === 'USING_PEEK') setMessage('Power active: Select one of your cards to peek at.');
      else if (gameState.turnState === 'USING_SPY') setMessage('Power active: Select an opponent\'s card to spy on.');
      else if (gameState.turnState === 'USING_SWAP_1' && selectedCards.length === 0) setMessage('Power active: Select one of your cards to swap.');
      else if (gameState.turnState === 'USING_QUEEN_PEEK') setMessage('Queen Power: Select one of your cards to peek at.');
      else if (gameState.turnState === 'USING_QUEEN_SPY') setMessage('Queen Power: Select an opponent\'s card to spy on.');
      else if (gameState.turnState === 'USING_QUEEN_SWAP') setMessage('Queen Power: Do you want to swap these two cards?');
      else if (gameState.turnState !== 'USING_SWAP_1') setMessage('');
    } else {
      setMessage('');
      setSelectedCards([]);
    }
  }, [gameState.state, gameState.turnState, isMyTurn, isMatching]);

  const handleMyCardClick = (cardIndex) => {
    if (gameState.state === 'INITIAL_PEEK') {
      if (selectedCards.length < 2 && !selectedCards.includes(cardIndex)) {
        const newSelected = [...selectedCards, cardIndex];
        setSelectedCards(newSelected);
        socket.emit('view_initial_cards', { roomId: gameState.roomId, cardIndices: [cardIndex] });
        
        if (newSelected.length === 2) {
          setTimeout(() => {
            socket.emit('finish_initial_peek', { roomId: gameState.roomId });
          }, 5000); // Hide after 5 seconds and finish peek
        }
      }
    } else if (isMatching) {
      socket.emit('match_card', { roomId: gameState.roomId, cardIndex });
      setIsMatching(false);
    } else if (isMyTurn) {
      if (gameState.turnState === 'DRAWN_FROM_DECK') {
        // Swap drawn card with this card
        socket.emit('swap_drawn', { roomId: gameState.roomId, cardIndex });
      } else if (gameState.turnState === 'DRAW_CHOICE') {
        // Draw from discard and swap
        socket.emit('draw_discard_swap', { roomId: gameState.roomId, cardIndex });
      } else if (gameState.turnState === 'USING_PEEK') {
        socket.emit('use_peek', { roomId: gameState.roomId, cardIndex });
      } else if (gameState.turnState === 'USING_QUEEN_PEEK') {
        socket.emit('use_queen_peek', { roomId: gameState.roomId, cardIndex });
      } else if (gameState.turnState === 'USING_SWAP_1') {
        setSelectedCards([cardIndex]);
        setMessage('Now select an opponent\'s card to swap with.');
      }
    }
  };

  const handleOpponentCardClick = (targetPlayerId, cardIndex) => {
    if (isMyTurn) {
      if (gameState.turnState === 'USING_SPY') {
        socket.emit('use_spy', { roomId: gameState.roomId, targetPlayerId, cardIndex });
      } else if (gameState.turnState === 'USING_QUEEN_SPY') {
        socket.emit('use_queen_spy', { roomId: gameState.roomId, targetPlayerId, cardIndex });
      } else if (gameState.turnState === 'USING_SWAP_1' && selectedCards.length === 1) {
        socket.emit('use_swap', {
          roomId: gameState.roomId,
          myCardIndex: selectedCards[0],
          targetPlayerId,
          targetCardIndex: cardIndex
        });
        setSelectedCards([]);
        setMessage('');
      }
    }
  };

  const renderPlayerArea = () => (
    <div className={`player-area ${isMyTurn ? 'active-turn' : ''}`}>
      <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
        <div className="avatar" style={{width: '48px', height: '48px'}}>{me?.name?.substring(0,1).toUpperCase()}</div>
        <div className="opponent-info" style={{alignItems: 'flex-start'}}>
          <span className="opponent-name">{me?.name} (You)</span>
          {gameState.caboCalledBy === myId && <span className="badge" style={{fontSize: '10px'}}>Called Cabo</span>}
        </div>
      </div>
      <div className="player-cards">
        {me?.cards.map((card, i) => {
          const props = getCardProps(myId, i, card);
          return (
            <Card 
              key={card.id || i} 
              card={props.card} 
              isFaceUp={props.isFaceUp || (gameState.state === 'INITIAL_PEEK' && selectedCards.includes(i))} 
              onClick={() => handleMyCardClick(i)}
              className={selectedCards.includes(i) ? 'selected' : ''}
            />
          );
        })}
      </div>
      {gameState.state === 'PLAYING' && (
        <div className="action-bar">
          {!isMatching ? (
            <button className="btn btn-primary" onClick={() => setIsMatching(true)}>Match Card</button>
          ) : (
            <button className="btn btn-danger" onClick={() => setIsMatching(false)}>Cancel Match</button>
          )}
          {isMyTurn && gameState.turnState === 'DRAW_CHOICE' && !gameState.caboCalledBy && (
            <button className="btn btn-danger" onClick={() => socket.emit('call_cabo', { roomId: gameState.roomId })}>Call Cabo</button>
          )}
          {isMyTurn && gameState.turnState === 'DRAWN_FROM_DECK' && (
            <div style={{display: 'flex', gap: '1rem'}}>
              <button className="btn btn-danger" onClick={() => socket.emit('discard_drawn', { roomId: gameState.roomId, usePower: false })}>Discard</button>
              {gameState.drawnCard?.value >= 7 && gameState.drawnCard?.value <= 12 && (
                <button className="btn btn-primary" onClick={() => socket.emit('discard_drawn', { roomId: gameState.roomId, usePower: true })}>Use Power</button>
              )}
            </div>
          )}
          {isMyTurn && gameState.turnState === 'USING_QUEEN_SWAP' && (
            <div style={{display: 'flex', gap: '1rem'}}>
              <button className="btn btn-primary" onClick={() => socket.emit('use_queen_swap', { roomId: gameState.roomId, doSwap: true })}>Swap</button>
              <button className="btn btn-danger" onClick={() => socket.emit('use_queen_swap', { roomId: gameState.roomId, doSwap: false })}>Don't Swap</button>
            </div>
          )}
        </div>
      )}
      <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
        {message && <div className="badge">{message}</div>}
        {isMyTurn && gameState.state === 'PLAYING' && (
          <div className="badge" style={{background: 'var(--color-gold)', color: 'var(--color-navy)', boxShadow: '0 0 15px var(--color-gold)'}}>Your Turn</div>
        )}
      </div>
    </div>
  );

  // renderDrawnCardOverlay removed

  const renderGameOver = () => {
    if (gameState.state !== 'GAME_OVER') return null;
    const minScore = Math.min(...gameState.players.map(p => p.score));
    const winners = gameState.players.filter(p => p.score === minScore).map(p => p.name).join(', ');
    const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

    return (
      <div className="drawn-card-overlay">
        <h2>Game Over</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%'}}>
          {gameState.players.sort((a,b) => a.score - b.score).map(p => (
            <div key={p.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', background: 'var(--surface-container-high)', borderRadius: '4px'}}>
              <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '0.5rem'}}>{p.name}</span>
              <div style={{display: 'flex', gap: '8px', flexShrink: 0}}>
                {p.cards.map((card, idx) => {
                  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
                  return (
                    <div key={idx} style={{
                      width: '28px', height: '40px', background: 'var(--color-ivory)', 
                      color: isRed ? 'var(--color-crimson)' : 'var(--color-charcoal)',
                      borderRadius: '3px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
                    }}>
                      <span style={{fontSize: '14px', fontWeight: 'bold'}}>{card.rank}</span>
                      <span style={{fontSize: '12px'}}>{suitSymbols[card.suit]}</span>
                    </div>
                  );
                })}
              </div>
              <strong style={{flex: 1, textAlign: 'right', whiteSpace: 'nowrap', paddingLeft: '0.5rem'}}>{p.score} pts</strong>
            </div>
          ))}
        </div>
        <div style={{marginTop: '1rem', textAlign: 'center', color: 'var(--color-gold-light)', fontWeight: 'bold'}}>
          Winner{winners.includes(',') ? 's' : ''}: {winners}!
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Back to Lobby</button>
      </div>
    );
  };

  return (
    <div className={`game-layout ${isMyTurn ? 'my-turn-active' : ''}`}>
      <div className="status-bar">
        <div>
          <span style={{color: 'var(--color-gold-light)', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.1em'}}>ROOM CODE</span>
          <div style={{fontSize: '2rem', fontFamily: 'var(--font-serif)', color: 'var(--color-gold)', lineHeight: 1}}>{gameState.roomId}</div>
        </div>
        <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
          <span style={{color: 'var(--on-surface-variant)', fontSize: '14px', fontWeight: 'bold'}}>{gameState.state.replace('_', ' ')}</span>
          <button className="btn btn-danger" onClick={() => window.location.reload()}>Leave Game</button>
        </div>
      </div>
      
      <div className="opponents-area">
        {opponents.map(opp => (
          <div key={opp.id} className={`opponent ${gameState.players[gameState.turnIndex]?.id === opp.id ? 'active-turn' : ''}`}>
            <div className="avatar">{opp.name.substring(0, 1).toUpperCase()}</div>
            <div className="opponent-info">
              <span className="opponent-name">{opp.name}</span>
              {gameState.caboCalledBy === opp.id && <span className="badge" style={{fontSize: '10px'}}>Called Cabo</span>}
            </div>
            <div className="opponent-cards">
              {opp.cards.map((card, i) => {
                const props = getCardProps(opp.id, i, card);
                return (
                  <Card 
                    key={card.id || i} 
                    card={props.card} 
                    isFaceUp={props.isFaceUp} 
                    onClick={() => handleOpponentCardClick(opp.id, i)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="center-area">
        <div className="pile">
          <div 
            className="pile-slot"
            onClick={() => {
              if (isMyTurn && gameState.turnState === 'DRAW_CHOICE') {
                socket.emit('draw_deck', { roomId: gameState.roomId });
              }
            }}
            style={{ cursor: (isMyTurn && gameState.turnState === 'DRAW_CHOICE') ? 'pointer' : 'default' }}
          >
            {gameState.deckCount > 0 && <Card isFaceUp={false} />}
          </div>
          <span className="pile-label">{gameState.deckCount} cards</span>
        </div>
        
        <div className="pile">
          <div className="pile-slot">
            {gameState.discardTop && <Card key={gameState.discardTop.id || 'discard'} card={gameState.discardTop} isFaceUp={true} />}
          </div>
          <span className="pile-label">Discard</span>
        </div>

        {gameState.drawnCard && isMyTurn && gameState.turnState === 'DRAWN_FROM_DECK' && (
          <div className="pile" style={{marginLeft: '2rem'}}>
            <div className="pile-slot" style={{borderColor: 'var(--color-gold)'}}>
              <Card key={gameState.drawnCard.id || 'drawn'} card={gameState.drawnCard} isFaceUp={true} />
            </div>
            <span className="pile-label" style={{background: 'var(--color-gold-dark)', color: '#fff'}}>Drawn</span>
          </div>
        )}
      </div>

      {renderPlayerArea()}
      {renderGameOver()}

      <div className="live-feed">
        <div className="live-feed-title">Live Feed</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', maxHeight: '120px'}}>
          {[...(gameState.logs || [])].reverse().map((log, i) => (
            <div key={i} className="feed-item"><span className="feed-system">&gt;</span> {log}</div>
          ))}
          {(!gameState.logs || gameState.logs.length === 0) && (
            <div className="feed-item"><span className="feed-system">System:</span> Waiting for moves.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
