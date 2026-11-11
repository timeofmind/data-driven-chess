# How Chess works — the player's view

**Signing up.** Anyone can join with an email, a password and a name. Your name is
what other players see.

**Starting a game.** *Start a game* asks who plays black; you play white and move
first. Choose yourself to move both sides (handy for trying it out). The board appears
with the pieces in their starting squares.

**Moving.** Drag one of your pieces to a square. The move is accepted or refused on the
spot, with the reason: *it's not your turn*, *a knight moves two squares one way and one
the other*, *a rook moves along a rank or file, over empty squares*, *one of your own
pieces is there*. A piece you drop on an opponent's piece takes it; taken pieces are
listed under the board. A pawn that reaches the far rank becomes a queen.

**Picking up a piece.** The moment you lift a piece, the squares its own rules let it
go to show a dot, and the opponent's pieces it could take show a ring. Lift your king
and the squares the other side attacks turn red. When a king stands under attack, the
board says *White is in check* or *Black is in check* and marks its square. The board
won't let you drop a king on a red square, and the model refuses the move if it is
made some other way. Everything else is a hint: the move is the model's to accept or
refuse, and the server never hears about the hints.

**The clock.** The server records when the game started and the exact moment each
move reached it, so every move's time is the server's measure, not the player's
browser's. The moves list shows how long each move took, and the game shows the total
time each side has used. (The clock does not yet end a game; it only keeps the time.)

**Turns.** After an accepted move the turn passes to the other side. The board
refreshes itself every few seconds, so you see your opponent's move without reloading.

**The king.** No move may leave your own king in check: a king can't step onto a
square the other side attacks, a piece can't move off a line it shields the king on,
and when you are in check the only moves accepted are those that end it — taking the
attacker, blocking it or moving the king. Anything else is refused with *your king
would be in check*, whichever way the move is made. The board shows attacked squares
in red when you lift a king, and says *White is in check* or *Black is in check*; the
game records it too (*In check: Yes*) and the move that gave it gets a + in the PGN.

**Castling.** Drag the king from its first square two files toward a rook: to g1 or
c1 (g8 or c8 for black). The rook moves with it. The move is accepted only on the
king's first move, with a rook that has never moved, over empty squares, and neither
out of check nor across or onto an attacked square; otherwise it is refused and the
message says what castling needs. The PGN writes O-O or O-O-O.

**Winning.** The game ends when a king is taken; the board says who won. Checkmate is
not yet declared (a side in check with no move to make is simply stuck), and there is
no en passant — this is a demonstration of the
framework's interactive grid, not a tournament engine.

**Your games.** Your name at the top opens your page, with every game you are in.

## Why it is built this way

Nothing here is programmed. The board is the framework's *grid* interface view, the
same one that draws a calendar as a grid of days; a chess board is a grid of `a`–`h`
by `8`–`1`. Each piece is a record with a `square`; dragging it writes that square.
The data model then decides: its *checks* say what a legal move is (counting the
pieces between the two squares, and what stands on the destination), and its
*triggers* do what follows (the taken piece leaves the board, the turn passes, a
king taken ends the game). The model for all of this is about 150 lines of YAML. The clock is three expressions
in the trigger that passes the turn: the game keeps the moment of the last move
(`now_ms`), the moment before it, and each side's total, and the move's record takes
the difference.

The hints when you lift a piece are the one piece of code in the app:
`theme/static/chess.js`, a short script on the framework's client library. It reads
the pieces the board already shows, works out reach and attack in the browser, and
colours squares and refuses a king's drop on an attacked square. It cannot write
anything and the model never relies on it. The rule is one check on the moving piece:
*after this move, no enemy piece attacks my king's square*. A check is a condition on
the position the move would leave, so it covers moving into check, uncovering it and
staying in it with one sentence. What makes it answerable is that the position after
the move differs from the stored one in three ways, each said in the rule: the mover's
old square is empty, its new square is occupied, and what stood there is taken. One
relationship lists the enemy pieces that would attack the king's square (knights,
pawns and the other king by geometry; a slider when nothing stands between — a second
relationship counted inside the first). The game remembers where each king stands,
and the mirror of the same relationship tells whether a move *gives* check. Nothing
else is stored. Castling is the same vocabulary once more: each piece counts its own
moves, the king's check allows the two-file step when the corner rook has none, the
rank between is empty, the game is not in check and the crossed square is not
attacked; a trigger on the king's move then places the rook, marked so that its own
save changes no turn and records no move. The script is the viewer's convenience, done
where the pieces already are; the rule is the model's.
