# Cabo Multiplayer Game

A real-time, online multiplayer web implementation of the card game Cabo, featuring a premium casino-inspired "Grand Royale" design. 

## Special Rules & Custom Mechanics

This version of Cabo follows standard rules with a few specific, fun twists:

1. **Kings are -1:** All Kings are worth -1 point. (Standard Cabo rules usually only have Black Kings as -1, and Red Kings as 13. In this variant, all are -1).
2. **Match / Slap Mechanic:** If an opponent discards a card to the pile (e.g., a 7), and you have a 7 in your hand, you can immediately "Match" that discard pile card by dropping your 7 on top of it, out of turn! If you succeed, you shed a card. If you attempt a match and are wrong, you are penalized by having to draw an extra card from the deck.
3. **The Queen Combo Power:** Drawing and discarding a Queen (value 12) triggers a combo power:
   - You **Peek** at one of your own cards.
   - You **Spy** on one of your opponent's cards.
   - You decide whether or not to **Swap** them.
4. **No Caller Penalty/Reward:** The game strictly adds up the face value of the cards at the end of the game. Calling Cabo doesn't automatically drop your score to 0 or penalize you if you aren't the lowest. The lowest sum wins!

## Standard Card Powers

If you draw these cards from the deck and immediately discard them, you can use their special powers:
- **7 or 8 (Peek):** Look at one of your own cards secretly.
- **9 or 10 (Spy):** Look at one of your opponent's cards secretly.
- **11 (Swap):** Blindly swap one of your cards with an opponent's card.
- **12 (Queen Combo):** See rules above.

## Deployment Guide

This game is split into a **Node.js/Socket.io Backend** and a **React/Vite Frontend**. You can host these for free easily.

### 1. Backend (Render)
1. Push this code to GitHub.
2. Go to [Render.com](https://render.com) and create a new **Web Service**.
3. Point it to your GitHub repository.
4. Set the **Root Directory** to `server`.
5. Build Command: `npm install`
6. Start Command: `node index.js`
7. Copy the deployed URL once it finishes (e.g., `https://cabo-backend.onrender.com`).

### 2. Frontend (Vercel or Netlify)
1. Go to [Vercel.com](https://vercel.com) and create a new project from your GitHub repository.
2. Set the **Root Directory** to `client`.
3. Add an Environment Variable:
   - **Key:** `VITE_SERVER_URL`
   - **Value:** `[Your Render Backend URL]`
4. Deploy!

You can now share your Vercel frontend URL with your family, create a room, click the "Copy" button in the lobby, and send them the link to instantly join!
