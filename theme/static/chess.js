// The chess app's own script, on the framework's client library (dd.js).
//
// The model decides every move; this script only shows things the viewer
// would otherwise work out by eye, from the rows the board already shows:
// on picking up a piece, the squares its own rules let it go to (a dot) or
// capture on (a ring), and for a king the squares the other side attacks
// (red); after every redraw, whether a king is in check — and checkmate or
// stalemate, when the side to move has no move left. A king is not
// dropped on a red square: the drop is cancelled before anything is posted.
// And the clocks: two faces above the board counting down in the browser
// from what the server last recorded (the game's record, read through the
// API after every change of the board). Nothing here is posted — the server
// never hears from this script.
(function () {
  "use strict";
  var KIND = { "♔": "king", "♕": "queen", "♖": "rook", "♗": "bishop", "♘": "knight", "♙": "pawn",
               "♚": "king", "♛": "queen", "♜": "rook", "♝": "bishop", "♞": "knight", "♟": "pawn" };
  var FILES = "abcdefgh";
  function sq(f, r) { return f >= 1 && f <= 8 && r >= 1 && r <= 8 ? FILES[f - 1] + r : null; }
  function fileOf(s) { return FILES.indexOf(s[0]) + 1; }
  function rankOf(s) { return +s[1]; }
  function other(c) { return c === "white" ? "black" : "white"; }

  // position reads the board's rows: {square: {colour, kind, square}}.
  function position(view) {
    var pos = {};
    view.rows().forEach(function (r) {
      var f = r.fields;
      if (!f.square) return;
      pos[f.square] = { colour: f.colour, kind: KIND[(f.glyph || r.text).trim()] || "pawn", square: f.square };
    });
    return pos;
  }

  var DIRS = { rook: [[1, 0], [-1, 0], [0, 1], [0, -1]], bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
  DIRS.queen = DIRS.rook.concat(DIRS.bishop);
  DIRS.king = DIRS.queen;
  var KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

  // attacks: the squares a piece attacks, stopping at the first piece in a line.
  function attacks(pc, pos) {
    var out = [], f = fileOf(pc.square), r = rankOf(pc.square);
    if (pc.kind === "pawn") {
      var d = pc.colour === "white" ? 1 : -1;
      [sq(f - 1, r + d), sq(f + 1, r + d)].forEach(function (s) { if (s) out.push(s); });
      return out;
    }
    if (pc.kind === "knight") {
      KNIGHT.forEach(function (m) { var s = sq(f + m[0], r + m[1]); if (s) out.push(s); });
      return out;
    }
    var slides = pc.kind !== "king";
    DIRS[pc.kind].forEach(function (m) {
      for (var i = 1; ; i++) {
        var s = sq(f + m[0] * i, r + m[1] * i);
        if (!s) break;
        out.push(s);
        if (pos[s] || !slides) break;
      }
    });
    return out;
  }
  // attacked: every square the pieces of a colour attack; `without` is a
  // square treated as empty (the king being moved, so lines through it count).
  function attacked(colour, pos, without) {
    var set = {}, p = pos;
    if (without) { p = {}; Object.keys(pos).forEach(function (s) { if (s !== without) p[s] = pos[s]; }); }
    Object.keys(p).forEach(function (s) {
      if (p[s].colour !== colour) return;
      attacks(p[s], p).forEach(function (t) { set[t] = true; });
    });
    return set;
  }
  // moves: where a piece may go by its own rules — captures included, own
  // pieces excluded; pawns push one (two from the start rank) and capture
  // diagonally. No castling or en passant: the model doesn't know them either.
  function moves(pc, pos) {
    var out = [];
    if (pc.kind === "pawn") {
      var f = fileOf(pc.square), r = rankOf(pc.square), d = pc.colour === "white" ? 1 : -1, start = pc.colour === "white" ? 2 : 7;
      var one = sq(f, r + d), two = sq(f, r + 2 * d);
      if (one && !pos[one]) {
        out.push(one);
        if (r === start && two && !pos[two]) out.push(two);
      }
      attacks(pc, pos).forEach(function (s) { if (pos[s] && pos[s].colour !== pc.colour) out.push(s); });
      return out;
    }
    attacks(pc, pos).forEach(function (s) { if (!pos[s] || pos[s].colour !== pc.colour) out.push(s); });
    return out;
  }
  function kingOf(colour, pos) {
    var k = null;
    Object.keys(pos).forEach(function (s) { if (pos[s].kind === "king" && pos[s].colour === colour) k = s; });
    return k;
  }
  // after: the position once a piece has moved from one square to another
  // (whatever stood there is taken).
  function after(pos, from, to) {
    var next = {};
    Object.keys(pos).forEach(function (s) { if (s !== from && s !== to) next[s] = pos[s]; });
    var pc = pos[from];
    next[to] = { colour: pc.colour, kind: pc.kind, square: to };
    return next;
  }
  // hasLegalMove: some move of the colour leaves its own king unattacked —
  // the same rule the model applies to every move. None, in check: mate;
  // none, not in check: stalemate.
  function hasLegalMove(colour, pos) {
    var squares = Object.keys(pos);
    for (var i = 0; i < squares.length; i++) {
      var pc = pos[squares[i]];
      if (pc.colour !== colour) continue;
      var tos = moves(pc, pos);
      for (var j = 0; j < tos.length; j++) {
        var next = after(pos, pc.square, tos[j]);
        var k = kingOf(colour, next);
        if (k && !attacked(other(colour), next)[k]) return true;
      }
    }
    return false;
  }

  // clocks: the game's record says what each side had left when it last
  // moved (its starting time until then), when the last move arrived and
  // whose move it is; the side to move counts down from that plus its
  // increment, by the server's clock — to due_ms, the moment the server's
  // own timed trigger ends the game, which it pushes here. The server's clock
  // is ours plus an offset: from the Date header of the record's fetch (to
  // the second), then from our own moves (the server's stamp against when we
  // posted — to half a round trip). The server is the only authority on the
  // clock: the face reads 0:00 and waits for its word, and a move made in
  // between is refused by the server and put back by the board.
  // The game's record (turn, status, the clocks), read once through the API
  // and kept up to date by the pushes; record is for everyone, game only
  // while there is a clock.
  var record = null, apiBase = "";
  function clocks(board, onGame) {
    var m = location.pathname.match(/\/games\/(\d+)/);
    if (!m) return;
    var api = apiBase + "/games/" + m[1];
    var el = document.createElement("div");
    el.className = "chess-clocks";
    el.hidden = true;
    var faces = {};
    ["white", "black"].forEach(function (colour) {
      var f = document.createElement("div");
      f.className = "chess-clock " + colour;
      f.innerHTML = '<span class="who">' + (colour === "white" ? "♔ White" : "♚ Black") + '</span> <span class="time"></span><span class="flag" hidden> ⚑ out of time</span>';
      el.appendChild(f);
      faces[colour] = f;
    });
    board.el.insertBefore(el, board.grid());
    board.mark(el);
    var game = null, offset = 0, posted = 0, exact = false, told = false;

    function sync() {
      var sent = Date.now();
      return fetch(api, { credentials: "same-origin", headers: { "Accept": "application/json" } }).then(function (r) {
        var got = Date.now(), d = Date.parse(r.headers.get("Date") || "");
        if (!exact && d) offset = d + 500 - (sent + got) / 2;
        return r.json();
      }).then(function (j) {
        var g = j && j.data ? j.data : j;
        record = g || record;
        // The record in hand: say what the board shows (a game opened
        // already mated is reported now, not only on its next change).
        if (onGame && !told) { told = true; setTimeout(onGame, 0); }
        if (!g || g.initial_ms == null) { el.hidden = true; game = null; return; }
        // Our own move: the server stamped it between our posting it and its answer.
        if (posted && game && g.last_move_ms && g.last_move_ms !== game.last_move_ms) {
          offset = g.last_move_ms - (posted + got) / 2;
          exact = true;
          posted = 0;
        }
        lastSeen = g.last_move_ms || lastSeen;
        game = g;
        el.hidden = false;
        tick();
      }).catch(function () {});
    }
    function fmt(ms) {
      if (ms <= 0) return "0:00";
      var s = Math.floor(ms / 1000), mn = Math.floor(s / 60), sec = s % 60;
      var out = (mn >= 60 ? Math.floor(mn / 60) + ":" + (mn % 60 < 10 ? "0" : "") : "") + (mn >= 60 ? mn % 60 : mn) + ":" + (sec < 10 ? "0" : "") + sec;
      if (ms < 10000) out += "." + Math.floor(ms % 1000 / 100);
      return out;
    }
    function left(colour) {
      var had = game[colour + "_ms"] == null ? game.initial_ms : game[colour + "_ms"];
      if (game.status !== "playing" || game.turn !== colour) return had;
      if (game.due_ms) return game.due_ms - (Date.now() + offset); // the server's moment
      var since = game.last_move_ms || game.started_ms;
      return had + (game.increment_ms || 0) - (Date.now() + offset - since);
    }
    function tick() {
      if (!game) return;
      ["white", "black"].forEach(function (colour) {
        var ms = left(colour), f = faces[colour];
        // The server's word ends the game on time; the face only waits at 0:00.
        var out = game.status === "finished" && game.ended_by === "timeout" && game.winner !== colour;
        f.querySelector(".time").textContent = fmt(ms);
        f.querySelector(".flag").hidden = !out;
        f.classList.toggle("running", game.status === "playing" && game.turn === colour);
        f.classList.toggle("low", ms > 0 && ms < 20000);
        f.classList.toggle("out", out);
      });
    }
    setInterval(tick, 100);
    // The game's record, read once; then the server pushes its changes to
    // this page (the detail view says live: push with the clock's fields),
    // so each push brings the clock up to date without another request.
    // Without the stream (an old proxy), the record is read again on every
    // change of the board, and now and then.
    var lastSeen = 0; // the last move's stamp we have seen
    document.addEventListener("dd:push", function (e) {
      var n = e.detail;
      if (n.class === "Game" && record && n.id == record.id && n.fields) {
        Object.keys(n.fields).forEach(function (k) { record[k] = n.fields[k]; });
        if (onGame && (n.fields.turn || n.fields.status)) setTimeout(onGame, 0); // the turn or the end: say what the board shows
      }
      if (!game || n.class !== "Game" || n.id != game.id || !n.fields) return;
      Object.keys(n.fields).forEach(function (k) { game[k] = n.fields[k]; });
      if (posted && n.fields.last_move_ms && n.fields.last_move_ms !== lastSeen) {
        offset = n.fields.last_move_ms - (posted + Date.now()) / 2; // our own move's stamp
        exact = true;
        posted = 0;
      }
      lastSeen = n.fields.last_move_ms || lastSeen;
      tick();
    });
    setInterval(function () { if (!(window.dd && dd.live && dd.live())) sync(); }, 30000);
    board.on("change", function () { if (!(dd.live && dd.live())) sync(); });
    board.on("drop", function (ev) { if (!ev.cancelled) posted = Date.now(); });
    board.on("moved", function () { if (!(dd.live && dd.live())) sync(); });
    board.on("refused", sync);
    sync();
  }

  function start() {
    var board = dd.view("board");
    if (!board) return;
    var script = document.querySelector('script[src$="/static/chess.js"]');
    apiBase = (script ? script.getAttribute("src").replace(/\/static\/chess\.js$/, "") : "") + "/api/v1";
    var note = document.createElement("p");
    note.className = "chess-note";
    note.hidden = true;
    board.el.insertBefore(note, board.grid());
    board.mark(note);

    function clear() {
      board.cells().forEach(function (c) { c.el.classList.remove("legal", "capture", "unsafe", "from"); });
    }
    // checks: a king on a square the other side attacks — and, for the side
    // to move, whether any move is left: none in check is checkmate, none
    // otherwise stalemate. The model never declares these (it only refuses
    // every move); the board says so. The redraw resets cell classes, so
    // this runs after every change.
    // toMove: whose move it is — from the board's intro, redrawn with the
    // board (the record may lag a push behind), else from the record.
    function toMove() {
      var m = (board.el.querySelector(".muted") || {}).textContent || "";
      m = m.toLowerCase();
      if (m.indexOf("black to move") === 0) return "black";
      if (m.indexOf("white to move") === 0) return "white";
      return record && record.turn ? record.turn : null;
    }
    // report sends the board's verdict to the server, once, from a player's
    // browser (one that may move something): a game played from one browser
    // ends on it, a remote game once both players' boards agree — or on the
    // winner's report alone when the server finds the position bears it out
    // (the losing king in check with no square to go to).
    var reported = false;
    function report(result, endedBy) {
      if (reported || !board.canMove() || !apiBase || (record && record.status !== "playing")) return;
      var m = location.pathname.match(/\/games\/(\d+)/);
      if (!m) return;
      reported = true;
      fetch(apiBase + "/me", { credentials: "same-origin", headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (me) {
          if (!me || !me.authenticated) return;
          return fetch(apiBase + "/verdicts", { method: "POST", credentials: "same-origin",
            headers: { "Content-Type": "application/json", "Accept": "application/json", "X-CSRF-Token": me.csrf_token },
            body: JSON.stringify({ game_id: m[1], player_id: String(me.id), result: result, ended_by: endedBy }) });
        }).catch(function (e) { console.error("verdict", e); });
    }
    function checks() {
      var pos = position(board), said = [], over = false, turn = toMove();
      ["white", "black"].forEach(function (colour) {
        var k = kingOf(colour, pos), name = colour === "white" ? "White" : "Black";
        var inCheck = !!k && !!attacked(other(colour), pos)[k];
        if (inCheck) {
          var c = board.cell(k);
          if (c) c.el.classList.add("in-check");
        }
        if (colour === turn && k && !hasLegalMove(colour, pos)) {
          said.push(inCheck ? "Checkmate: " + name + " has no move. " + (colour === "white" ? "Black" : "White") + " wins." : "Stalemate: " + name + " has no move. A draw.");
          over = true;
          report(inCheck ? (colour === "white" ? "black_wins" : "white_wins") : "draw", inCheck ? "checkmate" : "stalemate");
        } else if (inCheck) {
          said.push(name + " is in check.");
        }
      });
      note.textContent = said.join(" ");
      note.hidden = !said.length;
      note.classList.toggle("game-over", over);
    }
    var danger = {}; // while a king is lifted: the squares it must not go to
    board.on("change", function () { clear(); checks(); });
    board.on("dragstart", function (ev) {
      clear();
      danger = {};
      var pos = position(board), pc = pos[ev.row.fields.square];
      if (!pc) return;
      ev.cell.el.classList.add("from");
      if (pc.kind === "king") danger = attacked(other(pc.colour), pos, pc.square);
      moves(pc, pos).forEach(function (s) {
        var c = board.cell(s);
        if (!c) return;
        c.el.classList.add(pos[s] ? "capture" : "legal");
        if (danger[s]) c.el.classList.add("unsafe");
      });
    });
    // A king onto an attacked square: no drop cursor, and the drop is refused
    // here, so nothing is posted.
    board.on("dragover", function (ev) { if (danger[ev.cell.key]) ev.cancel(); });
    board.on("drop", function (ev) {
      if (!danger[ev.cell.key]) return;
      ev.cancel();
      note.textContent = "The king can't move to " + ev.cell.key + ": that square is attacked.";
      note.hidden = false;
      setTimeout(checks, 2500);
    });
    board.on("dragend", function () { clear(); danger = {}; });
    checks();
    clocks(board, checks); // after the drop handler above, so a cancelled drop isn't timed; checks again on the game's pushes
  }
  if (window.dd) dd.ready(start);
  else document.addEventListener("dd:ready", start);
})();
