// The chess app's own script, on the framework's client library (dd.js).
//
// The model decides every move; this script only shows things the viewer
// would otherwise work out by eye, from the rows the board already shows:
// on picking up a piece, the squares its own rules let it go to (a dot) or
// capture on (a ring), and for a king the squares the other side attacks
// (red); after every redraw, whether a king is in check. A king is not
// dropped on a red square: the drop is cancelled before anything is posted.
// Nothing here is posted — the server never hears from this script.
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
  }
  if (window.dd) dd.ready(start);
  else document.addEventListener("dd:ready", start);
})();
