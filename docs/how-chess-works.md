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
board says *White is in check* or *Black is in check* and marks its square. These are
hints only: the board still lets you make any move the rules of the piece allow, red
squares included, and the server never hears about them.

**Turns.** After an accepted move the turn passes to the other side. The board
refreshes itself every few seconds, so you see your opponent's move without reloading.

**Winning.** The game ends when a king is taken; the board says who won. There is no
check or checkmate, no castling and no en passant — this is a demonstration of the
framework's interactive grid, not a tournament engine.

**Your games.** Your name at the top opens your page, with every game you are in.

## Why it is built this way

Nothing here is programmed. The board is the framework's *grid* interface view, the
same one that draws a calendar as a grid of days; a chess board is a grid of `a`–`h`
by `8`–`1`. Each piece is a record with a `square`; dragging it writes that square.
The data model then decides: its *checks* say what a legal move is (counting the
pieces between the two squares, and what stands on the destination), and its
*triggers* do what follows (the taken piece leaves the board, the turn passes, a
king taken ends the game). The model for all of this is about 150 lines of YAML.

The hints when you lift a piece are the one piece of code in the app:
`theme/static/chess.js`, a short script on the framework's client library. It reads
the pieces the board already shows, works out reach and attack in the browser, and
colours squares. It cannot write anything and the model never relies on it — which is
why the hints can say "unsafe" about a move the rules still allow. Check and mate as
*facts of the game* would be the model's job, with the attacked squares recorded as
data; the script is the viewer's convenience, done where the pieces already are.
