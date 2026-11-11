# Chess — a demonstration app for the data-driven framework

A game of chess at https://holmgren.ca/chess, written as data: the model
(`model/*.yaml`) says what a game, a player and a piece are and what a legal move
is; the pages (`pages/*.yaml`) say how they are shown. There is no code in this
repository. The [data-driven framework](https://github.com/timeofmind/data-driven-framework-go)
and its [Caddy handler](https://github.com/timeofmind/data-driven-framework-caddy2)
run it.

The point of the demonstration is the framework's **interactive grid**: the same
interface view that draws a calendar (a grid of days) draws a chess board (a grid of
`a`–`h` × `8`–`1`), and dragging a piece to a square writes the piece's `square` slot —
nothing more. Everything chess-like is in the model:

- a game **starts with** its 32 pieces (`starts_with`), each owned by one of the players;
- the pieces on a piece's square are a relationship **by matching slots** (`has_many` with
  `match`), whose `where` reads the moving piece as `self.*`; so are the pieces on the
  line of its move (`blockers`);
- the class's **checks** say what a legal move is, by counting those: whose turn it is,
  how each kind of piece moves, that the way is clear, what stands on the square;
- **triggers** do what follows an accepted move: the taken piece leaves the board
  (`via: victims`), a pawn on the last rank becomes a queen (`via: me`), the turn passes
  and taking the king ends the game (`via: game_id`).

Two accounts play through a **challenge** (`Challenge`: from, to, remote or in person,
colour, time control): the challenged player is its party and alone answers it; accepting
fires a trigger that creates the game. Remotely each side's pieces belong to its own
account; in person they all belong to white's, so one browser moves both. Black's board
is drawn from black's side (`flip` on the grid view). The other side's move reaches your board as it happens: the game page's views say
`live: push`, so the page keeps an event stream open and the server pushes every change
to what they show (checked against the viewer's access) — no polling. The clock is the model's too: the time control chosen when a game starts gives each side its time and
increment, every move is stamped as it reaches the server and its time comes off the mover's
clock, and a move after the mover's time is up is refused. The clocks that tick above the board
are the app's script, counting down from what the server last recorded.

A forgotten password is reset by email: `app.yaml` names the `PasswordReset` class, the
routing sends it to a mail listener (`routing/chess.yaml`: the local exim4, no
authentication) with the `password-reset` template — a `MailTemplate` record if an admin
made one at /mail-templates, else `mail/password-reset.yaml` — and the handler's /forgot
and /reset pages do the rest (`model/30-mail.yaml`).

Not described, as this is a demonstration: en passant, checkmate (a side in check with no move is stuck; the game ends when a king is taken), and a flag fall ending the game.
See `docs/how-chess-works.md` for the player's view.

**Nothing of a game is written to a database.** `routing/chess.yaml` keeps games and
pieces in a *memory* listener: every node holds its own copy, fed by the change log
and replicated through the cluster, and rebuilt from the whole log when a node starts.
Only players (and sessions) are in a SQLite database the nodes share.

## Layout

```
app.yaml        the manifest: name, model and page globs, theme, sign-up, nav
model/          the data model (players; games and pieces, with the rules)
routing/        where the data lives: players in SQLite, games and pieces in memory
pages/          one file per page, with its interface views
mail/           default mail templates (password-reset.yaml), replaced by MailTemplate records of the same name
theme/          layout.html (adds chess.css and chess.js) and static/: chess.css (the board's look),
                chess.js (move and attack hints on the framework's client library, dd.js)
Caddyfile       one node of two, mounted below /chess
deploy/         install.sh (runit services chess-n1 and chess-n2), nginx upstream and location
```

## Checks

```sh
make check      # validate the model and pages; load the whole app in the handler
make report     # which pages read and write each class and field
```

## Deploy

```sh
sudo deploy/install.sh        # build the handler, install the app, (re)start the service
```

Then add `deploy/nginx-chess.conf`'s upstream to `conf.d/` and its location to the
holmgren.ca server block, and reload nginx. Admin logins go in `/etc/chess/admins`
(not in this repository).

## UML

The handler draws the model and pages as diagrams at `/chess/uml`.
