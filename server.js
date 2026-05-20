const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Store all active game rooms
const rooms = {};

// Card pairs: [{ pairId, question, answer, category, emoji }]
const CARD_PAIRS = [
  // Geography
  { pairId: 'geo1', question: 'Capital of Japan?', answer: 'Tokyo', category: 'Geography', emoji: '🌍' },
  { pairId: 'geo2', question: 'Largest country by area?', answer: 'Russia', category: 'Geography', emoji: '🌍' },
  { pairId: 'geo3', question: 'Capital of France?', answer: 'Paris', category: 'Geography', emoji: '🌍' },
  { pairId: 'geo4', question: 'Capital of Australia?', answer: 'Canberra', category: 'Geography', emoji: '🌍' },
  { pairId: 'geo5', question: 'Longest river in the world?', answer: 'Nile River', category: 'Geography', emoji: '🌍' },

  // Movies
  { pairId: 'mov1', question: 'Who played Iron Man?', answer: 'Robert Downey Jr.', category: 'Movies', emoji: '🎬' },
  { pairId: 'mov2', question: 'Who directed Titanic?', answer: 'James Cameron', category: 'Movies', emoji: '🎬' },
  { pairId: 'mov3', question: 'Highest-grossing film ever?', answer: 'Avatar: The Way of Water', category: 'Movies', emoji: '🎬' },
  { pairId: 'mov4', question: 'Who played Darth Vader?', answer: 'David Prowse', category: 'Movies', emoji: '🎬' },
  { pairId: 'mov5', question: 'What year was Avatar released?', answer: '2009', category: 'Movies', emoji: '🎬' },

  // Animals
  { pairId: 'ani1', question: 'Fastest land animal?', answer: 'Cheetah', category: 'Animals', emoji: '🐾' },
  { pairId: 'ani2', question: 'Largest animal in the world?', answer: 'Blue Whale', category: 'Animals', emoji: '🐾' },
  { pairId: 'ani3', question: 'How many legs does a spider have?', answer: '8', category: 'Animals', emoji: '🐾' },
  { pairId: 'ani4', question: 'What do pandas mostly eat?', answer: 'Bamboo', category: 'Animals', emoji: '🐾' },
  { pairId: 'ani5', question: 'Bird that cannot fly?', answer: 'Penguin', category: 'Animals', emoji: '🐾' },

  // Food
  { pairId: 'foo1', question: 'Country that invented pizza?', answer: 'Italy', category: 'Food', emoji: '🍕' },
  { pairId: 'foo2', question: 'Country that invented pasta?', answer: 'Italy', category: 'Food', emoji: '🍕' },
  { pairId: 'foo3', question: 'Spiciest pepper in the world?', answer: 'Carolina Reaper', category: 'Food', emoji: '🍕' },
  { pairId: 'foo4', question: 'What is sushi wrapped in?', answer: 'Seaweed', category: 'Food', emoji: '🍕' },
  { pairId: 'foo5', question: 'National drink of Brazil?', answer: 'Caipirinha', category: 'Food', emoji: '🍕' },

  // Math
  { pairId: 'mat1', question: '8 × 7 = ?', answer: '56', category: 'Math', emoji: '🔢' },
  { pairId: 'mat2', question: 'Square root of 144?', answer: '12', category: 'Math', emoji: '🔢' },
  { pairId: 'mat3', question: 'What is π rounded to 2 decimal places?', answer: '3.14', category: 'Math', emoji: '🔢' },
  { pairId: 'mat4', question: '100 ÷ 5 = ?', answer: '20', category: 'Math', emoji: '🔢' },
  { pairId: 'mat5', question: 'Fibonacci sequence starts with?', answer: '0, 1', category: 'Math', emoji: '🔢' },

  // Gaming
  { pairId: 'gam1', question: 'Mario\'s brother?', answer: 'Luigi', category: 'Gaming', emoji: '🎮' },
  { pairId: 'gam2', question: 'Pokémon Pikachu\'s type?', answer: 'Electric', category: 'Gaming', emoji: '🎮' },
  { pairId: 'gam3', question: 'Game where you build with blocks?', answer: 'Minecraft', category: 'Gaming', emoji: '🎮' },
  { pairId: 'gam4', question: 'Legend of Zelda protagonist?', answer: 'Link', category: 'Gaming', emoji: '🎮' },
  { pairId: 'gam5', question: 'Sonic\'s arch enemy?', answer: 'Dr. Robotnik', category: 'Gaming', emoji: '🎮' },

  // Music
  { pairId: 'mus1', question: 'Strings on a guitar?', answer: '6', category: 'Music', emoji: '🎵' },
  { pairId: 'mus2', question: 'Strings on a violin?', answer: '4', category: 'Music', emoji: '🎵' },
  { pairId: 'mus3', question: 'Band with members named John, Paul, George, Ringo?', answer: 'The Beatles', category: 'Music', emoji: '🎵' },
  { pairId: 'mus4', question: 'How many keys on a piano?', answer: '88', category: 'Music', emoji: '🎵' },
  { pairId: 'mus5', question: 'Musical scale notes in order starting from C?', answer: 'C, D, E, F, G, A, B', category: 'Music', emoji: '🎵' },
];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function getRoom(roomCode) {
  return rooms[roomCode];
}

