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

const ITEMS = [
  { id: 'bomb',      emoji: '💣', name: 'Bomb',       desc: 'Pass it before it explodes!',                  isBomb: true  },
  { id: 'shield',    emoji: '🛡️', name: 'Shield',      desc: 'Immune from the vote if bomb explodes on you', power: 'shield'   },
  { id: 'magnifier', emoji: '🔍', name: 'Magnifier',   desc: 'Peek at one player\'s item secretly',          power: 'peek'     },
  { id: 'swap',      emoji: '🔀', name: 'Swap Card',   desc: 'Force two players to swap items',              power: 'swap'     },
  { id: 'freeze',    emoji: '⏸️', name: 'Freeze',      desc: 'Stop the timer for 5 seconds',                power: 'freeze'   },
  { id: 'curse',     emoji: '💀', name: 'Cursed Box',  desc: 'Looks safe — counts as suspicious in the vote', power: 'curse'  },
  { id: 'disguise',  emoji: '🎭', name: 'Disguise',    desc: 'Your item appears as something else to others', power: 'disguise'},
  { id: 'package',   emoji: '📦', name: 'Package',     desc: 'Just a regular package. Nothing special.',     power: null       },
  { id: 'gem',       emoji: '💎', name: 'Gem',         desc: 'Worth 2 points if you hold it when time runs out (if alive)', power: 'gem' },
];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function getRoom(roomCode) {
  return rooms[roomCode];
}

function assignItems(players) {
  // Always include the bomb + a mix of other items
  const pool = shuffle([...ITEMS.filter(i => !i.isBomb)]);
  const selected = pool.slice(0, players.length - 1);
  const allItems = shuffle([ITEMS[0], ...selected]); // bomb + others
  const result = {};
  players.forEach((pid, i) => {
    result[pid] = { ...allItems[i] };
  });
  return result;
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
      state: 'lobby',
      items: {},
      timerDuration: 60,
      timerLeft: 60,
      timerInterval: null,
      bomber: null,
      detective: null,
      scores: { [socket.id]: 0 },
      round: 1,
    };
    socket.join(code);
    socket.data.room = code;
    socket.data.name = name;
    socket.emit('room_created', { code, playerId: socket.id });
    io.to(code).emit('lobby_update', lobbyData(code));
  });

  // Join an existing room
  socket.on('join_room', ({ code, name }) => {
    const room = getRoom(code);
    if (!room) return socket.emit('error', 'Room not found');
    if (room.state !== 'lobby') return socket.emit('error', 'Game already started');
    if (room.players.length >= 6) return socket.emit('error', 'Room is full (max 6)');

    const seat = room.players.length;
    room.players.push({ id: socket.id, name, seat });
    room.scores[socket.id] = 0;
    socket.join(code);
    socket.data.room = code;
    socket.data.name = name;
    socket.emit('room_joined', { code, playerId: socket.id, seat });
    io.to(code).emit('lobby_update', lobbyData(code));
  });

  // Host starts the game
  socket.on('start_game', () => {
    const code = socket.data.room;
    const room = getRoom(code);
    if (!room || room.host !== socket.id) return;
    if (room.players.length < 2) return socket.emit('error', 'Need at least 2 players');

    startRound(code);
  });

  // Player swipes to pass their item
  socket.on('swipe_pass', ({ direction }) => {
    const code = socket.data.room;
    const room = getRoom(code);
    if (!room || room.state !== 'playing') return;

    const myIndex = room.players.findIndex(p => p.id === socket.id);
    if (myIndex === -1) return;

    const count = room.players.length;
    let targetIndex;
    if (direction === 'right') {
      targetIndex = (myIndex + 1) % count;
    } else {
      targetIndex = (myIndex - 1 + count) % count;
    }

    const myItem = room.items[socket.id];
    const targetItem = room.items[room.players[targetIndex].id];
    const targetId = room.players[targetIndex].id;

    // Swap items
    room.items[socket.id] = targetItem;
    room.items[targetId] = myItem;

    // Notify all players of item changes (send each player only their own item)
    room.players.forEach(p => {
      io.to(p.id).emit('item_update', {
        myItem: room.items[p.id],
        passerName: room.players[myIndex].name,
        direction,
        passedFrom: myIndex,
        passedTo: targetIndex,
      });
    });
  });

  // Player uses their item's power
  socket.on('use_power', ({ targetId }) => {
    const code = socket.data.room;
    const room = getRoom(code);
    if (!room || room.state !== 'playing') return;

    const myItem = room.items[socket.id];
    if (!myItem || !myItem.power) return;

    if (myItem.power === 'peek' && targetId) {
      const targetItem = room.items[targetId];
      const targetName = room.players.find(p => p.id === targetId)?.name;
      // Only show to the peek-user
      socket.emit('peek_result', { targetName, item: targetItem });
      room.items[socket.id] = { ...ITEMS.find(i => i.id === 'package') }; // consumed
      socket.emit('item_update', { myItem: room.items[socket.id] });

    } else if (myItem.power === 'freeze') {
      // Stop timer for 5 seconds
      clearInterval(room.timerInterval);
      io.to(code).emit('timer_freeze', { seconds: 5 });
      setTimeout(() => {
        if (room.state === 'playing') resumeTimer(code);
      }, 5000);
      room.items[socket.id] = { ...ITEMS.find(i => i.id === 'package') };
      socket.emit('item_update', { myItem: room.items[socket.id] });

    } else if (myItem.power === 'swap' && targetId) {
      const targetB = room.players.find(p => p.id !== socket.id && p.id !== targetId);
      if (!targetB) return;
      const tmp = room.items[targetId];
      room.items[targetId] = room.items[targetB.id];
      room.items[targetB.id] = tmp;
      room.players.forEach(p => {
        io.to(p.id).emit('item_update', { myItem: room.items[p.id] });
      });
      io.to(code).emit('power_used', { by: socket.data.name, power: 'swap' });
      room.items[socket.id] = { ...ITEMS.find(i => i.id === 'package') };
      socket.emit('item_update', { myItem: room.items[socket.id] });
    }
  });

  // Vote after explosion
  socket.on('submit_vote', ({ accusedId }) => {
    const code = socket.data.room;
    const room = getRoom(code);
    if (!room || room.state !== 'voting') return;

    if (!room.votes) room.votes = {};
    room.votes[socket.id] = accusedId;

    const eligibleVoters = room.players.filter(p => p.id !== room.explodedPlayer);
    if (Object.keys(room.votes).length >= eligibleVoters.length) {
      resolveVotes(code);
    }
  });

  // Play again
  socket.on('play_again', () => {
    const code = socket.data.room;
    const room = getRoom(code);
    if (!room || room.host !== socket.id) return;
    room.round++;
    startRound(code);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const code = socket.data.room;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    // Reassign seats
    room.players.forEach((p, i) => { p.seat = i; });

    if (room.players.length === 0) {
      clearInterval(room.timerInterval);
      delete rooms[code];
    } else {
      if (room.host === socket.id) room.host = room.players[0].id;
      io.to(code).emit('player_left', { name: socket.data.name });
      io.to(code).emit('lobby_update', lobbyData(code));
    }
  });
});

