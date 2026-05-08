import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import GameBoard from './components/GameBoard';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const socket = io(SOCKET_URL);

function App() {
  const [gameState, setGameState] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [myId, setMyId] = useState('');
  const [revealedCards, setRevealedCards] = useState([]);
  const [copied, setCopied] = useState(false);

  const urlRoom = new URLSearchParams(window.location.search).get('room');

  useEffect(() => {
    if (urlRoom) setJoinRoomId(urlRoom);
    
    socket.on('connect', () => {
      setMyId(socket.id);
    });

    socket.on('room_update', (state) => {
      setGameState(state);
    });

    socket.on('private_drawn_card', (card) => {
      setGameState(prev => ({ ...prev, drawnCard: card }));
    });

    socket.on('initial_cards_result', (cards) => {
      setRevealedCards(prev => {
        const next = [...prev];
        cards.forEach(({ index, card }) => {
          next.push({ playerId: socket.id, cardIndex: index, card });
        });
        return next;
      });
      setTimeout(() => {
        setRevealedCards(prev => prev.filter(rc => rc.playerId !== socket.id || !cards.some(c => c.index === rc.cardIndex)));
      }, 10000);
    });

    socket.on('peek_result', ({ cardIndex, card }) => {
      setRevealedCards(prev => [...prev, { playerId: socket.id, cardIndex, card }]);
      setTimeout(() => {
        setRevealedCards(prev => prev.filter(rc => !(rc.playerId === socket.id && rc.cardIndex === cardIndex)));
      }, 10000);
    });

    socket.on('spy_result', ({ targetPlayerId, cardIndex, card }) => {
      setRevealedCards(prev => [...prev, { playerId: targetPlayerId, cardIndex, card }]);
      setTimeout(() => {
        setRevealedCards(prev => prev.filter(rc => !(rc.playerId === targetPlayerId && rc.cardIndex === cardIndex)));
      }, 10000);
    });

    socket.on('match_failed', ({ playerId, cardIndex, card }) => {
      setRevealedCards(prev => [...prev, { playerId, cardIndex, card }]);
      setTimeout(() => {
        setRevealedCards(prev => prev.filter(rc => !(rc.playerId === playerId && rc.cardIndex === cardIndex)));
      }, 10000);
    });

    return () => {
      socket.off('connect');
      socket.off('room_update');
      socket.off('private_drawn_card');
      socket.off('initial_cards_result');
      socket.off('peek_result');
      socket.off('spy_result');
    };
  }, []);

  const handleCreateRoom = () => {
    if (!playerName) return alert('Enter your name');
    socket.emit('create_room', { playerName }, (res) => {
      if (!res.success) alert('Failed to create room');
    });
  };

  const handleJoinRoom = () => {
    if (!playerName || !joinRoomId) return alert('Enter name and room ID');
    socket.emit('join_room', { roomId: joinRoomId, playerName }, (res) => {
      if (!res.success) alert(res.message);
    });
  };

  const handleStartGame = () => {
    socket.emit('start_game', { roomId: gameState.roomId });
  };

  if (gameState) {
    if (gameState.state === 'WAITING') {
      return (
        <div className="app-container">
          <div className="game-container">
            <div className="home-container">
              <h2>Room: {gameState.roomId}</h2>
              <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                <h3 style={{color: 'var(--color-gold-light)', marginBottom: '0.5rem'}}>Players:</h3>
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                  {gameState.players.map(p => (
                    <li key={p.id} style={{ padding: '0.75rem', background: 'var(--surface-container-high)', margin: '0.5rem 0', borderRadius: '4px', border: '1px solid var(--color-gold-dark)' }}>
                      {p.name} {p.id === myId ? '(You)' : ''}
                    </li>
                  ))}
                </ul>
              </div>
              {gameState.players.length >= 2 && (
                <button className="btn btn-primary" onClick={handleStartGame} style={{marginBottom: '1rem', width: '100%'}}>Start Game</button>
              )}
              <div style={{marginTop: '1rem', marginBottom: '1.5rem', background: 'var(--surface-container-lowest)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--color-gold-dark)'}}>
                <p style={{color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '0.5rem'}}>Share this link with others to join:</p>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <input type="text" readOnly value={`${window.location.origin}?room=${gameState.roomId}`} style={{flex: 1, padding: '0.5rem', background: 'var(--surface)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)', borderRadius: '4px'}} />
                  <button className="btn btn-primary" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}?room=${gameState.roomId}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <button className="btn btn-danger" onClick={() => window.location.reload()} style={{width: '100%'}}>Leave Room</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="app-container">
        <GameBoard socket={socket} gameState={gameState} myId={myId} revealedCards={revealedCards} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="game-container">
        <div className="home-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-gold)', marginBottom: '2rem' }}>Cabo</h1>
          <div className="input-group">
            <label>Your Name</label>
            <input 
              value={playerName} 
              onChange={e => setPlayerName(e.target.value)} 
              placeholder="e.g. John" 
            />
          </div>
          
          {!urlRoom && (
            <>
              <button className="btn btn-primary" onClick={handleCreateRoom} style={{width: '100%'}}>
                Create New Room
              </button>
              <div className="divider">OR</div>
            </>
          )}
          
          <div className="input-group">
            <label>Room Code</label>
            <input 
              value={joinRoomId} 
              onChange={e => setJoinRoomId(e.target.value.toUpperCase())} 
              placeholder="e.g. A1B2C3" 
              maxLength={6}
              readOnly={!!urlRoom}
              style={urlRoom ? {opacity: 0.7} : {}}
            />
          </div>
          
          <button className="btn btn-primary" onClick={handleJoinRoom} style={{width: '100%'}}>
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