function createCard(pairData, isQuestion) {
  // Return card to client WITHOUT pairId
  return {
    text: isQuestion ? pairData.question : pairData.answer,
    category: pairData.category,
    emoji: pairData.emoji,
    isQuestion: isQuestion,
    label: isQuestion ? 'QUESTION' : 'ANSWER',
  };
}

function assignCards(playerIds) {
  // Filter only even count for pairing (require at least 4, at most 10)
  let count = playerIds.length;
  if (count % 2 !== 0) count--; // Round down to even
  
  const playersToUse = playerIds.slice(0, count);
  
  // Select random pairs for this game
  const numPairs = count / 2;
  const selectedPairs = shuffle(CARD_PAIRS).slice(0, numPairs);

  // Create Q/A cards and shuffle
  const cards = [];
  selectedPairs.forEach(pair => {
    cards.push({ ...pair, isQuestion: true });
    cards.push({ ...pair, isQuestion: false });
  });
  const shuffledCards = shuffle(cards);

  // Assign to players
  const result = {};
  playersToUse.forEach((playerId, i) => {
    result[playerId] = shuffledCards[i];
  });
  return result;
}

function checkForMatch(room) {
  // Check if any adjacent Q+A pairs match
  const count = room.players.length;
  for (let i = 0; i < count; i++) {
    const currentId = room.players[i].id;
    const rightNeighborId = room.players[(i + 1) % count].id;

    const currentCard = room.cards[currentId];
    const rightCard = room.cards[rightNeighborId];

    if (!currentCard || !rightCard) continue;

    // Check if they are a matching pair (same pairId, one Q and one A)
    if (currentCard.pairId === rightCard.pairId &&
        currentCard.isQuestion !== rightCard.isQuestion) {
      return { pairId: currentCard.pairId, player1: currentId, player2: rightNeighborId };
    }
  }
  return null;
}


io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create a new room
  socket.on('create_room', ({ name }) => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    rooms[code] = {
      code,
      host: socket.id,
      players: [{ id: socket.id, name, seat: 0 }],
      state: 'lobby', // lobby, playing, between_rounds, ended
      cards: {},
      matchedPairs: new Set(),
      activeRound: 1,
      totalRounds: 5,
      timerDuration: 60,
      timerLeft: 60,
      timerInterval: null,
      eliminations: new Set(),
      scores: { [socket.id]: 0 },
    };
    socket.join(code);
    socket.data.room = code;
    socket.data.name = name;
    socket.emit('room_created', { code, playerId: socket.id });
    io.to(code).emit('lobby_update', getLobbyData(code));
  });

  // Join an existing room
  socket.on('join_room', ({ code, name }) => {
    const room = getRoom(code);
    if (!room) return socket.emit('error', 'Room not found');
    if (room.state !== 'lobby') return socket.emit('error', 'Game already started');
    if (room.players.length >= 10) return socket.emit('error', 'Room is full (max 10)');

    const seat = room.players.length;
    room.players.push({ id: socket.id, name, seat });
    room.scores[socket.id] = 0;
    socket.join(code);
    socket.data.room = code;
    socket.data.name = name;
    socket.emit('room_joined', { code, playerId: socket.id, seat });
    io.to(code).emit('lobby_update', getLobbyData(code));
  });

  // Host starts the game
  socket.on('start_game', () => {
    const code = socket.data.room;
    const room = getRoom(code);
    if (!room || room.host !== socket.id) return;
    if (room.players.length < 4) return socket.emit('error', 'Need at least 4 players');

    startRound(code);
  });

  // Player swipes to pass card
  socket.on('swipe_pass', ({ direction }) => {
    const code = socket.data.room;
    const room = getRoom(code);
    if (!room || room.state !== 'playing') return;

    const myIndex = room.players.findIndex(p => p.id === socket.id);
    if (myIndex === -1) return;

    const myCard = room.cards[socket.id];
    if (!myCard) return; // Skip if player doesn't have a card

    const count = room.players.length;
    let targetIndex;
    if (direction === 'right') {
      targetIndex = (myIndex + 1) % count;
    } else {
      targetIndex = (myIndex - 1 + count) % count;
    }

    const targetCard = room.cards[room.players[targetIndex].id];
    const targetId = room.players[targetIndex].id;

    // Swap cards
    room.cards[socket.id] = targetCard;
    room.cards[targetId] = myCard;

    // Send card updates privately to each player (only their own card)
    room.players.forEach(p => {
      const card = room.cards[p.id];
      if (!card) return; // Skip players without cards
      io.to(p.id).emit('card_received', {
        card: createCard(card, card.isQuestion),
      });
    });

    // Check for matches after swap
    const match = checkForMatch(room);
    if (match && !room.matchedPairs.has(match.pairId)) {
      room.matchedPairs.add(match.pairId);
      io.to(code).emit('pair_matched', {
        count: room.matchedPairs.size,
      });

      // Check if all pairs matched
      const numPairs = Math.floor(room.players.length / 2);
      if (room.matchedPairs.size === numPairs) {
        endRound(code, true); // All pairs matched
      }
    }
  });

  // Host advances to next round
  socket.on('next_round', () => {
    const code = socket.data.room;
    const room = getRoom(code);
    if (!room || room.host !== socket.id) return;
    if (room.state !== 'between_rounds') return;

    if (room.activeRound >= room.totalRounds) {
      // Game won!
      room.state = 'ended';
      io.to(code).emit('game_won', {
        survivors: room.players
          .filter(p => !room.eliminations.has(p.id))
          .map(p => ({ id: p.id, name: p.name, score: room.scores[p.id] })),
        scores: room.scores,
      });
    } else {
      room.activeRound++;
      startRound(code);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const code = socket.data.room;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    room.players.forEach((p, i) => { p.seat = i; });

    if (room.players.length === 0) {
      clearInterval(room.timerInterval);
      delete rooms[code];
    } else {
      if (room.host === socket.id) room.host = room.players[0].id;
      io.to(code).emit('player_left', { name: socket.data.name });
      io.to(code).emit('lobby_update', getLobbyData(code));
    }
  });
});

