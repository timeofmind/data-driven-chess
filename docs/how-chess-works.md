# How Chess works — the player's view

**Signing up.** Anyone can join with an email, a password and a name. Your name is
what other players see, and no two players share one.

**A forgotten password.** *Forgot your password?* on the sign-in page asks for your
email and sends you a link (the answer is the same whether or not the email has an
account). The link opens a page naming the account, where you choose a new password;
it is good for an hour and works once, and you are signed in as you set it. The
message comes from the app through the host's own mail server; an admin can change
its wording at */mail-templates*.

**Challenging a player.** *Challenge a player* asks who you challenge, how you play,
your colour and the time control. *Remote*: each of you moves from your own browser,
wherever you are — only the account playing a side can move its pieces. *In person*:
you share one browser and board, and white's account moves both sides from it. The
challenge reaches the other player's *Challenges* page the moment you send it; they
accept or decline there (or you withdraw it first), and accepting starts the game at
once — it appears on the challenge page for both of you, and in *Games*. Black sees the
board from black's side.

**Playing against yourself.** *Play against yourself* starts a game you move both
sides of from this browser — against yourself, or someone beside you without an
account of their own — with a time control. The board appears with the pieces in
their starting squares.

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

**The clock.** Starting a game, you choose its time control: the minutes each side
starts with and the seconds added to its clock at the start of each of its moves (or
no clock). Two clocks above the board count down, the side to move running. The time
is the server's, not your browser's: it records the exact moment each move reaches
it, takes that move's time off the mover's clock and adds the increment, and refuses a
move that arrives after the mover's time is up. The moment the side to move runs out,
by the server's clock, the server ends the game itself — that side loses on time, the
game records the move it ended on, and every open board hears it at once. The moves
list shows how long each move took and what the mover had left. The clocks in the
browser only count down to the moment the server announced, and set themselves right
at every move; at 0:00 they wait for the server's word rather than declaring anything,
so a move you make in the last instant is judged by the server, and if it says the game
had already ended, the piece goes back.

**Turns.** After an accepted move the turn passes to the other side. Your page keeps
an event stream open to the server, which pushes every change to the game as it
happens: the other side's move lands on your board the moment the server has it,
the moves list and the clocks with it. Nothing is polled; if the stream drops, the
browser reconnects and the page catches up.

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
message says what castling needs. The PGN writes O-O or O-O-O. The game records a side
as castled (*White castled: Yes*), and the castling conditions are looked at only when a
king moves two squares — never on an ordinary move, and never again for a side that has
castled.

**En passant.** When a pawn steps two squares, the game remembers the square it skipped
for the next move alone. A pawn standing beside it may then capture onto that square,
and the pawn that passed is taken — the usual diagonal pawn move onto an empty square,
which the rules accept only then. The board shows the square with a capture ring when
you lift the pawn, and the PGN writes it as a capture (exd6).

**Winning.** The server ends the game; the board only tells it when. When the side to
move is in check and has no move that ends it, the winner's board claims checkmate, and
the server checks the claim against the position: the losing side is to move and in
check, and every square beside its king is off the board, one of its own pieces or
attacked. When that holds, the game ends on the claim alone, so a losing side that
closes its board cannot keep the game open. (The server does not look for a capture of
the checking piece or a block of the check; the board never claims a mate that isn't
one, so only a claim made around the board could end a game that way.) With no move
left but not in check, the board reports stalemate, a draw, which the server takes only
once both players' boards have reported it; a game played from one browser ends on its
one report. The game then shows its result and how it ended, the PGN its score, and no
more moves are accepted.

**A draw.** *Offer a draw* under the board makes an offer the other player sees at once;
they accept by offering the same, and the game is drawn. Open your offer in the list to
withdraw it. From one browser, *Agree a draw* ends the game as a draw at once.

**Your games.** Your name at the top opens your page, with every game you are in;
*Challenges* lists those made to you, waiting, and your own with their state.

**The coach.** On a wide screen the game's details sit to the left of the board and the
coach's box to its right: one line from Claude on your latest move, arriving a moment
after you make it, and replaced when your next move is answered (in a game played from one
account, or when you are only watching, the box follows the latest move of either side).
The server sends every recorded move, with the game so far, to a language model through
the framework's `llm` listener and writes the answer back onto the move; the box is pushed
to your page as the answer lands. The coach sees the moves, never your board, and nothing
it says changes the game. On a phone the page is one column and the coach is left out.

## Why it is built this way

Nothing here is programmed. The board is the framework's *grid* interface view, the
same one that draws a calendar as a grid of days; a chess board is a grid of `a`–`h`
by `8`–`1`. Each piece is a record with a `square`; dragging it writes that square.
The data model then decides: its *checks* say what a legal move is (counting the
pieces between the two squares, and what stands on the destination), and its
*triggers* do what follows (the taken piece leaves the board, the turn passes, a
king taken ends the game). The model for all of this is about 150 lines of YAML. The clock is a few expressions:
the time control chosen at the start gives each side its time and increment (two
`default_expr`), the trigger that passes the turn stamps the move's arrival (`now_ms`)
and takes its time off the mover's clock, a check refuses a move once that clock is
out, and the move's record keeps the time it took and what was left. The ticking is
the script's: the browser counts down from what the server last recorded.

A challenge is a record too: from one player to another, with the mode, the colour and
the clock. The challenged player is its *party* — the only one who may set its answer
(`write: party`) — and a trigger creates the game when the answer is *accepted*, white
and black by the challenger's colour; in person, every piece belongs to white's
account, so one browser moves both sides, while remotely each side's pieces belong to
its own account and nothing else can move them. The challenges pages say `live: push`,
so a challenge, an answer and the game arrive without a reload.

The password reset is the handler's, configured in `app.yaml` (`password_reset`): the
*forgot* page saves a `PasswordReset` record with a fresh code for the account, the
routing sends that record to the **mail listener** — the host's exim4 on port 25,
which trusts localhost, so no credentials — with the `password-reset` template, a
`MailTemplate` record in the database when there is one of that name, else the app's
`mail/password-reset.yaml`; the *reset* page finds the account by the code.

A game's end is a record too: a `Verdict` from a player (only a player of the game may
make one per ending), with the result and how it ended — a draw offer is one too; a trigger on the game finishes it on
one verdict for a game played from one browser, and for a remote game once the verdicts
of that game agreeing with this one count two, or on the winner's claim of checkmate
when the position bears it out: the verdict copies the losing king's square and side
(`default_expr` reading the game), and eight relationships, one per square beside the
king, count what makes that square no escape — its own piece on it, or a winning piece
attacking it (a slider with nothing between, the losing king itself not counted since it
would be the one moving). The server never searches for a mate; it only checks a claim.

The push is the framework's: a view that says `live: push` in the page file is
followed by the page's event stream, and the server sends it every change — on any
node of the cluster — to the records the view shows that the viewer may read, with the
fields the view names. The clocks read the game's clock fields from that push.

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
