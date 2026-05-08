import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ card, onClick, isFaceUp = false, className = '' }) => {
  const isRed = card && (card.suit === 'hearts' || card.suit === 'diamonds');
  
  const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };

  return (
    <motion.div 
      layoutId={card?.id} 
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`playing-card ${isFaceUp ? 'is-face-up' : ''} ${className}`} 
      onClick={onClick}
    >
      <div className="card-inner">
        <div className="card-back"></div>
        <div className={`card-front ${isRed ? 'red' : ''}`}>
          {card && (
            <>
              <div className="card-corner">
                <span className="card-rank">{card.rank}</span>
                <span className="card-suit-small">{suitSymbols[card.suit]}</span>
              </div>
              <div className="card-center">
                {suitSymbols[card.suit]}
              </div>
              <div className="card-corner-bottom">
                <span className="card-rank">{card.rank}</span>
                <span className="card-suit-small">{suitSymbols[card.suit]}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Card;