function getLobbyData(code) {
  const room = getRoom(code);
  return {
    code: room.code,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
    })),
    host: room.host,
    activeRound: room.activeRound,
    scores: room.scores,
  };
}

function startRound(code) {
  const room = getRoom(code);
  room.state = 'playing';
  room.matchedPairs = new Set();

  // Get alive players
  const alivePlayers = room.players.filter(p => !room.eliminations.has(p.id));

  // Assign cards
  room.cards = assignCards(alivePlayers.map(p => p.id));

  // Set timer (60s for round 1, decrease by 5s each round)
  room.timerDuration = Math.max(40, 60 - (room.activeRound - 1) * 5);
  room.timerLeft = room.timerDuration;

  // Notify each player of round start with their card
  alivePlayers.forEach(p => {
    const card = room.cards[p.id];
    if (!card) return; // Skip players without cards (odd number)
    io.to(p.id).emit('round_start', {
      round: room.activeRound,
      timerDuration: room.timerDuration,
      numPairs: Math.floor(alivePlayers.length / 2),
      card: createCard(card, card.isQuestion),
    });
  });

  // Start timer
  clearInterval(room.timerInterval);
  room.timerInterval = setInterval(() => {
    room.timerLeft--;
    io.to(code).emit('timer_tick', {
      secondsLeft: room.timerLeft,
      total: room.timerDuration,
    });

    if (room.timerLeft <= 0) {
      clearInterval(room.timerInterval);
      endRound(code, false); // Timer expired
    }
  }, 1000);
}

function endRound(code, allMatched) {
  const room = getRoom(code);
  if (!room) return;
  room.state = 'between_rounds';
  clearInterval(room.timerInterval);

  // Find unmatched questions (their holders get eliminated)
  const alivePlayers = room.players.filter(p => !room.eliminations.has(p.id));
  const unmatched = [];

  if (!allMatched) {
    alivePlayers.forEach(p => {
      const card = room.cards[p.id];
      if (card && card.isQuestion && !room.matchedPairs.has(card.pairId)) {
        room.eliminations.add(p.id);
        unmatched.push(p.name);
      }
    });
  }

  const survivors = alivePlayers.filter(p => !room.eliminations.has(p.id));

  if (survivors.length === 0) {
    // Game over - everyone eliminated
    room.state = 'ended';
    io.to(code).emit('game_over', {
      reason: 'All players eliminated',
      scores: room.scores,
    });
  } else if (room.activeRound >= room.totalRounds) {
    // Game won after final round
    room.state = 'ended';
    io.to(code).emit('game_won', {
      survivors: survivors.map(p => ({
        id: p.id,
        name: p.name,
        score: room.scores[p.id],
      })),
      scores: room.scores,
    });
  } else {
    // More rounds to play
    io.to(code).emit('round_end', {
      round: room.activeRound,
      eliminated: unmatched,
      survivors: survivors.map(p => ({ id: p.id, name: p.name, score: room.scores[p.id] })),
      scores: room.scores,
      nextRound: room.activeRound + 1,
      isHost: room.host,
    });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Bomb Squad server running on port ${PORT}`);
});