function lobbyData(code) {
  const room = getRoom(code);
  return {
    code: room.code,
    players: room.players.map(p => ({ id: p.id, name: p.name, seat: p.seat })),
    host: room.host,
    round: room.round,
    scores: room.scores,
  };
}

function startRound(code) {
  const room = getRoom(code);
  room.state = 'playing';
  room.votes = {};
  room.explodedPlayer = null;

  // Assign roles
  const shuffledPlayers = shuffle(room.players);
  room.bomber = shuffledPlayers[0].id;
  room.detective = shuffledPlayers[1].id;

  // Assign items
  room.items = assignItems(room.players.map(p => p.id));

  // Timer
  room.timerDuration = Math.max(30, 60 - (room.round - 1) * 3);
  room.timerLeft = room.timerDuration;

  // Tell each player their role + item privately
  room.players.forEach(p => {
    let role = 'civilian';
    if (p.id === room.bomber) role = 'bomber';
    if (p.id === room.detective) role = 'detective';
    io.to(p.id).emit('round_start', {
      role,
      myItem: room.items[p.id],
      players: room.players.map(pl => ({ id: pl.id, name: pl.name, seat: pl.seat })),
      timerDuration: room.timerDuration,
      round: room.round,
    });
  });

  resumeTimer(code);
}

function resumeTimer(code) {
  const room = getRoom(code);
  if (!room) return;
  clearInterval(room.timerInterval);
  room.timerInterval = setInterval(() => {
    room.timerLeft--;
    io.to(code).emit('timer_tick', { secondsLeft: room.timerLeft, total: room.timerDuration });
    if (room.timerLeft <= 0) {
      clearInterval(room.timerInterval);
      explode(code);
    }
  }, 1000);
}

function explode(code) {
  const room = getRoom(code);
  if (!room) return;
  room.state = 'voting';

  // Find who has the bomb
  const bomberHolder = Object.entries(room.items).find(([, item]) => item.isBomb)?.[0];
  room.explodedPlayer = bomberHolder;

  const bomberName = room.players.find(p => p.id === bomberHolder)?.name;
  const hasShield = room.items[bomberHolder]?.power === 'shield';

  io.to(code).emit('explosion', {
    explodedPlayerId: bomberHolder,
    explodedPlayerName: bomberName,
    hasShield,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
  });
}

function resolveVotes(code) {
  const room = getRoom(code);
  if (!room) return;
  room.state = 'results';

  // Tally votes
  const tally = {};
  Object.values(room.votes).forEach(id => {
    tally[id] = (tally[id] || 0) + 1;
  });

  const mostVoted = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const bomberCaught = mostVoted === room.bomber;
  const bomberExploded = room.explodedPlayer === room.bomber;
  const hasShield = room.items[room.explodedPlayer]?.power === 'shield';

  // Scoring
  if (bomberExploded && !hasShield) {
    // Civilians win — everyone except bomber gets a point
    room.players.forEach(p => {
      if (p.id !== room.bomber) room.scores[p.id] = (room.scores[p.id] || 0) + 1;
    });
  } else if (bomberCaught) {
    room.players.forEach(p => {
      if (p.id !== room.bomber) room.scores[p.id] = (room.scores[p.id] || 0) + 1;
    });
  } else {
    // Bomber wins
    room.scores[room.bomber] = (room.scores[room.bomber] || 0) + 2;
  }

  const bomberName = room.players.find(p => p.id === room.bomber)?.name;
  const detectiveName = room.players.find(p => p.id === room.detective)?.name;

  io.to(code).emit('round_result', {
    bomberCaught,
    bomberExploded,
    hasShield,
    bomberName,
    detectiveName,
    bomberPlayerId: room.bomber,
    votes: tally,
    scores: room.scores,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    isHost: room.host,
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Pass the Bomb server running on port ${PORT}`);
});
