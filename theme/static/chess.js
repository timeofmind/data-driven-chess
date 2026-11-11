// The chess app's own script, on the framework's client library (dd.js).
//
// The model decides every move; this script only shows things the viewer
// would otherwise work out by eye, from the rows the board already shows:
// on picking up a piece, the squares its own rules let it go to (a dot) or
// capture on (a ring), and for a king the squares the other side attacks
// (red); after every redraw, whether a king is in check. A king is not
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

  // clocks: the game's record says what each side had left when it last
  // moved (its starting time until then), when the last move arrived and
  // whose move it is; the side to move counts down from that plus its
  // increment, by the server's clock. The server's clock is ours plus an
  // offset: from the Date header of the record's fetch (to the second), then
  // from our own moves (the server's stamp against when we posted — to half
  // a round trip). Below zero the face reads 0:00 and is flagged; the server
  // refuses the move itself, so this only says what it will say.
  function clocks(board) {
    var m = location.pathname.match(/\/games\/(\d+)/);
    if (!m) return;
    var script = document.querySelector('script[src$="/static/chess.js"]');
    var api = (script ? script.getAttribute("src").replace(/\/static\/chess\.js$/, "") : "") + "/api/v1/games/" + m[1];
    var el = document.createElement("div");
    el.className = "chess-clocks";
    el.hidden = true;
    var faces = {};
    ["white", "black"].forEach(function (colour) {
      var f = document.createElement("div");
      f.className = "chess-clock " + colour;
      f.innerHTML = '<span class="who">' + (colour === "white" ? "♔ White" : "♚ Black") + '</span> <span class="time"></span><span class="flag" hidden> ⚑ time is up</span>';
      el.appendChild(f);
      faces[colour] = f;
    });
    board.el.insertBefore(el, board.grid());
    board.mark(el);
    var game = null, offset = 0, posted = 0, exact = false;

    function sync() {
      var sent = Date.now();
      return fetch(api, { credentials: "same-origin", headers: { "Accept": "application/json" } }).then(function (r) {
        var got = Date.now(), d = Date.parse(r.headers.get("Date") || "");
        if (!exact && d) offset = d + 500 - (sent + got) / 2;
        return r.json();
      }).then(function (j) {
        var g = j && j.data ? j.data : j;
        if (!g || g.initial_ms == null) { el.hidden = true; game = null; return; }
        // Our own move: the server stamped it between our posting it and its answer.
        if (posted && game && g.last_move_ms && g.last_move_ms !== game.last_move_ms) {
          offset = g.last_move_ms - (posted + got) / 2;
          exact = true;
        }
        posted = 0;
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
      var since = game.last_move_ms || game.started_ms;
      return had + (game.increment_ms || 0) - (Date.now() + offset - since);
    }
    function tick() {
      if (!game) return;
      ["white", "black"].forEach(function (colour) {
        var ms = left(colour), f = faces[colour];
        f.querySelector(".time").textContent = fmt(ms);
        f.querySelector(".flag").hidden = ms > 0;
        f.classList.toggle("running", game.status === "playing" && game.turn === colour);
        f.classList.toggle("low", ms > 0 && ms < 20000);
        f.classList.toggle("out", ms <= 0);
      });
    }
    setInterval(tick, 100);
    setInterval(sync, 30000);
    board.on("change", sync);
    board.on("drop", function (ev) { if (!ev.cancelled) posted = Date.now(); });
    board.on("moved", sync);
    board.on("refused", sync);
    sync();
  }

  function start() {
    var board = dd.view("board");
    if (!board) return;
    var note = document.createElement("p");
    note.className = "chess-note";
    note.hidden = true;
    board.el.insertBefore(note, board.grid());
    board.mark(note);

    function clear() {
      board.cells().forEach(function (c) { c.el.classList.remove("legal", "capture", "unsafe", "from"); });
    }
    // checks: a king on a square the other side attacks. The redraw resets
    // cell classes, so this runs after every change.
    function checks() {
      var pos = position(board), said = [];
      ["white", "black"].forEach(function (colour) {
        var k = kingOf(colour, pos);
        if (!k || !attacked(other(colour), pos)[k]) return;
        said.push((colour === "white" ? "White" : "Black") + " is in check.");
        var c = board.cell(k);
        if (c) c.el.classList.add("in-check");
      });
      note.textContent = said.join(" ");
      note.hidden = !said.length;
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
    clocks(board); // after the drop handler above, so a cancelled drop isn't timed
  }
  if (window.dd) dd.ready(start);
  else document.addEventListener("dd:ready", start);
})();
