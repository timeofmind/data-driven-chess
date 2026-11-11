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

**The king.** A king may not move onto a square the other side attacks: the move is
refused with *the king can't move into check*, whichever way it is made. The board
shows those squares in red before you drop. The game does not yet make you move
*out* of check, so a king left under attack can be taken.

**Winning.** The game ends when a king is taken; the board says who won. There is no
checkmate, no castling and no en passant — this is a demonstration of the
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
anything and the model never relies on it: the model knows what an attacked square is
on its own, and stores nothing for it. One relationship on a piece lists the enemy
pieces that attack its square: knights, pawns and the other king by geometry, and a
slider when it is on a line with the square and *nothing stands between* — which is a
second relationship, the pieces between the two, counted inside the first. So the rule
is one check, `attackers.count == 0`, asked of the pieces as they are at the moment the
king is dropped. The script is the viewer's convenience, done where the pieces already
are; the rule is the model's.
